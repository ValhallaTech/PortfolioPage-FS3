import Muuri from 'muuri';
import Swiper from 'swiper';
import { A11y, Autoplay, Pagination } from 'swiper/modules';
import GLightbox from 'glightbox';
// Deep import: bare 'bootstrap' loads every plugin, and its datepicker needs vanilla-calendar-pro (R9).
// Imported for its data API: data-bs-toggle and data-bs-dismiss="dialog" drive the contact dialog.
import 'bootstrap/js/dist/dialog.js';

import 'swiper/swiper.css';
import 'swiper/modules/a11y.css';
import 'swiper/modules/pagination.css';
import 'glightbox/dist/css/glightbox.min.css';
// Self-hosted text fonts (D-2): latin subset only, and only the weights the page renders.
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-400-italic.css';
import '@fontsource/open-sans/latin-600.css';
import '@fontsource/open-sans/latin-700.css';
import '@fontsource/raleway/latin-500.css';
import '@fontsource/raleway/latin-600.css';
import '@fontsource/raleway/latin-700.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-600.css';
import '../css/style.css';

import {
  smoothScrollTo,
  toggleMobileNav,
  closeMobileNav,
  setupScrollHandlers,
  setupNavClickHandlers,
  setupPortfolioFilters,
  portfolioFilterSelector,
  portfolioFilterOptions,
  resolveHashTarget,
  resolveLightboxHref,
} from './utils.js';
import { introHero, revealOnScroll } from './motion.js';

/** The reveal targets the scroll reveals own: every `data-reveal` element but the hero. */
const REVEAL_TARGET_SELECTOR = '[data-reveal]:not([data-reveal="hero"])';

/** The media query a visitor's reduced-motion preference is read from. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the visitor currently asks for reduced motion.
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// Sprint 3: Muuri owns the transform, opacity and display of .portfolio-item and .portfolio-wrap, so do not animate them with GSAP.
/**
 * Initialize the portfolio Muuri grid and bind its filter buttons.
 * @param {Element} container - The portfolio container element
 * @returns {Muuri|null}
 */
function initPortfolioGrid(container) {
  if (!container) return null;

  const duration = prefersReducedMotion() ? 0 : 300;
  const grid = new Muuri(container, {
    items: '.portfolio-item',
    layoutOnInit: true,
    layoutOnResize: 150,
    dragEnabled: false,
    showDuration: duration,
    hideDuration: duration,
    layoutDuration: duration,
  });

  window.addEventListener('load', () => {
    grid.refreshItems().layout(true);
  });

  const buttons = document.querySelectorAll('#portfolio-filters button[data-filter]');
  setupPortfolioFilters(buttons, (filterValue) => {
    grid.filter(
      portfolioFilterSelector(filterValue),
      portfolioFilterOptions(prefersReducedMotion())
    );
  });

  return grid;
}

/** The autoplay toggle's name and sprite icon, by whether autoplay is running (D-14). */
const AUTOPLAY_TOGGLE_STATES = Object.freeze({
  running: Object.freeze({ label: 'Pause testimonials', icon: '#icon-pause' }),
  stopped: Object.freeze({ label: 'Play testimonials', icon: '#icon-play' }),
});

/**
 * Shows whether the carousel rotates on the autoplay toggle: its name and icon.
 * @param {Swiper} swiper
 * @param {Element} toggle - The autoplay toggle button
 */
function showAutoplayState(swiper, toggle) {
  const { label, icon } = swiper.autoplay.running
    ? AUTOPLAY_TOGGLE_STATES.running
    : AUTOPLAY_TOGGLE_STATES.stopped;
  toggle.querySelector('.visually-hidden').textContent = label;
  toggle.querySelector('use').setAttribute('href', icon);
}

