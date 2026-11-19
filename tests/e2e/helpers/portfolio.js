import { expect } from '../fixtures.js';

/**
 * The shipped portfolio markup, as the §3.3 DOM contract names each role
 * (spec stabilize-and-cleanup, D-16).
 */
export const PORTFOLIO_SECTION = '#portfolio';
export const PORTFOLIO_CONTAINER = '.portfolio-container';
/** The grid container once Muuri has initialized and laid out the items. */
export const PORTFOLIO_GRID_READY = `${PORTFOLIO_CONTAINER}.muuri`;
export const PORTFOLIO_ITEM = '.portfolio-item';
export const PORTFOLIO_WRAP = '.portfolio-wrap';
export const PORTFOLIO_LINK = '.portfolio-links a';
export const PORTFOLIO_FILTERS = '#portfolio-filters';
export const LIGHTBOX = '.glightbox-container';
export const LIGHTBOX_IMAGE = `${LIGHTBOX} .gslide.current .gslide-image img`;

/** The items each filter shows, by item number (AC Conventions, "Portfolio item identity"). */
export const FILTER_ITEM_SETS = Object.freeze({
  All: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  App: [1, 3, 6],
  Card: [4, 7, 8],
  Web: [2, 5, 9],
});

export const ITEM_NUMBERS = FILTER_ITEM_SETS.All;

/**
 * Item N, by its stable identity hook `data-portfolio-id` (§3.3).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} n 1 to 9
 */
export function portfolioItem(page, n) {
  return page.locator(`${PORTFOLIO_ITEM}[data-portfolio-id="${n}"]`);
}

/**
 * The filter button named `name`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {keyof FILTER_ITEM_SETS} name
 */
export function portfolioFilter(page, name) {
  return page.locator(PORTFOLIO_FILTERS).getByRole('button', { name, exact: true });
}

/**
 * Waits until Muuri has initialized the grid, so no portfolio check races it (WI-40).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function waitForPortfolioGrid(page) {
  await page.locator(PORTFOLIO_GRID_READY).waitFor({ state: 'attached' });
}

/**
 * Waits until all nine portfolio images have loaded.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function waitForPortfolioImages(page) {
  await expect
    .poll(
      () =>
        page
          .locator(`${PORTFOLIO_ITEM} img`)
          .evaluateAll((images) =>
            images.filter((image) => !image.complete || image.naturalWidth === 0).map((i) => i.src)
          ),
      { message: 'every portfolio image has loaded' }
    )
    .toEqual([]);
}

/**
 * Scrolls `#portfolio` to the top of the viewport, as a nav-link visit does, and waits
 * until ScrollReveal has finished revealing the grid: fully opaque, with no transition
 * left on it.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function revealPortfolio(page) {
  await page
    .locator(PORTFOLIO_SECTION)
    .evaluate((section) => section.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const container = page.locator(PORTFOLIO_CONTAINER);
  await expect
    .poll(
      () =>
        container.evaluate(
          (element) =>
            getComputedStyle(element).opacity === '1' && element.getAnimations().length === 0
        ),
      { message: 'ScrollReveal has finished revealing the portfolio grid' }
    )
    .toBe(true);
}

/**
 * Asserts that exactly `shownItems` are visible and every other item is hidden.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number[]} shownItems
 * @param {string} label names the state in the failure message
 */
export async function expectShownItems(page, shownItems, label) {
  for (const n of ITEM_NUMBERS) {
    const item = portfolioItem(page, n);
    if (shownItems.includes(n)) {
      await expect(item, `${label} shows item ${n}`).toBeVisible();
    } else {
      await expect(item, `${label} hides item ${n}`).toBeHidden();
    }
  }
}

/**
 * Opens GLightbox from an item's lightbox link. The links slide in on hover, so
 * the card is hovered first, as a pointer user does.
 *
 * @param {import('@playwright/test').Locator} item
 */
export async function openLightboxFrom(item) {
  await item.locator(PORTFOLIO_WRAP).hover();
  await item.locator(`${PORTFOLIO_LINK}.glightbox`).click();
}

/**
 * The `naturalWidth` of the current lightbox slide's image, or 0 until it has loaded.
 *
 * @param {import('@playwright/test').Page} page
 */
export function lightboxImageWidth(page) {
  return page.evaluate((selector) => {
    const image = document.querySelector(selector);
    return image?.complete ? image.naturalWidth : 0;
  }, LIGHTBOX_IMAGE);
}
