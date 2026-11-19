/**
 * Build-output checks for the CSS the bundler emits for the browsers the site supports.
 *
 * With no browserslist, Lightning CSS targets only current browsers: it rewrites
 * `min-width`/`max-width` media features into range syntax, which an older browser cannot
 * parse, so it ignores every breakpoint. These checks fail on that output and pass once
 * the build has real targets.
 *
 * Each test reads `dist/` from `yarn build` on the Node side and never opens a page.
 * The fixtures.js guards are auto fixtures and still create a browser context; no test
 * here navigates it. Run `yarn build` first: every test asserts that `dist/` holds CSS,
 * so a missing build fails instead of passing on zero files.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import { test, expect } from './fixtures.js';

const DIST_DIR = path.resolve(__dirname, '..', '..', 'dist');

/** The at-rules whose params hold media-feature queries. */
const QUERY_AT_RULE = /^(media|container)$/i;

/** One parenthesized feature that compares with `<`, `>`, `<=`, `>=` or `=`. */
const RANGE_FEATURE = /\([^()]*[<>=][^()]*\)/;

/** An unprefixed `image-set(`; a `-webkit-image-set(` does not match. */
const UNPREFIXED_IMAGE_SET = /(^|[^-\w])image-set\(/i;

/** A `-webkit-image-set(`. */
const WEBKIT_IMAGE_SET = /-webkit-image-set\(/i;

/**
 * Every `.css` file under `dist/`, as paths relative to it with forward slashes.
 * @returns {Promise<string[]>}
 */
async function distCssFiles() {
  const entries = await readdir(DIST_DIR, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => path.relative(DIST_DIR, path.join(entry.parentPath, entry.name)))
    .map((relative) => relative.split(path.sep).join('/'));
}

/**
 * Parses every `dist/**\/*.css` file with postcss.
 * @returns {Promise<{ file: string, root: import('postcss').Root }[]>}
 */
async function parseDistCss() {
  const files = await distCssFiles();
  return Promise.all(
    files.map(async (file) => ({
      file,
      root: postcss.parse(await readFile(path.join(DIST_DIR, file), 'utf8'), { from: file }),
    }))
  );
}

/**
 * Escapes a string for use inside a RegExp.
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `value` is a plain `url()` image that a browser without `image-set()` keeps.
 * @param {string} value
 * @returns {boolean}
 */
function isPlainUrl(value) {
  return /\burl\(/i.test(value) && !/image-set\(/i.test(value);
}

/**
 * Whether an earlier declaration of the same property in the same rule is a fallback:
 * a plain `url()`, or a `-webkit-image-set()`.
 * @param {import('postcss').Declaration} decl
 * @returns {boolean}
 */
function hasFallbackInSameRule(decl) {
  const property = decl.prop.toLowerCase();
  const siblings = decl.parent.nodes;
  return siblings
    .slice(0, siblings.indexOf(decl))
    .some(
      (node) =>
        node.type === 'decl' &&
        node.prop.toLowerCase() === property &&
        (isPlainUrl(node.value) || WEBKIT_IMAGE_SET.test(node.value))
    );
}

/**
 * The nearest `@supports` ancestor whose condition starts with a positive test of
 * `image-set()` for `property`, or undefined. A browser that cannot parse `image-set()`
 * fails that test and skips the whole block.
 * @param {import('postcss').Declaration} decl
 * @returns {import('postcss').AtRule | undefined}
 */
function imageSetSupportsGuard(decl) {
  const condition = new RegExp(`^\\(\\s*${escapeRegExp(decl.prop)}\\s*:\\s*image-set\\(`, 'i');
  for (let node = decl.parent; node && node.type !== 'root'; node = node.parent) {
    if (node.type === 'atrule' && /^supports$/i.test(node.name)) {
      if (condition.test(node.params.trim())) return node;
    }
  }
  return undefined;
}

/**
 * Whether a top-level rule with the same selector declares the same property as a plain
 * `url()`: the value a browser keeps when it skips the `@supports` block.
 * @param {import('postcss').Root} root
 * @param {import('postcss').Declaration} decl
 * @returns {boolean}
 */
function hasTopLevelUrlFallback(root, decl) {
  const selector = decl.parent.selector;
  const property = decl.prop.toLowerCase();
  return root.nodes.some(
    (node) =>
      node.type === 'rule' &&
      node.selector === selector &&
      node.nodes.some(
        (child) =>
          child.type === 'decl' && child.prop.toLowerCase() === property && isPlainUrl(child.value)
      )
  );
}

test.describe('CSS browser targets', () => {
  test('no @media or @container query in dist CSS uses range syntax', async () => {
    const sheets = await parseDistCss();
    expect(sheets.length, 'dist/**/*.css files').toBeGreaterThan(0);

    const counts = new Map();
    for (const { file, root } of sheets) {
      root.walkAtRules(QUERY_AT_RULE, (rule) => {
        if (!RANGE_FEATURE.test(rule.params)) return;
        const key = `${file}: @${rule.name} ${rule.params}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    }
    const offending = [...counts].map(([key, count]) => `${key} (x${count})`);

    expect(offending, 'query at-rules whose features use range syntax').toEqual([]);
  });

  test('every unprefixed image-set() in dist CSS has a fallback', async () => {
    const sheets = await parseDistCss();
    expect(sheets.length, 'dist/**/*.css files').toBeGreaterThan(0);

    let checked = 0;
    const failing = [];
    for (const { file, root } of sheets) {
      root.walkDecls((decl) => {
        if (!UNPREFIXED_IMAGE_SET.test(decl.value)) return;
        checked += 1;
        if (hasFallbackInSameRule(decl)) return;
        if (imageSetSupportsGuard(decl) && hasTopLevelUrlFallback(root, decl)) return;
        failing.push(`${file}: ${decl.parent.selector ?? '(no selector)'} { ${decl.prop} }`);
      });
    }

    // The hero background uses image-set(), so zero matches means the check saw nothing.
    expect(checked, 'unprefixed image-set() declarations in dist CSS').toBeGreaterThan(0);
    expect(failing, 'image-set() declarations without a fallback').toEqual([]);
  });
});
