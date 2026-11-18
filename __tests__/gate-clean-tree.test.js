/**
 * @jest-environment node
 */
/**
 * S1 tests for the D-10 clean-tree rule of the gate runner (spec
 * stabilize-and-cleanup, D-10 "Clean tree only" and section 3.4 WI-4
 * "Clean-tree check"; review finding CODE-GATE-1).
 *
 * Each scenario runs `node scripts/gate.mjs` in a scratch Git repository whose
 * only commit holds a package.json naming the packageManager Yarn, and whose
 * working tree holds one untracked file.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'gate.mjs');

/** Marker that opens every v1 evidence block (D-10). */
const EVIDENCE_MARKER = '<!-- gate-evidence:v1 -->';

/** Exit code of a dirty working tree (D-10 clean-tree rule). */
const DIRTY_TREE_EXIT = 65;

/** The D-10 clean-tree refusal the runner prints on stderr. */
const DIRTY_TREE_MESSAGE = 'Gate refused: the working tree has uncommitted changes';

/** The scratch repository's package.json, as the finding specifies it. */
const SCRATCH_MANIFEST = { packageManager: 'yarn@4.18.1' };

/** Six trivial step commands for the `--commands-file` run (chain A format). */
const PASSING_COMMANDS = Array.from({ length: 6 }, () => 'node -e "process.exit(0)"');

/** Identity for the scratch repository's single commit. */
const SCRATCH_GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Gate Test',
  GIT_AUTHOR_EMAIL: 'gate-test@example.invalid',
  GIT_COMMITTER_NAME: 'Gate Test',
  GIT_COMMITTER_EMAIL: 'gate-test@example.invalid',
};

/** Upper bound for one runner or git process. */
const RUN_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = RUN_TIMEOUT_MS + 30_000;

/** How much of the runner's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

const COMMIT_LINE = /^- Commit: `([^`]*)`\s*$/m;

/**
 * Describes how the runner process ended: its exit status, signal, spawn error
 * and the tail of its stderr.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The description.
 */
function describeRun(run) {
  const stderr = (run.stderr ?? '').trimEnd();
  const tail = stderr ? stderr.slice(-STDERR_TAIL_CHARS) : '(empty)';
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return (
    `Gate runner: exit ${run.status}, signal ${run.signal}${spawnError}\n` +
    `Gate runner stderr (last ${STDERR_TAIL_CHARS} characters):\n${tail}`
  );
}

/**
 * Runs `assertion` and, when it fails, adds the runner's exit status and stderr
 * tail to the failure message, so a run that went wrong shows why. A copy of
 * the helper in __tests__/acceptance/gate-evidence.test.js, which is frozen and
 * exports nothing.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @param {() => void} assertion The `expect` call to run.
 */
function expectWithRunDetail(run, assertion) {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) {
      const detail = `\n\n${describeRun(run)}`;
      const original = error.message;
      error.message = `${original}${detail}`;
      // V8 formats `stack` lazily, so it may already carry the new message.
      if (typeof error.stack === 'string' && !error.stack.includes(detail)) {
        error.stack = error.stack.replace(original, error.message);
      }
    }
    throw error;
  }
}

/**
 * Reads a text file, or returns '' when it does not exist.
 *
 * @param {string} file Path to read.
 * @returns {string} The file's text.
 */
function readOptional(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Runs git in `cwd` and returns its trimmed stdout; throws when git fails, so
 * a broken scratch repository fails the setup rather than a later assertion.
 *
 * @param {string[]} args Git arguments.
 * @param {string} cwd Directory git runs in.
 * @returns {string} The trimmed stdout.
 */
function git(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...SCRATCH_GIT_IDENTITY },
    timeout: RUN_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    throw new Error(`git ${args.join(' ')} failed (exit ${result.status}): ${reason}`);
  }
  return (result.stdout ?? '').trim();
}

/**
 * Makes the scratch repository: one commit holding package.json, then one
 * untracked file in the working tree.
 *
 * @param {string} dir Empty directory to make the repository in.
 * @returns {string} The SHA of the repository's HEAD.
 */
function createDirtyScratchRepo(dir) {
  git(['init', '--quiet'], dir);
  git(['config', 'core.autocrlf', 'false'], dir);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify(SCRATCH_MANIFEST, null, 2)}\n`,
    'utf8'
  );
  git(['add', '--', 'package.json'], dir);
  git(['commit', '--quiet', '-m', 'scratch: package.json'], dir);
  fs.writeFileSync(path.join(dir, 'untracked.txt'), 'not committed\n', 'utf8');
  return git(['rev-parse', 'HEAD'], dir);
}

/**
 * Runs the gate runner with `cwd` as its working directory.
 *
 * @param {string} cwd Directory the runner runs in.
 * @param {string[]} args Runner arguments.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runGate(cwd, args) {
  return spawnSync(process.execPath, [GATE_SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    env: process.env,
    timeout: RUN_TIMEOUT_MS,
    windowsHide: true,
  });
}

describe('D-10 clean-tree rule: the gate runner refuses a dirty working tree', () => {
  let workDir;
  let cloneDir;
  let headSha;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-clean-tree-'));
    cloneDir = path.join(workDir, 'clone');
    fs.mkdirSync(cloneDir);
    headSha = createDirtyScratchRepo(cloneDir);
  }, TEST_TIMEOUT_MS);

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('when the tree has one untracked file and no --commands-file is given', () => {
    let result;
    let outFile;

    beforeAll(() => {
      outFile = path.join(workDir, 'dirty-tree.md');
      result = runGate(cloneDir, ['--out', outFile]);
    }, TEST_TIMEOUT_MS);

    it('exits 65, the dirty-tree code', () => {
      expectWithRunDetail(result, () => expect(result.status).toBe(DIRTY_TREE_EXIT));
    });

    it('prints the D-10 refusal on stderr', () => {
      expectWithRunDetail(result, () => expect(result.stderr).toContain(DIRTY_TREE_MESSAGE));
    });

    it('writes no evidence block to stdout', () => {
      expectWithRunDetail(result, () => expect(result.stdout).not.toContain(EVIDENCE_MARKER));
    });

    it('writes no --out file', () => {
      expectWithRunDetail(result, () => expect(fs.existsSync(outFile)).toBe(false));
    });
  });

  describe('when the same dirty tree is run with --commands-file', () => {
    let result;
    let outFile;

    beforeAll(() => {
      const commandsFile = path.join(workDir, 'all-pass.json');
      fs.writeFileSync(commandsFile, JSON.stringify(PASSING_COMMANDS), 'utf8');
      outFile = path.join(workDir, 'commands-file.md');
      result = runGate(cloneDir, ['--commands-file', commandsFile, '--out', outFile]);
    }, TEST_TIMEOUT_MS);

    it('is exempt from the rule: it runs the steps and exits 0', () => {
      expectWithRunDetail(result, () => expect(result.status).toBe(0));
    });

    it('writes an evidence block naming the scratch repository HEAD to --out', () => {
      const block = readOptional(outFile);
      expectWithRunDetail(result, () =>
        expect({
          marker: block.includes(EVIDENCE_MARKER),
          sha: COMMIT_LINE.exec(block)?.[1] ?? null,
        }).toEqual({ marker: true, sha: headSha })
      );
    });
  });
});
