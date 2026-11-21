/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-1 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-3
 * and 3.7 chain A): the release commit passes the six gate commands in a fresh
 * clone of origin made with core.autocrlf=true, on Windows.
 *
 * The SHA under test is `AC1_REF` when set, else the peeled `4.0.0` tag on origin;
 * when both exist they must agree. Run with `yarn verify:release` on Windows.
 * It never skips: every failure is an `expect` that shows its message.
 *
 * The test makes the clone itself, so that the gated commit sees the repository
 * as it was at its own release: after the checkout it deletes every tag the
 * release commit cannot reach. Later releases' tags would otherwise reach the
 * release's own tests, such as its CHANGELOG check, which cannot know about them.
 * The runner then runs the gate in that clone.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'gate.mjs');

/** The clone URL the release run starts from (D-10). */
const ORIGIN_URL = 'https://github.com/ValhallaTech/PortfolioPage-FS3';

/** The peeled release tag on origin. */
const RELEASE_TAG_REF = 'refs/tags/4.0.0^{}';

/** Marker that opens every v1 evidence block (D-10). */
const EVIDENCE_MARKER = '<!-- gate-evidence:v1 -->';

/** Exit code of the gate preflight when Yarn through Corepack is unavailable (D-10). */
const PRECONDITION_EXIT = 69;

/** Upper bound for `git ls-remote`. */
const LS_REMOTE_TIMEOUT_MS = 120_000;

/** Upper bound for the clone and the gate run together; below the suite's testTimeout. */
const RUN_BUDGET_MS = 55 * 60 * 1000;

/** Clone over https only, as the runner's own `--fresh-clone` does. */
const CLONE_PROTOCOL_CONFIG = ['-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always'];

/** Never prompt for credentials, in the terminal or in Git Credential Manager. */
const NON_INTERACTIVE_GIT_ENV = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

/** How much of the runner's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

const STEP_ROW = /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*$/;
const COMMIT_LINE = /^- Commit: `([^`]*)`\s*$/;

/**
 * Describes how the runner process ended: its exit status, signal, spawn error
 * and the tail of its stderr.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The description.
 */
function describeRun(run) {
  const stderr = (run.stderr ?? '').trimEnd();
  const tail = stderr ? stderr.slice(-STDERR_TAIL_CHARS) : '(empty)';
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return (
    `Gate runner: exit ${run.status}, signal ${run.signal}${spawnError}\n` +
    `Gate runner stderr (last ${STDERR_TAIL_CHARS} characters):\n${tail}`
  );
}

/**
 * Runs `assertion` and, when it fails, adds the runner's exit status and stderr
 * tail to the failure message, so a run that wrote no block shows why.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @param {() => void} assertion The `expect` call to run.
 */
function expectWithRunDetail(run, assertion) {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) {
      const detail = `\n\n${describeRun(run)}`;
      const original = error.message;
      error.message = `${original}${detail}`;
      // V8 formats `stack` lazily, so it may already carry the new message.
      if (typeof error.stack === 'string' && !error.stack.includes(detail)) {
        error.stack = error.stack.replace(original, error.message);
      }
    }
    throw error;
  }
}

/**
 * Reads a text file, or returns '' when it does not exist.
 *
 * @param {string} file Path to read.
 * @returns {string} The file's text.
 */
function readOptional(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Parses the first v1 evidence block in `text`.
 *
 * @param {string} text Text that may hold a block.
 * @returns {{ sha: string | null, exitCodes: Array<number | string> }}
 *   The block's commit SHA and Exit code column (numbers where numeric).
 */
function parseEvidenceBlock(text) {
  const block = { sha: null, exitCodes: [] };
  const start = text.indexOf(EVIDENCE_MARKER);
  if (start === -1) {
    return block;
  }
  let inTable = false;
  for (const line of text.slice(start + EVIDENCE_MARKER.length).split(/\r?\n/)) {
    const commit = COMMIT_LINE.exec(line);
    if (commit && block.sha === null) {
      block.sha = commit[1];
    }
    const row = STEP_ROW.exec(line);
    if (row) {
      inTable = true;
      block.exitCodes.push(/^\d+$/.test(row[3]) ? Number(row[3]) : row[3]);
    } else if (inTable && !line.startsWith('|')) {
      break;
    }
  }
  return block;
}

/**
 * Builds the D-10 Windows host precondition message for the repo's Yarn version.
 *
 * @returns {string} The message the gate preflight prints.
 */
function preconditionMessage() {
  const manifest = JSON.parse(readOptional(path.join(REPO_ROOT, 'package.json')) || '{}');
  const yarnVersion = String(manifest.packageManager ?? '').replace(/^yarn@/, '');
  return (
    `Gate precondition: Yarn ${yarnVersion} through Corepack is not available. ` +
    'Run npm install -g corepack@0.36.0, then corepack enable.'
  );
}

/**
 * Reads the commit the peeled `4.0.0` tag points at on origin.
 *
 * @returns {{ sha: string | null, problem: string | null }} The SHA (null when the tag
 *   is absent), or the problem when `git ls-remote` failed.
 */
function readReleaseTagSha() {
  const result = spawnSync('git', ['ls-remote', 'origin', RELEASE_TAG_REF], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(NON_INTERACTIVE_GIT_ENV),
    timeout: LS_REMOTE_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return {
      sha: null,
      problem: `AC-1: git ls-remote origin ${RELEASE_TAG_REF} failed (exit ${result.status}): ${reason}`,
    };
  }
  const sha = (result.stdout ?? '').trim().split(/\s+/)[0];
  return { sha: sha ? sha.toLowerCase() : null, problem: null };
}

/**
 * Resolves the SHA under test from `AC1_REF` and the peeled `4.0.0` tag.
 *
 * @returns {{ sha: string | null, problem: string | null }} The SHA, or the problem.
 */
function resolveReleaseSha() {
  const ref = (process.env.AC1_REF ?? '').trim().toLowerCase() || null;
  const tag = readReleaseTagSha();
  if (tag.problem) {
    return { sha: null, problem: tag.problem };
  }
  if (ref === null && tag.sha === null) {
    return {
      sha: null,
      problem: 'AC-1: no release commit yet: tag 4.0.0 is not on origin and AC1_REF is unset',
    };
  }
  if (ref !== null && tag.sha !== null && ref !== tag.sha) {
    return {
      sha: null,
      problem: `AC-1: AC1_REF ${ref} does not match the peeled tag 4.0.0 on origin, ${tag.sha}`,
    };
  }
  return { sha: ref ?? tag.sha, problem: null };
}

/**
 * The environment for child processes: this process's, without Jest's `JEST_*`
 * variables, plus `extra`.
 *
 * @param {NodeJS.ProcessEnv} [extra] Variables to add.
 * @returns {NodeJS.ProcessEnv} The environment.
 */
function childEnv(extra = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('JEST_'))
  );
  return { ...env, ...extra };
}

