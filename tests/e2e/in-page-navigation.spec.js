/**
 * Focus and scrolling after in-page navigation (spec gsap-animations AC-31, AC-33 to AC-36):
 * a nav link or a hash on load puts focus at its section, a hash that names nothing or a
 * hidden element is ignored, and with motion allowed the navigation still glides.
 *
 * These checks hold no tight frame-timing bound, so they run in the main `chromium`
 * project. A glide needs only one frame between the first and last `scrollY`.
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';
import { isGlide, readEffectiveOpacity, waitUntilAfterLoad } from './helpers/frame-trace.js';
import {
  backToTop,
  describeScroll,
  menuButton,
  navLink,
  scrollToContact,
  traceScrollY,
  waitForScrollToSettle,
} from './helpers/in-page-navigation.js';
import { portfolioFilter } from './helpers/portfolio.js';

/** Both motion modes, set before navigation (Conventions). */
const MOTION_MODES = [
  { label: 'with motion allowed', reducedMotion: 'no-preference' },
  { label: 'under reduced motion', reducedMotion: 'reduce' },
];

/** How long AC-31 and AC-35 wait after `load` before they read the page. */
const AFTER_LOAD_MS = 2_000;

/** A cap on the Tab presses that bring focus to a nav link (AC-33 case 1). */
const MAX_TABS_TO_LINK = 40;

/**
 * Describes `document.activeElement` and says whether it is `selector`'s element or inside
 * it, for the "focus is at the target section" check.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
function focusAt(page, selector) {
  return page.evaluate((sectionSelector) => {
    const element = document.activeElement;
    const id = element?.id ? `#${element.id}` : '';
    return {
      inside: Boolean(element && document.querySelector(sectionSelector)?.contains(element)),
      focused: element ? `${element.tagName.toLowerCase()}${id}` : 'none',
    };
  }, selector);
}

/**
 * Asserts that focus is the section or inside it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function expectFocusAt(page, selector) {
  const focus = await focusAt(page, selector);
  expect(focus.inside, `focus (${focus.focused}) is ${selector} or inside it`).toBe(true);
}

/**
 * Reads, in the page, the first Tab-reachable element that follows the section's start in
 * document order, inside or after it (AC-33 case 2, AC-34), and whether it is the focused
 * element. Tab-reachable: a focusable element with a `tabIndex` of 0 or more, not disabled,
 * rendered and visible, and not inside an inert subtree or a closed dialog.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
function nextTabStopFrom(page, selector) {
  return page.evaluate((sectionSelector) => {
    const section = document.querySelector(sectionSelector);
    const describe = (element) => {
      if (!element) return 'none';
      const id = element.id ? `#${element.id}` : '';
      const href = element.getAttribute('href');
      const label = (element.getAttribute('aria-label') ?? element.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
      return `${element.tagName.toLowerCase()}${id}${href ? `[href="${href}"]` : ''} "${label}"`;
    };
    const focusable =
      'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable="true"]';
    const reachable = (element) =>
      element.tabIndex >= 0 &&
      !element.disabled &&
      !element.closest('[inert]') &&
      !element.closest('dialog:not([open])') &&
      element.checkVisibility({ visibilityProperty: true });
    const expected = [...document.querySelectorAll(focusable)].find(
      (element) =>
        element !== section &&
        section.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING &&
        reachable(element)
    );
    return {
      expected: describe(expected),
      focused: describe(document.activeElement),
      same: Boolean(expected) && expected === document.activeElement,
    };
  }, selector);
}

/**
 * Asserts that the focused element is the first Tab-reachable element after the section's
 * start (AC-33 case 2, AC-34).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function expectFocusOnNextTabStopFrom(page, selector) {
  const stop = await nextTabStopFrom(page, selector);
  expect(stop.focused, `the focused element is the first Tab stop after ${selector}'s start`).toBe(
    stop.expected
  );
  expect(stop.same, `the focused element is that very element (${stop.expected})`).toBe(true);
}

/**
 * Presses Tab until the locator has focus, at most `MAX_TABS_TO_LINK` times.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} locator
 */
