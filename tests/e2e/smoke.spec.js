/**
 * The smoke baseline in Bootstrap 5 form (spec stabilize-and-cleanup, WI-8, AC-89).
 *
 * One test per bootstrap6-analysis §6 row, and each title starts with its row name,
 * so AC-89's `--list` check, and AC-91 and AC-92's mutation runs, find them. The
 * `pageErrors` fixture also asserts, after every test, that no `pageerror` fired.
 *
 * Viewports and selectors follow the AC Conventions. Waits are web-first; the only
 * fixed delays are the ones the ACs fix: the full visit's scroll steps, the 1 s
 * portfolio settle and the 3 s mock delay of `Abort on close`.
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';
import {
  CONTACT_FIELDS,
  CONTACT_MODAL,
  CONTACT_MODAL_BUTTON,
  armModalEvent,
  fillContactForm,
  mockWeb3Forms,
  openContactModal,
} from './helpers/contact-modal.js';
import { fullVisit } from './helpers/full-visit.js';
import {
  FILTER_ITEM_SETS,
  ITEM_NUMBERS,
  LIGHTBOX,
  expectShownItems,
  lightboxImageWidth,
  openLightboxFrom,
  portfolioFilter,
  portfolioItem,
  waitForPortfolioGrid,
} from './helpers/portfolio.js';

/**
 * The mobile-nav toggle. Today's markup has a second, overlapping one inside
 * `#header`, which WI-30 deletes (AC-19); this is the one that stays.
 */
const MOBILE_NAV_TOGGLE = 'body > .mobile-nav-toggle';

/** Heights for the AC rows that fix only a width. */
const LAYOUT_HEIGHT = desktop.viewport.height;

/** The settle `Portfolio filter` waits after each filter change (WI-8). */
const PORTFOLIO_SETTLE_MS = 1_000;

/** The delay `Abort on close` gives the Web3Forms mock (AC-89). */
const ABORT_MOCK_DELAY_MS = 3_000;

/**
 * The time budget of the two tests that walk many steps with fixed settles: the
 * full visit, and four filters with a 1 s settle and a lightbox round trip each.
 * They take 8 to 25 s with 13 workers on one host, against the 30 s default.
 */
const LONG_WALK_TIMEOUT_MS = 60_000;

/** The left edge of a locator's box, polled because `#header` slides with a transition. */
function boxX(locator) {
  return async () => (await locator.boundingBox())?.x;
}

/** The layout top of each element, unaffected by ScrollReveal's entrance transforms. */
function offsetTops(locator) {
  return () => locator.evaluateAll((elements) => elements.map((element) => element.offsetTop));
}

/** How many of the tops share the first one. */
function countInFirstRow(tops) {
  return tops.filter((top) => top === tops[0]).length;
}

test.use(desktop);

test('Layout: the sidebar docks at 1200 px and slides off below it', async ({ page }) => {
  const toggle = page.locator(MOBILE_NAV_TOGGLE);
  const header = page.locator('#header');
  const main = page.locator('#main');

  await page.setViewportSize({ width: 1199, height: LAYOUT_HEIGHT });
  await page.goto('/');
  await expect(toggle).toBeVisible();
  await expect.poll(boxX(header)).toBeLessThan(0);
  await expect(main).toHaveCSS('margin-left', '0px');

  await page.setViewportSize({ width: 1200, height: LAYOUT_HEIGHT });
  await expect(toggle).toBeHidden();
  await expect.poll(boxX(header)).toBe(0);
  await expect(main).toHaveCSS('margin-left', '300px');
});

test.describe('at small', () => {
  test.use(small);

  test('Mobile nav: the toggle opens the sidebar, and an outside click or a nav link closes it', async ({
    page,
  }) => {
    const body = page.locator('body');
    const toggle = page.locator(MOBILE_NAV_TOGGLE);
    const header = page.locator('#header');
    const viewportWidth = small.viewport.width;

    await page.goto('/');

    await toggle.click();
    await expect(body).toHaveClass(/(^|\s)mobile-nav-active(\s|$)/);
    await expect(header).toBeInViewport({ ratio: 1 });

    // Right of the 300 px sidebar and below the toggle: plain hero background.
    await page.locator('#hero').click({ position: { x: viewportWidth - 35, y: 400 } });
    await expect(body).not.toHaveClass(/(^|\s)mobile-nav-active(\s|$)/);

    await toggle.click();
    await expect(header).toBeInViewport({ ratio: 1 });
    await header.locator('.nav-menu').getByRole('link', { name: 'Portfolio' }).click();
    await expect(body).not.toHaveClass(/(^|\s)mobile-nav-active(\s|$)/);
    const section = page.locator('#portfolio');
    await expect
      .poll(() => section.evaluate((element) => Math.abs(window.scrollY - element.offsetTop)))
      .toBeLessThanOrEqual(1);
    await expect(section).toBeInViewport();
  });
});

test('Grid: 2 Services cards share the first row at 991 px, and 3 at 992 px', async ({ page }) => {
  const cards = page.locator('.services .icon-box');

  await page.setViewportSize({ width: 991, height: LAYOUT_HEIGHT });
  await page.goto('/');
  await expect.poll(async () => countInFirstRow(await offsetTops(cards)())).toBe(2);

  await page.setViewportSize({ width: 992, height: LAYOUT_HEIGHT });
  await expect.poll(async () => countInFirstRow(await offsetTops(cards)())).toBe(3);
});

