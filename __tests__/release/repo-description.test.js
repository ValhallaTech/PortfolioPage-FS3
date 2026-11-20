/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-97 (spec stabilize-and-cleanup, sections 2.3 and 3.4 WI-62):
 * the GitHub repo description and README line 5 both carry the C-6 text.
 *
 * The description comes from `gh repo view ValhallaTech/PortfolioPage-FS3 --json
 * description`, parsed with `JSON.parse` because `yq` is absent from the Linux gate
 * container.
 *
 * Needs `gh`, authenticated, and network access. Read-only. Run with
 * `yarn verify:release`. It never skips: every failure is an `expect` that shows its
 * message.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const README = path.join(REPO_ROOT, 'README.md');

/** The repository whose description is read. */
const REPO = 'ValhallaTech/PortfolioPage-FS3';

/** C-6: the text both places carry. */
const DESCRIPTION =
  'Personal portfolio website for Fred Smith III, built as a static single-page application and deployed on Netlify.';

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
 * Reads the GitHub repo description. Never throws.
 *
 * @returns {string} The description, or a line naming the problem.
 */
function githubDescription() {
  const args = ['repo', 'view', REPO, '--json', 'description'];
  const command = `gh ${args.join(' ')}`;
  const result = spawnSync('gh', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(),
    timeout: GH_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return `PROBLEM: ${command} failed (exit ${result.status}): ${reason}`;
  }
  try {
    const { description } = JSON.parse(result.stdout);
    return typeof description === 'string'
      ? description
      : `PROBLEM: ${command} printed no description string`;
  } catch (error) {
    return `PROBLEM: ${command} printed invalid JSON: ${error.message}`;
  }
}

/**
 * Reads README line 5. Never throws.
 *
 * @returns {string} The line, or a line naming the problem.
 */
function readmeLineFive() {
  try {
    return fs.readFileSync(README, 'utf8').split(/\r?\n/)[4] ?? 'PROBLEM: README.md has no line 5';
  } catch (error) {
    return `PROBLEM: README.md could not be read: ${error.message}`;
  }
}

describe('AC-97: the repo description matches README line 5', () => {
  it('AC-97: the GitHub description and README line 5 both equal the C-6 text', () => {
    // Arrange and act
    const actual = { githubDescription: githubDescription(), readmeLine5: readmeLineFive() };

    // Assert
    expect(actual).toEqual({ githubDescription: DESCRIPTION, readmeLine5: DESCRIPTION });
  });
});
