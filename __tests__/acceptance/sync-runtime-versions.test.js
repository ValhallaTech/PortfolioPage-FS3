/**
 * @jest-environment node
 */
/**
 * S1 acceptance tests for chain E (spec stabilize-and-cleanup, sections 2.3 AC-10 and
 * AC-11, 3.4 WI-15 and 3.7): the runtime-sync script that the `Update pinned Node and
 * Yarn versions` step runs.
 *
 * Each scenario copies `package.json`, `.nvmrc` and `netlify.toml` into a temp git repo,
 * commits them, and calls `syncRuntimeVersions({ cwd, fetchYarnVersions, fetchNodeIndex })`
 * with stub fetchers, so no registry is contacted. The module is native ESM and the Jest
 * config has no transform (D-12), so a child `node` process imports it and receives the
 * script path, the temp repo and the stub data on stdin.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SYNC_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-runtime-versions.mjs');

/** The files the script reads and writes (WI-15). */
const PINNED_FILES = ['package.json', '.nvmrc', 'netlify.toml'];

/** Every `NODE_VERSION` assignment in `netlify.toml`, with its quoted value. */
const NODE_VERSION_ASSIGNMENT = /NODE_VERSION\s*=\s*"([^"]*)"/g;

/** Jest's own variables; rule 6 keeps them out of every child process. */
const JEST_VARIABLE_PREFIX = 'JEST_';

/** Git's location variables would point a child git at another repository. */
const GIT_VARIABLE_PREFIX = 'GIT_';

/** Upper bound for one child process; none of them touches the network. */
const CHILD_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 4 * CHILD_TIMEOUT_MS;

/** How much of a child's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

/**
 * Imports the script, calls it with the stub fetchers and prints its result as JSON.
 * Everything it needs arrives on stdin, so `process.argv[1]` stays unset and the
 * script's CLI entry does not run on import.
 */
const DRIVER_SOURCE = `
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const input = JSON.parse(readFileSync(0, 'utf8'));
try {
  const { syncRuntimeVersions } = await import(pathToFileURL(input.scriptPath).href);
  const result = await syncRuntimeVersions({
    cwd: input.cwd,
    fetchYarnVersions: async () => input.yarnVersions,
    fetchNodeIndex: async () => input.nodeIndex,
  });
  process.stdout.write(JSON.stringify({ result }));
} catch (error) {
  process.stderr.write(\`\${error instanceof Error ? error.stack : String(error)}\\n\`);
  process.exitCode = 1;
}
`;

/**
 * This process's environment minus every `JEST_*` variable, and, for git, minus every
 * `GIT_*` variable as well.
 *
 * @param {{ stripGit?: boolean }} [options] Whether to drop the `GIT_*` variables too.
 * @returns {NodeJS.ProcessEnv} The child's environment.
 */
function childEnvironment({ stripGit = false } = {}) {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => {
      const upper = name.toUpperCase();
      if (upper.startsWith(JEST_VARIABLE_PREFIX)) {
        return false;
      }
      return !(stripGit && upper.startsWith(GIT_VARIABLE_PREFIX));
    })
  );
}

/**
 * Describes how a child process ended: exit status, signal, spawn error and stderr tail.
 *
 * @param {string} label What the child was.
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The description.
 */
function describeRun(label, run) {
  const stderr = (run.stderr ?? '').trimEnd();
  const tail = stderr ? stderr.slice(-STDERR_TAIL_CHARS) : '(empty)';
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return `${label}: exit ${run.status}, signal ${run.signal}${spawnError}; stderr: ${tail}`;
}

/**
 * Runs git with an argument array in `cwd`.
 *
 * @param {string} cwd The repository directory.
 * @param {string[]} args The git arguments.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runGit(cwd, args) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: childEnvironment({ stripGit: true }),
    timeout: CHILD_TIMEOUT_MS,
    windowsHide: true,
  });
}

/**
 * Creates the temp git repo: copies the pinned files in, lets `mutate` rewrite them, and
 * commits the result so that `git status --porcelain` starts empty.
 *
 * @param {string} repoDir The empty temp directory.
 * @param {(repoDir: string) => string | null} mutate Rewrites files before the commit;
 *   returns a problem or null.
 * @returns {string | null} The first problem, or null when the repo is ready.
 */