/**
 * Holds rotation while the visitor attends to the carousel: keyboard focus inside it, or a
 * mouse over it (D-14). Focus pauses autoplay here, and only inside the carousel; Swiper
 * pauses it on hover itself (pauseOnMouseEnter). pause() and resume() do nothing while
 * autoplay is stopped, so leaving the carousel never restarts rotation that the toggle or
 * reduced motion stopped.
 * Slide changes are announced unless the carousel is actually rotating, as the WAI-ARIA
 * carousel pattern says: aria-live is off only while autoplay runs and neither focus nor
 * the mouse holds it. Swiper emits autoplayPause on every transition, so the live region
 * follows focus, hover, start and stop instead of that event.
 * @param {Swiper} swiper
 * @param {Element} container - The swiper container element
 * @returns {() => boolean} Whether focus or the mouse is holding rotation
 */
function holdWhileAttended(swiper, container) {
  let hovered = false;
  const focused = () => container.contains(document.activeElement);
  const held = () => focused() || hovered;
  const announce = () => {
    const rotating = swiper.autoplay.running && !held();
    swiper.wrapperEl.setAttribute('aria-live', rotating ? 'off' : 'polite');
  };
  const leaves = (event) => !container.contains(event.relatedTarget);
  container.addEventListener('focusin', (event) => {
    if (leaves(event)) swiper.autoplay.pause();
    announce();
  });
  container.addEventListener('focusout', (event) => {
    if (leaves(event)) swiper.autoplay.resume();
    announce();
  });
  // Swiper pauses on hover for mouse pointers only (autoplay.mjs:229-245); follow the same.
  const trackHover = (isOver) => (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = isOver;
    announce();
  };
  container.addEventListener('pointerenter', trackHover(true));
  container.addEventListener('pointerleave', trackHover(false));
  // Swiper resumes a paused autoplay when a slide transition ends, as after a bullet is
  // pressed; keep it paused while focus is still inside.
  swiper.on('autoplayResume', () => {
    if (focused()) swiper.autoplay.pause();
  });
  swiper.on('autoplayStart autoplayStop', announce);
  announce();
  return held;
}

/**
 * Wires the Pause/Play toggle and the reduced-motion preference to autoplay (D-14). The
 * toggle uses stop() and start(); reduced motion stops autoplay right after construction,
 * before the first delay ends, and follows live changes of the preference without
 * restarting rotation the visitor stopped. The toggle is hidden while Swiper is locked
 * (every slide in view), when there is nothing to rotate.
 * @param {Swiper} swiper
 * @param {Element|null} toggle - The autoplay toggle button
 * @param {() => boolean} held - Whether focus or the mouse is holding rotation
 */
function bindAutoplayControls(swiper, toggle, held) {
  let stoppedByVisitor = false;

  // start() emits autoplayStart, not autoplayResume, and leaves autoplay.paused as stop()
  // found it (autoplay.mjs:156-171). So pause again while focus or the mouse holds the
  // carousel, and otherwise clear a stale paused flag, which would make Swiper skip its
  // hover pause (autoplay.mjs:234).
  const startRotation = () => {
    swiper.autoplay.start();
    if (held()) swiper.autoplay.pause();
    else if (swiper.autoplay.paused) swiper.autoplay.resume();
  };

  if (toggle) {
    const showLock = () => {
      toggle.hidden = swiper.isLocked;
    };
    swiper.on('autoplayStart autoplayStop', () => showAutoplayState(swiper, toggle));
    swiper.on('lock unlock', showLock);
    toggle.addEventListener('click', () => {
      stoppedByVisitor = swiper.autoplay.running;
      if (stoppedByVisitor) swiper.autoplay.stop();
      else startRotation();
    });
    showAutoplayState(swiper, toggle);
    showLock();
  }

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const followMotionPreference = () => {
    if (reducedMotion.matches) swiper.autoplay.stop();
    else if (!stoppedByVisitor && !swiper.autoplay.running) startRotation();
  };
  if (reducedMotion.matches) swiper.autoplay.stop();
  reducedMotion.addEventListener('change', followMotionPreference);
}

/**
 * Initialize testimonials Swiper carousel
 * @param {Element} container - The swiper container element
 * @param {Element|null} toggle - The autoplay toggle button
 * @returns {Swiper|null}
 */
