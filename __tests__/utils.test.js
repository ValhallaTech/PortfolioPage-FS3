/**
 * @jest-environment jsdom
 */
import {
  smoothScrollTo,
  toggleMobileNav,
  closeMobileNav,
  updateActiveNav,
  handleBackToTop,
  setupNavClickHandlers,
  setupPortfolioFilters,
  resolveHashTarget,
  resolveLightboxHref,
} from '../src/js/utils.js';

describe('smoothScrollTo', () => {
  beforeEach(() => {
    window.scrollTo = jest.fn();
  });

  test('scrolls to target element offsetTop', () => {
    const target = { offsetTop: 500 };
    smoothScrollTo(target);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 500,
      behavior: 'smooth',
    });
  });

  test('does nothing when target is null', () => {
    smoothScrollTo(null);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  test('does nothing when target is undefined', () => {
    smoothScrollTo(undefined);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  test('scrolls to 0 when element is at top', () => {
    const target = { offsetTop: 0 };
    smoothScrollTo(target);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });
});

describe('toggleMobileNav', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button class="mobile-nav-toggle">
        <i class="fa-solid fa-bars"></i>
      </button>
    `;
    document.body.className = '';
  });

  test('adds mobile-nav-active class on first toggle', () => {
    toggleMobileNav();
    expect(document.body.classList.contains('mobile-nav-active')).toBe(true);
  });

  test('removes mobile-nav-active class on second toggle', () => {
    toggleMobileNav();
    toggleMobileNav();
    expect(document.body.classList.contains('mobile-nav-active')).toBe(false);
  });

  test('toggles icon classes', () => {
    const icon = document.querySelector('.mobile-nav-toggle i');
    toggleMobileNav();
    expect(icon.classList.contains('fa-xmark')).toBe(true);
    expect(icon.classList.contains('fa-bars')).toBe(false);
  });

  test('restores icon classes on second toggle', () => {
    const icon = document.querySelector('.mobile-nav-toggle i');
    toggleMobileNav();
    toggleMobileNav();
    expect(icon.classList.contains('fa-bars')).toBe(true);
    expect(icon.classList.contains('fa-xmark')).toBe(false);
  });

  test('handles missing icon element gracefully', () => {
    document.body.innerHTML = '';
    expect(() => toggleMobileNav()).not.toThrow();
  });
});

describe('closeMobileNav', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button class="mobile-nav-toggle">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
  });

  test('removes mobile-nav-active when active', () => {
    document.body.classList.add('mobile-nav-active');
    closeMobileNav();
    expect(document.body.classList.contains('mobile-nav-active')).toBe(false);
  });

  test('restores navigation icon when closing', () => {
    document.body.classList.add('mobile-nav-active');
    closeMobileNav();
    const icon = document.querySelector('.mobile-nav-toggle i');
    expect(icon.classList.contains('fa-bars')).toBe(true);
    expect(icon.classList.contains('fa-xmark')).toBe(false);
  });

  test('does nothing when nav is not active', () => {
    document.body.classList.remove('mobile-nav-active');
    closeMobileNav();
    expect(document.body.classList.contains('mobile-nav-active')).toBe(false);
  });

  test('handles missing icon gracefully when active', () => {
    document.body.innerHTML = '';
    document.body.classList.add('mobile-nav-active');
    expect(() => closeMobileNav()).not.toThrow();
    expect(document.body.classList.contains('mobile-nav-active')).toBe(false);
  });
});

describe('updateActiveNav', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav class="nav-menu">
        <ul>
          <li class="active"><a href="#hero">Home</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#portfolio">Portfolio</a></li>
        </ul>
      </nav>
      <section id="hero" style="height: 500px;"></section>
      <section id="about" style="height: 500px;"></section>
      <section id="portfolio" style="height: 500px;"></section>
    `;
  });

  test('activates first item when scroll is near top', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    updateActiveNav();
    const firstItem = document.querySelector('.nav-menu ul li:first-child');
    expect(firstItem.classList.contains('active')).toBe(true);
  });

  test('handles empty sections gracefully', () => {
    document.body.innerHTML = '<nav class="nav-menu"><ul></ul></nav>';
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    expect(() => updateActiveNav()).not.toThrow();
  });

  test('handles missing nav menu gracefully', () => {
    document.body.innerHTML = '<section id="hero"></section>';
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    expect(() => updateActiveNav()).not.toThrow();
  });
});

