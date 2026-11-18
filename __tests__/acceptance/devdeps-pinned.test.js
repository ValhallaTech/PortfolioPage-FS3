/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for chain H (spec stabilize-and-cleanup, sections 2.3 and
 * 3.4 WI-22): AC-88, no devDependency uses `latest`.
 *
 * It does in JavaScript what AC-88's `yq` command does, because `yq` is not in
 * the Linux gate container: it counts the `devDependencies` values in the root
 * `package.json` that equal `latest`, and expects none.
 */
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_JSON = path.resolve(__dirname, '..', '..', 'package.json');

/** The floating tag AC-88 forbids. */
const LATEST = 'latest';

/**
 * Reads the root `package.json` and returns the devDependencies pinned to `latest`.
 *
 * @returns {string[]} The package names whose devDependency value is exactly `latest`.
 */
function devDependenciesOnLatest() {
  const manifest = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const devDependencies = manifest.devDependencies ?? {};
  return Object.entries(devDependencies)
    .filter(([, version]) => version === LATEST)
    .map(([name]) => name);
}

describe('package.json devDependencies', () => {
  it('AC-88: no devDependency uses latest', () => {
    // Arrange and act
    const latestKeys = devDependenciesOnLatest();

    // Assert
    expect(latestKeys).toEqual([]);
  });
});