async function tabTo(page, locator) {
  for (let presses = 0; presses < MAX_TABS_TO_LINK; presses += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach the locator in ${MAX_TABS_TO_LINK} presses`);
}

/**
 * Loads `path` fresh in the given motion mode.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'reduce' | 'no-preference'} reducedMotion
 * @param {string} [path]
 */
async function loadFresh(page, reducedMotion, path = '/') {
  await page.emulateMedia({ reducedMotion });
  await page.goto(path, { waitUntil: 'load' });
}

for (const { label, reducedMotion } of MOTION_MODES) {
  test.describe(`at desktop ${label}`, () => {
    test.use(desktop);

    test(`AC-31: ${label}, a hash that names the hidden contact dialog does not put focus on it`, async ({
      page,
      pageErrors,
    }) => {
      await loadFresh(page, reducedMotion, '/#contactModal');
      await waitUntilAfterLoad(page, AFTER_LOAD_MS);

      const focused = page.locator(':focus');
      const onBody = await page.evaluate(() => document.activeElement === document.body);
      if (!onBody) {
        expect(
          await readEffectiveOpacity(focused),
          'the effective opacity of the focused element'
        ).toBeGreaterThanOrEqual(0.99);
      }
      expect(pageErrors, 'page errors').toEqual([]);
    });

    test(`AC-33 case 1: ${label}, Enter on the nav link "Portfolio" puts focus at the section, and Tab goes on to "All"`, async ({
      page,
    }) => {
      await loadFresh(page, reducedMotion);
      const link = navLink(page, 'Portfolio');
      await tabTo(page, link);
      await page.keyboard.press('Enter');
      await waitForScrollToSettle(page);

      await expectFocusAt(page, '#portfolio');
      await page.keyboard.press('Tab');
      await expect(portfolioFilter(page, 'All'), 'the filter button "All"').toBeFocused();
    });

    test(`AC-33 case 2: ${label}, a click on the nav link "Services" puts focus at the section, and Tab goes on from it`, async ({
      page,
    }) => {
      await loadFresh(page, reducedMotion);
      await navLink(page, 'Services').click();
      await waitForScrollToSettle(page);

      await expectFocusAt(page, '#services');
      await page.keyboard.press('Tab');
      await expectFocusOnNextTabStopFrom(page, '#services');
    });

    test(`AC-34: ${label}, a hash on load puts focus at its section, and Tab goes on from it`, async ({
      page,
    }) => {
      await loadFresh(page, reducedMotion, '/#services');
      await waitForScrollToSettle(page);

      await expectFocusAt(page, '#services');
      await page.keyboard.press('Tab');
      await expectFocusOnNextTabStopFrom(page, '#services');
    });

    for (const hash of [
      '#does-not-exist',
      '#%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E',
      '#a%22%5D%2C*',
      '#',
    ]) {
      test(`AC-35: ${label}, the hash "${hash}" on load is ignored`, async ({
        page,
        pageErrors,
      }) => {
        const dialogs = [];
        page.on('dialog', async (dialog) => {
          dialogs.push(`${dialog.type()}: ${dialog.message()}`);
          await dialog.dismiss();
        });
        await loadFresh(page, reducedMotion, `/${hash}`);
        await waitUntilAfterLoad(page, AFTER_LOAD_MS);

        const state = await page.evaluate(() => ({
          scrollY: window.scrollY,
          focusOnBody: document.activeElement === document.body,
          injectedImages: document.querySelectorAll('img[src="x"]').length,
        }));
        expect(pageErrors, 'page errors').toEqual([]);
        expect(dialogs, 'browser dialogs').toEqual([]);
        expect(state, 'scroll, focus and injected images').toEqual({
          scrollY: 0,
          focusOnBody: true,
          injectedImages: 0,
        });
      });
    }
  });
}

test.describe('at small', () => {
  test.use(small);

  for (const { label, reducedMotion } of MOTION_MODES) {
    test(`AC-33 case 3: ${label}, the nav link "Portfolio" from the mobile nav puts focus at the section, and Tab goes on to "All"`, async ({
      page,
    }) => {
      await loadFresh(page, reducedMotion);
      await menuButton(page).click();
      await navLink(page, 'Portfolio').click();
      await waitForScrollToSettle(page);

      await expectFocusAt(page, '#portfolio');
      await page.keyboard.press('Tab');
      await expect(portfolioFilter(page, 'All'), 'the filter button "All"').toBeFocused();
    });
  }
});

test.describe('glides at desktop with motion allowed', () => {
  test.use(desktop);

  test('AC-36 case 1: with motion allowed, the nav link "About" still glides', async ({ page }) => {
    await loadFresh(page, 'no-preference');

    const scrollYs = await traceScrollY(page, 'nav-link', () => navLink(page, 'About').click());

    expect(isGlide(scrollYs), `a glide: ${JSON.stringify(describeScroll(scrollYs))}`).toBe(true);
  });

  test('AC-36 case 2: with motion allowed, back-to-top still glides', async ({ page }) => {
    await loadFresh(page, 'no-preference');
    await scrollToContact(page);

    const scrollYs = await traceScrollY(page, 'back-to-top', () => backToTop(page).click());

    expect(isGlide(scrollYs), `a glide: ${JSON.stringify(describeScroll(scrollYs))}`).toBe(true);
  });
});