describe('handleBackToTop', () => {
  beforeEach(() => {
    document.body.innerHTML = '<a class="back-to-top" href="#"></a>';
  });

  test('shows button when scrolled past 100px', () => {
    Object.defineProperty(window, 'scrollY', { value: 200, writable: true });
    handleBackToTop();
    const btn = document.querySelector('.back-to-top');
    expect(btn.style.display).toBe('flex');
  });

  test('hides button when near top', () => {
    Object.defineProperty(window, 'scrollY', { value: 50, writable: true });
    handleBackToTop();
    const btn = document.querySelector('.back-to-top');
    expect(btn.style.display).toBe('none');
  });

  test('hides button when at exactly 0', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    handleBackToTop();
    const btn = document.querySelector('.back-to-top');
    expect(btn.style.display).toBe('none');
  });

  test('does nothing when button is missing', () => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'scrollY', { value: 200, writable: true });
    expect(() => handleBackToTop()).not.toThrow();
  });

  test('shows with correct flex alignment', () => {
    Object.defineProperty(window, 'scrollY', { value: 200, writable: true });
    handleBackToTop();
    const btn = document.querySelector('.back-to-top');
    expect(btn.style.alignItems).toBe('center');
    expect(btn.style.justifyContent).toBe('center');
  });
});

