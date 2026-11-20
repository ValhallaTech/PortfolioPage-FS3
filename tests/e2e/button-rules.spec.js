/**
 * No site rule styles the contact button or the submit button (spec bootstrap-6-upgrade,
 * WI-4: AC-22). The buttons take their look from Bootstrap 6's `btn-solid btn-lg` and the
 * `.theme-site` accent tokens, so `src/css/style.css` may set custom properties on them
 * and nothing else from the list below.
 *
 * The test reads `src/css/style.css` with postcss and `dist/index.html` from `yarn build`
 * on the Node side, loads that markup with `page.setContent` (every request it would make
 * is aborted, so nothing leaves the machine and no script runs against a server), and asks
 * the browser which rules match either button. Dynamic pseudo-classes (`:hover`,
 * `:focus-visible` and the like) and pseudo-elements are stripped first, so a rule that
 * applies only on hover or focus, or that styles `::before`, still counts.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import { test, expect } from './fixtures.js';
import { contactButton, contactDialog } from './helpers/contact-modal.js';

const ROOT = path.resolve(__dirname, '..', '..');
const STYLESHEET = path.join(ROOT, 'src', 'css', 'style.css');
const BUILT_PAGE = path.join(ROOT, 'dist', 'index.html');

/** The properties AC-22 forbids on the buttons; custom properties (`--*`) are allowed. */
const FORBIDDEN_PROPERTY =
  /^(background|background-color|color|border.*|padding.*|font.*|text-transform|letter-spacing)$/i;

/** Pseudo-classes that apply only in an interaction state, and every pseudo-element. */
const DYNAMIC_PSEUDO_CLASS =
  /:(?:hover|active|focus-visible|focus-within|focus|visited|link|target)(?![\w-])/gi;
const PSEUDO_ELEMENT = /::[\w-]+(?:\([^)]*\))?/g;

/**
 * A selector with its dynamic pseudo-classes and pseudo-elements removed. A compound left
 * empty, such as a bare `:focus-visible` or the end of `.x > :hover`, becomes `*`.
 *
 * @param {string} selector
 */
function staticSelector(selector) {
  const stripped = selector.replace(DYNAMIC_PSEUDO_CLASS, '').replace(PSEUDO_ELEMENT, '').trim();
  if (stripped === '') return '*';
  return /[>+~]$/.test(stripped) ? `${stripped} *` : stripped;
}

/**
 * Every style rule in the stylesheet, outside `@keyframes`, with each of its selectors
 * and the declarations AC-22 forbids.
 *
 * @returns {Promise<Array<{ selectors: string[], source: string, forbidden: string[] }>>}
 */
async function readStyleRules() {
  const root = postcss.parse(await readFile(STYLESHEET, 'utf8'), { from: STYLESHEET });
  const rules = [];
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    const forbidden = rule.nodes
      .filter((node) => node.type === 'decl' && FORBIDDEN_PROPERTY.test(node.prop))
      .map((decl) => `${decl.prop}: ${decl.value}`);
    rules.push({
      selectors: rule.selectors.map(staticSelector),
      source: `style.css:${rule.source.start.line} ${rule.selector}`,
      forbidden,
    });
  });
  return rules;
}

test('AC-22: no style.css rule sets a color, border, spacing or font property on either button', async ({
  page,
}) => {
  const rules = await readStyleRules();
  expect(rules.length, 'style rules in src/css/style.css').toBeGreaterThan(0);

  await page.route('**/*', (route) => route.abort());
  await page.setContent(await readFile(BUILT_PAGE, 'utf8'), { waitUntil: 'domcontentloaded' });

  // The dialog is closed in the markup, so its submit button is found among hidden elements.
  const buttons = {
    'contact button': contactButton(page),
    'submit button': contactDialog(page).getByRole('button', {
      name: 'Send Message',
      exact: true,
      includeHidden: true,
    }),
  };
  const offending = [];
  const unparsed = [];
  for (const [name, locator] of Object.entries(buttons)) {
    await expect(locator, `the ${name} in dist/index.html`).toHaveCount(1);
    const matches = await locator.evaluate(
      (element, ruleSelectors) =>
        ruleSelectors.map((selectors) =>
          selectors.map((selector) => {
            try {
              return element.matches(selector);
            } catch {
              return null;
            }
          })
        ),
      rules.map(({ selectors }) => selectors)
    );
    rules.forEach((rule, index) => {
      if (matches[index].includes(null)) unparsed.push(rule.source);
      if (matches[index].includes(true) && rule.forbidden.length > 0) {
        offending.push(`${name} ← ${rule.source} { ${rule.forbidden.join('; ')} }`);
      }
    });
  }

  expect(unparsed, 'selectors the browser could not parse after stripping').toEqual([]);
  expect(offending, 'forbidden declarations in rules that match a button').toEqual([]);
});
