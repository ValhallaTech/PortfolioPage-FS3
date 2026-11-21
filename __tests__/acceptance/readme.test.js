/**
 * @jest-environment jsdom
 */
/**
 * S1 acceptance tests for the README (spec stabilize-and-cleanup, sections 2.3 and
 * 3.4 WI-62): AC-95, AC-96, AC-98, AC-99, AC-100 and AC-101.
 *
 * The jsdom environment is used only so AC-98 can read the footer's `.copyright`
 * element with `DOMParser`; every other check reads files as text.
 *
 * AC-95 skips every README line that mentions Corepack, for all three of its checks.
 * A line mentions Node when it matches `\bNode(\.js)?\b`; a stated Node major is the
 * number right after "Node" or "Node.js" (Markdown link syntax removed first), with or
 * without a `v`, whatever follows it (`26`, `26.13`, `26.13.1`). A stated version is a
 * whole `x.y.z`, with or without a `v` in front, that is not part of a longer dotted
 * number. The regression cases at the end drive the same check with synthetic lines,
 * so a pattern that misses `v24.15.0` or `Node 24.15` fails there. For the Tech Stack
 * check, every table row in the
 * `### Tech Stack` section is matched against `package.json` `dependencies` with this
 * mapping, on the row's first cell:
 *
 * | README row   | package                       |
 * | ------------ | ----------------------------- |
 * | Bootstrap    | bootstrap                     |
 * | GSAP         | gsap                          |
 * | Muuri        | muuri                         |
 * | Swiper       | swiper                        |
 * | GLightbox    | glightbox                     |
 * | Fontsource   | every `@fontsource/*` package |
 *
 * A row whose first cell starts with the exact name of a dependency is matched to
 * that dependency too. A row that maps to no installed package (the Font Awesome
 * sprite, every dev-tooling row) is skipped. The stated major is the first number in
 * the first cell after the library name.
 *
 * AC-96's patterns include two package names that the tracked-file guards in
 * `cleanup.test.js` ban, so those two are built from fragments.
 *
 * AC-101's smoke command script is `test:smoke` (spec section 3).
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const README = path.join(REPO_ROOT, 'README.md');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const NVMRC = path.join(REPO_ROOT, '.nvmrc');
const INDEX_HTML = path.join(REPO_ROOT, 'src', 'index.html');

/** The smoke command's script name (spec section 3). */
const SMOKE_SCRIPT = 'test:smoke';

/** The SPDX identifier the README and `package.json` declare (C-29). */
const LICENSE_ID = 'GPL-3.0-only';

/**
 * A three-part version, `v`-prefixed or not, that is not part of a longer dotted
 * number. `\b` is not used, because there is no word boundary between `v` and a digit.
 */
const SEMVER = /(?<![\d.])\d+\.\d+\.\d+(?!\.?\d)/g;

/** AC-95: a line that mentions Corepack is skipped. */
const COREPACK = /corepack/i;

/** AC-95: a line that mentions Node. */
const NODE_MENTION = /\bNode(?:\.js)?\b/i;

/**
 * AC-95: the Node major in every stated form (`26`, `v26`, `26.13`, `26.13.1`). A
 * mismatch in the rest of an `x.y.z` is caught by SEMVER.
 */
const NODE_MAJOR = /\bNode(?:\.js)?\s+v?(\d+)/gi;

/** AC-95: a line that mentions Yarn. */
const YARN_MENTION = /\byarn\b/i;

/** AC-95: README Tech Stack row names mapped to their `package.json` packages. */
const LIBRARY_PACKAGES = Object.freeze([
  { name: /^Bootstrap\b/i, packages: (deps) => deps.filter((dep) => dep === 'bootstrap') },
  { name: /^GSAP\b/i, packages: (deps) => deps.filter((dep) => dep === 'gsap') },
  { name: /^Muuri\b/i, packages: (deps) => deps.filter((dep) => dep === 'muuri') },
  { name: /^Swiper\b/i, packages: (deps) => deps.filter((dep) => dep === 'swiper') },
  { name: /^GLightbox\b/i, packages: (deps) => deps.filter((dep) => dep === 'glightbox') },
  {
    name: /^Fontsource\b/i,
    packages: (deps) => deps.filter((dep) => dep.startsWith('@fontsource/')),
  },
]);

