/**
 * Fonts, icons and images after the performance work (spec stabilize-and-cleanup, WI-46:
 * AC-39, AC-67, AC-68, AC-71, AC-72, AC-76, AC-77, AC-78).
 *
 * Each test follows its AC text. The both-target ACs carry `@live`, so
 * `yarn test:e2e:live` runs them against the deployed site as well. Every test runs in
 * a fresh context, which is the empty cache AC-67 and AC-76 ask for. The only fixed
 * wait is the one an AC names: AC-76's 5 s after `load`.
 */
import { test, expect } from './fixtures.js';
import { desktop, phone, small } from './viewports.js';
import { fullVisit } from './helpers/full-visit.js';

/** The mobile-nav toggle (AC-39, AC-72). */
const MOBILE_NAV_TOGGLE = '.mobile-nav-toggle';

/** AC-67: the decoded width no image response may reach. */
const MAX_IMAGE_WIDTH_PX = 3840;

/** AC-68: the two Google font hosts. */
const GOOGLE_FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

/** AC-71: each element and the family its computed `font-family` must name first. */
const TEXT_FAMILIES = Object.freeze([
  { selector: 'body', family: 'Open Sans' },
  { selector: '.section-title h2', family: 'Raleway' },
  { selector: '#hero p', family: 'Poppins' },
]);

/** AC-72: the smallest box a rendered icon may have, in CSS px. */
const MIN_ICON_PX = 8;

/** AC-72: the icon slots, with the count of each that the AC lists. */
const ICON_SLOTS = Object.freeze([
  { name: 'nav link', selector: '#header .nav-menu a', count: 5 },
  { name: 'social link', selector: '#header .social-links a', count: 4 },
  { name: 'About list item', selector: '#about li', count: 6 },
  { name: 'portfolio action link', selector: '.portfolio-links a', count: 18 },
  { name: 'service icon', selector: '#services .icon-box .icon', count: 6 },
  {
    name: 'testimonial quote mark',
    selector: '#testimonials .quote-icon-left, #testimonials .quote-icon-right',
    count: 6,
  },
  {
    name: 'contact info item',
    selector: '#contact .info .address, #contact .info .email, #contact .info .phone',
    count: 3,
  },
  { name: 'contact button', selector: '.contact-modal-btn', count: 1 },
]);

/** AC-72: the slots inspected only after `scrollTo(0, 150)`, and only at `small`. */
const BACK_TO_TOP_SLOT = Object.freeze({
  name: 'back-to-top',
  selector: '.back-to-top',
  count: 1,
});
const TOGGLE_SLOT = Object.freeze({ name: 'nav toggle', selector: MOBILE_NAV_TOGGLE, count: 1 });

/** AC-76: how long after `load` layout shifts are still collected, and the CLS ceiling. */
const CLS_WINDOW_AFTER_LOAD_MS = 5_000;
const MAX_CLS = 0.1;

/** The window property AC-76's init script keeps its layout-shift record on. */
const CLS_KEY = '__wi46LayoutShift';

/** The window property AC-77's init script keeps its image measurements on. */
const FOLD_KEY = '__wi46ImagesAtDomContentLoaded';

/** The full visit walks many steps with fixed settles; the smoke spec allows it 60 s. */
const FULL_VISIT_TIMEOUT_MS = 60_000;

/**
 * Collects layout-shift entries from navigation onward with a buffered observer.
 * Runs in the page, before any page script, through `addInitScript`.
 * @param {string} key - The window property that holds the record
 */
function installLayoutShiftObserver(key) {
  const record = { value: 0, entries: [] };
  window[key] = record;
  const describe = (node) => {
    if (!(node instanceof Element)) return node?.nodeName ?? '(none)';
    const id = node.id ? `#${node.id}` : '';
    const classes = [...node.classList].map((name) => `.${name}`).join('');
    return `${node.localName}${id}${classes}`;
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      record.value += entry.value;
      record.entries.push({
        value: entry.value,
        sources: (entry.sources ?? []).map((source) => describe(source.node)),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
}

/**
 * Right after `DOMContentLoaded`, scrolled to the top, records each `img` element's
 * top, the viewport height and its `loading` attribute. Runs in the page through
 * `addInitScript`, so its listener is the first one registered.
 * @param {string} key - The window property that holds the measurements
 */
function installFoldMeasurement(key) {
  document.addEventListener('DOMContentLoaded', () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window[key] = {
      viewportHeight: window.innerHeight,
      images: [...document.querySelectorAll('img')].map((image) => ({
        src: image.getAttribute('src'),
        top: image.getBoundingClientRect().top,
        loading: image.getAttribute('loading'),
      })),
    };
  });
}

/**
 * Decodes an image body in the page and returns its width, or the decode error.
 * `createImageBitmap` cannot take SVG, so an SVG body is decoded through an `Image`.
 * @param {{ base64: string, contentType: string }} body
 * @returns {Promise<{ width?: number, error?: string }>}
 */
async function decodedImageWidth({ base64, contentType }) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: contentType });
  try {
    if (/svg/i.test(contentType)) {
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return { width: image.naturalWidth };
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const bitmap = await createImageBitmap(blob);
    const { width } = bitmap;
    bitmap.close();
    return { width };
  } catch (error) {
    return { error: String(error) };
  }
}

