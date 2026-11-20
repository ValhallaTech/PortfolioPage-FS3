/**
 * The GSAP scroll reveals (spec gsap-animations, WI-5): AC-6 at `desktop` and `small`,
 * AC-26, AC-28, AC-29 and AC-30.
 *
 * GSAP tweens do not appear in `document.getAnimations()`, so every motion check reads a
 * frame trace (helpers/frame-trace.js) and holds the AC's own numbers. Fixed waits are only
 * the ones the ACs fix: AC-6's scroll steps, AC-28's 3 s between scrolls, AC-29's 2 s, and
 * AC-30's 300 ms between Tab presses.
 *
 * Title rule (AD-15): no title here contains the three words the AC-37 sensitivity proof
 * matches in the smoke run.
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';
import {
  FILTER_ITEM_SETS,
  ITEM_NUMBERS,
  PORTFOLIO_CONTAINER,
  PORTFOLIO_ITEM,
  PORTFOLIO_SECTION,
  portfolioFilter,
  portfolioItem,
  waitForPortfolioGrid,
} from './helpers/portfolio.js';
import {
  POSITION_TOLERANCE_PX,
  TRACE_MS,
  finishFrameTrace,
  readEffectiveOpacity,
  scrollTopAboveViewportBottom,
  seriesOf,
  startFrameTrace,
  viewportTop,
} from './helpers/frame-trace.js';
import {
  REVEAL_TARGET,
  REVEAL_TARGETS,
  expectRevealTargets,
  revealTargets,
  shownAtOnceFaults,
  traceWhileScrollingToBottom,
} from './helpers/reveals.js';

/** AC-26, AC-28, AC-29: how far above the viewport bottom a scroll puts a target's top. */
const ENTRY_INSET_PX = 40;

/** AC-26: the targets each scroll brings in, in source order; a row enters together. */
const ENTRY_GROUPS = Object.freeze([[2, 3], [4], [5], [6, 7, 8], [9, 10, 11], [12], [13]]);

/** AC-26: the tolerance of an offset the table names, and of one it gives as 0. */
const OFFSET_TOLERANCE_PX = 6;

/** AC-26 and AC-27 thresholds: "appears" and "fully opaque". */
const APPEARS_ABOVE = 0.01;
const OPAQUE_FROM = 0.99;

/** AC-26: the reveal's duration window, from appearing to settled. */
const REVEAL_DURATION_MS = Object.freeze({ min: 750, max: 1_250 });

/** AC-28: the wait between the two scrolls, and the row-start and cascade limits. */
const ROW_SCROLL_GAP_MS = 3_000;
const ROW_START_MAX_MS = 150;
const CASCADE_STEP_MS = Object.freeze({ min: 50, max: 150 });

/** AC-29: the click must land this soon after the scroll, then the grid gets 2 s. */
const FILTER_CLICK_WITHIN_MS = 200;
const FILTER_SETTLE_MS = 2_000;

/** AC-29: the frames the filter row's reveal may take to start after the scroll. */
const REVEAL_START_MAX_FRAMES = 6;

/** AC-30: the gap between Tab presses, and the Tab walk's cap (Conventions). */
const TAB_GAP_MS = 300;
const TAB_WALK_MAX_PRESSES = 120;

/** AC-30 walks every Tab stop 300 ms apart, and AC-26 waits out seven 1.5 s traces. */
const LONG_TEST_TIMEOUT_MS = 90_000;

const round = (value) => Math.round(value);

