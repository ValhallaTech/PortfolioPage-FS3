/**
 * Linux gate container wrapper (spec stabilize-and-cleanup, D-10 and WI-5).
 *
 *   node scripts/gate-linux.mjs
 *
 * Runs `scripts/gate.mjs` inside a `node:<.nvmrc major>-bookworm` container, in
 * a fresh full clone of `origin` checked out at the pushed `HEAD`. Nothing from
 * the host's working tree is mounted, so the run works the same from the main
 * checkout and from a linked worktree, and it can only produce evidence for a
 * commit GitHub already holds.
 *
 * Host checks, all before Docker starts:
 * - the working tree is clean (evidence is per commit);
 * - after `git fetch origin`, `HEAD` equals `@{u}` (the commit is pushed);
 * - the `.nvmrc` major, the `@playwright/test` pin and the SHA, read from the
 *   commit itself, each match a strict pattern.
 *
 * Every process is spawned without a shell, with its arguments as an array.
 * The only shell is `bash` inside the container, and its script is the fixed
 * constant below: the validated values reach it as positional arguments
 * (`$1`..`$3`), never as text spliced into the script. The setup runs as root;
 * the gate itself runs as the unprivileged `node` user and cannot write to the
 * Playwright volume.
 *
 * Exit codes:
 * - the container's exit code: the gate's own exit code, or non-zero when a
 *   container step before the gate failed (clone, checkout, install);
 * - 1: a host check refused the run, or Docker could not be started.
 */
import { spawn } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { fileURLToPath } from 'node:url';

/** The only clone source: the repository GitHub holds (spec §3.4 WI-5). */
const ORIGIN_URL = 'https://github.com/ValhallaTech/PortfolioPage-FS3.git';

/** Exit code when a host check refuses the run or Docker cannot be started. */
const EXIT_REFUSED = 1;

/** File descriptor of stderr, so git's own output never mixes into stdout. */
const STDERR_FD = 2;

/** Shell convention for a process ended by a signal: 128 + the signal number. */
const SIGNAL_EXIT_BASE = 128;

/** Upper bounds for the host git calls. */
const GIT_TIMEOUT_MS = 60_000;
const GIT_FETCH_TIMEOUT_MS = 180_000;

/** A full object name: SHA-1 or SHA-256. */
const FULL_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/** `.nvmrc` content: an optional `v`, then a numeric version of one to three parts. */
const NVMRC_PATTERN = /^v?(\d{1,3})(?:\.\d{1,6}){0,2}$/;

/** An exact semver pin; it starts with a digit, so it can never read as an option. */
const EXACT_VERSION_PATTERN = /^\d{1,6}\.\d{1,6}\.\d{1,6}(?:-[0-9A-Za-z][0-9A-Za-z.-]{0,63})?$/;

/** Named volumes that keep reruns fast, and where they are mounted. */
const PLAYWRIGHT_VOLUME = 'portfolio-gate-playwright';
const PLAYWRIGHT_MOUNT = '/ms-playwright';
const YARN_VOLUME = 'portfolio-gate-yarn';
const YARN_MOUNT = '/yarn-global';

