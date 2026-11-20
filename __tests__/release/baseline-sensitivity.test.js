/**
 * @jest-environment node
 */
/**
 * S5 release test for WI-61 (spec stabilize-and-cleanup, section 3.4, Phase 8):
 * the smoke baseline catches unintended changes, and its Web3Forms guard holds.
 *
 * Each case makes a scratch `git worktree` of `HEAD` in the OS temp directory,
 * applies one change, then runs `yarn install --immutable`, `yarn build` and
 * `yarn test:smoke --reporter=json` there, and reads the Playwright JSON report:
 *
 * - AC-90: an extra, uncommitted spec submits a valid form without a Web3Forms mock.
 *   That test fails on the guard, no real Web3Forms response arrives, and every
 *   other test passes.
 * - AC-28 (spec bootstrap-6-upgrade, re-aiming sprint 1's AC-91): the four sidebar-switch
 *   queries in src/css/style.css, `(width < 1280px)` and `(width >= 1280px)`, move to
 *   `1200px`. The `Layout` test fails.
 * - AC-29 (re-aiming sprint 1's AC-92): `data-bs-toggle="dialog"` on `.contact-modal-btn`
 *   goes back to the Bootstrap 5 value `"modal"`. The `Dialog open` test fails.
 *
 * In AC-28 and AC-29 the target test must fail on its own `expect`, and the `Grid`
 * test, which neither change can touch, must pass in the same run.
 *
 * Every child runs with `process.env` minus every `JEST_*` variable (as WI-7 does),
 * so Playwright loads the tests. The smoke server uses port 4173, so the cases run
 * one after the other, which Jest does within a file. The scratch worktree is
 * removed after each case, also when it fails.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The commands each case runs in its worktree. Constant strings, so the shell sees no input. */
const INSTALL_COMMAND = 'yarn install --immutable';
const BUILD_COMMAND = 'yarn build';
/** Playwright writes the JSON reporter's output to this file instead of stdout. */
const JSON_OUTPUT_VARIABLE = 'PLAYWRIGHT_JSON_OUTPUT_FILE';

/** Jest's own variables; with `JEST_WORKER_ID` set, Playwright refuses to load tests (WI-7). */
const JEST_VARIABLE_PREFIX = 'JEST_';

const INSTALL_TIMEOUT_MS = 15 * 60 * 1000;
const BUILD_TIMEOUT_MS = 10 * 60 * 1000;
const SMOKE_TIMEOUT_MS = 15 * 60 * 1000;
const GIT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Playwright's own budget for the smoke run, below `SMOKE_TIMEOUT_MS`, so Playwright
 * stops its web server and browsers itself before `spawnSync` kills the shell and
 * leaves them running with the scratch folder as their working directory.
 */
const SMOKE_GLOBAL_TIMEOUT_MS = SMOKE_TIMEOUT_MS - 2 * 60 * 1000;
const SMOKE_COMMAND = `yarn test:smoke --reporter=json --global-timeout=${SMOKE_GLOBAL_TIMEOUT_MS}`;
const CASE_TIMEOUT_MS = INSTALL_TIMEOUT_MS + BUILD_TIMEOUT_MS + SMOKE_TIMEOUT_MS + GIT_TIMEOUT_MS;

/** How much of a failed step's output a failure message shows. */
const OUTPUT_TAIL_CHARS = 6000;

/** AC-28: the stylesheet, and each sidebar-switch query with the form it changes to. */
const STYLESHEET = path.join('src', 'css', 'style.css');
const BREAKPOINT_CHANGES = Object.freeze([
  { query: '(width < 1280px)', changed: '(width < 1200px)' },
  { query: '(width >= 1280px)', changed: '(width >= 1200px)' },
]);
const BREAKPOINT_QUERY_COUNT = 4;

