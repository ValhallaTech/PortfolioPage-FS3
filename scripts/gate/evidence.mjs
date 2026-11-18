/**
 * The v1 gate-evidence block (spec stabilize-and-cleanup, D-10).
 *
 * Pure formatting only: no I/O, no process state. Every value printed here is
 * either a constant or a value the caller has already validated, so nothing a
 * caller passes can add a line or a table row to the block.
 */

/** Marker that opens every v1 evidence block; AC-2 searches for it. */
export const EVIDENCE_MARKER = '<!-- gate-evidence:v1 -->';

/** Spec slug named in the evidence heading. */
export const SPEC_SLUG = 'stabilize-and-cleanup';

/** The six gate commands, in run order, as the Command column names them. */
export const CANONICAL_COMMANDS = Object.freeze([
  'yarn install --immutable',
  'yarn lint',
  'yarn format:check',
  'yarn test:ci',
  'yarn build',
  'yarn test:smoke',
]);

/** Exit-code cell of a step that was skipped after an earlier failure. */
export const NOT_RUN = 'not run';

/**
 * @typedef {object} EvidenceFacts
 * @property {string} sha Commit the steps ran against.
 * @property {string} environment Environment label.
 * @property {string} nodeVersion `node --version` of the runner.
 * @property {string} yarnVersion `yarn --version` from the preflight.
 * @property {ReadonlyArray<number | typeof NOT_RUN>} exitCodes One cell per
 *   canonical command, in order.
 */

/**
 * Builds the v1 evidence block.
 *
 * @param {EvidenceFacts} facts The header values and the six exit-code cells.
 * @returns {string} The block, ending in a newline.
 * @throws {RangeError} When `exitCodes` does not hold one cell per command.
 */
export function formatEvidenceBlock({ sha, environment, nodeVersion, yarnVersion, exitCodes }) {
  if (exitCodes.length !== CANONICAL_COMMANDS.length) {
    throw new RangeError(
      `expected ${CANONICAL_COMMANDS.length} exit codes, got ${exitCodes.length}`
    );
  }
  const rows = CANONICAL_COMMANDS.map(
    (command, index) => `| ${index + 1} | \`${command}\` | ${exitCodes[index]} |`
  );
  return [
    EVIDENCE_MARKER,
    `### Gate evidence: ${SPEC_SLUG}`,
    `- Commit: \`${sha}\``,
    `- Environment: \`${environment}\``,
    `- Node: \`${nodeVersion}\` · Yarn: \`${yarnVersion}\``,
    '',
    '| # | Command | Exit code |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}
