/**
 * @jest-environment node
 */
/**
 * S5 release test for chain F (spec stabilize-and-cleanup, section 3.4 WI-18):
 * AC-6, a Bootstrap prerelease update resolves to `automerge: false` even when
 * everything else automerges. This is the Q-12(c) harness.
 *
 * 1. In a temp directory it writes the AC-6 variant of `renovate.json` (every
 *    `packageRules` entry that does not name `bootstrap` gets `automerge: true`) and a
 *    `package.json` that pins `"bootstrap": "6.0.0-alpha.1"`.
 * 2. It starts a stub npm registry on 127.0.0.1 with `node:http`, in a worker thread
 *    so it keeps serving while the main thread waits on `spawnSync`. The `bootstrap`
 *    packument has 5.3.8, 6.0.0-alpha.1 and 6.0.0-alpha.2, `dist-tags`
 *    `{ latest: '5.3.8', next: '6.0.0-alpha.2' }`, and no `repository` field, so no
 *    changelog fetch happens.
 * 3. It runs `npx --yes renovate@<pin> --platform=local` there with
 *    `RENOVATE_NPMRC=registry=http://127.0.0.1:<port>/`, `LOG_LEVEL=debug` and
 *    `LOG_FORMAT=json`.
 * 4. It reads the `packageFiles with updates` entry for `bootstrap` and takes
 *    `automerge` from the `6.0.0-alpha.2` update.
 * 5. If that entry has no `automerge`, it resolves the same config through the same
 *    pinned Renovate package's package-rules module (RK-16), following the steps of
 *    Renovate's `flattenUpdates`, and checks that this reproduces the run's branch name.
 *
 * npx and npm run through `node npx-cli.js` and `node npm-cli.js`, so no `.cmd` shim
 * or shell string is involved on Windows. Run with `yarn verify:release`. It never
 * skips: every failure is an `expect` whose received value names the cause.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The exact Renovate version chain F runs (WI-18). Keep it equal in both S5 files. */
const RENOVATE_PIN = '44.252.5';

const PACKAGE_NAME = 'bootstrap';
const CURRENT_VERSION = '6.0.0-alpha.1';
const TARGET_VERSION = '6.0.0-alpha.2';

/** The stub registry's `bootstrap` packument. No `repository` field, so no changelog fetch. */
const PACKUMENT = {
  name: PACKAGE_NAME,
  'dist-tags': { latest: '5.3.8', next: TARGET_VERSION },
  versions: Object.fromEntries(
    ['5.3.8', CURRENT_VERSION, TARGET_VERSION].map((version) => [
      version,
      { name: PACKAGE_NAME, version },
    ])
  ),
};

/** The fixture `package.json` (AC-6 Given). */
const FIXTURE_PACKAGE_JSON = {
  name: 'ac6-fixture',
  version: '1.0.0',
  private: true,
  dependencies: { [PACKAGE_NAME]: CURRENT_VERSION },
};

/** The debug log entry step 4 reads. */
const PACKAGE_FILES_MESSAGE = 'packageFiles with updates';
const STARTED_MESSAGE = 'Renovate started';

/** Upper bound for the npx install plus the Renovate run. */
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
/** Upper bound for `npm config get cache` and the package-rules fallback. */
const SHORT_TIMEOUT_MS = 120_000;
const REGISTRY_START_TIMEOUT_MS = 10_000;
const REGISTRY_CLOSE_TIMEOUT_MS = 10_000;
const TEST_TIMEOUT_MS = RUN_TIMEOUT_MS + 2 * SHORT_TIMEOUT_MS + 60_000;
const MAX_BUFFER = 256 * 1024 * 1024;

/** How much of a child's output a failure message shows. */
const OUTPUT_TAIL_CHARS = 4000;

/** Jest's own variables never reach a child process (rule 6). */
const JEST_VARIABLE_PREFIX = 'JEST_';
/** Inherited Renovate settings are dropped, so only the harness configures the run. */
const RENOVATE_VARIABLE_PREFIX = 'RENOVATE_';

/** Marker lines the fallback script prints on stdout. */
const RESOLVED_MARKER = 'AC6_RESOLVED ';
const ERROR_MARKER = 'AC6_ERROR ';

/**
 * The stub npm registry, run as an eval worker. It answers `GET /<name>` with the
 * packument from `workerData`, 404 for anything else, posts `{ port }` once it
 * listens, and closes on the message `'close'`.
 */
