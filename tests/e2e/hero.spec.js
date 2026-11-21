/**
 * The hero (spec gsap-animations). WI-5: the entrance, AC-22 at `desktop` and `small`, and
 * AC-27. WI-9: the hero sentence and the typing, AC-7, AC-18, AC-20, AC-21, AC-23 and AC-32,
 * and a guard for R-17 (AC-22) on the late-script path of AD-5.
 *
 * Init scripts start frame traces from the first frame in which an element is in the
 * document (helpers/frame-trace.js). Each test gets a fresh browser context, so the cache is
 * empty, as AC-22 asks. A JS bundle is every same-origin `.js` response the page loads
 * (Conventions). AC-18 and AC-32 wait 30 s or more, so they carry `@slow` (AD-15).
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';
import { fullVisit, scrollToBottomInSteps } from './helpers/full-visit.js';
import {
  describeFrame,
  finishFrameTrace,
  firstFrameWith,
  mostTransitionsInOneSecond,
  movementFaults,
  readEffectiveOpacity,
  seriesOf,
  traceFromFirstFrame,
  waitUntilAfterLoad,
} from './helpers/frame-trace.js';
import {
  HERO,
  HERO_CONTAINER as HERO_CONTAINER_SELECTOR,
  HERO_LINE,
  HERO_SCRIPT_OWNED,
  HERO_SENTENCE,
  HERO_SHOWN,
  HERO_TYPING,
  TYPED_CURSOR,
  TYPED_ELEMENT,
  readVisibleHeroLine,
} from './helpers/hero.js';
import {
  REVEAL_TARGETS,
  expectRevealTargets,
  revealTargetsAtRestFaults,
} from './helpers/reveals.js';
import { installTypingRecorder } from './helpers/typing.js';

const HERO_CONTAINER = { name: 'hero container', selector: HERO_CONTAINER_SELECTOR };

/** AC-22: the trace runs this long after `load`, and the opacity may dip by this much. */
const TRACE_AFTER_LOAD_MS = 3_000;
const DIP_TOLERANCE = 0.01;

/** AC-27: hidden, fully visible, and the fade's duration window. */
const HIDDEN_AT_MOST = 0.01;
const OPAQUE_FROM = 0.99;
const FADE_MS = Object.freeze({ min: 750, max: 1_250 });

/** AC-7: the trace runs this long after `load`. */
const STATIC_TRACE_AFTER_LOAD_MS = 5_000;

/** AC-18: when the accessibility tree is read, and what counts as a live region. */
const SNAPSHOT_AFTER_LOAD_MS = Object.freeze([2_000, 4_000, 8_000, 15_000, 30_000]);
const LIVE_REGION =
  '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"], [role="marquee"], [role="timer"]';
const AC_18_TIMEOUT_MS = 60_000;

/** AC-20: how long after `load` the page is read, and the injected script and its error. */
const FAILED_SCRIPT_SETTLE_MS = 5_000;
const INJECTED_MESSAGE = 'injected failure';
const INJECTED_BODY = `throw new Error('${INJECTED_MESSAGE}');`;

/** AC-21: how long every JS bundle is held, and when the hero is read. */
const SLOW_SCRIPT_HOLD_MS = 10_000;
const SLOW_SCRIPT_READ_MS = 5_000;

/** AC-23: the trace runs this long after `load`; the first phrase the typing types. */
const TYPING_TRACE_AFTER_LOAD_MS = 5_000;
const FIRST_PHRASE = 'a Designer';

/** AC-32: the wait after the full visit, and the most transitions in one second. */
const AFTER_FULL_VISIT_MS = 30_000;
const MAX_TRANSITIONS_PER_SECOND = 6;
const AC_32_TIMEOUT_MS = 120_000;

/**
 * The late-script guard: every JS bundle is held until this long after the hero first
 * renders, inside the CSS fallback's fade (2 s delay, then 1 s; AD-5).
 */
