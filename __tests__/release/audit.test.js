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
 * Formats the stdout and stderr tails of one run under `label`.
 *
 * @param {string} label A prefix naming the run, or '' for none.
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The labeled tails.
 */
function outputTails(label, run) {
  return (
    `${label}stdout (last ${TAIL_LINES} lines):\n${tail(run.stdout) || '(empty)'}\n` +
    `${label}stderr (last ${TAIL_LINES} lines):\n${tail(run.stderr) || '(empty)'}`
  );
}

/**
 * Runs `yarn` with the audit arguments plus `extraArgs`. On Windows, Node spawns
 * the Yarn `.cmd` shim only through a shell, so the command goes to the shell as
 * one string with no args array (DEP0190); that is safe because every token is a
 * constant. Elsewhere the arguments go as an array, with no shell.
 *
 * @param {readonly string[]} extraArgs Constant arguments appended to the command.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runAudit(extraArgs) {
  const args = [...AUDIT_ARGS, ...extraArgs];
  const command = ['yarn', ...args].join(' ');
  const options = {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: AUDIT_TIMEOUT_MS,
    maxBuffer: AUDIT_MAX_BUFFER,
    env: auditEnvironment(),
  };
  const run =
    process.platform === 'win32'
      ? spawnSync(command, { ...options, shell: true })
      : spawnSync('yarn', args, options);
  if (run.error || run.signal !== null) {
    const cause = run.error ? run.error.message : `killed by signal ${run.signal}`;
    throw new Error(
      `AC-87 harness error: "${command}" did not finish: ${cause}\n${outputTails('', run)}`
    );
  }
  return run;
}

/**
 * Reads one `--json` report line. A line is an advisory only when it parses as
 * JSON with a `children.ID`; it is then formatted as "<ID> <package> <severity>
 * <versions> via <dependents>". Any other line is kept, marked, so nothing is lost.
 *
 * @param {string} line One line of `yarn npm audit --json` output.
 * @returns {{ isAdvisory: boolean, text: string }} Whether the line is an advisory,
 *   and the line, readable.
 */
function describeAdvisory(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return { isAdvisory: false, text: `unparsed: ${line}` };
  }
  const advisory = entry?.children;
  if (advisory === null || typeof advisory !== 'object' || advisory.ID === undefined) {
    return { isAdvisory: false, text: `not an advisory: ${line}` };
  }
  const versions = [].concat(advisory['Tree Versions'] ?? []).join(', ');
  const dependents = [].concat(advisory.Dependents ?? []).join(', ');
  return {
    isAdvisory: true,
    text: `${advisory.ID} ${entry.value} ${advisory.Severity} ${versions} via ${dependents}`,
  };
}

/**
 * Lists every advisory the audit reports, from a second run with `--json`. A
 * non-zero exit that reports no advisory is a broken run, for example an
 * unreachable registry, not an AC-87 failure, so it throws a harness error.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} firstRun The run
 *   without `--json`, which exited non-zero.
 * @returns {string[]} One readable line per report line, at least one an advisory.
 */
function listAdvisories(firstRun) {
  const jsonRun = runAudit(['--json']);
  const lines = (jsonRun.stdout ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map(describeAdvisory);
  if (!lines.some((line) => line.isAdvisory)) {
    throw new Error(
      `AC-87 harness error: audit exited ${firstRun.status} without reporting an advisory\n` +
        `${outputTails('audit: ', firstRun)}\n${outputTails('audit --json: ', jsonRun)}`
    );
  }
  return lines.map((line) => line.text);
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
      advisories: failed ? listAdvisories(run) : [],
      stderrTail: failed ? tail(run.stderr) : '',
    }).toEqual({ exitCode: 0, advisories: [], stderrTail: '' });
  });
});
