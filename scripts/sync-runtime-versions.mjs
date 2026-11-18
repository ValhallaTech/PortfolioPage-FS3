/**
 * Syncs the pinned Node and Yarn versions in package.json, .nvmrc and netlify.toml with the
 * latest stable releases in their current majors (D-9). The scheduled
 * sync-runtime-versions.yml workflow runs this file directly.
 *
 * Every fetched version must match a strict x.y.z pattern before it can reach a file, and the
 * script writes only the three pinned files, directly inside `cwd`, and only when a file's
 * content changes. A run with nothing to update writes nothing and resolves normally.
 */

import { exec } from 'node:child_process';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * A fixed command with no interpolated values. It runs through the shell because npm is a
 * .cmd shim on Windows, which Node refuses to start without one.
 */
const YARN_VERSIONS_COMMAND = 'npm view @yarnpkg/cli-dist versions --json';
const NODE_INDEX_URL = 'https://nodejs.org/dist/index.json';
const FETCH_TIMEOUT_MS = 60_000;
const MAX_COMMAND_OUTPUT_BYTES = 16 * 1024 * 1024;

const PACKAGE_JSON_FILE = 'package.json';
const NVMRC_FILE = '.nvmrc';
const NETLIFY_TOML_FILE = 'netlify.toml';

/**
 * A stable release version: three dot-separated integers without leading zeros, at most nine
 * digits each, and nothing else. No prerelease or build suffix, no whitespace, no quotes.
 */
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

/** `yarn@X.Y.Z`, optionally followed by Corepack's `+<algorithm>.<hash>` suffix. */
const PACKAGE_MANAGER_PATTERN = /^yarn@((0|[1-9]\d{0,8})\.\d+\.\d+)(?:\+[\w.-]+)?$/;

/** Line 1 of `.nvmrc`: a version whose major is the Node line to follow. */
const NVMRC_PATTERN = /^v?(0|[1-9]\d{0,8})\./;

/**
 * Every `NODE_VERSION = "..."` assignment in netlify.toml, on one line. Group 1 is everything
 * up to and including the opening quote, so a replacement changes only the quoted value.
 */
const NODE_VERSION_ASSIGNMENT = /\b(NODE_VERSION[ \t]*=[ \t]*")[^"\r\n]*"/g;

/** Every `YARN_VERSION = "..."` assignment in netlify.toml, shaped like NODE_VERSION's. */
const YARN_VERSION_ASSIGNMENT = /\b(YARN_VERSION[ \t]*=[ \t]*")[^"\r\n]*"/g;

/**
 * @typedef {object} NodeIndexEntry
 * @property {string} version A release version with a leading "v", for example "v26.1.0".
 */

/**
 * @typedef {object} SyncRuntimeVersionsOptions
 * @property {string} [cwd] The repository root holding the pinned files. Defaults to the
 *   current working directory.
 * @property {() => Promise<string[]>} [fetchYarnVersions] Resolves every published
 *   @yarnpkg/cli-dist version string.
 * @property {() => Promise<NodeIndexEntry[]>} [fetchNodeIndex] Resolves the parsed
 *   nodejs.org/dist/index.json array.
 */

/**
 * @typedef {object} SyncRuntimeVersionsResult
 * @property {boolean} changed Whether any file was written.
 * @property {string[]} files The repo-relative paths of the files that were written.
 */

/**
 * Lists every published @yarnpkg/cli-dist version through `npm view`.
 *
 * @returns {Promise<string[]>} The version strings npm prints.
 * @throws {Error} When npm fails or prints something other than JSON.
 */
export async function fetchYarnVersionsFromNpm() {
  const { stdout } = await execAsync(YARN_VERSIONS_COMMAND, {
    encoding: 'utf8',
    maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    timeout: FETCH_TIMEOUT_MS,
    windowsHide: true,
  });
  return JSON.parse(stdout);
}

/**
 * Downloads and parses the Node.js release index.
 *
 * @returns {Promise<NodeIndexEntry[]>} The parsed index.json array.
 * @throws {Error} When the request fails, times out or returns a non-2xx status.
 */
