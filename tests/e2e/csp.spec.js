/**
 * The report-only CSP raises nothing on a full visit (spec stabilize-and-cleanup, WI-60:
 * AC-83), nor on a mocked contact submission after it (spec bootstrap-6-upgrade, WI-2:
 * AC-31, which also asserts that no enforcing policy is served), nor in either motion mode
 * with a nav click, a back-to-top click and the dialog added (spec gsap-animations, WI-5:
 * AC-41).
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
 *
 * The full visit never zooms the lightbox, so two more cases cover GLightbox's inline-style
 * writes (RK-7): two clicks on a shrunk lightbox image, which is click-zoom's path and must
 * stay silent with `zoomable: false`, and a touch pinch whose reset writes `style=""`,
 * which the policy's empty-string hash allows. Each asserts that its gesture took effect.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { test, expect } from './fixtures.js';
import { desktop, phone } from './viewports.js';
import { fullVisit } from './helpers/full-visit.js';
import { fillContactForm, mockWeb3Forms, openContactModal } from './helpers/contact-modal.js';
import {
  LIGHTBOX,
  LIGHTBOX_IMAGE,
  openLightboxFrom,
  portfolioItem,
  revealPortfolio,
  waitForPortfolioGrid,
} from './helpers/portfolio.js';

const NETLIFY_TOML = path.resolve(__dirname, '..', '..', 'netlify.toml');

/** The response header WI-58 adds, lowercased as Playwright reports header names. */
const CSP_REPORT_ONLY = 'content-security-policy-report-only';

/** The enforcing header, which the policy must not be served as (bootstrap-6-upgrade C-10). */
const CSP_ENFORCED = 'content-security-policy';

/** AC-83: the console messages that count as CSP messages. */
const CSP_CONSOLE_MESSAGE = /Content.Security.Policy/i;

/** The page binding the init script reports each `securitypolicyviolation` event through. */
const VIOLATION_BINDING = '__wi60CspViolation';

/** The full visit walks many steps with fixed settles; the smoke spec allows it 60 s. */
const FULL_VISIT_TIMEOUT_MS = 60_000;

/**
 * AC-41 (spec gsap-animations): the GSAP reveals and hero entrance write styles in both
 * motion modes, so the visit runs once with motion allowed and once under reduced motion.
 */
const MOTION_MODES = Object.freeze([
  { mode: 'no-preference', label: 'motion allowed' },
  { mode: 'reduce', label: 'reduced motion' },
]);

/** AC-41: how near the viewport top `#about` must come for the nav click to count. */
const ABOUT_ARRIVAL_PX = 2;

/**
 * The zoom case's viewport (RK-7). GLightbox caps the image at 97vh, so at 560 px the
 * 800×600 portfolio image is shown smaller than its natural size, which is when GLightbox
 * offers click-zoom. The width stays above 768 px, below which click-zoom does nothing.
 */
const ZOOM_VIEWPORT = Object.freeze({ viewport: { width: 1024, height: 560 } });

/** The expando property the click counter keeps on the lightbox image. */
const CLICK_COUNT = '__wi60Clicks';

/** The pinch case's finger gaps in px: start, spread (scale 1.5), then close (scale 0.8). */
const PINCH_GAPS_PX = Object.freeze({ start: 100, spread: 150, close: 80 });

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

/**
 * The response to the page's first main-frame navigation. Call it before navigating.
 *
 * @param {import('@playwright/test').Page} page
 */
function mainDocumentResponse(page) {
  return page.waitForResponse(
    (response) => response.request().isNavigationRequest() && response.frame() === page.mainFrame()
  );
}

/**
 * Asserts that the document carried the one report-only policy netlify.toml ships, so a
 * count of zero violations means the page complied with it, not that no policy was served.
 *
 * @param {import('@playwright/test').Response} documentResponse
 */
