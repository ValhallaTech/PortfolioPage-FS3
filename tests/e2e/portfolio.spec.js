/**
 * The Muuri portfolio: filters, keyboard access, action links, lightbox, layout bounds
 * and reduced motion (spec stabilize-and-cleanup, WI-40: AC-35, AC-36, AC-37, AC-42,
 * AC-43, AC-119, AC-120, AC-121, AC-122, AC-124).
 *
 * Items are identified by `data-portfolio-id` and judged visible with `toBeVisible()`
 * (§3.3 DOM contract). Every test waits for `.portfolio-container.muuri` before its
 * first portfolio assertion. The fixed waits are the ones the ACs name: the 1 s filter
 * settle of AC-36, AC-119, AC-121 and AC-122, and AC-124's 2 s idle (RK-4).
 */
import { test, expect } from './fixtures.js';
import { desktop, phone, small } from './viewports.js';
import {
  FILTER_ITEM_SETS,
  ITEM_NUMBERS,
  LIGHTBOX,
  PORTFOLIO_CONTAINER,
  PORTFOLIO_ITEM,
  PORTFOLIO_LINK,
  PORTFOLIO_SECTION,
  PORTFOLIO_WRAP,
  expectShownItems,
  lightboxImageWidth,
  openLightboxFrom,
  portfolioFilter,
  portfolioItem,
  revealPortfolio,
  waitForPortfolioGrid,
  waitForPortfolioImages,
} from './helpers/portfolio.js';

/** The settle after each filter change that AC-36, AC-119, AC-121 and AC-122 name. */
const FILTER_SETTLE_MS = 1_000;

/** AC-124's idle before the click, so any scroll reveal has finished. */
const REVEAL_IDLE_MS = 2_000;

/** How long AC-124 records frames after the click. */
const RECORDING_MS = 1_000;

/** The Tab walk's press limit (AC Conventions). */
const MAX_TAB_PRESSES = 120;

/** AC-124's tolerance for a visible item's bounding box between frames. */
const BOX_TOLERANCE_PX = 1;

/** AC-121's widths, all at height 900. */
const AC_121_WIDTHS = [320, 375, 768, 991, 992, 1023, 1024, 1199, 1200, 1279, 1280, 1440, 1920];
const AC_121_HEIGHT = 900;

/** Budgets of the tests that walk several viewports with fixed settles. */
const MULTI_VIEWPORT_TIMEOUT_MS = 60_000;
const AC_121_TIMEOUT_MS = 150_000;

const FILTER_NAMES = Object.keys(FILTER_ITEM_SETS);
const VIEWPORTS_DESKTOP_AND_SMALL = { desktop, small };

/**
 * Loads `/` and waits until Muuri has initialized the grid.
 *
 * @param {import('@playwright/test').Page} page
 */
async function gotoPortfolio(page) {
  await page.goto('/');
  await waitForPortfolioGrid(page);
}

/**
 * Returns a stable id for `element`, or for the focused element when none is given.
 * Runs in the page; ids live in a WeakMap, so DOM moves (the looping carousel) do not
 * change them.
 *
 * @param {Element} [element]
 */
function stableElementId(element) {
  const target = element ?? document.activeElement;
  window.__e2eElementIds ??= new WeakMap();
  window.__e2eNextElementId ??= 1;
  if (!window.__e2eElementIds.has(target)) {
    window.__e2eElementIds.set(target, window.__e2eNextElementId);
    window.__e2eNextElementId += 1;
  }
  return window.__e2eElementIds.get(target);
}

/**
 * The AC Conventions' Tab walk: from a fresh load with focus on `body`, press Tab until
 * focus returns to the first element focused, or 120 presses. Focus inside the
 * cross-origin map iframe counts as the iframe itself.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number[]>} the stable ids of the focused elements, in order
 */
async function tabWalk(page) {
  const focused = [];
  for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(stableElementId);
    if (focused.length > 0 && id === focused[0]) break;
    focused.push(id);
  }
  return focused;
}

/**
 * Presses Tab until `target` is focused, within the Tab walk's press limit.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} target
 */
