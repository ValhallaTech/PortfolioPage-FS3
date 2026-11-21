/**
 * Reduced motion for the rest of the page, and live switches of the preference (spec
 * gsap-animations AC-8 to AC-12 and AC-14 to AC-17). PR-1 (WI-5) adds AC-14 case 2, the
 * reveals; PR-2 (WI-9) adds case 1, the hero; PR-3 (WI-12) adds the rest.
 *
 * A live switch is `page.emulateMedia` after `load`, with no reload, and the case's
 * trigger starts 500 ms after it (§2.3 Conventions). AC-14 case 1 names its own times.
 */
import { test, expect } from './fixtures.js';
import { desktop, phone, small } from './viewports.js';
import {
  POSITION_TOLERANCE_PX,
  TRACE_MS,
  describeFrame,
  finishFrameTrace,
  isGlide,
  isJump,
  movementFaults,
  readEffectiveOpacity,
  seriesOf,
  startFrameTrace,
  traceFromFirstFrame,
  waitForTwoFrames,
  waitUntilAfterLoad,
} from './helpers/frame-trace.js';
import { CONTACT_MODAL, contactButton } from './helpers/contact-modal.js';
import {
  backToTop,
  describeScroll,
  menuButton,
  navLink,
  scrollToContact,
  traceScrollY,
} from './helpers/in-page-navigation.js';
import {
  ITEM_NUMBERS,
  LIGHTBOX,
  LIGHTBOX_IMAGE,
  PORTFOLIO_ITEM,
  PORTFOLIO_LINK,
  PORTFOLIO_WRAP,
  lightboxImageWidth,
  portfolioFilter,
  revealPortfolio,
  waitForPortfolioGrid,
} from './helpers/portfolio.js';
import { HERO_LINE, HERO_SENTENCE, TYPED_ELEMENT } from './helpers/hero.js';
import {
  expectRevealTargets,
  revealTargets,
  shownAtOnceFaults,
  traceWhileScrollingToBottom,
} from './helpers/reveals.js';

/** The Conventions' gap between a live switch and the case's trigger. */
const SWITCH_TO_TRIGGER_MS = 500;

/**
 * AC-14 case 1: the switch is made this long after `load`, the sentence shows within the
 * next, and it then stays for the last. The typing must not have reached its last phrase.
 */
const HERO_SWITCH_AFTER_LOAD_MS = 3_000;
const SENTENCE_WITHIN_MS = 1_000;
const SENTENCE_HOLDS_MS = 5_000;
const LAST_PHRASE = 'a Coding Ninja';

test.describe('at desktop', () => {
  test.use(desktop);

  test('AC-14 case 1: after a live switch to reduced motion, the hero shows its full sentence and keeps it', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/', { waitUntil: 'load' });
    await waitUntilAfterLoad(page, HERO_SWITCH_AFTER_LOAD_MS);
    await expect(page.locator(HERO_LINE), 'the hero line is typing').toHaveClass(/\bis-typing\b/);
    expect(
      await page.locator(TYPED_ELEMENT).textContent(),
      'the typing element before the switch'
    ).not.toBe(LAST_PHRASE);

    const heroLine = { name: 'hero line', selector: HERO_LINE, text: true };
    const switchAt = await startFrameTrace(page, 'hero-switch', [heroLine], { durationMs: null });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const frames = await finishFrameTrace(
      page,
      'hero-switch',
      SENTENCE_WITHIN_MS + SENTENCE_HOLDS_MS,
      { from: switchAt }
    );
    const series = seriesOf(frames, heroLine.name);

    const firstFull = series.findIndex((entry) => entry.text === HERO_SENTENCE);
    expect(firstFull, 'a frame whose visible hero line is the hero sentence').toBeGreaterThan(-1);
    expect(
      Math.round(series[firstFull].t - switchAt),
      'ms from the switch to the first frame with the hero sentence'
    ).toBeLessThanOrEqual(SENTENCE_WITHIN_MS);
    const later = series.slice(firstFull);
    expect(
      later
        .filter((entry) => entry.text !== HERO_SENTENCE)
        .map((entry) => ({ t: Math.round(entry.t - switchAt), text: entry.text })),
      'frames after it whose visible hero line is not the hero sentence'
    ).toEqual([]);
    expect(
      Math.round(later.at(-1).t - later[0].t),
      'ms traced after the first frame with the hero sentence'
    ).toBeGreaterThanOrEqual(SENTENCE_HOLDS_MS);
  });

  test('AC-14 case 2: after a live switch to reduced motion, reveal targets 6 to 13 show at once and stay still', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/', { waitUntil: 'load' });
    await expectRevealTargets(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(SWITCH_TO_TRIGGER_MS);
    const targets = revealTargets([6, 7, 8, 9, 10, 11, 12, 13]);
    const frames = await traceWhileScrollingToBottom(page, targets);

    expect(
      shownAtOnceFaults(frames, targets),
      'reveal targets that were not fully opaque and in their final place in every frame in view'
    ).toEqual([]);
  });
});