/** AC-29: the page, the contact button's opening tag, and the toggle change. */
const PAGE = path.join('src', 'index.html');
const CONTACT_BUTTON_TAG = /<[a-z]+\b[^>]*\bclass="[^"]*\bcontact-modal-btn\b[^"]*"[^>]*>/g;
const DIALOG_TOGGLE = 'data-bs-toggle="dialog"';
const CHANGED_DIALOG_TOGGLE = 'data-bs-toggle="modal"';

/** AC-90: the uncommitted spec, its test's title, and the log it attaches. */
const UNMOCKED_SPEC_FILE = 'zz-unmocked-submit.spec.js';
const UNMOCKED_TEST_TITLE = 'Unmocked submit: a valid form is sent without a Web3Forms mock';
const WEB3FORMS_LOG_ATTACHMENT = 'web3forms-request-log';

/**
 * Every Playwright `expect` failure message names its matcher as `expect(...)`, so
 * this marks a test that failed on its own assertion rather than on a browser or
 * server error.
 */
const ASSERTION_FAILURE_MARKER = 'expect(';

/**
 * A test that neither change can touch: it measures the Services grid at 1023 and
 * 1024 px, below both the old and the changed breakpoint, and never opens the dialog.
 * It passing in the same run shows that the browser and the server worked.
 */
const CONTROL_TEST = 'Grid:';

/** The start of the message the fixtures.js guard fails a test with. */
const GUARD_MESSAGE = 'Web3Forms requests the test did not mock';

/**
 * The AC-90 spec. It registers no route of its own, so the guard's `abort()` is the
 * only route handler for Web3Forms. Any `response` event for that host is therefore a
 * real response from the network. The test attaches every Web3Forms response and
 * failed request it saw, whatever happens in its body.
 */
const UNMOCKED_SPEC = `import { test } from './fixtures.js';
import { desktop } from './viewports.js';
import { fillContactForm, openContactModal } from './helpers/contact-modal.js';

const WEB3FORMS_HOST = 'api.web3forms.com';
const isWeb3Forms = (url) => new URL(url).hostname === WEB3FORMS_HOST;

test.use(desktop);

test(${JSON.stringify(UNMOCKED_TEST_TITLE)}, async ({ page, context }, testInfo) => {
  const log = { responses: [], failedRequests: [] };
  context.on('response', (response) => {
    if (isWeb3Forms(response.url())) {
      log.responses.push(\`\${response.status()} \${response.url()}\`);
    }
  });
  context.on('requestfailed', (request) => {
    if (isWeb3Forms(request.url())) {
      log.failedRequests.push(\`\${request.method()} \${request.url()} \${request.failure()?.errorText}\`);
    }
  });

  try {
    await page.goto('/');
    await openContactModal(page);
    await fillContactForm(page);
    const requested = page.waitForRequest((request) => isWeb3Forms(request.url()));
    await page.locator('#submit-btn').click();
    const request = await requested;
    await request.response().catch(() => null);
  } finally {
    await testInfo.attach(${JSON.stringify(WEB3FORMS_LOG_ATTACHMENT)}, {
      body: JSON.stringify(log),
      contentType: 'application/json',
    });
  }
});
`;

/**
 * The children's environment: this process's environment minus every `JEST_*`
 * variable, without color codes and without a Corepack download prompt.
 *
 * @returns {NodeJS.ProcessEnv} The environment for each child process.
 */
function childEnvironment() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith(JEST_VARIABLE_PREFIX))
  );
  return { ...env, FORCE_COLOR: '0', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
}

/**
 * Formats how a child process ended, with the tail of its output.
 *
 * @param {string} label What ran.
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The description.
 */
function describeRun(label, run) {
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trimEnd();
  const tail = output ? output.slice(-OUTPUT_TAIL_CHARS) : '(empty)';
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return (
    `"${label}": exit ${run.status}, signal ${run.signal}${spawnError}\n` +
    `Output (last ${OUTPUT_TAIL_CHARS} characters):\n${tail}`
  );
}

/**
 * Runs `git` with `args` in the repo and throws a harness error unless it exits 0.
 *
 * @param {string[]} args The git arguments.
 * @returns {string} The command's stdout.
 */