function prepareRepo(repoDir, mutate) {
  for (const file of PINNED_FILES) {
    const source = path.join(REPO_ROOT, file);
    if (!fs.existsSync(source)) {
      return `setup: ${file} is missing from the repo root ${REPO_ROOT}`;
    }
    fs.copyFileSync(source, path.join(repoDir, file));
  }
  const mutationProblem = mutate(repoDir);
  if (mutationProblem) {
    return mutationProblem;
  }
  const steps = [
    ['init', '--quiet'],
    ['config', 'core.autocrlf', 'false'],
    ['config', 'core.hooksPath', '.git/hooks'],
    ['config', 'commit.gpgsign', 'false'],
    ['config', 'user.name', 'Runtime Sync Test'],
    ['config', 'user.email', 'runtime-sync-test@example.invalid'],
    ['add', '--', ...PINNED_FILES],
    ['commit', '--quiet', '-m', 'fixture'],
  ];
  for (const args of steps) {
    const run = runGit(repoDir, args);
    if (run.status !== 0) {
      return `setup: ${describeRun(`git ${args.join(' ')}`, run)}`;
    }
  }
  const status = porcelainStatus(repoDir);
  if (status.problem) {
    return status.problem;
  }
  return status.output === '' ? null : `setup: the fixture commit left changes:\n${status.output}`;
}

/**
 * Reads `git status --porcelain` in the temp repo.
 *
 * @param {string} repoDir The temp repo.
 * @returns {{ output: string, problem: string | null }} The printed status, or the problem.
 */
function porcelainStatus(repoDir) {
  const run = runGit(repoDir, ['status', '--porcelain']);
  if (run.status !== 0) {
    return { output: '', problem: describeRun('git status --porcelain', run) };
  }
  return { output: run.stdout.trimEnd(), problem: null };
}

/**
 * Runs the script once through the driver, with the stub fetchers' data.
 *
 * @param {string} repoDir The temp repo passed as `cwd`.
 * @param {string} spawnDir An empty directory the child process starts in.
 * @param {{ yarnVersions: string[], nodeIndex: object[] }} stubs The stub fetchers' data.
 * @returns {string | null} The problem when the call did not resolve, or null.
 */
function runSync(repoDir, spawnDir, stubs) {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', DRIVER_SOURCE], {
    cwd: spawnDir,
    encoding: 'utf8',
    env: childEnvironment(),
    input: JSON.stringify({ scriptPath: SYNC_SCRIPT, cwd: repoDir, ...stubs }),
    timeout: CHILD_TIMEOUT_MS,
    windowsHide: true,
  });
  return run.status === 0 ? null : describeRun('syncRuntimeVersions driver', run);
}

/**
 * Reads the Yarn version from the copied `package.json` `packageManager` field.
 *
 * @param {string} repoDir The temp repo.
 * @returns {{ version: string | null, major: number | null, problem: string | null }}
 */
function readPackageManagerYarn(repoDir) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
  const match = /^yarn@((\d+)\.\d+\.\d+)(?:\+.*)?$/.exec(packageJson.packageManager ?? '');
  if (!match) {
    return {
      version: null,
      major: null,
      problem: `setup: package.json packageManager is not yarn@X.Y.Z: ${packageJson.packageManager}`,
    };
  }
  return { version: match[1], major: Number(match[2]), problem: null };
}

/**
 * Reads line 1 of the copied `.nvmrc`.
 *
 * @param {string} repoDir The temp repo.
 * @returns {{ version: string | null, major: number | null, problem: string | null }}
 */
function readNvmrc(repoDir) {
  const line1 = fs.readFileSync(path.join(repoDir, '.nvmrc'), 'utf8').split(/\r?\n/)[0].trim();
  const match = /^v?((\d+)\.\d+\.\d+)$/.exec(line1);
  if (!match) {
    return { version: null, major: null, problem: `setup: .nvmrc line 1 is not X.Y.Z: ${line1}` };
  }
  return { version: match[1], major: Number(match[2]), problem: null };
}

/**
 * Builds a Yarn version list whose newest release in `major` is `latest`.
 *
 * @param {number} major The `packageManager` Yarn major.
 * @param {string} latest The newest version to list in that major.
 * @returns {string[]} The `npm view @yarnpkg/cli-dist versions --json` array.
 */
function yarnVersionsWithLatest(major, latest) {
  return [...new Set([`${major - 1}.9.9`, `${major}.0.0`, latest])];
}

