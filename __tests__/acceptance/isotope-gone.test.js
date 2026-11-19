/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for chain K (spec stabilize-and-cleanup, sections 2.3,
 * 3.4 WI-36 and 3.7): AC-118.
 *
 * The Conventions' tracked-file search runs in Node, because `rg` is absent from
 * the Linux gate container: the paths `git ls-files` lists (with the three
 * excluded paths), each read as UTF-8 and skipped when it holds a NUL byte, the
 * way `rg` skips binary files, then matched line by line, ignoring case.
 *
 * The searched name is built from fragments, so this file does not match its
 * own search, which covers every tracked file.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The removed layout library's name, built from fragments. */
const LIBRARY_NAME = ['Iso', 'tope'].join('');

/** AC-118's search pattern: the name in any letter case. */
const LIBRARY_PATTERN = new RegExp(LIBRARY_NAME, 'i');

/** The Conventions' exclusions: this spec, the source report and the changelog. */
const SEARCH_EXCLUSIONS = Object.freeze([
  ':!specs/',
  ':!update-report-2026-11-16/',
  ':!CHANGELOG.md',
]);

/** Upper bound for one `git ls-files` run. */
const GIT_TIMEOUT_MS = 60_000;

/** Room for `git ls-files` output. */
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

/** The NUL byte that marks a file as binary, as `rg` decides it. */
const NUL = String.fromCharCode(0);

/** Child processes never inherit Jest's own variables. */
const JEST_VARIABLE_PREFIX = 'JEST_';

/**
 * The child's environment: this process's environment minus every `JEST_*`
 * variable.
 *
 * @returns {NodeJS.ProcessEnv} The filtered environment.
 */
function childEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith(JEST_VARIABLE_PREFIX))
  );
}

/**
 * Lists the tracked files the Conventions' search covers.
 *
 * @returns {string[]} Repo-relative paths.
 */
function searchedFiles() {
  const stdout = execFileSync('git', ['ls-files', '-z', '--', '.', ...SEARCH_EXCLUSIONS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnvironment(),
    maxBuffer: GIT_MAX_BUFFER,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  return stdout.split(NUL).filter((file) => file !== '');
}

/**
 * Matches `pattern` against every line of every text file in `files`.
 *
 * @param {readonly string[]} files Repo-relative paths.
 * @param {RegExp} pattern A non-global pattern.
 * @returns {string[]} Each match as `<path>:<line>: <text>`.
 */
function searchFiles(files, pattern) {
  const matches = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    if (text.includes(NUL)) {
      continue;
    }
    text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(`${file}:${index + 1}: ${line.replace(/\r$/, '')}`);
      }
    });
  }
  return matches;
}

test(`AC-118: ${LIBRARY_NAME} is gone`, () => {
  // Arrange
  const files = searchedFiles();

  // Act
  const matches = searchFiles(files, LIBRARY_PATTERN);

  // Assert
  expect(files).toContain('package.json');
  expect(matches).toEqual([]);
});
