/**
 * @jest-environment node
 */
/**
 * S5 release tests for AC-82, AC-85, AC-86 and AC-113 (spec stabilize-and-cleanup,
 * sections 2.3, 3.4 WI-56 and 3.7 chain N): the security headers the live site sends.
 *
 * Each runs on one `curl -sI`-equivalent request: a `fetch` HEAD of the live `/` that
 * does not follow redirects. The request is made once and shared. Header names are
 * case-insensitive through `Headers.get`. Every failure is an `expect` whose received
 * value names the URL, the status and the header.
 */
const LIVE_URL = 'https://fs3portfolio.netlify.app/';

/** Upper bound for the HEAD request. */
const FETCH_TIMEOUT_MS = 30_000;

/** AC-113: the protective COOP values. */
const COOP_VALUES = Object.freeze([
  'same-origin',
  'same-origin-allow-popups',
  'noopener-allow-popups',
]);

/** The shared HEAD response, made on first use. */
let headPromise = null;

/**
 * Sends `HEAD /` to the live site once.
 *
 * @returns {Promise<{ status: number | null, headers: Headers | null, problem: string | null }>}
 *   The status and headers, or the problem.
 */
function headLive() {
  headPromise ??= (async () => {
    try {
      const response = await fetch(LIVE_URL, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      return { status: response.status, headers: response.headers, problem: null };
    } catch (error) {
      return {
        status: null,
        headers: null,
        problem: `HEAD ${LIVE_URL}: fetch failed (${error.message})`,
      };
    }
  })();
  return headPromise;
}

/**
 * Describes one header of the live response for a failure message.
 *
 * @param {number} status The HTTP status.
 * @param {string} name The header name.
 * @param {string | null} value Its value, or null when it is absent.
 * @returns {string} `HEAD <url> (<status>): <name> = <value>`.
 */
function describeHeader(status, name, value) {
  return `HEAD ${LIVE_URL} (${status}): ${name} = ${value === null ? '(absent)' : JSON.stringify(value)}`;
}

describe('Live security headers (S5, chain N)', () => {
  it('AC-82: the live site sends a non-empty content-security-policy-report-only and no content-security-policy', async () => {
    // Arrange
    const { status, headers, problem } = await headLive();
    expect(problem).toBeNull();

    // Act
    const reportOnly = headers.get('content-security-policy-report-only');
    const enforcing = headers.get('content-security-policy');
    const violations = [];
    if (reportOnly === null || reportOnly.trim() === '') {
      violations.push(describeHeader(status, 'content-security-policy-report-only', reportOnly));
    }
    if (enforcing !== null) {
      violations.push(describeHeader(status, 'content-security-policy', enforcing));
    }

    // Assert
    expect(violations).toEqual([]);
  });

  it('AC-85: the live site sends no x-xss-protection header', async () => {
    // Arrange
    const { status, headers, problem } = await headLive();
    expect(problem).toBeNull();

    // Act
    const value = headers.get('x-xss-protection');

    // Assert
    expect(value === null ? null : describeHeader(status, 'x-xss-protection', value)).toBeNull();
  });

  it('AC-86: the live site sends a non-empty permissions-policy header', async () => {
    // Arrange
    const { status, headers, problem } = await headLive();
    expect(problem).toBeNull();

    // Act
    const value = headers.get('permissions-policy');
    const present = value !== null && value.trim() !== '';

    // Assert
    expect(present ? null : describeHeader(status, 'permissions-policy', value)).toBeNull();
  });

  it(`AC-113: the live cross-origin-opener-policy is one of ${COOP_VALUES.join(', ')}`, async () => {
    // Arrange
    const { status, headers, problem } = await headLive();
    expect(problem).toBeNull();

    // Act
    const value = headers.get('cross-origin-opener-policy');
    const protective = value !== null && COOP_VALUES.includes(value.trim());

    // Assert
    expect(
      protective ? null : describeHeader(status, 'cross-origin-opener-policy', value)
    ).toBeNull();
  });
});
