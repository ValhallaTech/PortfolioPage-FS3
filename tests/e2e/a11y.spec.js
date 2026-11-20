/**
 * Accessibility and contrast (spec stabilize-and-cleanup, WI-51: AC-38, AC-40, AC-41,
 * AC-45, AC-46, AC-49, AC-50, AC-51, AC-52, AC-53, AC-56, AC-60, AC-61).
 *
 * Selectors follow the markup WI-49 specifies where an AC names a role rather than
 * today's element: the testimonial role line is `p.testimonial-role`.
 * The Tab walk, effective background and contrast follow the AC Conventions; see
 * helpers/tab-walk.js and helpers/contrast.js.
 */
import { test, expect } from './fixtures.js';
import { desktop, phone, small, tablet } from './viewports.js';
import { WEB3FORMS_URL } from './fixtures.js';
import { fillContactForm, mockWeb3Forms, openContactModal } from './helpers/contact-modal.js';
import {
  contrastRatio,
  lightestPixels,
  measureContrast,
  parseCssColor,
} from './helpers/contrast.js';
import {
  focusBody,
  hasFocusIndicator,
  readFocusStyle,
  tabUntil,
  tabWalk,
} from './helpers/tab-walk.js';

const MOBILE_NAV_TOGGLE = '.mobile-nav-toggle';
const BACK_TO_TOP = '.back-to-top';
const SOCIAL_LINKS = '#header .social-links a';
const NAV_LINKS = '.nav-menu a';

/** AC-38's social links: the host each one points to, and the name pattern it needs. */
const SOCIAL_NAME_PATTERNS = Object.freeze([
  { host: 'twitter.com', name: /\bx\b|twitter/i },
  { host: 'facebook.com', name: /facebook/i },
  { host: 'instagram.com', name: /instagram/i },
  { host: 'linkedin.com', name: /linkedin/i },
]);

/** WCAG thresholds: normal text, and large text or graphical objects and UI components. */
const TEXT_CONTRAST = 4.5;
const LARGE_OR_GRAPHIC_CONTRAST = 3.0;

/** WCAG 2.5.5 (AAA) target size that AC-60 applies. */
const MIN_TARGET_PX = 44;

/** AC-52's cap on Tab presses after the nav opens. */
const AC_52_MAX_PRESSES = 20;

/**
 * Scrolls to y = 150, as AC-38, AC-45 and AC-60 state, and waits until back-to-top shows.
 *
 * @param {import('@playwright/test').Page} page
 */
async function scrollPastBackToTopThreshold(page) {
  await page.evaluate(() => window.scrollTo({ top: 150, left: 0, behavior: 'instant' }));
  await expect(page.locator(BACK_TO_TOP)).toBeVisible();
}

/**
 * Brings an element into view and waits until it and its ancestors are at rest: no running
 * animation or transition, and every ScrollReveal container among them fully revealed.
 *
 * It scrolls only an element outside the viewport, so a hovered element stays under the
 * pointer. It does not wait for visibility, because contrast compares computed colors: a
 * row whose element is not shown at `desktop` (Swiper hides its bullets when every slide
 * fits in view) is still measured.
 *
 * @param {import('@playwright/test').Locator} locator
 */
async function settle(locator) {
  await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const inView =
      box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    if (!inView) element.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await expect
    .poll(
      () =>
        locator.evaluate((element) => {
          const chain = [];
          for (let node = element; node; node = node.parentElement) chain.push(node);
          const animating = chain.some((node) =>
            node.getAnimations().some((animation) => animation.playState === 'running')
          );
          const unrevealed = chain.some(
            (node) => node.matches('[data-sr]') && getComputedStyle(node).opacity !== '1'
          );
          return !animating && !unrevealed;
        }),
      { message: 'the element and its ancestors are revealed and not animating' }
    )
    .toBe(true);
}

/**
 * The element's Playwright-computed accessible name, read from its ARIA snapshot.
 *
 * @param {import('@playwright/test').Locator} locator
 * @returns {Promise<string>} The name, or '' when it has none.
 */
async function accessibleName(locator) {
  const snapshot = await locator.ariaSnapshot();
  const match = /^- \w+ "((?:[^"\\]|\\.)*)"/.exec(snapshot);
  return match ? JSON.parse(`"${match[1]}"`) : '';
}