/**
 * Builds a Node index (newest first, as nodejs.org serves it) whose newest release in
 * `major` is `latest`.
 *
 * @param {number} major The `.nvmrc` major.
 * @param {string[]} versions The versions to list in that major, newest first.
 * @returns {{ version: string, date: string, lts: boolean }[]} The index.json entries.
 */
function nodeIndexWith(major, versions) {
  return [...versions, `${major - 1}.9.0`].map((version) => ({
    version: `v${version}`,
    date: '2026-01-01',
    lts: false,
  }));
}

describe('runtime-sync script (chain E)', () => {
  let workDir;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-sync-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test(
    'AC-10: exits cleanly and leaves the working tree unchanged when nothing has drifted',
    () => {
      // Arrange
      const repoDir = path.join(workDir, 'repo');
      const spawnDir = path.join(workDir, 'spawn');
      fs.mkdirSync(repoDir);
      fs.mkdirSync(spawnDir);
      expect(prepareRepo(repoDir, () => null)).toBeNull();
      const yarn = readPackageManagerYarn(repoDir);
      const node = readNvmrc(repoDir);
      expect(yarn.problem ?? node.problem).toBeNull();
      const stubs = {
        yarnVersions: yarnVersionsWithLatest(yarn.major, yarn.version),
        nodeIndex: nodeIndexWith(node.major, [...new Set([node.version, `${node.major}.0.0`])]),
      };

      // Act
      const runProblem = runSync(repoDir, spawnDir, stubs);
      const status = porcelainStatus(repoDir);

      // Assert
      expect(runProblem).toBeNull();
      expect(status.problem).toBeNull();
      expect(
        status.output === ''
          ? null
          : `git status --porcelain is not empty after a no-drift run:\n${status.output}`
      ).toBeNull();
    },
    TEST_TIMEOUT_MS
  );

  test(
    'AC-11: propagates a Node drift to .nvmrc and every NODE_VERSION in netlify.toml',
    () => {
      // Arrange
      const repoDir = path.join(workDir, 'repo');
      const spawnDir = path.join(workDir, 'spawn');
      fs.mkdirSync(repoDir);
      fs.mkdirSync(spawnDir);
      let major = null;
      const setupProblem = prepareRepo(repoDir, (dir) => {
        const node = readNvmrc(dir);
        if (node.problem) {
          return node.problem;
        }
        major = node.major;
        const netlifyPath = path.join(dir, 'netlify.toml');
        const netlify = fs.readFileSync(netlifyPath, 'utf8');
        if ([...netlify.matchAll(NODE_VERSION_ASSIGNMENT)].length === 0) {
          return 'setup: netlify.toml has no NODE_VERSION assignment to drift';
        }
        fs.writeFileSync(path.join(dir, '.nvmrc'), `${major}.0.0\n`);
        fs.writeFileSync(
          netlifyPath,
          netlify.replace(NODE_VERSION_ASSIGNMENT, `NODE_VERSION = "${major}.0.0"`)
        );
        return null;
      });
      expect(setupProblem).toBeNull();
      const yarn = readPackageManagerYarn(repoDir);
      expect(yarn.problem).toBeNull();
      const expected = `${major}.1.0`;
      const stubs = {
        yarnVersions: yarnVersionsWithLatest(yarn.major, yarn.version),
        nodeIndex: nodeIndexWith(major, [expected, `${major}.0.0`]),
      };

      // Act
      const runProblem = runSync(repoDir, spawnDir, stubs);
      const nvmrcLine1 = fs.readFileSync(path.join(repoDir, '.nvmrc'), 'utf8').split(/\r?\n/)[0];
      const netlify = fs.readFileSync(path.join(repoDir, 'netlify.toml'), 'utf8');
      const nodeVersions = [...netlify.matchAll(NODE_VERSION_ASSIGNMENT)].map((m) => m[1]);

      // Assert
      expect(runProblem).toBeNull();
      expect(
        nvmrcLine1 === expected
          ? null
          : `.nvmrc line 1 is "${nvmrcLine1}", expected "${expected}" after the drift run`
      ).toBeNull();
      expect(
        netlify.includes(`NODE_VERSION = "${expected}"`) &&
          nodeVersions.every((value) => value === expected)
          ? null
          : `netlify.toml NODE_VERSION values are ${JSON.stringify(nodeVersions)}, ` +
              `expected every one to be "${expected}" after the drift run`
      ).toBeNull();
    },
    TEST_TIMEOUT_MS
  );
});
