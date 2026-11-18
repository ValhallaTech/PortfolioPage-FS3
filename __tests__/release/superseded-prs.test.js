/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-13 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-20
 * and 3.7 chain G): the superseded PRs 56 and 68 are no longer open.
 *
 * Needs `gh`, authenticated, and network access. Read-only: it runs only
 * `gh pr view`. Run with `yarn verify:release`.
 * It never skips: every failure is an `expect` that shows its message.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The repository the PRs belong to. */
const REPO = 'ValhallaTech/PortfolioPage-FS3';

/** The superseded PRs (D-9). */
const SUPERSEDED_PRS = [56, 68];

/** The states that mean a PR is closed out. */
const CLOSED_STATES = ['MERGED', 'CLOSED'];

/** Upper bound for one `gh` call. */
const GH_TIMEOUT_MS = 120_000;

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
 * Checks one PR's state.
 *
 * @param {number} number The PR number.
 * @returns {string | null} The problem, or null when the PR is merged or closed.
 */
function findStateProblem(number) {
  const args = ['pr', 'view', String(number), '--repo', REPO, '--json', 'state'];
  const result = spawnSync('gh', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(),
    timeout: GH_TIMEOUT_MS,
    windowsHide: true,
  });
  const command = `gh ${args.join(' ')}`;
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return `AC-13: ${command} failed (exit ${result.status}): ${reason}`;
  }
  let state;
  try {
    state = JSON.parse(result.stdout)?.state;
  } catch (error) {
    return `AC-13: ${command} printed invalid JSON: ${error.message}`;
  }
  return CLOSED_STATES.includes(state)
    ? null
    : `AC-13: PR ${number} is ${state}, expected ${CLOSED_STATES.join(' or ')}`;
}

describe('AC-13: PRs 56 and 68 are closed out', () => {
  it('AC-13: PRs 56 and 68 are merged or closed', () => {
    const problems = SUPERSEDED_PRS.map(findStateProblem).filter((problem) => problem !== null);

    expect(problems).toEqual([]);
  });
});