const LATE_SCRIPT_AFTER_RENDER_MS = 2_500;
const POLL_MS = 20;

/**
 * Loads `/` with motion allowed and returns the hero container's trace, from the first
 * frame in which it is in the document until 3 s after `load`.
 *
 * @param {import('@playwright/test').Page} page
 */
async function traceHeroEntrance(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await traceFromFirstFrame(page, 'hero', [HERO_CONTAINER]);
  await page.goto('/', { waitUntil: 'load' });
  const frames = await finishFrameTrace(page, 'hero', TRACE_AFTER_LOAD_MS, { from: 'load' });
  return seriesOf(frames, HERO_CONTAINER.name);
}

/**
 * AC-22's check: the frames whose effective opacity is more than 0.01 below the highest
 * effective opacity of any frame up to them.
 *
 * @param {ReturnType<typeof seriesOf>} series
 */
function opacityDips(series) {
  let highest = 0;
  const dips = [];
  for (const entry of series) {
    highest = Math.max(highest, entry.opacity);
    if (highest - entry.opacity > DIP_TOLERANCE) {
      dips.push({ t: Math.round(entry.t), highest, opacity: entry.opacity });
    }
  }
  return dips;
}

/**
 * A `page.route` matcher for every JS bundle: a same-origin `.js` request.
 *
 * @param {string} baseURL
 * @returns {(url: URL) => boolean}
 */
function jsBundles(baseURL) {
  const { origin } = new URL(baseURL);
  return (url) => url.origin === origin && url.pathname.endsWith('.js');
}

/**
 * Waits for a running trace's first frame with the named target in it, and returns its
 * page time.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {string} name
 */
