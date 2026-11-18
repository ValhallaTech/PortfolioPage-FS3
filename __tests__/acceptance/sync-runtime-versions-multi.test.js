/**
 * @jest-environment node
 */
/**
 * S1 test-after coverage for WI-16's D-9 rules (spec stabilize-and-cleanup, D-9, sections
 * 3.4 WI-16 and 3.7 chain E; review finding CR-E-1): the runtime-sync script updates every
 * `NODE_VERSION` in `netlify.toml`, in whichever table it sits, and keeps an existing
 * `YARN_VERSION` (RK-2's fallback) aligned with `packageManager`.
 *
 * The test copies `package.json` and `.nvmrc` into a temp git repo, writes a `netlify.toml`
 * with two `NODE_VERSION` assignments and one `YARN_VERSION`, and calls
 * `syncRuntimeVersions({ cwd, fetchYarnVersions, fetchNodeIndex })` with stub fetchers, so no
 * registry is contacted. The module is native ESM and the Jest config has no transform, so a
 * child `node` process imports it and receives the script path, the temp repo and the stub
 * data on stdin.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SYNC_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-runtime-versions.mjs');

/** The files the script reads and writes (WI-15). */
const PINNED_FILES = ['package.json', '.nvmrc', 'netlify.toml'];

/** The files copied from the repo root; `netlify.toml` is written by the test. */
const COPIED_FILES = ['package.json', '.nvmrc'];

/** The tables of the fixture's assignments. */
const BUILD_TABLE = '[build.environment]';
const CONTEXT_TABLE = '[context.deploy-preview.environment]';

/** Jest's own variables; rule 6 keeps them out of every child process. */
const JEST_VARIABLE_PREFIX = 'JEST_';

/** Git's location variables would point a child git at another repository. */
const GIT_VARIABLE_PREFIX = 'GIT_';

/** Upper bound for one child process; none of them touches the network. */
const CHILD_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 8 * CHILD_TIMEOUT_MS;

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
 * Runs git steps in order and stops at the first that fails.
 *
 * @param {string} repoDir The temp repo.
 * @param {string[][]} steps The git argument arrays.
 * @param {string} phase What the steps are for, named in a failure.
 * @returns {string | null} The first failure, or null.
 */
