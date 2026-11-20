/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-102 (spec stabilize-and-cleanup, sections 2.3 and 3.4 WI-62):
 * tag `4.0.0` exists on `origin` and its `package.json` reads version 4.0.0.
 *
 * `git ls-remote --tags origin refs/tags/4.0.0` must print exactly one line. Only then
 * is `package.json` read at the tag with `git show refs/tags/4.0.0:package.json`; when
 * the tag is not yet in the local clone, it is fetched first with
 * `git fetch --no-tags origin refs/tags/4.0.0:refs/tags/4.0.0`. That fetch only adds
 * the local tag ref; nothing is pushed or changed on `origin`.
 *
 * Needs `git` and network access to `origin`. Run with `yarn verify:release`. It never
 * skips: every failure is an `expect` that shows its message.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The release tag and version (C-12). */
const RELEASE = '4.0.0';
const TAG_REF = `refs/tags/${RELEASE}`;

/** Upper bound for one `git` call. */
const GIT_TIMEOUT_MS = 120_000;

/**
 * The process environment minus every `JEST_*` variable, for child processes.
 *
 * @returns {NodeJS.ProcessEnv} The filtered environment.
 */
function childEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('JEST_'))
  );
}

/**
 * Runs `git` from the repo root with an argument array. Never throws.
 *
 * @param {string[]} args The arguments.
 * @returns {{ ok: boolean, stdout: string, reason: string }} Whether it exited 0, its
 *   stdout, and the failure when it did not.
 */
function git(args) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(),
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return {
      ok: false,
      stdout: result.stdout ?? '',
      reason: `git ${args.join(' ')} failed (exit ${result.status}): ${reason}`,
    };
  }
  return { ok: true, stdout: result.stdout, reason: '' };
}

/**
 * Reads the `package.json` version at the tag, fetching the tag ref first when the
 * local clone lacks it.
 *
 * @returns {string} The version, or a line naming the problem.
 */
function versionAtTag() {
  const local = git(['rev-parse', '--verify', '--quiet', `${TAG_REF}^{commit}`]);
  if (!local.ok) {
    const fetched = git(['fetch', '--no-tags', 'origin', `${TAG_REF}:${TAG_REF}`]);
    if (!fetched.ok) {
      return `PROBLEM: ${fetched.reason}`;
    }
  }
  const shown = git(['show', `${TAG_REF}:package.json`]);
  if (!shown.ok) {
    return `PROBLEM: ${shown.reason}`;
  }
  try {
    const { version } = JSON.parse(shown.stdout);
    return typeof version === 'string' ? version : 'PROBLEM: package.json has no version';
  } catch (error) {
    return `PROBLEM: package.json at ${TAG_REF} is not valid JSON: ${error.message}`;
  }
}

describe(`AC-102: tag ${RELEASE} exists and carries version ${RELEASE}`, () => {
  it(`AC-102: origin has tag ${RELEASE} and its package.json version is ${RELEASE}`, () => {
    // Arrange
    const listed = git(['ls-remote', '--tags', 'origin', TAG_REF]);
    const remoteLines = listed.ok
      ? listed.stdout.split(/\r?\n/).filter((line) => line.trim() !== '')
      : [`PROBLEM: ${listed.reason}`];

    // Act
    const tagFound = listed.ok && remoteLines.length === 1;
    const version = tagFound
      ? versionAtTag()
      : `not read: ls-remote printed ${remoteLines.length} line(s) for ${TAG_REF}`;

    // Assert
    expect({ remoteLineCount: listed.ok ? remoteLines.length : remoteLines, version }).toEqual({
      remoteLineCount: 1,
      version: RELEASE,
    });
  });
});
