/**
 * Pure DOM utility functions for the portfolio page.
 * No external library dependencies - easily testable.
 */

/**
 * Smooth scroll to an element
 * @param {HTMLElement} target - The element to scroll to
 */
export function smoothScrollTo(target) {
  if (!target) return;
  window.scrollTo({
    top: target.offsetTop,
    behavior: 'smooth',
  });
}

/**
 * Toggle mobile nav active state
 */
export function toggleMobileNav() {
  document.body.classList.toggle('mobile-nav-active');
  const icon = document.querySelector('.mobile-nav-toggle i');
  if (icon) {
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-xmark');
  }
}

/**
 * Close mobile nav
 */
export function closeMobileNav() {
  if (document.body.classList.contains('mobile-nav-active')) {
    document.body.classList.remove('mobile-nav-active');
    const icon = document.querySelector('.mobile-nav-toggle i');
    if (icon) {
      icon.classList.remove('fa-xmark');
      icon.classList.add('fa-bars');
    }
  }
}

/**
 * Update active nav link based on scroll position
 */
export function updateActiveNav() {
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
export function handleBackToTop() {
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
 * Set up navigation click handlers for smooth scrolling
 * @param {Document} doc - The document object
 * @param {Function} scrollFn - The scroll function to use
 * @param {Function} closeNavFn - The close mobile nav function
 */
export function setupNavClickHandlers(doc, scrollFn, closeNavFn) {
  doc.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-menu a, .scrollto');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!hash || !hash.startsWith('#')) return;
    const target = resolveHashTarget(hash, doc);
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
export function setupPortfolioFilters(filters, arrangeCallback) {
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

/**
 * Resolve the element a URL fragment points at, by id.
 * Never throws: a hash that is not a valid CSS selector (e.g. `#1x`), a malformed
 * percent-escape (e.g. `#%E0%A4%A`) or an empty id yields null instead.
 * @param {string} hash - A URL fragment including the leading '#', as in `location.hash`
 * @param {Document} doc - The document to search
 * @returns {HTMLElement|null} The element whose id matches the decoded fragment, or null
 */
export function resolveHashTarget(hash, doc) {
  if (!doc || typeof hash !== 'string' || !hash.startsWith('#')) return null;
  let id;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    // URIError from a malformed percent-escape: treat as "no target".
    return null;
  }
  if (!id) return null;
  return doc.getElementById(id);
}

/**
 * Resolve the URL a portfolio lightbox link should open: the bundled URL of the
 * `<img src>` in the same `.portfolio-wrap`. Parcel content-hashes and relocates that
 * image, so its src is the only path known to exist in the build output.
 * Only same-origin http(s) URLs are accepted, so a `javascript:`, `data:` or
 * cross-origin value never reaches the link's href.
 * @param {Element} link - The lightbox anchor element
 * @param {Document} doc - The document the link belongs to (supplies baseURI and URL)
 * @returns {string|null} The absolute image URL, or null when no acceptable URL exists
 */
export function resolveLightboxHref(link, doc) {
  if (!link || !doc) return null;
  const wrap = link.closest('.portfolio-wrap');
  if (!wrap) return null;
  const img = wrap.querySelector('img[src]');
  const raw = img ? img.getAttribute('src') : '';
  if (!raw) return null;

  let url;
  let pageOrigin;
  try {
    url = new URL(raw, doc.baseURI);
    pageOrigin = new URL(doc.URL).origin;
  } catch {
    // TypeError from an unparseable URL or base: no acceptable URL.
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== pageOrigin) return null;
  return url.href;
}