test('Dialog open: the contact button shows a modal dialog', async ({ page }) => {
  const modal = page.locator(CONTACT_MODAL);

  await page.goto('/');
  await page.locator(CONTACT_MODAL_BUTTON).click();

  await expect(modal).toHaveClass(/(^|\s)show(\s|$)/);
  await expect(modal).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('body')).toHaveClass(/(^|\s)modal-open(\s|$)/);
});

test('Dialog keyboard: Tab stays in the dialog, and Escape closes it and restores focus', async ({
  page,
}) => {
  const modal = page.locator(CONTACT_MODAL);

  await page.goto('/');
  await openContactModal(page);

  for (let press = 0; press < 10; press += 1) {
    await page.keyboard.press('Tab');
  }
  await expect
    .poll(() => modal.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(page.locator(CONTACT_MODAL_BUTTON)).toBeFocused();
});

test('Dialog dismiss: the dismiss button and a backdrop click each close the dialog', async ({
  page,
}) => {
  const modal = page.locator(CONTACT_MODAL);

  await page.goto('/');
  await openContactModal(page);
  let hidden = await armModalEvent(page, 'hidden.bs.modal');
  await modal.locator('[data-bs-dismiss="modal"]').click();
  await expect(modal).toBeHidden();
  await hidden();

  await openContactModal(page);
  const dialogBox = await modal.locator('.modal-content').boundingBox();
  const headerBox = await page.locator('#header').boundingBox();
  const point = { x: desktop.viewport.width - 10, y: desktop.viewport.height / 2 };
  const isInside = (box) =>
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height;
  expect(isInside(dialogBox), 'the backdrop click lands outside the dialog box').toBe(false);
  expect(isInside(headerBox), 'the backdrop click lands outside #header').toBe(false);

  hidden = await armModalEvent(page, 'hidden.bs.modal');
  await modal.click({ position: point });
  await expect(modal).toBeHidden();
  await hidden();
});

test('Submit, success: a successful response shows the sent message', async ({ page }) => {
  await mockWeb3Forms(page, { success: true });
  await page.goto('/');
  await openContactModal(page);
  await fillContactForm(page);

  await page.locator('#submit-btn').click();

  await expect(page.locator('#sent-message')).toBeVisible();
});

test('Submit, error: a failed response shows its message', async ({ page }) => {
  await mockWeb3Forms(page, { success: false, message: 'x' });
  await page.goto('/');
  await openContactModal(page);
  await fillContactForm(page);

  await page.locator('#submit-btn').click();

  const errorMessage = page.locator('#error-message');
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toHaveText('x');
});

test('Abort on close: closing the dialog mid-submit resets the form', async ({ page }) => {
  const mock = await mockWeb3Forms(page, { success: true }, { delayMs: ABORT_MOCK_DELAY_MS });
  await page.goto('/');
  await openContactModal(page);
  await fillContactForm(page);
  const submitButton = page.locator('#submit-btn');
  const defaultText = (await submitButton.textContent()).trim();

  // Submit with Enter from a field, so focus stays inside the dialog, where
  // Bootstrap listens for Escape. Clicking the button would disable it and drop
  // focus to <body>, where today's page ignores Escape.
  const submitted = page.waitForRequest('https://api.web3forms.com/**');
  await page.locator('#subject').press('Enter');
  await submitted;
  await expect(submitButton).toBeDisabled();

  const hidden = await armModalEvent(page, 'hidden.bs.modal');
  await page.keyboard.press('Escape');
  await hidden();
  // The dialog closed while the request was still in flight, not after the answer.
  expect(mock.answered(), 'the mock had not answered when the dialog closed').toBe(0);

  for (const { selector } of CONTACT_FIELDS) {
    await expect(page.locator(selector)).toHaveValue('');
  }
  await expect(submitButton).toBeEnabled();
  await expect(submitButton).toHaveText(defaultText);

  // The delayed mock answers an aborted request after the test is done.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('Color scheme: a dark preference leaves the page background white', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('Console: a full visit raises no page error', async ({ page, pageErrors }) => {
  test.setTimeout(LONG_WALK_TIMEOUT_MS);
  await fullVisit(page);

  expect(pageErrors, 'Uncaught page errors during the full visit').toEqual([]);
});

for (const [viewportName, viewport] of Object.entries({ desktop, small })) {
  test.describe(`at ${viewportName}`, () => {
    test.use(viewport);

    test(`Portfolio filter at ${viewportName}: each filter shows exactly its items`, async ({
      page,
    }) => {
      test.setTimeout(LONG_WALK_TIMEOUT_MS);
      await page.goto('/');
      // The shipped Muuri layout (C-32): items are positioned only once the grid is ready.
      await waitForPortfolioGrid(page);
      for (const n of ITEM_NUMBERS) {
        await expect(portfolioItem(page, n), `item ${n} is identified once`).toHaveCount(1);
      }

      for (const [filterName, shownItems] of Object.entries(FILTER_ITEM_SETS)) {
        await test.step(`filter ${filterName}`, async () => {
          await portfolioFilter(page, filterName).click();
          await page.waitForTimeout(PORTFOLIO_SETTLE_MS);

          await expectShownItems(page, shownItems, filterName);

          await expect
            .poll(() =>
              page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
              )
            )
            .toBeLessThanOrEqual(0);

          await openLightboxFrom(portfolioItem(page, shownItems[0]));
          await expect.poll(() => lightboxImageWidth(page)).toBeGreaterThan(0);
          await page.keyboard.press('Escape');
          await expect(page.locator(LIGHTBOX)).toHaveCount(0);
        });
      }
    });
  });
}
