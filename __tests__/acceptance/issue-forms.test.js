/**
 * @jest-environment node
 */
/**
 * S1 acceptance tests for chain I (spec stabilize-and-cleanup, sections 2.3 and 3.4 WI-24):
 *
 * - AC-105: `.github/ISSUE_TEMPLATE/` holds `config.yml` plus exactly two issue forms, one
 *   for bugs and one for features, and no Markdown template.
 * - AC-106: no line under `.github/ISSUE_TEMPLATE/` asks about customers, sprint effort,
 *   timing or the internal/customer source. This is the spec's `rg -n -i` search done in
 *   Node, because `rg` is absent from the Linux container.
 */
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATE_DIR = path.join(REPO_ROOT, '.github', 'ISSUE_TEMPLATE');
const TEMPLATE_DIR_LABEL = '.github/ISSUE_TEMPLATE';

const CONFIG_FILE = 'config.yml';
const LEGACY_TEMPLATE = 'issue-ticket-template.md';
const FORM_FILE = /\.ya?ml$/i;
const MARKDOWN_FILE = /\.md$/i;

/** AC-106's terms, matched case-insensitively as in `rg -i -e <term>`. */
const FORBIDDEN_TERMS = ['customer', 'sprint', 'effort', 'yesterday', 'this quarter', 'internal'];

/**
 * Lists the files directly in the template directory. Never throws.
 *
 * @returns {{ files: string[], problem: string | null }} The file names, or the problem.
 */
function listTemplateFiles() {
  try {
    const files = fs
      .readdirSync(TEMPLATE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    return { files, problem: null };
  } catch (error) {
    return { files: [], problem: `${TEMPLATE_DIR_LABEL} could not be listed: ${error.message}` };
  }
}

/**
 * Lists every file under the template directory, at any depth. Never throws.
 *
 * @param {string} dir Directory to walk.
 * @param {string[]} problems Collects any directory that could not be read.
 * @returns {string[]} Absolute file paths.
 */
function walkFiles(dir, problems) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    problems.push(`${toLabel(dir)} could not be listed: ${error.message}`);
    return [];
  }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(full, problems);
    }
    return entry.isFile() ? [full] : [];
  });
}

/**
 * Turns an absolute path into a repo-relative label with forward slashes.
 *
 * @param {string} file Absolute path.
 * @returns {string} The label.
 */
function toLabel(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

/**
 * Checks one issue form's top-level structure.
 *
 * @param {string} name The form's file name.
 * @returns {{ formName: string | null, problems: string[] }} Its `name`, and any problems.
 */
function checkForm(name) {
  const label = `${TEMPLATE_DIR_LABEL}/${name}`;
  let form;
  try {
    form = YAML.parse(fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8'));
  } catch (error) {
    return { formName: null, problems: [`${label} does not parse as YAML: ${error.message}`] };
  }
  if (form === null || typeof form !== 'object' || Array.isArray(form)) {
    return { formName: null, problems: [`${label} is not a YAML mapping`] };
  }

  const problems = [];
  const formName = typeof form.name === 'string' && form.name.trim() !== '' ? form.name : null;
  if (formName === null) {
    problems.push(`${label} has no top-level name`);
  }
  if (typeof form.description !== 'string' || form.description.trim() === '') {
    problems.push(`${label} has no top-level description`);
  }
  if (!Array.isArray(form.body) || form.body.length === 0) {
    problems.push(`${label} has no non-empty top-level body array`);
  }
  return { formName, problems };
}

test('AC-105 the issue template directory holds config.yml plus exactly two forms, bug and feature, and no Markdown template', () => {
  // Arrange
  const { files, problem } = listTemplateFiles();
  expect(problem === null ? null : `AC-105: ${problem}`).toBeNull();

  // Act
  const problems = [];
  if (!files.includes(CONFIG_FILE)) {
    problems.push(`${CONFIG_FILE} is missing`);
  }
  if (files.includes(LEGACY_TEMPLATE)) {
    problems.push(`${LEGACY_TEMPLATE} is still present`);
  }
  const markdown = files.filter((name) => MARKDOWN_FILE.test(name));
  if (markdown.length > 0) {
    problems.push(`Markdown templates are present: ${markdown.join(', ')}`);
  }
  const others = files.filter((name) => name !== CONFIG_FILE);
  const notForms = others.filter((name) => !FORM_FILE.test(name));
  if (notForms.length > 0) {
    problems.push(`files other than config.yml and .yml/.yaml forms: ${notForms.join(', ')}`);
  }
  const forms = others.filter((name) => FORM_FILE.test(name));
  if (forms.length !== 2) {
    problems.push(`expected exactly 2 issue forms, found ${forms.length}: [${forms.join(', ')}]`);
  }

  const checked = forms.map(checkForm);
  checked.forEach((result) => problems.push(...result.problems));
  const names = checked.map((result) => result.formName).filter((formName) => formName !== null);
  const bug = names.filter((formName) => /bug/i.test(formName));
  const feature = names.filter((formName) => /feature/i.test(formName));
  const pairsUp =
    names.length === 2 &&
    ((/bug/i.test(names[0]) && /feature/i.test(names[1])) ||
      (/feature/i.test(names[0]) && /bug/i.test(names[1])));
  if (!pairsUp) {
    problems.push(
      `expected one form name matching /bug/i and the other /feature/i, found names ` +
        `[${names.join(', ')}] (bug: ${bug.length}, feature: ${feature.length})`
    );
  }

  // Assert
  expect(
    problems.length === 0
      ? null
      : `AC-105: ${TEMPLATE_DIR_LABEL} structure checks fail:\n${problems.join('\n')}`
  ).toBeNull();
});

test('AC-106 no line under the issue template directory mentions customer, sprint, effort, yesterday, this quarter or internal', () => {
  // Arrange
  const problems = [];
  const files = walkFiles(TEMPLATE_DIR, problems).sort();
  expect(problems.length === 0 ? null : `AC-106: ${problems.join('; ')}`).toBeNull();

  const readProblems = [];
  const contents = files.map((file) => {
    try {
      return { file, text: fs.readFileSync(file, 'utf8') };
    } catch (error) {
      readProblems.push(`${toLabel(file)} could not be read: ${error.message}`);
      return { file, text: '' };
    }
  });
  expect(readProblems.length === 0 ? null : `AC-106: ${readProblems.join('; ')}`).toBeNull();

  // Act
  const matches = contents.flatMap(({ file, text }) =>
    text
      .split(/\r?\n/)
      .flatMap((line, index) =>
        FORBIDDEN_TERMS.filter((term) => line.toLowerCase().includes(term)).map(
          (term) => `${toLabel(file)}:${index + 1}:${term}`
        )
      )
  );

  // Assert
  expect(
    matches.length === 0
      ? null
      : `AC-106: ${TEMPLATE_DIR_LABEL} asks irrelevant questions (file:line:term):\n${matches.join('\n')}`
  ).toBeNull();
});