/** git never prompts for credentials or opens an editor here. */
const NON_INTERACTIVE_GIT_ENV = { GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true' };

/**
 * The fixed script run by `bash` in the container. Arguments: `$1` the commit
 * SHA, `$2` the `@playwright/test` pin, `$3` the `.nvmrc` major. Each was
 * validated on the host; they are only ever expanded inside double quotes.
 *
 * The clone, the image Yarn 1 link removal, the Corepack install and the
 * Playwright install run as root. The gate runs as the image's `node` user, so
 * no gate step (a dependency's install script, a test) can change the browsers
 * on the shared Playwright volume that every later run executes.
 */
const CONTAINER_SCRIPT = `set -euo pipefail
sha="$1"
playwright_pin="$2"
node_major="$3"

git clone -- "${ORIGIN_URL}" /work
git -C /work checkout --detach "$sha"
if [ "$(git -C /work rev-parse HEAD)" != "$sha" ]; then
  echo "gate:linux: the clone did not check out $sha" >&2
  exit 1
fi

removed_yarn1=0
for link in /usr/local/bin/yarn /usr/local/bin/yarnpkg; do
  if [ -L "$link" ]; then
    target="$(readlink -- "$link")"
    case "$target" in
      /opt/yarn-v*)
        rm -f -- "$link"
        printf 'removed image Yarn 1 link %s -> %s\\n' "$link" "$target"
        removed_yarn1=1
        ;;
    esac
  fi
done

install_log="$(mktemp)"
npm install -g corepack@0.36.0 2>&1 | tee "$install_log"
corepack enable
npx --yes "playwright@$playwright_pin" install --with-deps chromium

# The browser volume stays root's alone. Once a browser's marker file exists,
# 'playwright install' trusts the files without checking them, so anything a
# gate step wrote there would run in every later gate. The gate therefore runs
# as the unprivileged node user, which can read the browsers but not change them.
chown -R root:root "${PLAYWRIGHT_MOUNT}"
chmod -R go-w "${PLAYWRIGHT_MOUNT}"
# The clone and the Yarn folder are the gate's to write. Yarn checks each cache
# archive against the lockfile checksum, so a changed archive fails the install.
chown -R node:node /work "${YARN_MOUNT}"

label="linux node:$node_major container"
if [ "$removed_yarn1" -eq 1 ]; then
  label="$label, image Yarn 1 links removed"
fi
if grep -q EBADENGINE "$install_log"; then
  label="$label, corepack@0.36.0 outside its engines"
fi
rm -f -- "$install_log"

cd /work
exec setpriv --reuid=node --regid=node --init-groups -- \\
  env HOME=/home/node USER=node LOGNAME=node \\
  node scripts/gate.mjs --env "$label"
`;

/** Thrown when a host check refuses the run; its message is printed as is. */
class RefusalError extends Error {}

/**
 * Runs git without a shell.
 *
 * @param {string[]} args git arguments.
 * @param {{ cwd: string, timeoutMs?: number, capture?: boolean }} options
 *   Working directory, upper bound, and whether stdout is captured (else it
 *   goes to this process's stderr).
 * @returns {Promise<{ code: number, stdout: string, problem: string }>} The
 *   outcome; never rejects.
 */
function runGit(args, { cwd, timeoutMs = GIT_TIMEOUT_MS, capture = true }) {
  return new Promise((resolve) => {
    let stdout = '';
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, ...NON_INTERACTIVE_GIT_ENV },
      shell: false,
      stdio: ['ignore', capture ? 'pipe' : STDERR_FD, 'inherit'],
      timeout: timeoutMs,
      windowsHide: true,
    });
    if (capture) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    child.once('error', (error) => finish({ code: 1, stdout: '', problem: error.message }));
    child.once('close', (code, signal) => {
      if (code === 0) {
        finish({ code: 0, stdout, problem: '' });
      } else {
        const reason = signal === null ? `exit code ${code}` : `stopped by ${signal}`;
        finish({ code: code === null || code === 0 ? 1 : code, stdout, problem: reason });
      }
    });
  });
}

/**
 * Runs git and returns its stdout, or refuses the run when git fails.
 *
 * @param {string[]} args git arguments.
 * @param {string} cwd Working directory.
 * @param {string} what What the call reads, for the refusal message.
 * @returns {Promise<string>} The captured stdout.
 */
async function gitOrRefuse(args, cwd, what) {
  const result = await runGit(args, { cwd });
  if (result.code !== 0) {
    throw new RefusalError(`could not read ${what} (git ${args[0]}: ${result.problem}).`);
  }
  return result.stdout;
}

/**
 * Reads a full SHA from `git rev-parse --verify <rev>`.
 *
 * @param {string} rev The revision, `HEAD` or `@{u}`.
 * @param {string} cwd Working directory.
 * @returns {Promise<string>} The lower-case SHA.
 */
async function readSha(rev, cwd) {
  const result = await runGit(['rev-parse', '--verify', rev], { cwd });
  const sha = result.stdout.trim().toLowerCase();
  if (result.code !== 0 || !FULL_SHA_PATTERN.test(sha)) {
    const hint = rev === '@{u}' ? ' Set an upstream with git push -u origin <branch>.' : '';
    throw new RefusalError(`could not resolve ${rev} to a commit.${hint}`);
  }
  return sha;
}

/**
 * Parses the `.nvmrc` major from the committed file.
 *
 * @param {string} text The content of `HEAD:.nvmrc`.
 * @returns {string} The major, digits only.
 */
function parseNodeMajor(text) {
  const match = NVMRC_PATTERN.exec(text.trim());
  const major = match === null ? NaN : Number(match[1]);
  if (!Number.isInteger(major) || major < 1) {
    throw new RefusalError('HEAD:.nvmrc is not a numeric Node version such as 25.9.0.');
  }
  return String(major);
}

/**
 * Reads the exact `@playwright/test` pin from the committed manifest.
 *
 * @param {string} text The content of `HEAD:package.json`.
 * @returns {string} The pinned version.
 */
