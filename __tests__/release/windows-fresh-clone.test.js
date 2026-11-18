/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-1 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-3
 * and 3.7 chain A): the release commit passes the six gate commands in a fresh
 * clone of origin made with core.autocrlf=true, on Windows.
 *
 * The SHA under test is `AC1_REF` when set, else the peeled `4.0.0` tag on origin;
 * when both exist they must agree. Run with `yarn verify:release` on Windows.
 * It never skips: every failure is an `expect` that shows its message.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'gate.mjs');

/** The clone URL the release run starts from (D-10). */
const ORIGIN_URL = 'https://github.com/ValhallaTech/PortfolioPage-FS3';

/** The peeled release tag on origin. */
const RELEASE_TAG_REF = 'refs/tags/4.0.0^{}';

/** Marker that opens every v1 evidence block (D-10). */
const EVIDENCE_MARKER = '<!-- gate-evidence:v1 -->';

/** Exit code of the gate preflight when Yarn through Corepack is unavailable (D-10). */
const PRECONDITION_EXIT = 69;

/** Upper bound for `git ls-remote`. */
const LS_REMOTE_TIMEOUT_MS = 120_000;

/** Upper bound for the fresh-clone gate run; below the suite's testTimeout. */
const GATE_TIMEOUT_MS = 55 * 60 * 1000;

const STEP_ROW = /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*$/;
const COMMIT_LINE = /^- Commit: `([^`]*)`\s*$/;

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
 * @returns {{ sha: string | null, exitCodes: Array<number | string> }}
 *   The block's commit SHA and Exit code column (numbers where numeric).
 */
function parseEvidenceBlock(text) {
  const block = { sha: null, exitCodes: [] };
  const start = text.indexOf(EVIDENCE_MARKER);
  if (start === -1) {
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
      block.exitCodes.push(/^\d+$/.test(row[3]) ? Number(row[3]) : row[3]);
    } else if (inTable && !line.startsWith('|')) {
      break;
    }
  }
  return block;
}

/**
 * Builds the D-10 Windows host precondition message for the repo's Yarn version.
 *
 * @returns {string} The message the gate preflight prints.
 */
function preconditionMessage() {
  const manifest = JSON.parse(readOptional(path.join(REPO_ROOT, 'package.json')) || '{}');
  const yarnVersion = String(manifest.packageManager ?? '').replace(/^yarn@/, '');
  return (
    `Gate precondition: Yarn ${yarnVersion} through Corepack is not available. ` +
    'Run npm install -g corepack@0.36.0, then corepack enable.'
  );
}

/**
 * Reads the commit the peeled `4.0.0` tag points at on origin.
 *
 * @returns {{ sha: string | null, problem: string | null }} The SHA (null when the tag
 *   is absent), or the problem when `git ls-remote` failed.
 */
function readReleaseTagSha() {
  const result = spawnSync('git', ['ls-remote', 'origin', RELEASE_TAG_REF], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: LS_REMOTE_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return {
      sha: null,
      problem: `AC-1: git ls-remote origin ${RELEASE_TAG_REF} failed (exit ${result.status}): ${reason}`,
    };
  }
  const sha = (result.stdout ?? '').trim().split(/\s+/)[0];
  return { sha: sha ? sha.toLowerCase() : null, problem: null };
}

/**
 * Resolves the SHA under test from `AC1_REF` and the peeled `4.0.0` tag.
 *
 * @returns {{ sha: string | null, problem: string | null }} The SHA, or the problem.
 */
function resolveReleaseSha() {
  const ref = (process.env.AC1_REF ?? '').trim().toLowerCase() || null;
  const tag = readReleaseTagSha();
  if (tag.problem) {
    return { sha: null, problem: tag.problem };
  }
  if (ref === null && tag.sha === null) {
    return {
      sha: null,
      problem: 'AC-1: no release commit yet: tag 4.0.0 is not on origin and AC1_REF is unset',
    };
  }
  if (ref !== null && tag.sha !== null && ref !== tag.sha) {
    return {
      sha: null,
      problem: `AC-1: AC1_REF ${ref} does not match the peeled tag 4.0.0 on origin, ${tag.sha}`,
    };
  }
  return { sha: ref ?? tag.sha, problem: null };
}

describe('AC-1: the release commit passes the gate on a fresh Windows clone', () => {
  let workDir;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-fresh-clone-'));
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('exits 0 on all six gate commands for the release SHA, cloned with autocrlf', () => {
    expect(process.platform === 'win32' ? null : 'AC-1 must run on Windows').toBeNull();

    const release = resolveReleaseSha();
    expect(release.problem).toBeNull();

    const outFile = path.join(workDir, 'evidence.md');
    const run = spawnSync(
      process.execPath,
      [
        GATE_SCRIPT,
        '--fresh-clone',
        ORIGIN_URL,
        '--ref',
        release.sha,
        '--autocrlf',
        '--out',
        outFile,
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 512 * 1024 * 1024,
        timeout: GATE_TIMEOUT_MS,
        windowsHide: true,
      }
    );
    expect(run.status === PRECONDITION_EXIT ? preconditionMessage() : null).toBeNull();

    const block = parseEvidenceBlock(readOptional(outFile));
    expect({ sha: block.sha, exitCodes: block.exitCodes }).toEqual({
      sha: release.sha,
      exitCodes: [0, 0, 0, 0, 0, 0],
    });
  });
});
