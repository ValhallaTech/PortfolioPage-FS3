/**
 * Regression tests for the testimonials carousel controls (spec stabilize-and-cleanup,
 * D-14: the *Control*, *Pausing* and *Reduced motion* lines; WI-52).
 *
 * The active testimonial is the text of `.testimonial-name` inside
 * `.testimonials .swiper-slide-active`, as in motion.spec.js. A hold check records every
 * change of that name in the page (a MutationObserver on the slides' classes) across one
 * fixed observation window, so a change that happens and is undone inside the window still
 * fails the test. That window is the only fixed wait here: absence of a change cannot be
 * polled for. Every other wait is a web-first assertion or `expect.poll` (RK-4). Tests
 * that wait on autoplay periods carry `@slow`, so `yarn test:smoke` leaves them out.
 */
import { test, expect } from './fixtures.js';
import { desktop, small } from './viewports.js';

const TESTIMONIALS = '#testimonials';
const CAROUSEL = '.testimonials-carousel';
const WRAPPER = '.testimonials-carousel .swiper-wrapper';
const ACTIVE_SLIDE = '.testimonials .swiper-slide-active';
const TESTIMONIAL_NAME = '.testimonial-name';
const PAGINATION_BULLET = '.testimonials .swiper-pagination-bullet';
const TOGGLE = '#testimonials .testimonials-autoplay-toggle';

/** The toggle's accessible names (D-14 *Control*). */
const PAUSE_NAME = 'Pause testimonials';
const PLAY_NAME = 'Play testimonials';

/**
 * One 5 s autoplay delay, the 300 ms slide transition, and margin. Running autoplay
 * changes the slide within this long, so it is both the hold window and the deadline for
 * rotation to (re)start.
 */
const ONE_PERIOD_PLUS_MARGIN_MS = 7_000;

/** Budget of a test that holds for one window and then waits for rotation. */
const CAROUSEL_TIMEOUT_MS = 45_000;

/** D-14 *Control*: Swiper locks, and hides the toggle, from 900 px up. */
const TOGGLE_VISIBILITY = Object.freeze([
  { name: 'small (375 px)', options: small, visible: true },
  { name: '899 px', options: { viewport: { width: 899, height: 900 } }, visible: true },
  { name: '900 px', options: { viewport: { width: 900, height: 900 } }, visible: false },
  { name: '1440 px', options: desktop, visible: false },
]);

/**
 * Scrolls `#testimonials` into view without moving the mouse, so Swiper's hover pause
 * stays off.
 *
 * @param {import('@playwright/test').Page} page
 */
