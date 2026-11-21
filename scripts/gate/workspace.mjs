/**
 * Git access for the gate runner: reading `HEAD`, the clean-tree check, and
 * the `--fresh-clone` temp checkout (spec stabilize-and-cleanup, D-10 and WI-4).
 *
 * git is always spawned without a shell and with its arguments as an array,
 * so no value from the command line is ever parsed by a shell. The clone URL
 * and the ref reach this module already validated by `cli.mjs`.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Upper bound for `git clone`; a full clone of the repo takes well under this. */
const CLONE_TIMEOUT_MS = 15 * 60 * 1000;

/** Upper bound for `git checkout` and `git rev-parse`. */
const GIT_TIMEOUT_MS = 5 * 60 * 1000;

/** File descriptor of this process's stderr; git's own stdout is sent there. */
const STDERR_FD = 2;

/** Prefix of the temp directory a fresh clone is made in. */
const CLONE_DIR_PREFIX = 'gate-clone-';

/** A full commit SHA as `git rev-parse HEAD` prints it (SHA-1 or SHA-256). */
const FULL_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/**
 * git configuration for the clone command only: every transport is refused
 * except https, so neither the URL nor a redirect can reach `ext::`, `file`
 * or `ssh` (defense in depth behind the URL check in `cli.mjs`).
 */
const CLONE_PROTOCOL_CONFIG = ['-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always'];

/**
 * Environment for git: never prompt for credentials, in the terminal or in
 * Git Credential Manager, so an unreachable or private URL fails instead of
 * waiting on input.
 */
const NON_INTERACTIVE_GIT_ENV = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

/**
 * @typedef {object} GitResult
 * @property {number} code Exit code; non-zero when git failed, timed out or could not start.
 * @property {string} stdout Captured stdout ('' when not captured).
 * @property {string} problem One-line reason when `code` is non-zero.
 */

/**
 * Runs git without a shell.
 *
 * @param {readonly string[]} args Arguments after `git`.
 * @param {{ cwd: string, timeoutMs: number, captureStdout?: boolean }} options
 *   Working directory, upper bound, and whether stdout is captured (else it is
 *   sent to this process's stderr, so stdout carries only step output and the block).
 * @returns {Promise<GitResult>} The outcome; never rejects.
 */
function runGit(args, { cwd, timeoutMs, captureStdout = false }) {
  return new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, ...NON_INTERACTIVE_GIT_ENV },
      shell: false,
      stdio: ['ignore', captureStdout ? 'pipe' : STDERR_FD, 'inherit'],
      timeout: timeoutMs,
      windowsHide: true,
    });
    if (captureStdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    child.once('error', (error) => finish({ code: 1, stdout: '', problem: error.message }));
    child.once('close', (code, signal) => {
      if (code === 0) {
        finish({ code: 0, stdout, problem: '' });
      } else {
        const reason = signal === null ? `exit code ${code}` : `stopped by ${signal}`;
        finish({ code: code === null || code === 0 ? 1 : code, stdout, problem: reason });
      }
    });
  });
}

/**
 * Reads the full SHA of `HEAD` in `cwd`.
 *
 * @param {string} cwd A directory inside a git work tree.
 * @returns {Promise<string | null>} The lower-case SHA, or null when git fails
 *   or prints something that is not a full SHA.
 */
export async function readHeadSha(cwd) {
  const result = await runGit(['rev-parse', '--verify', 'HEAD'], {
    cwd,
    timeoutMs: GIT_TIMEOUT_MS,
    captureStdout: true,
  });
  const sha = result.stdout.trim().toLowerCase();
  return result.code === 0 && FULL_SHA_PATTERN.test(sha) ? sha : null;
}

/**
 * Runs `git status --porcelain=v1 --untracked-files=normal` in `cwd`. Its output
 * is empty exactly when the work tree has no tracked change and no untracked,
 * non-ignored file. The explicit `--untracked-files=normal` overrides a user or
 * repo `status.showUntrackedFiles=no`, which would otherwise hide untracked
 * files and let a dirty tree pass as clean (D-10).
 *
 * @param {string} cwd A directory inside a git work tree.
 * @returns {Promise<string | null>} What git printed (`''` for a clean tree),
 *   or null when git failed.
 */