/** AC-96: the known false claims, matched case-insensitively per line. */
const FALSE_CLAIMS = Object.freeze([
  /skills progress bars/i,
  /skill animation/i,
  new RegExp(['Box', 'icons'].join(''), 'i'),
  new RegExp(['just', '-validate'].join(''), 'i'),
  /ESLint 9/i,
  /16\.9\+/i,
  /fs3-portfolio/i,
  /kept in sync automatically/i,
  /must pass before a PR can be merged/i,
]);

/**
 * Reads a file as UTF-8. Never throws.
 *
 * @param {string} file Absolute path.
 * @returns {{ text: string, problem: string | null }} The text, or the problem.
 */
function readText(file) {
  try {
    return { text: fs.readFileSync(file, 'utf8'), problem: null };
  } catch (error) {
    return {
      text: '',
      problem: `${path.relative(REPO_ROOT, file)} could not be read: ${error.message}`,
    };
  }
}

/**
 * Reads `package.json`. Never throws.
 *
 * @returns {{ manifest: Record<string, unknown>, problem: string | null }} The parsed
 *   manifest, or the problem.
 */
function readManifest() {
  const { text, problem } = readText(PACKAGE_JSON);
  if (problem) {
    return { manifest: {}, problem };
  }
  try {
    return { manifest: JSON.parse(text), problem: null };
  } catch (error) {
    return { manifest: {}, problem: `package.json is not valid JSON: ${error.message}` };
  }
}

/**
 * Reads the README as lines, each marked as inside or outside a fenced code block.
 * Fence lines themselves count as inside.
 *
 * @returns {{ lines: { number: number, text: string, inFence: boolean }[], problem: string | null }}
 *   The lines, or the problem.
 */
function readReadme() {
  const { text, problem } = readText(README);
  let inFence = false;
  const lines = (problem ? [] : text.split(/\r?\n/)).map((line, index) => {
    const isFence = /^```/.test(line);
    const opensOrCloses = isFence && (!inFence || /^```\s*$/.test(line));
    const entry = { number: index + 1, text: line, inFence: inFence || opensOrCloses };
    if (opensOrCloses) {
      inFence = !inFence;
    }
    return entry;
  });
  return { lines, problem };
}

/**
 * Returns the lines of a README section, from its heading to the next heading of the
 * same or a higher level. Headings inside fenced code blocks are ignored.
 *
 * @param {{ number: number, text: string, inFence: boolean }[]} lines The README lines.
 * @param {string} heading The full heading line, such as `## License`.
 * @returns {{ number: number, text: string, inFence: boolean }[] | null} The section's
 *   lines after its heading, or null when the heading is missing.
 */