function parsePlaywrightPin(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new RefusalError('HEAD:package.json is not valid JSON.');
  }
  const pin =
    manifest?.devDependencies?.['@playwright/test'] ?? manifest?.dependencies?.['@playwright/test'];
  if (typeof pin !== 'string' || !EXACT_VERSION_PATTERN.test(pin)) {
    throw new RefusalError(
      'HEAD:package.json does not pin @playwright/test to an exact version such as 1.65.1.'
    );
  }
  return pin;
}

/**
 * Runs the host checks and reads the container inputs from the commit.
 *
 * @param {string} cwd The repository root (main checkout or linked worktree).
 * @returns {Promise<{ sha: string, nodeMajor: string, playwrightPin: string }>}
 *   The validated inputs.
 */
async function prepare(cwd) {
  const status = await gitOrRefuse(
    ['status', '--porcelain=v1', '--untracked-files=normal'],
    cwd,
    'the working tree status'
  );
  if (status.trim() !== '') {
    throw new RefusalError(
      'the working tree is dirty. Evidence is per commit: commit or remove the changes, push, and run again.'
    );
  }

  const fetch = await runGit(['fetch', 'origin'], {
    cwd,
    timeoutMs: GIT_FETCH_TIMEOUT_MS,
    capture: false,
  });
  if (fetch.code !== 0) {
    throw new RefusalError(`git fetch origin failed (${fetch.problem}).`);
  }

  const sha = await readSha('HEAD', cwd);
  const upstream = await readSha('@{u}', cwd);
  if (sha !== upstream) {
    throw new RefusalError(
      `HEAD ${sha} is not pushed: its upstream is at ${upstream}. Push first; the container clones origin.`
    );
  }

  const nodeMajor = parseNodeMajor(await gitOrRefuse(['show', 'HEAD:.nvmrc'], cwd, 'HEAD:.nvmrc'));
  const playwrightPin = parsePlaywrightPin(
    await gitOrRefuse(['show', 'HEAD:package.json'], cwd, 'HEAD:package.json')
  );
  return { sha, nodeMajor, playwrightPin };
}

/**
 * Builds the `docker run` argument array. Every value in it is a constant or
 * was validated against a strict pattern.
 *
 * @param {{ sha: string, nodeMajor: string, playwrightPin: string }} inputs
 * @returns {string[]} Arguments for `docker`.
 */
function buildDockerArgs({ sha, nodeMajor, playwrightPin }) {
  return [
    'run',
    '--rm',
    '--init',
    '--security-opt',
    'no-new-privileges',
    '--volume',
    `${PLAYWRIGHT_VOLUME}:${PLAYWRIGHT_MOUNT}`,
    '--volume',
    `${YARN_VOLUME}:${YARN_MOUNT}`,
    '--env',
    `PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_MOUNT}`,
    '--env',
    `YARN_GLOBAL_FOLDER=${YARN_MOUNT}`,
    '--env',
    'COREPACK_ENABLE_DOWNLOAD_PROMPT=0',
    '--env',
    'GIT_TERMINAL_PROMPT=0',
    `node:${nodeMajor}-bookworm`,
    'bash',
    '-c',
    CONTAINER_SCRIPT,
    'gate-linux',
    sha,
    playwrightPin,
    nodeMajor,
  ];
}

/**
 * Runs Docker with inherited stdio.
 *
 * @param {string[]} args Arguments for `docker`.
 * @returns {Promise<number>} The exit code to report.
 */
function runDocker(args) {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { shell: false, stdio: 'inherit', windowsHide: true });
    child.once('error', (error) => {
      process.stderr.write(`gate:linux: could not start docker: ${error.message}\n`);
      resolve(EXIT_REFUSED);
    });
    child.once('close', (code, signal) => {
      if (signal !== null) {
        resolve(SIGNAL_EXIT_BASE + (osConstants.signals[signal] ?? 0));
      } else {
        resolve(code ?? EXIT_REFUSED);
      }
    });
  });
}

async function main() {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  let inputs;
  try {
    inputs = await prepare(repoRoot);
  } catch (error) {
    if (error instanceof RefusalError) {
      process.stderr.write(`gate:linux refused: ${error.message}\n`);
      return EXIT_REFUSED;
    }
    throw error;
  }

  process.stderr.write(
    `gate:linux: ${inputs.sha} in node:${inputs.nodeMajor}-bookworm, playwright ${inputs.playwrightPin}\n`
  );
  const code = await runDocker(buildDockerArgs(inputs));
  if (code !== 0) {
    process.stderr.write(`gate:linux: the container exited with ${code}.\n`);
  }
  return code;
}

process.exitCode = await main();