function initTestimonialsCarousel(container, toggle) {
  if (!container) return null;
  const swiper = new Swiper(container, {
    modules: [A11y, Autoplay, Pagination],
    autoplay: { delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true },
    loop: false,
    rewind: true,
    pagination: { el: '.testimonials .swiper-pagination', clickable: true },
    breakpoints: {
      0: { slidesPerView: 1, spaceBetween: 20 },
      768: { slidesPerView: 2, spaceBetween: 20 },
      900: { slidesPerView: 3, spaceBetween: 20 },
    },
  });
  const held = holdWhileAttended(swiper, container);
  bindAutoplayControls(swiper, toggle, held);
  return swiper;
}

/**
 * Initialize GLightbox for portfolio items.
 * Portfolio links keep the image path in data-src (not href) so Parcel does not
 * bundle the same file twice, which would corrupt the output paths. Parcel does
 * not rewrite data-src either, so the link takes its href from the sibling
 * <img src> in the same .portfolio-wrap, which Parcel has rewritten to the hashed
 * build path. resolveLightboxHref() only returns a parsed same-origin http(s) URL,
 * so no raw DOM value reaches setAttribute; links it rejects keep href="#".
 * @returns {GLightbox|null}
 */
function initLightbox() {
  document.querySelectorAll('a.glightbox[data-src]').forEach((el) => {
    const href = resolveLightboxHref(el, document);
    if (href) {
      el.setAttribute('href', href);
    }
  });
  return GLightbox({ selector: '.glightbox', zoomable: false });
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The controls in the dialog that Tab can reach, in document order.
 * @param {HTMLDialogElement} dialogEl - The dialog element
 * @returns {HTMLElement[]}
 */
function dialogFocusables(dialogEl) {
  return [...dialogEl.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hidden && el.getClientRects().length > 0
  );
}

/**
 * Keeps focus in the open dialog, as Bootstrap 5's focus trap did (RK-2):
 * - On shown, focus moves to the first control. Bootstrap 6 calls showModal() while the
 *   dialog is still `visibility: hidden`, so the browser's own initial focus finds nothing.
 * - Tab and Shift+Tab wrap, because native showModal() lets focus leave the document.
 * @param {HTMLDialogElement|null} dialogEl - The dialog element
 */
function initDialogFocus(dialogEl) {
  if (!dialogEl) return;
  dialogEl.addEventListener('shown.bs.dialog', () => {
    if (dialogEl.contains(document.activeElement)) return;
    dialogFocusables(dialogEl)[0]?.focus();
  });
  dialogEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !dialogEl.open) return;
    const focusable = dialogFocusables(dialogEl);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogEl)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

const SENT_TEXT = 'Your message has been sent. Thank you!';
const FAILED_TEXT = 'Failed to send message. Please try again.';

/**
 * The field-level error element named by a control's aria-describedby.
 * @param {HTMLInputElement | HTMLTextAreaElement} field
 * @returns {HTMLElement | null}
 */
function fieldErrorOf(field) {
  return document.getElementById(field.getAttribute('aria-describedby'));
}

/**
 * Marks a field valid again: drops aria-invalid and empties its error text.
 * @param {HTMLInputElement | HTMLTextAreaElement} field
 */
function clearFieldError(field) {
  field.removeAttribute('aria-invalid');
  const error = fieldErrorOf(field);
  if (error) error.textContent = '';
}

/**
 * Mirrors native constraint validation onto each field (AC-16): an `invalid` event marks
 * the field and writes the browser's message into its error text; typing clears both once
 * the field is valid, or refreshes the message while it is still invalid.
 * @param {HTMLInputElement[] | HTMLTextAreaElement[]} fields
 */
function wireFieldErrors(fields) {
  fields.forEach((field) => {
    field.addEventListener('invalid', () => {
      field.setAttribute('aria-invalid', 'true');
      const error = fieldErrorOf(field);
      if (error) error.textContent = field.validationMessage;
    });
    field.addEventListener('input', () => {
      if (field.validity.valid) {
        clearFieldError(field);
      } else if (field.hasAttribute('aria-invalid')) {
        const error = fieldErrorOf(field);
        if (error) error.textContent = field.validationMessage;
      }
    });
  });
}

