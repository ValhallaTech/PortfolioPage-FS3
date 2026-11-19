/**
 * @jest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import {
  smoothScrollTo,
  toggleMobileNav,
  closeMobileNav,
  markCurrentNavLink,
  updateActiveNav,
  handleBackToTop,
  setupScrollHandlers,
  setupNavClickHandlers,
  setupPortfolioFilters,
  portfolioFilterSelector,
  portfolioFilterOptions,
  resolveHashTarget,
  resolveLightboxHref,
} from '../src/js/utils.js';

const STYLE_CSS = path.resolve(__dirname, '..', 'src', 'css', 'style.css');

/**
 * The nav and section fixture shared by the scroll-driven tests.
 * Every section is 500 px tall: hero 0-500, about 500-1000, portfolio 1000-1500.
 */
const NAV_FIXTURE = `
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

/**
 * jsdom does no layout, so offsetTop and offsetHeight are always 0.
 * Give each section the box the fixture describes.
 * @param {Document} doc - The document holding the sections
 */
const layOutSections = (doc) => {
  doc.querySelectorAll('section').forEach((section, index) => {
    Object.defineProperty(section, 'offsetTop', { configurable: true, value: index * 500 });
    Object.defineProperty(section, 'offsetHeight', { configurable: true, value: 500 });
  });
};

/** @returns {Element[]} The nav items that carry the active class */
const activeItems = () => Array.from(document.querySelectorAll('.nav-menu li.active'));

/** @returns {string[]} The href of every nav link that carries aria-current */
const currentLinkHrefs = () =>
  Array.from(document.querySelectorAll('.nav-menu a[aria-current]')).map((link) =>
    link.getAttribute('href')
  );

/**
 * Parse style.css and collect the declarations of every rule whose selector list
 * contains the given selector, in source order.
 * @param {string} selector - The exact selector to look for
 * @returns {Record<string, string>} Property to value; later rules win
 */
const declarationsFor = (selector) => {
  const declarations = {};
  const root = postcss.parse(fs.readFileSync(STYLE_CSS, 'utf8'), { from: STYLE_CSS });
  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls((decl) => {
      declarations[decl.prop] = decl.value;
    });
  });
  return declarations;
};

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

describe('markCurrentNavLink', () => {
  let navLinks;

  beforeEach(() => {
    document.body.innerHTML = NAV_FIXTURE;
    navLinks = document.querySelectorAll('.nav-menu a');
  });

  test('marks the given link with the active item and aria-current="location"', () => {
    const [, about] = navLinks;

    markCurrentNavLink(navLinks, about);

    expect(activeItems()).toEqual([about.parentElement]);
    expect(about.getAttribute('aria-current')).toBe('location');
  });

  test('clears the active item and aria-current from every other link', () => {
    const [home, about, portfolio] = navLinks;
    home.setAttribute('aria-current', 'location');
    portfolio.setAttribute('aria-current', 'location');

    markCurrentNavLink(navLinks, about);

    expect(currentLinkHrefs()).toEqual(['#about']);
    expect(home.parentElement.classList.contains('active')).toBe(false);
  });

  test('clears every link when the active link is null', () => {
    const [home] = navLinks;
    home.setAttribute('aria-current', 'location');

    markCurrentNavLink(navLinks, null);

    expect(activeItems()).toEqual([]);
    expect(currentLinkHrefs()).toEqual([]);
  });

  test('sets aria-current on a link that has no parent element, without throwing', () => {
    const detached = document.createElement('a');

    expect(() => markCurrentNavLink([detached], detached)).not.toThrow();
    expect(detached.getAttribute('aria-current')).toBe('location');
  });
});

describe('updateActiveNav', () => {
  let sections;
  let navLinks;

  beforeEach(() => {
    document.body.innerHTML = NAV_FIXTURE;
    layOutSections(document);
    sections = document.querySelectorAll('section');
    navLinks = document.querySelectorAll('.nav-menu a');
  });

  test('activates first item when scroll is near top', () => {
    const firstItem = document.querySelector('.nav-menu ul li:first-child');
    firstItem.classList.remove('active');

    updateActiveNav(sections, navLinks, 0);

    expect(activeItems()).toEqual([firstItem]);
    expect(currentLinkHrefs()).toEqual(['#hero']);
  });

  test('handles empty sections gracefully', () => {
    document.body.innerHTML = '<nav class="nav-menu"><ul></ul></nav>';
    const emptySections = document.querySelectorAll('section');
    const emptyLinks = document.querySelectorAll('.nav-menu a');

    expect(() => updateActiveNav(emptySections, emptyLinks, 0)).not.toThrow();
    expect(currentLinkHrefs()).toEqual([]);
  });

  test('handles missing nav menu gracefully', () => {
    document.body.innerHTML = '<section id="hero"></section>';
    const heroOnly = document.querySelectorAll('section');
    const noLinks = document.querySelectorAll('.nav-menu a');

    expect(() => updateActiveNav(heroOnly, noLinks, 0)).not.toThrow();
    expect(() => updateActiveNav(heroOnly, null, 0)).not.toThrow();
    expect(() => updateActiveNav(null, navLinks, 0)).not.toThrow();
  });

  test('activates the link of the section that holds scrollY + 200', () => {
    const [, about] = navLinks;

    updateActiveNav(sections, navLinks, 400);

    expect(activeItems()).toEqual([about.parentElement]);
    expect(currentLinkHrefs()).toEqual(['#about']);
  });

  test('counts a section boundary as inside the section', () => {
    // scrollY + 200 = 1500 is the bottom of portfolio; about ends at 1000.
    updateActiveNav(sections, navLinks, 1300);

    expect(currentLinkHrefs()).toEqual(['#portfolio']);
  });

  test('leaves the highlight as it is when no section holds the scroll position', () => {
    const [, about] = navLinks;
    markCurrentNavLink(navLinks, about);

    updateActiveNav(sections, navLinks, 5000);

    expect(activeItems()).toEqual([about.parentElement]);
    expect(currentLinkHrefs()).toEqual(['#about']);
  });

  test('leaves the highlight as it is when null references are passed', () => {
    const [, about] = navLinks;
    markCurrentNavLink(navLinks, about);

    updateActiveNav(null, null, 0);

    expect(currentLinkHrefs()).toEqual(['#about']);
  });

  test('clears every link when the section in view has no nav link', () => {
    document.body.insertAdjacentHTML('beforeend', '<section id="contact"></section>');
    layOutSections(document);
    const withContact = document.querySelectorAll('section');

    updateActiveNav(withContact, navLinks, 1600);

    expect(activeItems()).toEqual([]);
    expect(currentLinkHrefs()).toEqual([]);
  });

  test('runs no DOM queries of its own', () => {
    const docQueryAll = jest.spyOn(document, 'querySelectorAll');
    const docQuery = jest.spyOn(document, 'querySelector');

    updateActiveNav(sections, navLinks, 400);

    expect(docQueryAll).not.toHaveBeenCalled();
    expect(docQuery).not.toHaveBeenCalled();
    docQueryAll.mockRestore();
    docQuery.mockRestore();
  });
});

describe('handleBackToTop', () => {
  let btn;

  beforeEach(() => {
    document.body.innerHTML = '<a class="back-to-top" href="#"></a>';
    btn = document.querySelector('.back-to-top');
  });

  test('shows button when scrolled past 100px', () => {
    handleBackToTop(btn, 200);

    expect(btn.classList.contains('is-visible')).toBe(true);
    expect(btn.hasAttribute('style')).toBe(false);
  });

  test('hides button when near top', () => {
    btn.classList.add('is-visible');

    handleBackToTop(btn, 50);

    expect(btn.classList.contains('is-visible')).toBe(false);
    expect(btn.hasAttribute('style')).toBe(false);
  });

  test('hides button when at exactly 0', () => {
    btn.classList.add('is-visible');

    handleBackToTop(btn, 0);

    expect(btn.classList.contains('is-visible')).toBe(false);
    expect(btn.hasAttribute('style')).toBe(false);
  });

  test('does nothing when button is missing', () => {
    document.body.innerHTML = '';

    expect(() => handleBackToTop(null, 200)).not.toThrow();
  });

  test('shows with correct flex alignment', () => {
    handleBackToTop(btn, 200);

    expect(btn.classList.contains('is-visible')).toBe(true);
    expect(btn.hasAttribute('style')).toBe(false);
    expect(declarationsFor('.back-to-top.is-visible')).toEqual(
      expect.objectContaining({
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
      })
    );
  });

  test('keeps the button hidden at exactly 100px', () => {
    btn.classList.add('is-visible');

    handleBackToTop(btn, 100);

    expect(btn.classList.contains('is-visible')).toBe(false);
  });

  test('shows the button at 101px', () => {
    handleBackToTop(btn, 101);

    expect(btn.classList.contains('is-visible')).toBe(true);
  });

  test('hides the button by default in style.css', () => {
    expect(declarationsFor('.back-to-top')).toEqual(expect.objectContaining({ display: 'none' }));
  });
});

describe('setupScrollHandlers', () => {
  /**
   * A window stand-in with a real EventTarget and a mocked requestAnimationFrame
   * whose frames run only when the test flushes them.
   * @param {number} scrollY - The initial scroll offset
   */
  const createWindow = (scrollY) => {
    const win = new EventTarget();
    const frames = new Map();
    let nextFrameId = 1;
    win.scrollY = scrollY;
    win.requestAnimationFrame = jest.fn((callback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      frames.set(id, callback);
      return id;
    });
    win.cancelAnimationFrame = jest.fn((id) => {
      frames.delete(id);
    });
    const runFrames = () => {
      const pending = Array.from(frames.values());
      frames.clear();
      pending.forEach((callback) => callback(0));
    };
    const scroll = (times = 1) => {
      for (let i = 0; i < times; i += 1) {
        win.dispatchEvent(new Event('scroll'));
      }
    };
    return { win, runFrames, scroll, pendingFrames: () => frames.size };
  };

  let teardown;
  let btn;

  beforeEach(() => {
    document.body.innerHTML = `${NAV_FIXTURE}<a class="back-to-top" href="#"></a>`;
    layOutSections(document);
    btn = document.querySelector('.back-to-top');
    teardown = undefined;
  });

  afterEach(() => {
    if (teardown) teardown();
  });

  test('registers a passive scroll listener', () => {
    const { win } = createWindow(0);
    const addEventListener = jest.spyOn(win, 'addEventListener');

    teardown = setupScrollHandlers(document, win);

    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), {
      passive: true,
    });
  });

  test('schedules one initial update that sets the state for the current scroll position', () => {
    const { win, runFrames } = createWindow(400);

    teardown = setupScrollHandlers(document, win);

    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(currentLinkHrefs()).toEqual([]);
    runFrames();
    expect(currentLinkHrefs()).toEqual(['#about']);
    expect(btn.classList.contains('is-visible')).toBe(true);
  });

  test('marks the Home link current at load when the page is at the top', () => {
    const { win, runFrames } = createWindow(0);

    teardown = setupScrollHandlers(document, win);
    runFrames();

    expect(currentLinkHrefs()).toEqual(['#hero']);
    expect(btn.classList.contains('is-visible')).toBe(false);
  });

  test('coalesces many scroll events in one frame into a single update', () => {
    const { win, runFrames, scroll, pendingFrames } = createWindow(0);
    teardown = setupScrollHandlers(document, win);
    runFrames();
    win.requestAnimationFrame.mockClear();

    win.scrollY = 1300;
    scroll(50);

    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(pendingFrames()).toBe(1);
    expect(currentLinkHrefs()).toEqual(['#hero']);
    runFrames();
    expect(currentLinkHrefs()).toEqual(['#portfolio']);
    expect(btn.classList.contains('is-visible')).toBe(true);
  });

  test('applies the scroll position read when the frame runs, not when the event fired', () => {
    const { win, runFrames, scroll } = createWindow(0);
    teardown = setupScrollHandlers(document, win);
    runFrames();

    win.scrollY = 400;
    scroll();
    win.scrollY = 0;
    runFrames();

    expect(currentLinkHrefs()).toEqual(['#hero']);
    expect(btn.classList.contains('is-visible')).toBe(false);
  });

  test('schedules a new frame for a scroll after the previous frame ran', () => {
    const { win, runFrames, scroll } = createWindow(0);
    teardown = setupScrollHandlers(document, win);
    runFrames();

    scroll();
    runFrames();
    scroll();

    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(3);
  });

  test('queries the document once at setup and never per frame', () => {
    const { win, runFrames, scroll } = createWindow(0);
    const docQueryAll = jest.spyOn(document, 'querySelectorAll');
    const docQuery = jest.spyOn(document, 'querySelector');
    teardown = setupScrollHandlers(document, win);
    const setupQueries = docQueryAll.mock.calls.length + docQuery.mock.calls.length;

    runFrames();
    for (let i = 0; i < 5; i += 1) {
      win.scrollY = i * 300;
      scroll(10);
      runFrames();
    }

    expect(setupQueries).toBe(3);
    expect(docQueryAll.mock.calls.length + docQuery.mock.calls.length).toBe(setupQueries);
    docQueryAll.mockRestore();
    docQuery.mockRestore();
  });

  test('teardown removes the scroll listener', () => {
    const { win, runFrames, scroll } = createWindow(0);
    const stop = setupScrollHandlers(document, win);
    runFrames();
    win.requestAnimationFrame.mockClear();

    stop();
    scroll(5);

    expect(win.requestAnimationFrame).not.toHaveBeenCalled();
  });

  test('teardown cancels a pending frame', () => {
    const { win, pendingFrames } = createWindow(400);
    const stop = setupScrollHandlers(document, win);
    const frameId = win.requestAnimationFrame.mock.results[0].value;

    stop();

    expect(win.cancelAnimationFrame).toHaveBeenCalledWith(frameId);
    expect(pendingFrames()).toBe(0);
    expect(currentLinkHrefs()).toEqual([]);
  });

  test('teardown cancels nothing when no frame is pending', () => {
    const { win, runFrames } = createWindow(0);
    const stop = setupScrollHandlers(document, win);
    runFrames();

    stop();

    expect(win.cancelAnimationFrame).not.toHaveBeenCalled();
  });

  test('works when the page has no back-to-top button', () => {
    document.querySelector('.back-to-top').remove();
    const { win, runFrames } = createWindow(400);
    teardown = setupScrollHandlers(document, win);

    expect(() => runFrames()).not.toThrow();
    expect(currentLinkHrefs()).toEqual(['#about']);
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

  test('moves aria-current="location" to the clicked nav link', () => {
    const homeLink = document.querySelector('a[href="#hero"]');
    homeLink.setAttribute('aria-current', 'location');
    setupNavClickHandlers(document, jest.fn(), jest.fn());

    const aboutLink = document.querySelector('a[href="#about"]');
    aboutLink.click();

    expect(aboutLink.getAttribute('aria-current')).toBe('location');
    expect(homeLink.hasAttribute('aria-current')).toBe(false);
    expect(document.querySelectorAll('.nav-menu .active')).toHaveLength(1);
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

/**
 * The portfolio filter buttons, as `index.html` renders them: one button per
 * filter value, `all` pressed by default.
 */
const FILTER_FIXTURE = `
  <ul id="portfolio-filters">
    <li><button type="button" data-filter="all" aria-pressed="true">All</button></li>
    <li><button type="button" data-filter="app" aria-pressed="false">App</button></li>
    <li><button type="button" data-filter="card" aria-pressed="false">Card</button></li>
    <li><button type="button" data-filter="web" aria-pressed="false">Web</button></li>
  </ul>
