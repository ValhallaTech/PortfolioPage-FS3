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
 * portfolio and grid settles, the 3 s mock delay of `Abort on close` and the 5 s
 * persistence wait of `Submit, success` (AC-14).
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
  submitButton,
} from './helpers/contact-modal.js';
import { measureContrast, parseCssColor } from './helpers/contrast.js';
import { focusBody, hasFocusIndicator, readFocusStyle, tabUntil } from './helpers/tab-walk.js';
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

/** A phone in landscape: shorter than the open dialog (PR-1 code review). */
const SHORT_VIEWPORT = Object.freeze({ width: 667, height: 375 });

/** The success text (AC-14) and how long it must stay shown after it appears. */
const SENT_TEXT = 'Your message has been sent. Thank you!';
const SENT_PERSIST_MS = 5_000;

/** The four fields by label text, with the autofill hint each carries (AC-17, AC-18). */
const FIELDS = Object.freeze([
  { label: 'Your Name', autocomplete: 'name' },
  { label: 'Your Email', autocomplete: 'email' },
  { label: 'Subject', autocomplete: 'off' },
  { label: 'Message', autocomplete: 'off' },
]);

/** The smallest label box AC-17 accepts; `.visually-hidden` gives 1 × 1. */
const MIN_LABEL_PX = 10;

/** WCAG thresholds (sprint 1 R-30, AC-45): text, and UI components such as a focus ring. */
const TEXT_CONTRAST = 4.5;
const UI_CONTRAST = 3;

/** The 44 px target size (AC-36, sprint 1 C-33). */
const MIN_TARGET_PX = 44;

/**
 * The two buttons AC-19 to AC-21 and AC-36 measure: how to find each, whether it is
 * measured in the shown dialog, and the selector `tabUntil` stops on.
 */
const BUTTONS = Object.freeze([
  {
    name: 'contact button',
    locate: contactButton,
    inDialog: false,
    focusTarget: CONTACT_MODAL_BUTTON,
  },
  { name: 'submit button', locate: submitButton, inDialog: true, focusTarget: '#submit-btn' },
]);

/** A point where the pointer hovers nothing the tests measure: the sidebar, or the backdrop. */
const POINTER_PARKING = Object.freeze({ x: 5, y: 5 });

/** The viewports `Page end` checks: small, below the sidebar dock, and desktop. */
const PAGE_END_VIEWPORTS = Object.freeze([
  small.viewport,
  { width: 1200, height: LAYOUT_HEIGHT },
  desktop.viewport,
]);

/** How far the scroll height may run past the last content, for subpixel rounding. */
const PAGE_END_TOLERANCE_PX = 2;

/** The most Tab presses from `body` to the contact button, and from inside the dialog. */
const MAX_TABS_TO_BUTTON = 120;

/** The left edge of a locator's box, polled because `#header` slides with a transition. */
function boxX(locator) {
  return async () => (await locator.boundingBox())?.x;
}

/** Whether the dialog is in the top layer as a modal (AC Conventions: dialog shown/closed). */
function isModal(dialog) {
  return () => dialog.evaluate((element) => element.matches(':modal'));
}

/**
 * An element's box without its own reveal translation, at subpixel precision: the
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

/** The layout top of each element, unaffected by the reveals' entrance transforms. */
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

test('Submit, success: a successful response is announced and stays shown', async ({ page }) => {
  await mockWeb3Forms(page, { success: true });
  await page.goto('/');
  await openContactModal(page);
  await fillContactForm(page);
  const dialog = contactDialog(page);
  const status = dialog.getByRole('status');
  // AC-14: one status region, in the accessibility tree before anything is sent.
  await expect(status, 'status regions in the dialog before the submit').toHaveCount(1);

  await submitButton(page).click();

  await expect(status).toHaveText(SENT_TEXT);
  await expect(status).toBeVisible();

  // 4.0.0 closed the dialog 2 s after a success; the result now stays until it is closed.
  await page.waitForTimeout(SENT_PERSIST_MS);
  await expect(status).toHaveText(SENT_TEXT);
  await expect(status).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect.poll(isModal(dialog), 'the dialog is still shown as a modal').toBe(true);
});

