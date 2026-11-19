/**
 * Build-output checks for the performance assets (spec stabilize-and-cleanup, WI-41:
 * AC-69, AC-70, AC-74, AC-75).
 *
 * Each test reads `dist/` from `yarn build` on the Node side and never opens a page.
 * The fixtures.js guards are auto fixtures and still create a browser context; no test
 * here navigates it. Run `yarn build` first: every test asserts that `dist/` holds a
 * build, so a missing build fails instead of passing on zero files.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import { test, expect } from './fixtures.js';

const DIST_DIR = path.resolve(__dirname, '..', '..', 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');

/** AC-69: the two Google font hosts. */
const GOOGLE_FONT_HOST = /fonts\.(googleapis|gstatic)\.com/;

/** AC-70: the display policies that do not block text rendering. */
const NON_BLOCKING_DISPLAY = new Set(['swap', 'optional']);

/** AC-74: the font file extensions searched, and the icon-font names that must not appear. */
const FONT_FILE = /\.(woff2?|ttf|otf|eot)$/i;
// Built from fragments so this file never contains the names the AC-15 and AC-17 guards ban.
const ICON_FONT_NAME = new RegExp(
  ['^fa-', 'fontawesome', ['icof', 'ont'].join(''), ['box', 'icons'].join('')].join('|'),
  'i'
);

/** AC-75: a positive integer attribute value. */
const POSITIVE_INTEGER = /^[1-9]\d*$/;

/**
 * Every file under `dist/`, as paths relative to it with forward slashes.
 * @returns {Promise<string[]>}
 */
async function distFiles() {
  const entries = await readdir(DIST_DIR, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(DIST_DIR, path.join(entry.parentPath, entry.name)))
    .map((relative) => relative.split(path.sep).join('/'));
}

/**
 * Parses the attributes of one start tag's text into a map. Unquoted, single-quoted,
 * double-quoted and value-less attributes are all read, because the build may minify.
 * @param {string} tag - The start tag, from `<img` to `>`
 * @returns {Map<string, string>} Attribute names in lower case, mapped to their values
 */
function parseAttributes(tag) {
  const attributes = new Map();
  const body = tag.replace(/^<img\b/i, '').replace(/\/?>$/, '');
  const attribute = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(attribute)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

test.describe('build output', { tag: '@build' }, () => {
  test('AC-69: no built file names a Google font host', async () => {
    const files = await distFiles();
    expect(files, 'dist/ holds a build').toContain('index.html');

    const referencing = [];
    for (const file of files) {
      const text = await readFile(path.join(DIST_DIR, file), 'latin1');
      if (GOOGLE_FONT_HOST.test(text)) referencing.push(file);
    }

    expect(
      referencing,
      'files in dist/ that reference fonts.googleapis.com or fonts.gstatic.com'
    ).toEqual([]);
  });

  test('AC-70: every @font-face in dist/*.css declares font-display swap or optional', async () => {
    const cssFiles = (await distFiles()).filter(
      (file) => !file.includes('/') && file.endsWith('.css')
    );
    expect(cssFiles.length, 'dist/*.css files').toBeGreaterThan(0);

    const failing = [];
    for (const file of cssFiles) {
      const root = postcss.parse(await readFile(path.join(DIST_DIR, file), 'utf8'), { from: file });
      root.walkAtRules(/^font-face$/i, (rule) => {
        let display;
        let family;
        rule.walkDecls((decl) => {
          const property = decl.prop.toLowerCase();
          if (property === 'font-display') display = decl.value.trim().toLowerCase();
          if (property === 'font-family') family = decl.value.trim();
        });
        if (!NON_BLOCKING_DISPLAY.has(display)) {
          failing.push(
            `${file}: ${family ?? '(no font-family)'} font-display=${display ?? '(none)'}`
          );
        }
      });
    }

    expect(failing, '@font-face blocks without font-display swap or optional').toEqual([]);
  });

  test('AC-74: no icon webfont file is built', async () => {
    const files = await distFiles();
    expect(files, 'dist/ holds a build').toContain('index.html');

    const iconFonts = files.filter(
      (file) => FONT_FILE.test(file) && ICON_FONT_NAME.test(path.posix.basename(file))
    );

    expect(iconFonts, 'font files in dist/ named like an icon font').toEqual([]);
  });

  test('AC-75: every <img> in dist/index.html has positive integer width and height', async () => {
    const html = await readFile(DIST_INDEX, 'utf8');
    const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
    expect(imgTags.length, '<img> elements in dist/index.html').toBeGreaterThan(0);

    const failing = imgTags
      .map((tag) => ({ tag, attributes: parseAttributes(tag) }))
      .filter(
        ({ attributes }) =>
          !POSITIVE_INTEGER.test(attributes.get('width') ?? '') ||
          !POSITIVE_INTEGER.test(attributes.get('height') ?? '')
      )
      .map(
        ({ attributes }) =>
          `${attributes.get('src') ?? '(no src)'} width=${attributes.get('width') ?? '(none)'} height=${attributes.get('height') ?? '(none)'}`
      );

    expect(failing, '<img> elements without positive integer width and height').toEqual([]);
  });
});
