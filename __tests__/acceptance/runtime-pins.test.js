/**
 * @jest-environment node
 */
/**
 * S1 acceptance tests for AC-7 and AC-12 (spec stabilize-and-cleanup, sections 2.3,
 * 3.4 WI-11 and 3.7 chain D): the Node and Yarn versions the repo declares agree.
 *
 * Offline: they read `.nvmrc`, `netlify.toml`, `.github/workflows/ci.yml` and
 * `package.json` from the working tree. Every failure is an `expect` whose received
 * value names the file, the key and the values.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parse: parseToml } = require('smol-toml');
const YAML = require('yaml');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The files the declarations come from, relative to the repo root. */
const NVMRC = '.nvmrc';
const NETLIFY_TOML = 'netlify.toml';
const CI_WORKFLOW = '.github/workflows/ci.yml';
const PACKAGE_JSON = 'package.json';

/** The `uses:` prefix of the setup-node action. */
const SETUP_NODE_ACTION = 'actions/setup-node';

/**
 * Reads a repo file.
 *
 * @param {string} relative Path relative to the repo root.
 * @returns {{ text: string | null, problem: string | null }} The text, or the problem.
 */
function readRepoFile(relative) {
  try {
    return { text: fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8'), problem: null };
  } catch (error) {
    return { text: null, problem: `${relative}: cannot be read (${error.message})` };
  }
}

/**
 * Normalizes a version string: trims it and drops a leading `v`.
 *
 * @param {unknown} value The declared value.
 * @returns {string} The normalized version.
 */
function normalizeVersion(value) {
  return String(value).trim().replace(/^v/i, '');
}

/**
 * Returns the major of a version string, or null when it has none.
 *
 * @param {unknown} value The declared value.
 * @returns {number | null} The major version.
 */
function majorOf(value) {
  const match = /^(\d+)/.exec(normalizeVersion(value));
  return match ? Number(match[1]) : null;
}

/**
 * Reads `.nvmrc` line 1.
 *
 * @returns {{ value: string | null, problem: string | null }} The version, or the problem.
 */
function readNvmrc() {
  const file = readRepoFile(NVMRC);
  if (file.problem) {
    return { value: null, problem: file.problem };
  }
  const line = file.text.split(/\r?\n/)[0].trim();
  return line
    ? { value: normalizeVersion(line), problem: null }
    : { value: null, problem: `${NVMRC}: line 1 is empty` };
}

/**
 * Collects every value of `key` anywhere in a parsed document, with its dotted path.
 *
 * @param {unknown} node The parsed document or a part of it.
 * @param {string} key The key to collect.
 * @param {string} [prefix] The dotted path of `node`.
 * @returns {Array<{ source: string, value: string }>} The values found.
 */
function collectKey(node, key, prefix = '') {
  if (node === null || typeof node !== 'object') {
    return [];
  }
  return Object.entries(node).flatMap(([name, child]) => {
    const where = prefix ? `${prefix}.${name}` : name;
    if (name === key && (child === null || typeof child !== 'object')) {
      return [{ source: where, value: String(child) }];
    }
    return collectKey(child, key, where);
  });
}

/**
 * Reads every `NODE_VERSION` and `YARN_VERSION` in `netlify.toml`.
 *
 * @returns {{ node: Array<{ source: string, value: string }>,
 *   yarn: Array<{ source: string, value: string }>, problem: string | null }}
 *   The declarations, or the problem.
 */
function readNetlifyVersions() {
  const file = readRepoFile(NETLIFY_TOML);
  if (file.problem) {
    return { node: [], yarn: [], problem: file.problem };
  }
  let document;
  try {
    document = parseToml(file.text);
  } catch (error) {
    return { node: [], yarn: [], problem: `${NETLIFY_TOML}: not valid TOML (${error.message})` };
  }
  const label = (entry) => ({ source: `${NETLIFY_TOML} ${entry.source}`, value: entry.value });
  return {
    node: collectKey(document, 'NODE_VERSION').map(label),
    yarn: collectKey(document, 'YARN_VERSION').map(label),
    problem: null,
  };
}

/**
 * Reads the version after `yarn@` in `package.json` `packageManager`.
 *
 * @returns {{ value: string | null, problem: string | null }} The version, or the problem.
 */
function readPackageManagerYarn() {
  const file = readRepoFile(PACKAGE_JSON);
  if (file.problem) {
    return { value: null, problem: file.problem };
  }
  let manifest;
  try {
    manifest = JSON.parse(file.text);
  } catch (error) {
    return { value: null, problem: `${PACKAGE_JSON}: not valid JSON (${error.message})` };
  }
  const match = /^yarn@([^+\s]+)/.exec(String(manifest.packageManager ?? ''));
  return match
    ? { value: normalizeVersion(match[1]), problem: null }
    : {
        value: null,
        problem: `${PACKAGE_JSON} packageManager is ${JSON.stringify(manifest.packageManager)}, not yarn@<version>`,
      };
}

/**
 * Reads every `actions/setup-node` step in `ci.yml`, with its job and name.
 *
 * @returns {{ steps: Array<{ where: string, with: Record<string, unknown> }>,
 *   problem: string | null }} The steps, or the problem.
 */
function readSetupNodeSteps() {
  const file = readRepoFile(CI_WORKFLOW);
  if (file.problem) {
    return { steps: [], problem: file.problem };
  }
  let workflow;
  try {
    workflow = YAML.parse(file.text);
  } catch (error) {
    return { steps: [], problem: `${CI_WORKFLOW}: not valid YAML (${error.message})` };
  }
  const jobs = workflow && typeof workflow.jobs === 'object' ? workflow.jobs : {};
  const steps = Object.entries(jobs ?? {}).flatMap(([jobId, job]) =>
    (Array.isArray(job?.steps) ? job.steps : [])
      .filter((step) => String(step?.uses ?? '').startsWith(SETUP_NODE_ACTION))
      .map((step) => ({
        where: `${CI_WORKFLOW} jobs.${jobId} step "${step.name ?? step.uses}"`,
        with: step.with && typeof step.with === 'object' ? step.with : {},
      }))
  );
  return { steps, problem: null };
}

/**
 * Lists every disagreement between a group of declarations.
 *
 * @param {string} kind `Node` or `Yarn`.
 * @param {Array<{ source: string, value: string }>} declarations The declarations.
 * @returns {string[]} One problem when the values differ, else none.
 */
function disagreement(kind, declarations) {
  const values = new Set(declarations.map((entry) => normalizeVersion(entry.value)));
  if (values.size <= 1) {
    return [];
  }
  const listed = declarations.map((entry) => `${entry.source} = ${entry.value}`).join('; ');
  return [`${kind} versions disagree: ${listed}`];
}

describe('runtime pins (S1, chain D)', () => {
  it('AC-7: .nvmrc, netlify.toml NODE_VERSION and the ci.yml setup-node step declare one Node major', () => {
    const nvmrc = readNvmrc();
    const netlify = readNetlifyVersions();
    const setupNode = readSetupNodeSteps();
    const problems = [nvmrc.problem, netlify.problem, setupNode.problem].filter(Boolean);

    const major = nvmrc.value === null ? null : majorOf(nvmrc.value);
    if (nvmrc.value !== null && major === null) {
      problems.push(`${NVMRC}: line 1 "${nvmrc.value}" has no major version`);
    }
    if (!netlify.problem && netlify.node.length === 0) {
      problems.push(`${NETLIFY_TOML}: declares no NODE_VERSION`);
    }
    for (const entry of netlify.node) {
      if (majorOf(entry.value) !== major) {
        problems.push(
          `${entry.source} = ${entry.value} (major ${majorOf(entry.value)}) differs from ${NVMRC} ${nvmrc.value} (major ${major})`
        );
      }
    }
    if (!setupNode.problem && setupNode.steps.length === 0) {
      problems.push(`${CI_WORKFLOW}: has no ${SETUP_NODE_ACTION} step`);
    }
    for (const step of setupNode.steps) {
      const version = step.with['node-version'];
      const versionFile = step.with['node-version-file'];
      if (version !== undefined && version !== null) {
        if (majorOf(version) !== major) {
          problems.push(
            `${step.where} node-version ${version} (major ${majorOf(version)}) differs from ${NVMRC} ${nvmrc.value} (major ${major})`
          );
        }
      } else if (versionFile !== undefined && versionFile !== null) {
        if (String(versionFile).trim().replace(/^\.\//, '') !== NVMRC) {
          problems.push(`${step.where} node-version-file is ${versionFile}, not ${NVMRC}`);
        }
      } else {
        problems.push(`${step.where} sets neither node-version nor node-version-file`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('AC-12: no two files disagree on the Node version or on the Yarn version', () => {
    const nvmrc = readNvmrc();
    const netlify = readNetlifyVersions();
    const packageManager = readPackageManagerYarn();
    const problems = [nvmrc.problem, netlify.problem, packageManager.problem].filter(Boolean);

    const nodeDeclarations = [
      ...(nvmrc.value === null ? [] : [{ source: `${NVMRC} line 1`, value: nvmrc.value }]),
      ...netlify.node,
    ];
    const yarnDeclarations = [
      ...netlify.yarn,
      ...(packageManager.value === null
        ? []
        : [{ source: `${PACKAGE_JSON} packageManager`, value: packageManager.value }]),
    ];
    problems.push(
      ...disagreement('Node', nodeDeclarations),
      ...disagreement('Yarn', yarnDeclarations)
    );

    expect(problems).toEqual([]);
  });
});
