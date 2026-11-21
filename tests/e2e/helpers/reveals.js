import { expect } from '../fixtures.js';
import { scrollToBottomInSteps } from './full-visit.js';
import {
  POSITION_TOLERANCE_PX,
  TRACE_MS,
  describeFrame,
  finishFrameTrace,
  seriesOf,
  startFrameTrace,
} from './frame-trace.js';

/**
 * The 13 reveal targets (spec gsap-animations §2.3 Conventions), by their AD-3 hook. Every
 * target carries `data-reveal`, in source order, so target N is the Nth `[data-reveal]`
 * element (AD-7, "reveal targets `[data-reveal]` (13)").
 */
export const REVEAL_TARGET = '[data-reveal]';

/** Each target's number, name, and the offset AC-26 expects it to start from. */
const TARGET_ROLES = [
  { number: 1, name: 'hero container', offset: null },
  { number: 2, name: 'About photo column', offset: { x: 60, y: 0 } },
  { number: 3, name: 'About text column', offset: { x: -60, y: 0 } },
  { number: 4, name: 'portfolio filter row', offset: { x: 0, y: 60 } },
  { number: 5, name: 'portfolio grid container', offset: { x: 0, y: 60 } },
  ...[1, 2, 3, 4, 5, 6].map((box) => ({
    number: 5 + box,
    name: `Services box ${box}`,
    offset: { x: 0, y: 60 },
  })),
  { number: 12, name: 'testimonial carousel', offset: { x: 0, y: 60 } },
  { number: 13, name: 'contact row', offset: { x: 0, y: 0 } },
];

/** The reveal targets as frame-trace targets, in source order. */
export const REVEAL_TARGETS = Object.freeze(
  TARGET_ROLES.map((role) =>
    Object.freeze({ ...role, selector: REVEAL_TARGET, index: role.number - 1 })
  )
);

/**
 * The reveal targets with the given numbers, 1 to 13.
 *
 * @param {number[]} numbers
 */
export function revealTargets(numbers) {
  return REVEAL_TARGETS.filter((target) => numbers.includes(target.number));
}

/**
 * Asserts that the page carries exactly the 13 reveal targets, so a trace by index reads
 * the roles the Conventions name.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function expectRevealTargets(page) {
  await expect(page.locator(REVEAL_TARGET), 'the reveal targets').toHaveCount(
    REVEAL_TARGETS.length
  );
}

/**
 * AC-6's scroll and trace: a frame trace of `targets` from now, while the page scrolls to
 * the bottom in 400 px steps, 100 ms apart, until 1.5 s after the last step.
 *
 * @param {import('@playwright/test').Page} page
 * @param {typeof REVEAL_TARGETS} targets
 */
export async function traceWhileScrollingToBottom(page, targets) {
  const id = 'scroll-to-bottom';
  await startFrameTrace(page, id, targets, { durationMs: null });
  await scrollToBottomInSteps(page);
  return finishFrameTrace(page, id, TRACE_MS);
}

/**
 * AC-6's assertion: in every frame in which a target's box intersects the viewport, its
 * effective opacity is 1 and its document-relative `x` and `y` are within 1 px of their
 * values in the last frame. Returns one entry per target that breaks it, or that was never
 * in the viewport, so the assertion cannot pass on an empty trace.
 *
 * @param {object[]} frames
 * @param {typeof REVEAL_TARGETS} targets
 */
export function shownAtOnceFaults(frames, targets) {
  const faults = [];
  for (const target of targets) {
    const series = seriesOf(frames, target.name);
    const inView = series.filter((entry) => entry.inViewport);
    if (inView.length === 0) {
      faults.push({ target: target.name, fault: 'never in the viewport' });
      continue;
    }
    const last = series.at(-1);
    const bad = inView.filter(
      (entry) =>
        entry.opacity !== 1 ||
        Math.abs(entry.x - last.x) > POSITION_TOLERANCE_PX ||
        Math.abs(entry.y - last.y) > POSITION_TOLERANCE_PX
    );
    if (bad.length > 0) {
      faults.push({
        target: target.name,
        badFrames: `${bad.length} of ${inView.length} in view`,
        first: describeFrame(bad[0], last),
      });
    }
  }
  return faults;
}

/**
 * AC-19's second check: each of the 13 reveal targets has effective opacity 1, and its
 * computed `transform` is `none`, or a matrix with zero translation and a scale of 1. Returns
 * one entry per target that breaks it, and one per missing target. It works with JavaScript
 * off, because Playwright's evaluate runs regardless.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function revealTargetsAtRestFaults(page) {
  const states = await page.locator(REVEAL_TARGET).evaluateAll((elements) =>
    elements.map((element) => {
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility !== 'visible') {
          opacity = 0;
          break;
        }
        opacity *= Number.parseFloat(style.opacity);
      }
      const { transform } = getComputedStyle(element);
      let atRest = transform === 'none';
      if (!atRest) {
        const m = new DOMMatrixReadOnly(transform);
        const near = (value, expected) => Math.abs(value - expected) < 1e-6;
        atRest =
          near(m.m41, 0) &&
          near(m.m42, 0) &&
          near(m.m43, 0) &&
          near(Math.hypot(m.m11, m.m12, m.m13), 1) &&
          near(Math.hypot(m.m21, m.m22, m.m23), 1) &&
          near(Math.hypot(m.m31, m.m32, m.m33), 1);
      }
      return { opacity, transform, atRest };
    })
  );
  const faults = [];
  for (const target of REVEAL_TARGETS) {
    const state = states[target.index];
    if (!state) {
      faults.push({ target: target.name, fault: 'missing' });
    } else if (state.opacity !== 1 || !state.atRest) {
      faults.push({ target: target.name, opacity: state.opacity, transform: state.transform });
    }
  }
  return faults;
}
