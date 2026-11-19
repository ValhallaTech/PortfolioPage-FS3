/**
 * Keyboard focus helpers for the accessibility ACs (spec stabilize-and-cleanup, WI-51).
 *
 * `tabWalk` is the AC Conventions' Tab walk: from a fresh load with focus on `body`, press
 * Tab until focus returns to the first element focused, or 120 presses, whichever comes
 * first. Focus inside the cross-origin map iframe is skipped.
 */

/** The Conventions' cap on Tab presses in one walk. */
export const TAB_WALK_MAX_PRESSES = 120;

/**
 * Runs in the page. Gives the focused element a stable id for this page, so the walk can
 * tell when focus is back on its first element, and describes it for failure messages.
 * Focus on `body` (between the last stop and the browser UI) and focus inside an iframe
 * (the main document only sees the `iframe` element) are reported as skipped.
 *
 * @param {Element | null} element `document.activeElement`
 */
function identifyFocusedElement(element) {
  if (!element || element === document.body || element === document.documentElement) {
    return { skip: 'body' };
  }
  if (element.tagName === 'IFRAME') {
    return { skip: 'iframe' };
  }
  const registry = (window.__tabWalkRegistry ??= { ids: new WeakMap(), next: 0 });
  if (!registry.ids.has(element)) {
    registry.next += 1;
    registry.ids.set(element, registry.next);
  }
  const label = (element.getAttribute('aria-label') ?? element.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  const id = element.id ? `#${element.id}` : '';
  const classes = element.classList.length ? `.${[...element.classList].join('.')}` : '';
  const href = element.getAttribute('href');
  return {
    id: registry.ids.get(element),
    description: `${element.tagName.toLowerCase()}${id}${classes}${href ? `[href="${href}"]` : ''} "${label}"`,
  };
}

/**
 * Moves focus back to `body`, as on a fresh load.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function focusBody(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

/**
 * The Conventions' Tab walk. Call it right after `page.goto`.
 *
 * @template T
 * @param {import('@playwright/test').Page} page
 * @param {(element: Element) => T} inspect Runs in the page on each focused element.
 * @returns {Promise<Array<{ press: number, description: string, result: T }>>} One entry
 *   per Tab stop, in focus order, without the return to the first stop.
 */
export async function tabWalk(page, inspect) {
  await focusBody(page);
  const stops = [];
  let firstId;
  for (let press = 1; press <= TAB_WALK_MAX_PRESSES; press += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluateHandle(() => document.activeElement);
    try {
      const { skip, id, description } = await focused.evaluate(identifyFocusedElement);
      if (skip) continue;
      if (id === firstId) break;
      firstId ??= id;
      stops.push({ press, description, result: await focused.evaluate(inspect) });
    } finally {
      await focused.dispose();
    }
  }
  return stops;
}

/**
 * Presses Tab until the focused element matches `selector`, up to `maxPresses` times.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {number} [maxPresses]
 * @returns {Promise<number | null>} The press that reached it, or `null` if none did.
 */
export async function tabUntil(page, selector, maxPresses = TAB_WALK_MAX_PRESSES) {
  for (let press = 1; press <= maxPresses; press += 1) {
    await page.keyboard.press('Tab');
    const reached = await page.evaluate((target) => {
      const element = document.activeElement;
      return element instanceof Element && element.matches(target);
    }, selector);
    if (reached) return press;
  }
  return null;
}

/**
 * Runs in the page: the computed styles that draw a focus indicator (AC-40, AC-41).
 *
 * @param {Element} element
 */
export function readFocusStyle(element) {
  const style = getComputedStyle(element);
  return {
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
    boxShadow: style.boxShadow,
  };
}

/**
 * The AC-40 and AC-41 test: an outline that is not `none` and at least 1 px wide, or a
 * `box-shadow` that is not `none`.
 *
 * @param {ReturnType<typeof readFocusStyle>} focusStyle
 */
export function hasFocusIndicator({ outlineStyle, outlineWidth, boxShadow }) {
  const outlineDrawn = outlineStyle !== 'none' && Number.parseFloat(outlineWidth) >= 1;
  return outlineDrawn || boxShadow !== 'none';
}
