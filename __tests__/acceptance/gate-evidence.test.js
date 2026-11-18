/**
 * @jest-environment node
 */
/**
 * S1 acceptance tests for chain A (spec stabilize-and-cleanup, sections 3.4 WI-3
 * and 3.7): the gate runner's v1 evidence block, the AC-2 format check.
 *
 * Each scenario runs `node scripts/gate.mjs --commands-file <fixture> --out <tmp>`
 * from the repo root and asserts the block the runner wrote to `--out`.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'gate.mjs');
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'gate');

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

/** Exit code of a malformed `--commands-file` (chain A). */
const USAGE_EXIT = 64;

/** Upper bound for one runner process; the fixtures run six trivial commands. */
const RUN_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = RUN_TIMEOUT_MS + 30_000;

/** How much of the runner's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

const STEP_ROW = /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*$/;
const COMMIT_LINE = /^- Commit: `([^`]*)`\s*$/;

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
 * tail to the failure message, so a run that wrote no block shows why.
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
 * Parses the first v1 evidence block in `text`.
 *
 * @param {string} text Text that may hold a block.
 * @returns {{ found: boolean, sha: string | null, commands: string[], exitCodes: Array<number | string> }}
 *   The block's commit SHA, Command column and Exit code column (numbers where numeric).
 */
function parseEvidenceBlock(text) {
  const start = text.indexOf(EVIDENCE_MARKER);
  const block = { found: start !== -1, sha: null, commands: [], exitCodes: [] };
  if (!block.found) {
    return block;
  }
  let inTable = false;
  for (const line of text.slice(start + EVIDENCE_MARKER.length).split(/\r?\n/)) {
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
}

/**
 * Runs the gate runner with a commands-file fixture.
 *
 * @param {string} fixture File name under fixtures/gate.
 * @param {string} outFile Path for `--out`.
 * @param {NodeJS.ProcessEnv} [extraEnv] Variables added to the runner's environment.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runGate(fixture, outFile, extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [GATE_SCRIPT, '--commands-file', path.join(FIXTURES_DIR, fixture), '--out', outFile],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, ...extraEnv },
      timeout: RUN_TIMEOUT_MS,
      windowsHide: true,
    }
  );
}

/**
 * Reads `git rev-parse HEAD` in the repo root.
 *
 * @returns {string} The trimmed output, '' on failure.
 */
function readHeadSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
    windowsHide: true,
  });
  return (result.stdout ?? '').trim();
}

describe('AC-2 format: the gate runner writes the v1 evidence block (chain A)', () => {
  let workDir;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-evidence-'));
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('when all six commands exit 0', () => {
    let result;
    let block;

    beforeAll(() => {
      const outFile = path.join(workDir, 'all-pass.md');
      result = runGate('all-pass.json', outFile);
      block = parseEvidenceBlock(readOptional(outFile));
    }, TEST_TIMEOUT_MS);

    it('records the SHA of HEAD against the six canonical gate commands, in order', () => {
      expectWithRunDetail(result, () =>
        expect({ sha: block.sha, commands: block.commands }).toEqual({
          sha: readHeadSha(),
          commands: CANONICAL_COMMANDS,
        })
      );
    });

    it('records exit code 0 for all six steps, and exits 0', () => {
      expectWithRunDetail(result, () =>
        expect({ exitCodes: block.exitCodes, status: result.status }).toEqual({
          exitCodes: [0, 0, 0, 0, 0, 0],
          status: 0,
        })
      );
    });
  });

  describe('when step 3 exits 3', () => {
    let result;
    let block;
    let markerFile;

    beforeAll(() => {
      const outFile = path.join(workDir, 'fail-at-step-3.md');
      markerFile = path.join(workDir, 'step-4-ran.marker');
      result = runGate('fail-at-step-3.json', outFile, { GATE_TEST_MARKER: markerFile });
      block = parseEvidenceBlock(readOptional(outFile));
    }, TEST_TIMEOUT_MS);

    it('records 0, 0, 3, then "not run" for steps 4 to 6', () => {
      expectWithRunDetail(result, () =>
        expect(block.exitCodes).toEqual([0, 0, 3, 'not run', 'not run', 'not run'])
      );
    });

    it('exits with the failing step code, 3', () => {
      expectWithRunDetail(result, () => expect(result.status).toBe(3));
    });

    it('stops before step 4: step 4 is "not run" and wrote no marker file', () => {
      expectWithRunDetail(result, () =>
        expect({ step4: block.exitCodes[3], markerWritten: fs.existsSync(markerFile) }).toEqual({
          step4: 'not run',
          markerWritten: false,
        })
      );
    });
  });

  describe('when the commands file holds five strings instead of six', () => {
    let result;
    let outFile;

    beforeAll(() => {
      outFile = path.join(workDir, 'five-commands.md');
      result = runGate('five-commands.json', outFile);
    }, TEST_TIMEOUT_MS);

    it('exits 64, the usage-error code', () => {
      expectWithRunDetail(result, () => expect(result.status).toBe(USAGE_EXIT));
    });

    it('prints a message on stderr', () => {
      expectWithRunDetail(result, () => expect((result.stderr ?? '').trim()).not.toBe(''));
    });

    it('writes no evidence block to stdout or to --out', () => {
      expectWithRunDetail(result, () =>
        expect({
          stdout: (result.stdout ?? '').includes(EVIDENCE_MARKER),
          out: readOptional(outFile).includes(EVIDENCE_MARKER),
        }).toEqual({ stdout: false, out: false })
      );
    });
  });
});
