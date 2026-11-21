/**
 * @jest-environment node
 */
/**
 * S5 release test for chain I (spec stabilize-and-cleanup, sections 2.3 and 3.4 WI-24):
 * AC-104, the CHANGELOG dates match the releases.
 *
 * The releases are AC-103's set: every tag from `git tag --merged HEAD` (the tags
 * HEAD can reach) that matches `^\d+\.\d+\.\d+$`, plus the `package.json` version.
 * For each release T, every
 * `## [T] - YYYY-MM-DD` heading in CHANGELOG.md must carry the UTC date of
 * `gh release view T --json publishedAt`, or, when T has no GitHub release, the UTC date
 * of its tag commit (`git log -1 --format=%cI`). A release with no heading is a failure,
 * so the test can never pass on a missing or empty CHANGELOG.md.
 *
 * Needs `gh`, authenticated, and network access. Run with `yarn verify:release`.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CHANGELOG = path.join(REPO_ROOT, 'CHANGELOG.md');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');

/** A release tag: three dot-separated numbers and nothing else. */
const RELEASE_TAG = /^\d+\.\d+\.\d+$/;

/** What `gh release view` prints on stderr when the tag has no GitHub release. */
const RELEASE_NOT_FOUND = /release not found/i;

/** Upper bound for one `git` or `gh` call. */
const RUN_TIMEOUT_MS = 120_000;

/**
 * Runs a command from the repo root with an argument array, never a shell string.
 *
 * @param {string} command Executable to run.
 * @param {string[]} args Its arguments.
 * @returns {{ ok: boolean, stdout: string, reason: string }} Whether it exited 0, its
 *   stdout, and the error or stderr when it did not.
 */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return { ok: false, stdout: result.stdout ?? '', reason: `exit ${result.status}: ${reason}` };
  }
  return { ok: true, stdout: result.stdout, reason: '' };
}

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
 * Builds AC-103's release set. Never throws.
 *
 * @returns {{ releases: string[], problems: string[] }} The sorted releases, and any
 *   problem reading them.
 */
function listReleases() {
  const problems = [];
  const tagList = run('git', ['tag', '--merged', 'HEAD']);
  const tags = tagList.ok
    ? tagList.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((tag) => RELEASE_TAG.test(tag))
    : [];
  if (!tagList.ok) {
    problems.push(`git tag --merged HEAD failed (${tagList.reason})`);
  } else if (tags.length === 0) {
    problems.push('git tag --merged HEAD found no tag matching ^\\d+\\.\\d+\\.\\d+$');
  }

  let version = null;
  try {
    const parsed = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    if (typeof parsed.version === 'string' && parsed.version !== '') {
      version = parsed.version;
    } else {
      problems.push('package.json has no version');
    }
  } catch (error) {
    problems.push(`package.json could not be read: ${error.message}`);
  }

  const releases = [...new Set([...tags, ...(version ? [version] : [])])].sort(compareVersions);
  return { releases, problems };
}

/**
 * Converts an ISO 8601 timestamp to its UTC `YYYY-MM-DD`.
 *
 * @param {string} timestamp An ISO 8601 timestamp with a zone.
 * @returns {string | null} The UTC date, or null when the timestamp is invalid.
 */
function utcDate(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * Finds the source date for release T: its GitHub release, else its tag commit.
 *
 * @param {string} release The release T.
 * @returns {{ date: string | null, problem: string | null }} The UTC date, or the problem.
 */
function sourceDate(release) {
  const view = run('gh', ['release', 'view', release, '--json', 'publishedAt']);
  if (view.ok) {
    let publishedAt;
    try {
      ({ publishedAt } = JSON.parse(view.stdout));
    } catch (error) {
      return { date: null, problem: `gh release view printed invalid JSON: ${error.message}` };
    }
    const date = typeof publishedAt === 'string' ? utcDate(publishedAt) : null;
    return date
      ? { date, problem: null }
      : { date: null, problem: `GitHub release has no valid publishedAt (${publishedAt})` };
  }
  if (!RELEASE_NOT_FOUND.test(view.reason)) {
    return { date: null, problem: `gh release view failed (${view.reason})` };
  }

  const log = run('git', ['log', '-1', '--format=%cI', `refs/tags/${release}`, '--']);
  const date = log.ok ? utcDate(log.stdout.trim()) : null;
  return date
    ? { date, problem: null }
    : { date: null, problem: 'has neither a GitHub release nor a tag' };
}

/**
 * Reads CHANGELOG.md as lines; a missing file is empty.
 *
 * @returns {string[]} Its lines.
 */
function readChangelogLines() {
  return fs.existsSync(CHANGELOG) ? fs.readFileSync(CHANGELOG, 'utf8').split(/\r?\n/) : [];
}

/**
 * Checks release T's CHANGELOG headings against its source date.
 *
 * @param {string} release The release T.
 * @param {string[]} lines The CHANGELOG.md lines.
 * @returns {string | null} The problem, or null when every heading date matches.
 */
function findDateProblem(release, lines) {
  const heading = new RegExp(`^## \\[${escapeRegExp(release)}\\] - (\\d{4}-\\d{2}-\\d{2})$`);
  const headingDates = lines
    .map((line) => heading.exec(line))
    .filter((match) => match !== null)
    .map((match) => match[1]);
  const source = sourceDate(release);

  const issues = [];
  if (headingDates.length === 0) {
    issues.push('no "## [T] - YYYY-MM-DD" heading');
  }
  if (source.problem) {
    issues.push(source.problem);
  } else {
    headingDates
      .filter((date) => date !== source.date)
      .forEach((date) => issues.push(`heading date ${date} is not ${source.date}`));
  }
  return issues.length === 0 ? null : `${release}: ${issues.join('; ')}`;
}

test('AC-104 every CHANGELOG release heading carries the UTC date of its GitHub release or tag commit', () => {
  // Arrange
  const { releases, problems: releaseProblems } = listReleases();
  expect(releaseProblems.length === 0 ? null : `AC-104: ${releaseProblems.join('; ')}`).toBeNull();
  const lines = readChangelogLines();

  // Act
  const problems = releases
    .map((release) => findDateProblem(release, lines))
    .filter((problem) => problem !== null);

  // Assert
  expect(
    problems.length === 0
      ? null
      : `AC-104: CHANGELOG.md dates do not match the releases:\n${problems.join('\n')}`
  ).toBeNull();
});