/**
 * AC-68: describes a Google font request when the page's main frame issued it, or when
 * its frame cannot be read. `request.frame()` throws for a service-worker request and
 * for a navigation request sent before its frame exists; such a request may still be
 * the main frame's, so it is reported rather than dropped. Requests from any other
 * frame, such as the Google Maps embed, return null.
 * @param {import('@playwright/test').Request} request
 * @param {import('@playwright/test').Page} page
 * @returns {string | null} The failure line, or null when the request does not count
 */
function mainFrameFontRequest(request, page) {
  if (!GOOGLE_FONT_HOSTS.has(new URL(request.url()).host)) return null;
  let frame;
  try {
    frame = request.frame();
  } catch (error) {
    const worker = request.serviceWorker();
    const origin = worker ? `service worker ${worker.url()}` : 'no frame';
    return `${request.url()} (frame unknown, ${origin}: ${String(error)})`;
  }
  if (frame !== page.mainFrame()) return null;
  return `${request.url()} (main frame ${frame.url()})`;
}

/**
 * Measures each slot of a group: the slot passes when it, or a descendant, is an `svg`
 * or `i` whose bounding box is at least `minPx` square.
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, selector: string, count: number }} slot
 * @returns {Promise<string[]>} One line per failing slot
 */
async function failingIconSlots(page, slot) {
  const locator = page.locator(slot.selector);
  await expect(locator, `${slot.name} slots`).toHaveCount(slot.count);
  const boxes = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const glyphs = element.matches('svg, i')
        ? [element]
        : [...element.querySelectorAll('svg, i')];
      return glyphs.map((glyph) => {
        const { width, height } = glyph.getBoundingClientRect();
        return { tag: glyph.localName, width, height };
      });
    })
  );
  return boxes.flatMap((glyphs, index) => {
    const rendered = glyphs.some(
      ({ width, height }) => width >= MIN_ICON_PX && height >= MIN_ICON_PX
    );
    if (rendered) return [];
    const found = glyphs.map(({ tag, width, height }) => `${tag} ${width}x${height}`).join(', ');
    return [`${slot.name} ${index + 1}: ${found || 'no svg or i'}`];
  });
}

/**
 * Scrolls to y = 150 and waits until `.back-to-top` shows, as AC-72 states.
 * @param {import('@playwright/test').Page} page
 */
async function revealBackToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 150, left: 0, behavior: 'instant' }));
  await expect(page.locator(BACK_TO_TOP_SLOT.selector)).toBeVisible();
}

test.describe('at small', () => {
  test.use(small);

  test('AC-39: the nav toggle reports open and closed through aria-expanded', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator(MOBILE_NAV_TOGGLE);

    await expect(toggle, 'before the clicks').toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle, 'after the first click').toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(toggle, 'after the second click').toHaveAttribute('aria-expanded', 'false');
  });

  test(
    'AC-72: every icon slot renders an svg or i of at least 8 x 8 px',
    { tag: '@live' },
    async ({ page }) => {
      await page.goto('/');
      await revealBackToTop(page);

      const failing = [];
      for (const slot of [...ICON_SLOTS, TOGGLE_SLOT, BACK_TO_TOP_SLOT]) {
        failing.push(...(await failingIconSlots(page, slot)));
      }

      expect(failing, 'icon slots without a rendered svg or i of at least 8 x 8 px').toEqual([]);
    }
  );
});