const REGISTRY_WORKER_SOURCE = `
const http = require('node:http');
const { parentPort, workerData } = require('node:worker_threads');
const body = JSON.stringify(workerData.packument);
const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/' + workerData.packument.name) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(body);
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end('{}');
});
server.listen(0, '127.0.0.1', () => parentPort.postMessage({ port: server.address().port }));
parentPort.on('message', (message) => {
  if (message === 'close') {
    server.close(() => parentPort.close());
  }
});
`;

/**
 * The RK-16 fallback, run as an ES module with `node --input-type=module -e`. Its
 * arguments are the Renovate package directory, the variant `renovate.json` and a
 * JSON input `{ manager, packageFile, depName, newVersion }` taken from the run's
 * log. It mirrors Renovate's `flattenUpdates` for one update: defaults plus the
 * resolved repo config, the manager and package-file config, the dep and the update,
 * then `applyPackageRules` before and after the update-type merge. It prints one
 * `AC6_RESOLVED <json>` line, or `AC6_ERROR <stack>` and exit 1.
 */
const FALLBACK_SCRIPT = `
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [renovateDir, configFile, inputFile] = process.argv.slice(1);
const load = (relative) =>
  import(pathToFileURL(path.join(renovateDir, 'dist', ...relative.split('/'))).href);
const UPDATE_TYPES = ['major', 'minor', 'patch', 'pin', 'digest', 'lockFileMaintenance', 'replacement'];

try {
  const { getConfig } = await load('config/defaults.js');
  const { applyDatasourceDefaultConfig, getManagerConfig, mergeChildConfig } = await load('config/index.js');
  const { resolveConfigPresets } = await load('config/presets/index.js');
  const { applyPackageRules } = await load('util/package-rules/index.js');
  const { applyUpdateConfig } = await load('workers/repository/updates/flatten.js');

  const repoConfig = JSON.parse(readFileSync(configFile, 'utf8'));
  const { manager, packageFile, depName, newVersion } = JSON.parse(readFileSync(inputFile, 'utf8'));
  const dep = packageFile.deps.find((candidate) => candidate.depName === depName);
  const { branchName: loggedBranchName, ...update } = dep.updates.find(
    (candidate) => candidate.newVersion === newVersion
  );

  const defaults = getConfig();
  const { config: resolvedRepoConfig } = await resolveConfigPresets(repoConfig, defaults);
  const config = mergeChildConfig(defaults, resolvedRepoConfig);

  const packageFileConfig = mergeChildConfig(getManagerConfig(config, manager), packageFile);
  const packagePath = packageFile.packageFile.split('/');
  packagePath.splice(-1, 1);
  packageFileConfig.parentDir = packagePath.length > 0 ? packagePath.at(-1) : '';
  packageFileConfig.packageFileDir = packagePath.join('/');

  const depConfig = mergeChildConfig(packageFileConfig, dep);
  delete depConfig.deps;
  let updateConfig = mergeChildConfig(depConfig, update);
  delete updateConfig.updates;
  if (updateConfig.updateType) {
    const updateType = updateConfig.updateType;
    updateConfig['is' + updateType.charAt(0).toUpperCase() + updateType.slice(1)] = true;
  }
  updateConfig = await applyDatasourceDefaultConfig(updateConfig);
  updateConfig = await applyPackageRules(updateConfig, 'datasource-merge');
  updateConfig = mergeChildConfig(updateConfig, updateConfig[updateConfig.updateType]);
  for (const updateType of UPDATE_TYPES) delete updateConfig[updateType];
  updateConfig = await applyPackageRules(updateConfig, 'update-type-merge');
  updateConfig = applyUpdateConfig(updateConfig);

  process.stdout.write(
    'AC6_RESOLVED ' +
      JSON.stringify({
        automerge: updateConfig.automerge,
        groupName: updateConfig.groupName,
        branchName: updateConfig.branchName,
        loggedBranchName,
      }) +
      '\\n'
  );
} catch (error) {
  process.stdout.write('AC6_ERROR ' + String((error && error.stack) || error).replace(/\\r?\\n/g, ' | ') + '\\n');
  process.exitCode = 1;
}
`;

/** Temp directory for this run; removed in afterAll. */
let tempDir = null;
/** The stub registry's worker thread; closed in afterAll. */
let registry = null;
/** The first error the registry worker raised, if any. */
let registryError = null;

