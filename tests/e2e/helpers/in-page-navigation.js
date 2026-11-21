import { expect } from '../fixtures.js';
import {
  POSITION_TOLERANCE_PX,
  TRACE_MS,
  finishFrameTrace,
  startFrameTrace,
  waitForTwoFrames,
} from './frame-trace.js';

/**
 * In-page navigation for the scrolling and focus ACs (spec gsap-animations AC-8, AC-14 case 3,
 * AC-15 case 1, AC-33, AC-34 and AC-36): the nav links, the menu button, back-to-top, a
 * `scrollY` frame trace around a trigger, and the Conventions' "scroll settles".
 */

/** How long `scrollY` must stay unchanged for the scroll to have settled (AC-33, AC-34). */
export const SETTLE_MS = 500;

/** The longest a scroll may take to settle before the wait gives up. */
const SETTLE_TIMEOUT_MS = 10_000;

/**
 * The nav link named `name` in the primary navigation.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Home' | 'About' | 'Portfolio' | 'Services' | 'Contact'} name
 */
export function navLink(page, name) {
  return page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name, exact: true });
}

/**
 * The button that opens and closes the mobile nav.
 *
 * @param {import('@playwright/test').Page} page
 */
export function menuButton(page) {
  return page.getByRole('button', { name: 'Navigation menu' });
}

/**
 * The back-to-top link.
 *
 * @param {import('@playwright/test').Page} page
 */
export function backToTop(page) {
  return page.getByRole('link', { name: 'Back to top' });
}

/**
 * Scrolls instantly to `#contact` and waits until back-to-top shows, so AC-8 case 4 and
 * AC-36 case 2 can click it.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function scrollToContact(page) {
  await page
    .locator('#contact')
    .evaluate((section) => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect(backToTop(page), 'back-to-top shows once the page is scrolled').toHaveClass(
    /\bis-visible\b/
  );
}

/**
 * Runs `trigger` with a frame trace of `window.scrollY` that starts just before it and ends
 * 1.5 s after it (Conventions, "Frame trace"), and returns the recorded `scrollY` values.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id - Names the trace
 * @param {() => Promise<void>} trigger
 * @returns {Promise<number[]>}
 */
export async function traceScrollY(page, id, trigger) {
  await startFrameTrace(page, id, [], { durationMs: null });
  await waitForTwoFrames(page);
  await trigger();
  const frames = await finishFrameTrace(page, id, TRACE_MS);
  return frames.map((frame) => frame.scrollY);
}

/**
 * The trace's first and last values and the values more than 1 px from both, rounded, for
 * a jump or glide failure message.
 *
 * @param {number[]} scrollYs
 */
export function describeScroll(scrollYs) {
  const first = scrollYs[0];
  const last = scrollYs.at(-1);
  const between = scrollYs.filter(
    (value) =>
      Math.abs(value - first) > POSITION_TOLERANCE_PX &&
      Math.abs(value - last) > POSITION_TOLERANCE_PX
  );
  return {
    frames: scrollYs.length,
    first: Math.round(first),
    last: Math.round(last),
    between: between.map(Math.round),
  };
}

/**
 * Waits until the scroll settles: `scrollY` unchanged for 500 ms (AC-33, AC-34).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function waitForScrollToSettle(page) {
  const settled = await page.evaluate(
    ({ settleMs, timeoutMs }) =>
      new Promise((resolve) => {
        const started = performance.now();
        let lastY = window.scrollY;
        let since = started;
        const tick = (now) => {
          if (window.scrollY !== lastY) {
            lastY = window.scrollY;
            since = now;
          }
          if (now - since >= settleMs) resolve(true);
          else if (now - started >= timeoutMs) resolve(false);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { settleMs: SETTLE_MS, timeoutMs: SETTLE_TIMEOUT_MS }
  );
  expect(settled, `scrollY stays unchanged for ${SETTLE_MS} ms`).toBe(true);
}
