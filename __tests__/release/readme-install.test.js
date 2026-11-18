/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-9 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-11
 * and 3.7 chain D): the README Install commands install the pinned Yarn in a
 * `node:<major>-bookworm` container that has neither Corepack nor a global Yarn.
 *
 * The SHA under test is the host's `git rev-parse HEAD`, which must be pushed. The
 * container gets no bind mount of the repo: it clones origin and checks that SHA out,
 * as WI-5 does. It then runs `npm uninstall -g corepack yarn` and removes the image's
 * own Yarn 1 links (`/usr/local/bin/yarn` and `yarnpkg` when they are symlinks into
 * `/opt/yarn-v*`, WI-5's rule), and asserts that `command -v corepack` and
 * `command -v yarn` both fail. Only then does it run the commands of the fenced blocks
 * under `## Install`, in order, skipping `nvm use` and `fnm use` lines. The image
 * major, README.md and package.json come from the commit under test. The container
 * gets no environment beyond the image's own.
 *
 * Every failure is an `expect` whose received value names the cause.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The repository the container clones (WI-5). */
const CLONE_URL = 'https://github.com/ValhallaTech/PortfolioPage-FS3.git';

/** Upper bound for `git fetch origin` and the other host git calls. */
const GIT_TIMEOUT_MS = 120_000;

/** Upper bound for the whole container run; below the suite's testTimeout. */
const CONTAINER_TIMEOUT_MS = 50 * 60 * 1000;

/** Upper bound for removing the container after a timeout. */
const DOCKER_RM_TIMEOUT_MS = 60_000;

/** How much of the container's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

/** Prefix of the driver's marker lines on stdout. */
const MARKER = 'AC9 ';

/** Version-manager switch lines AC-9 skips. */
const VERSION_SWITCH = /^(nvm|fnm)\s+use(\s|$)/;

/**
 * The fixed bash driver run in the container. Its positional parameters are the
 * SHA, the clone URL and then each README command. Command output goes to stderr,
 * so stdout holds only marker lines. The commands run with `eval` in one shell, in
 * order, so a `cd` or an `export` carries to the next command.
 */
const DRIVER = [
  'ac9_sha="$1"; ac9_url="$2"; shift 2',
  "printf 'AC9 PHASE clone\\n'",
  'git clone --quiet "$ac9_url" /work 1>&2',
  'ac9_code=$?; printf \'AC9 CLONE %s\\n\' "$ac9_code"',
  '[ "$ac9_code" -eq 0 ] || exit 0',
  'git -C /work -c advice.detachedHead=false checkout --quiet --detach "$ac9_sha" 1>&2',
  'ac9_code=$?; printf \'AC9 CHECKOUT %s\\n\' "$ac9_code"',
  '[ "$ac9_code" -eq 0 ] || exit 0',
  "printf 'AC9 PHASE uninstall\\n'",
  'npm uninstall -g corepack yarn 1>&2',
  'printf \'AC9 UNINSTALL %s\\n\' "$?"',
  'for ac9_link in /usr/local/bin/yarn /usr/local/bin/yarnpkg; do',
  '  if [ -L "$ac9_link" ]; then',
  '    ac9_target="$(readlink "$ac9_link")"',
  '    case "$ac9_target" in',
  '      /opt/yarn-v*)',
  '        rm -f "$ac9_link"',
  '        printf \'removed image Yarn 1 link %s -> %s\\n\' "$ac9_link" "$ac9_target" 1>&2',
  '        ;;',
  '    esac',
  '  fi',
  'done',
  'hash -r',
  'printf \'AC9 GIVEN corepack %s\\n\' "$(command -v corepack || printf -)"',
  'printf \'AC9 GIVEN yarn %s\\n\' "$(command -v yarn || printf -)"',
  'if command -v corepack >/dev/null 2>&1 || command -v yarn >/dev/null 2>&1; then exit 0; fi',
  'cd /work || exit 0',
  'ac9_i=0',
  'for ac9_command in "$@"; do',
  '  printf \'AC9 BEGIN %s\\n\' "$ac9_i"',
  '  eval "$ac9_command" 1>&2 </dev/null',
  '  printf \'AC9 END %s %s\\n\' "$ac9_i" "$?"',
  '  ac9_i=$((ac9_i + 1))',
  'done',
  "printf 'AC9 PHASE version\\n'",
  'ac9_version="$(yarn --version </dev/null)"',
  'ac9_code=$?; printf \'AC9 VERSION %s %s\\n\' "$ac9_code" "$ac9_version"',
  "printf 'AC9 DONE\\n'",
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
    return { sha: null, problem: `AC-9: ${headProblem}` };
  }
  const sha = head.stdout.trim().toLowerCase();
  const fetchProblem = hostFailure(
    'git fetch origin',
    runHost('git', ['fetch', 'origin'], GIT_TIMEOUT_MS)
  );
  if (fetchProblem) {
    return { sha: null, problem: `AC-9: ${fetchProblem}` };
  }
  const contains = runHost('git', ['branch', '-r', '--contains', sha], GIT_TIMEOUT_MS);
  const containsProblem = hostFailure(`git branch -r --contains ${sha}`, contains);
  if (containsProblem) {
    return { sha: null, problem: `AC-9: ${containsProblem}` };
  }
  if (contains.stdout.trim() === '') {
    return {
      sha: null,
      problem:
        `AC-9: HEAD ${sha} is not pushed: after git fetch origin, git branch -r --contains ` +
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
  return problem ? { text: null, problem: `AC-9: ${problem}` } : { text: result.stdout, problem };
}

/**
 * Extracts the commands of the fenced blocks under the README's `## Install`
 * heading, in order. Blank lines, comment lines and `nvm use` or `fnm use` lines
 * are left out; a line ending in a backslash joins the next one.
 *
 * @param {string} readme The README text.
 * @returns {{ commands: string[], problem: string | null }} The commands, or the problem.
 */
function installCommands(readme) {
  const lines = readme.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Install\s*$/.test(line));
  if (start === -1) {
    return { commands: [], problem: 'AC-9: README.md has no "## Install" section' };
  }
  const commands = [];
  let fence = null;
  let pending = '';
  for (const line of lines.slice(start + 1)) {
    if (fence === null && /^#{1,2}\s/.test(line)) {
      break;
    }
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence === null) {
      fence = fenceMatch ? fenceMatch[1] : null;
      continue;
    }
    if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
      fence = null;
      continue;
    }
    const text = pending + line.trim();
    if (text.endsWith('\\')) {
      pending = `${text.slice(0, -1)} `;
      continue;
    }
    pending = '';
    if (text !== '' && !text.startsWith('#') && !VERSION_SWITCH.test(text)) {
      commands.push(text);
    }
  }
  return commands.length > 0
    ? { commands, problem: null }
    : { commands, problem: 'AC-9: the README.md "## Install" fenced blocks hold no command' };
}

