/**
 * @jest-environment node
 */
/**
 * Tests for scripts/third-party-notices.mjs (F1; review finding CR1-2): the script that writes
 * dist/THIRD-PARTY-NOTICES.txt from each runtime dependency's license file.
 *
 * The script resolves the repository root from its own location, so each scenario copies it
 * into `<fixture>/scripts/` and runs that copy with `node`, the way `yarn build` runs it. The
 * fixture holds a fake package.json, node_modules packages and, unless the scenario removes
 * it, a dist/ folder; the real repository is never read or written.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const NOTICES_SCRIPT = path.join(REPO_ROOT, 'scripts', 'third-party-notices.mjs');

/** The notices file the script writes, relative to the fixture root. */
const NOTICES_PATH = path.join('dist', 'THIRD-PARTY-NOTICES.txt');

/** One section header: a rule, `name version`, `License: x`, a rule. */
const SECTION_HEADER = /^={80}\n(.+)\nLicense: (.+)\n={80}$/gm;

/** The rule line that opens and closes every section header. */
const SECTION_RULE = /^={80}$/;

/** Jest's own variables; they are kept out of every child process. */
const JEST_VARIABLE_PREFIX = 'JEST_';

/** Upper bound for one child process; none of them touches the network. */
const CHILD_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 3 * CHILD_TIMEOUT_MS;

/** How much of a child's stderr a failure message shows. */
const STDERR_TAIL_CHARS = 4000;

/**
 * The installed packages every scenario starts from. `version` is the installed version,
 * which differs from the package.json descriptor on purpose.
 */
const LICENSED_PACKAGES = [
  { name: 'zeta-lib', version: '3.0.1', license: 'MIT', text: 'Zeta license text.' },
  { name: '@scope/beta', version: '2.1.0', license: 'ISC', text: 'Beta license text.' },
  { name: 'alpha', version: '1.2.3', license: 'Apache-2.0', text: 'Alpha license text.' },
];

/** A dev dependency with a license file; it must never appear in the notices. */
const DEV_PACKAGE = { name: 'dev-only', version: '9.9.9', license: 'MIT', text: 'Dev text.' };

/**
 * This process's environment minus every `JEST_*` variable.
 *
 * @returns {NodeJS.ProcessEnv} The child's environment.
 */
function childEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.toUpperCase().startsWith(JEST_VARIABLE_PREFIX)
    )
  );
}

/**
 * Describes how a child process ended: exit status, signal, spawn error and stderr tail.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The description.
 */
function describeRun(run) {
  const stderr = (run.stderr ?? '').trimEnd();
  const tail = stderr ? stderr.slice(-STDERR_TAIL_CHARS) : '(empty)';
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return `third-party-notices: exit ${run.status}, signal ${run.signal}${spawnError}; stderr: ${tail}`;
}

/**
 * Writes a JSON file, creating its directory.
 *
 * @param {string} file The absolute path.
 * @param {unknown} value The value to serialize.
 */
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Installs a fake package under `<root>/node_modules/<name>`.
 *
 * @param {string} root The fixture root.
 * @param {{ name: string, version: string, license: string, text?: string }} pkg The package;
 *   without `text` it ships no license file.
 */
function installPackage(root, { name, version, license, text }) {
  const packageDir = path.join(root, 'node_modules', ...name.split('/'));
  writeJson(path.join(packageDir, 'package.json'), { name, version, license });
  if (text !== undefined) {
    fs.writeFileSync(path.join(packageDir, 'LICENSE'), `${text}\n`, 'utf8');
  }
}

/**
 * Writes a repository-held license file, `<root>/third-party-licenses/<name>/<file>`, where a
 * scoped name becomes nested folders (AD-13).
 *
 * @param {string} root The fixture root.
 * @param {string} name The package name.
 * @param {string} file The file name inside the package's folder.
 * @param {string} text The file content, without its final newline.
 */
function writeRepoHeldFile(root, name, file, text) {
  const folder = path.join(root, 'third-party-licenses', ...name.split('/'));
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, file), `${text}\n`, 'utf8');
}

