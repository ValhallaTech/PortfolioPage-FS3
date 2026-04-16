/**
 * Template Name: iPortfolio - v2.0.0
 * Overhauled: jQuery removed, using vanilla JS with modern libraries
 */

import Typed from 'typed.js';
import ScrollReveal from 'scrollreveal';
import Isotope from 'isotope-layout';
import Swiper from 'swiper';
import { Autoplay, Pagination } from 'swiper/modules';
import GLightbox from 'glightbox';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'swiper/swiper.css';
import 'swiper/modules/pagination.css';
import 'glightbox/dist/css/glightbox.min.css';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@fortawesome/fontawesome-free/css/brands.min.css';
import '../css/style.css';

const {
  smoothScrollTo,
  toggleMobileNav,
  closeMobileNav,
  updateActiveNav,
  handleBackToTop,
  observeSkills,
  setupNavClickHandlers,
  setupPortfolioFilters,
} = require('./utils');

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

/**
 * Initialize portfolio Isotope filter
 * @param {Element} container - The portfolio container element
 * @returns {Isotope|null}
 */
function initPortfolioFilter(container) {
  if (!container) return null;

  const iso = new Isotope(container, {
    itemSelector: '.portfolio-item',
    layoutMode: 'fitRows',
  });

  const filters = document.querySelectorAll('#portfolio-flters li');
  setupPortfolioFilters(filters, (filterValue) => {
    iso.arrange({ filter: filterValue });
  });

  return iso;
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
 * Initialize GLightbox for portfolio items
 * @returns {GLightbox|null}
 */
function initLightbox() {
  return GLightbox({ selector: '.glightbox' });
}

/**
 * Initialize ScrollReveal (replaces AOS)
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

  if (!form || !submitBtn || !errorMessage || !sentMessage) return;

  const defaultButtonText = submitBtn.textContent;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

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
      });
      const data = await response.json();

      if (data.success === true) {
        sentMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        form.reset();
      } else {
        errorMessage.textContent = data.message || 'Failed to send message. Please try again.';
        errorMessage.style.display = 'block';
        sentMessage.style.display = 'none';
      }
    } catch (error) {
      errorMessage.textContent = 'Failed to send message. Please try again.';
      errorMessage.style.display = 'block';
      sentMessage.style.display = 'none';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = defaultButtonText;
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

  // Smooth scroll on page load with hash
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => smoothScrollTo(target), 100);
    }
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

  // Scroll handlers
  window.addEventListener('scroll', () => {
    updateActiveNav();
    handleBackToTop();
  });

  // Back to top click
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    backToTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Skills section - Intersection Observer (replaces waypoints)
  const skillsSection = document.querySelector('.skills-content');
  observeSkills(skillsSection);

  // Portfolio isotope
  const portfolioContainer = document.querySelector('.portfolio-container');
  initPortfolioFilter(portfolioContainer);

  // GLightbox (replaces venobox)
  initLightbox();

  // Testimonials carousel (Swiper replaces owl.carousel)
  initTestimonialsCarousel(document.querySelector('.testimonials-carousel'));

  // Init ScrollReveal (replaces AOS)
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
