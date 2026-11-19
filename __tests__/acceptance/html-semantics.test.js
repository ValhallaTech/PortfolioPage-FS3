/**
 * @jest-environment jsdom
 */
/**
 * S1 acceptance tests for chain M (spec stabilize-and-cleanup, sections 2.3,
 * 3.4 WI-47 and 3.7): AC-47, AC-48, AC-55, AC-62, AC-63, AC-64 and AC-65 on
 * `src/index.html`, parsed statically with jsdom's `DOMParser`.
 *
 * AC-65 is a guard: today's About and header alts already differ after
 * normalization, so it passes before any work, by design (Fred's decision).
 */
const fs = require('node:fs');
const path = require('node:path');

const INDEX_HTML = path.resolve(__dirname, '..', '..', 'src', 'index.html');

/** AC-55: the old generic portfolio alt. */
const GENERIC_PORTFOLIO_ALT = /^portfolio item \d+$/i;

/** AC-65: punctuation stripped before comparing alts. */
const PUNCTUATION = /\p{P}/gu;

/**
 * Parses `src/index.html`.
 *
 * @returns {Document} The parsed document.
 */
function parseIndex() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Returns the `alt` of each element.
 *
 * @param {Iterable<Element>} images The images.
 * @returns {(string | null)[]} Each `alt`, or null when it is absent.
 */
function altsOf(images) {
  return Array.from(images, (image) => image.getAttribute('alt'));
}

/**
 * Returns an element's accessible name from `aria-label` or `aria-labelledby`.
 *
 * @param {Element} element The element.
 * @param {Document} document Its document.
 * @returns {string} The trimmed name, or an empty string when it has none.
 */
function ariaName(element, document) {
  const label = (element.getAttribute('aria-label') ?? '').trim();
  if (label !== '') {
    return label;
  }
  return (element.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim();
}

/**
 * Lowercases an alt and strips its punctuation.
 *
 * @param {string} alt The alt text.
 * @returns {string} The normalized text.
 */
function normalizeAlt(alt) {
  return alt.toLowerCase().replace(PUNCTUATION, '');
}

test('AC-47: there is exactly one h1', () => {
  // Arrange
  const document = parseIndex();

  // Act
  const headings = document.querySelectorAll('h1');

  // Assert
  expect(headings).toHaveLength(1);
});

test('AC-48: heading levels do not skip outside the dialog', () => {
  // Arrange
  const document = parseIndex();

  // Act
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
    (heading) => heading.closest('#contactModal') === null
  );
  const levels = headings.map((heading) => Number(heading.tagName.slice(1)));
  const violations = [];
  if (levels[0] !== 1) {
    violations.push(`first heading is h${levels[0]}`);
  }
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] > levels[i - 1] + 1) {
      violations.push(
        `h${levels[i - 1]} -> h${levels[i]}: "${headings[i].textContent.trim().replace(/\s+/g, ' ')}"`
      );
    }
  }

  // Assert
  expect(violations).toEqual([]);
});

test('AC-55: portfolio alt texts are distinct and not generic', () => {
  // Arrange
  const document = parseIndex();

  // Act
  const alts = altsOf(document.querySelectorAll('.portfolio-item img'));
  const values = alts.map((alt) => (alt ?? '').trim());
  const summary = {
    count: alts.length,
    empty: values.filter((alt) => alt === ''),
    duplicates: values.filter((alt, index) => alt !== '' && values.indexOf(alt) !== index),
    generic: values.filter((alt) => GENERIC_PORTFOLIO_ALT.test(alt)),
  };

  // Assert
  expect(summary).toEqual({ count: 9, empty: [], duplicates: [], generic: [] });
});

test('AC-62: #hero is inside main', () => {
  // Arrange
  const document = parseIndex();

  // Act
  const hero = document.querySelector('main #hero');

  // Assert
  expect(hero).not.toBeNull();
});

test('AC-63: the primary nav has an accessible name', () => {
  // Arrange
  const document = parseIndex();

  // Act
  const nav = Array.from(document.querySelectorAll('nav')).find((candidate) =>
    Array.from(candidate.querySelectorAll('a[href^="#"]')).some((link) => {
      const id = link.getAttribute('href').slice(1);
      return id !== '' && document.querySelector(`section[id="${id}"]`) !== null;
    })
  );

  // Assert
  expect(nav).toBeDefined();
  expect(ariaName(nav, document)).not.toBe('');
});

test('AC-64: testimonial photos have empty alt text', () => {
  // Arrange
  const document = parseIndex();

  // Act
  const alts = altsOf(document.querySelectorAll('#testimonials img'));

  // Assert
  expect(alts).toEqual(['', '', '']);
});

test('AC-65 (guard): the About photo does not repeat the header photo alt', () => {
  // Arrange
  const document = parseIndex();
  const aboutAlt = document.querySelector('#about img')?.getAttribute('alt') ?? null;
  const headerAlt = document.querySelector('#header .profile img')?.getAttribute('alt') ?? null;

  // Act
  const nearDuplicate =
    aboutAlt === null ||
    headerAlt === null ||
    (aboutAlt !== '' && normalizeAlt(aboutAlt) === normalizeAlt(headerAlt));

  // Assert
  expect({ aboutAlt, headerAlt, nearDuplicate }).toEqual({
    aboutAlt,
    headerAlt,
    nearDuplicate: false,
  });
});