async function tabUntilFocused(page, target) {
  for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach ${target} within ${MAX_TAB_PRESSES} presses`);
}

/**
 * Runs in the page: whether an action link lies inside its card wrapper's box, and
 * which of the link and its ancestors has a computed opacity other than 1 (AC-42, AC-43).
 *
 * @param {Element} link
 * @param {string} wrapSelector
 */
function actionLinkVisibility(link, wrapSelector) {
  const linkBox = link.getBoundingClientRect();
  const wrapBox = link.closest(wrapSelector).getBoundingClientRect();
  const translucent = [];
  for (let element = link; element !== null; element = element.parentElement) {
    const { opacity } = getComputedStyle(element);
    if (opacity !== '1') {
      const classes = [...element.classList].map((name) => `.${name}`).join('');
      translucent.push(`${element.tagName.toLowerCase()}${classes}: opacity ${opacity}`);
    }
  }
  return {
    insideCard:
      linkBox.left >= wrapBox.left &&
      linkBox.right <= wrapBox.right &&
      linkBox.top >= wrapBox.top &&
      linkBox.bottom <= wrapBox.bottom,
    translucent,
  };
}

/**
 * Polls until an action link is inside its card and fully opaque. The scroll reveal fades
 * the grid in once it scrolls into view, so the state is polled, not read once.
 *
 * @param {import('@playwright/test').Locator} link
 * @param {string} label
 */
async function expectActionLinkVisible(link, label) {
  await expect
    .poll(() => link.evaluate(actionLinkVisibility, PORTFOLIO_WRAP), { message: label })
    .toEqual({ insideCard: true, translucent: [] });
}

/**
 * Runs in the page: arms a recorder that starts on the next click, after the page's
 * own click handlers, and samples every portfolio item on each animation frame for
 * `durationMs` (AC-124). At the first frame it also lists the running animations on
 * the grid container, the items and their descendants. The filter buttons sit outside
 * the container, so their color transition is not counted.
 *
 * @param {{ containerSelector: string, itemSelector: string, wrapSelector: string, durationMs: number }} options
 */
function armFrameRecorder({ containerSelector, itemSelector, wrapSelector, durationMs }) {
  const container = document.querySelector(containerSelector);
  const items = [...container.querySelectorAll(itemSelector)];
  const describe = (element) =>
    `${element.tagName.toLowerCase()}${[...element.classList].map((name) => `.${name}`).join('')}`;

  const sample = () =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      const wrap = item.querySelector(wrapSelector);
      return {
        id: Number(item.dataset.portfolioId),
        visible:
          item.checkVisibility({ visibilityProperty: true }) && box.width > 0 && box.height > 0,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        opacity: getComputedStyle(item).opacity,
        // Muuri animates visibility on the card wrapper, the item's first child (D-16).
        wrapOpacity: getComputedStyle(wrap).opacity,
      };
    });

  const runningAnimations = () =>
    document
      .getAnimations()
      .filter((animation) => {
        const target = animation.effect?.target;
        return (
          animation.playState === 'running' &&
          target instanceof Element &&
          container.contains(target) &&
          animation.effect.getComputedTiming().duration > 0
        );
      })
      .map(
        (animation) =>
          `${animation.constructor.name} ${animation.animationName ?? animation.transitionProperty ?? ''} on ${describe(animation.effect.target)}`
      );

  const recording = { frames: [], animationsAtFirstFrame: null, done: false };
  window.__portfolioRecording = recording;

  document.addEventListener(
    'click',
    () => {
      const start = performance.now();
      const onFrame = () => {
        if (recording.frames.length === 0) recording.animationsAtFirstFrame = runningAnimations();
        recording.frames.push(sample());
        if (performance.now() - start < durationMs) requestAnimationFrame(onFrame);
        else recording.done = true;
      };
      requestAnimationFrame(onFrame);
    },
    { once: true }
  );
}

/**
 * Compares every recorded frame with the last one (AC-124) and returns each mismatch.
 *
 * @param {Array<Array<{ id: number, visible: boolean, box: object, opacity: string, wrapOpacity: string }>>} frames
 */
function framesDifferingFromFinal(frames) {
  const finalFrame = frames.at(-1);
  const visibleIds = (frame) => frame.filter((item) => item.visible).map((item) => item.id);
  const finalIds = visibleIds(finalFrame);
  const mismatches = [];

  frames.forEach((frame, index) => {
    const ids = visibleIds(frame);
    if (ids.join() !== finalIds.join()) {
      mismatches.push(`frame ${index}: visible {${ids}} instead of {${finalIds}}`);
    }
    for (const item of frame.filter((entry) => entry.visible)) {
      const final = finalFrame.find((entry) => entry.id === item.id);
      const moved = ['x', 'y', 'width', 'height'].filter(
        (key) => Math.abs(item.box[key] - final.box[key]) > BOX_TOLERANCE_PX
      );
      if (moved.length > 0) {
        mismatches.push(
          `frame ${index}: item ${item.id} box ${JSON.stringify(item.box)} instead of ${JSON.stringify(final.box)}`
        );
      }
      if (item.opacity !== '1' || item.wrapOpacity !== '1') {
        mismatches.push(
          `frame ${index}: item ${item.id} opacity ${item.opacity}, card opacity ${item.wrapOpacity}`
        );
      }
    }
  });
  return mismatches;
}

test.use(desktop);

test('AC-35: the keyboard reaches all four filters as buttons', async ({ page }) => {
  await gotoPortfolio(page);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  const focused = await tabWalk(page);

  for (const name of ['all', 'app', 'card', 'web']) {
    const button = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
    const id = await button.evaluate(stableElementId);
    expect(focused, `the Tab walk focuses the "${name}" button`).toContain(id);
  }
});

test('AC-36: Enter on a filter applies it', async ({ page }) => {
  await gotoPortfolio(page);
  const app = portfolioFilter(page, 'App');
  await tabUntilFocused(page, app);
  await expect(app).toBeFocused();

  await page.keyboard.press('Enter');
  await page.waitForTimeout(FILTER_SETTLE_MS);

  await expectShownItems(page, FILTER_ITEM_SETS.App, 'App by Enter');
});

test('AC-37: the selected filter is exposed as pressed', async ({ page }) => {
  await gotoPortfolio(page);
  const app = portfolioFilter(page, 'App');
  await tabUntilFocused(page, app);
  await page.keyboard.press('Enter');

  for (const name of FILTER_NAMES) {
    await expect(portfolioFilter(page, name)).toHaveAttribute(
      'aria-pressed',
      name === 'App' ? 'true' : 'false'
    );
  }
});

test('AC-42: a focused portfolio action link is visible', async ({ page }) => {
  await gotoPortfolio(page);
  const firstLink = page.locator(PORTFOLIO_LINK).first();

  await tabUntilFocused(page, firstLink);

  await expect(firstLink).toBeFocused();
  await expectActionLinkVisible(firstLink, 'the focused action link is inside its card, opaque');
});

test.describe('at phone', () => {
  test.use(phone);

  test('AC-43: portfolio action links are visible on touch without hover', async ({ page }) => {
    await gotoPortfolio(page);
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);

    const item = page.locator(PORTFOLIO_ITEM).filter({ visible: true }).first();
    await item.scrollIntoViewIfNeeded();

    const links = item.locator(PORTFOLIO_LINK);
    await expect(links).toHaveCount(2);
    for (const [index, link] of (await links.all()).entries()) {
      await expectActionLinkVisible(link, `action link ${index + 1} is inside its card, opaque`);
    }
  });
});

test("AC-119: each filter shows exactly today's items", async ({ page }) => {
  test.setTimeout(MULTI_VIEWPORT_TIMEOUT_MS);
  for (const [viewportName, { viewport }] of Object.entries(VIEWPORTS_DESKTOP_AND_SMALL)) {
    await test.step(`at ${viewportName}`, async () => {
      await page.setViewportSize(viewport);
      await gotoPortfolio(page);

      for (const filterName of FILTER_NAMES) {
        await portfolioFilter(page, filterName).click();
        await page.waitForTimeout(FILTER_SETTLE_MS);
        await expectShownItems(
          page,
          FILTER_ITEM_SETS[filterName],
          `${filterName} at ${viewportName}`
        );
      }
    });
  }
});

test('AC-120: the lightbox opens from every portfolio item', async ({ page }) => {
  test.setTimeout(MULTI_VIEWPORT_TIMEOUT_MS);
  await gotoPortfolio(page);
  await expect(portfolioFilter(page, 'All')).toHaveAttribute('aria-pressed', 'true');
  const lightbox = page.locator(LIGHTBOX);

  for (const n of ITEM_NUMBERS) {
    await test.step(`item ${n}`, async () => {
      await openLightboxFrom(portfolioItem(page, n));

      await expect(lightbox, `the lightbox opens from item ${n}`).toBeVisible();
      await expect
        .poll(() => lightboxImageWidth(page), { message: `item ${n}'s image has loaded` })
        .toBeGreaterThan(0);
      await expect(lightbox.locator('.gslide.current .gslide-image img')).toHaveAttribute(
        'src',
        new RegExp(`/portfolio-${n}\\.[^/]*$`)
      );

      await page.keyboard.press('Escape');
      await expect(lightbox, `the lightbox from item ${n} closes`).toBeHidden();
    });
  }
});

