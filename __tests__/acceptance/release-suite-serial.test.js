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
 * This test loads `jest.release.config.js` and asserts `maxWorkers` is 1. It is
 * offline and runs the same on Windows and Linux.
 */
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RELEASE_CONFIG = path.join(REPO_ROOT, 'jest.release.config.js');

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

describe('Release suite runs serially', () => {
  test('jest.release.config.js sets maxWorkers to 1, so no two files share port 4173', () => {
    const { config, problem } = loadReleaseConfig();

    expect(problem).toBeNull();
    expect(config.maxWorkers).toBe(1);
  });
});
