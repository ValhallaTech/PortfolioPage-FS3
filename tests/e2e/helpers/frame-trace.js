/**
 * Frame traces for the motion ACs (spec gsap-animations §2.3 Conventions, AD-15).
 *
 * GSAP tweens do not appear in `document.getAnimations()`, so the motion ACs read what the
 * page draws instead: a `requestAnimationFrame` loop in the page records, each frame,
 * `performance.now()`, `window.scrollY` and, for each traced element, its box and its
 * effective opacity. Optionally it also records `document.activeElement`. Each frame is
 * read once all of its animation-frame callbacks have run, GSAP's included, so a record
 * holds what that frame drew, not the frame before it.
 *
 * - Boxes are document-relative (`rect.x + scrollX`, `rect.y + scrollY`) for elements in
 *   the page flow, and viewport-relative for a target marked `fixed` (the sidebar, the
 *   dialog, the lightbox and back-to-top). A focused element's box is viewport-relative.
 * - **Effective opacity** is the product of the computed `opacity` of the element and every
 *   ancestor, and 0 when the element or an ancestor has `display: none` or a computed
 *   `visibility` other than `visible`. An element is **shown** when it is above 0.
 * - Times are the page's `performance.now()`, so a trigger time read in the page (a scroll,
 *   a click, `load`) compares with frame times directly.
 *
 * The analysis helpers below (no movement, jump, glide, flash count) are pure functions
 * over the recorded frames, so each test states its AC's numbers and nothing else.
 */

/** The window property the in-page tracer lives under. */
const TRACER = '__gsapFrameTrace';

/** A trace's default length from its trigger (Conventions, "Frame trace"). */
export const TRACE_MS = 1_500;

/** The tolerance of "no movement", "jump" and "glide" (Conventions). */
export const POSITION_TOLERANCE_PX = 1;

/** The opacity a flash crosses, and the window the flash count reads (Conventions). */
const FLASH_THRESHOLD = 0.5;
const FLASH_WINDOW_MS = 1_000;

/**
 * Runs in the page, as an init script or through `evaluate`, so it is self-contained.
 * Installs the tracer once per document, then starts the trace in `start` if given.
 *
 * @param {{ tracer: string, start: null | { id: string, targets: object[], options: object } }} arg
 */
