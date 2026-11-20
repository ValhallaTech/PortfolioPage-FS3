/**
 * @jest-environment jsdom
 */
/**
 * S1 acceptance tests for chain J (spec stabilize-and-cleanup, sections 2.3,
 * 3.4 WI-27 and 3.7): AC-15, AC-16, AC-17, AC-18, AC-19, AC-26 and AC-30.
 * AC-25 (`@popperjs/core` remains) is retired by sprint 2 (spec
 * bootstrap-6-upgrade, section 2.3), because Bootstrap 6 drops Popper.
 *
 * The Conventions' tracked-file search runs in Node, because `rg` is absent from
 * the Linux gate container: the paths `git ls-files` lists (with the three
 * excluded paths), each read as UTF-8 and skipped when it holds a NUL byte, the
 * way `rg` skips binary files, then matched line by line. A file that cannot be
 * read is reported as a problem, as `rg` would report it with an error exit.
 *
 * The patterns of AC-15 to AC-18 are built from fragments, so this file does not
 * match its own search at the release commit.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

/** AC-15: the removed icon font's name. */
const ICON_FONT = ['icof', 'ont'].join('');

/** AC-16: the eight unreferenced images, and their names. */
const IMAGE_GLOBS = Object.freeze([
  ['src/images/portfolio-', 'details-*'].join(''),
  ['src/images/testimonials/testimonials', '-*'].join(''),
]);
const IMAGE_PATTERN = new RegExp(
  [['portfolio-', 'details-[0-9]'].join(''), ['testimonials', '-[0-9]'].join('')].join('|'),
  'i'
);

/** AC-17: the two unused packages. */
const PACKAGE_PATTERN = new RegExp(
  [['box', 'icons'].join(''), ['just', '-validate'].join(''), ['just', 'validate'].join('')].join(
    '|'
  ),
  'i'
);

/** AC-18: the dead skills code. */
const SKILLS_PATTERN = new RegExp(
  [
    ['observe', 'Skills'].join(''),
    ['skills', '-content'].join(''),
    ['progress', '-bar'].join(''),
  ].join('|'),
  'i'
);

/** AC-26: template credits and history comments, searched in `src` only. */
const TEMPLATE_PATTERN = new RegExp(
  [
    'Template Name',
    'BootstrapMade',
    'iPortfolio',
    'replaces (AOS|waypoints|venobox|owl)',
    'Overhauled',
  ].join('|'),
  'i'
);

/** AC-30: `require(` in `src/js`, matched case-sensitively as the AC's `rg` does. */
const REQUIRE_PATTERN = /require\(/;

/**
 * Runs `git` from the repo root with an argument array.
 *
 * @param {readonly string[]} args The arguments.
 * @returns {{ stdout: string, problem: string | null }} The output, or the problem.
 */
function git(args) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return {
      stdout: '',
      problem: `git ${args.join(' ')} failed (exit ${result.status}): ${reason}`,
    };
  }
  return { stdout: result.stdout ?? '', problem: null };
}

/**
 * Lists tracked files with `git ls-files -z`.
 *
 * @param {readonly string[]} pathspecs The pathspecs after `--`.
 * @returns {{ files: string[], problems: string[] }} The repo-relative paths, and any problem.
 */
function trackedFiles(pathspecs) {
  const { stdout, problem } = git(['ls-files', '-z', '--', ...pathspecs]);
  return {
    files: stdout.split(NUL).filter((file) => file !== ''),
    problems: problem ? [problem] : [],
  };
}

/**
 * Matches `pattern` against every line of every text file in `files`.
 *
 * @param {readonly string[]} files Repo-relative paths.
 * @param {RegExp} pattern A non-global pattern.
 * @returns {{ matches: string[], problems: string[] }} Each match as `file:line`, and
 *   each file that could not be read.
 */
function searchFiles(files, pattern) {
  const matches = [];
  const problems = [];
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    } catch (error) {
      problems.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (text.includes(NUL)) {
      continue;
    }
    text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(`${file}:${index + 1}`);
      }
    });
  }
  return { matches, problems };
}

/**
 * The Conventions' tracked-file search for `pattern`.
 *
 * @param {RegExp} pattern A non-global, case-insensitive pattern.
 * @returns {{ matches: string[], problems: string[] }} Each match as `file:line`, and
 *   any problem that stopped the search from covering every file.
 */
function trackedFileSearch(pattern) {
  const listing = trackedFiles(['.', ...SEARCH_EXCLUSIONS]);
  const search = searchFiles(listing.files, pattern);
  return { matches: search.matches, problems: [...listing.problems, ...search.problems] };
}

test('AC-15: the template icon font is gone', () => {
  // Arrange and act
  const tracked = trackedFiles([['src/css/', ICON_FONT, '*'].join('')]);
  const search = trackedFileSearch(new RegExp(ICON_FONT, 'i'));

  // Assert
  expect({
    trackedFiles: tracked.files,
    matches: search.matches,
    problems: [...tracked.problems, ...search.problems],
  }).toEqual({ trackedFiles: [], matches: [], problems: [] });
});

test('AC-16: the unreferenced images are gone', () => {
  // Arrange and act
  const tracked = trackedFiles(IMAGE_GLOBS);
  const search = trackedFileSearch(IMAGE_PATTERN);

  // Assert
  expect({
    trackedFiles: tracked.files,
    matches: search.matches,
    problems: [...tracked.problems, ...search.problems],
  }).toEqual({ trackedFiles: [], matches: [], problems: [] });
});

test('AC-17: the two unused front-end packages are gone', () => {
  // Arrange and act
  const search = trackedFileSearch(PACKAGE_PATTERN);

  // Assert
  expect(search).toEqual({ matches: [], problems: [] });
});

test('AC-18: the dead skills code and its tests are gone', () => {
  // Arrange and act
  const search = trackedFileSearch(SKILLS_PATTERN);

  // Assert
  expect(search).toEqual({ matches: [], problems: [] });
});

test('AC-19: there is exactly one mobile-nav toggle', () => {
  // Arrange
  const html = fs.readFileSync(path.join(REPO_ROOT, 'src', 'index.html'), 'utf8');
  const document = new DOMParser().parseFromString(html, 'text/html');

  // Act
  const toggles = Array.from(document.querySelectorAll('[class*="mobile-nav-toggle"]')).map(
    (element) => `<${element.tagName.toLowerCase()} class="${element.getAttribute('class')}">`
  );

  // Assert
  expect(toggles).toHaveLength(1);
});

test('AC-26: template and history comments are gone', () => {
  // Arrange
  const listing = trackedFiles(['src']);

  // Act
  const search = searchFiles(listing.files, TEMPLATE_PATTERN);

  // Assert
  expect({
    matches: search.matches,
    problems: [...listing.problems, ...search.problems],
  }).toEqual({ matches: [], problems: [] });
});

test('AC-30: main.js no longer uses require()', () => {
  // Arrange
  const listing = trackedFiles(['src/js']);

  // Act
  const search = searchFiles(listing.files, REQUIRE_PATTERN);

  // Assert
  expect({
    matches: search.matches,
    problems: [...listing.problems, ...search.problems],
  }).toEqual({ matches: [], problems: [] });
});