test('AC-121: the portfolio never causes horizontal scrolling', async ({ page }) => {
  test.setTimeout(AC_121_TIMEOUT_MS);
  for (const width of AC_121_WIDTHS) {
    await test.step(`at ${width} px`, async () => {
      await page.setViewportSize({ width, height: AC_121_HEIGHT });
      await gotoPortfolio(page);
      await waitForPortfolioImages(page);

      for (const filterName of FILTER_NAMES) {
        await portfolioFilter(page, filterName).click();
        await page.waitForTimeout(FILTER_SETTLE_MS);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          scrollWidth,
          `${filterName} at ${width} px: scrollWidth ${scrollWidth}, clientWidth ${clientWidth}`
        ).toBeLessThanOrEqual(clientWidth);
      }
    });
  }
});

test('AC-122: the portfolio stays inside its own section', async ({ page }) => {
  test.setTimeout(MULTI_VIEWPORT_TIMEOUT_MS);
  for (const [viewportName, { viewport }] of Object.entries(VIEWPORTS_DESKTOP_AND_SMALL)) {
    await test.step(`at ${viewportName}`, async () => {
      await page.setViewportSize(viewport);
      await gotoPortfolio(page);
      await waitForPortfolioImages(page);
      await revealPortfolio(page);

      for (const filterName of FILTER_NAMES) {
        await portfolioFilter(page, filterName).click();
        await page.waitForTimeout(FILTER_SETTLE_MS);
        const label = `${filterName} at ${viewportName}`;

        const visibleItems = await page.locator(PORTFOLIO_ITEM).filter({ visible: true }).all();
        expect(visibleItems.length, `${label}: some item is visible`).toBeGreaterThan(0);
        for (const item of visibleItems) {
          const placement = await item.evaluate((element, sectionSelector) => {
            const box = element.getBoundingClientRect();
            const section = document.querySelector(sectionSelector).getBoundingClientRect();
            return {
              id: element.dataset.portfolioId,
              inside:
                box.left >= section.left &&
                box.right <= section.right &&
                box.top >= section.top &&
                box.bottom <= section.bottom,
            };
          }, PORTFOLIO_SECTION);
          expect(placement, `${label}: item ${placement.id} lies inside #portfolio`).toEqual({
            id: placement.id,
            inside: true,
          });
        }

        const { portfolioBottom, servicesTop } = await page.evaluate(
          (sectionSelector) => ({
            portfolioBottom: document.querySelector(sectionSelector).getBoundingClientRect().bottom,
            servicesTop: document.querySelector('#services').getBoundingClientRect().top,
          }),
          PORTFOLIO_SECTION
        );
        expect(portfolioBottom, `${label}: #portfolio ends before #services`).toBeLessThanOrEqual(
          servicesTop
        );
      }
    });
  }
});

