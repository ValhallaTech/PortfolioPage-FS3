/**
 * Motion and the contact form's busy state (spec stabilize-and-cleanup, WI-55: AC-44,
 * AC-58, AC-59, AC-66, AC-109, AC-110, AC-111, AC-112, AC-114, AC-125).
 *
 * The active testimonial is identified by the text of `.testimonial-name` inside
 * `.testimonials .swiper-slide-active`, as AC-44, AC-109 and AC-125 state, which works
 * with or without Swiper's loop mode. Every carousel test sets its reduced-motion
 * preference before navigation.
 *
 * The fixed waits are the ones the ACs name: the 11 s of AC-44 and AC-109, the 60 s typing
 * recording of AC-110 to AC-112 and the 10 s after its settle point, AC-114's 12 s, and
 * AC-66's 500 ms and 1 s instants. Everything else waits with web-first assertions or
 * `expect.poll` (RK-4). AC-44, AC-109 to AC-112, AC-114 and AC-125 carry `@slow`, so
 * `yarn test:smoke` leaves them out. No AC here names both targets, so none carries
 * `@live`.
 */
import { test, expect, WEB3FORMS_URL } from './fixtures.js';
import { desktop, small } from './viewports.js';
import { fillContactForm, mockWeb3Forms, openContactModal } from './helpers/contact-modal.js';
import { focusBody, TAB_WALK_MAX_PRESSES } from './helpers/tab-walk.js';

const TESTIMONIALS = '#testimonials';
const ACTIVE_SLIDE = '.testimonials .swiper-slide-active';
const TESTIMONIAL_NAME = '.testimonial-name';
const TESTIMONIAL_ITEM = '.testimonial-item';
const PAGINATION_BULLET = '.testimonials .swiper-pagination-bullet';

/** The three testimonial names, one per slide (AC-44, AC-109, AC-125). */
const TESTIMONIAL_NAMES = Object.freeze(['Abe Lincoln', 'Gandhi', 'Michael Jackson']);

/** AC-44's sanity precondition: rotation is observable within this long. */
const ROTATION_PRECONDITION_MS = 6_000;

/** AC-44 and AC-109: two of today's 5 s autoplay periods. */
const TWO_AUTOPLAY_PERIODS_MS = 11_000;

/** WCAG 2.5.8 target size (AC-59). */
const MIN_BULLET_PX = 24;

/** AC-66: the mock's delay, and the two instants the AC reads the busy state at. */
const WEB3FORMS_DELAY_MS = 2_000;
const BUSY_CHECK_AFTER_SUBMIT_MS = 500;
const IDLE_CHECK_AFTER_RESPONSE_MS = 1_000;

/** AC-110 to AC-112: the hero typing element and the recording window. */
const TYPED_ELEMENT = '.typed';
const HERO = '#hero';
const TYPING_RECORDING_MS = 60_000;
const TYPED_PHRASES = Object.freeze([
  'a Designer',
  'a Developer',
  'a Photographer',
  'a Coding Ninja',
]);
const LAST_PHRASE = 'a Coding Ninja';
const SETTLE_DEADLINE_AFTER_LOAD_MS = 45_000;
const QUIET_AFTER_SETTLE_MS = 10_000;

/** AC-114's widths, all at height 900, and its wait after the carousel is in view. */
const AC_114_WIDTHS = [375, 767, 768, 899, 900, 1440, 1920];
const AC_114_HEIGHT = 900;
const AC_114_WAIT_MS = 12_000;

/** AC-125: every name is seen within 16 s, and each slide is opaque within 2 s. */
const ALL_NAMES_SEEN_MS = 16_000;
const OPAQUE_WITHIN_MS = 2_000;
const SAMPLE_INTERVAL_MS = 50;

/** Budgets of the tests that wait for as long as their AC says. */
const CAROUSEL_TIMEOUT_MS = 60_000;
const TYPING_TIMEOUT_MS = 120_000;

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
 * Loads `/` with the given reduced-motion preference, set before navigation, and brings
 * the testimonials into view.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'reduce' | 'no-preference'} reducedMotion
 */
async function gotoTestimonials(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.goto('/');
  await showTestimonials(page);
}

/**
 * The name on the active testimonial slide, read now without waiting.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string | null>} The name, or `null` when no slide is active.
 */
function activeTestimonialName(page) {
  return page.evaluate(
    ({ slide, name }) => document.querySelector(`${slide} ${name}`)?.textContent.trim() ?? null,
    { slide: ACTIVE_SLIDE, name: TESTIMONIAL_NAME }
  );
}

/**
 * Presses Tab from the start of the page until `target` holds focus, up to the Tab walk's
 * press limit.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} target A locator that matches one element.
 * @returns {Promise<number | null>} The press that reached it, or `null` if none did.
 */
