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

/**
 * The only parent variables the child inherits, each copied only when set: what Node,
 * npm and npx need to run (SEC-DEPLOY-1). Nothing else reaches the child, so neither a
 * credential nor a `JEST_*` variable (rule 6) does. Windows matches them ignoring case.
 */
const INHERITED_VARIABLES = [
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'ComSpec',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
];

/** npx runs no lifecycle script of the tree it installs (SEC-SCRIPT-1). */
const NO_INSTALL_SCRIPTS = { npm_config_ignore_scripts: 'true' };

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
 * The child's environment: the allowlisted variables of this process's environment
 * that are set, plus `npm_config_ignore_scripts=true`.
 *
 * @returns {NodeJS.ProcessEnv} The environment.
 */
function childEnvironment() {
  const fold = (name) => (process.platform === 'win32' ? name.toUpperCase() : name);
  const allowed = new Set(INHERITED_VARIABLES.map(fold));
  const inherited = Object.entries(process.env).filter(
    ([name, value]) => value !== undefined && allowed.has(fold(name))
  );
  return { ...Object.fromEntries(inherited), ...NO_INSTALL_SCRIPTS };
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