function runGitSteps(repoDir, steps, phase) {
  for (const args of steps) {
    const run = runGit(repoDir, args);
    if (run.status !== 0) {
      return `${phase}: ${describeRun(`git ${args.join(' ')}`, run)}`;
    }
  }
  return null;
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
 * Reads a UTF-8 file without throwing.
 *
 * @param {string} filePath The file.
 * @returns {{ text: string, problem: string | null }} The content, or the problem.
 */
function readText(filePath) {
  try {
    return { text: fs.readFileSync(filePath, 'utf8'), problem: null };
  } catch (error) {
    return { text: '', problem: `could not read ${filePath}: ${error.message}` };
  }
}

/**
 * Splits a stable x.y.z version into its numeric parts.
 *
 * @param {string} version The version.
 * @returns {number[]} Major, minor and patch.
 */
function versionParts(version) {
  return version.split('.').map(Number);
}

/**
 * Reads the pins the fixture is built from: the Node major on line 1 of the copied
 * `.nvmrc`, and the Yarn version after `yarn@` in the copied `package.json`.
 *
 * @param {string} repoDir The temp repo.
 * @returns {{ nodeMajor: number | null, yarn: string | null, problem: string | null }}
 */
function readSourcePins(repoDir) {
  const nvmrc = readText(path.join(repoDir, '.nvmrc'));
  const manifest = readText(path.join(repoDir, 'package.json'));
  const readProblem = nvmrc.problem ?? manifest.problem;
  if (readProblem) {
    return { nodeMajor: null, yarn: null, problem: `setup: ${readProblem}` };
  }
  const line1 = nvmrc.text.split(/\r?\n/)[0].trim();
  const nodeMatch = /^v?(\d+)\.\d+\.\d+$/.exec(line1);
  if (!nodeMatch) {
    return { nodeMajor: null, yarn: null, problem: `setup: .nvmrc line 1 is not X.Y.Z: ${line1}` };
  }
  let packageManager;
  try {
    packageManager = JSON.parse(manifest.text).packageManager;
  } catch (error) {
    return { nodeMajor: null, yarn: null, problem: `setup: package.json: ${error.message}` };
  }
  const yarnMatch = /^yarn@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(packageManager ?? '');
  if (!yarnMatch) {
    return {
      nodeMajor: null,
      yarn: null,
      problem: `setup: package.json packageManager is not yarn@X.Y.Z: ${packageManager}`,
    };
  }
  return { nodeMajor: Number(nodeMatch[1]), yarn: yarnMatch[1], problem: null };
}

/**
 * Picks a release in the same major that is older than `version`.
 *
 * @param {string} version A stable x.y.z version.
 * @returns {string | null} The older version, or null when `version` is X.0.0.
 */
function olderInSameMajor(version) {
  const [major, minor, patch] = versionParts(version);
  if (minor > 0) {
    return `${major}.${minor - 1}.0`;
  }
  return patch > 0 ? `${major}.0.${patch - 1}` : null;
}

/**
 * The fixture's `netlify.toml`: one `NODE_VERSION` and one `YARN_VERSION` in
 * `[build.environment]`, and a second `NODE_VERSION` in a deploy-preview context table.
 *
 * @param {string} node The value of both `NODE_VERSION` assignments.
 * @param {string} yarn The value of `YARN_VERSION`.
 * @returns {string} The file content.
 */
function netlifyFixture(node, yarn) {
  return [
    '[build]',
    '  command = "yarn build"',
    '  publish = "dist"',
    '',
    `  ${BUILD_TABLE}`,
    `    NODE_VERSION = "${node}"`,
    `    YARN_VERSION = "${yarn}"`,
    '',
    CONTEXT_TABLE,
    `  NODE_VERSION = "${node}"`,
    '',
  ].join('\n');
}

/**
 * Lists every `key = "value"` assignment in a TOML text with the table it sits in and
 * its 1-based line number.
 *
 * @param {string} text The TOML text.
 * @param {string} key The key to find.
 * @returns {{ table: string, line: number, value: string }[]} The assignments.
 */
function assignmentsOf(text, key) {
  const assignment = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`);
  const found = [];
  let table = '(top level)';
  text.split(/\r?\n/).forEach((line, index) => {
    const header = /^\s*(\[{1,2}[^\]]+\]{1,2})\s*(?:#.*)?$/.exec(line);
    if (header) {
      table = header[1];
      return;
    }
    const match = assignment.exec(line);
    if (match) {
      found.push({ table, line: index + 1, value: match[1] });
    }
  });
  return found;
}

/**
 * Checks that `key` in `table` of a TOML text reads `expected`.
 *
 * @param {string} text The netlify.toml text after the run.
 * @param {string} key The key.
 * @param {string} table The table header, brackets included.
 * @param {string} expected The value the run should have written.
 * @returns {string | null} The problem, naming the key, line and value found, or null.
 */
function assignmentProblem(text, key, table, expected) {
  const all = assignmentsOf(text, key);
  const inTable = all.filter((entry) => entry.table === table);
  if (inTable.length !== 1) {
    return (
      `netlify.toml has ${inTable.length} ${key} assignments in ${table} after the first run, ` +
      `expected 1; all ${key} assignments: ${JSON.stringify(all)}`
    );
  }
  const [{ line, value }] = inTable;
  return value === expected
    ? null
    : `netlify.toml ${key} in ${table} (line ${line}) is "${value}", ` +
        `expected "${expected}" after the first run`;
}

/**
 * Creates the temp git repo: copies `package.json` and `.nvmrc` in, sets `.nvmrc` to
 * `M.0.0`, writes the fixture `netlify.toml`, and commits the result.
 *
 * @param {string} repoDir The empty temp directory.
 * @returns {{ nodeMajor: number | null, yarn: string | null, olderYarn: string | null,
 *   problem: string | null }} The pins the stubs are built from, or the first problem.
 */
function prepareRepo(repoDir) {
  const failed = (problem) => ({ nodeMajor: null, yarn: null, olderYarn: null, problem });
  for (const file of COPIED_FILES) {
    const source = path.join(REPO_ROOT, file);
    if (!fs.existsSync(source)) {
      return failed(`setup: ${file} is missing from the repo root ${REPO_ROOT}`);
    }
    fs.copyFileSync(source, path.join(repoDir, file));
  }
  const pins = readSourcePins(repoDir);
  if (pins.problem) {
    return failed(pins.problem);
  }
  const olderYarn = olderInSameMajor(pins.yarn);
  if (!olderYarn) {
    return failed(`setup: packageManager yarn@${pins.yarn} has no older release in its major`);
  }
  const startNode = `${pins.nodeMajor}.0.0`;
  fs.writeFileSync(path.join(repoDir, '.nvmrc'), `${startNode}\n`);
  fs.writeFileSync(path.join(repoDir, 'netlify.toml'), netlifyFixture(startNode, olderYarn));
  const gitProblem = runGitSteps(
    repoDir,
    [
      ['init', '--quiet'],
      ['config', 'core.autocrlf', 'false'],
      ['config', 'core.hooksPath', '.git/hooks'],
      ['config', 'commit.gpgsign', 'false'],
      ['config', 'user.name', 'Runtime Sync Test'],
      ['config', 'user.email', 'runtime-sync-test@example.invalid'],
      ['add', '--', ...PINNED_FILES],
      ['commit', '--quiet', '-m', 'fixture'],
    ],
    'setup'
  );
  if (gitProblem) {
    return failed(gitProblem);
  }
  const status = porcelainStatus(repoDir);
  if (status.problem) {
    return failed(`setup: ${status.problem}`);
  }
  if (status.output !== '') {
    return failed(`setup: the fixture commit left changes:\n${status.output}`);
  }
  return { nodeMajor: pins.nodeMajor, yarn: pins.yarn, olderYarn, problem: null };
}

/**
 * Builds the stub fetchers' data. The Node index (newest first, as nodejs.org serves it)
 * lists `M.1.0` as the newest stable `M` release, plus a newer major and an `M`
 * prerelease that the script must ignore. The Yarn list's newest stable release in the
 * `packageManager` major is `yarn`, plus a newer prerelease in that major.
 *
 * @param {number} nodeMajor The `.nvmrc` major.
 * @param {string} yarn The `packageManager` Yarn version.
 * @param {string} olderYarn The fixture's `YARN_VERSION`.
 * @returns {{ yarnVersions: string[], nodeIndex: object[] }} The stub data.
 */
function stubData(nodeMajor, yarn, olderYarn) {
  const [yarnMajor, yarnMinor] = versionParts(yarn);
  const nodeVersions = [
    `${nodeMajor + 1}.0.0`,
    `${nodeMajor}.2.0-rc.1`,
    `${nodeMajor}.1.0`,
    `${nodeMajor}.0.0`,
    `${nodeMajor - 1}.9.0`,
  ];
  return {
    yarnVersions: [olderYarn, yarn, `${yarnMajor}.${yarnMinor + 1}.0-rc.1`],
    nodeIndex: nodeVersions.map((version) => ({
      version: `v${version}`,
      date: '2026-01-01',
      lts: false,
    })),
  };
}

/**
 * Runs the script once through the driver, with the stub fetchers' data.
 *
 * @param {string} repoDir The temp repo passed as `cwd`.
 * @param {string} spawnDir An empty directory the child process starts in.
 * @param {{ yarnVersions: string[], nodeIndex: object[] }} stubs The stub fetchers' data.
 * @param {string} label Which run this is, named in a failure.
 * @returns {string | null} The problem when the call did not resolve, or null.
 */
function runSync(repoDir, spawnDir, stubs, label) {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', DRIVER_SOURCE], {
    cwd: spawnDir,
    encoding: 'utf8',
    env: childEnvironment(),
    input: JSON.stringify({ scriptPath: SYNC_SCRIPT, cwd: repoDir, ...stubs }),
    timeout: CHILD_TIMEOUT_MS,
    windowsHide: true,
  });
  return run.status === 0 ? null : describeRun(`syncRuntimeVersions driver, ${label}`, run);
}

describe('runtime-sync script, every pinned key (chain E, CR-E-1)', () => {
  let workDir;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-sync-multi-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
  });

  test(
    'CR-E-1: updates every NODE_VERSION and an existing YARN_VERSION in netlify.toml, then a second run changes nothing',
    () => {
      // Arrange
      const repoDir = path.join(workDir, 'repo');
      const spawnDir = path.join(workDir, 'spawn');
      fs.mkdirSync(repoDir);
      fs.mkdirSync(spawnDir);
      const setup = prepareRepo(repoDir);
      expect(setup.problem).toBeNull();
      const expectedNode = `${setup.nodeMajor}.1.0`;
      const stubs = stubData(setup.nodeMajor, setup.yarn, setup.olderYarn);

      // Act: first run
      const firstRunProblem = runSync(repoDir, spawnDir, stubs, 'first run');
      const netlify = readText(path.join(repoDir, 'netlify.toml'));
      const nvmrc = readText(path.join(repoDir, '.nvmrc'));
      const nvmrcLine1 = nvmrc.text.split(/\r?\n/)[0];

      // Assert: first run
      expect(firstRunProblem).toBeNull();
      expect(netlify.problem ?? nvmrc.problem).toBeNull();
      expect(assignmentProblem(netlify.text, 'NODE_VERSION', BUILD_TABLE, expectedNode)).toBeNull();
      expect(
        assignmentProblem(netlify.text, 'NODE_VERSION', CONTEXT_TABLE, expectedNode)
      ).toBeNull();
      expect(assignmentProblem(netlify.text, 'YARN_VERSION', BUILD_TABLE, setup.yarn)).toBeNull();
      expect(
        nvmrcLine1 === expectedNode
          ? null
          : `.nvmrc line 1 is "${nvmrcLine1}", expected "${expectedNode}" after the first run`
      ).toBeNull();

      // Act: commit the first run's result, then run again with the same stubs
      const commitProblem = runGitSteps(
        repoDir,
        [
          ['add', '--', ...PINNED_FILES],
          ['commit', '--quiet', '-m', 'first sync run'],
        ],
        'commit after the first run'
      );
      const secondRunProblem = commitProblem ?? runSync(repoDir, spawnDir, stubs, 'second run');
      const status = porcelainStatus(repoDir);

      // Assert: second run
      expect(secondRunProblem).toBeNull();
      expect(status.problem).toBeNull();
      expect(
        status.output === ''
          ? null
          : `git status --porcelain is not empty after the second run:\n${status.output}`
      ).toBeNull();
    },
    TEST_TIMEOUT_MS
  );
});
