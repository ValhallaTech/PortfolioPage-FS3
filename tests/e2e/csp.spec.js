/**
 * The report-only CSP raises nothing on a full visit (spec stabilize-and-cleanup, WI-60:
 * AC-83).
 *
 * The test carries `@live`, so `yarn test:e2e:live` runs it against the deployed site too.
 * On the local target, scripts/serve-dist.mjs applies the `[[headers]]` blocks of
 * netlify.toml, so the document carries the same `Content-Security-Policy-Report-Only`
 * value as Netlify serves.
 *
 * A report-only policy blocks nothing, so a page without one raises no violation either.
 * The test therefore asserts first that the document response carries the policy
 * netlify.toml ships, and only then counts violations: no header fails the test instead
 * of passing it on zero events.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { test, expect } from './fixtures.js';
import { desktop } from './viewports.js';
import { fullVisit } from './helpers/full-visit.js';

const NETLIFY_TOML = path.resolve(__dirname, '..', '..', 'netlify.toml');

/** The response header WI-58 adds, lowercased as Playwright reports header names. */
const CSP_REPORT_ONLY = 'content-security-policy-report-only';

/** AC-83: the console messages that count as CSP messages. */
const CSP_CONSOLE_MESSAGE = /Content.Security.Policy/i;

/** The page binding the init script reports each `securitypolicyviolation` event through. */
const VIOLATION_BINDING = '__wi60CspViolation';

/** The full visit walks many steps with fixed settles; the smoke spec allows it 60 s. */
const FULL_VISIT_TIMEOUT_MS = 60_000;

/**
 * A policy with one space after each `;` and none elsewhere around it, so a value
 * Netlify or serve-dist collapses from several lines compares equal to the source.
 *
 * @param {string} policy
 */
function normalizePolicy(policy) {
  return policy
    .split(';')
    .map((directive) => directive.trim().replace(/\s+/g, ' '))
    .filter((directive) => directive !== '')
    .join('; ');
}

/** Every `Content-Security-Policy-Report-Only` value the netlify.toml `[[headers]]` set. */
function shippedPolicies() {
  const blocks = parseToml(readFileSync(NETLIFY_TOML, 'utf8')).headers ?? [];
  return blocks
    .flatMap((block) => Object.entries(block.values ?? {}))
    .filter(([name]) => name.toLowerCase() === CSP_REPORT_ONLY)
    .map(([, value]) => normalizePolicy(String(value)));
}

/**
 * Records every `securitypolicyviolation` event, from navigation onward, in every frame.
 * Each record names the frame it fired in, so a failure shows whose policy it was.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object[]>} The live list of recorded violations.
 */
async function recordViolations(page) {
  const violations = [];
  await page.exposeBinding(VIOLATION_BINDING, ({ frame }, violation) => {
    violations.push({ frame: frame.url(), ...violation });
  });
  await page.addInitScript((binding) => {
    document.addEventListener(
      'securitypolicyviolation',
      (event) => {
        window[binding]({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          sourceFile: event.sourceFile,
          line: event.lineNumber,
          column: event.columnNumber,
          sample: event.sample,
          disposition: event.disposition,
        });
      },
      true
    );
  }, VIOLATION_BINDING);
  return violations;
}

/**
 * Records every console message, of any type and from any frame, that mentions the
 * Content Security Policy.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {object[]} The live list of recorded messages.
 */
function recordCspConsoleMessages(page) {
  const messages = [];
  page.on('console', (message) => {
    if (!CSP_CONSOLE_MESSAGE.test(message.text())) return;
    messages.push({ type: message.type(), text: message.text(), url: message.location().url });
  });
  return messages;
}

test.describe('at desktop', () => {
  test.use(desktop);

  test(
    'AC-83: a full visit raises no CSP violation and no CSP console message',
    { tag: '@live' },
    async ({ page }) => {
      test.setTimeout(FULL_VISIT_TIMEOUT_MS);
      const violations = await recordViolations(page);
      const consoleMessages = recordCspConsoleMessages(page);
      const documentResponse = page.waitForResponse(
        (response) =>
          response.request().isNavigationRequest() && response.frame() === page.mainFrame()
      );

      await fullVisit(page);

      const served = (await (await documentResponse).allHeaders())[CSP_REPORT_ONLY];
      expect(served, `the document response carries ${CSP_REPORT_ONLY}`).toBeTruthy();
      expect(
        [normalizePolicy(served)],
        `the served ${CSP_REPORT_ONLY} is the one value netlify.toml ships`
      ).toEqual(shippedPolicies());
      expect(violations, 'securitypolicyviolation events').toEqual([]);
      expect(consoleMessages, 'console messages matching /Content.Security.Policy/i').toEqual([]);
    }
  );
});
