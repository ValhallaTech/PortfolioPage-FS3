/**
 * Local gate runner (spec stabilize-and-cleanup, D-10 and WI-4).
 *
 *   node scripts/gate.mjs [--env <label>]
 *                         [--fresh-clone <url> --ref <sha> [--autocrlf]]
 *                         [--commands-file <json>]
 *                         [--out <file>]
 *
 * Runs the six gate commands in order, with inherited stdio, and stops at the
 * first non-zero exit; the remaining steps are recorded as "not run". Stdout
 * ends with the v1 evidence block, after any output of the steps, and
 * `--out <file>` receives the block alone.
 *
 * Exit codes:
 * - the first non-zero step exit code, or 0 when all six steps exit 0;
 * - 64: usage error, including a malformed `--commands-file` (no block);
 * - 65: the working tree the steps would run in has uncommitted changes, so
 *   no block could name a commit (the D-10 clean-tree rule; no block). Runs
 *   with `--commands-file` are exempt;
 * - 69: Yarn through Corepack is unavailable or not the `packageManager`
 *   version (the D-10 preflight; no block);
 * - 1: the runner itself failed, for example the fresh clone or
 *   `git status` (no block).
 *
 * Checks run in the D-10 order: usage, the clone if any, the clean tree, the
 * preflight, then the steps.
 *
 * The six step commands run with `shell: true`, as the spec chooses. They are
 * either the canonical constants or, in tests only, the strings of the
 * commands file; no other command-line value ever reaches a shell.
 */
import { exec, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { constants as osConstants } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { EXIT_USAGE, UsageError, loadCommandsFile, parseGateArgs } from './gate/cli.mjs';
import { CANONICAL_COMMANDS, NOT_RUN, formatEvidenceBlock } from './gate/evidence.mjs';
import {
  createFreshClone,
  readHeadSha,
  readWorkingTreeStatus,
  removeFreshClone,
} from './gate/workspace.mjs';

const execAsync = promisify(exec);

/** Exit code of a dirty working tree, the D-10 clean-tree rule (sysexits EX_DATAERR). */
const EXIT_DIRTY_TREE = 65;

/** The D-10 clean-tree refusal, printed on stderr. */
const DIRTY_TREE_MESSAGE =
  'Gate refused: the working tree has uncommitted changes, so no evidence can name a commit.';

/** Exit code of an unmet D-10 Windows host precondition (sysexits EX_UNAVAILABLE). */
const EXIT_PRECONDITION = 69;

/** Exit code when the runner itself fails, or a step cannot be started. */
const EXIT_FAILURE = 1;

/** Shell convention for a process ended by a signal: 128 + the signal number. */
const SIGNAL_EXIT_BASE = 128;

/** Upper bound for the `yarn --version` preflight. */
const PREFLIGHT_TIMEOUT_MS = 60_000;

/** Fixed preflight command line; run through the shell to resolve Corepack's shims. */
const YARN_VERSION_COMMAND = 'yarn --version';

/** Variable that stops Corepack from waiting on a download prompt. */
const COREPACK_PROMPT_VARIABLE = 'COREPACK_ENABLE_DOWNLOAD_PROMPT';
const JEST_VARIABLE_PREFIX = 'JEST_';

/** `packageManager` value naming Yarn, with an optional `+<hash>` suffix. */
const YARN_PACKAGE_MANAGER_PATTERN = /^yarn@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\+\S+)?$/;

/** Printed in place of a commit SHA that could not be read. */
const UNAVAILABLE = 'unavailable';

/**
 * Builds the D-10 Windows host precondition message.
 *
 * @param {string} yarnVersion The `packageManager` Yarn version.
 * @returns {string} The message, without a trailing newline.
 */
function preconditionMessage(yarnVersion) {
  return (
    `Gate precondition: Yarn ${yarnVersion} through Corepack is not available. ` +
    'Run npm install -g corepack@0.36.0, then corepack enable.'
  );
}

/**
 * Returns the default Environment label for a host run.
 *
 * @returns {string} For example `windows host`.
 */
function defaultEnvironmentLabel() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  return `${platform} host`;
}

/**
 * Builds the environment for the preflight and the steps: this process's
 * environment minus every `JEST_*` variable, with the Corepack download prompt
 * turned off unless the variable is already set.
 *
 * The `JEST_*` variables are dropped because a Jest test can start this
 * runner, and Playwright refuses to load its tests when it inherits
 * `JEST_WORKER_ID` (spec §3.4 WI-4, "Step environment").
 *
 * @returns {NodeJS.ProcessEnv} The step environment.
 */
function buildStepEnv() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith(JEST_VARIABLE_PREFIX))
  );
  return env[COREPACK_PROMPT_VARIABLE] === undefined
    ? { ...env, [COREPACK_PROMPT_VARIABLE]: '0' }
    : env;
}

/**
 * Reads the Yarn version that `packageManager` names in `dir/package.json`.
 *
 * @param {string} dir Directory the steps run in.
 * @returns {Promise<string>} The version, without any `+<hash>` suffix.
 * @throws {Error} When package.json is unreadable or names no Yarn version.
 */
async function readExpectedYarnVersion(dir) {
  const manifestPath = path.join(dir, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, { encoding: 'utf8' }));
  const match = YARN_PACKAGE_MANAGER_PATTERN.exec(String(manifest?.packageManager ?? ''));
  if (match === null) {
    throw new Error(`${manifestPath} names no yarn@<version> packageManager`);
  }
  return match[1];
}

/**
 * Runs `yarn --version` in `dir`.
 *
 * @param {string} dir Directory the steps run in.
 * @param {NodeJS.ProcessEnv} env Step environment.
 * @returns {Promise<string | null>} The trimmed version, or null when Yarn failed.
 */