test('Submit, error: a failed response is announced as an alert', async ({ page }) => {
  await mockWeb3Forms(page, { success: false, message: 'x' });
  await page.goto('/');
  await openContactModal(page);
  await fillContactForm(page);
  const alert = contactDialog(page).getByRole('alert');
  // AC-15: one alert region before the submit.
  await expect(alert, 'alert regions in the dialog before the submit').toHaveCount(1);

  await submitButton(page).click();

  await expect(alert).toBeVisible();
  await expect(alert).toHaveText('x');
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
      first: (page) => page.locator('#about .row > [data-reveal="from-right"]'),
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

test('Short viewport: the submit button can be scrolled to and clicked at 667×375', async ({
  page,
}) => {
  await page.setViewportSize(SHORT_VIEWPORT);
  await mockWeb3Forms(page, { success: true });
  await page.goto('/');
  await openContactModal(page);
  await fillContactForm(page);
  const submit = submitButton(page);

  // Scroll it into view as a visitor would, through whatever scroll container the page has.
  await submit.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  await expect(submit, 'the submit button is fully inside the viewport').toBeInViewport({
    ratio: 1,
  });
  expect(
    await submit.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return element.contains(hit);
    }),
    'a click at the center of the submit button lands on it'
  ).toBe(true);

  await submit.click();
  await expect(page.locator('#sent-message'), 'the mocked submission succeeded').toBeVisible();
});

/**
 * Brings an element into view if it is outside it, and waits until it and its ancestors
 * are at rest: no running animation or transition, and every reveal target among
 * them revealed (sprint 1 AC-45's settle).
 *
 * @param {import('@playwright/test').Locator} locator
 */
async function settle(locator) {
  await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const inView =
      box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    if (!inView) element.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await expect
    .poll(
      () =>
        locator.evaluate((element) => {
          const chain = [];
          for (let node = element; node; node = node.parentElement) chain.push(node);
          const animating = chain.some((node) =>
            node.getAnimations().some((animation) => animation.playState === 'running')
          );
          const unrevealed = chain.some(
            (node) => node.matches('[data-reveal]') && getComputedStyle(node).opacity !== '1'
          );
          return !animating && !unrevealed;
        }),
      { message: 'the element and its ancestors are revealed and not animating' }
    )
    .toBe(true);
}

/**
 * Loads the page and makes `button` measurable: the contact button scrolled into view
 * and settled, the submit button in the shown dialog. The pointer is parked away.
 *
 * @param {import('@playwright/test').Page} page
 * @param {(typeof BUTTONS)[number]} button
 * @returns {Promise<import('@playwright/test').Locator>} The button.
 */
async function showButton(page, button) {
  await page.goto('/');
  if (button.inDialog) await openContactModal(page);
  const locator = button.locate(page);
  await settle(locator);
  await page.mouse.move(POINTER_PARKING.x, POINTER_PARKING.y);
  await settle(locator);
  return locator;
}

/**
 * Focuses `button` by pressing Tab from `body`, so `:focus-visible` applies, and waits
 * for any focus transition to end.
 *
 * @param {import('@playwright/test').Page} page
 * @param {(typeof BUTTONS)[number]} button
 */
async function focusByKeyboard(page, button) {
  await focusBody(page);
  const presses = await tabUntil(page, button.focusTarget, MAX_TABS_TO_BUTTON);
  expect(presses, `Tab reaches the ${button.name}`).not.toBeNull();
  await settle(button.locate(page));
}

/** The three colors AC-21 compares. */
function readButtonColors(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
    };
  });
}