/*
 * AC-8 to AC-12 run with reduced motion set before navigation. AC-14 cases 3 to 7 run the
 * same steps after a live switch to reduced motion, and must pass the same assertions.
 */

/**
 * The runs of one reduced-motion AC: set before navigation, and, when AC-14 names a case
 * for it, after a live switch.
 *
 * @param {string} ac - The AC and case, such as `AC-8 case 1`
 * @param {number | null} liveCase - AC-14's case number, or null when AC-14 has none
 */
function reducedMotionRuns(ac, liveCase) {
  const runs = [{ prefix: `${ac}: under reduced motion,`, live: false }];
  if (liveCase !== null) {
    runs.push({
      prefix: `AC-14 case ${liveCase} (${ac}): after a live switch to reduced motion,`,
      live: true,
    });
  }
  return runs;
}

/**
 * Loads the page fresh: with reduced motion on, or, for a live run, with motion allowed.
 *
 * @param {import('@playwright/test').Page} page
 * @param {boolean} live
 */
async function loadFresh(page, live) {
  await page.emulateMedia({ reducedMotion: live ? 'no-preference' : 'reduce' });
  await page.goto('/', { waitUntil: 'load' });
}

/**
 * For a live run, switches to reduced motion and waits until the trigger may start
 * (Conventions, "Live switch"). With reduced motion set before navigation, does nothing.
 *
 * @param {import('@playwright/test').Page} page
 * @param {boolean} live
 */
async function switchToReducedIfLive(page, live) {
  if (!live) return;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(SWITCH_TO_TRIGGER_MS);
}

/**
 * Switches live to motion allowed and waits until the trigger may start (AC-15).
 *
 * @param {import('@playwright/test').Page} page
 */
async function switchToMotionAllowed(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(SWITCH_TO_TRIGGER_MS);
}

/**
 * Runs `trigger` with a 1.5 s frame trace of `targets` from it, and returns the frames.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {object[]} targets
 * @param {() => Promise<unknown>} trigger
 * @param {number} [durationMs]
 */
async function traceDuring(page, id, targets, trigger, durationMs = TRACE_MS) {
  await startFrameTrace(page, id, targets, { durationMs: null });
  await waitForTwoFrames(page);
  await trigger();
  return finishFrameTrace(page, id, durationMs);
}

/** The sidebar: fixed, so its box is viewport-relative (Conventions). */
const SIDEBAR = { name: 'sidebar', selector: '#header', fixed: true };

/** The sidebar's closed `x` (AC-9). */
const SIDEBAR_CLOSED_X = -300;

/**
 * Whether a sidebar `x` sits between closed and open: from −299 to −1 (AC-9, AC-15).
 *
 * @param {number} x
 */
function isSidebarBetween(x) {
  return x >= -299 && x <= -1;
}

/**
 * Clicks the menu button with a frame trace of the sidebar, and returns its `x` per frame.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 */
async function traceMenuButtonClick(page, id) {
  const frames = await traceDuring(page, id, [SIDEBAR], () => menuButton(page).click());
  return seriesOf(frames, SIDEBAR.name).map((entry) => entry.x);
}