function section(lines, heading) {
  const level = heading.indexOf(' ');
  const start = lines.findIndex((line) => !line.inFence && line.text.trimEnd() === heading);
  if (start === -1) {
    return null;
  }
  const ends = new RegExp(`^#{1,${level}}\\s`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => !line.inFence && ends.test(line.text));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Removes Markdown link syntax, keeping the link text.
 *
 * @param {string} text A line.
 * @returns {string} The line with `[text](url)` replaced by `text`.
 */
function stripLinks(text) {
  return text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
}

/**
 * Extracts the major version from a `package.json` dependency specifier, including a
 * Yarn `patch:` specifier.
 *
 * @param {string} specifier The specifier.
 * @returns {number | null} The major, or null when none is found.
 */
function specifierMajor(specifier) {
  let decoded = specifier;
  try {
    decoded = decodeURIComponent(specifier);
  } catch {
    // Keep the raw specifier.
  }
  const match = /(?:^|[^\d.])\^?~?(\d+)\.\d+\.\d+/.exec(decoded);
  return match ? Number(match[1]) : null;
}

/**
 * AC-95: the Node and Yarn version mismatches on non-Corepack lines.
 *
 * @param {{ number: number, text: string }[]} lines The README lines.
 * @param {string} nodeVersion The `.nvmrc` version.
 * @param {string} yarnVersion The `packageManager` Yarn version.
 * @returns {string[]} Each mismatch.
 */
function runtimeMismatches(lines, nodeVersion, yarnVersion) {
  const nodeMajor = nodeVersion.split('.')[0];
  const mismatches = [];
  lines
    .filter((line) => !COREPACK.test(line.text))
    .forEach((line) => {
      const versions = line.text.match(SEMVER) ?? [];
      if (NODE_MENTION.test(line.text)) {
        versions
          .filter((version) => version !== nodeVersion)
          .forEach((version) =>
            mismatches.push(
              `README.md:${line.number}: Node line states ${version}, .nvmrc is ${nodeVersion}`
            )
          );
        [...stripLinks(line.text).matchAll(NODE_MAJOR)]
          .map((match) => match[1])
          .filter((major) => major !== nodeMajor)
          .forEach((major) =>
            mismatches.push(
              `README.md:${line.number}: Node major ${major}, .nvmrc major is ${nodeMajor}`
            )
          );
      }
      if (YARN_MENTION.test(line.text)) {
        versions
          .filter((version) => version !== yarnVersion)
          .forEach((version) =>
            mismatches.push(
              `README.md:${line.number}: Yarn line states ${version}, packageManager is ${yarnVersion}`
            )
          );
      }
    });
  return mismatches;
}

/**
 * AC-95: the Tech Stack runtime-library major mismatches.
 *
 * @param {{ number: number, text: string, inFence: boolean }[]} lines The README lines.
 * @param {Record<string, string>} dependencies `package.json` `dependencies`.
 * @returns {{ mismatches: string[], problems: string[] }} Each mismatch, and any
 *   problem that stopped the check.
 */
function techStackMismatches(lines, dependencies) {
  const techStack = section(lines, '### Tech Stack');
  if (techStack === null) {
    return { mismatches: [], problems: ['README.md has no "### Tech Stack" section'] };
  }
  const names = Object.keys(dependencies);
  const mismatches = [];
  let mapped = 0;
  techStack
    .filter((line) => !line.inFence && !COREPACK.test(line.text) && /^\s*\|/.test(line.text))
    .forEach((line) => {
      const cell = line.text.split('|')[1].replace(/`/g, '').trim();
      const rule = LIBRARY_PACKAGES.find((entry) => entry.name.test(cell));
      const exact = names.find((name) => cell.toLowerCase().startsWith(`${name.toLowerCase()} `));
      const packages = rule ? rule.packages(names) : exact ? [exact] : [];
      if (packages.length === 0) {
        return;
      }
      mapped += 1;
      const libraryName = rule ? rule.name.exec(cell)[0] : exact;
      const stated = /\d+/.exec(cell.slice(libraryName.length));
      if (!stated) {
        return;
      }
      packages.forEach((name) => {
        const major = specifierMajor(dependencies[name]);
        if (major !== Number(stated[0])) {
          mismatches.push(
            `README.md:${line.number}: "${cell}" states major ${stated[0]}, ${name} is ${dependencies[name]}`
          );
        }
      });
    });
  const problems =
    mapped === 0 ? ['README.md Tech Stack has no row naming an installed runtime package'] : [];
  return { mismatches, problems };
}

test('AC-95: the README version statements match .nvmrc and package.json', () => {
  // Arrange
  const readme = readReadme();
  const nvmrc = readText(NVMRC);
  const { manifest, problem: manifestProblem } = readManifest();
  const nodeVersion = nvmrc.text.trim();
  const yarnVersion = /^yarn@(\d+\.\d+\.\d+)/.exec(String(manifest.packageManager ?? ''))?.[1];
  const problems = [readme.problem, nvmrc.problem, manifestProblem].filter((p) => p !== null);
  if (!yarnVersion && !manifestProblem) {
    problems.push(`package.json packageManager is not yarn@x.y.z: ${manifest.packageManager}`);
  }

  // Act
  const runtime =
    problems.length === 0 ? runtimeMismatches(readme.lines, nodeVersion, yarnVersion) : [];
  const techStack =
    problems.length === 0
      ? techStackMismatches(readme.lines, manifest.dependencies ?? {})
      : { mismatches: [], problems: [] };

  // Assert
  expect({
    problems: [...problems, ...techStack.problems],
    mismatches: [...runtime, ...techStack.mismatches],
  }).toEqual({ problems: [], mismatches: [] });
});

describe('AC-95 regression: the runtime check on synthetic README lines', () => {
  const NODE_VERSION = '26.13.1';
  const YARN_VERSION = '4.18.1';
  const check = (text) => runtimeMismatches([{ number: 1, text }], NODE_VERSION, YARN_VERSION);

  test.each([
    [
      '| Node v24.15.0 | Runtime |',
      [
        'README.md:1: Node line states 24.15.0, .nvmrc is 26.13.1',
        'README.md:1: Node major 24, .nvmrc major is 26',
      ],
    ],
    ['Requires Node 24.15', ['README.md:1: Node major 24, .nvmrc major is 26']],
    ['Requires Node.js v24', ['README.md:1: Node major 24, .nvmrc major is 26']],
    ['- [Node.js](https://nodejs.org/) 24', ['README.md:1: Node major 24, .nvmrc major is 26']],
    ['Node 26.12.0', ['README.md:1: Node line states 26.12.0, .nvmrc is 26.13.1']],
    ['Yarn v4.14.1', ['README.md:1: Yarn line states 4.14.1, packageManager is 4.18.1']],
    ['Install yarn@4.14.1', ['README.md:1: Yarn line states 4.14.1, packageManager is 4.18.1']],
  ])('"%s" is reported', (text, expected) => {
    // Arrange: the line and the pins above.

    // Act
    const mismatches = check(text);

    // Assert
    expect(mismatches).toEqual(expected);
  });

  test.each([
    '| Node 26 | Runtime, at the exact version pinned in `.nvmrc` |',
    '- [Node.js](https://nodejs.org/) 26, at the exact version pinned in `.nvmrc`',
    '| Node v26.13.1 | Runtime |',
    'Requires Node 26.13',
    'Requires Node.js v26',
    'Yarn v4.18.1',
    'Install yarn@4.18.1',
    'Corepack is bundled only with Node.js 14.19 through 24.x, so Node 26 does not include it',
    'Corepack ships Yarn v4.14.1 for Node v24.15.0',
  ])('"%s" is not reported', (text) => {
    // Arrange: the line and the pins above.

    // Act
    const mismatches = check(text);

    // Assert
    expect(mismatches).toEqual([]);
  });
});

test('AC-96: the README makes none of the known false claims', () => {
  // Arrange
  const readme = readReadme();

  // Act
  const matches = readme.lines.flatMap((line) =>
    FALSE_CLAIMS.filter((pattern) => pattern.test(line.text)).map(
      (pattern) => `README.md:${line.number}: /${pattern.source}/i: ${line.text}`
    )
  );

  // Assert
  expect({ problem: readme.problem, matches }).toEqual({ problem: null, matches: [] });
});

test('AC-98: Valhalla Tech is the copyright holder in the README and the footer', () => {
  // Arrange
  const readme = readReadme();
  const html = readText(INDEX_HTML);
  const license = section(readme.lines, '## License');
  const licenseText = (license ?? []).map((line) => line.text).join('\n');
  const document = new DOMParser().parseFromString(html.text, 'text/html');

  // Act
  const footer = document.querySelector('.copyright')?.textContent ?? null;

  // Assert
  expect({
    problems: [readme.problem, html.problem].filter((p) => p !== null),
    licenseSectionFound: license !== null,
    licenseNamesValhallaTech: /©\s*Valhalla Tech/.test(licenseText),
    licenseNamesFredSmith: /©\s*Fred Smith III/.test(licenseText),
    footerNamesValhallaTech: footer !== null && footer.includes('Valhalla Tech'),
  }).toEqual({
    problems: [],
    licenseSectionFound: true,
    licenseNamesValhallaTech: true,
    licenseNamesFredSmith: false,
    footerNamesValhallaTech: true,
  });
});

test('AC-99: the remaining docs-audit rows read true in the README', () => {
  // Arrange
  const readme = readReadme();
  const text = readme.lines.map((line) => line.text).join('\n');
  const at = (line) => `README.md:${line.number}`;
  const matching = (pattern) => readme.lines.filter((line) => pattern.test(line.text)).map(at);
  const present = (url) => (text.includes(url) ? [] : [`missing ${url}`]);

  // Act
  let inFence = false;
  const bareOpeningFences = [];
  readme.lines.forEach((line) => {
    if (!/^```/.test(line.text)) {
      return;
    }
    if (inFence) {
      inFence = !/^```\s*$/.test(line.text);
    } else {
      inFence = true;
      if (/^```\s*$/.test(line.text)) {
        bareOpeningFences.push(at(line));
      }
    }
  });
  const checks = {
    R4: matching(/`\^\d/),
    R7: matching(/initialisation/i),
    R11: [
      ...readme.lines
        .filter((line) => line.text.includes('80%') && !line.text.includes('utils.js'))
        .map(at),
      ...matching(/80 %/),
    ],
    R12: matching(/no watch, strict coverage/),
    R20: bareOpeningFences,
    R21: [
      ...matching(/\]\(\.\.\/\.\.\/issues\)/),
      ...present('https://github.com/ValhallaTech/PortfolioPage-FS3/issues'),
    ],
    R22: present('https://github.com/ValhallaTech/.github/blob/main/CODE_OF_CONDUCT.md'),
  };
  const failed = Object.entries(checks)
    .filter(([, hits]) => hits.length > 0)
    .map(([row, hits]) => `${row}: ${hits.join(', ')}`);

  // Assert
  expect({ problem: readme.problem, failed }).toEqual({ problem: null, failed: [] });
});

test('AC-100: GPL-3.0-only is declared in the README and package.json', () => {
  // Arrange
  const readme = readReadme();
  const { manifest, problem } = readManifest();
  const license = section(readme.lines, '## License');
  const licenseText = (license ?? []).map((line) => line.text).join('\n');

  // Act
  const result = {
    problems: [readme.problem, problem].filter((p) => p !== null),
    packageLicense: manifest.license ?? null,
    readmeDeclaresOnly: licenseText.includes(LICENSE_ID),
    readmeDeclaresOrLater: licenseText.includes('GPL-3.0-or-later'),
  };

  // Assert
  expect(result).toEqual({
    problems: [],
    packageLicense: LICENSE_ID,
    readmeDeclaresOnly: true,
    readmeDeclaresOrLater: false,
  });
});

test('AC-101: the README Usage section documents the smoke command', () => {
  // Arrange
  const readme = readReadme();
  const { manifest, problem } = readManifest();
  const usage = section(readme.lines, '## Usage') ?? [];
  const command = new RegExp(`(?:^|\\s)yarn ${SMOKE_SCRIPT}(?:\\s|$)`);

  // Act
  const codeLines = usage
    .filter((line) => line.inFence && !/^```/.test(line.text))
    .filter((line) => command.test(line.text))
    .map((line) => line.number);

  // Assert
  expect({
    problems: [readme.problem, problem].filter((p) => p !== null),
    scriptDeclared: typeof manifest.scripts?.[SMOKE_SCRIPT] === 'string',
    usageCodeLinesRunningIt: codeLines.length > 0,
  }).toEqual({ problems: [], scriptDeclared: true, usageCodeLinesRunningIt: true });
});
