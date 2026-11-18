/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-4 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-11
 * and 3.7 chain D): every `run:` step of the ci.yml `test` job exits 0 in a plain
 * `node:<major>-bookworm` container where `command -v corepack` fails before any step.
 *
 * The SHA under test is the host's `git rev-parse HEAD`, which must be pushed. The
 * container gets no bind mount of the repo: it clones origin and checks that SHA out,
 * as WI-5 does, so the test works from a linked worktree. The image major and the
 * steps come from the commit under test (`git show <SHA>:<path>`), never from the
 * working tree. The container environment is exactly the job's `env`.
 *
 * Every failure is an `expect` whose received value names the cause.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const YAML = require('yaml');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The repository the container clones (WI-5). */
const CLONE_URL = 'https://github.com/ValhallaTech/PortfolioPage-FS3.git';

/** The workflow whose `test` job steps AC-4 runs. */
const CI_WORKFLOW = '.github/workflows/ci.yml';

/** Upper bound for `git fetch origin` and the other host git calls. */
const GIT_TIMEOUT_MS = 120_000;

/** Upper bound for the whole container run; below the suite's testTimeout. */
const CONTAINER_TIMEOUT_MS = 50 * 60 * 1000;

/** Upper bound for removing the container after a timeout. */
const DOCKER_RM_TIMEOUT_MS = 60_000;

/** How much of the container's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

/** Prefix of the driver's marker lines on stdout. */
const MARKER = 'AC4 ';

/**
 * The fixed bash driver run in the container. Its positional parameters are the
 * SHA, the clone URL and then each step's `run:` value. Step output goes to stderr,
 * so stdout holds only marker lines.
 */
const DRIVER = [
  'ac4_sha="$1"; ac4_url="$2"; shift 2',
  'if ac4_found="$(command -v corepack)"; then',
  '  printf \'AC4 GIVEN present %s\\n\' "$ac4_found"',
  '  exit 0',
  'fi',
  "printf 'AC4 GIVEN absent\\n'",
  "printf 'AC4 PHASE clone\\n'",
  'git clone --quiet "$ac4_url" /work 1>&2',
  'ac4_code=$?; printf \'AC4 CLONE %s\\n\' "$ac4_code"',
  '[ "$ac4_code" -eq 0 ] || exit 0',
  'git -C /work -c advice.detachedHead=false checkout --quiet --detach "$ac4_sha" 1>&2',
  'ac4_code=$?; printf \'AC4 CHECKOUT %s\\n\' "$ac4_code"',
  '[ "$ac4_code" -eq 0 ] || exit 0',
  'cd /work || exit 0',
  'ac4_i=0',
  'for ac4_step in "$@"; do',
  '  printf \'AC4 BEGIN %s\\n\' "$ac4_i"',
  '  bash -e -c "$ac4_step" 1>&2 </dev/null',
  '  printf \'AC4 END %s %s\\n\' "$ac4_i" "$?"',
  '  ac4_i=$((ac4_i + 1))',
  'done',
  "printf 'AC4 DONE\\n'",
].join('\n');

/**
 * Returns the process environment without any `JEST_*` variable (spec rule for
 * every child a Jest test starts).
 *
 * @returns {NodeJS.ProcessEnv} The child environment.
 */
function childEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('JEST_'))
  );
}

/**
 * Runs a host command with an argument array.
 *
 * @param {string} command The executable.
 * @param {string[]} args Its arguments.
 * @param {number} timeout Upper bound in milliseconds.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runHost(command, args, timeout) {
  return spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(),
    maxBuffer: 64 * 1024 * 1024,
    timeout,
    windowsHide: true,
  });
}

/**
 * Describes how a host command failed.
 *
 * @param {string} label The command as shown in messages.
 * @param {import('node:child_process').SpawnSyncReturns<string>} result The finished process.
 * @returns {string | null} The problem, or null when it exited 0.
 */
function hostFailure(label, result) {
  if (!result.error && result.status === 0) {
    return null;
  }
  const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
  return `${label} failed (exit ${result.status}, signal ${result.signal}): ${reason}`;
}

/**
 * Resolves the SHA under test and checks that it is pushed: after `git fetch origin`,
 * `git branch -r --contains <SHA>` must print at least one line.
 *
 * @returns {{ sha: string | null, problem: string | null }} The SHA, or the problem.
 */
