/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for chain F (spec stabilize-and-cleanup, section 3.4 WI-18):
 * AC-108, Renovate automerge is still paused at release.
 *
 * It reads `renovate.json` as text and looks for the AC's pattern,
 * `"automerge"\s*:\s*true`, on every line. It is offline and runs the same on
 * Windows and Linux.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RENOVATE_CONFIG = path.join(REPO_ROOT, 'renovate.json');

/** The AC-108 pattern: `rg -n '"automerge"\s*:\s*true' renovate.json`. */
const AUTOMERGE_ON = /"automerge"\s*:\s*true/;

/**
 * Lists every line of `renovate.json` that turns automerge on.
 *
 * @returns {string|null} The matching lines with their numbers, a read error, or
 *   null when no line matches.
 */
function automergeOnProblem() {
  let text;
  try {
    text = fs.readFileSync(RENOVATE_CONFIG, 'utf8');
  } catch (error) {
    return `could not read renovate.json: ${error.message}`;
  }

  const matches = text
    .split(/\r?\n/)
    .map((line, index) => ({ number: index + 1, line }))
    .filter(({ line }) => AUTOMERGE_ON.test(line))
    .map(({ number, line }) => `renovate.json:${number}: ${line.trim()}`);

  return matches.length === 0
    ? null
    : `renovate.json turns automerge on in ${matches.length} place(s):\n${matches.join('\n')}`;
}

describe('Renovate automerge pause (chain F)', () => {
  test('AC-108: renovate.json has no "automerge": true in any rule or top-level setting', () => {
    const problem = automergeOnProblem();

    expect(problem).toBeNull();
  });
});
