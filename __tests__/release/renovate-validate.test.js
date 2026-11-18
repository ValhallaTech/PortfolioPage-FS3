/**
 * @jest-environment node
 */
/**
 * S5 release test for chain F (spec stabilize-and-cleanup, section 3.4 WI-18):
 * AC-5, `renovate.json` passes Renovate's validator.
 *
 * It runs `npx --yes --package renovate@<pin> -- renovate-config-validator --strict
 * renovate.json` in the repo root. It needs the npm registry. npx runs through
 * `node npx-cli.js`, so no `.cmd` shim or shell string is involved on Windows.
 * Run with `yarn verify:release`. It never skips: every failure is an `expect`
 * whose received value names the cause.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The exact Renovate version chain F runs (WI-18). Keep it equal in both S5 files. */
const RENOVATE_PIN = '44.252.5';

/** Upper bound for the npx install plus the validator run. */
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const TEST_TIMEOUT_MS = RUN_TIMEOUT_MS + 60_000;
const MAX_BUFFER = 64 * 1024 * 1024;

/** How much of the validator's output a failure message shows. */
const OUTPUT_TAIL_CHARS = 4000;

/** Jest's own variables never reach a child process (rule 6). */
const JEST_VARIABLE_PREFIX = 'JEST_';

/**
 * Finds npm's `npx-cli.js` next to the running Node: `node_modules/npm` beside
 * `node.exe` on Windows, `../lib/node_modules/npm` beside `bin/node` elsewhere.
 *
 * @returns {{ file: string|null, candidates: string[] }} The script, or null, and
 *   every path that was checked.
 */
function locateNpxCli() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ];
  return { file: candidates.find((candidate) => fs.existsSync(candidate)) ?? null, candidates };
}

/**
 * The child's environment: this process's environment minus every `JEST_*` variable.
 *
 * @returns {NodeJS.ProcessEnv} The environment.
 */
function childEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith(JEST_VARIABLE_PREFIX))
  );
}

/**
 * Runs the validator on the repo's `renovate.json`.
 *
 * @returns {string|null} Why the validator did not accept the file, or null when it
 *   exited 0.
 */
function validatorProblem() {
  const npx = locateNpxCli();
  if (!npx.file) {
    return `npx-cli.js not found next to ${process.execPath}; checked: ${npx.candidates.join(', ')}`;
  }

  const args = [
    npx.file,
    '--yes',
    '--package',
    `renovate@${RENOVATE_PIN}`,
    '--',
    'renovate-config-validator',
    '--strict',
    'renovate.json',
  ];
  const run = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    env: childEnvironment(),
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
  if (!run.error && run.status === 0) {
    return null;
  }

  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trimEnd();
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return (
    `npx renovate@${RENOVATE_PIN} renovate-config-validator --strict renovate.json: ` +
    `exit ${run.status}, signal ${run.signal}${spawnError}\n` +
    `Output (last ${OUTPUT_TAIL_CHARS} characters):\n${output.slice(-OUTPUT_TAIL_CHARS) || '(empty)'}`
  );
}

describe('Renovate config validation (chain F)', () => {
  test(
    'AC-5: renovate-config-validator --strict accepts renovate.json',
    () => {
      const problem = validatorProblem();

      expect(problem).toBeNull();
    },
    TEST_TIMEOUT_MS
  );
});