test.describe('at desktop', () => {
  test.use(desktop);

  test(
    'AC-68: the main frame requests nothing from Google font hosts during a full visit',
    { tag: '@live' },
    async ({ page, context }) => {
      test.setTimeout(FULL_VISIT_TIMEOUT_MS);
      const mainFrameFontRequests = [];
      context.on('request', (request) => {
        const line = mainFrameFontRequest(request, page);
        if (line) mainFrameFontRequests.push(line);
      });

      await fullVisit(page);

      expect(
        mainFrameFontRequests,
        'main-frame requests to fonts.googleapis.com or fonts.gstatic.com'
      ).toEqual([]);
    }
  );

  test(
    'AC-71: body, section titles and the hero text load Open Sans, Raleway and Poppins',
    {
      tag: '@live',
    },
    async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);

      const results = await page.evaluate((families) => {
        const firstFamily = (fontFamily) =>
          fontFamily
            .split(',')[0]
            .trim()
            .replace(/^["']|["']$/g, '');
        return families.map(({ selector, family }) => {
          const style = getComputedStyle(document.querySelector(selector));
          const query = `${style.fontWeight} ${style.fontSize} "${family}"`;
          return {
            selector,
            firstFamily: firstFamily(style.fontFamily),
            query,
            loaded: document.fonts.check(query),
          };
        });
      }, TEXT_FAMILIES);

      for (const [index, { selector, family }] of TEXT_FAMILIES.entries()) {
        const result = results[index];
        expect(result.firstFamily, `first font-family of ${selector}`).toBe(family);
        expect(result.loaded, `document.fonts.check('${result.query}') for ${selector}`).toBe(true);
      }
    }
  );

  test(
    'AC-72: every icon slot renders an svg or i of at least 8 x 8 px',
    { tag: '@live' },
    async ({ page }) => {
      await page.goto('/');
      await revealBackToTop(page);

      const failing = [];
      for (const slot of [...ICON_SLOTS, BACK_TO_TOP_SLOT]) {
        failing.push(...(await failingIconSlots(page, slot)));
      }

      expect(failing, 'icon slots without a rendered svg or i of at least 8 x 8 px').toEqual([]);
    }
  );

  test(
    'AC-78: the header profile photo renders as a circle',
    { tag: '@live' },
    async ({ page }) => {
      await page.goto('/');
      const photo = page.locator('#header .profile img');

      const box = await photo.boundingBox();
      expect(box, 'bounding box of #header .profile img').not.toBeNull();
      expect(
        Math.abs(box.width - box.height),
        `|width - height| of ${box.width} x ${box.height}`
      ).toBeLessThanOrEqual(1);

      const radius = await photo.evaluate((image) => getComputedStyle(image).borderTopLeftRadius);
      const isCircleRadius = radius === '50%' || parseFloat(radius) >= box.width / 2;
      expect(isCircleRadius, `border-top-left-radius ${radius} at width ${box.width}`).toBe(true);
    }
  );
});

test.describe('at phone', () => {
  test.use(phone);

  test(
    'AC-67: no image response decodes 3840 px wide or wider',
    { tag: '@live' },
    async ({ page }) => {
      const bodies = [];
      page.on('response', (response) => {
        if (response.request().resourceType() !== 'image') return;
        if (response.status() >= 300 && response.status() < 400) return;
        bodies.push(
          response.body().then(
            (body) => ({
              url: response.url(),
              base64: body.toString('base64'),
              contentType: response.headers()['content-type'] ?? '',
            }),
            (error) => ({ url: response.url(), error: String(error) })
          )
        );
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const failing = [];
      for (const body of await Promise.all(bodies)) {
        const decoded = body.error ? body : await page.evaluate(decodedImageWidth, body);
        if (decoded.error) {
          failing.push(`${body.url}: not decoded (${decoded.error})`);
        } else if (decoded.width >= MAX_IMAGE_WIDTH_PX) {
          failing.push(`${body.url}: ${decoded.width} px wide`);
        }
      }

      expect(bodies.length, 'image responses').toBeGreaterThan(0);
      expect(failing, `image responses decoding to ${MAX_IMAGE_WIDTH_PX} px or wider`).toEqual([]);
    }
  );
});

for (const [viewportName, viewport] of Object.entries({ phone, desktop })) {
  test.describe(`at ${viewportName}`, () => {
    test.use(viewport);

    test(
      'AC-76: cumulative layout shift stays at or below 0.1 until 5 s after load',
      {
        tag: '@live',
      },
      async ({ page }) => {
        await page.addInitScript(installLayoutShiftObserver, CLS_KEY);
        await page.goto('/', { waitUntil: 'load' });
        await page.waitForTimeout(CLS_WINDOW_AFTER_LOAD_MS);

        const record = await page.evaluate((key) => window[key], CLS_KEY);
        const shifts = record.entries
          .map(({ value, sources }) => `${value.toFixed(4)} (${sources.join(', ') || 'no source'})`)
          .join('; ');

        expect(record.value, `CLS from: ${shifts || 'no shifts'}`).toBeLessThanOrEqual(MAX_CLS);
      }
    );

    test(
      'AC-77: every image below the fold at DOMContentLoaded is lazy',
      {
        tag: '@live',
      },
      async ({ page }) => {
        await page.addInitScript(installFoldMeasurement, FOLD_KEY);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const measured = await page.evaluate((key) => window[key], FOLD_KEY);
        expect(measured, 'measurements taken at DOMContentLoaded').toBeDefined();
        expect(measured.images.length, '<img> elements').toBeGreaterThan(0);

        const failing = measured.images
          .filter(({ top }) => top >= measured.viewportHeight)
          .filter(({ loading }) => loading !== 'lazy')
          .map(({ src, top, loading }) => `${src} top=${top} loading=${loading ?? '(none)'}`);

        expect(
          failing,
          `images at or below ${measured.viewportHeight} px without loading="lazy"`
        ).toEqual([]);
      }
    );
  });
}
