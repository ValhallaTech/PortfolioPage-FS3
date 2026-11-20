/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for AC-79 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-56
 * and 3.7 chain N): section 3 of the spec records exactly one D-5 source-map decision.
 *
 * Section 3 runs from the `## 3.` heading to the next `## ` heading or the end of the
 * file. Lines are matched one at a time, as `rg` does. AC-79 is a guard: the decision
 * line is committed with the spec in PR-1, so it passes before any PR-10 work.
 */
const fs = require('node:fs');
const path = require('node:path');

const SPEC = path.resolve(__dirname, '..', '..', 'specs', 'stabilize-and-cleanup.md');

/** Repo-relative name used in failure messages. */
const SPEC_NAME = 'specs/stabilize-and-cleanup.md';

/** The heading that opens section 3. */
const SECTION_3_HEADING = /^## 3\./;

/** Any level-2 heading, which closes section 3. */
const LEVEL_2_HEADING = /^## /;

/** AC-79, as WI-56 words it: the D-5 decision line. */
const D5_DECISION = /^\*\*D-5 decision:\*\* production (does not serve|serves) source maps\.$/;

/**
 * Returns the lines of section 3 of the spec.
 *
 * @returns {{ lines: string[] | null, problem: string | null }} The lines, or the problem.
 */
function readSection3() {
  let text;
  try {
    text = fs.readFileSync(SPEC, 'utf8');
  } catch (error) {
    return { lines: null, problem: `${SPEC_NAME}: cannot be read (${error.message})` };
  }
  const all = text.split(/\r?\n/);
  const start = all.findIndex((line) => SECTION_3_HEADING.test(line));
  if (start === -1) {
    return { lines: null, problem: `${SPEC_NAME}: has no "## 3." heading` };
  }
  const next = all.findIndex((line, index) => index > start && LEVEL_2_HEADING.test(line));
  return { lines: all.slice(start + 1, next === -1 ? all.length : next), problem: null };
}

describe('Spec decisions (S1, chain N)', () => {
  it('AC-79: section 3 has exactly one D-5 decision line on serving source maps', () => {
    // Arrange
    const { lines, problem } = readSection3();
    expect(problem).toBeNull();

    // Act
    const decisions = lines.filter((line) => D5_DECISION.test(line));

    // Assert
    expect(decisions).toHaveLength(1);
  });
});
