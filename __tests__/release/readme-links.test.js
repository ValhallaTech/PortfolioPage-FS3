/**
 * @jest-environment node
 */
/**
 * S5 release tests for the README links (spec stabilize-and-cleanup, sections 2.3 and
 * 3.4 WI-62): AC-93, every README URL resolves, and AC-94, no README image renders
 * broken.
 *
 * Links are read from `README.md` outside fenced code blocks and outside inline code
 * spans: inline links `[text](target)`, reference definitions `[label]: target`, and
 * autolinks `<https://...>`. Image targets `![alt](url)` belong to AC-94 only.
 *
 * AC-93 checks each target by its kind:
 * - An absolute `http(s)` URL is fetched with GET, following redirects, and must end
 *   on a 200-299 status. Other schemes, such as `mailto:`, are not checked.
 * - A fragment-only target such as `#background` must equal the GitHub anchor slug of
 *   one of the README's own headings.
 * - Any other target is a repo-relative path. Its `#fragment` and `?query` are dropped,
 *   and `git --literal-pathspecs ls-files --error-unmatch -- <path>` must exit 0.
 *
 * AC-94 fetches each image target the same way, and it must end on status 200 with a
 * `content-type` starting `image/`. A README with no image passes (A-16).
 *
 * Needs network access and `git`. Read-only. Run with `yarn verify:release`.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const README = path.join(REPO_ROOT, 'README.md');

/** Upper bound for one HTTP request, redirects included. */
const FETCH_TIMEOUT_MS = 30_000;

/** Upper bound for one `git` call. */
const GIT_TIMEOUT_MS = 60_000;

/** An image: `![alt](url "title")`. */
const IMAGE = /!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

/** An inline link, once images are replaced by their alt text. */
const LINK = /\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

/** A reference definition: `[label]: target`. */
const REFERENCE = /^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/;

/** An autolink: `<https://...>`. */
const AUTOLINK = /<(https?:\/\/[^\s<>]+)>/gi;

/** An ATX heading. */
const HEADING = /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/;

/**
 * The process environment minus every `JEST_*` variable, for child processes.
 *
 * @returns {NodeJS.ProcessEnv} The filtered environment.
 */
function childEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('JEST_'))
  );
}

/**
 * Reads the README lines that are outside fenced code blocks. Never throws.
 *
 * @returns {{ lines: { number: number, text: string }[], problem: string | null }} The
 *   lines with their 1-based numbers, or the problem.
 */
function readProseLines() {
  let text;
  try {
    text = fs.readFileSync(README, 'utf8');
  } catch (error) {
    return { lines: [], problem: `README.md could not be read: ${error.message}` };
  }
  let inFence = false;
  const lines = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (/^```/.test(line)) {
      if (!inFence || /^```\s*$/.test(line)) {
        inFence = !inFence;
      }
      return;
    }
    if (!inFence) {
      lines.push({ number: index + 1, text: line });
    }
  });
  return { lines, problem: null };
}

/**
 * Collects the README's image and link targets.
 *
 * @param {{ number: number, text: string }[]} lines The prose lines.
 * @returns {{ images: { number: number, target: string }[],
 *   links: { number: number, target: string }[] }} Every target with its line number.
 */
