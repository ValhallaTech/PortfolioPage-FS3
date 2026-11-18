/**
 * The Isotope-era portfolio markup, as the AC Conventions name it. WI-40 rewrites
 * these for the markup that replaces Isotope (§3.3 selector table).
 */
export const PORTFOLIO_ITEM = '.portfolio-item';
export const PORTFOLIO_FILTERS = '#portfolio-flters';
export const LIGHTBOX = '.glightbox-container';
export const LIGHTBOX_IMAGE = `${LIGHTBOX} .gslide.current .gslide-image img`;

/** The items each filter shows today, by item number (AC Conventions, "Portfolio item identity"). */
export const FILTER_ITEM_SETS = Object.freeze({
  All: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  App: [1, 3, 6],
  Card: [4, 7, 8],
  Web: [2, 5, 9],
});

export const ITEM_NUMBERS = FILTER_ITEM_SETS.All;

/**
 * Item N, identified by its image's source base name `portfolio-N`. Parcel hashes
 * the built name (`portfolio-1.afcd9577.jpg`), so the match stops at the first dot.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} n 1 to 9
 */
export function portfolioItem(page, n) {
  return page.locator(PORTFOLIO_ITEM).filter({
    has: page.locator(`img[src^="portfolio-${n}."], img[src*="/portfolio-${n}."]`),
  });
}

/**
 * The filter control named `name`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {keyof FILTER_ITEM_SETS} name
 */
export function portfolioFilter(page, name) {
  return page.locator(PORTFOLIO_FILTERS).getByText(name, { exact: true });
}

/**
 * Opens GLightbox from an item's lightbox link. The links slide in on hover, so
 * the item is hovered first, as a pointer user does.
 *
 * @param {import('@playwright/test').Locator} item
 */
export async function openLightboxFrom(item) {
  await item.locator('.portfolio-wrap').hover();
  await item.locator('.portfolio-links a.glightbox').click();
}