/**
 * Reads the image major, the README Install commands and the `packageManager`
 * Yarn version from the commit under test.
 *
 * @param {string} sha The commit.
 * @returns {{ major: number | null, commands: string[], yarnVersion: string | null,
 *   problem: string | null }} The inputs, or the problem.
 */
function readInputs(sha) {
  const empty = { major: null, commands: [], yarnVersion: null };
  const nvmrc = showFile(sha, '.nvmrc');
  if (nvmrc.problem) {
    return { ...empty, problem: nvmrc.problem };
  }
  const line = nvmrc.text.split(/\r?\n/)[0].trim();
  const majorMatch = /^v?(\d+)/i.exec(line);
  if (!majorMatch) {
    return { ...empty, problem: `AC-9: .nvmrc line 1 "${line}" at ${sha} has no major version` };
  }
  const readme = showFile(sha, 'README.md');
  if (readme.problem) {
    return { ...empty, problem: readme.problem };
  }
  const install = installCommands(readme.text);
  if (install.problem) {
    return { ...empty, problem: install.problem };
  }
  const manifestFile = showFile(sha, 'package.json');
  if (manifestFile.problem) {
    return { ...empty, problem: manifestFile.problem };
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestFile.text);
  } catch (error) {
    return {
      ...empty,
      problem: `AC-9: package.json at ${sha} is not valid JSON (${error.message})`,
    };
  }
  const yarnMatch = /^yarn@([^+\s]+)/.exec(String(manifest.packageManager ?? ''));
  if (!yarnMatch) {
    return {
      ...empty,
      problem: `AC-9: package.json packageManager at ${sha} is ${JSON.stringify(manifest.packageManager)}, not yarn@<version>`,
    };
  }
  return {
    major: Number(majorMatch[1]),
    commands: install.commands,
    yarnVersion: yarnMatch[1],
    problem: null,
  };
}

/**
 * Parses the driver's marker lines.
 *
 * @param {string} stdout The container's stdout.
 * @returns {{ phase: string | null, clone: number | null, checkout: number | null,
 *   uninstall: number | null, corepack: string | null, yarn: string | null,
 *   begun: number | null, exits: Map<number, number>,
 *   version: { exit: number, version: string } | null, done: boolean }}
 *   What the driver reported.
 */