/**
 * The child's environment: this process's environment minus every `JEST_*` and
 * `RENOVATE_*` variable, plus `extra`.
 *
 * @param {Record<string, string>} extra Variables to set.
 * @returns {NodeJS.ProcessEnv} The environment.
 */
function childEnvironment(extra = {}) {
  const inherited = Object.entries(process.env).filter(
    ([name]) => !name.startsWith(JEST_VARIABLE_PREFIX) && !name.startsWith(RENOVATE_VARIABLE_PREFIX)
  );
  return { ...Object.fromEntries(inherited), ...extra };
}

/**
 * Finds a script of npm's `bin` folder next to the running Node: `node_modules/npm`
 * beside `node.exe` on Windows, `../lib/node_modules/npm` beside `bin/node` elsewhere.
 *
 * @param {string} script `npx-cli.js` or `npm-cli.js`.
 * @returns {{ file: string|null, candidates: string[] }} The script, or null, and
 *   every path that was checked.
 */
function locateNpmScript(script) {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', script),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', script),
  ];
  return { file: candidates.find((candidate) => fs.existsSync(candidate)) ?? null, candidates };
}

/**
 * Describes how a child process ended, with the tail of its output.
 *
 * @param {string} label What ran.
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @param {string} output The output to show.
 * @returns {string} The description.
 */
function describeRun(label, run, output) {
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  const tail = output.trimEnd().slice(-OUTPUT_TAIL_CHARS) || '(empty)';
  return (
    `${label}: exit ${run.status}, signal ${run.signal}${spawnError}\n` +
    `Output (last ${OUTPUT_TAIL_CHARS} characters):\n${tail}`
  );
}

/**
 * Step 1: builds the AC-6 variant of the repo's `renovate.json`. A rule names
 * `bootstrap` when its `matchPackageNames` or `matchDepNames` lists it.
 *
 * @returns {{ config?: object, problem?: string }} The variant, or why it could not be built.
 */
function buildVariantConfig() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'renovate.json'), 'utf8'));
  } catch (error) {
    return { problem: `step 1: could not read renovate.json: ${error.message}` };
  }
  if (!Array.isArray(config.packageRules)) {
    return { problem: 'step 1: renovate.json has no packageRules array' };
  }
  const namesBootstrap = (rule) =>
    [rule.matchPackageNames, rule.matchDepNames]
      .flatMap((names) => (Array.isArray(names) ? names : []))
      .includes(PACKAGE_NAME);
  config.packageRules = config.packageRules.map((rule) =>
    namesBootstrap(rule) ? rule : { ...rule, automerge: true }
  );
  return { config };
}

/**
 * Step 2: starts the stub registry in a worker thread.
 *
 * @returns {Promise<{ port?: number, problem?: string }>} The port, or why it did not start.
 */
function startRegistry() {
  return new Promise((resolve) => {
    registry = new Worker(REGISTRY_WORKER_SOURCE, {
      eval: true,
      workerData: { packument: PACKUMENT },
    });
    const timer = setTimeout(
      () =>
        resolve({
          problem: `step 2: stub registry reported no port in ${REGISTRY_START_TIMEOUT_MS} ms`,
        }),
      REGISTRY_START_TIMEOUT_MS
    );
    registry.on('error', (error) => {
      registryError = registryError ?? error.message;
      clearTimeout(timer);
      resolve({ problem: `step 2: stub registry worker failed: ${error.message}` });
    });
    registry.once('message', (message) => {
      clearTimeout(timer);
      resolve({ port: message.port });
    });
  });
}

/**
 * Parses Renovate's JSON log lines from stdout; other lines are ignored.
 *
 * @param {string} stdout Renovate's stdout.
 * @returns {object[]} The log records.
 */
function parseLog(stdout) {
  const records = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith('{')) {
      continue;
    }
    try {
      records.push(JSON.parse(line));
    } catch {
      // A partial or non-JSON line carries no record.
    }
  }
  return records;
}

/**
 * Step 4: finds the npm package file, the `bootstrap` dep and its `6.0.0-alpha.2`
 * update in the `packageFiles with updates` entry.
 *
 * @param {object[]} records Renovate's log records.
 * @returns {{ packageFile?: object, update?: object, problem?: string }} The match, or
 *   why there is none.
 */
