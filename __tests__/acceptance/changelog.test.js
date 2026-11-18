/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for chain I (spec stabilize-and-cleanup, sections 2.3 and 3.4 WI-24):
 * AC-103, the CHANGELOG has a dated entry for every release.
 *
 * The releases are every tag from `git tag --list` that matches `^\d+\.\d+\.\d+$`, plus
 * the `package.json` version, so the test passes at the release commit before its tag
 * exists. Each needs a CHANGELOG.md line `## [T] - YYYY-MM-DD`. A missing CHANGELOG.md
 * counts as empty.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CHANGELOG = path.join(REPO_ROOT, 'CHANGELOG.md');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');

/** A release tag: three dot-separated numbers and nothing else. */
const RELEASE_TAG = /^\d+\.\d+\.\d+$/;

/** Upper bound for one `git` call. */
const GIT_TIMEOUT_MS = 60_000;

/**
 * Escapes every regex metacharacter in `text`.
 *
 * @param {string} text Literal text.
 * @returns {string} The text, safe inside a RegExp source.
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Orders versions by their numeric parts, then as text.
 *
 * @param {string} a A version.
 * @param {string} b Another version.
 * @returns {number} The sort order.
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0 && !Number.isNaN(diff)) {
      return diff;
    }
  }
  return a.localeCompare(b);
}

/**
 * Lists the release tags. Never throws: a failure is returned as a problem.
 *
 * @returns {{ tags: string[], problem: string | null }} The tags, or the problem.
 */
function listReleaseTags() {
  const result = spawnSync('git', ['tag', '--list'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return { tags: [], problem: `git tag --list failed (exit ${result.status}): ${reason}` };
  }
  const tags = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((tag) => RELEASE_TAG.test(tag));
  return { tags, problem: null };
}

/**
 * Reads the `package.json` version. Never throws.
 *
 * @returns {{ version: string | null, problem: string | null }} The version, or the problem.
 */
function readPackageVersion() {
  try {
    const { version } = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    return typeof version === 'string' && version !== ''
      ? { version, problem: null }
      : { version: null, problem: 'package.json has no version' };
  } catch (error) {
    return { version: null, problem: `package.json could not be read: ${error.message}` };
  }
}

/**
 * Reads CHANGELOG.md as lines; a missing file is empty.
 *
 * @returns {string[]} Its lines.
 */
function readChangelogLines() {
  return fs.existsSync(CHANGELOG) ? fs.readFileSync(CHANGELOG, 'utf8').split(/\r?\n/) : [];
}

test('AC-103 the CHANGELOG has a dated heading for every release tag and the package.json version', () => {
  // Arrange
  const tagList = listReleaseTags();
  const pkg = readPackageVersion();
  const sourceProblems = [tagList.problem, pkg.problem].filter((problem) => problem !== null);
  expect(sourceProblems.length === 0 ? null : `AC-103: ${sourceProblems.join('; ')}`).toBeNull();
  expect(
    tagList.tags.length > 0
      ? null
      : 'AC-103: git tag --list found no tag matching ^\\d+\\.\\d+\\.\\d+$'
  ).toBeNull();

  const releases = [...new Set([...tagList.tags, pkg.version])].sort(compareVersions);
  const lines = readChangelogLines();

  // Act
  const missing = releases.filter((release) => {
    const heading = new RegExp(`^## \\[${escapeRegExp(release)}\\] - \\d{4}-\\d{2}-\\d{2}$`);
    return !lines.some((line) => heading.test(line));
  });

  // Assert
  expect(
    missing.length === 0
      ? null
      : `AC-103: CHANGELOG.md has no "## [T] - YYYY-MM-DD" heading for: ${missing.join(', ')}`
  ).toBeNull();
});