/**
 * Whether two boxes overlap by more than an edge.
 *
 * @param {{ x: number, y: number, width: number, height: number }} a
 * @param {{ x: number, y: number, width: number, height: number }} b
 */
function boxesIntersect(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Loads the page fresh with focus on `body`, presses Tab once and returns the focused
 * element (AC-49, and AC-50's Given).
 *
 * @param {import('@playwright/test').Page} page
 */
async function tabOnceFromFreshLoad(page) {
  await page.goto('/');
  await focusBody(page);
  await page.keyboard.press('Tab');
  return page.locator(':focus');
}

test.describe('at small', () => {
  test.use(small);

  test('AC-38: the nav toggle has an accessible name', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator(MOBILE_NAV_TOGGLE)).toHaveAccessibleName(/navigation|menu/i);
  });

  test('AC-40: the nav toggle shows a focus indicator', async ({ page }) => {
    await page.goto('/');
    await focusBody(page);

    const press = await tabUntil(page, MOBILE_NAV_TOGGLE);
    expect(press, 'Tab reaches the nav toggle').not.toBeNull();

    const focusStyle = await page.locator(MOBILE_NAV_TOGGLE).evaluate(readFocusStyle);
    expect(hasFocusIndicator(focusStyle), `focus style ${JSON.stringify(focusStyle)}`).toBe(true);
  });

  test('AC-52: the open nav is reachable by keyboard', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator(MOBILE_NAV_TOGGLE);
    await toggle.focus();

    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const press = await tabUntil(page, `${NAV_LINKS}[href="#about"]`, AC_52_MAX_PRESSES);
    expect(
      press,
      `Tab reaches the About nav link within ${AC_52_MAX_PRESSES} presses`
    ).not.toBeNull();
  });
});

