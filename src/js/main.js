import Typed from 'typed.js';
import ScrollReveal from 'scrollreveal';
import Muuri from 'muuri';
import Swiper from 'swiper';
import { Autoplay, Pagination } from 'swiper/modules';
import GLightbox from 'glightbox';
import { Modal } from 'bootstrap';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'swiper/swiper.css';
import 'swiper/modules/pagination.css';
import 'glightbox/dist/css/glightbox.min.css';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@fortawesome/fontawesome-free/css/brands.min.css';
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
 * Initialize Typed.js
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
    loop: true,
    typeSpeed: 100,
    backSpeed: 50,
    backDelay: 2000,
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

/**
 * Initialize testimonials Swiper carousel
 * @param {Element} container - The swiper container element
 * @returns {Swiper|null}
 */
function initTestimonialsCarousel(container) {
  if (!container) return null;
  return new Swiper(container, {
    modules: [Autoplay, Pagination],
    autoplay: { delay: 5000, disableOnInteraction: false },
    loop: true,
    pagination: { el: '.testimonials .swiper-pagination', clickable: true },
    breakpoints: {
      0: { slidesPerView: 1, spaceBetween: 20 },
      768: { slidesPerView: 2, spaceBetween: 20 },
      900: { slidesPerView: 3, spaceBetween: 20 },
    },
  });
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
  return GLightbox({ selector: '.glightbox' });
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
      // Skip button reset when aborted; hidden.bs.modal has already reset it
      if (!signal.aborted) {
        abortController = null;
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
  initTestimonialsCarousel(document.querySelector('.testimonials-carousel'));

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
