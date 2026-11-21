/**
 * Writes dist/THIRD-PARTY-NOTICES.txt from the license files of the direct runtime dependencies (F1).
 * The Parcel production build strips license comments from the bundles, so this file carries
 * the copyright and permission notices that the deployed site must ship. `yarn build` runs it
 * right after Parcel.
 *
 * Runtime dependencies are the keys of package.json `dependencies`, and only those: the
 * notices cover the direct dependencies, not the packages they pull in transitively. Each one
 * is read from its installed package under node_modules, never from the version descriptor,
 * which may be a `patch:` or other protocol string. The output is sorted by package name and
 * holds no timestamp, so the same install always produces the same bytes.
 *
 * License files are the LICENSE*, LICENCE* and COPYING* files in the installed package's root.
 * When a dependency ships none, the script falls back to the same files in the repository's
 * third-party-licenses/<name>/ folder, where a scoped name such as @scope/pkg becomes nested
 * folders, as it does under node_modules. Those terms are held in the repository because the
 * package does not carry them; each such section is labeled with its repository path,
 * `--- third-party-licenses/<name>/<file> ---`. The package's own files always win: the
 * folder is read only when the package root has no license file.
 *
 * A dependency with no license file in either place is skipped: it is left out of the
 * notices, a warning naming it goes to stderr, and the run still succeeds.
 *
 * The run exits 1, with the reason on stderr, when:
 *   - dist/ does not exist (run the Parcel build first);
 *   - the repository's package.json cannot be read or parsed;
 *   - a `dependencies` key is not a valid npm package name;
 *   - a dependency is not installed, or its package.json cannot be read or parsed;
 *   - reading a license file, reading an existing third-party-licenses/<name>/ folder, or
 *     writing the notices file fails.
 * In every case but the last, nothing is written. Otherwise it exits 0.
 *
 * Usage: node scripts/third-party-notices.mjs
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_NAME = 'third-party-notices';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGE_JSON_FILE = 'package.json';
const NODE_MODULES_DIR = 'node_modules';
const DIST_DIR = 'dist';
const NOTICES_FILE = 'THIRD-PARTY-NOTICES.txt';

/** The repository folder holding license terms for packages that ship none. */
const REPO_LICENSES_DIR = 'third-party-licenses';

/** readdir error codes that mean the fallback folder is simply absent. */
const MISSING_DIRECTORY_CODES = new Set(['ENOENT', 'ENOTDIR']);

/** A license file in a package root: LICENSE*, LICENCE* or COPYING*, in any case. */
const LICENSE_FILE_PATTERN = /^(licen[cs]e|copying)/i;

/** A UTF-8 byte order mark at the start of a file, written as an escape. */
const LEADING_BYTE_ORDER_MARK = /^\u{FEFF}/u;

/**
 * An npm package name, optionally scoped. It rejects `.`, `..`, separators and anything else
 * that could move the resolved path out of node_modules.
 */
const PACKAGE_NAME_PATTERN = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

const HEADER_RULE = '='.repeat(80);
const NOTICES_PREAMBLE = [
  'THIRD-PARTY NOTICES',
  '',
  'This site bundles the runtime dependencies below. Each section gives the package name,',
  'its installed version, the license it declares, and the full text of its license file.',
].join('\n');
const UNDECLARED_LICENSE = 'UNDECLARED';

/**
 * @typedef {object} DependencyNotice
 * @property {string} name The installed package's name.
 * @property {string} version The installed package's version.
 * @property {string} license The package.json `license` field, or UNDECLARED.
 * @property {{ file: string, text: string }[]} licenseFiles Each license file and its text.
 *   `file` is the bare file name for a file in the package root, and the repository-relative
 *   path, `third-party-licenses/<name>/<file>`, for one read from the fallback folder.
 */

