/**
 * The smoke baseline, re-aimed at Bootstrap 6 (spec stabilize-and-cleanup WI-8, AC-89;
 * spec bootstrap-6-upgrade WI-2).
 *
 * One test per bootstrap6-analysis §6 row, and each title starts with its row name,
 * so AC-89's `--list` check, and AC-28 and AC-29's mutation runs, find them. The
 * `pageErrors` fixture also asserts, after every test, that no `pageerror` fired.
 * Only the rows bootstrap-6-upgrade §2.3 lists as "changed on purpose" changed; the
 * tests after the §6 rows are its new layout and dialog ACs.
 *
 * Title rule (§3.7): exactly one title in the smoke run contains `Layout`, one contains
 * `Dialog open` and one contains `Grid:`, because `expectOnlyTargetBroken` needs one match.
 *
 * Viewports and selectors follow the AC Conventions. Waits are web-first; the only
 * fixed delays are the ones the ACs fix: the full visit's scroll steps, the 1 s
 * portfolio and grid settles and the 3 s mock delay of `Abort on close`.
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';
import {
  CONTACT_FIELDS,
  CONTACT_MODAL,
  CONTACT_MODAL_BUTTON,
  armModalEvent,
  contactButton,
  contactDialog,
  fillContactForm,
  mockWeb3Forms,
  openContactModal,
} from './helpers/contact-modal.js';
import { fullVisit, scrollToBottomInSteps } from './helpers/full-visit.js';
import {
  FILTER_ITEM_SETS,
  ITEM_NUMBERS,
  LIGHTBOX,
  PORTFOLIO_ITEM,
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

/** The §6 widths (bootstrap-6-upgrade AC Conventions), each loaded at `LAYOUT_HEIGHT`. */
const SECTION_6_WIDTHS = Object.freeze([375, 767, 768, 1000, 1023, 1024, 1200, 1279, 1280, 1440]);

/** Bootstrap 6's `xl` width, where the sidebar docks (AC-4, AC-5). */
const SIDEBAR_DOCK_WIDTH = 1280;

/** Bootstrap 6's `lg` width, where the grids switch (AC-6). */
const GRID_SWITCH_WIDTH = 1024;

/** The settle AC-6 row 2 allows after each resize, for Muuri's relayout. */
const GRID_SETTLE_MS = 1_000;

/** The budget of the tests that load the page once per §6 width. */
const WIDTH_WALK_TIMEOUT_MS = 120_000;

/** The dialog's title (AC-12). */
const DIALOG_TITLE = 'Send Me a Message';

/** The left edge of a locator's box, polled because `#header` slides with a transition. */
function boxX(locator) {
  return async () => (await locator.boundingBox())?.x;
}

/** Whether the dialog is in the top layer as a modal (AC Conventions: dialog shown/closed). */
function isModal(dialog) {
  return () => dialog.evaluate((element) => element.matches(':modal'));
}

/**
 * An element's box without its own ScrollReveal translation, at subpixel precision: the
 * entrance transforms move a column until it is revealed, and rounded offsets can put
 * two adjacent columns 1 px apart. Both columns of a pair share every ancestor's
 * transform, so comparing them is unaffected by those.
 */
function layoutBox(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const transform = getComputedStyle(element).transform;
    const { m41: dx, m42: dy } = new DOMMatrixReadOnly(transform === 'none' ? '' : transform);
    return {
      left: rect.left - dx,
      top: rect.top - dy,
      right: rect.right - dx,
      bottom: rect.bottom - dy,
    };
  });
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

