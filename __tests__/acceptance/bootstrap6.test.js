/**
 * Sprint 2 lint tests for PR-1 (spec bootstrap-6-upgrade, sections 2.3 and
 * 3.4 WI-2): AC-1 and AC-7.
 *
 * AC-1 reads the installed Bootstrap version from
 * `node_modules/bootstrap/package.json` by path, because Bootstrap 6's
 * `exports` map does not export `./package.json`, so
 * `require('bootstrap/package.json')` cannot resolve it.
 *
 * AC-7's two `rg` searches run in Node, because `rg` is absent from the Linux
 * gate container. They match line by line, as `rg` does.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** AC-1: the Bootstrap release this sprint installs. */
const BOOTSTRAP_VERSION = '6.0.0-alpha.1';

/** AC-1: the Sass transformer that must not be declared. */
const SASS_TRANSFORMER = '@parcel/transformer-sass';

/** AC-1: the dependency blocks searched for the Sass transformer. */
const DEPENDENCY_BLOCKS = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
]);

/** AC-7: the site stylesheet. */
const STYLE_CSS = path.join('src', 'css', 'style.css');

/** AC-7: a media query at a Bootstrap 5 `lg` or `xl` width. */
const BOOTSTRAP5_BREAKPOINT_PATTERN = /@media[^{]*\b(991|992|1199|1200)(\.98)?px/;

/** AC-7: a media query at the 1280 px sidebar switch. */
const SIDEBAR_SWITCH_PATTERN = /@media[^{]*\b1280px/;

/**
 * Reads and parses a JSON file under the repo root.
 *
 * @param {...string} segments The path segments below the repo root.
 * @returns {Record<string, unknown>} The parsed JSON.
 */
function readJson(...segments) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ...segments), 'utf8'));
}

/**
 * Lists the numbers of the lines in `text` that match `pattern`, as `rg -n` does.
 *
 * @param {string} text The file content.
 * @param {RegExp} pattern A non-global pattern.
 * @returns {number[]} The one-based line numbers.
 */
function matchingLines(text, pattern) {
  return text
    .split('\n')
    .map((line, index) => (pattern.test(line) ? index + 1 : 0))
    .filter((lineNumber) => lineNumber > 0);
}

describe('AC-1: Bootstrap 6.0.0-alpha.1 is installed, and no Sass transformer is', () => {
  test('package.json declares bootstrap 6.0.0-alpha.1 in dependencies', () => {
    // Arrange
    const manifest = readJson('package.json');

    // Act
    const declared = manifest.dependencies?.bootstrap ?? null;

    // Assert
    expect(declared).toBe(BOOTSTRAP_VERSION);
  });

  test('node_modules holds bootstrap 6.0.0-alpha.1', () => {
    // Arrange
    const installed = readJson('node_modules', 'bootstrap', 'package.json');

    // Act
    const version = installed.version ?? null;

    // Assert
    expect(version).toBe(BOOTSTRAP_VERSION);
  });

  test('no dependency block declares @parcel/transformer-sass', () => {
    // Arrange
    const manifest = readJson('package.json');

    // Act
    const declaredIn = DEPENDENCY_BLOCKS.filter((block) =>
      Object.keys(manifest[block] ?? {}).includes(SASS_TRANSFORMER)
    );

    // Assert
    expect(declaredIn).toEqual([]);
  });
});

describe('AC-7: the site CSS has no Bootstrap 5 breakpoint left', () => {
  test('no media query uses a Bootstrap 5 lg or xl width', () => {
    // Arrange
    const css = fs.readFileSync(path.join(REPO_ROOT, STYLE_CSS), 'utf8');

    // Act
    const lines = matchingLines(css, BOOTSTRAP5_BREAKPOINT_PATTERN);

    // Assert
    expect(lines).toEqual([]);
  });

  test('the sidebar switch uses 1280 px', () => {
    // Arrange
    const css = fs.readFileSync(path.join(REPO_ROOT, STYLE_CSS), 'utf8');

    // Act
    const count = matchingLines(css, SIDEBAR_SWITCH_PATTERN).length;

    // Assert
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
