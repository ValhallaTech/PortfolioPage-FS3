/**
 * Syncs the pinned Node and Yarn versions in package.json, .nvmrc and netlify.toml with the
 * latest stable releases in their current majors (D-9). The scheduled
 * sync-runtime-versions.yml workflow runs this file directly.
 *
 * Stub (WI-14): syncRuntimeVersions resolves { changed: false, files: [] } and touches nothing.
 * WI-16 implements the sync behind the same signature.
 */

import { exec } from 'node:child_process';
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
 * @property {string[]} files The paths of the files that were written.
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
 * Syncs the Node and Yarn pins under `cwd` with the latest releases in their current majors.
 *
 * @param {SyncRuntimeVersionsOptions} [options]
 * @returns {Promise<SyncRuntimeVersionsResult>} Which files were written, if any.
 */
/* eslint-disable no-unused-vars -- WI-14 stub: §3.7 chain E fixes these parameters and WI-16 uses them. */
export async function syncRuntimeVersions({
  cwd = process.cwd(),
  fetchYarnVersions = fetchYarnVersionsFromNpm,
  fetchNodeIndex = fetchNodeIndexFromNodejsOrg,
} = {}) {
  return { changed: false, files: [] };
}
/* eslint-enable no-unused-vars */

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await syncRuntimeVersions();
  } catch (error) {
    process.stderr.write(
      `sync-runtime-versions: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