test('Field errors: invalid fields are marked and described, and nothing is sent', async ({
  page,
}) => {
  const mock = await mockWeb3Forms(page, { success: true });
  await page.goto('/');
  await openContactModal(page);
  const dialog = contactDialog(page);
  const field = (label) => dialog.getByLabel(label, { exact: true });

  // AC-16 (a): every field empty.
  await submitButton(page).click();
  for (const { label } of FIELDS) {
    await expect(field(label), `${label} is marked invalid`).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await expect(field(label), `${label} carries an error description`).toHaveAccessibleDescription(
      /\S/
    );
  }
  expect(mock.answered(), 'requests sent with every field empty').toBe(0);

  // AC-16 (b): filled, except an email address that is not one.
  await fillContactForm(page);
  await field('Your Email').fill('not-an-email');
  await submitButton(page).click();
  await expect(field('Your Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(field('Your Email')).toHaveAccessibleDescription(/\S/);
  for (const { label } of FIELDS.filter(({ label }) => label !== 'Your Email')) {
    await expect(field(label), `${label} is not marked invalid`).not.toHaveAttribute(
      'aria-invalid',
      'true'
    );
  }
  expect(mock.answered(), 'requests sent with an invalid email').toBe(0);
});

for (const [viewportName, viewport] of Object.entries({ desktop, small })) {
  test.describe(`at ${viewportName}`, () => {
    test.use(viewport);

    test(`Field labels at ${viewportName}: each field has its own visible label`, async ({
      page,
    }) => {
      await page.goto('/');
      await openContactModal(page);
      await fillContactForm(page);
      const dialog = contactDialog(page);

      // AC-17.
      for (const { label } of FIELDS) {
        await expect(
          dialog.getByLabel(label, { exact: true }),
          `fields labeled ${label}`
        ).toHaveCount(1);
        const labelElement = dialog.locator('label').filter({ hasText: new RegExp(`^${label}$`) });
        await expect(labelElement).toBeVisible();
        const box = await labelElement.boundingBox();
        expect(box.width, `the ${label} label's width`).toBeGreaterThanOrEqual(MIN_LABEL_PX);
        expect(box.height, `the ${label} label's height`).toBeGreaterThanOrEqual(MIN_LABEL_PX);
      }
    });

    test(`Button size at ${viewportName}: both buttons are at least 44 px tall`, async ({
      page,
    }) => {
      // AC-36.
      for (const button of BUTTONS) {
        const locator = await showButton(page, button);
        const box = await locator.boundingBox();
        expect(box.height, `the ${button.name}'s height`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      }
    });
  });
}

test('Autofill: each field carries its autocomplete hint', async ({ page }) => {
  await page.goto('/');
  await openContactModal(page);
  const dialog = contactDialog(page);

  // AC-18.
  for (const { label, autocomplete } of FIELDS) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveAttribute(
      'autocomplete',
      autocomplete
    );
  }
});

test('Button contrast: both buttons keep 4.5:1 at rest, on hover and on keyboard focus', async ({
  page,
}) => {
  const failures = [];
  const check = async (button, state, locator) => {
    const { ratio, foreground, background } = await measureContrast(locator);
    if (ratio < TEXT_CONTRAST) {
      failures.push(
        `${button.name} ${state}: ${ratio.toFixed(2)} < ${TEXT_CONTRAST} (${foreground} on ${background})`
      );
    }
  };

  // AC-19: 2 buttons × 3 states.
  for (const button of BUTTONS) {
    const locator = await showButton(page, button);
    await check(button, 'at rest', locator);

    await locator.hover();
    await settle(locator);
    await check(button, 'hovered', locator);

    await page.mouse.move(POINTER_PARKING.x, POINTER_PARKING.y);
    await focusByKeyboard(page, button);
    await check(button, 'focused by keyboard', locator);
  }

  expect(failures, 'button states below 4.5:1').toEqual([]);
});

test('Button focus ring: Tab draws a 3:1 indicator on both buttons', async ({ page }) => {
  // AC-20.
  for (const button of BUTTONS) {
    const locator = await showButton(page, button);
    await focusByKeyboard(page, button);

    const focusStyle = await locator.evaluate(readFocusStyle);
    expect(
      hasFocusIndicator(focusStyle),
      `${button.name} focus style ${JSON.stringify(focusStyle)}`
    ).toBe(true);
    const outlineDrawn =
      focusStyle.outlineStyle !== 'none' && Number.parseFloat(focusStyle.outlineWidth) >= 1;
    const { ratio, foreground, background } = await measureContrast(locator, {
      foreground: outlineDrawn ? 'outline-color' : 'box-shadow',
      backgroundFrom: 'parent',
    });
    expect(
      ratio,
      `${button.name} indicator ${foreground} on its parent's ${background}`
    ).toBeGreaterThanOrEqual(UI_CONTRAST);
  }
});

test('Button hover: both buttons change color on hover', async ({ page }) => {
  // AC-21.
  for (const button of BUTTONS) {
    const locator = await showButton(page, button);
    const rest = await readButtonColors(locator);

    await locator.hover();
    await settle(locator);
    const hover = await readButtonColors(locator);

    expect(hover, `${button.name}: background, color or border color changes on hover`).not.toEqual(
      rest
    );
  }
});

/**
 * How far the document scrolls past its last real content: the later of the `#main` and
 * `#footer` bottoms, in document coordinates. Read at the top of the page, where a fixed
 * `#footer` ends at the viewport's bottom.
 *
 * @param {import('@playwright/test').Page} page
 */
function overscrollPastContent(page) {
  return page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const bottom = (selector) =>
      document.querySelector(selector).getBoundingClientRect().bottom + window.scrollY;
    const contentEnd = Math.max(bottom('#main'), bottom('#footer'));
    return document.documentElement.scrollHeight - contentEnd;
  });
}

