/**
 * @jest-environment jsdom
 */
const {
  smoothScrollTo,
  toggleMobileNav,
  closeMobileNav,
  updateActiveNav,
  handleBackToTop,
  observeSkills,
  setupNavClickHandlers,
  setupPortfolioFilters,
} = require('../src/js/utils');

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

describe('observeSkills', () => {
  let mockObserve;
  let mockUnobserve;
  let mockDisconnect;
  let observerCallback;

  beforeEach(() => {
    mockObserve = jest.fn();
    mockUnobserve = jest.fn();
    mockDisconnect = jest.fn();

    global.IntersectionObserver = jest.fn((callback) => {
      observerCallback = callback;
      return {
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
      };
    });
  });

  test('returns null when no section provided', () => {
    const result = observeSkills(null);
    expect(result).toBeNull();
  });

  test('creates observer and observes the section', () => {
    const section = document.createElement('div');
    observeSkills(section);
    expect(mockObserve).toHaveBeenCalledWith(section);
  });

  test('sets progress bar widths when intersecting', () => {
    document.body.innerHTML = `
      <div class="skills-content">
        <div class="progress">
          <div class="progress-bar" aria-valuenow="75" style="width: 0%;"></div>
        </div>
        <div class="progress">
          <div class="progress-bar" aria-valuenow="90" style="width: 0%;"></div>
        </div>
      </div>
    `;
    const section = document.querySelector('.skills-content');
    observeSkills(section);

    observerCallback([{ isIntersecting: true, target: section }]);

    const bars = section.querySelectorAll('.progress-bar');
    expect(bars[0].style.width).toBe('75%');
    expect(bars[1].style.width).toBe('90%');
    expect(mockUnobserve).toHaveBeenCalledWith(section);
  });

  test('does not set widths when not intersecting', () => {
    document.body.innerHTML = `
      <div class="skills-content">
        <div class="progress">
          <div class="progress-bar" aria-valuenow="75" style="width: 0%;"></div>
        </div>
      </div>
    `;
    const section = document.querySelector('.skills-content');
    observeSkills(section);

    observerCallback([{ isIntersecting: false, target: section }]);

    const bar = section.querySelector('.progress-bar');
    expect(bar.style.width).toBe('0%');
    expect(mockUnobserve).not.toHaveBeenCalled();
  });

  test('returns the observer instance', () => {
    const section = document.createElement('div');
    const result = observeSkills(section);
    expect(result).toBeDefined();
    expect(result.observe).toBeDefined();
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