/**
 * The text of one package's section: from the line after its header up to the next section's
 * rule, or the end of the file. The fixture's license texts hold no rule line.
 *
 * @param {string} notices The notices file content.
 * @param {string} heading The section's `name version` line.
 * @returns {string | null} The section's text after its heading, or null when it is missing.
 */
function sectionBody(notices, heading) {
  const lines = notices.split('\n');
  const start = lines.indexOf(heading);
  if (start === -1) {
    return null;
  }
  const rest = lines.slice(start + 3);
  const end = rest.findIndex((line) => SECTION_RULE.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/**
 * Builds the fixture: the copied script, a package.json whose `dependencies` keys are
 * `dependencies`, the licensed packages and the dev package installed, and an empty dist/.
 *
 * @param {string} root The empty fixture directory.
 * @param {string[]} dependencies The package.json `dependencies` keys, in this order.
 */
function createFixture(root, dependencies) {
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(NOTICES_SCRIPT, path.join(root, 'scripts', 'third-party-notices.mjs'));
  fs.mkdirSync(path.join(root, 'dist'));
  writeJson(path.join(root, 'package.json'), {
    name: 'fixture-site',
    private: true,
    dependencies: Object.fromEntries(
      dependencies.map((name) => [name, `patch:${name}@npm%3A0.0.0#./fixture.patch`])
    ),
    devDependencies: { [DEV_PACKAGE.name]: '^9.0.0' },
  });
  for (const pkg of [...LICENSED_PACKAGES, DEV_PACKAGE]) {
    installPackage(root, pkg);
  }
}

/**
 * Runs the fixture's copy of the script from an unrelated directory.
 *
 * @param {string} root The fixture root.
 * @param {string} spawnDir An empty directory the child process starts in.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The finished process.
 */
function runNotices(root, spawnDir) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'third-party-notices.mjs')], {
    cwd: spawnDir,
    encoding: 'utf8',
    env: childEnvironment(),
    timeout: CHILD_TIMEOUT_MS,
    windowsHide: true,
  });
}

/**
 * Runs `assertion` and, when it fails, adds the child's exit status and stderr tail to the
 * failure message.
 *
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @param {() => void} assertion The `expect` call to run.
 */