function findTargetUpdate(records) {
  const entry = records.find((record) => record.msg === PACKAGE_FILES_MESSAGE);
  if (!entry) {
    return { problem: `step 4: the log has no "${PACKAGE_FILES_MESSAGE}" entry` };
  }
  const packageFiles = entry.config?.npm ?? [];
  for (const packageFile of packageFiles) {
    const dep = (packageFile.deps ?? []).find((candidate) => candidate.depName === PACKAGE_NAME);
    const update = (dep?.updates ?? []).find(
      (candidate) => candidate.newVersion === TARGET_VERSION
    );
    if (update) {
      return { packageFile, update };
    }
  }
  return {
    problem:
      `step 4: "${PACKAGE_FILES_MESSAGE}" has no ${PACKAGE_NAME} ${TARGET_VERSION} update; ` +
      `npm entry: ${JSON.stringify(packageFiles).slice(0, OUTPUT_TAIL_CHARS)}`,
  };
}

/**
 * Finds the pinned Renovate package npx installed, in npm's `_npx` cache.
 *
 * @returns {{ dir?: string, problem?: string }} The package directory, or why it was not found.
 */
function locateRenovatePackage() {
  const npm = locateNpmScript('npm-cli.js');
  if (!npm.file) {
    return {
      problem: `step 5: npm-cli.js not found; checked: ${npm.candidates.join(', ')}`,
    };
  }
  const run = spawnSync(process.execPath, [npm.file, 'config', 'get', 'cache'], {
    env: childEnvironment(),
    encoding: 'utf8',
    timeout: SHORT_TIMEOUT_MS,
    windowsHide: true,
  });
  const cacheDir = (run.stdout ?? '').trim();
  if (run.error || run.status !== 0 || !cacheDir) {
    return {
      problem: describeRun('step 5: npm config get cache', run, `${run.stdout}${run.stderr}`),
    };
  }
  const npxDir = path.join(cacheDir, '_npx');
  const entries = fs.existsSync(npxDir) ? fs.readdirSync(npxDir) : [];
  for (const entry of entries) {
    const dir = path.join(npxDir, entry, 'node_modules', 'renovate');
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (manifest.name === 'renovate' && manifest.version === RENOVATE_PIN) {
        return { dir };
      }
    } catch {
      // This npx entry holds no readable Renovate package.
    }
  }
  return { problem: `step 5: no renovate@${RENOVATE_PIN} package under ${npxDir}` };
}

/**
 * Step 5: resolves the update's `automerge` through the pinned package's
 * package-rules module, and checks that the result reproduces the run's branch name.
 *
 * @param {string} configFile The variant `renovate.json`.
 * @param {object} packageFile The logged npm package file.
 * @returns {{ resolution?: object, problem?: string }} The resolution, or why there is none.
 */
function resolveThroughPackageRules(configFile, packageFile) {
  const renovate = locateRenovatePackage();
  if (renovate.problem) {
    return { problem: renovate.problem };
  }
  const inputFile = path.join(tempDir, 'fallback-input.json');
  fs.writeFileSync(
    inputFile,
    JSON.stringify({
      manager: 'npm',
      packageFile,
      depName: PACKAGE_NAME,
      newVersion: TARGET_VERSION,
    })
  );
  const run = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', FALLBACK_SCRIPT, renovate.dir, configFile, inputFile],
    {
      cwd: tempDir,
      env: childEnvironment({ LOG_LEVEL: 'fatal' }),
      encoding: 'utf8',
      timeout: SHORT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    }
  );
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const line = (run.stdout ?? '').split(/\r?\n/).find((text) => text.startsWith(RESOLVED_MARKER));
  if (run.error || run.status !== 0 || !line) {
    const errorLine = (run.stdout ?? '')
      .split(/\r?\n/)
      .find((text) => text.startsWith(ERROR_MARKER));
    return {
      problem: describeRun(
        `step 5: package-rules fallback with ${renovate.dir}`,
        run,
        errorLine ?? output
      ),
    };
  }
  const result = JSON.parse(line.slice(RESOLVED_MARKER.length));
  if (result.branchName !== result.loggedBranchName) {
    return {
      problem:
        `step 5: the package-rules fallback does not reproduce the run: branch ` +
        `${result.branchName}, but the log has ${result.loggedBranchName}`,
    };
  }
  if (typeof result.automerge !== 'boolean') {
    return {
      problem:
        `step 5: neither the log nor the package-rules fallback yields automerge for ` +
        `${PACKAGE_NAME} ${TARGET_VERSION} (fallback: ${JSON.stringify(result)})`,
    };
  }
  return {
    resolution: {
      source: 'package-rules fallback (RK-16)',
      groupName: result.groupName,
      branchName: result.branchName,
      automerge: result.automerge,
    },
  };
}