function resolvePushedSha() {
  const head = runHost('git', ['rev-parse', 'HEAD'], GIT_TIMEOUT_MS);
  const headProblem = hostFailure('git rev-parse HEAD', head);
  if (headProblem) {
    return { sha: null, problem: `AC-4: ${headProblem}` };
  }
  const sha = head.stdout.trim().toLowerCase();
  const fetchProblem = hostFailure(
    'git fetch origin',
    runHost('git', ['fetch', 'origin'], GIT_TIMEOUT_MS)
  );
  if (fetchProblem) {
    return { sha: null, problem: `AC-4: ${fetchProblem}` };
  }
  const contains = runHost('git', ['branch', '-r', '--contains', sha], GIT_TIMEOUT_MS);
  const containsProblem = hostFailure(`git branch -r --contains ${sha}`, contains);
  if (containsProblem) {
    return { sha: null, problem: `AC-4: ${containsProblem}` };
  }
  if (contains.stdout.trim() === '') {
    return {
      sha: null,
      problem:
        `AC-4: HEAD ${sha} is not pushed: after git fetch origin, git branch -r --contains ` +
        `${sha} printed nothing. The container clones origin, so push the commit and run again.`,
    };
  }
  return { sha, problem: null };
}

/**
 * Reads a file from the commit under test.
 *
 * @param {string} sha The commit.
 * @param {string} file Path relative to the repo root.
 * @returns {{ text: string | null, problem: string | null }} The text, or the problem.
 */
function showFile(sha, file) {
  const result = runHost('git', ['show', `${sha}:${file}`], GIT_TIMEOUT_MS);
  const problem = hostFailure(`git show ${sha}:${file}`, result);
  return problem ? { text: null, problem: `AC-4: ${problem}` } : { text: result.stdout, problem };
}

/**
 * Reads the image major and the `test` job's steps and env from the commit under test.
 *
 * @param {string} sha The commit.
 * @returns {{ major: number | null, steps: Array<{ name: string, run: string }>,
 *   env: Array<[string, string]>, problem: string | null }} The inputs, or the problem.
 */
function readInputs(sha) {
  const empty = { major: null, steps: [], env: [] };
  const nvmrc = showFile(sha, '.nvmrc');
  if (nvmrc.problem) {
    return { ...empty, problem: nvmrc.problem };
  }
  const line = nvmrc.text.split(/\r?\n/)[0].trim();
  const majorMatch = /^v?(\d+)/i.exec(line);
  if (!majorMatch) {
    return { ...empty, problem: `AC-4: .nvmrc line 1 "${line}" at ${sha} has no major version` };
  }
  const workflowFile = showFile(sha, CI_WORKFLOW);
  if (workflowFile.problem) {
    return { ...empty, problem: workflowFile.problem };
  }
  let workflow;
  try {
    workflow = YAML.parse(workflowFile.text);
  } catch (error) {
    return {
      ...empty,
      problem: `AC-4: ${CI_WORKFLOW} at ${sha} is not valid YAML (${error.message})`,
    };
  }
  const job = workflow?.jobs?.test;
  if (!job || !Array.isArray(job.steps)) {
    return { ...empty, problem: `AC-4: ${CI_WORKFLOW} at ${sha} has no jobs.test.steps list` };
  }
  const steps = job.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => typeof step?.run === 'string')
    .map(({ step, index }) => ({ name: String(step.name ?? `step ${index + 1}`), run: step.run }));
  if (steps.length === 0) {
    return { ...empty, problem: `AC-4: ${CI_WORKFLOW} at ${sha} jobs.test has no run: step` };
  }
  const env = Object.entries(job.env && typeof job.env === 'object' ? job.env : {}).map(
    ([name, value]) => [name, value === null ? '' : String(value)]
  );
  return { major: Number(majorMatch[1]), steps, env, problem: null };
}

/**
 * Parses the driver's marker lines.
 *
 * @param {string} stdout The container's stdout.
 * @returns {{ given: string | null, phase: string | null, clone: number | null,
 *   checkout: number | null, begun: number | null, exits: Map<number, number>,
 *   done: boolean }} What the driver reported.
 */
function parseMarkers(stdout) {
  const markers = {
    given: null,
    phase: null,
    clone: null,
    checkout: null,
    begun: null,
    exits: new Map(),
    done: false,
  };
  for (const line of (stdout ?? '').split(/\r?\n/)) {
    if (!line.startsWith(MARKER)) {
      continue;
    }
    const [kind, ...rest] = line.slice(MARKER.length).split(' ');
    if (kind === 'GIVEN') {
      markers.given = rest.join(' ');
    } else if (kind === 'PHASE') {
      markers.phase = rest.join(' ');
    } else if (kind === 'CLONE') {
      markers.clone = Number(rest[0]);
    } else if (kind === 'CHECKOUT') {
      markers.checkout = Number(rest[0]);
    } else if (kind === 'BEGIN') {
      markers.begun = Number(rest[0]);
    } else if (kind === 'END') {
      markers.exits.set(Number(rest[0]), Number(rest[1]));
    } else if (kind === 'DONE') {
      markers.done = true;
    }
  }
  return markers;
}