/** Item 1's card and its caption links, traced viewport-relative (AC-10). */
const ITEM_1 = `${PORTFOLIO_ITEM}[data-portfolio-id="1"]`;
const CARD = { name: 'card', selector: `${ITEM_1} ${PORTFOLIO_WRAP}`, fixed: true };
const CAPTION_LINKS = {
  name: 'caption links',
  selector: `${ITEM_1} .portfolio-links`,
  fixed: true,
};

/** AC-10's trace length, and its idle time before the hover. */
const CAPTION_TRACE_MS = 1_000;
const CAPTION_IDLE_MS = 2_000;

/**
 * Runs `trigger` with a 1 s frame trace of item 1's card and caption links, and returns
 * both series.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {() => Promise<unknown>} trigger
 */
async function traceCaption(page, id, trigger) {
  const frames = await traceDuring(page, id, [CARD, CAPTION_LINKS], trigger, CAPTION_TRACE_MS);
  return { card: seriesOf(frames, CARD.name), links: seriesOf(frames, CAPTION_LINKS.name) };
}

/**
 * The `y` values more than 1 px away from both the first and the last frame's (AC-10),
 * rounded for the failure message.
 *
 * @param {ReturnType<typeof seriesOf>} series
 */
function slidingFrames(series) {
  const first = series[0].y;
  const last = series.at(-1).y;
  return series
    .filter(
      (entry) =>
        Math.abs(entry.y - first) > POSITION_TOLERANCE_PX &&
        Math.abs(entry.y - last) > POSITION_TOLERANCE_PX
    )
    .map((entry) => Math.round(entry.y * 10) / 10);
}

/** The contact dialog, fixed, so its box is viewport-relative (Conventions). */
const DIALOG = { name: 'contact dialog', selector: CONTACT_MODAL, fixed: true };

/**
 * The lightbox image of slide N, current or not, for AC-12 step 2's outgoing and incoming
 * images.
 *
 * @param {number} n
 */
function slideImage(n) {
  return {
    name: `slide ${n} image`,
    selector: `${LIGHTBOX} .gslider > .gslide:nth-child(${n}) .gslide-image img`,
    fixed: true,
  };
}
const CURRENT_IMAGE = { name: 'lightbox image', selector: LIGHTBOX_IMAGE, fixed: true };

/**
 * Asserts "no movement" for each target of a trace, and that each was shown in some frame,
 * so the check cannot pass on a target that never appeared.
 *
 * @param {object[]} frames
 * @param {object[]} targets
 * @param {string} step - Names the step in the failure message
 */
function expectNoMovement(frames, targets, step) {
  for (const target of targets) {
    const series = seriesOf(frames, target.name);
    expect(
      series.filter((entry) => entry.opacity > 0).length,
      `${step}: frames in which the ${target.name} is shown`
    ).toBeGreaterThan(0);
    expect(movementFaults(series), `${step}: frames in which the ${target.name} moved`).toEqual([]);
  }
}

/**
 * The lightbox's effective opacity, or 0 once GLightbox has removed it.
 *
 * @param {import('@playwright/test').Page} page
 */
async function lightboxOpacity(page) {
  const lightbox = page.locator(LIGHTBOX);
  if ((await lightbox.count()) === 0) return 0;
  return readEffectiveOpacity(lightbox);
}

/**
 * Asserts that a `scrollY` trace is a jump that ends away from the top (AC-8 cases 1–3).
 *
 * @param {number[]} scrollYs
 */
function expectJumpAwayFromTop(scrollYs) {
  expect(isJump(scrollYs), `a jump: ${JSON.stringify(describeScroll(scrollYs))}`).toBe(true);
  expect(Math.abs(scrollYs.at(-1)), 'the last scrollY, away from 0').toBeGreaterThan(100);
}

/**
 * AC-12's steps and assertions: item 1's enlarge link opens the lightbox, ArrowRight changes
 * slide and Escape closes it, each with a frame trace, and no traced image moves or changes
 * size while it is shown.
 *
 * @param {import('@playwright/test').Page} page
 * @param {boolean} live - Reach reduced motion by a live switch (AC-14 case 7)
 */
