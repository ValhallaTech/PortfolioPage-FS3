/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for AC-84 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-56
 * and 3.7 chain N): `src/index.html` has no inline `style` attributes.
 *
 * It applies AC-84's pattern, `\sstyle\s*=`, to the file line by line, as
 * `rg -n '\sstyle\s*=' src/index.html` does. The failure lists each match as
 * `file:line: text`.
 */
const fs = require('node:fs');
const path = require('node:path');

const INDEX_HTML = path.resolve(__dirname, '..', '..', 'src', 'index.html');

/** Repo-relative name used in failure messages. */
const INDEX_HTML_NAME = 'src/index.html';

/** AC-84: an inline style attribute. */
const INLINE_STYLE = /\sstyle\s*=/;

/**
 * Lists every line of `src/index.html` that AC-84's pattern matches.
 *
 * @returns {string[]} Each match as `file:line: text`.
 */
function inlineStyleLines() {
  return fs
    .readFileSync(INDEX_HTML, 'utf8')
    .split(/\r?\n/)
    .flatMap((line, index) =>
      INLINE_STYLE.test(line) ? [`${INDEX_HTML_NAME}:${index + 1}: ${line.trim()}`] : []
    );
}

describe('index.html inline styles (S1, chain N)', () => {
  it('AC-84: src/index.html has 0 lines matching \\sstyle\\s*=', () => {
    // Act
    const matches = inlineStyleLines();

    // Assert
    expect(matches).toEqual([]);
  });
});