export async function fetchNodeIndexFromNodejsOrg() {
  const response = await fetch(NODE_INDEX_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${NODE_INDEX_URL}: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Parses a stable x.y.z version.
 *
 * @param {unknown} value The candidate.
 * @returns {number[] | null} The three numeric parts, or null when `value` is not stable x.y.z.
 */
function parseStableVersion(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = STABLE_VERSION_PATTERN.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/**
 * Compares two parsed versions part by part.
 *
 * @param {number[]} a The first version's parts.
 * @param {number[]} b The second version's parts.
 * @returns {number} A positive number when `a` is newer, negative when older, 0 when equal.
 */
function compareVersionParts(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}

/**
 * Picks the newest stable x.y.z version in `major`. Anything that is not a stable x.y.z
 * string is ignored, so it can never be returned.
 *
 * @param {unknown[]} versions The candidates.
 * @param {number} major The major to stay on.
 * @returns {string | null} The newest matching version, or null when none matches.
 */
function latestStableForMajor(versions, major) {
  let latest = null;
  for (const version of versions) {
    const parts = parseStableVersion(version);
    if (parts && parts[0] === major && (!latest || compareVersionParts(parts, latest.parts) > 0)) {
      latest = { version: /** @type {string} */ (version), parts };
    }
  }
  return latest ? latest.version : null;
}

/**
 * Reads one of the pinned files, refusing anything that is not a regular file (a symbolic
 * link could point the later write outside `root`).
 *
 * @param {string} root The absolute repository root.
 * @param {string} file The file name directly inside `root`.
 * @returns {Promise<string>} The file's UTF-8 content.
 * @throws {Error} When the file is missing, unreadable or not a regular file.
 */
async function readPinnedFile(root, file) {
  const filePath = path.join(root, file);
  const stats = await lstat(filePath);
  if (!stats.isFile()) {
    throw new Error(`${file} is not a regular file`);
  }
  return readFile(filePath, 'utf8');
}

/**
 * Reads the Yarn pin from package.json.
 *
 * @param {string} content The package.json text.
 * @returns {{ packageJson: Record<string, unknown>, version: string, major: number }}
 * @throws {Error} When package.json is not an object or `packageManager` is not yarn@X.Y.Z.
 */
function parsePackageJson(content) {
  const packageJson = JSON.parse(content);
  if (!packageJson || typeof packageJson !== 'object' || Array.isArray(packageJson)) {
    throw new Error(`${PACKAGE_JSON_FILE} is not a JSON object`);
  }
  const match =
    typeof packageJson.packageManager === 'string'
      ? PACKAGE_MANAGER_PATTERN.exec(packageJson.packageManager)
      : null;
  if (!match) {
    throw new Error(`Could not parse a yarn@X.Y.Z packageManager from ${PACKAGE_JSON_FILE}`);
  }
  return { packageJson, version: match[1], major: Number(match[2]) };
}

/**
 * Reads the Node major from line 1 of .nvmrc.
 *
 * @param {string} content The .nvmrc text.
 * @returns {number} The Node major.
 * @throws {Error} When line 1 does not start with a version.
 */
function parseNvmrcMajor(content) {
  const match = NVMRC_PATTERN.exec(content.trim());
  if (!match) {
    throw new Error(`Could not parse a Node major from ${NVMRC_FILE}`);
  }
  return Number(match[1]);
}

/**
 * Picks the newest stable Yarn release of `major` from the fetched version list.
 *
 * @param {unknown} versions What the Yarn fetcher resolved.
 * @param {number} major The packageManager Yarn major.
 * @returns {string} The newest stable x.y.z release.
 * @throws {Error} When the list is invalid or holds no stable release of `major`.
 */
function selectLatestYarn(versions, major) {
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error('Yarn versions response was empty or invalid');
  }
  const latest = latestStableForMajor(versions, major);
  if (!latest) {
    throw new Error(`No stable Yarn ${major}.x release found`);
  }
  return latest;
}

/**
 * Picks the newest stable Node release of `major` from the fetched release index.
 *
 * @param {unknown} index What the Node index fetcher resolved.
 * @param {number} major The .nvmrc Node major.
 * @returns {string} The newest stable x.y.z release, without the leading "v".
 * @throws {Error} When the index is invalid or holds no stable release of `major`.
 */
function selectLatestNode(index, major) {
  if (!Array.isArray(index) || index.length === 0) {
    throw new Error('Node.js release index response was empty or invalid');
  }
  const versions = index.map((entry) =>
    entry && typeof entry.version === 'string' && entry.version.startsWith('v')
      ? entry.version.slice(1)
      : null
  );
  const latest = latestStableForMajor(versions, major);
  if (!latest) {
    throw new Error(`No stable Node ${major}.x release found`);
  }
  return latest;
}

/**
 * Builds the package.json text with `packageManager` set to `yarn@<latestYarn>`, or returns
 * the original text when the pinned version already equals it.
 *
 * @param {string} content The current package.json text.
 * @param {{ packageJson: Record<string, unknown>, version: string }} pin The parsed pin.
 * @param {string} latestYarn A validated stable x.y.z version.
 * @returns {string} The package.json text to keep.
 */
function updatePackageJson(content, pin, latestYarn) {
  if (pin.version === latestYarn) {
    return content;
  }
  const updated = { ...pin.packageJson, packageManager: `yarn@${latestYarn}` };
  return `${JSON.stringify(updated, null, 2)}\n`;
}

/**
 * Sets every `NODE_VERSION`, and every `YARN_VERSION` if the key exists, in netlify.toml.
 *
 * @param {string} content The current netlify.toml text.
 * @param {string} latestNode A validated stable x.y.z version.
 * @param {string} latestYarn A validated stable x.y.z version.
 * @returns {string} The netlify.toml text to keep.
 * @throws {Error} When netlify.toml has no `NODE_VERSION` assignment.
 */
function updateNetlifyToml(content, latestNode, latestYarn) {
  if (!content.match(NODE_VERSION_ASSIGNMENT)) {
    throw new Error(`${NETLIFY_TOML_FILE} has no NODE_VERSION assignment`);
  }
  // Replacer functions keep `$` sequences in the replacement from being interpreted, and the
  // captured prefix keeps each assignment's own spacing, so an unchanged value is a no-op.
  return content
    .replace(NODE_VERSION_ASSIGNMENT, (_, prefix) => `${prefix}${latestNode}"`)
    .replace(YARN_VERSION_ASSIGNMENT, (_, prefix) => `${prefix}${latestYarn}"`);
}

/**
 * Syncs the Node and Yarn pins under `cwd` with the latest releases in their current majors.
 * It writes package.json, .nvmrc and netlify.toml only where their content changes, and
 * resolves normally when nothing has drifted.
 *
 * @param {SyncRuntimeVersionsOptions} [options]
 * @returns {Promise<SyncRuntimeVersionsResult>} Which files were written, if any.
 * @throws {Error} When a pinned file is missing or malformed, or a fetch fails or holds no
 *   stable release of the pinned major.
 */
export async function syncRuntimeVersions({
  cwd = process.cwd(),
  fetchYarnVersions = fetchYarnVersionsFromNpm,
  fetchNodeIndex = fetchNodeIndexFromNodejsOrg,
} = {}) {
  const root = path.resolve(cwd);
  const [packageJsonContent, nvmrcContent, netlifyContent] = await Promise.all([
    readPinnedFile(root, PACKAGE_JSON_FILE),
    readPinnedFile(root, NVMRC_FILE),
    readPinnedFile(root, NETLIFY_TOML_FILE),
  ]);
  const yarnPin = parsePackageJson(packageJsonContent);
  const nodeMajor = parseNvmrcMajor(nvmrcContent);

  const [yarnVersions, nodeIndex] = await Promise.all([fetchYarnVersions(), fetchNodeIndex()]);
  const latestYarn = selectLatestYarn(yarnVersions, yarnPin.major);
  const latestNode = selectLatestNode(nodeIndex, nodeMajor);

  const planned = [
    [
      PACKAGE_JSON_FILE,
      packageJsonContent,
      updatePackageJson(packageJsonContent, yarnPin, latestYarn),
    ],
    [NVMRC_FILE, nvmrcContent, `${latestNode}\n`],
    [NETLIFY_TOML_FILE, netlifyContent, updateNetlifyToml(netlifyContent, latestNode, latestYarn)],
  ];
  const files = [];
  for (const [file, before, after] of planned) {
    if (after !== before) {
      await writeFile(path.join(root, file), after, 'utf8');
      files.push(file);
    }
  }
  return { changed: files.length > 0, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { files } = await syncRuntimeVersions();
    process.stdout.write(
      files.length > 0
        ? `sync-runtime-versions: updated ${files.join(', ')}\n`
        : 'sync-runtime-versions: all pins are current\n'
    );
  } catch (error) {
    process.stderr.write(
      `sync-runtime-versions: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
