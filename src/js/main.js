import Typed from 'typed.js';
import ScrollReveal from 'scrollreveal';
import Muuri from 'muuri';
import Swiper from 'swiper';
import { A11y, Autoplay, Pagination } from 'swiper/modules';
import GLightbox from 'glightbox';
import { Modal } from 'bootstrap';

import 'bootstrap/dist/css/bootstrap.min.css';
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

/**
 * Stops the typing cursor once the last phrase is typed (C-31): it stays visible but no
 * longer blinks.
 * @param {Typed} typed
 */
function stopTypedCursor(typed) {
  if (!typed.cursor) return;
  typed.cursor.classList.remove('typed-cursor--blink');
  typed.cursor.classList.add('typed-cursor--done');
}

/**
 * Initialize Typed.js: each phrase is typed once, in order, and the effect stops on the
 * last one. The cursor CSS lives in style.css, so Typed.js inserts no <style> (D-6).
 * @param {Element} el - The typed element
 * @returns {Typed|null}
 */
function initTyped(el) {
  if (!el) return null;
  const items = el.getAttribute('data-typed-items');
  if (!items) return null;
  const strings = items.split(',').map((s) => s.trim());
  return new Typed(el, {
    strings,
    loop: false,
    autoInsertCss: false,
    typeSpeed: 100,
    backSpeed: 50,
    backDelay: 2000,
    onComplete: stopTypedCursor,
  });
}

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

/**
 * Initialize ScrollReveal
 */
function initScrollReveal() {
  const sr = ScrollReveal({
    distance: '60px',
    duration: 1000,
    easing: 'ease-in-out',
    once: true,
  });

  sr.reveal('.hero-container', { origin: 'top', delay: 200 });
  sr.reveal('[data-sr="fade-right"]', { origin: 'right' });
  sr.reveal('[data-sr="fade-left"]', { origin: 'left' });
  sr.reveal('[data-sr="fade-up"]', { origin: 'bottom' });
  sr.reveal('[data-sr="fade-in"]', { origin: 'bottom', distance: '0px' });

  sr.reveal('[data-sr-delay="100"]', { delay: 100 });
  sr.reveal('[data-sr-delay="200"]', { delay: 200 });
  sr.reveal('[data-sr-delay="300"]', { delay: 300 });
  sr.reveal('[data-sr-delay="400"]', { delay: 400 });
  sr.reveal('[data-sr-delay="500"]', { delay: 500 });
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

  const defaultButtonText = submitBtn.textContent;
  let abortController = null;
  let autoCloseTimer = null;

  // Abort in-flight request and reset form state whenever the modal is fully hidden
  if (modalEl) {
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
      form.reset();
      form.removeAttribute('aria-busy');
      errorMessage.style.display = 'none';
      sentMessage.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.textContent = defaultButtonText;
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Cancel any previous in-flight request and pending auto-close timer
    if (abortController) {
      abortController.abort();
    }
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;

    abortController = new AbortController();
    const { signal } = abortController;

    form.setAttribute('aria-busy', 'true');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    errorMessage.style.display = 'none';
    sentMessage.style.display = 'none';

    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

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
        sentMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        form.reset();
        // Close the modal after a short delay so the user sees the success message
        if (modalEl) {
          autoCloseTimer = setTimeout(() => {
            autoCloseTimer = null;
            Modal.getOrCreateInstance(modalEl).hide();
          }, 2000);
        }
      } else {
        errorMessage.textContent = data.message || 'Failed to send message. Please try again.';
        errorMessage.style.display = 'block';
        sentMessage.style.display = 'none';
      }
    } catch (error) {
      // hidden.bs.modal already handles cleanup when the request is aborted
      if (error.name === 'AbortError') return;
      errorMessage.textContent = 'Failed to send message. Please try again.';
      errorMessage.style.display = 'block';
      sentMessage.style.display = 'none';
    } finally {
      // Skip the reset when aborted: hidden.bs.modal has already reset the form, or a newer
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
  // Hero typed
  const typedEl = document.querySelector('.typed');
  initTyped(typedEl);

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

  // Init ScrollReveal
  initScrollReveal();

  // Contact form
  initContactForm();
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