export async function readWorkingTreeStatus(cwd) {
  const result = await runGit(['status', '--porcelain=v1', '--untracked-files=normal'], {
    cwd,
    timeoutMs: GIT_TIMEOUT_MS,
    captureStdout: true,
  });
  return result.code === 0 ? result.stdout : null;
}

/** Thrown when the fresh clone cannot be made; the runner exits non-zero with no block. */
export class FreshCloneError extends Error {
  /**
   * @param {string} message What failed.
   */
  constructor(message) {
    super(message);
    this.name = 'FreshCloneError';
  }
}

/**
 * Deletes every local tag that `HEAD` cannot reach, so the clone holds exactly
 * the tags that existed at the checked-out release. A release's own tests check
 * every tag in the repo (the changelog test, for one) and would fail on later
 * tags they cannot know about.
 *
 * @param {string} dir The fresh clone, with `HEAD` already detached at the ref.
 * @returns {Promise<void>}
 * @throws {FreshCloneError} When git cannot list or delete the tags.
 */
async function deleteUnreachableTags(dir) {
  const listing = await runGit(['tag', '--no-merged', 'HEAD'], {
    cwd: dir,
    timeoutMs: GIT_TIMEOUT_MS,
    captureStdout: true,
  });
  if (listing.code !== 0) {
    throw new FreshCloneError(`git tag --no-merged HEAD failed (${listing.problem})`);
  }

  const unreachableTags = listing.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (unreachableTags.length === 0) {
    return;
  }

  const deletion = await runGit(['tag', '-d', '--', ...unreachableTags], {
    cwd: dir,
    timeoutMs: GIT_TIMEOUT_MS,
  });
  if (deletion.code !== 0) {
    throw new FreshCloneError(`git tag -d of the unreachable tags failed (${deletion.problem})`);
  }
}

/**
 * Clones `url` into a new temp directory and detaches `HEAD` at `ref`. The
 * clone is full, not shallow. With `autocrlf`, the clone is made with
 * `-c core.autocrlf=true`, which also applies to the checkout. Tags the ref
 * cannot reach are then deleted (see {@link deleteUnreachableTags}).
 *
 * The caller owns the returned directory and removes it with
 * {@link removeFreshClone}; on failure this function removes it itself.
 *
 * @param {import('./cli.mjs').FreshClone} request Validated URL, ref and autocrlf flag.
 * @returns {Promise<{ dir: string, sha: string }>} The checkout and the full SHA of its `HEAD`.
 * @throws {FreshCloneError} When the clone, the checkout, the SHA check or the tag cleanup fails.
 */
export async function createFreshClone({ url, ref, autocrlf }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), CLONE_DIR_PREFIX));
  try {
    const autocrlfConfig = autocrlf ? ['-c', 'core.autocrlf=true'] : [];
    const clone = await runGit(
      [...CLONE_PROTOCOL_CONFIG, 'clone', '--no-checkout', ...autocrlfConfig, '--', url, dir],
      { cwd: os.tmpdir(), timeoutMs: CLONE_TIMEOUT_MS }
    );
    if (clone.code !== 0) {
      throw new FreshCloneError(`git clone failed (${clone.problem})`);
    }

    const checkout = await runGit(['checkout', '--detach', ref], {
      cwd: dir,
      timeoutMs: GIT_TIMEOUT_MS,
    });
    if (checkout.code !== 0) {
      throw new FreshCloneError(`git checkout of ${ref} failed (${checkout.problem})`);
    }

    const sha = await readHeadSha(dir);
    if (sha === null || !sha.startsWith(ref)) {
      throw new FreshCloneError(`the clone's HEAD is ${sha ?? 'unreadable'}, not ${ref}`);
    }

    await deleteUnreachableTags(dir);
    return { dir, sha };
  } catch (error) {
    await removeFreshClone(dir);
    throw error;
  }
}

/**
 * Removes a fresh-clone directory. A failure is reported on stderr and never
 * thrown, so it cannot replace the gate's own exit code.
 *
 * @param {string} dir Directory returned by {@link createFreshClone}.
 * @returns {Promise<void>}
 */
export async function removeFreshClone(dir) {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`gate: could not remove the fresh clone at ${dir}: ${reason}\n`);
  }
}