/**
 * Runs git, without a shell and without prompts, and captures its output.
 *
 * @param {string[]} args Git arguments.
 * @param {string} cwd Directory to run in.
 * @param {number} timeoutMs Upper bound for the call.
 * @returns {{ stdout: string, problem: string | null }} Stdout, or the problem when
 *   git did not exit 0.
 */
function runGit(args, cwd, timeoutMs) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: childEnv(NON_INTERACTIVE_GIT_ENV),
    timeout: Math.max(timeoutMs, 1),
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return {
      stdout: '',
      problem: `AC-1: git ${args.join(' ')} failed (exit ${result.status}): ${reason}`,
    };
  }
  return { stdout: result.stdout ?? '', problem: null };
}

/**
 * Clones origin into `dir` with `core.autocrlf=true`, detaches `HEAD` at `sha`, and
 * deletes every tag that `sha` cannot reach, so the clone holds the tags it had
 * at that release.
 *
 * @param {string} dir Directory to clone into; must not exist yet.
 * @param {string} sha The full release SHA.
 * @param {number} deadline `Date.now()` value by which every git call must end.
 * @returns {string | null} The first problem, or null when the clone is ready.
 */
function createReleaseClone(dir, sha, deadline) {
  const clone = runGit(
    [
      ...CLONE_PROTOCOL_CONFIG,
      'clone',
      '--no-checkout',
      '-c',
      'core.autocrlf=true',
      '--',
      ORIGIN_URL,
      dir,
    ],
    path.dirname(dir),
    deadline - Date.now()
  );
  if (clone.problem) {
    return clone.problem;
  }
  const checkout = runGit(['checkout', '--detach', sha], dir, deadline - Date.now());
  if (checkout.problem) {
    return checkout.problem;
  }
  const head = runGit(['rev-parse', '--verify', 'HEAD'], dir, deadline - Date.now());
  if (head.problem) {
    return head.problem;
  }
  if (!head.stdout.trim().toLowerCase().startsWith(sha)) {
    return `AC-1: the clone's HEAD is ${head.stdout.trim()}, not ${sha}`;
  }

  const later = runGit(['tag', '--no-merged', 'HEAD'], dir, deadline - Date.now());
  if (later.problem) {
    return later.problem;
  }
  const laterTags = later.stdout.split(/\r?\n/).filter((tag) => tag !== '');
  if (laterTags.length === 0) {
    return null;
  }
  return runGit(['tag', '--delete', ...laterTags], dir, deadline - Date.now()).problem;
}

describe('AC-1: the release commit passes the gate on a fresh Windows clone', () => {
  let workDir;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-fresh-clone-'));
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('exits 0 on all six gate commands for the release SHA, cloned with autocrlf', () => {
    expect(process.platform === 'win32' ? null : 'AC-1 must run on Windows').toBeNull();

    const release = resolveReleaseSha();
    expect(release.problem).toBeNull();

    const deadline = Date.now() + RUN_BUDGET_MS;
    const cloneDir = path.join(workDir, 'clone');
    expect(createReleaseClone(cloneDir, release.sha, deadline)).toBeNull();

    const outFile = path.join(workDir, 'evidence.md');
    const run = spawnSync(process.execPath, [GATE_SCRIPT, '--out', outFile], {
      cwd: cloneDir,
      encoding: 'utf8',
      env: childEnv(),
      maxBuffer: 512 * 1024 * 1024,
      timeout: Math.max(deadline - Date.now(), 1),
      windowsHide: true,
    });
    expectWithRunDetail(run, () =>
      expect(run.status === PRECONDITION_EXIT ? preconditionMessage() : null).toBeNull()
    );

    const block = parseEvidenceBlock(readOptional(outFile));
    expectWithRunDetail(run, () =>
      expect({ sha: block.sha, exitCodes: block.exitCodes }).toEqual({
        sha: release.sha,
        exitCodes: [0, 0, 0, 0, 0, 0],
      })
    );
  });
});