test('Page end: the page ends at its content, with the dialog closed and after closing it', async ({
  page,
}) => {
  // PR-4 U-1a: a closed <dialog> that takes layout space adds blank page below the content.
  for (const viewport of PAGE_END_VIEWPORTS) {
    await test.step(`at ${viewport.width} × ${viewport.height}`, async () => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      expect(
        await overscrollPastContent(page),
        `px of page past the content at ${viewport.width} px, dialog never opened`
      ).toBeLessThanOrEqual(PAGE_END_TOLERANCE_PX);

      await openContactModal(page);
      const hidden = await armModalEvent(page, 'hidden.bs.dialog');
      await page.keyboard.press('Escape');
      await hidden();
      expect(
        await overscrollPastContent(page),
        `px of page past the content at ${viewport.width} px, after the dialog closed`
      ).toBeLessThanOrEqual(PAGE_END_TOLERANCE_PX);
    });
  }
});

/**
 * What paints the scrollbar gutter while an overlay is open (PR-4 U-1b). Headless Chromium
 * hides scrollbars, so the gutter itself never shows here; this reads the styles that
 * decide its color instead.
 *
 * - `gutter`: the canvas background, and so the stable gutter's: the root's, or the body's
 *   when the root's is transparent.
 * - `scrollbarGutter`: the root keeps `stable`, so opening an overlay shifts nothing.
 * - `bodyRight`: the body's right margin and padding, which must not make up for a
 *   scrollbar the stable gutter already replaces.
 *
 * @param {import('@playwright/test').Page} page
 */
function readGutterPaint(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      // CSS propagates the body's background to the canvas when the root's is transparent.
      gutter:
        root.backgroundColor === 'rgba(0, 0, 0, 0)' ? body.backgroundColor : root.backgroundColor,
      scrollbarGutter: root.scrollbarGutter,
      bodyRight: { margin: body.marginRight, padding: body.paddingRight },
    };
  });
}

/**
 * Asserts the gutter paint while an overlay of color `overlayColor` is open.
 *
 * @param {Awaited<ReturnType<typeof readGutterPaint>>} paint
 * @param {string} overlayColor The overlay's computed `background-color`.
 * @param {string} label
 */
function expectGutterFilled(paint, overlayColor, label) {
  const gutter = parseCssColor(paint.gutter);
  const overlay = parseCssColor(overlayColor);
  expect(
    {
      r: Math.round(gutter.r),
      g: Math.round(gutter.g),
      b: Math.round(gutter.b),
      a: Number(gutter.a.toFixed(2)),
    },
    `${label}: the gutter's paint (${paint.gutter}) is the overlay's color (${overlayColor})`
  ).toEqual({
    r: Math.round(overlay.r),
    g: Math.round(overlay.g),
    b: Math.round(overlay.b),
    a: Number(overlay.a.toFixed(2)),
  });
  expect(paint.scrollbarGutter, `${label}: the root's scrollbar-gutter`).toBe('stable');
  expect(paint.bodyRight, `${label}: the body's right margin and padding`).toEqual({
    margin: '0px',
    padding: '0px',
  });
}

test('Overlay gutter: the open dialog fills the scrollbar gutter with its backdrop color', async ({
  page,
}) => {
  await page.goto('/');
  await openContactModal(page);
  const dialog = page.locator(CONTACT_MODAL);
  // `shown.bs.dialog` can fire while the ::backdrop's background-color transition is still
  // running, so the backdrop's final color is read only once every transition on the
  // dialog, its ::backdrop included, has finished.
  await expect
    .poll(
      () =>
        dialog.evaluate((element) =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect?.target === element && animation.playState === 'running'
            )
            .map(
              (animation) =>
                `${animation.effect.pseudoElement ?? ''} ${animation.transitionProperty ?? animation.animationName ?? ''}`
            )
        ),
      { message: 'the dialog and its ::backdrop have finished transitioning' }
    )
    .toEqual([]);
  const backdrop = await dialog.evaluate(
    (element) => getComputedStyle(element, '::backdrop').backgroundColor
  );

  expectGutterFilled(await readGutterPaint(page), backdrop, 'dialog open');
});

for (const [viewportName, viewport] of Object.entries({ desktop, small })) {
  test.describe(`at ${viewportName}`, () => {
    test.use(viewport);

    test(`Overlay gutter at ${viewportName}: the open lightbox fills the scrollbar gutter with its overlay color`, async ({
      page,
    }) => {
      await page.goto('/');
      await waitForPortfolioGrid(page);
      await openLightboxFrom(portfolioItem(page, 1));
      const overlay = page.locator(`${LIGHTBOX} .goverlay`);
      await expect(overlay).toBeVisible();

      expectGutterFilled(
        await readGutterPaint(page),
        await overlay.evaluate((element) => getComputedStyle(element).backgroundColor),
        `lightbox open at ${viewportName}`
      );
    });
  });
}
