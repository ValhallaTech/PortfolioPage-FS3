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

/** Offset from the viewport top at which a section counts as the one in view. */
const ACTIVE_SECTION_OFFSET = 200;

/** Below this offset scroll position the first nav item is the active one. */
const TOP_OF_PAGE_LIMIT = 300;

/** Scroll distance in pixels past which the back-to-top button is shown. */
const BACK_TO_TOP_THRESHOLD = 100;

/**
 * Mark one nav link as the current location and clear every other one.
 * The highlight class sits on the link's parent `<li>`; `aria-current="location"`
 * sits on the link itself so assistive technology announces it.
 * @param {NodeListOf<Element>|Element[]} navLinks - Every `.nav-menu a` element
 * @param {Element|null} activeLink - The link to mark, or null to clear all
 */
export function markCurrentNavLink(navLinks, activeLink) {
  navLinks.forEach((link) => {
    const isActive = link === activeLink;
    if (link.parentElement) {
      link.parentElement.classList.toggle('active', isActive);
    }
    if (isActive) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/**
 * Update the active nav link for a scroll position.
 * A section is in view when `scrollY + 200` falls inside it; near the top of the
 * page (`scrollY + 200 < 300`) the first nav item is active. When no rule applies
 * the current highlight is left as it is. Reads only the references it is given,
 * so it runs no DOM queries.
 * @param {NodeListOf<HTMLElement>|HTMLElement[]} sections - The page's `section` elements
 * @param {NodeListOf<Element>|Element[]} navLinks - Every `.nav-menu a` element
 * @param {number} scrollY - The window's vertical scroll offset
 */
export function updateActiveNav(sections, navLinks, scrollY) {
  if (!sections || !navLinks) return;
  const scrollPos = scrollY + ACTIVE_SECTION_OFFSET;
  let matched = false;
  let activeLink = null;

  sections.forEach((section) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    if (scrollPos >= top && scrollPos <= bottom) {
      const href = `#${section.getAttribute('id')}`;
      matched = true;
      activeLink = Array.from(navLinks).find((link) => link.getAttribute('href') === href) || null;
    }
  });

  if (scrollPos < TOP_OF_PAGE_LIMIT && navLinks.length > 0) {
    matched = true;
    activeLink = navLinks[0];
  }

  if (matched) {
    markCurrentNavLink(navLinks, activeLink);
  }
}

/**
 * Show the back-to-top button past the 100 px threshold by toggling `is-visible`.
 * The display rule lives in style.css; no inline styles are written.
 * @param {Element|null} backToTop - The `.back-to-top` element
 * @param {number} scrollY - The window's vertical scroll offset
 */
export function handleBackToTop(backToTop, scrollY) {
  if (!backToTop) return;
  backToTop.classList.toggle('is-visible', scrollY > BACK_TO_TOP_THRESHOLD);
}

/**
 * Wire the scroll-driven UI: the active nav link and back-to-top visibility.
 * Sections, nav links and the back-to-top button are queried once here and cached.
 * A passive scroll listener coalesces events through requestAnimationFrame, so any
 * number of scroll events in one frame cost a single update. One update is also
 * scheduled at once, so a page loaded mid-scroll starts in the right state.
 * @param {Document} doc - The document to query
 * @param {Window} win - The window whose scroll events drive the updates
 * @returns {Function} Teardown that removes the listener and cancels a pending frame
 */
export function setupScrollHandlers(doc, win) {
  const sections = doc.querySelectorAll('section');
  const navLinks = doc.querySelectorAll('.nav-menu a');
  const backToTop = doc.querySelector('.back-to-top');
  let frameId = null;

  const update = () => {
    frameId = null;
    const { scrollY } = win;
    updateActiveNav(sections, navLinks, scrollY);
    handleBackToTop(backToTop, scrollY);
  };

  const onScroll = () => {
    if (frameId === null) {
      frameId = win.requestAnimationFrame(update);
    }
  };

  win.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return () => {
    win.removeEventListener('scroll', onScroll);
    if (frameId !== null) {
      win.cancelAnimationFrame(frameId);
      frameId = null;
    }
  };
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
        markCurrentNavLink(doc.querySelectorAll('.nav-menu a'), link);
      }

      closeNavFn();
    }
  });
}

/**
 * Set up portfolio filter click handlers
 * @param {NodeListOf<Element>|Element[]} filters - The filter list items
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