/**
 * Runs steps 1 to 5 and resolves the `bootstrap` 6.0.0-alpha.2 update's `automerge`.
 *
 * @returns {Promise<{ resolution?: object, problem: string|null }>} The resolution, or
 *   the harness problem that stopped it.
 */
async function resolveBootstrapUpdate() {
  const variant = buildVariantConfig();
  if (variant.problem) {
    return { problem: variant.problem };
  }
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'renovate-ac6-'));
  const repoDir = path.join(tempDir, 'repo');
  const baseDir = path.join(tempDir, 'renovate-base');
  fs.mkdirSync(repoDir);
  fs.mkdirSync(baseDir);
  const configFile = path.join(repoDir, 'renovate.json');
  fs.writeFileSync(configFile, `${JSON.stringify(variant.config, null, 2)}\n`);
  fs.writeFileSync(
    path.join(repoDir, 'package.json'),
    `${JSON.stringify(FIXTURE_PACKAGE_JSON, null, 2)}\n`
  );

  const started = await startRegistry();
  if (started.problem) {
    return { problem: started.problem };
  }

  const npx = locateNpmScript('npx-cli.js');
  if (!npx.file) {
    return { problem: `step 3: npx-cli.js not found; checked: ${npx.candidates.join(', ')}` };
  }
  const run = spawnSync(
    process.execPath,
    [npx.file, '--yes', `renovate@${RENOVATE_PIN}`, '--platform=local'],
    {
      cwd: repoDir,
      env: childEnvironment({
        RENOVATE_NPMRC: `registry=http://127.0.0.1:${started.port}/`,
        RENOVATE_BASE_DIR: baseDir,
        LOG_LEVEL: 'debug',
        LOG_FORMAT: 'json',
      }),
      encoding: 'utf8',
      timeout: RUN_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    }
  );
  const label = `step 3: npx renovate@${RENOVATE_PIN} --platform=local`;
  if (run.error || run.status !== 0) {
    return { problem: describeRun(label, run, `${run.stdout ?? ''}${run.stderr ?? ''}`) };
  }
  if (registryError) {
    return { problem: `step 2: stub registry worker failed during the run: ${registryError}` };
  }

  const records = parseLog(run.stdout ?? '');
  const version = records.find((record) => record.msg === STARTED_MESSAGE)?.renovateVersion;
  if (version !== RENOVATE_PIN) {
    return {
      problem: `${label}: the log reports Renovate ${version}, not ${RENOVATE_PIN}`,
    };
  }
  const target = findTargetUpdate(records);
  if (target.problem) {
    return { problem: target.problem };
  }

  if ('automerge' in target.update) {
    return {
      problem: null,
      resolution: {
        source: `"${PACKAGE_FILES_MESSAGE}" log entry`,
        branchName: target.update.branchName,
        automerge: target.update.automerge,
      },
    };
  }
  const fallback = resolveThroughPackageRules(configFile, target.packageFile);
  return fallback.problem
    ? { problem: fallback.problem }
    : { problem: null, resolution: fallback.resolution };
}

/**
 * Closes the stub registry, and terminates its worker if it does not exit in time.
 *
 * @returns {Promise<void>} Resolves once the worker has exited.
 */
async function closeRegistry() {
  const worker = registry;
  registry = null;
  if (!worker) {
    return;
  }
  const exited = new Promise((resolve) => worker.once('exit', resolve));
  worker.postMessage('close');
  const timer = setTimeout(() => worker.terminate(), REGISTRY_CLOSE_TIMEOUT_MS);
  await exited;
  clearTimeout(timer);
}

describe('Renovate Bootstrap prerelease update (chain F)', () => {
  afterAll(async () => {
    await closeRegistry();
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  test(
    'AC-6: the bootstrap 6.0.0-alpha.1 to 6.0.0-alpha.2 update resolves to automerge false when every other rule automerges',
    async () => {
      const { problem, resolution } = await resolveBootstrapUpdate();
      // The received value names the update, where its automerge came from, and its
      // group and branch, so a failure shows which rule won.
      const resolved = { depName: PACKAGE_NAME, newVersion: TARGET_VERSION, ...resolution };

      expect(problem).toBeNull();
      expect(resolved).toEqual({ ...resolved, automerge: false });
    },
    TEST_TIMEOUT_MS
  );
});
