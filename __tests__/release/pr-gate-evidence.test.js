/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-2 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-3
 * and 3.7 chain A): every merged sprint-1 PR carries a v1 gate-evidence block for
 * its head commit, with exit code 0 for all six gate commands.
 *
 * Needs `gh`, authenticated, and network access. Run with `yarn verify:release`.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Marker that opens every v1 evidence block (D-10). */
const EVIDENCE_MARKER = '<!-- gate-evidence:v1 -->';

/** The six gate commands as the Command column names them (D-10). */
const CANONICAL_COMMANDS = [
  'yarn install --immutable',
  'yarn lint',
  'yarn format:check',
  'yarn test:ci',
  'yarn build',
  'yarn test:smoke',
];

/** Upper bound for one `gh` call. */
const GH_TIMEOUT_MS = 120_000;

const STEP_ROW = /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*$/;
const COMMIT_LINE = /^- Commit: `([^`]*)`\s*$/;

/**
 * Parses every v1 evidence block in `text`.
 *
 * @param {string} text A PR body or comment.
 * @returns {Array<{ sha: string | null, commands: string[], exitCodes: Array<number | string> }>}
 *   One entry per marker, in order.
 */
function parseEvidenceBlocks(text) {
  return text
    .split(EVIDENCE_MARKER)
    .slice(1)
    .map((section) => {
      const block = { sha: null, commands: [], exitCodes: [] };
      let inTable = false;
      for (const line of section.split(/\r?\n/)) {
        const commit = COMMIT_LINE.exec(line);
        if (commit && block.sha === null) {
          block.sha = commit[1];
        }
        const row = STEP_ROW.exec(line);
        if (row) {
          inTable = true;
          block.commands.push(row[2]);
          block.exitCodes.push(/^\d+$/.test(row[3]) ? Number(row[3]) : row[3]);
        } else if (inTable && !line.startsWith('|')) {
          break;
        }
      }
      return block;
    });
}

/**
 * Runs `gh` with JSON output and parses it. Never throws: a failure is returned
 * as a problem message so the test reports it through `expect`.
 *
 * @param {string[]} args Arguments after `gh`.
 * @returns {{ data: unknown, problem: string | null }} The parsed output, or the problem.
 */
function ghJson(args) {
  const result = spawnSync('gh', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: GH_TIMEOUT_MS,
    windowsHide: true,
  });
  const command = `gh ${args.join(' ')}`;
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return { data: null, problem: `AC-2: ${command} failed (exit ${result.status}): ${reason}` };
  }
  try {
    return { data: JSON.parse(result.stdout), problem: null };
  } catch (error) {
    return { data: null, problem: `AC-2: ${command} printed invalid JSON: ${error.message}` };
  }
}

/**
 * Checks one merged PR for a passing v1 block on its head commit.
 *
 * @param {{ number: number, headRefOid: string }} pr The PR from the AC-2 search.
 * @returns {string | null} The problem, or null when the PR carries the evidence.
 */
function findEvidenceProblem(pr) {
  const view = ghJson(['pr', 'view', String(pr.number), '--json', 'body,comments']);
  if (view.problem) {
    return view.problem;
  }
  const comments = Array.isArray(view.data?.comments) ? view.data.comments : [];
  const texts = [view.data?.body ?? '', ...comments.map((comment) => comment?.body ?? '')];
  const passing = texts
    .flatMap(parseEvidenceBlocks)
    .some(
      (block) =>
        block.sha === pr.headRefOid &&
        block.commands.join('\n') === CANONICAL_COMMANDS.join('\n') &&
        block.exitCodes.every((code) => code === 0)
    );
  return passing
    ? null
    : `AC-2: PR #${pr.number} has no v1 gate-evidence block for ${pr.headRefOid} with six 0 exit codes`;
}

describe('AC-2: each sprint-1 PR carries gate evidence for its head commit', () => {
  it('finds merged sprint-1 PRs, and each has a v1 block for its head SHA with six 0 exit codes', () => {
    const search = ghJson([
      'pr',
      'list',
      '--state',
      'merged',
      '--search',
      'stabilize-and-cleanup in:body',
      '--json',
      'number,headRefOid',
    ]);
    expect(search.problem).toBeNull();

    const prs = Array.isArray(search.data) ? search.data : [];
    expect(prs.length > 0 ? null : 'AC-2: no merged sprint-1 PR found').toBeNull();

    const problems = prs.map(findEvidenceProblem).filter((problem) => problem !== null);
    expect(problems).toEqual([]);
  });
});