async function waitForFirstFrameWith(page, id, name) {
  for (;;) {
    const t = await firstFrameWith(page, id, name);
    if (t !== null) return t;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

for (const [viewportName, viewport] of [
  ['desktop', desktop],
  ['small', small],
]) {
  test.describe(`at ${viewportName}`, () => {
    test.use(viewport);

    test(`AC-22: the hero never vanishes once it has started to appear at ${viewportName}`, async ({
      page,
    }) => {
      const series = await traceHeroEntrance(page);
      expect(series.length, 'frames with the hero container in the document').toBeGreaterThan(0);

      expect(
        opacityDips(series),
        'frames whose opacity fell more than 0.01 below the highest so far'
      ).toEqual([]);
    });
  });
}

test.describe('at desktop', () => {
  test.use(desktop);

  test('AC-27: with motion allowed, the hero fades in once without moving', async ({ page }) => {
    const series = await traceHeroEntrance(page);
    const first = series[0];
    const last = series.at(-1);
    expect(first, 'a frame with the hero container in the document').toBeTruthy();

    expect(movementFaults(series), 'frames in which the shown hero is off its final box').toEqual(
      []
    );
    expect(
      first.opacity,
      `the first frame's effective opacity (${JSON.stringify(describeFrame(first, last))})`
    ).toBeLessThanOrEqual(HIDDEN_AT_MOST);
    expect(last.opacity, "the last frame's effective opacity").toBe(1);

    const lastHidden = series.findLast((entry) => entry.opacity <= HIDDEN_AT_MOST);
    const firstOpaque = series.find(
      (entry) => entry.t > lastHidden.t && entry.opacity >= OPAQUE_FROM
    );
    expect(firstOpaque, 'a frame at 0.99 or more after the last hidden frame').toBeTruthy();
    const fadeMs = firstOpaque.t - lastHidden.t;
    expect(
      fadeMs,
      'ms from the last hidden frame to the first fully opaque one'
    ).toBeGreaterThanOrEqual(FADE_MS.min);
    expect(
      fadeMs,
      'ms from the last hidden frame to the first fully opaque one'
    ).toBeLessThanOrEqual(FADE_MS.max);
  });

  test('AC-22: a script arriving mid-fallback never dims the hero', async ({ page, baseURL }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await traceFromFirstFrame(page, 'hero', [HERO_CONTAINER]);
    const arrivals = [];
    await page.route(jsBundles(baseURL), async (route) => {
      const response = await route.fetch();
      const renderedAt = await waitForFirstFrameWith(page, 'hero', HERO_CONTAINER.name);
      const now = await page.evaluate(() => performance.now());
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, renderedAt + LATE_SCRIPT_AFTER_RENDER_MS - now))
      );
      const opacity = await readEffectiveOpacity(page.locator(HERO_CONTAINER_SELECTOR));
      arrivals.push({ url: route.request().url(), opacity });
      await route.fulfill({ response });
    });
    await page.goto('/', { waitUntil: 'load' });
    const frames = await finishFrameTrace(page, 'hero', TRACE_AFTER_LOAD_MS, { from: 'load' });
    const series = seriesOf(frames, HERO_CONTAINER.name);

    expect(arrivals.length, 'JS bundles held and then fulfilled').toBeGreaterThan(0);
    for (const { url, opacity } of arrivals) {
      expect(opacity, `the hero's effective opacity as ${url} arrived`).toBeGreaterThan(0);
      expect(opacity, `the hero's effective opacity as ${url} arrived`).toBeLessThan(1);
    }
    expect(
      opacityDips(series),
      'frames whose opacity fell more than 0.01 below the highest so far'
    ).toEqual([]);
    expect(series.at(-1).opacity, "the last frame's effective opacity").toBe(1);

    const container = page.locator(HERO_CONTAINER_SELECTOR);
    await expect(container, 'the hero is marked shown').toHaveClass(
      new RegExp(`\\b${HERO_SHOWN}\\b`)
    );
    await expect(container, 'the script never took over the fade').not.toHaveClass(
      new RegExp(`\\b${HERO_SCRIPT_OWNED}\\b`)
    );
    await expect(page.locator(HERO_LINE), 'the hero line never typed').not.toHaveClass(
      new RegExp(`\\b${HERO_TYPING}\\b`)
    );
    expect(await page.locator(TYPED_ELEMENT).textContent(), 'the typed text').toBe('');
    expect(await readVisibleHeroLine(page), 'the visible hero line').toBe(HERO_SENTENCE);
  });

  test('AC-7: under reduced motion, the hero shows the full sentence as static text', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const targets = [
      HERO_CONTAINER,
      { name: 'hero line', selector: HERO_LINE, text: true },
      { name: 'hero', selector: HERO, descendants: true },
    ];
    await traceFromFirstFrame(page, 'hero', targets);
    await page.goto('/', { waitUntil: 'load' });
    const frames = await finishFrameTrace(page, 'hero', STATIC_TRACE_AFTER_LOAD_MS, {
      from: 'load',
    });

    const traced = frames.filter((frame) => frame.targets[HERO_CONTAINER.name]);
    expect(traced.length, 'frames with the hero container in the document').toBeGreaterThan(0);
    const at = (frame) => Math.round(frame.t);
    expect(
      traced
        .filter((frame) => frame.targets[HERO_CONTAINER.name].opacity !== 1)
        .map((frame) => ({ t: at(frame), opacity: frame.targets[HERO_CONTAINER.name].opacity })),
      "frames in which the hero container's effective opacity is not 1"
    ).toEqual([]);
    expect(
      traced
        .filter((frame) => frame.targets['hero line']?.text !== HERO_SENTENCE)
        .map((frame) => ({ t: at(frame), text: frame.targets['hero line']?.text ?? null })),
      'frames whose visible hero line is not the hero sentence'
    ).toEqual([]);

    const firstOpacities = traced[0].targets.hero?.descendantOpacities;
    expect(firstOpacities, 'the effective opacity of every element in #hero').toBeTruthy();
    expect(
      traced
        .filter(
          (frame) =>
            JSON.stringify(frame.targets.hero?.descendantOpacities) !==
            JSON.stringify(firstOpacities)
        )
        .map((frame) => ({ t: at(frame), opacities: frame.targets.hero?.descendantOpacities })),
      `frames in which an element in #hero differs from the first frame ${JSON.stringify(firstOpacities)}`
    ).toEqual([]);
  });

  for (const failure of [
    { id: 'a', does: 'is aborted', answer: (route) => route.abort() },
    {
      id: 'b',
      does: 'throws',
      answer: (route) =>
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/javascript' },
          body: INJECTED_BODY,
        }),
    },
  ]) {
    test(`AC-20 case (${failure.id}): when every JS bundle ${failure.does}, the hero sentence and every reveal target are visible`, async ({
      page,
      baseURL,
      pageErrors,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const answered = [];
      await page.route(jsBundles(baseURL), async (route) => {
        answered.push(route.request().url());
        await failure.answer(route);
      });
      await page.goto('/', { waitUntil: 'load' });
      await waitUntilAfterLoad(page, FAILED_SCRIPT_SETTLE_MS);
      await expectRevealTargets(page);
      await scrollToBottomInSteps(page);

      expect(answered.length, 'JS bundles answered by the route').toBeGreaterThan(0);
      expect(await readVisibleHeroLine(page), 'the visible hero line').toBe(HERO_SENTENCE);
      expect(
        await revealTargetsAtRestFaults(page),
        'reveal targets not fully opaque, or translated or scaled'
      ).toEqual([]);
      if (failure.id === 'b') {
        expect([...pageErrors], 'page errors: one per JS bundle, each the injected one').toEqual(
          answered.map(() => INJECTED_MESSAGE)
        );
        // Asserted in full just above, so the fixture's no-page-error check is not re-run
        // on the errors this case injects on purpose.
        pageErrors.length = 0;
      }
    });
  }

  test('AC-21: while the page script is slow to arrive, the hero is visible', async ({
    page,
    baseURL,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const bundles = { held: 0, fulfilled: 0 };
    await page.route(jsBundles(baseURL), async (route) => {
      bundles.held += 1;
      await new Promise((resolve) => setTimeout(resolve, SLOW_SCRIPT_HOLD_MS));
      await route.fulfill({ response: await route.fetch() });
      bundles.fulfilled += 1;
    });
    const startedAt = Date.now();
    await page.goto('/', { waitUntil: 'commit' });
    await page.locator(HERO_LINE).waitFor({ state: 'attached' });
    await page.waitForTimeout(Math.max(0, SLOW_SCRIPT_READ_MS - (Date.now() - startedAt)));

    const fulfilledAtRead = bundles.fulfilled;
    const opacity = await readEffectiveOpacity(page.locator(HERO_CONTAINER_SELECTOR));
    const heroLine = await readVisibleHeroLine(page);
    // The held bundles are never released; their handlers end with the page.
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    expect(bundles.held, 'JS bundles held by the route').toBeGreaterThan(0);
    expect(fulfilledAtRead, 'JS bundles fulfilled 5 s after navigation started').toBe(0);
    expect(opacity, "the hero container's effective opacity").toBe(1);
    expect(heroLine, 'the visible hero line').toBe(HERO_SENTENCE);
  });

  test('AC-23: typing starts only after the hero has fully appeared', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await traceFromFirstFrame(page, 'hero', [HERO_CONTAINER]);
    await page.addInitScript(installTypingRecorder, TYPED_ELEMENT);
    await page.goto('/', { waitUntil: 'load' });
    const frames = await finishFrameTrace(page, 'hero', TYPING_TRACE_AFTER_LOAD_MS, {
      from: 'load',
    });
    const recording = await page.evaluate(() => ({
      domContentLoadedAt: window.__typingRecording.domContentLoadedAt,
      changes: window.__typingRecording.changes.map((change) => ({ ...change })),
    }));

    // Both records start at DOMContentLoaded (AC-23's Given).
    const series = seriesOf(frames, HERO_CONTAINER.name).filter(
      (entry) => entry.t >= recording.domContentLoadedAt
    );
    const full = series.find((entry) => entry.opacity >= OPAQUE_FROM);
    expect(full, 'a frame in which the hero is at 0.99 or more').toBeTruthy();
    const firstTyped = recording.changes.find(
      ({ text }) =>
        text.length > 0 && text.length < FIRST_PHRASE.length && FIRST_PHRASE.startsWith(text)
    );
    expect(firstTyped, `a change to a non-empty proper prefix of "${FIRST_PHRASE}"`).toBeTruthy();

    expect(
      Math.round(firstTyped.at - full.t),
      'ms from the first fully visible frame to the first typed character'
    ).toBeGreaterThanOrEqual(0);
  });

  test(
    'AC-32: nothing flashes more than three times per second',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(AC_32_TIMEOUT_MS);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const targets = [
        { name: 'typing element', selector: TYPED_ELEMENT },
        { name: 'typing cursor', selector: TYPED_CURSOR },
        ...REVEAL_TARGETS,
      ];
      await traceFromFirstFrame(page, 'flash', targets);
      await fullVisit(page);
      await page.waitForTimeout(AFTER_FULL_VISIT_MS);
      const frames = await finishFrameTrace(page, 'flash', 0);
      const loadAt = await page.evaluate(
        () => performance.getEntriesByType('navigation')[0].loadEventEnd
      );
      const fromLoad = frames.filter((frame) => frame.t >= loadAt);
      expect(fromLoad.length, 'frames traced from load').toBeGreaterThan(0);

      const counts = targets.map(({ name }) => ({
        name,
        frames: seriesOf(fromLoad, name).length,
        mostTransitions: mostTransitionsInOneSecond(seriesOf(fromLoad, name)),
      }));
      expect(
        counts.filter(({ frames: traced }) => traced === 0).map(({ name }) => name),
        'traced elements never in the document'
      ).toEqual([]);
      expect(
        counts.filter(({ mostTransitions }) => mostTransitions > MAX_TRANSITIONS_PER_SECOND),
        'traced elements with more than 6 transitions in a 1 000 ms window'
      ).toEqual([]);
    }
  );
});

