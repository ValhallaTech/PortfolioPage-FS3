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
 * A dependency that ships no LICENSE*, LICENCE* or COPYING* file is skipped: it is left out of
 * the notices, a warning naming it goes to stderr, and the run still succeeds. Providing one
 * is that package's responsibility.
 *
 * The run exits 1, with the reason on stderr, when:
 *   - dist/ does not exist (run the Parcel build first);
 *   - the repository's package.json cannot be read or parsed;
 *   - a `dependencies` key is not a valid npm package name;
 *   - a dependency is not installed, or its package.json cannot be read or parsed;
 *   - reading a license file or writing the notices file fails.
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
 * @property {string[]} skipped The dependencies left out because they ship no license file,
 *   sorted by name.
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
 * Reads one installed runtime dependency's identity and license files.
 *
 * @param {string} root The repository root.
 * @param {string} dependency The key from package.json `dependencies`.
 * @returns {Promise<DependencyNotice>} The notice; `licenseFiles` is empty when none exist.
 * @throws {Error} When the name is not a valid package name or the package is not installed.
 */
export async function readDependencyNotice(root, dependency) {
  if (!PACKAGE_NAME_PATTERN.test(dependency)) {
    throw new Error(`"${dependency}" is not a valid package name`);
  }
  const packageDir = path.join(root, NODE_MODULES_DIR, ...dependency.split('/'));
  let manifest;
  try {
    manifest = await readJson(path.join(packageDir, PACKAGE_JSON_FILE));
  } catch (error) {
    throw new Error(
      `cannot read the installed package ${dependency}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  const licenseFiles = [];
  for (const file of await findLicenseFiles(packageDir)) {
    const text = normalizeLicenseText(await readFile(path.join(packageDir, file), 'utf8'));
    licenseFiles.push({ file, text });
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
 * Writes dist/THIRD-PARTY-NOTICES.txt for every runtime dependency that ships a license file.
 *
 * @param {WriteThirdPartyNoticesOptions} [options] The repository root override.
 * @returns {Promise<WriteThirdPartyNoticesResult>} The written path, the listed count and the
 *   dependencies skipped for having no license file.
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
        `${SCRIPT_NAME}: warning: ${name} ships no LICENSE*, LICENCE* or COPYING* file; skipped\n`
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