for (const [viewportName, viewport] of [
  ['desktop', desktop],
  ['small', small],
]) {
  test.describe(`at ${viewportName}`, () => {
    test.use(viewport);

    test(`AC-6: under reduced motion every reveal target is shown at once and still at ${viewportName}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/', { waitUntil: 'load' });
      await expectRevealTargets(page);

      const frames = await traceWhileScrollingToBottom(page, REVEAL_TARGETS);

      expect(
        shownAtOnceFaults(frames, REVEAL_TARGETS),
        'reveal targets that were not fully opaque and in their final place in every frame in view'
      ).toEqual([]);
    });
  });
}

test.describe('at desktop with motion allowed', () => {
  test.use(desktop);

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test("AC-26: reveals keep 5.0.0's directions, distance and duration", async ({ page }) => {
    test.setTimeout(LONG_TEST_TIMEOUT_MS);
    await page.goto('/', { waitUntil: 'load' });
    await expectRevealTargets(page);

    const problems = [];
    const measured = [];
    for (const numbers of ENTRY_GROUPS) {
      const group = revealTargets(numbers);
      const lead = page.locator(REVEAL_TARGET).nth(group[0].index);
      for (const target of group) {
        const { top, viewportHeight } = await viewportTop(
          page.locator(REVEAL_TARGET).nth(target.index)
        );
        expect(top, `${target.name} is below the viewport before its scroll`).toBeGreaterThan(
          viewportHeight
        );
      }

      const id = `entry-${numbers.join('-')}`;
      await startFrameTrace(page, id, group, { durationMs: null });
      const scrolledAt = await scrollTopAboveViewportBottom(lead, ENTRY_INSET_PX);
      const frames = await finishFrameTrace(page, id, TRACE_MS, { from: scrolledAt });

      for (const target of group) {
        const result = measureEntrance(seriesOf(frames, target.name), target);
        measured.push(result.summary);
        problems.push(...result.problems);
      }
    }

    expect(problems, `entrances measured: ${JSON.stringify(measured)}`).toEqual([]);
  });

  test('AC-28: each row of Services boxes cascades from when it enters the view', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'load' });
    await expectRevealTargets(page);
    const boxes = revealTargets([6, 7, 8, 9, 10, 11]);
    const box = (n) => page.locator(REVEAL_TARGET).nth(boxes[n - 1].index);
    const services = await viewportTop(page.locator('#services'));
    expect(services.top, '#services starts below the viewport').toBeGreaterThan(
      services.viewportHeight
    );

    await startFrameTrace(page, 'services-rows', boxes, { durationMs: null });
    const firstRowAt = await scrollTopAboveViewportBottom(box(1), ENTRY_INSET_PX);
    const box4 = await viewportTop(box(4));
    expect(box4.top, "box 4's top is below the viewport after the first scroll").toBeGreaterThan(
      box4.viewportHeight
    );
    await page.waitForTimeout(ROW_SCROLL_GAP_MS);
    const secondRowAt = await scrollTopAboveViewportBottom(box(4), ENTRY_INSET_PX);
    const frames = await finishFrameTrace(page, 'services-rows', TRACE_MS, { from: secondRowAt });

    const start = boxes.map((target, i) => {
      const appeared = seriesOf(frames, target.name).find((entry) => entry.opacity > APPEARS_ABOVE);
      const scrolledAt = i < 3 ? firstRowAt : secondRowAt;
      return appeared ? appeared.t - scrolledAt : null;
    });
    const starts = Object.fromEntries(start.map((ms, i) => [`box ${i + 1}`, ms && round(ms)]));

    expect(start, `start(n) in ms: ${JSON.stringify(starts)}`).not.toContain(null);
    expect(start[0], 'start(1) in ms').toBeLessThanOrEqual(ROW_START_MAX_MS);
    expect(start[3], 'start(4) in ms').toBeLessThanOrEqual(ROW_START_MAX_MS);
    for (const [later, earlier] of [
      [2, 1],
      [3, 2],
      [5, 4],
      [6, 5],
    ]) {
      const step = start[later - 1] - start[earlier - 1];
      expect(
        step,
        `start(${later}) − start(${earlier}) in ms (${JSON.stringify(starts)})`
      ).toBeGreaterThanOrEqual(CASCADE_STEP_MS.min);
      expect(
        step,
        `start(${later}) − start(${earlier}) in ms (${JSON.stringify(starts)})`
      ).toBeLessThanOrEqual(CASCADE_STEP_MS.max);
    }
  });

  test('AC-29: a filter change during the portfolio reveal ends in the right state', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'load' });
    await waitForPortfolioGrid(page);
    const section = page.locator(PORTFOLIO_SECTION);
    const grid = page.locator(PORTFOLIO_CONTAINER);

    // Just below the viewport, the lazy images are inside the browser's loading distance,
    // and the grid is outside the reveal observer's view, which has no root margin (AD-2).
    await section.evaluate((element) => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - window.innerHeight - 1, left: 0, behavior: 'instant' });
    });
    await expect
      .poll(
        () =>
          page
            .locator(`${PORTFOLIO_ITEM} img`)
            .evaluateAll(
              (images) =>
                images.filter((image) => !image.complete || image.naturalWidth === 0).length
            ),
        { message: 'every portfolio image has loaded, with #portfolio below the viewport' }
      )
      .toBe(0);
    const before = await viewportTop(section);
    expect(before.top, '#portfolio is below the viewport').toBeGreaterThanOrEqual(
      before.viewportHeight
    );

    const filterRow = page.locator(REVEAL_TARGET).nth(revealTargets([4])[0].index);
    const app = portfolioFilter(page, 'App');
    await app.evaluate((button) =>
      button.addEventListener(
        'click',
        () => {
          window.__revealFilterClickAt = performance.now();
        },
        { once: true }
      )
    );
    const scrolledAt = await scrollTopAboveViewportBottom(grid, ENTRY_INSET_PX);
    // The filter row enters with the grid. Its reveal starts by moving it 60 px down, so
    // the click waits for that first frame, or it would aim at the row's final box.
    expect(
      await filterRow.evaluate(
        (row, maxFrames) =>
          new Promise((resolve) => {
            let frames = 0;
            const check = () => {
              if (getComputedStyle(row).transform !== 'none') resolve(true);
              else if (++frames > maxFrames) resolve(false);
              else requestAnimationFrame(check);
            };
            check();
          }),
        REVEAL_START_MAX_FRAMES
      ),
      "the filter row's reveal has started"
    ).toBe(true);
    expect(
      await readEffectiveOpacity(grid),
      "the grid container's effective opacity before the click"
    ).toBeLessThan(1);
    // The filter row is mid-reveal and moving, so Playwright's wait for a stable element
    // would push the click past the AC's 200 ms. The click still lands on the button: this
    // early in the ease, its box moves less than 1 px per frame.
    await app.click({ force: true });
    const clickedAt = await page.evaluate(() => window.__revealFilterClickAt);
    expect(clickedAt - scrolledAt, 'ms from the scroll to the App click').toBeLessThanOrEqual(
      FILTER_CLICK_WITHIN_MS
    );
    await page.waitForTimeout(FILTER_SETTLE_MS);

    const gridBox = await grid.boundingBox();
    for (const n of ITEM_NUMBERS) {
      const item = portfolioItem(page, n);
      if (!FILTER_ITEM_SETS.App.includes(n)) {
        await expect(item, `App hides item ${n}`).toBeHidden();
        continue;
      }
      await expect(item, `App shows item ${n}`).toBeVisible();
      expect(await readEffectiveOpacity(item), `item ${n}'s effective opacity`).toBe(1);
      const itemBox = await item.boundingBox();
      expect(
        insideBox(itemBox, gridBox),
        `item ${n}'s box ${JSON.stringify(itemBox)} is inside the grid's ${JSON.stringify(gridBox)}`
      ).toBe(true);
    }
    expect(await readEffectiveOpacity(grid), "the grid container's effective opacity").toBe(1);
    expect(
      await grid.evaluate((element) => {
        const { transform } = getComputedStyle(element);
        const matrix = new DOMMatrixReadOnly(transform === 'none' ? '' : transform);
        return { x: matrix.m41, y: matrix.m42 };
      }),
      "the grid container's computed translation"
    ).toEqual({ x: 0, y: 0 });
  });

  test('AC-30: a focused element is never hidden or moved out of view', async ({ page }) => {
    test.setTimeout(LONG_TEST_TIMEOUT_MS);
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });

    await startFrameTrace(page, 'tab-walk', [], { durationMs: null, focus: true });
    for (let press = 1; press <= TAB_WALK_MAX_PRESSES; press += 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(TAB_GAP_MS);
      const backAtFirst = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body || element.tagName === 'IFRAME') return false;
        if (!window.__revealTabWalkFirst) {
          window.__revealTabWalkFirst = element;
          return false;
        }
        return element === window.__revealTabWalkFirst;
      });
      if (backAtFirst) break;
    }
    const frames = await finishFrameTrace(page, 'tab-walk', 0);

    const focusFrames = frames.filter((frame) => !frame.focus.skip);
    expect(focusFrames.length, 'frames with focus on an element').toBeGreaterThan(0);
    const faults = new Map();
    for (const { t, focus } of focusFrames) {
      if (focus.opacity >= OPAQUE_FROM && focus.inViewport) continue;
      const fault = faults.get(focus.description) ?? {
        element: focus.description,
        frames: 0,
        first: { t: round(t), opacity: focus.opacity, inViewport: focus.inViewport },
      };
      fault.frames += 1;
      faults.set(focus.description, fault);
    }
    expect(
      [...faults.values()],
      'focused elements below 0.99 effective opacity or outside the viewport'
    ).toEqual([]);
  });
});

