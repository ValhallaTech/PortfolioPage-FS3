/**
 * @jest-environment node
 */
/**
 * Sprint 3 acceptance tests for GSAP's pin and the license that lets the page use it (spec
 * gsap-animations, sections 2.3 and 3.4 WI-4 and WI-8): AC-1, AC-3, and AC-2's manifest,
 * lockfile and `src` checks. AC-2's `dist` and notices checks are in `build-output.spec.js`.
 *
 * Offline: they read `package.json`, `yarn.lock`, `node_modules/gsap/package.json`, the files
 * under `src`, `README.md` and `LICENSE` from the working tree. Every failure is an `expect`
 * whose received value names the file and the values.
 *
 * AC-2's `src` check reads every file under `src` and skips the ones holding a NUL byte, as
 * ripgrep skips binary files, so the images are not searched.
 *
 * AC-3's permission text is the README `## License` section, from its heading to the next
 * heading of level 1 or 2, so its `###` permission heading is part of it. AD-12 puts the
 * permission there, so no linked file is read.
 *
 * AC-3's `LICENSE` check compares SHA-256 digests instead of reading `git show 5.0.0:LICENSE`,
 * because the gate's clone may lack the tag (WI-4). AD-12 keeps `LICENSE` byte-identical, so
 * equal digests are the contiguous-block check at its strictest.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The files the checks read, relative to the repo root. */
const PACKAGE_JSON = 'package.json';
const GSAP_PACKAGE_JSON = path.join('node_modules', 'gsap', 'package.json');
const PAGE_SCRIPT_DIR = path.join('src', 'js');
const SOURCE_DIR = 'src';
const LOCKFILE = 'yarn.lock';
const README = 'README.md';
const LICENSE = 'LICENSE';

/** AC-1: an exact version, with no range operator, tag or protocol. */
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/** AC-1: an import from `gsap` or one of its subpaths. */
const GSAP_IMPORT = /from ['"]gsap(\/[^'"]*)?['"]/;

/** AC-1: the page script's source files. */
const SCRIPT_FILE = /\.m?js$/;

/** AC-2: the libraries GSAP replaced, by package name. */
const REMOVED_PACKAGES = ['typed.js', 'scrollreveal'];

/** AC-2: the manifest fields a package can be declared in. */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];

/** AC-2: a lockfile entry for either removed library, as `rg -e '^"?(typed\.js|scrollreveal)@'`. */
const REMOVED_LOCK_ENTRY = /^"?(typed\.js|scrollreveal)@/;

/** AC-2: an import of either removed library, as `rg -e "from ['\"](typed\.js|scrollreveal)['\"]"`. */
const REMOVED_IMPORT = /from ['"](typed\.js|scrollreveal)['"]/;

/** AC-3: the `package.json` license field, with an optional SPDX exception. */
const LICENSE_FIELD = /^GPL-3\.0-only( WITH [A-Za-z0-9.+-]+)?$/;

/** AC-3: the SPDX identifier the README declares, and the one it must not (sprint 1 AC-100). */
const LICENSE_ID = 'GPL-3.0-only';
const OR_LATER_ID = 'GPL-3.0-or-later';

/** AC-3: the permission names GPLv3 section 7. */
const SECTION_SEVEN = /section 7|§\s?7/i;

/** AC-3: the library and the copyright holder the permission names (C-21). */
const LIBRARY_NAME = 'GSAP';
const COPYRIGHT_HOLDER = 'Valhalla Tech';

/**
 * AC-3: the SHA-256 of `LICENSE` at the `5.0.0` tag, in hex. Produced on 2026-11-20 with
 * `git show 5.0.0:LICENSE | sha256sum`.
 */
const LICENSE_5_0_0_SHA256 = '605e9047a563c5c8396ffb18232aa4304ec56586aee537c45064c6fb425e44ad';

/**
 * Reads a repo file as UTF-8.
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
 * Reads and parses a repo JSON file.
 *
 * @param {string} relative Path relative to the repo root.
 * @returns {{ json: Record<string, unknown>, problem: string | null }} The parsed object, or
 *   an empty object and the problem.
 */
function readRepoJson(relative) {
  const { text, problem } = readRepoFile(relative);
  if (problem) {
    return { json: {}, problem };
  }
  try {
    return { json: JSON.parse(text), problem: null };
  } catch (error) {
    return { json: {}, problem: `${relative}: is not valid JSON (${error.message})` };
  }
}

/**
 * Lists the script files under a repo folder, recursively, as repo-relative paths.
 *
 * @param {string} relative The folder, relative to the repo root.
 * @returns {string[]} The files, sorted.
 */
function listScripts(relative) {
  const entries = fs.readdirSync(path.join(REPO_ROOT, relative), { withFileTypes: true });
  return entries
    .flatMap((entry) => {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        return listScripts(child);
      }
      return entry.isFile() && SCRIPT_FILE.test(entry.name) ? [child] : [];
    })
    .sort();
}