`;

/**
 * Render the filter fixture and return its buttons.
 * @returns {NodeListOf<HTMLButtonElement>} The four filter buttons, in document order
 */
function renderFilterButtons() {
  document.body.innerHTML = FILTER_FIXTURE;
  return document.querySelectorAll('#portfolio-filters button');
}

/**
 * The `aria-pressed` value of every button, in document order.
 * @param {NodeListOf<HTMLButtonElement>} buttons - The filter buttons
 * @returns {(string|null)[]} Each button's `aria-pressed` attribute
 */
function pressedStates(buttons) {
  return Array.from(buttons, (button) => button.getAttribute('aria-pressed'));
}

describe('setupPortfolioFilters', () => {
  test('calls onFilter with the clicked button data-filter value', () => {
    const buttons = renderFilterButtons();
    const onFilter = jest.fn();
    setupPortfolioFilters(buttons, onFilter);

    buttons[1].click();

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith('app');
  });

  test('does nothing with an empty button list', () => {
    const onFilter = jest.fn();

    expect(() => setupPortfolioFilters([], onFilter)).not.toThrow();
    expect(onFilter).not.toHaveBeenCalled();
  });

  test('does nothing with null buttons', () => {
    expect(() => setupPortfolioFilters(null, jest.fn())).not.toThrow();
  });

  test('still updates aria-pressed when onFilter is missing', () => {
    const buttons = renderFilterButtons();
    setupPortfolioFilters(buttons, null);

    expect(() => buttons[2].click()).not.toThrow();
    expect(pressedStates(buttons)).toEqual(['false', 'false', 'true', 'false']);
  });

  test('keeps exactly one button aria-pressed="true" as the pressed filter moves', () => {
    const buttons = renderFilterButtons();
    const onFilter = jest.fn();
    setupPortfolioFilters(buttons, onFilter);

    buttons[1].click();
    expect(pressedStates(buttons)).toEqual(['false', 'true', 'false', 'false']);

    buttons[3].click();
    expect(pressedStates(buttons)).toEqual(['false', 'false', 'false', 'true']);

    buttons[0].click();
    expect(pressedStates(buttons)).toEqual(['true', 'false', 'false', 'false']);
    expect(onFilter.mock.calls).toEqual([['app'], ['web'], ['all']]);
  });

  test('keeps the clicked button pressed when it is clicked again', () => {
    const buttons = renderFilterButtons();
    const onFilter = jest.fn();
    setupPortfolioFilters(buttons, onFilter);

    buttons[2].click();
    buttons[2].click();

    expect(pressedStates(buttons)).toEqual(['false', 'false', 'true', 'false']);
    expect(onFilter.mock.calls).toEqual([['card'], ['card']]);
  });
});

describe('portfolioFilterSelector', () => {
  test('returns every portfolio item for the all filter', () => {
    expect(portfolioFilterSelector('all')).toBe('.portfolio-item');
  });

  test.each(['app', 'card', 'web'])(
    'returns the data-category selector for the %s filter',
    (category) => {
      expect(portfolioFilterSelector(category)).toBe(`[data-category="${category}"]`);
    }
  );

  test('selects exactly the items of the filtered category', () => {
    document.body.innerHTML = `
      <div class="portfolio-container">
        <div class="portfolio-item" data-category="app" data-portfolio-id="1"></div>
        <div class="portfolio-item" data-category="web" data-portfolio-id="2"></div>
        <div class="portfolio-item" data-category="card" data-portfolio-id="3"></div>
        <div class="portfolio-item" data-category="app" data-portfolio-id="4"></div>
      </div>
    `;
    const idsFor = (filter) =>
      Array.from(
        document.querySelectorAll(portfolioFilterSelector(filter)),
        (item) => item.dataset.portfolioId
      );

    expect(idsFor('all')).toEqual(['1', '2', '3', '4']);
    expect(idsFor('app')).toEqual(['1', '4']);
    expect(idsFor('card')).toEqual(['3']);
    expect(idsFor('web')).toEqual(['2']);
  });
});

describe('portfolioFilterOptions', () => {
  test('returns instant show, hide and layout under reduced motion', () => {
    expect(portfolioFilterOptions(true)).toEqual({ instant: true, layout: 'instant' });
  });

  test('returns animated show, hide and layout without reduced motion', () => {
    expect(portfolioFilterOptions(false)).toEqual({ instant: false, layout: true });
  });
});