function expectWithRunDetail(run, assertion) {
  try {
    assertion();
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}\n\n${describeRun(run)}`;
    }
    throw error;
  }
}

/**
 * Lists the `name version` and license of every section header in the notices text.
 *
 * @param {string} notices The notices file content.
 * @returns {{ heading: string, license: string }[]} The headers, in file order.
 */
function sectionHeaders(notices) {
  return [...notices.matchAll(SECTION_HEADER)].map((match) => ({
    heading: match[1],
    license: match[2],
  }));
}

describe('third-party-notices script', () => {
  let workDir;
  let root;
  let spawnDir;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-notices-'));
    root = path.join(workDir, 'fixture');
    spawnDir = path.join(workDir, 'spawn');
    fs.mkdirSync(root);
    fs.mkdirSync(spawnDir);
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3 });
  });

  describe('when every runtime dependency is installed with a license file', () => {
    beforeEach(() => {
      createFixture(
        root,
        LICENSED_PACKAGES.map((pkg) => pkg.name)
      );
    });

    test(
      'exits 0',
      () => {
        // Act
        const run = runNotices(root, spawnDir);

        // Assert
        expectWithRunDetail(run, () => expect(run.status).toBe(0));
      },
      TEST_TIMEOUT_MS
    );

    test(
      'writes one section per runtime dependency, sorted by name, with its installed version',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect(sectionHeaders(notices)).toEqual([
            { heading: '@scope/beta 2.1.0', license: 'ISC' },
            { heading: 'alpha 1.2.3', license: 'Apache-2.0' },
            { heading: 'zeta-lib 3.0.1', license: 'MIT' },
          ])
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      'includes the text of each license file under its file name',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect(
            LICENSED_PACKAGES.filter((pkg) => !notices.includes(`--- LICENSE ---\n\n${pkg.text}`))
          ).toEqual([])
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      'leaves out dev dependencies',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () => expect(notices).not.toContain(DEV_PACKAGE.name));
      },
      TEST_TIMEOUT_MS
    );

    test(
      'writes the same bytes on a second run',
      () => {
        // Arrange
        const firstRun = runNotices(root, spawnDir);
        const firstBytes = fs.readFileSync(path.join(root, NOTICES_PATH));

        // Act
        const secondRun = runNotices(root, spawnDir);
        const secondBytes = fs.readFileSync(path.join(root, NOTICES_PATH));

        // Assert
        expectWithRunDetail(firstRun, () => expect(firstRun.status).toBe(0));
        expectWithRunDetail(secondRun, () =>
          expect(secondBytes.equals(firstBytes) ? null : secondBytes.toString('utf8')).toBeNull()
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when a runtime dependency ships no license file', () => {
    const UNLICENSED = { name: 'no-license', version: '0.4.0', license: 'MIT' };

    beforeEach(() => {
      createFixture(root, [...LICENSED_PACKAGES.map((pkg) => pkg.name), UNLICENSED.name]);
      installPackage(root, UNLICENSED);
    });

    test(
      'exits 0 and warns on stderr that the dependency was skipped',
      () => {
        // Act
        const run = runNotices(root, spawnDir);

        // Assert
        expectWithRunDetail(run, () =>
          expect({
            status: run.status,
            warned: run.stderr.includes('warning: no-license '),
          }).toEqual({ status: 0, warned: true })
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      'leaves the dependency out of the notices and keeps the others',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect(sectionHeaders(notices).map((header) => header.heading)).toEqual([
            '@scope/beta 2.1.0',
            'alpha 1.2.3',
            'zeta-lib 3.0.1',
          ])
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when a runtime dependency ships no license file but the repository holds one', () => {
    const REPO_HELD = { name: 'held-terms', version: '5.6.7', license: 'Custom' };
    const REPO_HELD_TEXT = 'Held terms text.';

    beforeEach(() => {
      createFixture(root, [...LICENSED_PACKAGES.map((pkg) => pkg.name), REPO_HELD.name]);
      installPackage(root, REPO_HELD);
      writeRepoHeldFile(root, REPO_HELD.name, 'LICENSE.md', REPO_HELD_TEXT);
    });

    test(
      'exits 0 and does not warn about the dependency',
      () => {
        // Act
        const run = runNotices(root, spawnDir);

        // Assert
        expectWithRunDetail(run, () =>
          expect({
            status: run.status,
            warned: run.stderr.includes(`warning: ${REPO_HELD.name} `),
          }).toEqual({ status: 0, warned: false })
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      'lists the dependency with its installed version among the others',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect(sectionHeaders(notices)).toEqual([
            { heading: '@scope/beta 2.1.0', license: 'ISC' },
            { heading: 'alpha 1.2.3', license: 'Apache-2.0' },
            { heading: 'held-terms 5.6.7', license: 'Custom' },
            { heading: 'zeta-lib 3.0.1', license: 'MIT' },
          ])
        );
      },
      TEST_TIMEOUT_MS
    );

    test(
      'gives the section the repository-held text under its repository path',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect(sectionBody(notices, 'held-terms 5.6.7')?.trim()).toBe(
            `--- third-party-licenses/held-terms/LICENSE.md ---\n\n${REPO_HELD_TEXT}`
          )
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when a dependency has its own license file and a repository-held one', () => {
    beforeEach(() => {
      createFixture(
        root,
        LICENSED_PACKAGES.map((pkg) => pkg.name)
      );
      writeRepoHeldFile(root, 'alpha', 'LICENSE.md', 'Repository-held alpha text.');
    });

    test(
      "uses the package's own license file and ignores the repository-held one",
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect(sectionBody(notices, 'alpha 1.2.3')?.trim()).toBe(
            '--- LICENSE ---\n\nAlpha license text.'
          )
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when neither the package nor its repository folder has a license file', () => {
    const UNLICENSED = { name: 'no-license', version: '0.4.0', license: 'MIT' };

    beforeEach(() => {
      createFixture(root, [...LICENSED_PACKAGES.map((pkg) => pkg.name), UNLICENSED.name]);
      installPackage(root, UNLICENSED);
      writeRepoHeldFile(root, UNLICENSED.name, 'README.md', 'Not a license file.');
    });

    test(
      'exits 0, warns that the dependency was skipped and leaves it out of the notices',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect({
            status: run.status,
            warned: run.stderr.includes(`warning: ${UNLICENSED.name} `),
            headings: sectionHeaders(notices).map((header) => header.heading),
          }).toEqual({
            status: 0,
            warned: true,
            headings: ['@scope/beta 2.1.0', 'alpha 1.2.3', 'zeta-lib 3.0.1'],
          })
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when a scoped dependency ships no license file but the repository holds one', () => {
    const SCOPED = { name: '@scope/held', version: '0.9.0', license: 'Custom' };
    const SCOPED_TEXT = 'Scoped held terms text.';

    beforeEach(() => {
      createFixture(root, [...LICENSED_PACKAGES.map((pkg) => pkg.name), SCOPED.name]);
      installPackage(root, SCOPED);
      writeRepoHeldFile(root, SCOPED.name, 'LICENSE.md', SCOPED_TEXT);
    });

    test(
      'reads the terms from nested scope and package folders and labels them with that path',
      () => {
        // Act
        const run = runNotices(root, spawnDir);
        const notices = fs.readFileSync(path.join(root, NOTICES_PATH), 'utf8');

        // Assert
        expectWithRunDetail(run, () =>
          expect({
            warned: run.stderr.includes(`warning: ${SCOPED.name} `),
            body: sectionBody(notices, '@scope/held 0.9.0')?.trim(),
          }).toEqual({
            warned: false,
            body: `--- third-party-licenses/@scope/held/LICENSE.md ---\n\n${SCOPED_TEXT}`,
          })
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when dist/ is missing', () => {
    test(
      'exits non-zero, names the missing folder and writes nothing',
      () => {
        // Arrange
        createFixture(
          root,
          LICENSED_PACKAGES.map((pkg) => pkg.name)
        );
        fs.rmSync(path.join(root, 'dist'), { recursive: true });

        // Act
        const run = runNotices(root, spawnDir);

        // Assert
        expectWithRunDetail(run, () =>
          expect({
            failed: run.status !== 0 && run.status !== null,
            reason: run.stderr.includes('does not exist'),
            distCreated: fs.existsSync(path.join(root, 'dist')),
          }).toEqual({ failed: true, reason: true, distCreated: false })
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when a runtime dependency is not installed', () => {
    test(
      'exits non-zero, names the dependency and writes no notices file',
      () => {
        // Arrange
        createFixture(root, [...LICENSED_PACKAGES.map((pkg) => pkg.name), 'not-installed']);

        // Act
        const run = runNotices(root, spawnDir);

        // Assert
        expectWithRunDetail(run, () =>
          expect({
            failed: run.status !== 0 && run.status !== null,
            reason: run.stderr.includes('cannot read the installed package not-installed'),
            written: fs.existsSync(path.join(root, NOTICES_PATH)),
          }).toEqual({ failed: true, reason: true, written: false })
        );
      },
      TEST_TIMEOUT_MS
    );
  });

  describe('when a runtime dependency name is not a valid package name', () => {
    // Each path is installed with a license file, so only the name check can fail the run.
    test.each([
      ['..', 'the parent of node_modules'],
      ['nested/pkg', 'a path with a separator and no scope'],
      ['@scope/nested/pkg', 'a path with a separator beyond the scope'],
    ])(
      'exits non-zero for "%s" (%s) and writes no notices file',
      (name) => {
        // Arrange
        createFixture(root, [...LICENSED_PACKAGES.map((pkg) => pkg.name), name]);
        if (name !== '..') {
          installPackage(root, { name, version: '1.0.0', license: 'MIT', text: 'Nested text.' });
        }

        // Act
        const run = runNotices(root, spawnDir);

        // Assert
        expectWithRunDetail(run, () =>
          expect({
            failed: run.status !== 0 && run.status !== null,
            reason: run.stderr.includes(`"${name}" is not a valid package name`),
            written: fs.existsSync(path.join(root, NOTICES_PATH)),
          }).toEqual({ failed: true, reason: true, written: false })
        );
      },
      TEST_TIMEOUT_MS
    );
  });
});