function collectTargets(lines) {
  const images = [];
  const links = [];
  lines.forEach(({ number, text }) => {
    const prose = text.replace(/`[^`]*`/g, '');
    for (const match of prose.matchAll(IMAGE)) {
      images.push({ number, target: match[2] });
    }
    const withoutImages = prose.replace(IMAGE, (whole, alt) => alt);
    for (const match of withoutImages.matchAll(LINK)) {
      links.push({ number, target: match[1] });
    }
    for (const match of withoutImages.matchAll(AUTOLINK)) {
      links.push({ number, target: match[1] });
    }
    const reference = REFERENCE.exec(withoutImages);
    if (reference) {
      links.push({ number, target: reference[1] });
    }
  });
  return { images, links };
}

/**
 * The GitHub anchor slugs of the README's headings, with `-1`, `-2` suffixes for
 * repeated headings.
 *
 * @param {{ text: string }[]} lines The prose lines.
 * @returns {Set<string>} The slugs.
 */
function headingSlugs(lines) {
  const seen = new Map();
  const slugs = new Set();
  lines.forEach(({ text }) => {
    const heading = HEADING.exec(text);
    if (!heading) {
      return;
    }
    const base = heading[1]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
      .replace(/ /g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  });
  return slugs;
}

/**
 * Fetches a URL with GET, following redirects. Never throws.
 *
 * @param {string} url The absolute URL.
 * @returns {Promise<{ status: number | null, contentType: string, problem: string | null }>}
 *   The final status and content type, or the problem.
 */
async function fetchUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const contentType = response.headers.get('content-type') ?? '';
    await response.body?.cancel();
    return { status: response.status, contentType, problem: null };
  } catch (error) {
    return { status: null, contentType: '', problem: `${error.name}: ${error.message}` };
  }
}

/**
 * Checks a repo-relative path with `git ls-files --error-unmatch`. Never throws.
 *
 * @param {string} target The link target.
 * @returns {string | null} The problem, or null when the path is tracked.
 */
function checkRelative(target) {
  let file = target.replace(/[#?].*$/, '');
  try {
    file = decodeURIComponent(file);
  } catch {
    // Keep the raw path.
  }
  const args = ['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', file];
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(),
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return `git ${args.join(' ')} exited ${result.status}: ${reason}`;
  }
  return null;
}

/**
 * Checks one AC-93 link target.
 *
 * @param {string} target The link target.
 * @param {Set<string>} slugs The README heading slugs.
 * @returns {Promise<string | null>} The problem, or null when it resolves.
 */
async function checkLink(target, slugs) {
  if (target.startsWith('#')) {
    let fragment = target.slice(1);
    try {
      fragment = decodeURIComponent(fragment);
    } catch {
      // Keep the raw fragment.
    }
    return slugs.has(fragment.toLowerCase()) ? null : 'no README heading has this anchor';
  }
  const url = target.startsWith('//') ? `https:${target}` : target;
  if (/^https?:\/\//i.test(url)) {
    const { status, problem } = await fetchUrl(url);
    if (problem) {
      return problem;
    }
    return status >= 200 && status <= 299 ? null : `HTTP ${status} after redirects`;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return null;
  }
  return checkRelative(target);
}

/**
 * Checks one AC-94 image target.
 *
 * @param {string} target The image URL.
 * @returns {Promise<string | null>} The problem, or null when it returns an image.
 */
async function checkImage(target) {
  const { status, contentType, problem } = await fetchUrl(target);
  if (problem) {
    return problem;
  }
  const issues = [];
  if (status !== 200) {
    issues.push(`HTTP ${status} after redirects`);
  }
  if (!contentType.toLowerCase().startsWith('image/')) {
    issues.push(`content-type "${contentType}"`);
  }
  return issues.length === 0 ? null : issues.join(', ');
}

/**
 * Runs a check on each distinct target and lists the failures.
 *
 * @param {{ number: number, target: string }[]} targets The targets.
 * @param {(target: string) => Promise<string | null>} check The check.
 * @returns {Promise<string[]>} Each failure as `README.md:<line>: <target>: <problem>`.
 */
async function failures(targets, check) {
  const distinct = [...new Set(targets.map(({ target }) => target))];
  const results = new Map(
    await Promise.all(distinct.map(async (target) => [target, await check(target)]))
  );
  return targets
    .filter(({ target }) => results.get(target) !== null)
    .map(({ number, target }) => `README.md:${number}: ${target}: ${results.get(target)}`);
}

describe('README links (AC-93, AC-94)', () => {
  it('AC-93: every README link target resolves', async () => {
    // Arrange
    const { lines, problem } = readProseLines();
    const { links } = collectTargets(lines);
    const slugs = headingSlugs(lines);

    // Act
    const failed = await failures(links, (target) => checkLink(target, slugs));

    // Assert
    expect({ problem, failed }).toEqual({ problem: null, failed: [] });
  });

  it('AC-94: every README image returns status 200 and an image content type', async () => {
    // Arrange
    const { lines, problem } = readProseLines();
    const { images } = collectTargets(lines);

    // Act
    const failed = await failures(images, checkImage);

    // Assert
    expect({ problem, failed }).toEqual({ problem: null, failed: [] });
  });
});
