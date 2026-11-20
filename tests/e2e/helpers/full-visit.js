import { desktop } from '../viewports.js';
import { armModalEvent, openContactModal } from './contact-modal.js';
import { trackNetwork } from './network.js';
import {
  LIGHTBOX,
  LIGHTBOX_IMAGE,
  PORTFOLIO_ITEM,
  openLightboxFrom,
  portfolioFilter,
} from './portfolio.js';

/** Step sizes and settles the AC Conventions fix for a full visit. */
const SCROLL_STEP_PX = 400;
const SCROLL_STEP_DELAY_MS = 100;
const NETWORK_IDLE_MS = 2_000;

/** Ends the scroll loop on a page that keeps growing, instead of scrolling forever. */
const MAX_SCROLL_STEPS = 200;

/**
 * Scrolls to the bottom in fixed steps, a fixed delay apart (Full visit, step 2).
 * `instant` overrides Bootstrap's `scroll-behavior: smooth`, so each step lands
 * before the next one starts. Also the scroll of bootstrap-6-upgrade AC-2.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function scrollToBottomInSteps(page) {
  for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
    const atBottom = await page.evaluate((stepPx) => {
      const root = document.documentElement;
      if (window.scrollY + window.innerHeight >= root.scrollHeight) return true;
      window.scrollBy({ top: stepPx, behavior: 'instant' });
      return false;
    }, SCROLL_STEP_PX);
    if (atBottom) return;
    await page.waitForTimeout(SCROLL_STEP_DELAY_MS);
  }
  throw new Error(`Full visit: the page did not reach its bottom in ${MAX_SCROLL_STEPS} steps`);
}

/**
 * The AC Conventions' full visit, in order:
 * 1. Load `/` at `desktop` and wait for `load`.
 * 2. Scroll to the bottom in 400 px steps, 100 ms apart.
 * 3. Activate the `App` filter, then `All`.
 * 4. Open the lightbox from the first visible portfolio item, wait until its image
 *    has loaded, and press Escape.
 * 5. Activate `.contact-modal-btn`, wait until the dialog is shown, and press Escape.
 * 6. Wait for 2 s of network idle, which includes the map iframe.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function fullVisit(page) {
  const network = trackNetwork(page);
  try {
    await page.setViewportSize(desktop.viewport);
    await page.goto('/', { waitUntil: 'load' });

    await scrollToBottomInSteps(page);

    await portfolioFilter(page, 'App').click();
    await portfolioFilter(page, 'All').click();

    const firstVisibleItem = page.locator(PORTFOLIO_ITEM).filter({ visible: true }).first();
    await openLightboxFrom(firstVisibleItem);
    await page.waitForFunction((selector) => {
      const image = document.querySelector(selector);
      return image !== null && image.complete && image.naturalWidth > 0;
    }, LIGHTBOX_IMAGE);
    await page.keyboard.press('Escape');
    await page.locator(LIGHTBOX).waitFor({ state: 'detached' });

    await openContactModal(page);
    const hidden = await armModalEvent(page, 'hidden.bs.dialog');
    await page.keyboard.press('Escape');
    await hidden();

    await network.waitForIdle(NETWORK_IDLE_MS);
  } finally {
    network.stop();
  }
}
