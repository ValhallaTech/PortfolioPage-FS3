/**
 * @jest-environment node
 */
/**
 * S1 regression test for the S5 release suite (`yarn verify:release`): it runs
 * its files one at a time.
 *
 * The fresh-clone gate (AC-1) and the baseline-sensitivity smoke runs (AC-90 to
 * AC-92) each start Playwright's webServer on port 4173. Run in parallel, the
 * second one to start fails with "port already used" (seen at the 4.0.0 release).
 * This test loads `jest.release.config.js` and asserts `maxWorkers` is 1. A
 * worker flag on the command line overrides the config, so it also asserts the
 * `verify:release` script uses that config and passes no worker flag. It is
 * offline and runs the same on Windows and Linux.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RELEASE_CONFIG = path.join(REPO_ROOT, 'jest.release.config.js');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');

/** Jest's worker-count flags, as `-w 4`, `-w4`, `--maxWorkers=4` or `--max-workers 4`. */
const WORKER_FLAG = /(^|\s)(-w|--maxWorkers|--max-workers)(?=[\s=\d]|$)/;

/**
 * Loads the release suite's Jest config.
 *
 * @returns {{ config: object|null, problem: string|null }} The config, or the
 *   reason it could not be loaded.
 */
function loadReleaseConfig() {
  try {
    return { config: require(RELEASE_CONFIG), problem: null };
  } catch (error) {
    return { config: null, problem: `could not load jest.release.config.js: ${error.message}` };
  }
}

/**
 * Reads the `verify:release` script from `package.json`.
 *
 * @returns {{ script: string|null, problem: string|null }} The script, or the
 *   reason it could not be read.
 */
function readVerifyReleaseScript() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  } catch (error) {
    return { script: null, problem: `could not read package.json: ${error.message}` };
  }

  const script = manifest.scripts?.['verify:release'];
  return typeof script === 'string'
    ? { script, problem: null }
    : { script: null, problem: 'package.json has no scripts["verify:release"] string' };
}

describe('Release suite runs serially', () => {
  test('jest.release.config.js sets maxWorkers to 1, so no two files share port 4173', () => {
    const { config, problem } = loadReleaseConfig();
    const verifyRelease = readVerifyReleaseScript();

    expect(problem).toBeNull();
    expect(config.maxWorkers).toBe(1);
    expect(verifyRelease.problem).toBeNull();
    expect(verifyRelease.script).toMatch(/(^|\s)-c jest\.release\.config\.js(\s|$)/);
    expect(verifyRelease.script).not.toMatch(WORKER_FLAG);
  });
});