function git(args) {
  const run = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (run.error || run.status !== 0) {
    throw new Error(`Harness error: ${describeRun(`git ${args.join(' ')}`, run)}`);
  }
  return run.stdout;
}

/**
 * Runs a constant command line through the shell in `cwd`, with the child environment.
 *
 * @param {string} command The command line.
 * @param {string} cwd Where it runs.
 * @param {number} timeout Upper bound in milliseconds.
 * @param {NodeJS.ProcessEnv} [extraEnv] Variables added to the child environment.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runCommand(command, cwd, timeout, extraEnv = {}) {
  return spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout,
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    env: { ...childEnvironment(), ...extraEnv },
  });
}

/**
 * Runs a setup command and throws a harness error unless it exits 0.
 *
 * @param {string} command The command line.
 * @param {string} cwd Where it runs.
 * @param {number} timeout Upper bound in milliseconds.
 */
function runSetupStep(command, cwd, timeout) {
  const run = runCommand(command, cwd, timeout);
  if (run.error || run.status !== 0) {
    throw new Error(`Harness error: ${describeRun(command, run)}`);
  }
}

/**
 * Collects every test in a Playwright JSON report, with its file, its full title
 * and the status, errors and attachments of its last result.
 *
 * @param {object} report The parsed JSON report.
 * @returns {Array<{ file: string, title: string, status: string, errors: string[],
 *   attachments: Array<{ name: string, body?: string }> }>} The tests.
 */
function collectTests(report) {
  const tests = [];
  const walk = (suite, titlePath) => {
    const suitePath =
      suite.title && !suite.title.endsWith('.js') ? [...titlePath, suite.title] : titlePath;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const last = (test.results ?? []).at(-1) ?? {};
        tests.push({
          file: spec.file,
          title: [...suitePath, spec.title].join(' › '),
          status: last.status ?? 'not run',
          errors: (last.errors ?? []).map((error) => error.message ?? ''),
          attachments: last.attachments ?? [],
        });
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child, suitePath);
    }
  };
  for (const suite of report.suites ?? []) {
    walk(suite, []);
  }
  return tests;
}

/**
 * Makes the worktree, lets `change` edit it, builds it, runs the smoke command
 * there and returns the report's tests. Throws on the first step that fails.
 *
 * @param {(worktree: string) => void} change Applies the case's change in the worktree.
 * @param {string} worktree Where the scratch worktree goes.
 * @param {string} reportFile Where Playwright writes the JSON report.
 * @returns {ReturnType<typeof collectTests>} The tests in the smoke run's JSON report.
 */
function buildAndRunSmoke(change, worktree, reportFile) {
  git(['worktree', 'add', '--detach', worktree, 'HEAD']);
  change(worktree);
  runSetupStep(INSTALL_COMMAND, worktree, INSTALL_TIMEOUT_MS);
  runSetupStep(BUILD_COMMAND, worktree, BUILD_TIMEOUT_MS);

  const smoke = runCommand(SMOKE_COMMAND, worktree, SMOKE_TIMEOUT_MS, {
    [JSON_OUTPUT_VARIABLE]: reportFile,
  });
  if (smoke.error || (smoke.status !== 0 && smoke.status !== 1) || !fs.existsSync(reportFile)) {
    throw new Error(`Harness error: no JSON report. ${describeRun(SMOKE_COMMAND, smoke)}`);
  }
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const globalErrors = (report.errors ?? []).map((error) => error.message ?? '');
  if (globalErrors.length > 0) {
    throw new Error(
      `Harness error: the smoke run reported errors outside tests:\n${globalErrors.join('\n')}`
    );
  }
  return collectTests(report);
}

/**
 * Runs one case in a scratch worktree of `HEAD` in the OS temp directory, and
 * removes the worktree afterwards, also when a step fails. A cleanup failure is
 * thrown too, carrying the case's own failure when there was one.
 *
 * @param {(worktree: string) => void} change Applies the case's change in the worktree.
 * @returns {ReturnType<typeof collectTests>} The tests in the smoke run's JSON report.
 */
