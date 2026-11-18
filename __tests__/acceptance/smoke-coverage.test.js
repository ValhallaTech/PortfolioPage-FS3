/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for chain C (spec stabilize-and-cleanup, section 3.4 WI-7):
 * AC-89, the smoke suite covers every bootstrap6-analysis section 6 row.
 *
 * Runs `npx playwright test --list` from the repo root with playwright.config.js
 * and asserts that, for each of the 12 row names, at least one listed test title
 * contains it.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The listing command (chain C). A constant string, so the shell sees no input. */
const LIST_COMMAND = 'npx playwright test --list';

/** The 12 AC-89 row names, in the spec's order. */
const ROW_NAMES = [
  'Layout',
  'Mobile nav',
  'Grid',
  'Dialog open',
  'Dialog keyboard',
  'Dialog dismiss',
  'Submit, success',
  'Submit, error',
  'Abort on close',
  'Color scheme',
  'Console',
  'Portfolio filter',
];

/**
 * Playwright exits 1 on `--list` when no test exists, and prints this (WI-6).
 * The spec reads that as an empty list, which still fails on all 12 rows.
 */
const NO_TESTS_FOUND = 'No tests found';

/** Upper bound for the listing process; it loads the config and the specs only. */
const LIST_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = LIST_TIMEOUT_MS + 30_000;

/**
 * One list-reporter line: `  [project] › file:line:col › describe › title`.
 * Group 1 is everything after the location: the describe path and the title.
 */
const LISTED_TEST = /^\s*(?:\[[^\]]+\]\s+›\s+)?.+?:\d+:\d+\s+›\s+(.+?)\s*$/;
const TOTAL_LINE = /^Total: (\d+) tests? in \d+ files?\s*$/m;

/**
 * Formats a failed listing run as a harness error carrying the full output.
 *
 * @param {string} reason Why the run is not usable.
 * @param {string} output The combined stdout and stderr.
 * @returns {Error} The error to throw.
 */
function harnessError(reason, output) {
  return new Error(`Harness error: ${reason}\n--- playwright --list output ---\n${output}`);
}

/**
 * Extracts the listed titles from list-reporter output, and checks the count
 * against Playwright's own `Total:` line so a format change cannot pass as
 * "no titles".
 *
 * @param {string} output The combined stdout and stderr of a successful run.
 * @returns {string[]} Each test's describe path and title, joined by ` › `.
 */
function parseTitles(output) {
  const titles = output
    .split(/\r?\n/)
    .map((line) => LISTED_TEST.exec(line))
    .filter(Boolean)
    .map((match) => match[1]);
  const total = TOTAL_LINE.exec(output);
  if (!total) {
    throw harnessError('no "Total:" line in the listing', output);
  }
  if (Number(total[1]) !== titles.length) {
    throw harnessError(
      `Playwright reported ${total[1]} tests but ${titles.length} titles were parsed`,
      output
    );
  }
  return titles;
}

/**
 * Runs the listing and returns the listed titles, following WI-7's exit handling.
 *
 * @returns {string[]} The listed titles; empty when the suite has no tests.
 */
function listSmokeTitles() {
  const result = spawnSync(LIST_COMMAND, {
    cwd: REPO_ROOT,
    shell: true,
    encoding: 'utf8',
    timeout: LIST_TIMEOUT_MS,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.error) {
    throw harnessError(`could not run "${LIST_COMMAND}": ${result.error.message}`, output);
  }
  if (result.status === 0) {
    return parseTitles(output);
  }
  if (result.status === 1 && output.includes(NO_TESTS_FOUND)) {
    return [];
  }
  throw harnessError(
    `"${LIST_COMMAND}" exited with status ${result.status}, signal ${result.signal}`,
    output
  );
}

describe('AC-89: the smoke suite covers every bootstrap6-analysis section 6 row', () => {
  test(
    'at least one listed test title contains each of the 12 row names',
    () => {
      const titles = listSmokeTitles();

      const missingRows = ROW_NAMES.filter((row) => !titles.some((title) => title.includes(row)));

      // On failure, the diff names every row that no listed title contains.
      expect(missingRows).toEqual([]);
    },
    TEST_TIMEOUT_MS
  );
});
