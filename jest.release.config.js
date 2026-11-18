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
};