function frameTracerScript({ tracer, start }) {
  // An init script also runs in every iframe, such as the map; only the page is traced.
  if (window !== window.top) return;
  if (!window[tracer]) {
    const effectiveOpacity = (element) => {
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility !== 'visible') return 0;
        opacity *= Number.parseFloat(style.opacity);
      }
      return opacity;
    };

    const measure = (element, fixed) => {
      const rect = element.getBoundingClientRect();
      const dx = fixed ? 0 : window.scrollX;
      const dy = fixed ? 0 : window.scrollY;
      return {
        x: rect.x + dx,
        y: rect.y + dy,
        width: rect.width,
        height: rect.height,
        inViewport:
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth,
        opacity: effectiveOpacity(element),
      };
    };

    const describe = (element) => {
      const id = element.id ? `#${element.id}` : '';
      const classes = element.classList.length ? `.${[...element.classList].join('.')}` : '';
      const href = element.getAttribute('href');
      return `${element.tagName.toLowerCase()}${id}${classes}${href ? `[href="${href}"]` : ''}`;
    };

    const focusRecord = () => {
      const element = document.activeElement;
      if (!element || element === document.body || element === document.documentElement) {
        return { skip: 'body' };
      }
      if (element.tagName === 'IFRAME') return { skip: 'iframe' };
      return { description: describe(element), ...measure(element, true) };
    };

    const traces = new Map();
    window[tracer] = {
      start(id, targets, { durationMs = null, focus = false } = {}) {
        const trace = { frames: [], endsAt: Infinity, done: null };
        if (durationMs !== null) trace.endsAt = performance.now() + durationMs;
        trace.done = new Promise((resolve) => {
          // GSAP renders in its own requestAnimationFrame callback, which may run after this
          // one in the same frame. So the frame's time is taken here, and the page is read
          // in a task posted from here, which runs once every callback of the frame has
          // run: the state read is the one the frame drew.
          const channel = new MessageChannel();
          const frameTimes = [];
          channel.port1.onmessage = () => {
            const t = frameTimes.shift();
            const frame = { t, scrollY: window.scrollY, targets: {} };
            for (const { name, selector, index = 0, fixed = false } of targets) {
              const element = document.querySelectorAll(selector)[index];
              frame.targets[name] = element ? measure(element, fixed) : null;
            }
            if (focus) frame.focus = focusRecord();
            trace.frames.push(frame);
            if (t >= trace.endsAt) {
              channel.port1.close();
              resolve(trace.frames);
            }
          };
          const tick = () => {
            const t = performance.now();
            frameTimes.push(t);
            channel.port2.postMessage(null);
            if (t < trace.endsAt) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        traces.set(id, trace);
        return performance.now();
      },
      finish(id, endsAt) {
        const trace = traces.get(id);
        trace.endsAt = Math.min(trace.endsAt, endsAt);
        return trace.done;
      },
      collect(id) {
        return traces.get(id).done;
      },
    };
  }
  if (start) window[tracer].start(start.id, start.targets, start.options);
}

/**
 * @typedef {object} TraceTarget
 * @property {string} name - The key the target's measurements are recorded under
 * @property {string} selector - A CSS selector, resolved again in every frame
 * @property {number} [index] - Which match of `selector` to trace (default 0)
 * @property {boolean} [fixed] - A fixed element: its box is recorded viewport-relative
 */

/**
 * @typedef {object} TraceOptions
 * @property {number|null} [durationMs] - The trace's length; `null` runs it until
 *   `finishFrameTrace` (default `TRACE_MS`)
 * @property {boolean} [focus] - Also record `document.activeElement` in every frame
 */

/**
 * Starts a frame trace in the current document, and returns its start time in page time.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id - Names the trace for `finishFrameTrace` and `collectFrameTrace`
 * @param {TraceTarget[]} targets
 * @param {TraceOptions} [options]
 * @returns {Promise<number>}
 */
export async function startFrameTrace(page, id, targets, { durationMs = TRACE_MS, focus } = {}) {
  await page.evaluate(frameTracerScript, { tracer: TRACER, start: null });
  return page.evaluate(
    ({ tracer, traceId, traceTargets, options }) =>
      window[tracer].start(traceId, traceTargets, options),
    { tracer: TRACER, traceId: id, traceTargets: targets, options: { durationMs, focus } }
  );
}

/**
 * Starts a frame trace from the first frame of the next document, with an init script, so
 * it sees an element from the first frame in which it is in the document. The trace runs
 * until `finishFrameTrace`. Call it before `page.goto`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {TraceTarget[]} targets
 */
export async function traceFromFirstFrame(page, id, targets) {
  await page.addInitScript(frameTracerScript, {
    tracer: TRACER,
    start: { id, targets, options: { durationMs: null } },
  });
}

/**
 * Ends a trace `afterMs` after `from` and returns its frames once it has ended. `from` is
 * `'now'`, `'load'` (the end of the document's `load` event), or a page time such as a
 * trigger time a helper returned.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {number} afterMs
 * @param {{ from?: 'now' | 'load' | number }} [options]
 */
export function finishFrameTrace(page, id, afterMs, { from = 'now' } = {}) {
  return page.evaluate(
    ({ tracer, traceId, delayMs, origin }) => {
      let start = origin;
      if (origin === 'now') start = performance.now();
      if (origin === 'load') start = performance.getEntriesByType('navigation')[0].loadEventEnd;
      return window[tracer].finish(traceId, start + delayMs);
    },
    { tracer: TRACER, traceId: id, delayMs: afterMs, origin: from }
  );
}

/**
 * Reads a locator's effective opacity now (Conventions). The frame tracer measures the same
 * thing in every frame; this is its one-off form for a precondition or a final state.
 *
 * @param {import('@playwright/test').Locator} locator
 * @returns {Promise<number>}
 */
export function readEffectiveOpacity(locator) {
  return locator.evaluate((element) => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility !== 'visible') return 0;
      opacity *= Number.parseFloat(style.opacity);
    }
    return opacity;
  });
}

/**
 * Scrolls the page instantly so that the element's top is `insetPx` above the viewport
 * bottom, and returns the page time of the scroll: the trigger the motion ACs time from.
 *
 * @param {import('@playwright/test').Locator} locator
 * @param {number} insetPx
 * @returns {Promise<number>}
 */