describe('setupNavClickHandlers', () => {
  beforeEach(() => {
    window.scrollTo = jest.fn();
    document.body.innerHTML = `
      <nav class="nav-menu">
        <ul>
          <li class="active"><a href="#hero">Home</a></li>
          <li><a href="#about">About</a></li>
        </ul>
      </nav>
      <section id="hero"></section>
      <section id="about"></section>
    `;
  });

  test('calls scroll function on nav link click', () => {
    const scrollFn = jest.fn();
    const closeFn = jest.fn();
    setupNavClickHandlers(document, scrollFn, closeFn);

    const aboutLink = document.querySelector('a[href="#about"]');
    aboutLink.click();

    expect(scrollFn).toHaveBeenCalled();
    expect(closeFn).toHaveBeenCalled();
  });

  test('updates active class on nav link click', () => {
    const scrollFn = jest.fn();
    const closeFn = jest.fn();
    setupNavClickHandlers(document, scrollFn, closeFn);

    const aboutLink = document.querySelector('a[href="#about"]');
    aboutLink.click();

    const aboutLi = aboutLink.closest('li');
    expect(aboutLi.classList.contains('active')).toBe(true);
  });

  test('does nothing for non-hash links', () => {
    const scrollFn = jest.fn();
    const closeFn = jest.fn();

    document.body.innerHTML = `
      <nav class="nav-menu">
        <ul><li><a href="https://example.com">External</a></li></ul>
      </nav>
    `;
    setupNavClickHandlers(document, scrollFn, closeFn);

    const link = document.querySelector('a');
    link.click();

    expect(scrollFn).not.toHaveBeenCalled();
  });

  test('does nothing when clicking non-nav elements', () => {
    const scrollFn = jest.fn();
    const closeFn = jest.fn();
    setupNavClickHandlers(document, scrollFn, closeFn);

    document.body.click();
    expect(scrollFn).not.toHaveBeenCalled();
  });

  describe('with hashes that are not valid CSS selectors or URIs', () => {
    // A detached document keeps these tests free of the listeners the tests above
    // leave on the global document. The click listener is invoked directly because
    // jsdom reports an exception thrown inside a listener instead of rethrowing it
    // from dispatchEvent, so a dispatched click could not prove "does not throw".
    let doc;
    let scrollFn;
    let closeFn;
    let listenerCalls;
    let clickHandler;

    const findLink = (href) =>
      Array.from(doc.querySelectorAll('.nav-menu a')).find((a) => a.getAttribute('href') === href);

    const clickLink = (href) => {
      const event = { target: findLink(href), preventDefault: jest.fn() };
      clickHandler(event);
      return event;
    };

    beforeEach(() => {
      doc = document.implementation.createHTMLDocument('nav');
      doc.body.innerHTML = `
        <nav class="nav-menu">
          <ul>
            <li class="active"><a href="#">Top</a></li>
            <li><a href="#%E0%A4%A">Broken</a></li>
            <li><a href="#1x">Numeric</a></li>
          </ul>
        </nav>
        <section id="1x"></section>
      `;
      scrollFn = jest.fn();
      closeFn = jest.fn();
      const addEventListener = jest.spyOn(doc, 'addEventListener');
      setupNavClickHandlers(doc, scrollFn, closeFn);
      listenerCalls = [...addEventListener.mock.calls];
      addEventListener.mockRestore();
      [[, clickHandler]] = listenerCalls;
    });

    test('registers a single click listener on the document', () => {
      expect(listenerCalls).toEqual([['click', expect.any(Function)]]);
    });

    test('ignores a bare "#" link without scrolling or preventing default', () => {
      const event = clickLink('#');

      expect(scrollFn).not.toHaveBeenCalled();
      expect(closeFn).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('ignores a malformed percent-escape without throwing, scrolling or preventing default', () => {
      let event;

      expect(() => {
        event = clickLink('#%E0%A4%A');
      }).not.toThrow();
      expect(scrollFn).not.toHaveBeenCalled();
      expect(closeFn).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('scrolls to an id that starts with a digit', () => {
      const event = clickLink('#1x');

      expect(scrollFn).toHaveBeenCalledWith(doc.getElementById('1x'));
      expect(closeFn).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    test('marks the clicked nav item active for an id that starts with a digit', () => {
      const link = findLink('#1x');

      clickLink('#1x');

      expect(link.closest('li').classList.contains('active')).toBe(true);
      expect(doc.querySelectorAll('.nav-menu .active')).toHaveLength(1);
    });
  });
});

describe('resolveHashTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="1x"></section>
      <section id="a b"></section>
      <section id="café"></section>
      <section id="about"></section>
    `;
  });

  describe('resolves the decoded fragment by id', () => {
    test.each([
      ['#about', 'about'],
      ['#1x', '1x'],
      ['#a%20b', 'a b'],
      ['#caf%C3%A9', 'café'],
    ])('resolves %s to the element with id "%s"', (hash, id) => {
      const result = resolveHashTarget(hash, document);

      expect(result).toBe(document.getElementById(id));
    });
  });

  describe('returns null', () => {
    test('when the document is missing', () => {
      expect(resolveHashTarget('#about', null)).toBeNull();
    });

    test.each([
      ['an empty string', ''],
      ['a string without a leading "#"', 'about'],
      ['null', null],
      ['a non-string value', 42],
    ])('when the hash is %s', (_label, hash) => {
      expect(resolveHashTarget(hash, document)).toBeNull();
    });

    test('when the percent-escape is malformed, without throwing', () => {
      let result;

      expect(() => {
        result = resolveHashTarget('#%E0%A4%A', document);
      }).not.toThrow();
      expect(result).toBeNull();
    });

    test('when the id is empty', () => {
      const getElementById = jest.spyOn(document, 'getElementById');

      const result = resolveHashTarget('#', document);

      expect(result).toBeNull();
      expect(getElementById).not.toHaveBeenCalled();
      getElementById.mockRestore();
    });

    test('when no element has the id', () => {
      expect(resolveHashTarget('#missing', document)).toBeNull();
    });
  });
});

describe('resolveLightboxHref', () => {
  // jsdom's global document is served from http://localhost/.
  const renderPortfolioItem = (imgMarkup, doc = document) => {
    doc.body.innerHTML = `
      <div class="portfolio-wrap">
        ${imgMarkup}
        <div class="portfolio-links">
          <a class="glightbox" data-src="./images/portfolio/portfolio-1.jpg" href="#"></a>
        </div>
      </div>
    `;
    return doc.querySelector('a.glightbox');
  };

  test('returns the absolute same-origin URL of the bundled image', () => {
    const link = renderPortfolioItem('<img src="portfolio-1.afcd9577.jpg">');

    const result = resolveLightboxHref(link, document);

    expect(result).toBe('http://localhost/portfolio-1.afcd9577.jpg');
  });

  test('uses the first img that has a src attribute', () => {
    const link = renderPortfolioItem(
      '<img alt="placeholder"><img src="portfolio-2.1a2b3c4d.jpg"><img src="other.jpg">'
    );

    const result = resolveLightboxHref(link, document);

    expect(result).toBe('http://localhost/portfolio-2.1a2b3c4d.jpg');
  });

  test('accepts an absolute URL on the page origin', () => {
    const link = renderPortfolioItem('<img src="http://localhost/images/portfolio-3.jpg">');

    const result = resolveLightboxHref(link, document);

    expect(result).toBe('http://localhost/images/portfolio-3.jpg');
  });

  describe('returns null', () => {
    test('when the link is missing', () => {
      expect(resolveLightboxHref(null, document)).toBeNull();
    });

    test('when the document is missing', () => {
      const link = renderPortfolioItem('<img src="portfolio-1.afcd9577.jpg">');

      expect(resolveLightboxHref(link, null)).toBeNull();
    });

    test('when the link has no .portfolio-wrap ancestor', () => {
      document.body.innerHTML = `
        <img src="portfolio-1.afcd9577.jpg">
        <a class="glightbox" href="#"></a>
      `;
      const link = document.querySelector('a.glightbox');

      expect(resolveLightboxHref(link, document)).toBeNull();
    });

    test('when the wrap has no img with a src', () => {
      const link = renderPortfolioItem('<img alt="no source">');

      expect(resolveLightboxHref(link, document)).toBeNull();
    });

    test('when the img src is empty', () => {
      const link = renderPortfolioItem('<img src="">');

      expect(resolveLightboxHref(link, document)).toBeNull();
    });

    test.each([
      ['a javascript: URL', 'javascript:alert(1)'],
      ['a data: URL', 'data:image/png;base64,iVBORw0KGgo='],
      ['another origin', 'https://evil.example/x.jpg'],
      ['a protocol-relative URL to another origin', '//evil.example/x.jpg'],
      ['the same host on another scheme', 'https://localhost/portfolio-1.jpg'],
    ])('when the img src is %s', (_label, src) => {
      const link = renderPortfolioItem(`<img src="${src}">`);

      expect(resolveLightboxHref(link, document)).toBeNull();
    });

    test('when the document base URL cannot resolve the src, without throwing', () => {
      const detached = document.implementation.createHTMLDocument('lightbox');
      const link = renderPortfolioItem('<img src="portfolio-1.afcd9577.jpg">', detached);
      let result;

      expect(detached.baseURI).toBe('about:blank');
      expect(() => {
        result = resolveLightboxHref(link, detached);
      }).not.toThrow();
      expect(result).toBeNull();
    });
  });
});

describe('setupPortfolioFilters', () => {
  test('calls arrange callback with filter value on click', () => {
    document.body.innerHTML = `
      <ul id="portfolio-flters">
        <li class="filter-active" data-filter="*">All</li>
        <li data-filter=".filter-app">App</li>
        <li data-filter=".filter-web">Web</li>
      </ul>
    `;
    const filters = document.querySelectorAll('#portfolio-flters li');
    const arrangeFn = jest.fn();
    setupPortfolioFilters(filters, arrangeFn);

    filters[1].click();

    expect(arrangeFn).toHaveBeenCalledWith('.filter-app');
    expect(filters[0].classList.contains('filter-active')).toBe(false);
    expect(filters[1].classList.contains('filter-active')).toBe(true);
  });

  test('does nothing with empty filters', () => {
    const arrangeFn = jest.fn();
    expect(() => setupPortfolioFilters([], arrangeFn)).not.toThrow();
    expect(arrangeFn).not.toHaveBeenCalled();
  });

  test('does nothing with null filters', () => {
    expect(() => setupPortfolioFilters(null, jest.fn())).not.toThrow();
  });

  test('handles missing arrange callback', () => {
    document.body.innerHTML = `
      <ul id="portfolio-flters">
        <li data-filter="*">All</li>
      </ul>
    `;
    const filters = document.querySelectorAll('#portfolio-flters li');
    expect(() => setupPortfolioFilters(filters, null)).not.toThrow();
    expect(() => filters[0].click()).not.toThrow();
  });

  test('switches active filter correctly between items', () => {
    document.body.innerHTML = `
      <ul id="portfolio-flters">
        <li class="filter-active" data-filter="*">All</li>
        <li data-filter=".filter-app">App</li>
        <li data-filter=".filter-web">Web</li>
      </ul>
    `;
    const filters = document.querySelectorAll('#portfolio-flters li');
    setupPortfolioFilters(filters, jest.fn());

    filters[1].click();
    expect(filters[1].classList.contains('filter-active')).toBe(true);

    filters[2].click();
    expect(filters[1].classList.contains('filter-active')).toBe(false);
    expect(filters[2].classList.contains('filter-active')).toBe(true);
  });
});