test.describe('at desktop', () => {
  test.use(desktop);

  test('AC-38: the social links and back-to-top have accessible names', async ({ page }) => {
    // Five soft web-first assertions, each of which may wait its full 5 s when a name is
    // missing, so the test reports every control instead of hitting the 30 s test timeout.
    test.setTimeout(60_000);
    await page.goto('/');

    for (const { host, name } of SOCIAL_NAME_PATTERNS) {
      await expect
        .soft(page.locator(`${SOCIAL_LINKS}[href*="${host}"]`), `social link to ${host}`)
        .toHaveAccessibleName(name);
    }
    await scrollPastBackToTopThreshold(page);
    await expect.soft(page.locator(BACK_TO_TOP)).toHaveAccessibleName(/top/i);
  });

  test('AC-45: the listed text and UI pairs meet contrast', async ({ page }) => {
    const failures = [];
    /**
     * Measures one AC-45 row and records it if it misses its threshold.
     *
     * @param {number} row
     * @param {import('@playwright/test').Locator} locator
     * @param {number} threshold
     * @param {Parameters<typeof measureContrast>[1]} [options]
     */
    const checkRow = async (row, locator, threshold, options) => {
      if ((await locator.count()) === 0) {
        failures.push(`row ${row}: no element matches ${locator}`);
        return;
      }
      await settle(locator.first());
      const { ratio, foreground, background } = await measureContrast(locator.first(), options);
      if (ratio < threshold) {
        failures.push(
          `row ${row}: ${ratio.toFixed(2)} < ${threshold} (${foreground} on ${background})`
        );
      }
    };

    await mockWeb3Forms(page, { success: true });
    await page.goto('/');

    await checkRow(1, page.locator('.contact-modal-btn'), TEXT_CONTRAST);
    await checkRow(4, page.locator('#about a[href^="mailto:"]'), TEXT_CONTRAST);
    await checkRow(5, page.locator('#contact a[href^="mailto:"]'), TEXT_CONTRAST);
    await checkRow(
      6,
      page.locator('#portfolio-filters button[aria-pressed="true"]'),
      TEXT_CONTRAST
    );
    await checkRow(
      10,
      page.locator('.testimonials .swiper-slide-active p.testimonial-role'),
      TEXT_CONTRAST
    );

    await scrollPastBackToTopThreshold(page);
    await checkRow(3, page.locator(`${BACK_TO_TOP} .icon`), LARGE_OR_GRAPHIC_CONTRAST);

    const serviceLink = page.locator('.services .title a').first();
    await settle(serviceLink);
    await serviceLink.hover();
    await checkRow(7, serviceLink, TEXT_CONTRAST);

    await openContactModal(page);
    await checkRow(2, page.locator('#submit-btn'), TEXT_CONTRAST);

    await fillContactForm(page);
    await page.locator('#submit-btn').click();
    await expect(page.locator('#sent-message')).toBeVisible();
    await checkRow(8, page.locator('#sent-message'), TEXT_CONTRAST);

    await page.unroute(WEB3FORMS_URL);
    await mockWeb3Forms(page, { success: false, message: 'x' });
    await page.reload();
    await openContactModal(page);
    await fillContactForm(page);
    await page.locator('#submit-btn').click();
    await expect(page.locator('#error-message')).toBeVisible();
    await checkRow(9, page.locator('#error-message'), TEXT_CONTRAST);

    // Row 11 is measured at small: from 900 px up all three slides fit one view, so Swiper
    // renders a single, always-active bullet and there is no inactive one to measure.
    await page.setViewportSize(small.viewport);
    await page.reload();
    await checkRow(
      11,
      page.locator('.testimonials .swiper-pagination-bullet:not(.swiper-pagination-bullet-active)'),
      LARGE_OR_GRAPHIC_CONTRAST,
      { foreground: 'background-color', backgroundFrom: 'parent' }
    );

    expect(failures, 'AC-45 rows below their contrast threshold').toEqual([]);
  });

  test('AC-49: the first Tab stop is a visible skip link', async ({ page }) => {
    const focused = await tabOnceFromFreshLoad(page);

    await expect(focused).toHaveRole('link');
    await expect(focused).toHaveAccessibleName(/skip/i);
    const { width, height } = desktop.viewport;
    await expect
      .poll(
        async () => {
          const box = await focused.boundingBox();
          return (
            box !== null &&
            box.width > 0 &&
            box.height > 0 &&
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= width &&
            box.y + box.height <= height
          );
        },
        { message: 'the skip link has a non-empty box inside the viewport' }
      )
      .toBe(true);
  });

  test('AC-50: the skip link lands in the main content', async ({ page }) => {
    const focused = await tabOnceFromFreshLoad(page);
    await expect(focused, 'AC-49 state: the skip link has focus').toHaveAccessibleName(/skip/i);

    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');

    const placement = await page.evaluate(() => ({
      inMain: document.activeElement?.closest('main') !== null,
      inHeader: document.activeElement?.closest('#header') !== null,
    }));
    expect(placement).toEqual({ inMain: true, inHeader: false });
  });

  test('AC-53: decorative icons are hidden from the accessibility tree', async ({ page }) => {
    await page.goto('/');

    const exposed = await page.evaluate(() => {
      const notRendered = (element) => {
        for (let node = element; node; node = node.parentElement) {
          if (getComputedStyle(node).display === 'none') return true;
        }
        return false;
      };
      const name = (element) => {
        const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
        const title =
          element.tagName.toLowerCase() === 'svg' ? element.querySelector(':scope > title') : null;
        return [element.getAttribute('aria-label'), labelledBy, title?.textContent]
          .filter(Boolean)
          .join(' ')
          .trim();
      };
      return [...document.body.querySelectorAll('i, svg')]
        .filter(
          (element) =>
            element.closest('[aria-hidden="true"]') === null &&
            !notRendered(element) &&
            !(element.getAttribute('role') === 'img' && name(element) !== '')
        )
        .map((element) => element.outerHTML.slice(0, 120));
    });

    expect(exposed, 'icons exposed to assistive tech').toEqual([]);
  });

  test('AC-56: portfolio link names are distinct', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.portfolio-links a');
    await expect(links).toHaveCount(18);

    const names = [];
    for (const link of await links.all()) {
      names.push(await accessibleName(link));
    }

    const placeholders = names.filter(
      (name) => name === '' || /^(app|card|web) \d$/i.test(name) || /^more details$/i.test(name)
    );
    expect(placeholders, 'empty or placeholder link names').toEqual([]);
    expect(new Set(names).size, `distinct names among ${JSON.stringify(names)}`).toBe(18);
  });

  test('AC-60: social links and back-to-top are at least 44 × 44 px', async ({ page }) => {
    await page.goto('/');
    await scrollPastBackToTopThreshold(page);
    const socialLinks = page.locator(SOCIAL_LINKS);
    await expect(socialLinks).toHaveCount(4);

    const targets = [...(await socialLinks.all()), page.locator(BACK_TO_TOP)];
    const undersized = [];
    for (const target of targets) {
      const box = await target.boundingBox();
      if (box === null || box.width < MIN_TARGET_PX || box.height < MIN_TARGET_PX) {
        undersized.push(`${target}: ${box ? `${box.width} × ${box.height}` : 'no box'}`);
      }
    }
    expect(undersized, `targets under ${MIN_TARGET_PX} × ${MIN_TARGET_PX} px`).toEqual([]);
  });
});