function runSmokeWithChange(change) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-sensitivity-'));
  const worktree = path.join(scratch, 'worktree');
  let tests = [];
  let failure = null;
  try {
    tests = buildAndRunSmoke(change, worktree, path.join(scratch, 'report.json'));
  } catch (error) {
    failure = error;
  }

  const cleanupFailures = removeScratchWorktree(scratch, worktree);
  if (cleanupFailures.length > 0) {
    throw withCleanupFailures(failure, cleanupFailures);
  }
  if (failure !== null) {
    throw failure;
  }
  return tests;
}

/**
 * Runs `git` with `args` in the repo for cleanup, and describes a failure instead
 * of throwing it.
 *
 * @param {string[]} args The git arguments.
 * @returns {string | null} What went wrong, or null when it exited 0.
 */
function gitCleanupStep(args) {
  const run = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  return run.error || run.status !== 0 ? describeRun(`git ${args.join(' ')}`, run) : null;
}

/**
 * Removes the scratch worktree and its directory, then prunes git's worktree list.
 * Each step is guarded on its own, so a failing step never skips a later one, and
 * the prune always runs.
 *
 * @param {string} scratch The temp directory holding the worktree and the report.
 * @param {string} worktree The worktree's path.
 * @returns {string[]} A description of each step that failed; empty when all worked.
 */
function removeScratchWorktree(scratch, worktree) {
  const failures = [];
  const removed = gitCleanupStep(['worktree', 'remove', '--force', worktree]);
  if (removed) {
    failures.push(removed);
  }
  try {
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
  } catch (error) {
    failures.push(`Removing ${scratch}: ${error instanceof Error ? error.message : error}`);
  }
  const pruned = gitCleanupStep(['worktree', 'prune']);
  if (pruned) {
    failures.push(pruned);
  }
  return failures;
}

/**
 * Builds the one error a case throws when its cleanup failed: the case's own
 * failure, if any, with every cleanup failure appended to its message.
 *
 * @param {unknown} failure The error the case threw, or null when it succeeded.
 * @param {string[]} cleanupFailures What went wrong while cleaning up.
 * @returns {Error} The error to throw.
 */
function withCleanupFailures(failure, cleanupFailures) {
  const detail = `\n\nCleanup of the scratch worktree failed:\n${cleanupFailures.join('\n')}`;
  if (!(failure instanceof Error)) {
    const original = failure === null ? '' : `${String(failure)}\n`;
    return new Error(`${original}Harness error:${detail}`);
  }
  const original = failure.message;
  failure.message = `${original}${detail}`;
  // V8 formats `stack` lazily, so it may already carry the new message.
  if (typeof failure.stack === 'string' && !failure.stack.includes(detail)) {
    failure.stack = failure.stack.replace(original, failure.message);
  }
  return failure;
}

/**
 * Edits a file in the worktree, keeping its encoding.
 *
 * @param {string} worktree The worktree's path.
 * @param {string} file The file's path inside the worktree.
 * @param {(text: string) => string} edit Returns the new text.
 */
function editFile(worktree, file, edit) {
  const fullPath = path.join(worktree, file);
  fs.writeFileSync(fullPath, edit(fs.readFileSync(fullPath, 'utf8')), 'utf8');
}

/**
 * Finds the tests whose title contains `text`.
 *
 * @param {ReturnType<typeof collectTests>} tests The report's tests.
 * @param {string} text The text to look for.
 * @returns {Array<{ title: string, status: string, failedOnAssertion: boolean }>} Each
 *   match's title, status, and whether one of its errors is an `expect` failure.
 */
function testsTitled(tests, text) {
  return tests
    .filter((test) => test.title.includes(text))
    .map(({ title, status, errors }) => ({
      title,
      status,
      failedOnAssertion: errors.some((message) => message.includes(ASSERTION_FAILURE_MARKER)),
    }));
}

