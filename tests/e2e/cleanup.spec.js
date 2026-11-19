/**
 * Footer padding, scroll work, active nav and back-to-top after the sprint-1 cleanup
 * (spec stabilize-and-cleanup, WI-35: AC-24, AC-32, AC-33, AC-34, AC-54).
 *
 * Each test follows its AC text. The fixed waits are the ones the ACs name: AC-32's
 * 1 s idle and the 500 ms settles of AC-33, AC-34 and AC-54 (RK-4). Everything else
 * is a web-first assertion.
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';

/** AC-32's idle time after scrolling to y = 1200. */
const SCROLL_IDLE_MS = 1_000;

/** The settle AC-33, AC-34 and AC-54 allow after each scroll. */
const SCROLL_SETTLE_MS = 500;

/** The window property AC-32's init script keeps its `querySelectorAll` counter on. */
const QSA_COUNTER_KEY = '__wi35QuerySelectorAllCalls';

/**
 * Wraps `Document.prototype.querySelectorAll` and `Element.prototype.querySelectorAll`
 * so each call increments `window[counterKey].count`. Runs in the page, before any
 * page script, through `addInitScript`.
 * @param {string} counterKey - The window property that holds the counter
 */
function installQuerySelectorAllCounter(counterKey) {
  const counter = { count: 0 };
  window[counterKey] = counter;
  [Document.prototype, Element.prototype].forEach((prototype) => {
    const original = prototype.querySelectorAll;
    prototype.querySelectorAll = function countedQuerySelectorAll(...args) {
      counter.count += 1;
      return original.apply(this, args);
    };
  });
}

/**
 * Runs AC-32's two measurements in the page: one scroll event, then fifty in a single
 * task, each followed by two animation frames, resetting the counter before each.
 * @param {string} counterKey - The window property that holds the counter
 * @returns {Promise<{c1: number, c50: number}>} The two counts
 */
function measureScrollWork(counterKey) {
  const counter = window[counterKey];
  const twoAnimationFrames = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const dispatchScrollEvents = (times) => {
    for (let i = 0; i < times; i += 1) {
      window.dispatchEvent(new Event('scroll'));
    }
  };

  counter.count = 0;
  dispatchScrollEvents(1);
  return twoAnimationFrames().then(() => {
    const c1 = counter.count;
    counter.count = 0;
    dispatchScrollEvents(50);
    return twoAnimationFrames().then(() => ({ c1, c50: counter.count }));
  });
}

/**
 * Scrolls `#services` to the top of the viewport, as AC-33 states, and waits the
 * 500 ms settle.
 * @param {import('@playwright/test').Page} page - The page under test
 */
async function scrollServicesToTop(page) {
  await page.evaluate(() => document.querySelector('#services').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(SCROLL_SETTLE_MS);
}

/**
 * Scrolls the window to `y` and waits the 500 ms settle AC-34 states.
 * @param {import('@playwright/test').Page} page - The page under test
 * @param {number} y - The vertical scroll offset
 */
async function scrollWindowTo(page, y) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(SCROLL_SETTLE_MS);
}

test.describe('small viewport', () => {
  test.use(small);

  test('AC-24: the corrected footer padding applies below 1200 px', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('#footer');
    await expect(footer).toHaveCSS('padding-top', '20px');
    await expect(footer).toHaveCSS('padding-left', '15px');
  });
});

test.describe('desktop viewport', () => {
  test.use(desktop);

  test('AC-32: fifty scroll events cost no more work than one', async ({ page }) => {
    await page.addInitScript(installQuerySelectorAllCounter, QSA_COUNTER_KEY);
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(SCROLL_IDLE_MS);

    const { c1, c50 } = await page.evaluate(measureScrollWork, QSA_COUNTER_KEY);

    expect(c50, `querySelectorAll calls: c1 = ${c1}, c50 = ${c50}`).toBeLessThanOrEqual(c1);
  });

  test('AC-33: the active-nav highlight still follows the section in view', async ({ page }) => {
    await page.goto('/');
    await scrollServicesToTop(page);

    const activeItems = page.locator('.nav-menu li.active');
    await expect(activeItems).toHaveCount(1);
    await expect(activeItems.locator('a[href="#services"]')).toHaveCount(1);
  });

  test('AC-34: back-to-top visibility still switches at 100 px', async ({ page }) => {
    await page.goto('/');
    const backToTop = page.locator('.back-to-top');

    await scrollWindowTo(page, 50);
    await expect(backToTop).toBeHidden();

    await scrollWindowTo(page, 150);
    await expect(backToTop).toBeVisible();
  });

  test("AC-54: the current section's nav link is marked current", async ({ page }) => {
    await page.goto('/');
    await scrollServicesToTop(page);

    await expect(page.locator('.nav-menu a[href="#services"]')).toHaveAttribute(
      'aria-current',
      /^(true|location)$/
    );
    await expect(
      page.locator('.nav-menu a:not([href="#services"])[aria-current]:not([aria-current="false"])')
    ).toHaveCount(0);
  });
});
