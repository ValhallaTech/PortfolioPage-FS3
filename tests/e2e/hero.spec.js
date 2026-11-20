/**
 * The hero entrance (spec gsap-animations, WI-5): AC-22 at `desktop` and `small`, and
 * AC-27.
 *
 * An init script starts a frame trace of the hero container from the first frame in which
 * it is in the document (helpers/frame-trace.js), and the trace runs until 3 s after
 * `load`. Each test gets a fresh browser context, so the cache is empty, as AC-22 asks.
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';
import {
  describeFrame,
  finishFrameTrace,
  movementFaults,
  seriesOf,
  traceFromFirstFrame,
} from './helpers/frame-trace.js';

const HERO_CONTAINER = { name: 'hero container', selector: '.hero-container' };

/** AC-22: the trace runs this long after `load`, and the opacity may dip by this much. */
const TRACE_AFTER_LOAD_MS = 3_000;
const DIP_TOLERANCE = 0.01;

/** AC-27: hidden, fully visible, and the fade's duration window. */
const HIDDEN_AT_MOST = 0.01;
const OPAQUE_FROM = 0.99;
const FADE_MS = Object.freeze({ min: 750, max: 1_250 });

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

      let highest = 0;
      const dips = [];
      for (const entry of series) {
        highest = Math.max(highest, entry.opacity);
        if (highest - entry.opacity > DIP_TOLERANCE) {
          dips.push({ t: Math.round(entry.t), highest, opacity: entry.opacity });
        }
      }

      expect(dips, 'frames whose opacity fell more than 0.01 below the highest so far').toEqual([]);
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
});
