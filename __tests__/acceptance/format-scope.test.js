/**
 * @jest-environment node
 */
/**
 * S1 acceptance test for chain B (spec stabilize-and-cleanup, section 3.4 WI-9):
 * AC-14, the format check covers `src/css`.
 *
 * It copies the committed tree (`git archive HEAD | tar -x`) to a temp directory,
 * links the repo's `node_modules` into the copy, appends an unformatted rule to
 * `src/css/style.css`, and runs `scripts["format:check"]` from `package.json` with the
 * repo's Prettier binary. The check must fail and name that file.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PRETTIER_BIN = path.join(REPO_ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

/** The unformatted rule AC-14 appends to the stylesheet. */
const UNFORMATTED_RULE = 'a{color:red}';
const STYLESHEET = path.join('src', 'css', 'style.css');

/** Output that names the stylesheet, with either path separator. */
const NAMES_STYLESHEET = /src[\\/]css[\\/]style\.css/;

/** Upper bound for one child process; the archive is a few MB. */
const RUN_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 2 * RUN_TIMEOUT_MS + 30_000;
const MAX_BUFFER = 512 * 1024 * 1024;

/**
 * Runs a process and throws when it could not run or exited non-zero.
 *
 * @param {string} command Executable to run.
 * @param {string[]} args Its arguments.
 * @param {import('node:child_process').SpawnSyncOptions} options Spawn options.
 * @returns {import('node:child_process').SpawnSyncReturns<Buffer>} The finished process.
 */
function runOrThrow(command, args, options) {
  const result = spawnSync(command, args, {
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : '';
    throw new Error(
      `${command} ${args.join(' ')} failed (status ${result.status}): ${result.error ?? stderr}`
    );
  }
  return result;
}

/**
 * Copies the tracked tree at HEAD into `targetDir` with `git archive HEAD | tar -x`.
 *
 * @param {string} targetDir Empty directory to extract into.
 */
function copyTrackedTree(targetDir) {
  const archive = runOrThrow('git', ['archive', '--format=tar', 'HEAD'], { cwd: REPO_ROOT });
  runOrThrow('tar', ['-x', '-f', '-'], { cwd: targetDir, input: archive.stdout });
}

/**
 * Turns `scripts["format:check"]` into Prettier CLI arguments.
 *
 * @param {string} script The script text, such as `prettier --check src/js __tests__`.
 * @returns {string[]} The arguments after the `prettier` command.
 */
function prettierArgs(script) {
  const [command, ...args] = script.trim().split(/\s+/);
  if (command !== 'prettier') {
    throw new Error(`format:check does not start with prettier: ${script}`);
  }
  return args;
}

/**
 * Removes the `node_modules` link without following it into the real directory.
 *
 * @param {string} link Path of the link.
 */
function removeLink(link) {
  try {
    fs.unlinkSync(link);
  } catch {
    fs.rmSync(link, { force: true });
  }
}

describe('AC-14: the format check covers src/css (chain B)', () => {
  let copyDir;
  let result;
  let output;

  beforeAll(() => {
    copyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'format-scope-'));
    copyTrackedTree(copyDir);
    fs.symlinkSync(
      path.join(REPO_ROOT, 'node_modules'),
      path.join(copyDir, 'node_modules'),
      'junction'
    );
    fs.appendFileSync(path.join(copyDir, STYLESHEET), `\n${UNFORMATTED_RULE}\n`);

    const pkg = JSON.parse(fs.readFileSync(path.join(copyDir, 'package.json'), 'utf8'));
    result = spawnSync(
      process.execPath,
      [PRETTIER_BIN, ...prettierArgs(pkg.scripts['format:check'])],
      {
        cwd: copyDir,
        encoding: 'utf8',
        timeout: RUN_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
      }
    );
    if (result.error) {
      throw result.error;
    }
    output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  }, TEST_TIMEOUT_MS);

  afterAll(() => {
    if (!copyDir) {
      return;
    }
    removeLink(path.join(copyDir, 'node_modules'));
    fs.rmSync(copyDir, { recursive: true, force: true });
  });

  it('exits non-zero when src/css/style.css holds an unformatted rule', () => {
    expect(result.status).toBeGreaterThan(0);
  });

  it('names src/css/style.css in its output', () => {
    expect(output).toMatch(NAMES_STYLESHEET);
  });
});