async function expectLightboxStepsStill(page, live) {
  await loadFresh(page, live);
  await waitForPortfolioGrid(page);
  await revealPortfolio(page);
  await expect(portfolioFilter(page, 'All'), 'the All filter').toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.locator(CARD.selector).hover();
  await switchToReducedIfLive(page, live);

  const opening = await traceDuring(page, 'lightbox-opens', [CURRENT_IMAGE], () =>
    page.locator(`${ITEM_1} ${PORTFOLIO_LINK}.glightbox`).click()
  );
  expectNoMovement(opening, [CURRENT_IMAGE], 'step 1');
  expect(
    seriesOf(opening, CURRENT_IMAGE.name).at(-1).opacity,
    'the lightbox image in the last frame of step 1'
  ).toBeGreaterThan(0);
  await expect
    .poll(() => lightboxImageWidth(page), { message: 'the lightbox image has loaded' })
    .toBeGreaterThan(0);

  const slides = [slideImage(1), slideImage(2)];
  const changing = await traceDuring(page, 'lightbox-next', slides, () =>
    page.keyboard.press('ArrowRight')
  );
  expectNoMovement(changing, slides, 'step 2');

  const closing = await traceDuring(page, 'lightbox-closes', [CURRENT_IMAGE], () =>
    page.keyboard.press('Escape')
  );
  expectNoMovement(closing, [CURRENT_IMAGE], 'step 3');
  expect(await lightboxOpacity(page), 'the lightbox after step 3').toBe(0);
}

test.describe('in-page navigation, captions, the contact dialog and the lightbox at desktop', () => {
  test.use(desktop);

  for (const name of ['About', 'Contact']) {
    const acCase = name === 'About' ? 'AC-8 case 1' : 'AC-8 case 2';
    for (const { prefix, live } of reducedMotionRuns(acCase, 3)) {
      test(`${prefix} the nav link "${name}" jumps to its section`, async ({ page }) => {
        await loadFresh(page, live);
        await switchToReducedIfLive(page, live);

        const scrollYs = await traceScrollY(page, 'nav-link', () => navLink(page, name).click());

        expectJumpAwayFromTop(scrollYs);
      });
    }
  }

  test('AC-8 case 3: under reduced motion, a hash on load jumps to its section', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await traceFromFirstFrame(page, 'hash-load', []);
    await page.goto('/#services', { waitUntil: 'load' });

    const frames = await finishFrameTrace(page, 'hash-load', TRACE_MS, { from: 'load' });

    expectJumpAwayFromTop(frames.map((frame) => frame.scrollY));
  });

  for (const { prefix, live } of reducedMotionRuns('AC-8 case 4', 3)) {
    test(`${prefix} back-to-top jumps to the top`, async ({ page }) => {
      await loadFresh(page, live);
      await scrollToContact(page);
      await switchToReducedIfLive(page, live);

      const scrollYs = await traceScrollY(page, 'back-to-top', () => backToTop(page).click());

      expect(isJump(scrollYs), `a jump: ${JSON.stringify(describeScroll(scrollYs))}`).toBe(true);
      expect(scrollYs.at(-1), 'the last scrollY').toBe(0);
    });
  }

  for (const { prefix, live } of reducedMotionRuns('AC-10', 5)) {
    test(`${prefix} the portfolio caption links appear and go without sliding`, async ({
      page,
    }) => {
      await loadFresh(page, live);
      await waitForPortfolioGrid(page);
      await revealPortfolio(page);
      await page.waitForTimeout(CAPTION_IDLE_MS);
      await switchToReducedIfLive(page, live);

      const hover = await traceCaption(page, 'caption-hover', () =>
        page.locator(CARD.selector).hover()
      );
      const leave = await traceCaption(page, 'caption-leave', () => page.mouse.move(0, 0));

      expect(slidingFrames(hover.links), 'hover: caption-link y away from first and last').toEqual(
        []
      );
      expect(slidingFrames(leave.links), 'leave: caption-link y away from first and last').toEqual(
        []
      );
      const links = hover.links.at(-1);
      const card = hover.card.at(-1);
      expect(
        Math.abs(links.y + links.height - (card.y + card.height)),
        'px between the caption links bottom and the card bottom at the end of the hover'
      ).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
    });
  }

  for (const { prefix, live } of reducedMotionRuns('AC-11', 6)) {
    test(`${prefix} the contact dialog opens and closes without moving`, async ({ page }) => {
      await loadFresh(page, live);
      await contactButton(page).scrollIntoViewIfNeeded();
      await expect(contactButton(page), 'the contact button').toBeVisible();
      await switchToReducedIfLive(page, live);

      const opening = await traceDuring(page, 'dialog-opens', [DIALOG], () =>
        contactButton(page).click()
      );
      const closing = await traceDuring(page, 'dialog-closes', [DIALOG], () =>
        page.keyboard.press('Escape')
      );

      expectNoMovement(opening, [DIALOG], 'opening');
      expectNoMovement(closing, [DIALOG], 'closing');
      expect(
        seriesOf(opening, DIALOG.name).at(-1).opacity,
        'the dialog in the last frame of the opening trace'
      ).toBeGreaterThan(0);
      expect(
        seriesOf(closing, DIALOG.name).at(-1).opacity,
        'the dialog in the last frame of the closing trace'
      ).toBe(0);
    });
  }

  for (const { prefix, live } of reducedMotionRuns('AC-12', 7)) {
    test(`${prefix} the lightbox opens, changes slide and closes without moving`, async ({
      page,
    }) => {
      await expectLightboxStepsStill(page, live);
    });
  }

  test('AC-15 case 1: after a live switch back to motion allowed, the nav link "About" glides', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'load' });
    await switchToMotionAllowed(page);

    const scrollYs = await traceScrollY(page, 'nav-link', () => navLink(page, 'About').click());

    expect(isGlide(scrollYs), `a glide: ${JSON.stringify(describeScroll(scrollYs))}`).toBe(true);
  });
});

