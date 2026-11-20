/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for AC-81 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-56
 * and 3.7 chain N): the header set that `netlify.toml` declares for `/*`.
 *
 * Offline: it parses `netlify.toml` with `smol-toml` and reads the one `[[headers]]`
 * entry with `for = "/*"`. Names are compared lowercased, as AC-81 says. Every failure
 * is an `expect` whose received value names the file, the entry and the headers.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parse: parseToml } = require('smol-toml');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The file AC-81 reads, relative to the repo root. */
const NETLIFY_TOML = 'netlify.toml';

/** The path pattern of the entry under test. */
const ALL_PATHS = '/*';

/** AC-81: headers the entry must send, each with a non-empty value. */
const REQUIRED = Object.freeze([
  'content-security-policy-report-only',
  'permissions-policy',
  'cross-origin-opener-policy',
]);

/** AC-81: headers the entry must not send. */
const FORBIDDEN = Object.freeze(['content-security-policy', 'x-xss-protection']);

/** AC-81: the protective COOP values. */
const COOP_VALUES = Object.freeze([
  'same-origin',
  'same-origin-allow-popups',
  'noopener-allow-popups',
]);

/**
 * Reads the `[headers.values]` of the single `[[headers]]` entry for `/*`.
 *
 * @returns {{ values: Map<string, unknown> | null, problem: string | null }}
 *   The values keyed by lowercased header name, or the problem.
 */
function readAllPathsHeaders() {
  let config;
  try {
    config = parseToml(fs.readFileSync(path.join(REPO_ROOT, NETLIFY_TOML), 'utf8'));
  } catch (error) {
    return {
      values: null,
      problem: `${NETLIFY_TOML}: cannot be read or parsed (${error.message})`,
    };
  }
  const entries = Array.isArray(config.headers) ? config.headers : [];
  const matching = entries.filter((entry) => entry && entry.for === ALL_PATHS);
  if (matching.length !== 1) {
    return {
      values: null,
      problem: `${NETLIFY_TOML}: ${matching.length} [[headers]] entries have for = "${ALL_PATHS}", expected 1`,
    };
  }
  const raw = matching[0].values;
  if (!raw || typeof raw !== 'object') {
    return {
      values: null,
      problem: `${NETLIFY_TOML}: the "${ALL_PATHS}" entry has no [headers.values]`,
    };
  }
  const values = new Map(Object.entries(raw).map(([name, value]) => [name.toLowerCase(), value]));
  return { values, problem: null };
}

/**
 * Tells whether a header value is a non-empty string.
 *
 * @param {unknown} value The TOML value.
 * @returns {boolean} True when it is a string with non-blank text.
 */
function isNonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

describe('netlify.toml security headers (S1, chain N)', () => {
  it(`AC-81: the [[headers]] entry for "${ALL_PATHS}" sends report-only CSP, Permissions-Policy and a protective COOP, and no enforcing CSP or X-XSS-Protection`, () => {
    // Arrange
    const { values, problem } = readAllPathsHeaders();
    expect(problem).toBeNull();

    // Act
    const violations = [];
    for (const name of REQUIRED) {
      if (!values.has(name)) {
        violations.push(`${name}: missing`);
      } else if (!isNonEmpty(values.get(name))) {
        violations.push(`${name}: value ${JSON.stringify(values.get(name))} is empty`);
      }
    }
    for (const name of FORBIDDEN) {
      if (values.has(name)) {
        violations.push(`${name}: present, must be absent`);
      }
    }
    const coop = values.get('cross-origin-opener-policy');
    if (isNonEmpty(coop) && !COOP_VALUES.includes(coop.trim())) {
      violations.push(
        `cross-origin-opener-policy: "${coop}" is not one of ${COOP_VALUES.join(', ')}`
      );
    }

    // Assert
    expect(violations).toEqual([]);
  });
});