export function scrollTopAboveViewportBottom(locator, insetPx) {
  return locator.evaluate((element, inset) => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - (window.innerHeight - inset), left: 0, behavior: 'instant' });
    return performance.now();
  }, insetPx);
}

/**
 * The element's viewport top and the viewport height, to assert where it sits.
 *
 * @param {import('@playwright/test').Locator} locator
 * @returns {Promise<{ top: number, viewportHeight: number }>}
 */
export function viewportTop(locator) {
  return locator.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    viewportHeight: window.innerHeight,
  }));
}

/**
 * Waits until a trace started with a fixed length has ended, and returns its frames.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 */
export function collectFrameTrace(page, id) {
  return page.evaluate(({ tracer, traceId }) => window[tracer].collect(traceId), {
    tracer: TRACER,
    traceId: id,
  });
}

/**
 * One target's measurements, one entry per frame in which it was in the document, each
 * with the frame's time and `scrollY`.
 *
 * @param {object[]} frames - A trace's frames
 * @param {string} name - The target's name
 */
export function seriesOf(frames, name) {
  return frames
    .filter((frame) => frame.targets[name])
    .map((frame) => ({ t: frame.t, scrollY: frame.scrollY, ...frame.targets[name] }));
}

/**
 * The frames that break "no movement": across every frame in which the element is shown,
 * each of `x`, `y`, `width` and `height` stays within 1 px of its value in the last frame
 * in which it is shown. Returns those frames, described for a failure message.
 *
 * @param {ReturnType<typeof seriesOf>} series
 */
export function movementFaults(series) {
  const shown = series.filter((entry) => entry.opacity > 0);
  const last = shown.at(-1);
  if (!last) return [];
  return shown
    .filter((entry) =>
      ['x', 'y', 'width', 'height'].some(
        (key) => Math.abs(entry[key] - last[key]) > POSITION_TOLERANCE_PX
      )
    )
    .map((entry) => describeFrame(entry, last));
}

/**
 * A frame's box against a reference box, rounded, for failure messages.
 *
 * @param {{ t: number, x: number, y: number, width: number, height: number, opacity: number }} entry
 * @param {{ x: number, y: number, width: number, height: number }} reference
 */
export function describeFrame(entry, reference) {
  const round = (value) => Math.round(value * 10) / 10;
  return {
    t: round(entry.t),
    opacity: Math.round(entry.opacity * 1000) / 1000,
    dx: round(entry.x - reference.x),
    dy: round(entry.y - reference.y),
    dWidth: round(entry.width - reference.width),
    dHeight: round(entry.height - reference.height),
  };
}

/**
 * "Jump" (Conventions): no `scrollY` value is more than 1 px away from both the first and
 * the last value.
 *
 * @param {number[]} scrollYs
 */
export function isJump(scrollYs) {
  return !isGlide(scrollYs);
}

/**
 * "Glide" (Conventions): at least one `scrollY` value is more than 1 px away from both the
 * first and the last value.
 *
 * @param {number[]} scrollYs
 */
export function isGlide(scrollYs) {
  const first = scrollYs[0];
  const last = scrollYs.at(-1);
  return scrollYs.some(
    (value) =>
      Math.abs(value - first) > POSITION_TOLERANCE_PX &&
      Math.abs(value - last) > POSITION_TOLERANCE_PX
  );
}

/**
 * The most opacity transitions in any 1 000 ms window of an effective-opacity series. Each
 * crossing of 0.5, in either direction, is one transition, so more than 6 transitions in a
 * window means more than 3 flashes in one second (Conventions, "Flash count").
 *
 * @param {ReturnType<typeof seriesOf>} series
 */
export function mostTransitionsInOneSecond(series) {
  const crossings = [];
  for (let i = 1; i < series.length; i += 1) {
    const before = series[i - 1].opacity > FLASH_THRESHOLD;
    const after = series[i].opacity > FLASH_THRESHOLD;
    if (before !== after) crossings.push(series[i].t);
  }
  let most = 0;
  let windowStart = 0;
  for (let end = 0; end < crossings.length; end += 1) {
    while (crossings[end] - crossings[windowStart] >= FLASH_WINDOW_MS) windowStart += 1;
    most = Math.max(most, end - windowStart + 1);
  }
  return most;
}