/**
 * @typedef {object} WriteThirdPartyNoticesOptions
 * @property {string} [cwd] The repository root holding package.json, node_modules and dist.
 *   Defaults to the repository this script lives in.
 */

/**
 * @typedef {object} WriteThirdPartyNoticesResult
 * @property {string} file The absolute path of the written notices file.
 * @property {number} count How many dependencies the file lists.
 * @property {string[]} skipped The dependencies left out because neither the package nor
 *   third-party-licenses/<name>/ has a license file, sorted by name.
 */

/**
 * Compares two strings by UTF-16 code unit, so the order never depends on the host locale.
 *
 * @param {string} left The first string.
 * @param {string} right The second string.
 * @returns {number} A negative number, zero or a positive number, as Array#sort expects.
 */
function compareCodeUnits(left, right) {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * Reads and parses a JSON file.
 *
 * @param {string} file The absolute path.
 * @returns {Promise<Record<string, unknown>>} The parsed object.
 */
async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Normalizes license text so the output is the same on every platform: LF line endings, no
 * trailing whitespace on any line, and no leading or trailing blank lines.
 *
 * @param {string} text The raw file content.
 * @returns {string} The normalized text.
 */
function normalizeLicenseText(text) {
  return text
    .replace(LEADING_BYTE_ORDER_MARK, '')
    .split(/\r\n|\r|\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

/**
 * Lists the license files in a package root, sorted by file name.
 *
 * @param {string} packageDir The absolute path of the installed package.
 * @returns {Promise<string[]>} The matching regular-file names; empty when there are none.
 */
export async function findLicenseFiles(packageDir) {
  const entries = await readdir(packageDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && LICENSE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareCodeUnits);
}

/**
 * Lists the license files in a folder that may not exist, as findLicenseFiles does.
 *
 * @param {string} dir The absolute path of the folder.
 * @returns {Promise<string[]>} The matching file names; empty when the folder is absent.
 * @throws {Error} When the folder exists but cannot be read.
 */
async function findOptionalLicenseFiles(dir) {
  try {
    return await findLicenseFiles(dir);
  } catch (error) {
    if (error instanceof Error && 'code' in error && MISSING_DIRECTORY_CODES.has(error.code)) {
      return [];
    }
    throw error;
  }
}

/**
 * Reads and normalizes the named license files in one folder.
 *
 * @param {string} dir The absolute path of the folder.
 * @param {string[]} files The file names to read, in output order.
 * @param {(file: string) => string} label Maps a file name to its section label.
 * @returns {Promise<{ file: string, text: string }[]>} Each file's label and normalized text.
 */
async function readLicenseFiles(dir, files, label) {
  const licenseFiles = [];
  for (const file of files) {
    const text = normalizeLicenseText(await readFile(path.join(dir, file), 'utf8'));
    licenseFiles.push({ file: label(file), text });
  }
  return licenseFiles;
}

/**
 * Reads one installed runtime dependency's identity and license files. The license files come
 * from the package root or, when it has none, from third-party-licenses/<name>/.
 *
 * @param {string} root The repository root.
 * @param {string} dependency The key from package.json `dependencies`.
 * @returns {Promise<DependencyNotice>} The notice; `licenseFiles` is empty when neither place
 *   has a license file.
 * @throws {Error} When the name is not a valid package name, the package is not installed, or
 *   a license file or the fallback folder cannot be read.
 */
export async function readDependencyNotice(root, dependency) {
  // The name check must stay ahead of every path join below: it is what keeps `dependency`
  // from steering either path out of node_modules or third-party-licenses.
  if (!PACKAGE_NAME_PATTERN.test(dependency)) {
    throw new Error(`"${dependency}" is not a valid package name`);
  }
  const nameSegments = dependency.split('/');
  const packageDir = path.join(root, NODE_MODULES_DIR, ...nameSegments);
  let manifest;
  try {
    manifest = await readJson(path.join(packageDir, PACKAGE_JSON_FILE));
  } catch (error) {
    throw new Error(
      `cannot read the installed package ${dependency}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  let licenseFiles = await readLicenseFiles(
    packageDir,
    await findLicenseFiles(packageDir),
    (file) => file
  );
  if (licenseFiles.length === 0) {
    const repoHeldDir = path.join(root, REPO_LICENSES_DIR, ...nameSegments);
    licenseFiles = await readLicenseFiles(
      repoHeldDir,
      await findOptionalLicenseFiles(repoHeldDir),
      (file) => [REPO_LICENSES_DIR, ...nameSegments, file].join('/')
    );
  }
  return {
    name: String(manifest.name ?? dependency),
    version: String(manifest.version ?? ''),
    license: typeof manifest.license === 'string' ? manifest.license : UNDECLARED_LICENSE,
    licenseFiles,
  };
}

/**
 * Formats the notices file from the collected dependency notices.
 *
 * @param {DependencyNotice[]} notices The notices, in any order.
 * @returns {string} The file content, sorted by package name and ending in one newline.
 */
export function formatNotices(notices) {
  const sections = [...notices]
    .sort((left, right) => compareCodeUnits(left.name, right.name))
    .map((notice) =>
      [
        HEADER_RULE,
        `${notice.name} ${notice.version}`,
        `License: ${notice.license}`,
        HEADER_RULE,
        ...notice.licenseFiles.flatMap(({ file, text }) => ['', `--- ${file} ---`, '', text]),
      ].join('\n')
    );
  return `${[NOTICES_PREAMBLE, ...sections].join('\n\n')}\n`;
}

/**
 * Confirms that `dir` exists and is a directory.
 *
 * @param {string} dir The absolute path.
 * @returns {Promise<boolean>} True when it is a directory.
 */
async function isDirectory(dir) {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Writes dist/THIRD-PARTY-NOTICES.txt for every runtime dependency that has a license file,
 * in its package root or in third-party-licenses/<name>/.
 *
 * @param {WriteThirdPartyNoticesOptions} [options] The repository root override.
 * @returns {Promise<WriteThirdPartyNoticesResult>} The written path, the listed count and the
 *   dependencies skipped for having no license file in either place.
 * @throws {Error} When dist/ is missing, package.json cannot be read, a dependency name is
 *   invalid, a dependency is not installed, or a file read or the write fails. Except for a
 *   failed write, nothing is written.
 */
export async function writeThirdPartyNotices({ cwd = REPO_ROOT } = {}) {
  const root = path.resolve(cwd);
  const distDir = path.join(root, DIST_DIR);
  if (!(await isDirectory(distDir))) {
    throw new Error(`${distDir} does not exist; run the Parcel build first`);
  }

  const manifest = await readJson(path.join(root, PACKAGE_JSON_FILE));
  const dependencies = Object.keys(manifest.dependencies ?? {});
  const notices = await Promise.all(
    dependencies.map((dependency) => readDependencyNotice(root, dependency))
  );

  const licensed = notices.filter((notice) => notice.licenseFiles.length > 0);
  const skipped = notices
    .filter((notice) => notice.licenseFiles.length === 0)
    .map((notice) => notice.name)
    .sort(compareCodeUnits);

  const file = path.join(distDir, NOTICES_FILE);
  await writeFile(file, formatNotices(licensed), 'utf8');
  return { file, count: licensed.length, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { file, count, skipped } = await writeThirdPartyNotices();
    for (const name of skipped) {
      process.stderr.write(
        `${SCRIPT_NAME}: warning: ${name} ships no LICENSE*, LICENCE* or COPYING* file, and ${REPO_LICENSES_DIR}/${name}/ has none either; skipped\n`
      );
    }
    process.stdout.write(`${SCRIPT_NAME}: wrote ${count} notices to ${file}\n`);
  } catch (error) {
    process.stderr.write(
      `${SCRIPT_NAME}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
