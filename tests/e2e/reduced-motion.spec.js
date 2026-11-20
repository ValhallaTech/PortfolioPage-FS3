/**
 * Live switches of the reduced-motion preference (spec gsap-animations, AC-14). PR-1
 * (WI-5) adds case 2, the reveals; the later sprint 3 PRs add the other cases.
 *
 * A live switch is `page.emulateMedia` after `load`, with no reload, and the case's
 * trigger starts 500 ms after it (§2.3 Conventions).
 */
import { test, expect } from './fixtures.js';
import { desktop } from './viewports.js';
import {
  expectRevealTargets,
  revealTargets,
  shownAtOnceFaults,
  traceWhileScrollingToBottom,
} from './helpers/reveals.js';

/** The Conventions' gap between a live switch and the case's trigger. */
const SWITCH_TO_TRIGGER_MS = 500;

test.describe('at desktop', () => {
  test.use(desktop);

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
