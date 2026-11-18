/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-8 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-11
 * and 3.7 chain D): the Node major declared in `.nvmrc` was in its support window
 * on 2026-11-16, per the nodejs/Release schedule.
 *
 * It fetches the schedule from the network. Every failure is an `expect` whose
 * received value names the file, the URL, the entry or the dates.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The Node release schedule AC-8 reads. */
const SCHEDULE_URL = 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json';

/** The day the declared line must have been in support. */
const SUPPORT_DAY = '2026-11-16';

/** Upper bound for the schedule download. */
const FETCH_TIMEOUT_MS = 30_000;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads the major of `.nvmrc` line 1.
 *
 * @returns {{ major: number | null, problem: string | null }} The major, or the problem.
 */
function readNvmrcMajor() {
  let text;
  try {
    text = fs.readFileSync(path.join(REPO_ROOT, '.nvmrc'), 'utf8');
  } catch (error) {
    return { major: null, problem: `.nvmrc: cannot be read (${error.message})` };
  }
  const line = text.split(/\r?\n/)[0].trim();
  const match = /^v?(\d+)/i.exec(line);
  return match
    ? { major: Number(match[1]), problem: null }
    : { major: null, problem: `.nvmrc: line 1 "${line}" has no major version` };
}

/**
 * Downloads and parses the release schedule.
 *
 * @returns {Promise<{ schedule: Record<string, unknown> | null, problem: string | null }>}
 *   The schedule, or the problem.
 */
async function fetchSchedule() {
  try {
    const response = await fetch(SCHEDULE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      return { schedule: null, problem: `${SCHEDULE_URL}: HTTP ${response.status}` };
    }
    return { schedule: await response.json(), problem: null };
  } catch (error) {
    return { schedule: null, problem: `${SCHEDULE_URL}: fetch failed (${error.message})` };
  }
}

describe('Node support window (S5, chain D)', () => {
  it(`AC-8: the .nvmrc major was in its nodejs/Release support window on ${SUPPORT_DAY}`, async () => {
    const nvmrc = readNvmrcMajor();
    expect(nvmrc.problem).toBeNull();

    const fetched = await fetchSchedule();
    expect(fetched.problem).toBeNull();

    const key = `v${nvmrc.major}`;
    const entry = (fetched.schedule ?? {})[key];
    const start = entry && typeof entry === 'object' ? entry.start : undefined;
    const end = entry && typeof entry === 'object' ? entry.end : undefined;
    let problem = null;
    if (!entry || typeof entry !== 'object') {
      problem = `${SCHEDULE_URL} has no entry ${key}`;
    } else if (!ISO_DAY.test(String(start)) || !ISO_DAY.test(String(end))) {
      problem = `${SCHEDULE_URL} ${key} has start ${start} and end ${end}, not YYYY-MM-DD dates`;
    } else if (!(start <= SUPPORT_DAY && SUPPORT_DAY < end)) {
      problem = `${key} (from .nvmrc) runs from ${start} to ${end}, so ${SUPPORT_DAY} is not in start <= day < end`;
    }

    expect(problem).toBeNull();
  });
});