test('Layout: the sidebar docks at 1280 px and slides off below it', async ({ page }) => {
  const toggle = page.locator(MOBILE_NAV_TOGGLE);
  const header = page.locator('#header');
  const main = page.locator('#main');
  const hero = page.locator('#hero');
  const footer = page.locator('#footer');
  // Full-bleed is measured against the root's layout width. Bootstrap 6 sets
  // `scrollbar-gutter: stable` on <html>, and with a classic scrollbar Chromium then
  // reports a `documentElement.clientWidth` that includes the gutter (observed on
  // Windows). Without a classic scrollbar, the two widths are equal.
  const rootWidth = () =>
    page.evaluate(() => document.documentElement.getBoundingClientRect().width);

  // AC-4: each width is loaded fresh.
  await page.setViewportSize({ width: SIDEBAR_DOCK_WIDTH - 1, height: LAYOUT_HEIGHT });
  await page.goto('/');
  await expect(toggle).toBeVisible();
  await expect.poll(boxX(header)).toBeLessThan(0);
  await expect(main).toHaveCSS('margin-left', '0px');
  await expect.poll(boxX(hero)).toBe(0);
  await expect
    .poll(async () => Math.abs((await hero.boundingBox()).width - (await rootWidth())))
    .toBeLessThanOrEqual(1);
  await expect(footer).toHaveCSS('position', 'static');
  await expect(footer).toHaveCSS('padding-top', '20px');

  await page.setViewportSize({ width: SIDEBAR_DOCK_WIDTH, height: LAYOUT_HEIGHT });
  await page.goto('/');
  await expect(toggle).toBeHidden();
  await expect.poll(boxX(header)).toBe(0);
  await expect(main).toHaveCSS('margin-left', '300px');
  await expect.poll(boxX(hero)).toBe(0);
  await expect
    .poll(async () => Math.abs((await hero.boundingBox()).width - (await rootWidth())))
    .toBeLessThanOrEqual(1);
  await expect(footer).toHaveCSS('position', 'fixed');
  await expect(footer).toHaveCSS('width', '300px');
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

test('Grid: 2 Services cards share the first row at 1023 px, and 3 at 1024 px', async ({
  page,
}) => {
  const cards = page.locator('.services .icon-box');

  // AC-6 row 1: each width is loaded fresh.
  await page.setViewportSize({ width: GRID_SWITCH_WIDTH - 1, height: LAYOUT_HEIGHT });
  await page.goto('/');
  await expect.poll(async () => countInFirstRow(await offsetTops(cards)())).toBe(2);

  await page.setViewportSize({ width: GRID_SWITCH_WIDTH, height: LAYOUT_HEIGHT });
  await page.goto('/');
  await expect.poll(async () => countInFirstRow(await offsetTops(cards)())).toBe(3);
});

test('Dialog open: the contact button shows a modal dialog', async ({ page }) => {
  const dialog = contactDialog(page);

  await page.goto('/');
  await contactButton(page).click();

  // AC-9: "dialog shown".
  await expect(dialog).toBeVisible();
  await expect.poll(isModal(dialog)).toBe(true);
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

  // AC-10: the reverse sequence stays inside too.
  for (let press = 0; press < 10; press += 1) {
    await page.keyboard.press('Shift+Tab');
  }
  await expect
    .poll(() => modal.evaluate((element) => element.contains(document.activeElement)), {
      message: 'focus after 10 Shift+Tab presses',
    })
    .toBe(true);

  // AC-11 path 1: Escape from the "Your Name" field.
  await modal.getByLabel('Your Name').focus();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect.poll(isModal(modal), 'the dialog left the top layer').toBe(false);
  await expect(page.locator(CONTACT_MODAL_BUTTON)).toBeFocused();
});

test('Dialog dismiss: the close button and a backdrop click each close the dialog', async ({
  page,
}) => {
  const dialog = contactDialog(page);
  const button = contactButton(page);

  await page.goto('/');

  // AC-11 path 2: the close button.
  await openContactModal(page);
  let hidden = await armModalEvent(page, 'hidden.bs.dialog');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await hidden();
  await expect(dialog).toBeHidden();
  await expect.poll(isModal(dialog)).toBe(false);
  await expect(button).toBeFocused();

  // AC-11 path 3: a click on the viewport at (5, 5), outside the dialog's box (§3.4 WI-2).
  await openContactModal(page);
  const dialogBox = await dialog.boundingBox();
  const point = { x: 5, y: 5 };
  const isInside = (box) =>
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height;
  expect(isInside(dialogBox), 'the backdrop click lands outside the dialog box').toBe(false);
  expect(
    await page.evaluate(
      ({ x, y, selector }) => document.elementFromPoint(x, y) === document.querySelector(selector),
      { ...point, selector: CONTACT_MODAL }
    ),
    'the point hits the modal dialog backdrop, not the inert page behind it'
  ).toBe(true);

  hidden = await armModalEvent(page, 'hidden.bs.dialog');
  await page.mouse.click(point.x, point.y);
  await hidden();
  await expect(dialog).toBeHidden();
  await expect.poll(isModal(dialog)).toBe(false);
  await expect(button).toBeFocused();
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

  // Submit with Enter from a field, so focus stays inside the dialog, where the
  // native dialog takes Escape. Clicking the button would disable it and drop
  // focus out of the dialog.
  const submitted = page.waitForRequest('https://api.web3forms.com/**');
  await page.locator('#subject').press('Enter');
  await submitted;
  await expect(submitButton).toBeDisabled();

  // AC-13: "dialog closed", before the mock answers.
  const dialog = contactDialog(page);
  const hidden = await armModalEvent(page, 'hidden.bs.dialog');
  await page.keyboard.press('Escape');
  await hidden();
  // The dialog closed while the request was still in flight, not after the answer.
  expect(mock.answered(), 'the mock had not answered when the dialog closed').toBe(0);
  await expect(dialog).toBeHidden();
  expect(await isModal(dialog)(), 'the dialog left the top layer').toBe(false);

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

test('Widths: no page error and no sideways scroll at any §6 width', async ({
  page,
  pageErrors,
}) => {
  test.setTimeout(WIDTH_WALK_TIMEOUT_MS);
  for (const width of SECTION_6_WIDTHS) {
    await test.step(`at ${width} px`, async () => {
      await page.setViewportSize({ width, height: LAYOUT_HEIGHT });
      await page.goto('/');
      await scrollToBottomInSteps(page);

      // AC-2.
      expect(pageErrors, `page errors at ${width} px`).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        ),
        `horizontal overflow at ${width} px`
      ).toBeLessThanOrEqual(0);
    });
  }
});

test('Sidebar or menu button: exactly one of them shows at every §6 width', async ({ page }) => {
  test.setTimeout(WIDTH_WALK_TIMEOUT_MS);
  const toggle = page.locator(MOBILE_NAV_TOGGLE);
  const header = page.locator('#header');
  const body = page.locator('body');

  for (const width of SECTION_6_WIDTHS) {
    await test.step(`at ${width} px`, async () => {
      await page.setViewportSize({ width, height: LAYOUT_HEIGHT });
      await page.goto('/');
      const expectMenuButton = width < SIDEBAR_DOCK_WIDTH;

      // AC-5: polled, because #header slides with a transition.
      const state = async () => {
        const menuButtonVisible = await toggle.isVisible();
        const navOpen = await body.evaluate((element) =>
          element.classList.contains('mobile-nav-active')
        );
        const sidebarDocked = (await header.boundingBox())?.x === 0 && !navOpen;
        return {
          menuButtonVisible,
          sidebarDocked,
          exactlyOne: menuButtonVisible !== sidebarDocked,
        };
      };
      await expect.poll(state, { message: `sidebar and menu button at ${width} px` }).toEqual({
        menuButtonVisible: expectMenuButton,
        sidebarDocked: !expectMenuButton,
        exactlyOne: true,
      });
    });
  }
});

test.describe('the 1024 px column switch', () => {
  test('Portfolio: 2 items share the first row at 1023 px, and 3 at 1024 px, after a resize', async ({
    page,
  }) => {
    // AC-6 row 2: one load at 1440 px, then resizes that Muuri relays out.
    await page.setViewportSize({ width: desktop.viewport.width, height: LAYOUT_HEIGHT });
    await page.goto('/');
    await waitForPortfolioGrid(page);
    const items = page.locator(PORTFOLIO_ITEM).filter({ visible: true });
    const inFirstRow = () =>
      items.evaluateAll((elements) => {
        const tops = elements.map((element) => element.getBoundingClientRect().y);
        return tops.filter((top) => Math.abs(top - tops[0]) <= 1).length;
      });

    await page.setViewportSize({ width: GRID_SWITCH_WIDTH - 1, height: LAYOUT_HEIGHT });
    await page.waitForTimeout(GRID_SETTLE_MS);
    expect(await inFirstRow(), 'portfolio items in the first row at 1023 px').toBe(2);

    await page.setViewportSize({ width: GRID_SWITCH_WIDTH, height: LAYOUT_HEIGHT });
    await page.waitForTimeout(GRID_SETTLE_MS);
    expect(await inFirstRow(), 'portfolio items in the first row at 1024 px').toBe(3);
  });

  /** AC-6 rows 3 and 4: each pair's two columns, in source order. */
  const COLUMN_PAIRS = Object.freeze([
    {
      name: 'About text and photo',
      first: (page) => page.locator('#about .row > [data-sr="fade-right"]'),
      second: (page) => page.locator('#about .row > .content'),
    },
    {
      name: 'Contact call-to-action and info',
      first: (page) => page.locator('#contact .info').locator('xpath=..'),
      second: (page) => page.locator('#contact .contact-cta').locator('xpath=..'),
    },
  ]);

  for (const { name, first, second } of COLUMN_PAIRS) {
    test(`${name}: stacked at 1023 px, side by side at 1024 px`, async ({ page }) => {
      await page.setViewportSize({ width: GRID_SWITCH_WIDTH - 1, height: LAYOUT_HEIGHT });
      await page.goto('/');
      let [before, after] = [await layoutBox(first(page)), await layoutBox(second(page))];
      expect(
        after.top,
        `${name} at 1023 px: the second block starts below the first`
      ).toBeGreaterThanOrEqual(before.bottom);

      await page.setViewportSize({ width: GRID_SWITCH_WIDTH, height: LAYOUT_HEIGHT });
      await page.goto('/');
      [before, after] = [await layoutBox(first(page)), await layoutBox(second(page))];
      expect(
        after.left,
        `${name} at 1024 px: the second block starts right of the first`
      ).toBeGreaterThanOrEqual(before.right);
    });
  }
});

test('Dark preference: the page and the open dialog keep their light colors', async ({ page }) => {
  const dialog = contactDialog(page);
  const elements = Object.freeze({
    body: page.locator('body'),
    '#about': page.locator('#about'),
    '#services': page.locator('#services'),
    '#contact': page.locator('#contact'),
    dialog,
    '"Your Name" field': dialog.getByLabel('Your Name'),
  });
  const map = page.locator('#contact iframe.contact-map');

  /** Each element's computed color, and its backgrounds up to the first opaque one. */
  const readColors = async () => {
    const colors = {};
    for (const [name, locator] of Object.entries(elements)) {
      colors[name] = await locator.evaluate((element) => {
        const backgrounds = [];
        for (let node = element; node; node = node.parentElement) {
          const background = getComputedStyle(node).backgroundColor;
          if (background === 'rgba(0, 0, 0, 0)' || background === 'transparent') continue;
          backgrounds.push(background);
          if (!/rgba|\//.test(background)) break;
        }
        return { color: getComputedStyle(element).color, backgrounds };
      });
    }
    return colors;
  };

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await openContactModal(page);
  const light = await readColors();

  // AC-8.
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await readColors();
  const differences = Object.keys(light)
    .filter((name) => JSON.stringify(light[name]) !== JSON.stringify(dark[name]))
    .map((name) => ({ name, light: light[name], dark: dark[name] }));
  expect(differences, 'elements whose color or effective background differ under dark').toEqual([]);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(map).toHaveCSS('color-scheme', 'light');
});

test('Dialog title: one level-2 heading names the dialog, at 20 px', async ({ page }) => {
  const dialog = contactDialog(page);

  await page.goto('/');
  await openContactModal(page);

  // AC-12.
  const heading = dialog.getByRole('heading', { level: 2, name: DIALOG_TITLE });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveCSS('font-size', '20px');
});