async function expectShippedPolicyServed(documentResponse) {
  const served = (await documentResponse.allHeaders())[CSP_REPORT_ONLY];
  expect(served, `the document response carries ${CSP_REPORT_ONLY}`).toBeTruthy();
  expect(
    [normalizePolicy(served)],
    `the served ${CSP_REPORT_ONLY} is the one value netlify.toml ships`
  ).toEqual(shippedPolicies());
}

/**
 * Lets the browser dispatch any `securitypolicyviolation` event the last action queued:
 * the event is fired from a task, so the test waits for a frame and a task after it.
 *
 * @param {import('@playwright/test').Page} page
 */
async function settleViolationEvents(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
  );
}

/**
 * Loads `/`, opens GLightbox from portfolio item 1 and waits until its image has loaded.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<import('@playwright/test').Locator>} The lightbox image.
 */
async function openPortfolioLightbox(page) {
  await page.goto('/', { waitUntil: 'load' });
  await waitForPortfolioGrid(page);
  await revealPortfolio(page);
  await openLightboxFrom(portfolioItem(page, 1));
  await expect(page.locator(LIGHTBOX), 'the lightbox opens').toBeVisible();
  const image = page.locator(LIGHTBOX_IMAGE);
  await expect
    .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0), {
      message: 'the lightbox image has loaded',
    })
    .toBe(true);
  return image;
}

/**
 * Counts the `click` events whose target is `element` itself, so a click that lands on
 * an overlay or a neighbor does not count.
 *
 * @param {import('@playwright/test').Locator} element
 * @returns {Promise<() => Promise<number>>} Reads the count so far.
 */
async function countClicksOn(element) {
  await element.evaluate((target, counter) => {
    target[counter] = 0;
    target.addEventListener('click', (event) => {
      if (event.target === target) target[counter] += 1;
    });
  }, CLICK_COUNT);
  return () => element.evaluate((target, counter) => target[counter], CLICK_COUNT);
}

/**
 * Sends one two-finger touch event through CDP, the fingers `gapPx` apart on a horizontal
 * line through `center`. Playwright's own touch API has single-point taps only.
 *
 * @param {import('@playwright/test').CDPSession} cdp
 * @param {'touchStart' | 'touchMove'} type
 * @param {{ x: number, y: number }} center
 * @param {number} gapPx
 */
async function twoFingerTouch(cdp, type, center, gapPx) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: [
      { id: 0, x: center.x - gapPx / 2, y: center.y },
      { id: 1, x: center.x + gapPx / 2, y: center.y },
    ],
  });
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

  test(
    'AC-31: a full visit and a mocked submission raise no CSP violation under the report-only policy',
    { tag: '@live' },
    async ({ page }) => {
      test.setTimeout(FULL_VISIT_TIMEOUT_MS);
      await mockWeb3Forms(page, { success: true });
      const violations = await recordViolations(page);
      const consoleMessages = recordCspConsoleMessages(page);
      const documentResponse = mainDocumentResponse(page);

      await fullVisit(page);
      await openContactModal(page);
      await fillContactForm(page);
      await page.locator('#submit-btn').click();
      await expect(page.locator('#sent-message'), 'the mocked submission succeeded').toBeVisible();
      await settleViolationEvents(page);

      const response = await documentResponse;
      await expectShippedPolicyServed(response);
      expect(
        (await response.allHeaders())[CSP_ENFORCED],
        `the document response carries no ${CSP_ENFORCED}`
      ).toBeUndefined();
      expect(violations, 'securitypolicyviolation events').toEqual([]);
      expect(consoleMessages, 'console messages matching /Content.Security.Policy/i').toEqual([]);
    }
  );

  for (const { mode, label } of MOTION_MODES) {
    test(
      `AC-41: under ${label}, a full visit, the nav and back-to-top clicks, the contact dialog and a mocked submission raise no CSP violation`,
      { tag: '@live' },
      async ({ page }) => {
        test.setTimeout(FULL_VISIT_TIMEOUT_MS);
        await page.emulateMedia({ reducedMotion: mode });
        await mockWeb3Forms(page, { success: true });
        const violations = await recordViolations(page);
        const consoleMessages = recordCspConsoleMessages(page);
        const documentResponse = mainDocumentResponse(page);

        await fullVisit(page);
        await page.locator('#header').getByRole('link', { name: 'About', exact: true }).click();
        await expect
          .poll(
            () => page.locator('#about').evaluate((about) => about.getBoundingClientRect().top),
            {
              message: 'the About nav link brought #about to the top of the viewport',
            }
          )
          .toBeLessThan(ABOUT_ARRIVAL_PX);
        await page.getByRole('link', { name: 'Back to top' }).click();
        await expect
          .poll(() => page.evaluate(() => window.scrollY), {
            message: 'back-to-top reached the top',
          })
          .toBe(0);
        await openContactModal(page);
        await fillContactForm(page);
        await page.locator('#submit-btn').click();
        await expect(
          page.locator('#sent-message'),
          'the mocked submission succeeded'
        ).toBeVisible();
        await settleViolationEvents(page);

        const response = await documentResponse;
        await expectShippedPolicyServed(response);
        expect(
          (await response.allHeaders())[CSP_ENFORCED],
          `the document response carries no ${CSP_ENFORCED}`
        ).toBeUndefined();
        expect(violations, 'securitypolicyviolation events').toEqual([]);
        expect(consoleMessages, 'console messages matching /Content.Security.Policy/i').toEqual([]);
      }
    );
  }
});