/*
 * GLightbox's open() forces the slide effect back to `slide` on a mobile user agent, and
 * main.js writes the reduced-motion effects again on the `open` event (AD-11, V-6). This
 * run uses the phone device, whose user agent is a mobile one, so that rewrite is tested.
 */
test.describe('the lightbox on a phone', () => {
  test.use(phone);

  test('AC-12 on a phone: under reduced motion, the lightbox opens, changes slide and closes without moving', async ({
    page,
  }) => {
    await expectLightboxStepsStill(page, false);
  });
});

test.describe('the mobile nav at small', () => {
  test.use(small);

  for (const { prefix, live } of reducedMotionRuns('AC-9', 4)) {
    test(`${prefix} the mobile nav opens and closes without sliding`, async ({ page }) => {
      await loadFresh(page, live);
      await switchToReducedIfLive(page, live);

      const opening = await traceMenuButtonClick(page, 'nav-opens');
      const closing = await traceMenuButtonClick(page, 'nav-closes');

      expect(Math.round(opening.at(-1)), 'the sidebar x in the last opening frame').toBe(0);
      expect(opening.filter(isSidebarBetween), 'opening: sidebar x from −299 to −1').toEqual([]);
      expect(closing.at(-1), 'the sidebar x in the last closing frame').toBeLessThanOrEqual(
        SIDEBAR_CLOSED_X
      );
      expect(closing.filter(isSidebarBetween), 'closing: sidebar x from −299 to −1').toEqual([]);
    });
  }

  test('AC-15 case 2: after a live switch back to motion allowed, the mobile nav slides again', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'load' });
    await switchToMotionAllowed(page);

    const opening = await traceMenuButtonClick(page, 'nav-opens');

    expect(
      opening.filter(isSidebarBetween).length,
      'frames whose sidebar x is from −299 to −1'
    ).toBeGreaterThanOrEqual(1);
  });
});

/*
 * AC-16 and AC-17: the portfolio items on a resize from 1440 × 900 to 1023 × 900 after a
 * live switch, each traced document-relative from the resize.
 */

/** The viewport the resize goes to (AC-16, AC-17). */
const RESIZED = { width: 1023, height: 900 };