async function probeYarnVersion(dir, env) {
  try {
    const { stdout } = await execAsync(YARN_VERSION_COMMAND, {
      cwd: dir,
      env,
      timeout: PREFLIGHT_TIMEOUT_MS,
      windowsHide: true,
    });
    return String(stdout).trim();
  } catch {
    return null;
  }
}

/**
 * Converts a finished child's code and signal into one exit code.
 *
 * @param {number | null} code Exit code, null when a signal ended the child.
 * @param {NodeJS.Signals | null} signal The ending signal, if any.
 * @returns {number} The exit code; never 0 for a signal.
 */
function toExitCode(code, signal) {
  if (code !== null) {
    return code;
  }
  const signalNumber = signal === null ? undefined : osConstants.signals[signal];
  return signalNumber === undefined ? EXIT_FAILURE : SIGNAL_EXIT_BASE + signalNumber;
}

/**
 * Runs one step command through the shell with inherited stdio.
 *
 * @param {string} command Shell command line.
 * @param {string} cwd Directory the steps run in.
 * @param {NodeJS.ProcessEnv} env Step environment.
 * @returns {Promise<number>} The step's exit code; never rejects.
 */
function runStep(command, cwd, env) {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, env, shell: true, stdio: 'inherit', windowsHide: true });
    child.once('error', (error) => {
      process.stderr.write(`gate: could not start "${command}": ${error.message}\n`);
      resolve(EXIT_FAILURE);
    });
    child.once('close', (code, signal) => resolve(toExitCode(code, signal)));
  });
}

/**
 * Runs the steps in order and stops at the first non-zero exit.
 *
 * @param {readonly string[]} commands The six shell commands.
 * @param {string} cwd Directory the steps run in.
 * @param {NodeJS.ProcessEnv} env Step environment.
 * @returns {Promise<Array<number | typeof NOT_RUN>>} One cell per step.
 */
async function runSteps(commands, cwd, env) {
  const exitCodes = [];
  for (const command of commands) {
    const failed = exitCodes.some((code) => code !== 0);
    exitCodes.push(failed ? NOT_RUN : await runStep(command, cwd, env));
  }
  return exitCodes;
}

/**
 * Applies the D-10 clean-tree rule to `dir`, once, before step 1. Changes the
 * steps make afterwards are deliberately not checked.
 *
 * @param {string} dir Directory the steps run in.
 * @returns {Promise<number | null>} An exit code when the run is refused, or
 *   null when the tree is clean.
 */
async function refuseDirtyTree(dir) {
  const status = await readWorkingTreeStatus(dir);
  if (status === null) {
    process.stderr.write(`gate: could not run git status in ${dir}\n`);
    return EXIT_FAILURE;
  }
  if (status !== '') {
    process.stderr.write(`${DIRTY_TREE_MESSAGE}\n`);
    return EXIT_DIRTY_TREE;
  }
  return null;
}

/**
 * Runs the clean-tree check (unless `--commands-file` is given), the preflight
 * and the six steps in `dir`, then prints the block and writes it to `--out`
 * when given.
 *
 * @param {string} dir Directory the steps run in.
 * @param {readonly string[]} commands The six shell commands.
 * @param {import('./gate/cli.mjs').GateOptions} options Validated options.
 * @returns {Promise<number>} The process exit code.
 */
async function runGate(dir, commands, options) {
  if (options.commandsFile === undefined) {
    const refusal = await refuseDirtyTree(dir);
    if (refusal !== null) {
      return refusal;
    }
  }

  const env = buildStepEnv();
  const expectedYarnVersion = await readExpectedYarnVersion(dir);
  const yarnVersion = await probeYarnVersion(dir, env);
  if (yarnVersion !== expectedYarnVersion) {
    process.stderr.write(`${preconditionMessage(expectedYarnVersion)}\n`);
    return EXIT_PRECONDITION;
  }

  const sha = (await readHeadSha(dir)) ?? UNAVAILABLE;
  const exitCodes = await runSteps(commands, dir, env);
  const firstFailure = exitCodes.find((code) => code !== 0 && code !== NOT_RUN) ?? 0;

  const block = formatEvidenceBlock({
    sha,
    environment: options.env ?? defaultEnvironmentLabel(),
    nodeVersion: process.version,
    yarnVersion,
    exitCodes,
  });
  // The leading newline starts the block on its own line after any step output.
  process.stdout.write(`\n${block}`);

  if (options.out !== undefined) {
    try {
      await writeFile(options.out, block, { encoding: 'utf8' });
    } catch (error) {
      process.stderr.write(`gate: could not write --out ${options.out}: ${error.message}\n`);
      return firstFailure === 0 ? EXIT_FAILURE : firstFailure;
    }
  }
  return firstFailure;
}

/**
 * Entry point: validates the command line, makes the fresh clone when asked,
 * runs the gate there or in the current directory, and removes the clone.
 *
 * @param {string[]} argv Arguments after the script path.
 * @returns {Promise<number>} The process exit code.
 */
async function main(argv) {
  let options;
  let commands = CANONICAL_COMMANDS;
  try {
    options = parseGateArgs(argv, process.cwd());
    if (options.commandsFile !== undefined) {
      commands = await loadCommandsFile(options.commandsFile);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`gate: ${error.message}\n`);
      return EXIT_USAGE;
    }
    throw error;
  }

  if (options.freshClone === undefined) {
    return runGate(process.cwd(), commands, options);
  }
  const clone = await createFreshClone(options.freshClone);
  try {
    return await runGate(clone.dir, commands, options);
  } finally {
    await removeFreshClone(clone.dir);
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`gate: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = EXIT_FAILURE;
}
