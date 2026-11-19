/**
 * @jest-environment node
 */
/**
 * S5 release test for chain J (spec stabilize-and-cleanup, sections 2.3, 3.4
 * WI-27 and 3.7): AC-31, Jest passes with at least 80% coverage of `utils.js`.
 *
 * It runs AC-31's command, `yarn test:ci --coverageReporters=json-summary`, from
 * the repo root, and expects exit code 0 and each of the four metrics of the
 * `coverage/coverage-summary.json` entry whose key ends in `src/js/utils.js` to be
 * at least 80. Run with `yarn verify:release`. Every failure is one `expect`
 * whose message adds the child's exit code, the tests it reported failing, and
 * the four metrics.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** AC-31's command. Every argument is a constant; nothing is interpolated. */
const TEST_ARGS = Object.freeze(['test:ci', '--coverageReporters=json-summary']);

/** The summary the json-summary reporter writes. */
const SUMMARY_FILE = path.join(REPO_ROOT, 'coverage', 'coverage-summary.json');

/** The suffix of the summary key AC-31 reads, with `/` separators. */
const UTILS_KEY_SUFFIX = '/src/js/utils.js';

/** The four metrics AC-31 checks. */
const METRICS = Object.freeze(['lines', 'branches', 'functions', 'statements']);

/** AC-31's floor for each metric. */
const MINIMUM_PCT = 80;

/** Upper bound for the child Jest run; below the release suite's testTimeout. */
const RUN_TIMEOUT_MS = 30 * 60 * 1000;

/** Room for the child's output. */
const RUN_MAX_BUFFER = 256 * 1024 * 1024;

/** Jest's own variables, kept out of the child's environment. */
const JEST_VARIABLE_PREFIX = 'JEST_';

/** How many trailing lines of output a failure shows. */
const TAIL_LINES = 40;

/** A line Jest prints to name a failing test or suite. */
const FAILURE_LINE = /^\s*● (.+?)\s*$/;

/** Jest's console-output headings, which use the same bullet. */
const CONSOLE_HEADING = /^Console$/;

/**
 * The child's environment: this process's environment minus every `JEST_*`
 * variable, with Corepack's download prompt turned off.
 *
 * @returns {NodeJS.ProcessEnv} The environment for the child.
 */
function childEnvironment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith(JEST_VARIABLE_PREFIX))
  );
  return { ...env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
}

/**
 * Runs AC-31's command. On Windows, Node spawns the Yarn `.cmd` shim only through
 * a shell, so the command goes to the shell as one string with no args array
 * (DEP0190); that is safe because every token is a constant. Elsewhere the
 * arguments go as an array, with no shell.
 *
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runTestCi() {
  const options = {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnvironment(),
    maxBuffer: RUN_MAX_BUFFER,
    timeout: RUN_TIMEOUT_MS,
    windowsHide: true,
  };
  return process.platform === 'win32'
    ? spawnSync(['yarn', ...TEST_ARGS].join(' '), { ...options, shell: true })
    : spawnSync('yarn', TEST_ARGS, options);
}

/**
 * Returns the last `TAIL_LINES` lines of `text`.
 *
 * @param {string | null | undefined} text Process output.
 * @returns {string} The trailing lines, or '(empty)'.
 */
function tail(text) {
  const trimmed = (text ?? '').trimEnd();
  return trimmed ? trimmed.split(/\r?\n/).slice(-TAIL_LINES).join('\n') : '(empty)';
}

/**
 * Lists the tests and suites the child reported failing, once each.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string[]} The names Jest printed after its failure bullet.
 */
function failingTests(run) {
  const names = new Set();
  for (const line of `${run.stdout ?? ''}\n${run.stderr ?? ''}`.split(/\r?\n/)) {
    const match = FAILURE_LINE.exec(line);
    if (match && !CONSOLE_HEADING.test(match[1])) {
      names.add(match[1]);
    }
  }
  return Array.from(names);
}

/**
 * Reads the four metrics of the `utils.js` entry of the coverage summary.
 *
 * @returns {{ metrics: Record<string, number | null> | null, problem: string | null }}
 *   The metrics, or the problem that kept them from being read.
 */
function readUtilsMetrics() {
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { metrics: null, problem: `coverage summary not readable: ${reason}` };
  }
  const key = Object.keys(summary).find((name) =>
    name.replace(/\\/g, '/').endsWith(UTILS_KEY_SUFFIX)
  );
  if (key === undefined) {
    return { metrics: null, problem: `no summary key ends in ${UTILS_KEY_SUFFIX.slice(1)}` };
  }
  const metrics = Object.fromEntries(
    METRICS.map((metric) => {
      const pct = summary[key]?.[metric]?.pct;
      return [metric, typeof pct === 'number' ? pct : null];
    })
  );
  return { metrics, problem: null };
}

/**
 * Lists every way the metrics fall short of AC-31.
 *
 * @param {{ metrics: Record<string, number | null> | null, problem: string | null }} read
 *   The result of reading the summary.
 * @returns {string[]} The problem, or each metric below the floor.
 */
function coverageProblems(read) {
  if (read.problem) {
    return [read.problem];
  }
  return METRICS.filter((metric) => !(read.metrics[metric] >= MINIMUM_PCT)).map(
    (metric) => `${metric}.pct ${read.metrics[metric]} is below ${MINIMUM_PCT}`
  );
}

/**
 * Runs `assertion` and, when it fails, adds the child's exit code, failing tests,
 * metrics and output tails to the failure message.
 *
 * @param {string} detail The text to append.
 * @param {() => void} assertion The `expect` call to run.
 */
function expectWithDetail(detail, assertion) {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) {
      const original = error.message;
      error.message = `${original}\n\n${detail}`;
      // V8 formats `stack` lazily, so it may already carry the new message.
      if (typeof error.stack === 'string' && !error.stack.includes(detail)) {
        error.stack = error.stack.replace(original, () => error.message);
      }
    }
    throw error;
  }
}

test('AC-31: Jest passes with at least 80% coverage of utils.js', () => {
  // Arrange: a summary left by an earlier run must not stand in for this one.
  fs.rmSync(SUMMARY_FILE, { force: true });

  // Act
  const run = runTestCi();
  const read = readUtilsMetrics();

  // Assert
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  const detail =
    `Child: yarn ${TEST_ARGS.join(' ')}, exit code ${run.status}, signal ${run.signal}${spawnError}\n` +
    `Failing tests reported by the child:\n${failingTests(run).join('\n') || '(none)'}\n` +
    `utils.js metrics: ${JSON.stringify(read.metrics)}${read.problem ? ` (${read.problem})` : ''}\n` +
    `Child stdout (last ${TAIL_LINES} lines):\n${tail(run.stdout)}\n` +
    `Child stderr (last ${TAIL_LINES} lines):\n${tail(run.stderr)}`;
  expectWithDetail(detail, () =>
    expect({ exitCode: run.status, coverageProblems: coverageProblems(read) }).toEqual({
      exitCode: 0,
      coverageProblems: [],
    })
  );
});