for (const screenReaderCase of [
  { name: 'with motion allowed', reducedMotion: 'no-preference', javaScriptEnabled: true },
  { name: 'under reduced motion', reducedMotion: 'reduce', javaScriptEnabled: true },
  { name: 'with JavaScript off', reducedMotion: 'no-preference', javaScriptEnabled: false },
]) {
  test.describe(`at desktop ${screenReaderCase.name}`, () => {
    test.use({ ...desktop, javaScriptEnabled: screenReaderCase.javaScriptEnabled });

    test(
      `AC-18: screen readers get the hero sentence once, and it never changes, ${screenReaderCase.name}`,
      { tag: '@slow' },
      async ({ page }) => {
        test.setTimeout(AC_18_TIMEOUT_MS);
        await page.emulateMedia({ reducedMotion: screenReaderCase.reducedMotion });
        await page.goto('/', { waitUntil: 'load' });

        const snapshots = [];
        for (const afterMs of SNAPSHOT_AFTER_LOAD_MS) {
          await waitUntilAfterLoad(page, afterMs);
          snapshots.push(await page.locator(HERO).ariaSnapshot());
        }

        expect(snapshots, 'the #hero snapshots at 2, 4, 8, 15 and 30 s').toEqual(
          snapshots.map(() => snapshots[0])
        );
        const collapsed = snapshots[0].replace(/\s+/g, ' ');
        expect(
          collapsed.split(HERO_SENTENCE).length - 1,
          `times the hero sentence appears in ${JSON.stringify(snapshots[0])}`
        ).toBe(1);
        await expect(page.locator(HERO).locator(LIVE_REGION), 'live regions in #hero').toHaveCount(
          0
        );
      }
    );
  });
}