async function tabTo(page, target) {
  await focusBody(page);
  for (let press = 1; press <= TAB_WALK_MAX_PRESSES; press += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return press;
  }
  return null;
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
 * Runs in the page before any page script. From `DOMContentLoaded`, records each distinct
 * `textContent` of the hero typing element with its time, and records the `load` time.
 *
 * @param {string} selector The typing element.
 */
function installTypingRecorder(selector) {
  const recording = { domContentLoadedAt: null, loadAt: null, changes: [] };
  window.__typingRecording = recording;
  window.addEventListener('load', () => {
    recording.loadAt = performance.now();
  });
  document.addEventListener('DOMContentLoaded', () => {
    recording.domContentLoadedAt = performance.now();
    const element = document.querySelector(selector);
    if (!element) return;
    let last = element.textContent;
    recording.changes.push({ at: recording.domContentLoadedAt, text: last });
    new MutationObserver(() => {
      const text = element.textContent;
      if (text === last) return;
      last = text;
      recording.changes.push({ at: performance.now(), text });
    }).observe(element, { childList: true, characterData: true, subtree: true });
  });
}

/**
 * Loads `/` at no reduced-motion preference and records the hero typing element for 60 s
 * from `DOMContentLoaded` (AC-110's Given).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ loadAt: number, endAt: number, changes: Array<{ at: number, text: string }> }>}
 *   Times are `performance.now()` values of the page.
 */
async function recordTyping(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(installTypingRecorder, TYPED_ELEMENT);
  await page.goto('/');
  const elapsed = await page.evaluate(
    () => performance.now() - window.__typingRecording.domContentLoadedAt
  );
  await page.waitForTimeout(Math.max(0, TYPING_RECORDING_MS - elapsed));
  return page.evaluate(() => ({
    loadAt: window.__typingRecording.loadAt,
    endAt: performance.now(),
    changes: window.__typingRecording.changes.map((change) => ({ ...change })),
  }));
}

/**
 * The recorded change that settles the typing: the last one in the recording.
 *
 * @param {{ changes: Array<{ at: number, text: string }> }} recording
 */
function settlePoint(recording) {
  return recording.changes.at(-1);
}

/**
 * Runs in the page: describes every running animation whose target is inside `selector`.
 *
 * @param {string} selector
 * @returns {string[]}
 */
function runningAnimationsInside(selector) {
  const root = document.querySelector(selector);
  return document
    .getAnimations()
    .filter(
      (animation) =>
        animation.playState === 'running' &&
        animation.effect?.target instanceof Element &&
        root.contains(animation.effect.target)
    )
    .map((animation) => {
      const target = animation.effect.target;
      const classes = target.classList.length ? `.${[...target.classList].join('.')}` : '';
      const name = animation.animationName ?? animation.transitionProperty ?? animation.id;
      return `${target.localName}${classes} (${animation.constructor.name} ${name})`;
    });
}

/**
 * Runs in the page (AC-125). Every few milliseconds it reads the active slide's name. The
 * first time a name becomes active it records that moment, and while that slide stays
 * active it records the first moment the slide's `.testimonial-item` and every ancestor up
 * to and including `#testimonials` have a computed `opacity` of "1".
 *
 * @param {{ slide: string, name: string, item: string, root: string, intervalMs: number }} selectors
 */
function startOpacitySampler({ slide, name, item, root, intervalMs }) {
  const record = { startedAt: performance.now(), names: {} };
  window.__testimonialOpacity = record;
  let current = null;

  const fullyOpaque = (element) => {
    for (let node = element; node; node = node.parentElement) {
      if (getComputedStyle(node).opacity !== '1') return false;
      if (node.matches(root)) return true;
    }
    return false;
  };

  setInterval(() => {
    const now = performance.now();
    const active = document.querySelector(slide);
    const activeName = active?.querySelector(name)?.textContent.trim() ?? null;
    if (activeName !== current) {
      current = activeName;
      if (activeName && !record.names[activeName]) {
        record.names[activeName] = { activatedAt: now, opaqueAt: null };
      }
    }
    const entry = activeName ? record.names[activeName] : undefined;
    if (entry && entry.opaqueAt === null) {
      const itemElement = active.querySelector(item);
      if (itemElement && fullyOpaque(itemElement)) entry.opaqueAt = now;
    }
  }, intervalMs);
}

/**
 * The AC-125 record so far, with the page's current time.
 *
 * @param {import('@playwright/test').Page} page
 */
function readOpacityRecord(page) {
  return page.evaluate(() => ({
    now: performance.now(),
    startedAt: window.__testimonialOpacity.startedAt,
    names: structuredClone(window.__testimonialOpacity.names),
  }));
}

test.describe('carousel at small', () => {
  test.use(small);

  test('AC-44: the pause control stops carousel rotation', { tag: '@slow' }, async ({ page }) => {
    test.setTimeout(CAROUSEL_TIMEOUT_MS);
    await gotoTestimonials(page, 'no-preference');

    const before = await activeTestimonialName(page);
    expect(TESTIMONIAL_NAMES, 'the active slide shows a testimonial name').toContain(before);
    await expect
      .poll(() => activeTestimonialName(page), {
        message: 'precondition: the carousel rotates on its own within 6 s',
        timeout: ROTATION_PRECONDITION_MS,
      })
      .not.toBe(before);

    const pauseControl = page.locator(TESTIMONIALS).getByRole('button', { name: /pause/i });
    await expect(pauseControl, 'a pause button inside #testimonials').toHaveCount(1);
    expect(await tabTo(page, pauseControl), 'Tab reaches the pause button').not.toBeNull();

    await page.keyboard.press('Enter');
    const atEnter = await activeTestimonialName(page);
    await page.waitForTimeout(TWO_AUTOPLAY_PERIODS_MS);

    expect(await activeTestimonialName(page), 'the active slide 11 s after Enter').toBe(atEnter);
  });

  test(
    'AC-109: under reduced motion, the carousel does not rotate on its own',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(CAROUSEL_TIMEOUT_MS);
      await gotoTestimonials(page, 'reduce');

      const atStart = await activeTestimonialName(page);
      expect(TESTIMONIAL_NAMES, 'the active slide shows a testimonial name').toContain(atStart);
      await page.waitForTimeout(TWO_AUTOPLAY_PERIODS_MS);

      expect(await activeTestimonialName(page), 'the active slide 11 s later').toBe(atStart);
    }
  );

  test('AC-58: carousel bullets are named buttons', async ({ page }) => {
    await page.goto('/');
    await showTestimonials(page);
    const bullets = page.locator(PAGINATION_BULLET);
    await expect(bullets.first(), 'the carousel has pagination bullets').toBeAttached();

    const names = [];
    for (const bullet of await bullets.all()) {
      await expect(bullet).toHaveRole('button');
      await expect(bullet).toHaveAccessibleName(/\S/);
      names.push(await accessibleName(bullet));
    }

    expect(new Set(names).size, `bullet names ${JSON.stringify(names)} are distinct`).toBe(
      names.length
    );
  });

  test('AC-59: carousel bullets are at least 24 x 24 px', async ({ page }) => {
    await page.goto('/');
    await showTestimonials(page);
    const bullets = page.locator(PAGINATION_BULLET);
    await expect(bullets.first(), 'the carousel has pagination bullets').toBeAttached();

    const tooSmall = [];
    for (const [index, bullet] of (await bullets.all()).entries()) {
      const box = await bullet.boundingBox();
      if (!box || box.width < MIN_BULLET_PX || box.height < MIN_BULLET_PX) {
        tooSmall.push({ bullet: index + 1, width: box?.width, height: box?.height });
      }
    }

    expect(tooSmall, `bullets smaller than ${MIN_BULLET_PX} x ${MIN_BULLET_PX} px`).toEqual([]);
  });

  test(
    'AC-125: every testimonial is fully visible when its slide becomes active',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(CAROUSEL_TIMEOUT_MS);
      await gotoTestimonials(page, 'no-preference');
      await page.evaluate(startOpacitySampler, {
        slide: ACTIVE_SLIDE,
        name: TESTIMONIAL_NAME,
        item: TESTIMONIAL_ITEM,
        root: TESTIMONIALS,
        intervalMs: SAMPLE_INTERVAL_MS,
      });

      await expect
        .poll(async () => Object.keys((await readOpacityRecord(page)).names).sort(), {
          message: 'all three testimonial names become active within 16 s',
          timeout: ALL_NAMES_SEEN_MS,
        })
        .toEqual([...TESTIMONIAL_NAMES].sort());

      // Wait until each name is either opaque or past its 2 s bound.
      await expect
        .poll(
          async () => {
            const { now, names } = await readOpacityRecord(page);
            return Object.values(names).every(
              ({ activatedAt, opaqueAt }) =>
                opaqueAt !== null || now - activatedAt > OPAQUE_WITHIN_MS
            );
          },
          { message: 'every active slide has been watched for its 2 s bound' }
        )
        .toBe(true);

      const { startedAt, names } = await readOpacityRecord(page);
      const failures = Object.entries(names)
        .map(([name, { activatedAt, opaqueAt }]) => ({
          name,
          activeAfterMs: Math.round(activatedAt - startedAt),
          opaqueAfterActiveMs: opaqueAt === null ? null : Math.round(opaqueAt - activatedAt),
        }))
        .filter(
          ({ activeAfterMs, opaqueAfterActiveMs }) =>
            activeAfterMs > ALL_NAMES_SEEN_MS ||
            opaqueAfterActiveMs === null ||
            opaqueAfterActiveMs > OPAQUE_WITHIN_MS
        );

      expect(
        failures,
        'testimonials not fully opaque within 2 s of becoming active (null: never while active)'
      ).toEqual([]);
    }
  );
});