/**
 * Asserts that exactly one test's title contains `target` and that it failed on its
 * own assertion, and that the control test passed in the same run, so a run in which
 * every test failed (a browser launch or server error) cannot pass.
 *
 * @param {ReturnType<typeof collectTests>} tests The report's tests.
 * @param {string} target The text in the title of the test the change must fail.
 */
function expectOnlyTargetBroken(tests, target) {
  const matches = testsTitled(tests, target);
  expect(matches).toHaveLength(1);
  expect(matches[0]).toMatchObject({ status: 'failed', failedOnAssertion: true });

  const control = testsTitled(tests, CONTROL_TEST);
  expect(control).toHaveLength(1);
  expect(control[0].status).toBe('passed');
}

/**
 * Reads the AC-90 spec's Web3Forms log from its attachment.
 *
 * @param {ReturnType<typeof collectTests>[number]} test The AC-90 test.
 * @returns {{ responses: string[], failedRequests: string[] } | null} The log, or null.
 */
function readWeb3FormsLog(test) {
  const attachment = test.attachments.find((item) => item.name === WEB3FORMS_LOG_ATTACHMENT);
  if (!attachment || typeof attachment.body !== 'string') {
    return null;
  }
  return JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
}

describe('WI-61: the smoke baseline catches unintended changes', () => {
  test(
    'AC-90: an unmocked Web3Forms submit fails on the guard, gets no real response, and every other test passes',
    () => {
      const tests = runSmokeWithChange((worktree) => {
        fs.writeFileSync(
          path.join(worktree, 'tests', 'e2e', UNMOCKED_SPEC_FILE),
          UNMOCKED_SPEC,
          'utf8'
        );
      });

      const unmocked = tests.filter((test) => test.file === UNMOCKED_SPEC_FILE);
      expect(unmocked.map(({ title, status }) => ({ title, status }))).toEqual([
        { title: UNMOCKED_TEST_TITLE, status: 'failed' },
      ]);
      expect(unmocked[0].errors.some((message) => message.includes(GUARD_MESSAGE))).toBe(true);

      const log = readWeb3FormsLog(unmocked[0]);
      expect(log).not.toBeNull();
      expect(log.responses).toEqual([]);
      expect(log.failedRequests.length).toBeGreaterThanOrEqual(1);

      const others = tests.filter((test) => test.file !== UNMOCKED_SPEC_FILE);
      expect(others.length).toBeGreaterThan(0);
      expect(
        others
          .filter((test) => test.status !== 'passed')
          .map(({ title, status }) => ({ title, status }))
      ).toEqual([]);
    },
    CASE_TIMEOUT_MS
  );

  test(
    'AC-28: moving the four 1280px sidebar-switch queries to 1200px fails the Layout test',
    () => {
      const tests = runSmokeWithChange((worktree) => {
        editFile(worktree, STYLESHEET, (text) => {
          const occurrences = BREAKPOINT_CHANGES.reduce(
            (total, { query }) => total + text.split(query).length - 1,
            0
          );
          expect(occurrences).toBe(BREAKPOINT_QUERY_COUNT);
          return BREAKPOINT_CHANGES.reduce(
            (changedText, { query, changed }) => changedText.split(query).join(changed),
            text
          );
        });
      });

      expectOnlyTargetBroken(tests, 'Layout');
    },
    CASE_TIMEOUT_MS
  );

  test(
    'AC-29: changing the contact button toggle from dialog back to modal fails the Dialog open test',
    () => {
      const tests = runSmokeWithChange((worktree) => {
        editFile(worktree, PAGE, (text) => {
          const tags = text.match(CONTACT_BUTTON_TAG) ?? [];
          expect(tags).toHaveLength(1);
          expect(tags[0].split(DIALOG_TOGGLE).length - 1).toBe(1);
          return text.replace(tags[0], tags[0].replace(DIALOG_TOGGLE, CHANGED_DIALOG_TOGGLE));
        });
      });

      expectOnlyTargetBroken(tests, 'Dialog open');
    },
    CASE_TIMEOUT_MS
  );
});
