/**
 * S5 release suite (spec stabilize-and-cleanup, section 3.4): network, `gh`,
 * Docker and live checks. Run with `yarn verify:release`; it is never a gate step.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__/release'],
  collectCoverage: false,
  // A fresh-clone gate run installs, lints, tests and builds the whole repo.
  testTimeout: 60 * 60 * 1000,
  // One file at a time: the fresh-clone gate (AC-1) and the baseline-sensitivity
  // smoke runs (AC-90 to AC-92) each start Playwright's webServer on port 4173,
  // and the second one to start fails with "port already used".
  maxWorkers: 1,
};
