/**
 * @jest-environment node
 */
/**
 * Tests for the request handler of scripts/serve-dist.mjs (review finding CR-2): the server
 * behind the Playwright local target.
 *
 * The script is an ES module with top-level await, which this Jest setup cannot import, so
 * each scenario runs a driver module with `node`, the way Playwright runs the script. The
 * driver records every FileHandle the script opens, builds the handler with `createHandler`
 * over a fixture dist root, sends it one GET request with a stand-in response (a Writable
 * that records what reaches it) and prints a JSON report. The real dist/ is never read.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVE_DIST_SCRIPT = path.join(REPO_ROOT, 'scripts', 'serve-dist.mjs');

/** The file the request names, and its bytes. */
const SERVED_FILE = 'index.html';
const SERVED_TEXT = '<!doctype html><title>serve-dist fixture</title>\n';

/** Jest's own variables; they are kept out of every child process. */
const JEST_VARIABLE_PREFIX = 'JEST_';

/** Upper bound for one child process; none of them touches the network. */
const CHILD_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = CHILD_TIMEOUT_MS + 30_000;

/** How much of a child's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

/**
 * The driver module. Arguments: the script path, the real dist root, the file name, and
 * `client-gone` (the response is destroyed before the handler runs) or `connected`.
 *
 * It wraps fs/promises.open before importing the script, so every FileHandle the script
 * opens is recorded; a closed FileHandle reports fd -1. It waits, up to a bound, for every
 * handle to close and, when the client is connected, for the body to finish.
 */
const DRIVER_SOURCE = `
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';

const SETTLE_MS = 2000;
const [scriptPath, root, fileName, mode] = process.argv.slice(2);

const uncaught = [];
process.on('uncaughtException', (error) => uncaught.push(String(error?.code ?? error)));
process.on('unhandledRejection', (error) => uncaught.push(String(error?.code ?? error)));

const fsPromises = createRequire(import.meta.url)('node:fs/promises');
const realOpen = fsPromises.open;
const opened = [];
fsPromises.open = async (...args) => {
  const handle = await realOpen(...args);
  opened.push(handle);
  return handle;
};
syncBuiltinESMExports();

const { createHandler } = await import(pathToFileURL(scriptPath).href);

const chunks = [];
let piped = false;
const response = new Writable({
  write(chunk, _encoding, callback) {
    chunks.push(Buffer.from(chunk));
    callback();
  },
});
response.setHeader = () => {};
response.writeHead = () => response;
response.on('pipe', () => {
  piped = true;
});
response.on('error', () => {});
if (mode === 'client-gone') response.destroy();

let handlerError = null;
try {
  await createHandler(root, [])({ method: 'GET', url: '/' + fileName }, response);
} catch (error) {
  handlerError = String(error?.code ?? error);
}

const settled = () =>
  opened.every((handle) => handle.fd === -1) &&
  (mode !== 'connected' || response.writableFinished);
const deadline = Date.now() + SETTLE_MS;
while (!settled() && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

process.stdout.write(
  JSON.stringify({
    handlerError,
    uncaught,
    opened: opened.length,
    closed: opened.filter((handle) => handle.fd === -1).length,
    piped,
    body: Buffer.concat(chunks).toString('utf8'),
  })
);
`;

/**
 * This process's environment minus every `JEST_*` variable.
 *
 * @returns {NodeJS.ProcessEnv} The child's environment.
 */
function childEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.toUpperCase().startsWith(JEST_VARIABLE_PREFIX)
    )
  );
}

/**
 * Describes how a child process ended: exit status, signal, spawn error, stdout and stderr tail.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The description.
 */
function describeRun(run) {
  const stderr = (run.stderr ?? '').trimEnd();
  const tail = stderr ? stderr.slice(-STDERR_TAIL_CHARS) : '(empty)';
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return `serve-dist driver: exit ${run.status}, signal ${run.signal}${spawnError}; stdout: ${run.stdout || '(empty)'}; stderr: ${tail}`;
}