/**
 * Lists every file under a repo folder, recursively, as repo-relative paths.
 *
 * @param {string} relative The folder, relative to the repo root.
 * @returns {string[]} The files, sorted.
 */
function listFiles(relative) {
  const entries = fs.readdirSync(path.join(REPO_ROOT, relative), { withFileTypes: true });
  return entries
    .flatMap((entry) => {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        return listFiles(child);
      }
      return entry.isFile() ? [child] : [];
    })
    .sort();
}

/**
 * Returns the lines of a text that match a pattern, each prefixed with its 1-based number.
 *
 * @param {string} text The text to search.
 * @param {RegExp} pattern The pattern each line is tested against.
 * @returns {string[]} The matching lines, as `<number>: <line>`.
 */
function matchingLines(text, pattern) {
  return text
    .split(/\r?\n/)
    .flatMap((line, index) => (pattern.test(line) ? [`${index + 1}: ${line}`] : []));
}

/**
 * Returns the README `## License` section's text after its heading, up to the next heading of
 * level 1 or 2. Headings inside fenced code blocks are ignored.
 *
 * @param {string} readme The README text.
 * @returns {string | null} The section text, or null when the heading is missing.
 */
function licenseSection(readme) {
  const lines = readme.split(/\r?\n/);
  let inFence = false;
  const outsideFence = lines.map((line) => {
    if (/^```/.test(line)) {
      inFence = !inFence;
      return false;
    }
    return !inFence;
  });
  const start = lines.findIndex(
    (line, index) => outsideFence[index] && line.trimEnd() === '## License'
  );
  if (start === -1) {
    return null;
  }
  const end = lines.findIndex(
    (line, index) => index > start && outsideFence[index] && /^#{1,2}\s/.test(line)
  );
  return lines.slice(start + 1, end === -1 ? lines.length : end).join('\n');
}

describe('AC-1: GSAP is installed and pinned exactly', () => {
  test('package.json declares gsap as a runtime dependency at an exact version', () => {
    // Arrange
    const { json, problem } = readRepoJson(PACKAGE_JSON);
    const declared = json.dependencies?.gsap ?? null;

    // Act
    const result = { problem, declared, exact: EXACT_VERSION.test(String(declared)) };

    // Assert
    expect(result).toEqual({ problem: null, declared, exact: true });
  });

  test('the installed gsap is the declared version', () => {
    // Arrange
    const manifest = readRepoJson(PACKAGE_JSON);
    const installed = readRepoJson(GSAP_PACKAGE_JSON);

    // Act
    const result = {
      problems: [manifest.problem, installed.problem].filter((p) => p !== null),
      installed: installed.json.version ?? null,
    };

    // Assert
    expect(result).toEqual({
      problems: [],
      installed: manifest.json.dependencies?.gsap ?? '(no gsap dependency)',
    });
  });

  test('at least one page script file imports gsap', () => {
    // Arrange
    const scripts = listScripts(PAGE_SCRIPT_DIR);

    // Act
    const importing = scripts.filter((file) => GSAP_IMPORT.test(readRepoFile(file).text ?? ''));

    // Assert
    expect({ scanned: scripts.length > 0, importsGsap: importing.length >= 1 }).toEqual({
      scanned: true,
      importsGsap: true,
    });
  });
});

describe('AC-2: Typed.js and ScrollReveal are gone from the manifest, the lockfile and src', () => {
  test('package.json declares neither typed.js nor scrollreveal', () => {
    // Arrange
    const { json, problem } = readRepoJson(PACKAGE_JSON);

    // Act
    const removedDeclared = DEPENDENCY_FIELDS.flatMap((field) =>
      Object.keys(json[field] ?? {})
        .filter((name) => REMOVED_PACKAGES.includes(name))
        .map((name) => `${field}: ${name}`)
    );

    // Assert
    expect({ problem, removedDeclared }).toEqual({ problem: null, removedDeclared: [] });
  });

  test('yarn.lock has no typed.js or scrollreveal entry', () => {
    // Arrange
    const { text, problem } = readRepoFile(LOCKFILE);

    // Act
    const entries = matchingLines(text ?? '', REMOVED_LOCK_ENTRY);

    // Assert
    expect({ file: LOCKFILE, problem, entries }).toEqual({
      file: LOCKFILE,
      problem: null,
      entries: [],
    });
  });

  test('no file under src imports typed.js or scrollreveal', () => {
    // Arrange
    const textFiles = listFiles(SOURCE_DIR).filter(
      (file) => !fs.readFileSync(path.join(REPO_ROOT, file)).includes(0)
    );

    // Act
    const imports = textFiles.flatMap((file) =>
      matchingLines(readRepoFile(file).text ?? '', REMOVED_IMPORT).map((line) => `${file}:${line}`)
    );

    // Assert
    expect({ scanned: textFiles.length > 0, imports }).toEqual({ scanned: true, imports: [] });
  });
});

describe('AC-3: the repository stays GPL-3.0-only and carries the section 7 permission for GSAP', () => {
  test('the package.json license field is GPL-3.0-only, with an optional exception', () => {
    // Arrange
    const { json, problem } = readRepoJson(PACKAGE_JSON);
    const license = json.license ?? null;

    // Act
    const result = { problem, license, matches: LICENSE_FIELD.test(String(license)) };

    // Assert
    expect(result).toEqual({ problem: null, license, matches: true });
  });

  test('the README License section names GPL-3.0-only and not GPL-3.0-or-later', () => {
    // Arrange
    const { text, problem } = readRepoFile(README);
    const section = text === null ? null : licenseSection(text);

    // Act
    const result = {
      problem,
      hasSection: section !== null,
      declaresOnly: (section ?? '').includes(LICENSE_ID),
      declaresOrLater: (section ?? '').includes(OR_LATER_ID),
    };

    // Assert
    expect(result).toEqual({
      problem: null,
      hasSection: true,
      declaresOnly: true,
      declaresOrLater: false,
    });
  });

  test('the permission text names GSAP, Valhalla Tech and GPLv3 section 7', () => {
    // Arrange
    const { text, problem } = readRepoFile(README);
    const permission = (text === null ? null : licenseSection(text)) ?? '';

    // Act
    const result = {
      problem,
      namesLibrary: permission.includes(LIBRARY_NAME),
      namesCopyrightHolder: permission.includes(COPYRIGHT_HOLDER),
      namesSectionSeven: SECTION_SEVEN.test(permission),
    };

    // Assert
    expect(result).toEqual({
      problem: null,
      namesLibrary: true,
      namesCopyrightHolder: true,
      namesSectionSeven: true,
    });
  });

  test('LICENSE is byte-identical to LICENSE at 5.0.0', () => {
    // Arrange
    let digest;
    try {
      const bytes = fs.readFileSync(path.join(REPO_ROOT, LICENSE));
      digest = crypto.createHash('sha256').update(bytes).digest('hex');
    } catch (error) {
      digest = `${LICENSE}: cannot be read (${error.message})`;
    }

    // Act
    const result = { file: LICENSE, sha256: digest };

    // Assert
    expect(result).toEqual({ file: LICENSE, sha256: LICENSE_5_0_0_SHA256 });
  });
});