/**
 * Initialize Web3Forms contact form submission
 */
function initContactForm() {
  const form = document.querySelector('#contact-form');
  const submitBtn = document.querySelector('#submit-btn');
  const errorMessage = document.querySelector('#error-message');
  const sentMessage = document.querySelector('#sent-message');
  const modalEl = document.querySelector('#contactModal');

  if (!form || !submitBtn || !errorMessage || !sentMessage) return;

  const fields = Array.from(form.querySelectorAll('.form-control[aria-describedby]'));
  wireFieldErrors(fields);

  const defaultButtonText = submitBtn.textContent;
  let abortController = null;

  // Abort in-flight request and reset form state whenever the dialog is fully hidden.
  // The result text stays in its region until then (AC-14).
  if (modalEl) {
    modalEl.addEventListener('hidden.bs.dialog', () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      form.reset();
      fields.forEach(clearFieldError);
      form.removeAttribute('aria-busy');
      errorMessage.textContent = '';
      sentMessage.textContent = '';
      submitBtn.disabled = false;
      submitBtn.textContent = defaultButtonText;
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Cancel any previous in-flight request
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();
    const { signal } = abortController;

    form.setAttribute('aria-busy', 'true');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    errorMessage.textContent = '';
    sentMessage.textContent = '';

    try {
      const formData = new FormData(form);
      // The markup's redirect is the no-JS thank-you page; a fetch answers with JSON instead.
      const payload = { ...Object.fromEntries(formData.entries()), redirect: 'false' };

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      });
      const data = await response.json();

      if (data.success) {
        form.reset();
        sentMessage.textContent = SENT_TEXT;
      } else {
        errorMessage.textContent = data.message || FAILED_TEXT;
      }
    } catch (error) {
      // hidden.bs.dialog already handles cleanup when the request is aborted
      if (error.name === 'AbortError') return;
      errorMessage.textContent = FAILED_TEXT;
    } finally {
      // Skip the reset when aborted: hidden.bs.dialog has already reset the form, or a newer
      // request has set the busy state and owns it now.
      if (!signal.aborted) {
        abortController = null;
        form.removeAttribute('aria-busy');
        submitBtn.disabled = false;
        submitBtn.textContent = defaultButtonText;
      }
    }
  });
}

/**
 * Main initialization - wires up all functionality
 */
function init() {
  // Hero entrance and typing first, while the style.css gate still hides the hero (AD-5)
  introHero(document.querySelector('.hero-container'));

  // Smooth scroll for nav links
  setupNavClickHandlers(document, smoothScrollTo, closeMobileNav);

  // Smooth scroll on page load with hash (by id, so a malformed hash cannot throw)
  const hashTarget = resolveHashTarget(window.location.hash, document);
  if (hashTarget) {
    setTimeout(() => smoothScrollTo(hashTarget), 100);
  }

  // Mobile nav toggle
  document.querySelectorAll('.mobile-nav-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileNav();
    });
  });

  // Close mobile nav on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.mobile-nav-toggle') && !e.target.closest('.nav-menu')) {
      closeMobileNav();
    }
  });

  // Scroll handlers: cached element references, at most one update per frame
  setupScrollHandlers(document, window);

  // Back to top click
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Portfolio grid
  initPortfolioGrid(document.querySelector('.portfolio-container'));

  // GLightbox
  initLightbox();

  // Testimonials carousel
  initTestimonialsCarousel(
    document.querySelector('.testimonials-carousel'),
    document.querySelector('.testimonials-autoplay-toggle')
  );

  // Contact dialog and form
  initDialogFocus(document.querySelector('#contactModal'));
  initContactForm();

  // Scroll reveals last, after every other initializer
  revealOnScroll(document.querySelectorAll(REVEAL_TARGET_SELECTOR));
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
