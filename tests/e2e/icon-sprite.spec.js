/**
 * Build-output check for the inline SVG icon sprite (WI-43, review finding CR-3).
 *
 * A `<use>` whose reference names no `<symbol>` renders an empty box that still has a
 * size, so the browser-level AC-72 check in assets.spec.js cannot see it. This test
 * reads `dist/index.html` from `yarn build` on the Node side and never opens a page.
 * The fixtures.js guards are auto fixtures and still create a browser context; this
 * test does not navigate it. Run `yarn build` first: a missing build fails the read.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from './fixtures.js';

const DIST_INDEX = path.resolve(__dirname, '..', '..', 'dist', 'index.html');

/** The attributes a `<use>` can carry its sprite reference in. */
const REFERENCE_ATTRIBUTES = ['href', 'xlink:href'];

/**
 * Parses the attributes of one start tag's text into a map. Unquoted, single-quoted,
 * double-quoted and value-less attributes are all read, because the build minifies.
 * @param {string} tag - The start tag, from `<` to `>`
 * @returns {Map<string, string>} Attribute names in lower case, mapped to their values
 */
function parseAttributes(tag) {
  const attributes = new Map();
  const body = tag.replace(/^<[^\s/>]+/, '').replace(/\/?>$/, '');
  const attribute = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(attribute)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

/**
 * The attribute maps of every start tag with the given name in the page.
 * @param {string} html - The page source
 * @param {string} name - The element name, in lower case
 * @returns {Map<string, string>[]}
 */
function startTags(html, name) {
  const tag = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return (html.match(tag) ?? []).map(parseAttributes);
}

test.describe('icon sprite', { tag: '@build' }, () => {
  test('every <use> in dist/index.html references a <symbol> id in the same page', async () => {
    const html = await readFile(DIST_INDEX, 'utf8');
    const uses = startTags(html, 'use');
    expect(uses.length, '<use> elements in dist/index.html').toBeGreaterThan(0);

    const symbolIds = new Set(
      startTags(html, 'symbol')
        .map((attributes) => attributes.get('id'))
        .filter(Boolean)
    );

    const unresolved = [];
    for (const attributes of uses) {
      const references = REFERENCE_ATTRIBUTES.filter((name) => attributes.has(name));
      if (references.length === 0) unresolved.push('(no href or xlink:href)');
      for (const name of references) {
        const value = attributes.get(name);
        if (!value.startsWith('#') || !symbolIds.has(value.slice(1))) {
          unresolved.push(`${name}=${value}`);
        }
      }
    }

    expect(unresolved, '<use> references that name no <symbol> id in the page').toEqual([]);
  });
});