/**
 * Runs `assertion` and, when it fails, adds the child's exit status and output to the
 * failure message.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @param {() => void} assertion The `expect` call to run.
 */
function expectWithRunDetail(run, assertion) {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}\n\n${describeRun(run)}`;
    }
    throw error;
  }
}

/**
 * Reads the driver's JSON report, or returns null when it printed none.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {{ handlerError: string | null, uncaught: string[], opened: number,
 *   closed: number, piped: boolean, body: string } | null} The report.
 */
function readReport(run) {
  try {
    return JSON.parse(run.stdout);
  } catch {
    return null;
  }
}

/**
 * Builds the fixture: a dist root holding the served file, and the driver module.
 *
 * @param {string} workDir The empty fixture directory.
 * @returns {{ root: string, driver: string }} The real dist root and the driver path.
 */
function createFixture(workDir) {
  const distDir = path.join(workDir, 'dist');
  fs.mkdirSync(distDir);
  fs.writeFileSync(path.join(distDir, SERVED_FILE), SERVED_TEXT, 'utf8');
  const driver = path.join(workDir, 'driver.mjs');
  fs.writeFileSync(driver, DRIVER_SOURCE, 'utf8');
  // createHandler takes the real root, as main() passes it; os.tmpdir() can be a short name.
  return { root: fs.realpathSync.native(distDir), driver };
}

/**
 * Runs the driver for one request.
 *
 * @param {{ root: string, driver: string }} fixture The fixture.
 * @param {'client-gone' | 'connected'} mode Whether the response is destroyed first.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runRequest({ root, driver }, mode) {
  return spawnSync(process.execPath, [driver, SERVE_DIST_SCRIPT, root, SERVED_FILE, mode], {
    cwd: path.dirname(driver),
    encoding: 'utf8',
    env: childEnvironment(),
    timeout: CHILD_TIMEOUT_MS,
    windowsHide: true,
  });
}

describe('serve-dist request handler', () => {
  let workDir;
  let fixture;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-dist-'));
    fixture = createFixture(workDir);
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
  });

  describe('when the client disconnected before the body is sent', () => {
    let run;
    let report;

    beforeAll(() => {
      // Act: the fixture from the outer beforeAll is the Arrange step.
      run = runRequest(fixture, 'client-gone');
      report = readReport(run);
    }, TEST_TIMEOUT_MS);

    test('finishes without an error', () => {
      // Assert
      expectWithRunDetail(run, () =>
        expect({
          status: run.status,
          handlerError: report?.handlerError,
          uncaught: report?.uncaught,
        }).toEqual({ status: 0, handlerError: null, uncaught: [] })
      );
    });

    test('closes the file handle it opened for the file', () => {
      // Assert
      expectWithRunDetail(run, () =>
        expect({ opened: report?.opened, closed: report?.closed }).toEqual({
          opened: 1,
          closed: 1,
        })
      );
    });

    test('pipes nothing to the response', () => {
      // Assert
      expectWithRunDetail(run, () =>
        expect({ piped: report?.piped, body: report?.body }).toEqual({ piped: false, body: '' })
      );
    });
  });

  describe('when the client is connected', () => {
    let run;
    let report;

    beforeAll(() => {
      // Act: the fixture from the outer beforeAll is the Arrange step.
      run = runRequest(fixture, 'connected');
      report = readReport(run);
    }, TEST_TIMEOUT_MS);

    test('sends the file bytes as the body', () => {
      // Assert
      expectWithRunDetail(run, () =>
        expect({ status: run.status, body: report?.body }).toEqual({ status: 0, body: SERVED_TEXT })
      );
    });

    test('closes the file handle once the body is sent', () => {
      // Assert
      expectWithRunDetail(run, () =>
        expect({ opened: report?.opened, closed: report?.closed }).toEqual({
          opened: 1,
          closed: 1,
        })
      );
    });
  });
});
