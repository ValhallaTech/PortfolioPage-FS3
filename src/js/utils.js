/**
 * Pure DOM utility functions for the portfolio page.
 * No external library dependencies - easily testable.
 */

/**
 * Smooth scroll to an element
 * @param {HTMLElement} target - The element to scroll to
 */
function smoothScrollTo(target) {
  if (!target) return;
  window.scrollTo({
    top: target.offsetTop,
    behavior: 'smooth',
  });
}

/**
 * Toggle mobile nav active state
 */
function toggleMobileNav() {
  document.body.classList.toggle('mobile-nav-active');
  const icon = document.querySelector('.mobile-nav-toggle i');
  if (icon) {
    icon.classList.toggle('icofont-navigation-menu');
    icon.classList.toggle('icofont-close');
  }
}

/**
 * Close mobile nav
 */
function closeMobileNav() {
  if (document.body.classList.contains('mobile-nav-active')) {
    document.body.classList.remove('mobile-nav-active');
    const icon = document.querySelector('.mobile-nav-toggle i');
    if (icon) {
      icon.classList.remove('icofont-close');
      icon.classList.add('icofont-navigation-menu');
    }
  }
}

/**
 * Update active nav link based on scroll position
 */
function updateActiveNav() {
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-menu a');
  const scrollPos = window.scrollY + 200;

  sections.forEach((section) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const id = section.getAttribute('id');

    if (scrollPos >= top && scrollPos <= bottom) {
      navLinks.forEach((link) => {
        link.parentElement.classList.remove('active');
      });
      const activeLink = document.querySelector(`.nav-menu a[href="#${id}"]`);
      if (activeLink) {
        activeLink.parentElement.classList.add('active');
      }
    }
  });

  if (scrollPos < 300) {
    const firstItem = document.querySelector('.nav-menu ul li:first-child');
    if (firstItem) {
      firstItem.classList.add('active');
    }
  }
}

/**
 * Handle back-to-top button visibility
 */
function handleBackToTop() {
  const backToTop = document.querySelector('.back-to-top');
  if (!backToTop) return;
  if (window.scrollY > 100) {
    backToTop.style.display = 'flex';
    backToTop.style.alignItems = 'center';
    backToTop.style.justifyContent = 'center';
  } else {
    backToTop.style.display = 'none';
  }
}

/**
 * Animate skill progress bars using Intersection Observer
 * @param {Element} skillsSection - The skills section element
 * @returns {IntersectionObserver|null}
 */
function observeSkills(skillsSection) {
  if (!skillsSection) return null;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const bars = entry.target.querySelectorAll('.progress .progress-bar');
          bars.forEach((bar) => {
            bar.style.width = bar.getAttribute('aria-valuenow') + '%';
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 },
  );
  observer.observe(skillsSection);
  return observer;
}

/**
 * Set up navigation click handlers for smooth scrolling
 * @param {Document} doc - The document object
 * @param {Function} scrollFn - The scroll function to use
 * @param {Function} closeNavFn - The close mobile nav function
 */
function setupNavClickHandlers(doc, scrollFn, closeNavFn) {
  doc.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-menu a, .scrollto');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!hash || !hash.startsWith('#')) return;
    const target = doc.querySelector(hash);
    if (target) {
      e.preventDefault();
      scrollFn(target);

      if (link.closest('.nav-menu')) {
        doc.querySelectorAll('.nav-menu .active').forEach((el) => el.classList.remove('active'));
        const li = link.closest('li');
        if (li) li.classList.add('active');
      }

      closeNavFn();
    }
  });
}

/**
 * Set up portfolio filter click handlers
 * @param {NodeList} filters - The filter list items
 * @param {Function} arrangeCallback - Callback to trigger isotope arrange
 */
function setupPortfolioFilters(filters, arrangeCallback) {
  if (!filters || filters.length === 0) return;
  filters.forEach((filter) => {
    filter.addEventListener('click', function () {
      filters.forEach((f) => f.classList.remove('filter-active'));
      this.classList.add('filter-active');
      if (arrangeCallback) {
        arrangeCallback(this.getAttribute('data-filter'));
      }
    });
  });
}

module.exports = {
  smoothScrollTo,
  toggleMobileNav,
  closeMobileNav,
  updateActiveNav,
  handleBackToTop,
  observeSkills,
  setupNavClickHandlers,
  setupPortfolioFilters,
};
