/**
 * @jest-environment node
 */
/**
 * S5 release test for chain H (spec stabilize-and-cleanup, sections 2.3 and
 * 3.4 WI-22): AC-87, there are no critical or high advisories.
 *
 * It runs AC-87's command, `yarn npm audit --all --recursive --environment all
 * --severity high`, from the repo root and expects exit code 0. When the exit code
 * is not 0, it runs the same command again with `--json` so the failure lists every
 * advisory, with the tail of the first run's stderr. Run with `yarn verify:release`.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** AC-87's command. Every argument is a constant; nothing is interpolated. */
const AUDIT_ARGS = Object.freeze([
  'npm',
  'audit',
  '--all',
  '--recursive',
  '--environment',
  'all',
  '--severity',
  'high',
]);

/** Upper bound for one audit run. */
const AUDIT_TIMEOUT_MS = 600_000;

/** Room for the audit's output; the JSON report can be large. */
const AUDIT_MAX_BUFFER = 64 * 1024 * 1024;

/** Jest's own variables, kept out of the child's environment (WI-7). */
const JEST_VARIABLE_PREFIX = 'JEST_';

/** How many trailing lines of output a failure shows. */
const TAIL_LINES = 40;

/**
 * The child's environment: this process's environment minus every `JEST_*`
 * variable, with Corepack's download prompt turned off.
 *
 * @returns {NodeJS.ProcessEnv} The environment for the audit process.
 */
function auditEnvironment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith(JEST_VARIABLE_PREFIX))
  );
  return { ...env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
}

/**
 * Returns the last `TAIL_LINES` lines of `text`.
 *
 * @param {string | null | undefined} text Process output.
 * @returns {string} The trailing lines, or '' when there is no output.
 */
function tail(text) {
  const trimmed = (text ?? '').trimEnd();
  return trimmed ? trimmed.split(/\r?\n/).slice(-TAIL_LINES).join('\n') : '';
}

/**
 * Runs `yarn` with the audit arguments plus `extraArgs`. On Windows, Node spawns
 * the Yarn `.cmd` shim only through a shell; that is safe because every argument
 * is a constant.
 *
 * @param {readonly string[]} extraArgs Constant arguments appended to the command.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runAudit(extraArgs) {
  const run = spawnSync('yarn', [...AUDIT_ARGS, ...extraArgs], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: AUDIT_TIMEOUT_MS,
    maxBuffer: AUDIT_MAX_BUFFER,
    env: auditEnvironment(),
    shell: process.platform === 'win32',
  });
  if (run.error || run.signal !== null) {
    const command = ['yarn', ...AUDIT_ARGS, ...extraArgs].join(' ');
    const cause = run.error ? run.error.message : `killed by signal ${run.signal}`;
    throw new Error(
      `AC-87 harness error: "${command}" did not finish: ${cause}\n` +
        `stdout (last ${TAIL_LINES} lines):\n${tail(run.stdout) || '(empty)'}\n` +
        `stderr (last ${TAIL_LINES} lines):\n${tail(run.stderr) || '(empty)'}`
    );
  }
  return run;
}

/**
 * Formats one `--json` report line as "<ID> <package> <severity> <versions> via
 * <dependents>". A line that is not JSON is kept as it is, so nothing is lost.
 *
 * @param {string} line One line of `yarn npm audit --json` output.
 * @returns {string} The advisory, readable.
 */
function describeAdvisory(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return `unparsed: ${line}`;
  }
  const advisory = entry.children ?? {};
  const versions = [].concat(advisory['Tree Versions'] ?? []).join(', ');
  const dependents = [].concat(advisory.Dependents ?? []).join(', ');
  return `${advisory.ID} ${entry.value} ${advisory.Severity} ${versions} via ${dependents}`;
}

/**
 * Lists every advisory the audit reports, from a second run with `--json`.
 *
 * @returns {string[]} One readable line per advisory.
 */
function listAdvisories() {
  const run = runAudit(['--json']);
  return (run.stdout ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map(describeAdvisory);
}

describe('dependency audit', () => {
  it('AC-87: yarn npm audit reports no critical or high advisories', () => {
    // Arrange and act
    const run = runAudit([]);
    const exitCode = run.status;
    const failed = exitCode !== 0;

    // Assert
    expect({
      exitCode,
      advisories: failed ? listAdvisories() : [],
      stderrTail: failed ? tail(run.stderr) : '',
    }).toEqual({ exitCode: 0, advisories: [], stderrTail: '' });
  });
});