/**
 * Returns the tail of the container's stderr for failure messages.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The tail.
 */
function stderrTail(run) {
  const stderr = (run.stderr ?? '').trimEnd();
  return stderr ? stderr.slice(-STDERR_TAIL_CHARS) : '(empty)';
}

/**
 * Names where the driver was when the run stopped.
 *
 * @param {ReturnType<typeof parseMarkers>} markers What the driver reported.
 * @param {Array<{ name: string, run: string }>} steps The steps.
 * @returns {string} The step or phase.
 */
function currentStep(markers, steps) {
  if (markers.begun !== null && !markers.exits.has(markers.begun)) {
    const step = steps[markers.begun];
    return `step "${step?.name}" (${JSON.stringify(step?.run)})`;
  }
  if (markers.phase === 'clone' && markers.checkout === null) {
    return 'the fresh clone and checkout';
  }
  return markers.given === null ? 'the image pull or container start' : 'between steps';
}

describe('Test & Build steps on Linux without Corepack (S5, chain D)', () => {
  it('AC-4: every ci.yml jobs.test run: step exits 0 in node:<major>-bookworm with no corepack', () => {
    const pushed = resolvePushedSha();
    expect(pushed.problem).toBeNull();

    const inputs = readInputs(pushed.sha);
    expect(inputs.problem).toBeNull();

    const image = `node:${inputs.major}-bookworm`;
    const name = `portfolio-ac4-${process.pid}-${Date.now()}`;
    const envArgs = inputs.env.flatMap(([key, value]) => ['-e', `${key}=${value}`]);
    const run = runHost(
      'docker',
      [
        'run',
        '--rm',
        '--name',
        name,
        ...envArgs,
        image,
        'bash',
        '-c',
        DRIVER,
        'ac4-driver',
        pushed.sha,
        CLONE_URL,
        ...inputs.steps.map((step) => step.run),
      ],
      CONTAINER_TIMEOUT_MS
    );
    const markers = parseMarkers(run.stdout);
    let runProblem = null;
    if (run.error) {
      const timedOut = run.error.code === 'ETIMEDOUT';
      const removed = timedOut ? runHost('docker', ['rm', '-f', name], DOCKER_RM_TIMEOUT_MS) : null;
      runProblem = timedOut
        ? `AC-4: docker run ${image} timed out after ${CONTAINER_TIMEOUT_MS / 60000} minutes ` +
          `during ${currentStep(markers, inputs.steps)}; docker rm -f ${name} exited ` +
          `${removed.status}. Container stderr tail:\n${stderrTail(run)}`
        : `AC-4: docker run ${image} could not start: ${run.error.message}`;
    } else if (run.status !== 0 || markers.given === null) {
      runProblem =
        `AC-4: docker run ${image} exited ${run.status} during ` +
        `${currentStep(markers, inputs.steps)}. Container stderr tail:\n${stderrTail(run)}`;
    }
    expect(runProblem).toBeNull();

    expect(
      markers.given === 'absent'
        ? null
        : `AC-4: command -v corepack found ${markers.given.replace(/^present /, '')} in ${image} before any step`
    ).toBeNull();

    let cloneProblem = null;
    if (markers.clone !== 0 || markers.checkout !== 0) {
      cloneProblem =
        `AC-4: fresh clone of ${CLONE_URL} at ${pushed.sha} failed (git clone exit ` +
        `${markers.clone}, git checkout exit ${markers.checkout}). Container stderr tail:\n` +
        stderrTail(run);
    } else if (!markers.done) {
      cloneProblem =
        `AC-4: the driver stopped during ${currentStep(markers, inputs.steps)}. ` +
        `Container stderr tail:\n${stderrTail(run)}`;
    }
    expect(cloneProblem).toBeNull();

    const results = inputs.steps.map((step, index) => ({
      step: step.name,
      run: step.run,
      exit: markers.exits.has(index) ? markers.exits.get(index) : 'not run',
    }));
    const failed = results.filter((result) => result.exit !== 0);
    expect(
      failed.length === 0
        ? null
        : `AC-4: in ${image} with the job env only, these ci.yml jobs.test steps did not exit 0 ` +
            `(first: "${failed[0].step}"):\n` +
            `${failed.map((result) => `  "${result.step}" (${JSON.stringify(result.run)}): exit ${result.exit}`).join('\n')}\n` +
            `Container stderr tail:\n${stderrTail(run)}`
    ).toBeNull();
  });
});