test.describe('at 1024×560, where the lightbox shows its image below natural size', () => {
  test.use(ZOOM_VIEWPORT);

  test(
    'AC-83: two clicks on the lightbox image raise no CSP violation and no CSP console message',
    { tag: '@live' },
    async ({ page }) => {
      const violations = await recordViolations(page);
      const consoleMessages = recordCspConsoleMessages(page);
      const documentResponse = mainDocumentResponse(page);

      const image = await openPortfolioLightbox(page);
      expect(
        await image.evaluate((element) => element.naturalWidth > element.offsetWidth),
        'the image is shown below its natural width, where GLightbox offers click-zoom'
      ).toBe(true);
      const clicks = await countClicksOn(image);
      await image.click();
      await image.click();
      await settleViolationEvents(page);

      expect(await clicks(), 'click events that landed on the lightbox image').toBe(2);
      await expect(page.locator(LIGHTBOX), 'the lightbox is still open').toBeVisible();
      await expectShippedPolicyServed(await documentResponse);
      expect(violations, 'securitypolicyviolation events').toEqual([]);
      expect(consoleMessages, 'console messages matching /Content.Security.Policy/i').toEqual([]);
    }
  );
});

test.describe('on a touch phone', () => {
  test.use(phone);

  test(
    'RK-7: a pinch that scales the lightbox image and resets it raises no CSP violation',
    { tag: '@live' },
    async ({ page }) => {
      const violations = await recordViolations(page);
      const consoleMessages = recordCspConsoleMessages(page);
      const documentResponse = mainDocumentResponse(page);

      const image = await openPortfolioLightbox(page);
      const box = await image.boundingBox();
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const cdp = await page.context().newCDPSession(page);
      await twoFingerTouch(cdp, 'touchStart', center, PINCH_GAPS_PX.start);
      await twoFingerTouch(cdp, 'touchMove', center, PINCH_GAPS_PX.spread);
      const scaledStyle = await image.getAttribute('style');
      await twoFingerTouch(cdp, 'touchMove', center, PINCH_GAPS_PX.close);
      const resetStyle = await image.getAttribute('style');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await settleViolationEvents(page);

      expect(scaledStyle, 'the spreading pinch scaled the image').toMatch(/scale3d\(1\.5,/);
      expect(resetStyle, 'the closing pinch ran the reset that writes style=""').toBe('');
      await expectShippedPolicyServed(await documentResponse);
      expect(violations, 'securitypolicyviolation events').toEqual([]);
      expect(consoleMessages, 'console messages matching /Content.Security.Policy/i').toEqual([]);
    }
  );
});
