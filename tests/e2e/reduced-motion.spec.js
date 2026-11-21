/**
 * Live switches of the reduced-motion preference (spec gsap-animations, AC-14). PR-1
 * (WI-5) adds case 2, the reveals; PR-2 (WI-9) adds case 1, the hero; the later sprint 3
 * PRs add the other cases.
 *
 * A live switch is `page.emulateMedia` after `load`, with no reload, and the case's
 * trigger starts 500 ms after it (§2.3 Conventions). Case 1 names its own times instead.
 */
import { test, expect } from './fixtures.js';
import { desktop } from './viewports.js';
import {
  finishFrameTrace,
  seriesOf,
  startFrameTrace,
  waitUntilAfterLoad,
} from './helpers/frame-trace.js';
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