/**
 * AC-26's table and duration for one target's trace. The final box is the last frame's.
 *
 * @param {ReturnType<typeof seriesOf>} series
 * @param {(typeof REVEAL_TARGETS)[number]} target
 * @returns {{ summary: object, problems: string[] }}
 */
function measureEntrance(series, target) {
  const final = series.at(-1);
  const appeared = series.find((entry) => entry.opacity > APPEARS_ABOVE);
  if (!final || !appeared) {
    return { summary: { target: target.name }, problems: [`${target.name}: never appeared`] };
  }
  const offset = { x: appeared.x - final.x, y: appeared.y - final.y };
  const settled = series.find(
    (entry) =>
      entry.t >= appeared.t &&
      entry.opacity >= OPAQUE_FROM &&
      Math.abs(entry.x - final.x) <= POSITION_TOLERANCE_PX &&
      Math.abs(entry.y - final.y) <= POSITION_TOLERANCE_PX
  );
  const durationMs = settled ? settled.t - appeared.t : null;
  const summary = {
    target: target.name,
    dx: round(offset.x),
    dy: round(offset.y),
    durationMs: durationMs && round(durationMs),
  };

  const problems = [];
  for (const axis of ['x', 'y']) {
    const expected = target.offset[axis];
    const tolerance = expected === 0 ? POSITION_TOLERANCE_PX : OFFSET_TOLERANCE_PX;
    if (Math.abs(offset[axis] - expected) > tolerance) {
      problems.push(
        `${target.name}: ${axis} offset ${offset[axis]} is not ${expected} ± ${tolerance}`
      );
    }
  }
  if (durationMs === null) {
    problems.push(`${target.name}: never settled fully opaque in place`);
  } else if (durationMs < REVEAL_DURATION_MS.min || durationMs > REVEAL_DURATION_MS.max) {
    problems.push(`${target.name}: took ${durationMs} ms to settle`);
  }
  return { summary, problems };
}

/**
 * Whether `inner` lies inside `outer`, within 1 px on each side.
 *
 * @param {{ x: number, y: number, width: number, height: number }} inner
 * @param {{ x: number, y: number, width: number, height: number }} outer
 */
function insideBox(inner, outer) {
  return (
    inner.x >= outer.x - POSITION_TOLERANCE_PX &&
    inner.y >= outer.y - POSITION_TOLERANCE_PX &&
    inner.x + inner.width <= outer.x + outer.width + POSITION_TOLERANCE_PX &&
    inner.y + inner.height <= outer.y + outer.height + POSITION_TOLERANCE_PX
  );
}