for (const width of AC_114_WIDTHS) {
  test.describe(`carousel at ${width} x ${AC_114_HEIGHT}`, () => {
    test.use({ viewport: { width, height: AC_114_HEIGHT } });

    test(
      `AC-114: the carousel logs no loop warning at ${width} px`,
      { tag: '@slow' },
      async ({ page }) => {
        test.setTimeout(CAROUSEL_TIMEOUT_MS);
        const loopMessages = [];
        page.on('console', (message) => {
          if (/loop/i.test(message.text()))
            loopMessages.push(`${message.type()}: ${message.text()}`);
        });

        await gotoTestimonials(page, 'no-preference');
        await page.waitForTimeout(AC_114_WAIT_MS);

        expect(loopMessages, `console messages matching /loop/i at ${width} px`).toEqual([]);
      }
    );
  });
}

test.describe('hero typing at desktop', () => {
  test.use(desktop);

  test(
    'AC-110: the typing effect shows each phrase once, in order',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(TYPING_TIMEOUT_MS);
      const recording = await recordTyping(page);

      const phrases = await page
        .locator(TYPED_ELEMENT)
        .getAttribute('data-typed-items')
        .then((items) => items.split(',').map((phrase) => phrase.trim()));
      const completePhrases = recording.changes
        .map(({ text }) => text)
        .filter((text) => phrases.includes(text))
        .filter((text, index, texts) => index === 0 || text !== texts[index - 1]);

      expect(
        completePhrases,
        'complete phrases shown in 60 s, consecutive repeats collapsed'
      ).toEqual(TYPED_PHRASES);
    }
  );

  test('AC-111: the typing effect stops on its last phrase', { tag: '@slow' }, async ({ page }) => {
    test.setTimeout(TYPING_TIMEOUT_MS);
    const recording = await recordTyping(page);
    const settle = settlePoint(recording);

    expect(
      Math.round(settle.at - recording.loadAt),
      'ms from load to the last text change'
    ).toBeLessThanOrEqual(SETTLE_DEADLINE_AFTER_LOAD_MS);
    expect(settle.text, 'the final text').toBe(LAST_PHRASE);
    expect(
      Math.round(recording.endAt - settle.at),
      'ms recorded with no change after the last one'
    ).toBeGreaterThanOrEqual(QUIET_AFTER_SETTLE_MS);
  });

  test(
    'AC-112: nothing in the hero keeps animating after the typing stops',
    { tag: '@slow' },
    async ({ page }) => {
      test.setTimeout(TYPING_TIMEOUT_MS);
      const recording = await recordTyping(page);
      const settle = settlePoint(recording);
      const now = await page.evaluate(() => performance.now());
      await page.waitForTimeout(Math.max(0, settle.at + QUIET_AFTER_SETTLE_MS - now));

      expect(
        await page.evaluate(runningAnimationsInside, HERO),
        'running animations inside #hero 10 s after the typing settles'
      ).toEqual([]);
    }
  );
});

test.describe('contact form at desktop', () => {
  test.use(desktop);

  test('AC-66: the form is busy while a submission is in flight', async ({ page }) => {
    await mockWeb3Forms(page, { success: true }, { delayMs: WEB3FORMS_DELAY_MS });
    await page.goto('/');
    await openContactModal(page);
    await fillContactForm(page);
    const form = page.locator('#contact-form');

    const responded = page.waitForResponse(WEB3FORMS_URL);
    // A failed busy check ends the test before the response; that must not add a second error.
    responded.catch(() => {});
    await page.locator('#submit-btn').click();
    await page.waitForTimeout(BUSY_CHECK_AFTER_SUBMIT_MS);
    // Bounded so it can only pass while the 2 s request is still in flight.
    await expect(form, '500 ms after submit').toHaveAttribute('aria-busy', 'true', {
      timeout: IDLE_CHECK_AFTER_RESPONSE_MS,
    });

    await responded;
    await page.waitForTimeout(IDLE_CHECK_AFTER_RESPONSE_MS);
    // The AC fixes the instant, so this reads once instead of retrying.
    expect(await form.getAttribute('aria-busy'), '1 s after the response').not.toBe('true');
  });
});