for (const [name, viewport] of Object.entries({ desktop, small })) {
  test.describe(`at ${name}`, () => {
    test.use(viewport);

    test(`AC-41: every Tab stop shows a focus indicator at ${name}`, async ({ page }) => {
      await page.goto('/');

      const stops = await tabWalk(page, readFocusStyle);

      expect(stops.length, 'the Tab walk focuses at least one element').toBeGreaterThan(0);
      const missing = stops
        .filter(({ result }) => !hasFocusIndicator(result))
        .map(({ description, result }) => `${description}: ${JSON.stringify(result)}`);
      expect(missing, 'Tab stops without a focus indicator').toEqual([]);
    });
  });
}

for (const [name, viewport] of Object.entries({ small, tablet })) {
  test.describe(`at ${name}`, () => {
    test.use(viewport);

    test(`AC-51: focus never enters the closed header at ${name}`, async ({ page }) => {
      await page.goto('/');

      const stops = await tabWalk(page, (element) => element.closest('#header') !== null);

      expect(stops.length, 'the Tab walk focuses at least one element').toBeGreaterThan(0);
      const inHeader = stops.filter(({ result }) => result).map(({ description }) => description);
      expect(inHeader, 'Tab stops inside the closed #header').toEqual([]);
    });
  });
}

for (const [name, viewport] of Object.entries({ phone, desktop })) {
  test.describe(`at ${name}`, () => {
    test.use(viewport);

    test(`AC-46: hero text meets 3:1 over the lightest pixel at ${name} @live`, async ({
      page,
    }) => {
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content: '#hero .hero-container { visibility: hidden !important; }',
      });

      const lines = await page.locator('#hero').evaluate((hero) => {
        const heroBox = hero.getBoundingClientRect();
        return ['h1', 'p'].map((tag) => {
          const element = hero.querySelector(tag);
          const box = element.getBoundingClientRect();
          return {
            tag,
            color: getComputedStyle(element).color,
            box: {
              x: box.x - heroBox.x,
              y: box.y - heroBox.y,
              width: box.width,
              height: box.height,
            },
          };
        });
      });
      const screenshot = await page
        .locator('#hero')
        .screenshot({ scale: 'css', animations: 'disabled' });
      const pixels = await lightestPixels(
        page,
        screenshot,
        lines.map(({ box }) => box)
      );

      lines.forEach(({ tag, color }, index) => {
        const text = parseCssColor(color);
        const pixel = pixels[index];
        const ratio = contrastRatio(text, pixel);
        expect
          .soft(
            ratio,
            `#hero ${tag} (${color}) against its lightest pixel rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`
          )
          .toBeGreaterThanOrEqual(LARGE_OR_GRAPHIC_CONTRAST);
      });
    });
  });
}

test.describe('at 1280 × 600', () => {
  test.use({ viewport: { width: 1280, height: 600 } });

  test('AC-61: no focused nav link intersects #footer at 1280 × 600', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.locator(NAV_LINKS);
    await expect(navLinks).toHaveCount(5);
    const hrefs = await navLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href'))
    );
    await focusBody(page);

    const covered = [];
    for (const href of hrefs) {
      const press = await tabUntil(page, `${NAV_LINKS}[href="${href}"]`);
      expect(press, `Tab reaches the nav link to ${href}`).not.toBeNull();
      const linkBox = await page.locator(':focus').boundingBox();
      const footerBox = await page.locator('#footer').boundingBox();
      if (linkBox && footerBox && boxesIntersect(linkBox, footerBox)) {
        covered.push(
          `${href}: link ${JSON.stringify(linkBox)}, footer ${JSON.stringify(footerBox)}`
        );
      }
    }
    expect(covered, 'focused nav links under #footer').toEqual([]);
  });
});