test('AC-124: under reduced motion, a filter change jumps straight to its final state', async ({
  page,
}) => {
  test.setTimeout(MULTI_VIEWPORT_TIMEOUT_MS);
  for (const [viewportName, { viewport }] of Object.entries(VIEWPORTS_DESKTOP_AND_SMALL)) {
    await test.step(`at ${viewportName}`, async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize(viewport);
      await gotoPortfolio(page);
      await expect(portfolioFilter(page, 'All')).toHaveAttribute('aria-pressed', 'true');
      await waitForPortfolioImages(page);
      await revealPortfolio(page);
      await page.waitForTimeout(REVEAL_IDLE_MS);

      await page.evaluate(armFrameRecorder, {
        containerSelector: PORTFOLIO_CONTAINER,
        itemSelector: PORTFOLIO_ITEM,
        wrapSelector: PORTFOLIO_WRAP,
        durationMs: RECORDING_MS,
      });
      await portfolioFilter(page, 'App').click();
      await page.waitForFunction(() => window.__portfolioRecording.done);
      const { frames, animationsAtFirstFrame } = await page.evaluate(
        () => window.__portfolioRecording
      );

      expect(frames.length, 'frames recorded in 1 s').toBeGreaterThan(1);
      const finalIds = frames
        .at(-1)
        .filter((item) => item.visible)
        .map((item) => item.id);
      expect(finalIds, 'the final frame shows exactly the App items').toEqual(FILTER_ITEM_SETS.App);
      expect(framesDifferingFromFinal(frames), 'every frame matches the final state').toEqual([]);
      expect(animationsAtFirstFrame, 'no animation runs at the first frame').toEqual([]);
    });
  }
});