/** The 9 portfolio items as frame-trace targets. */
const PORTFOLIO_ITEMS = ITEM_NUMBERS.map((n) => ({
  name: `item ${n}`,
  selector: `${PORTFOLIO_ITEM}[data-portfolio-id="${n}"]`,
}));

/** How far an item's box must move for AC-16 to count the arrangement as changed. */
const CHANGED_PX = 10;

/**
 * Whether two boxes are within `tolerance` px of each other in `x`, `y`, `width` and
 * `height`.
 *
 * @param {{ x: number, y: number, width: number, height: number }} a
 * @param {{ x: number, y: number, width: number, height: number }} b
 * @param {number} tolerance
 */
function boxesWithin(a, b, tolerance) {
  return ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) <= tolerance);
}

/**
 * The frames of a series whose box is more than 1 px from both its first and last box.
 *
 * @param {ReturnType<typeof seriesOf>} series
 */
function framesAwayFromEnds(series) {
  const first = series[0];
  const last = series.at(-1);
  return series.filter(
    (entry) =>
      !boxesWithin(entry, first, POSITION_TOLERANCE_PX) &&
      !boxesWithin(entry, last, POSITION_TOLERANCE_PX)
  );
}

/**
 * Loads at 1440 × 900 with `from`, waits for the items, brings `#portfolio` into view,
 * switches live to `to`, then resizes to 1023 × 900 with a frame trace of every item.
 * Returns each item's series.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'reduce' | 'no-preference'} from
 * @param {'reduce' | 'no-preference'} to
 */
async function traceItemsOnResize(page, from, to) {
  await page.emulateMedia({ reducedMotion: from });
  await page.goto('/', { waitUntil: 'load' });
  await waitForPortfolioGrid(page);
  await revealPortfolio(page);
  await page.emulateMedia({ reducedMotion: to });
  await page.waitForTimeout(SWITCH_TO_TRIGGER_MS);

  // The trace runs from the resize (AC-16, AC-17), and the resize changes the page at once,
  // so frames drawn before it are dropped: the resize event's time in the page marks it.
  await page.evaluate(() =>
    window.addEventListener(
      'resize',
      () => {
        window.__portfolioResizedAt = performance.now();
      },
      { once: true }
    )
  );
  const frames = await traceDuring(page, 'resize', PORTFOLIO_ITEMS, () =>
    page.setViewportSize(RESIZED)
  );
  const resizedAt = await page.evaluate(() => window.__portfolioResizedAt);
  expect(resizedAt, 'the page time of the resize event').toEqual(expect.any(Number));
  const fromResize = frames.filter((frame) => frame.t >= resizedAt);
  return PORTFOLIO_ITEMS.map((item) => ({
    name: item.name,
    series: seriesOf(fromResize, item.name),
  }));
}

test.describe('the portfolio items on a resize', () => {
  test.use(desktop);

  test('AC-16: after a live switch to reduced motion, a resize moves each portfolio item straight to its new place', async ({
    page,
  }) => {
    const items = await traceItemsOnResize(page, 'no-preference', 'reduce');

    const away = items
      .map(({ name, series }) => {
        const bad = framesAwayFromEnds(series);
        return { name, frames: bad.length, first: bad[0] && describeFrame(bad[0], series.at(-1)) };
      })
      .filter((item) => item.frames > 0);
    expect(away, 'items with a frame more than 1 px from both their first and last box').toEqual(
      []
    );
    expect(
      items.filter(({ series }) => !boxesWithin(series[0], series.at(-1), CHANGED_PX)).length,
      `items whose last box is more than ${CHANGED_PX} px from their first`
    ).toBeGreaterThanOrEqual(1);
  });

  test('AC-17: after a live switch back to motion allowed, a resize animates the portfolio items again', async ({
    page,
  }) => {
    const items = await traceItemsOnResize(page, 'reduce', 'no-preference');

    expect(
      items.filter(({ series }) => framesAwayFromEnds(series).length > 0).map(({ name }) => name),
      'items with a frame more than 1 px from both their first and last box'
    ).not.toEqual([]);
  });
});