async function showTestimonials(page) {
  await page
    .locator(TESTIMONIALS)
    .evaluate((section) => section.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

/**
 * Loads `/` with the given reduced-motion preference, set before navigation, brings the
 * testimonials into view and waits until Swiper has initialized.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'reduce' | 'no-preference'} reducedMotion
 */
async function gotoCarousel(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.goto('/');
  await showTestimonials(page);
  await expect(page.locator(CAROUSEL), 'Swiper initialized').toHaveClass(/swiper-initialized/);
}

/**
 * Starts recording, in the page, every name the active slide shows from now on.
 *
 * @param {import('@playwright/test').Page} page
 */
async function recordActiveNames(page) {
  await page.evaluate(
    ({ slide, name, wrapper }) => {
      const read = () => document.querySelector(`${slide} ${name}`)?.textContent.trim() ?? null;
      const seen = [read()];
      new MutationObserver(() => {
        const now = read();
        if (now !== seen.at(-1)) seen.push(now);
      }).observe(document.querySelector(wrapper), {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
      window.__activeNames = seen;
    },
    { slide: ACTIVE_SLIDE, name: TESTIMONIAL_NAME, wrapper: WRAPPER }
  );
}

/**
 * The names recorded since `recordActiveNames`, the first being the one shown at its call.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<string | null>>}
 */
function activeNamesSeen(page) {
  return page.evaluate(() => [...window.__activeNames]);
}

/**
 * Records the active slide across one hold window and asserts it never changed.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} why What holds the slide, for the failure message.
 */
async function expectSlideHeld(page, why) {
  await recordActiveNames(page);
  const [atStart] = await activeNamesSeen(page);
  expect(atStart, 'the active slide shows a testimonial name').toEqual(expect.any(String));
  // Fixed observation window: the absence of a slide change cannot be polled for.
  await page.waitForTimeout(ONE_PERIOD_PLUS_MARGIN_MS);
  expect(await activeNamesSeen(page), `active slide names while ${why}`).toEqual([atStart]);
}

/**
 * Waits until the active slide shows a name other than the one it shows now.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} message
 */
async function expectRotation(page, message) {
  await recordActiveNames(page);
  await expect
    .poll(async () => (await activeNamesSeen(page)).length, {
      message,
      timeout: ONE_PERIOD_PLUS_MARGIN_MS,
    })
    .toBeGreaterThan(1);
}

for (const { name, options, visible } of TOGGLE_VISIBILITY) {
  test.describe(`carousel toggle at ${name}`, () => {
    test.use(options);

    test(`D-14 Control: the toggle is ${visible ? 'visible' : 'hidden'} at ${name}`, async ({
      page,
    }) => {
      await gotoCarousel(page, 'no-preference');
      const toggle = page.locator(TOGGLE);
      await expect(toggle, 'the toggle is in the markup').toBeAttached();

      if (visible) {
        await expect(toggle, 'Swiper is unlocked, so the toggle shows').toBeVisible();
      } else {
        await expect(toggle, 'Swiper is locked, so the toggle stays hidden').toBeHidden();
      }
    });
  });
}

test.describe('carousel toggle at small without JavaScript', () => {
  test.use({ ...small, javaScriptEnabled: false });

  test('D-14 Control: the toggle is hidden with JavaScript off', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator(TOGGLE);
    await expect(toggle, 'the toggle is in the markup').toBeAttached();
    await expect(toggle, 'the hidden attribute keeps it hidden').toBeHidden();
  });
});

test.describe('carousel controls at small', () => {
  test.use(small);

  test('D-14 Control: Play restarts rotation after Pause', { tag: '@slow' }, async ({ page }) => {
    test.setTimeout(CAROUSEL_TIMEOUT_MS);
    await gotoCarousel(page, 'no-preference');
    const toggle = page.locator(TOGGLE);

    await expect(toggle, 'rotating at load').toHaveAccessibleName(PAUSE_NAME);
    await toggle.click();
    await expect(toggle, 'after Pause').toHaveAccessibleName(PLAY_NAME);
    await expectSlideHeld(page, 'paused by the toggle');

    await toggle.click();
    await expect(toggle, 'after Play').toHaveAccessibleName(PAUSE_NAME);
    await expectRotation(page, 'the slide changes within one period after Play');
  });

  test(
    'D-14 Pausing: focus inside the carousel holds the slide, and leaving resumes rotation',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(CAROUSEL_TIMEOUT_MS);
      await gotoCarousel(page, 'no-preference');
      const toggle = page.locator(TOGGLE);
      await expect(toggle, 'rotating at load').toHaveAccessibleName(PAUSE_NAME);

      await page.locator(PAGINATION_BULLET).first().focus();
      await expectSlideHeld(page, 'a bullet inside the carousel has focus');

      // The toggle is outside the focus-pause area (D-14 Control), so focusing it leaves.
      await toggle.focus();
      await expectRotation(page, 'the slide changes within one period after focus leaves');
    }
  );

  test(
    'D-14 Pausing: hovering the carousel holds the slide, and leaving resumes rotation',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(CAROUSEL_TIMEOUT_MS);
      await gotoCarousel(page, 'no-preference');
      await expect(page.locator(TOGGLE), 'rotating at load').toHaveAccessibleName(PAUSE_NAME);

      await page.locator(CAROUSEL).hover();
      await expectSlideHeld(page, 'the mouse is over the carousel');

      await page.mouse.move(0, 0);
      await expectRotation(page, 'the slide changes within one period after the mouse leaves');
    }
  );

  test(
    'D-14 Reduced motion: a live change to no-preference does not rotate while focus is inside',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(CAROUSEL_TIMEOUT_MS);
      await gotoCarousel(page, 'reduce');
      const toggle = page.locator(TOGGLE);
      await expect(toggle, 'stopped under reduced motion').toHaveAccessibleName(PLAY_NAME);

      await page.locator(PAGINATION_BULLET).first().focus();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await expectSlideHeld(page, 'focus stays inside after the live preference change');

      // Shows the live change took effect: with focus outside, rotation now runs.
      await toggle.focus();
      await expectRotation(page, 'the slide changes within one period after focus leaves');
    }
  );

  test('D-14 Pausing: the live region is polite while focus holds the slide, off while rotating', async ({
    page,
  }) => {
    await gotoCarousel(page, 'no-preference');
    const toggle = page.locator(TOGGLE);
    const wrapper = page.locator(WRAPPER);
    await expect(toggle, 'rotating at load').toHaveAccessibleName(PAUSE_NAME);
    await expect(wrapper, 'rotating with focus outside').toHaveAttribute('aria-live', 'off');

    await page.locator(PAGINATION_BULLET).first().focus();
    await expect(wrapper, 'focus inside the carousel').toHaveAttribute('aria-live', 'polite');

    await toggle.focus();
    await expect(wrapper, 'rotating again with focus outside').toHaveAttribute('aria-live', 'off');
  });
});