function parseMarkers(stdout) {
  const markers = {
    phase: null,
    clone: null,
    checkout: null,
    uninstall: null,
    corepack: null,
    yarn: null,
    begun: null,
    exits: new Map(),
    version: null,
    done: false,
  };
  for (const line of (stdout ?? '').split(/\r?\n/)) {
    if (!line.startsWith(MARKER)) {
      continue;
    }
    const [kind, ...rest] = line.slice(MARKER.length).split(' ');
    if (kind === 'PHASE') {
      markers.phase = rest.join(' ');
    } else if (kind === 'CLONE') {
      markers.clone = Number(rest[0]);
    } else if (kind === 'CHECKOUT') {
      markers.checkout = Number(rest[0]);
    } else if (kind === 'UNINSTALL') {
      markers.uninstall = Number(rest[0]);
    } else if (kind === 'GIVEN') {
      markers[rest[0]] = rest.slice(1).join(' ');
    } else if (kind === 'BEGIN') {
      markers.begun = Number(rest[0]);
    } else if (kind === 'END') {
      markers.exits.set(Number(rest[0]), Number(rest[1]));
    } else if (kind === 'VERSION') {
      markers.version = { exit: Number(rest[0]), version: rest.slice(1).join(' ') };
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
 * @param {string[]} commands The README commands.
 * @returns {string} The step or phase.
 */
function currentStep(markers, commands) {
  if (markers.phase === 'version') {
    return 'yarn --version';
  }
  if (markers.begun !== null && !markers.exits.has(markers.begun)) {
    return `README command ${JSON.stringify(commands[markers.begun])}`;
  }
  if (markers.phase === 'uninstall') {
    return 'npm uninstall -g corepack yarn and the image Yarn 1 link removal';
  }
  if (markers.phase === 'clone') {
    return 'the fresh clone and checkout';
  }
  return markers.phase === null ? 'the image pull or container start' : 'between commands';
}

describe('README Install without Corepack or a global Yarn (S5, chain D)', () => {
  it('AC-9: the README Install commands exit 0 and yarn --version prints the packageManager version', () => {
    const pushed = resolvePushedSha();
    expect(pushed.problem).toBeNull();

    const inputs = readInputs(pushed.sha);
    expect(inputs.problem).toBeNull();

    const image = `node:${inputs.major}-bookworm`;
    const name = `portfolio-ac9-${process.pid}-${Date.now()}`;
    const run = runHost(
      'docker',
      [
        'run',
        '--rm',
        '--name',
        name,
        image,
        'bash',
        '-c',
        DRIVER,
        'ac9-driver',
        pushed.sha,
        CLONE_URL,
        ...inputs.commands,
      ],
      CONTAINER_TIMEOUT_MS
    );
    const markers = parseMarkers(run.stdout);
    let runProblem = null;
    if (run.error) {
      const timedOut = run.error.code === 'ETIMEDOUT';
      const removed = timedOut ? runHost('docker', ['rm', '-f', name], DOCKER_RM_TIMEOUT_MS) : null;
      runProblem = timedOut
        ? `AC-9: docker run ${image} timed out after ${CONTAINER_TIMEOUT_MS / 60000} minutes ` +
          `during ${currentStep(markers, inputs.commands)}; docker rm -f ${name} exited ` +
          `${removed.status}. Container stderr tail:\n${stderrTail(run)}`
        : `AC-9: docker run ${image} could not start: ${run.error.message}`;
    } else if (run.status !== 0) {
      runProblem =
        `AC-9: docker run ${image} exited ${run.status} during ` +
        `${currentStep(markers, inputs.commands)}. Container stderr tail:\n${stderrTail(run)}`;
    } else if (markers.clone !== 0 || markers.checkout !== 0) {
      runProblem =
        `AC-9: fresh clone of ${CLONE_URL} at ${pushed.sha} failed (git clone exit ` +
        `${markers.clone}, git checkout exit ${markers.checkout}). Container stderr tail:\n` +
        stderrTail(run);
    } else if (markers.corepack === null || markers.yarn === null) {
      runProblem =
        `AC-9: the driver stopped during ${currentStep(markers, inputs.commands)}. ` +
        `Container stderr tail:\n${stderrTail(run)}`;
    }
    expect(runProblem).toBeNull();

    const present = [
      markers.corepack === '-' ? null : `command -v corepack printed ${markers.corepack}`,
      markers.yarn === '-' ? null : `command -v yarn printed ${markers.yarn}`,
    ].filter(Boolean);
    expect(
      present.length === 0
        ? null
        : `AC-9: in ${image} after npm uninstall -g corepack yarn (exit ${markers.uninstall}) ` +
            `and the image Yarn 1 link removal, ${present.join(' and ')}`
    ).toBeNull();

    expect(
      markers.done
        ? null
        : `AC-9: the driver stopped during ${currentStep(markers, inputs.commands)}. ` +
            `Container stderr tail:\n${stderrTail(run)}`
    ).toBeNull();

    const failed = inputs.commands
      .map((command, index) => ({
        command,
        exit: markers.exits.has(index) ? markers.exits.get(index) : 'not run',
      }))
      .filter((result) => result.exit !== 0);
    expect(
      failed.length === 0
        ? null
        : `AC-9: in ${image} without corepack or yarn, these README Install commands did not ` +
            `exit 0 (first: ${JSON.stringify(failed[0].command)}):\n` +
            `${failed.map((result) => `  ${JSON.stringify(result.command)}: exit ${result.exit}`).join('\n')}\n` +
            `Container stderr tail:\n${stderrTail(run)}`
    ).toBeNull();

    expect(markers.version).toEqual({ exit: 0, version: inputs.yarnVersion });
  });
});
