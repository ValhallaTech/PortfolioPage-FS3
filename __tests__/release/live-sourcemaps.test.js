/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-80 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-56 and
 * 3.7 chain N): the live site serves source maps only as the D-5 decision says.
 *
 * The decision is read from the one AC-79 line in section 3 of the spec: "does not
 * serve" expects 404 for every map, "serves" expects 200. The test GETs the live `/`,
 * takes every `<script src>` (quoted or unquoted, as Parcel's minified HTML writes it),
 * resolves it against the page URL, and requests `<absolute src>.map` without following
 * redirects, as `curl -s -o /dev/null -w '%{http_code}'` does. Every failure is an
 * `expect` whose received value names the URL and the status.
 */
const fs = require('node:fs');
const path = require('node:path');

const LIVE_URL = 'https://fs3portfolio.netlify.app/';

const SPEC = path.resolve(__dirname, '..', '..', 'specs', 'stabilize-and-cleanup.md');

/** Repo-relative name used in failure messages. */
const SPEC_NAME = 'specs/stabilize-and-cleanup.md';

/** Upper bound for each request. */
const FETCH_TIMEOUT_MS = 30_000;

/** The heading that opens section 3, and any level-2 heading, which closes it. */
const SECTION_3_HEADING = /^## 3\./;
const LEVEL_2_HEADING = /^## /;

/** AC-79's D-5 decision line; group 1 is the outcome. */
const D5_DECISION = /^\*\*D-5 decision:\*\* production (does not serve|serves) source maps\.$/;

/** The map status each D-5 outcome requires. */
const EXPECTED_STATUS = Object.freeze({ 'does not serve': 404, serves: 200 });

/** A `<script>` start tag. */
const SCRIPT_TAG = /<script\b[^>]*>/gi;

/** A `src` attribute, double-quoted, single-quoted or unquoted. */
const SRC_ATTRIBUTE = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

/**
 * Reads the D-5 outcome from section 3 of the spec.
 *
 * @returns {{ outcome: string | null, problem: string | null }} The outcome, or the problem.
 */
function readD5Outcome() {
  let text;
  try {
    text = fs.readFileSync(SPEC, 'utf8');
  } catch (error) {
    return { outcome: null, problem: `${SPEC_NAME}: cannot be read (${error.message})` };
  }
  const all = text.split(/\r?\n/);
  const start = all.findIndex((line) => SECTION_3_HEADING.test(line));
  const next = all.findIndex((line, index) => index > start && LEVEL_2_HEADING.test(line));
  const section = start === -1 ? [] : all.slice(start + 1, next === -1 ? all.length : next);
  const outcomes = section.flatMap((line) => {
    const match = D5_DECISION.exec(line);
    return match ? [match[1]] : [];
  });
  return outcomes.length === 1
    ? { outcome: outcomes[0], problem: null }
    : {
        outcome: null,
        problem: `${SPEC_NAME}: section 3 has ${outcomes.length} D-5 decision lines, expected 1`,
      };
}

/**
 * GETs the live `/` and lists the absolute URL of every `<script src>`.
 *
 * @returns {Promise<{ sources: string[] | null, problem: string | null }>} The URLs, or the problem.
 */
async function liveScriptSources() {
  try {
    const response = await fetch(LIVE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      return { sources: null, problem: `GET ${LIVE_URL}: HTTP ${response.status}` };
    }
    const html = await response.text();
    const sources = (html.match(SCRIPT_TAG) ?? []).flatMap((tag) => {
      const match = SRC_ATTRIBUTE.exec(tag);
      const src = match ? (match[1] ?? match[2] ?? match[3]) : '';
      return src.trim() === '' ? [] : [new URL(src.trim(), response.url).href];
    });
    return sources.length === 0
      ? { sources: null, problem: `GET ${LIVE_URL}: the HTML has no <script src>` }
      : { sources, problem: null };
  } catch (error) {
    return { sources: null, problem: `GET ${LIVE_URL}: fetch failed (${error.message})` };
  }
}

/**
 * Requests a URL without following redirects and returns its status.
 *
 * @param {string} url The absolute URL.
 * @returns {Promise<string>} `<url>: <status>`, or `<url>: fetch failed (...)`.
 */
async function statusOf(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return `${url}: ${response.status}`;
  } catch (error) {
    return `${url}: fetch failed (${error.message})`;
  }
}

describe('Live source maps (S5, chain N)', () => {
  it('AC-80: every live <script src>.map returns the status the D-5 decision requires', async () => {
    // Arrange
    const decision = readD5Outcome();
    expect(decision.problem).toBeNull();
    const expected = EXPECTED_STATUS[decision.outcome];
    const live = await liveScriptSources();
    expect(live.problem).toBeNull();

    // Act
    const statuses = await Promise.all(live.sources.map((source) => statusOf(`${source}.map`)));

    // Assert
    expect(statuses).toEqual(live.sources.map((source) => `${source}.map: ${expected}`));
  });
});
