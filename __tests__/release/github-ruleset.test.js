/**
 * @jest-environment node
 */
/**
 * S5 release test for AC-3 (spec stabilize-and-cleanup, sections 2.3, 3.4 WI-20
 * and 3.7 chain G): a dedicated ruleset requires `Test & Build` on `main`, and
 * the General Ruleset (15072163) is unchanged since the PR-1 snapshot.
 *
 * Needs `gh`, authenticated, and network access. Read-only: every `gh` call is a
 * GET, a `pr list` or a `pr view`. Run with `yarn verify:release`.
 * It never skips: every failure is an `expect` that shows its message.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The repository whose rulesets are read. */
const REPO = 'ValhallaTech/PortfolioPage-FS3';

/** The General Ruleset, which is never edited (D-8). */
const GENERAL_RULESET_ID = 15072163;

/** The required status check context (D-8). */
const REQUIRED_CONTEXT = 'Test & Build';

/** Ref patterns that mean the ruleset targets `main`. */
const MAIN_REFS = ['~DEFAULT_BRANCH', 'refs/heads/main'];

/** The search that finds PR-1, the first merged sprint-1 PR. */
const SPRINT_PR_SEARCH = 'stabilize-and-cleanup in:body';

/** Marker that opens the WI-1 snapshot block. */
const SNAPSHOT_MARKER = `<!-- ruleset-snapshot:${GENERAL_RULESET_ID} -->`;

/** The marker followed by its fenced JSON object. */
const SNAPSHOT_BLOCK = new RegExp(
  `${SNAPSHOT_MARKER}\\s*\`\`\`json[^\\S\\r\\n]*\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\``
);

/** Upper bound for one `gh` call. */
const GH_TIMEOUT_MS = 120_000;

/**
 * The process environment minus every `JEST_*` variable, for child processes.
 *
 * @returns {NodeJS.ProcessEnv} The filtered environment.
 */
function childEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('JEST_'))
  );
}

/**
 * Runs `gh` with JSON output and parses it. Never throws: a failure is returned
 * as a problem message so the test reports it through `expect`.
 *
 * @param {string[]} args Arguments after `gh`.
 * @returns {{ data: unknown, problem: string | null }} The parsed output, or the problem.
 */
function ghJson(args) {
  const result = spawnSync('gh', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(),
    timeout: GH_TIMEOUT_MS,
    windowsHide: true,
  });
  const command = `gh ${args.join(' ')}`;
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr ?? '').trim();
    return { data: null, problem: `${command} failed (exit ${result.status}): ${reason}` };
  }
  try {
    return { data: JSON.parse(result.stdout), problem: null };
  } catch (error) {
    return { data: null, problem: `${command} printed invalid JSON: ${error.message}` };
  }
}

/**
 * Reads one ruleset in full.
 *
 * @param {number} id The ruleset id.
 * @returns {{ data: any, problem: string | null }} The ruleset, or the problem.
 */
function readRuleset(id) {
  return ghJson(['api', '--method', 'GET', `repos/${REPO}/rulesets/${id}`]);
}

/**
 * Lists every ruleset, then reads each one in full.
 *
 * @returns {{ rulesets: any[], problem: string | null }} The rulesets, or the problem.
 */
function readAllRulesets() {
  const list = ghJson([
    'api',
    '--method',
    'GET',
    '--paginate',
    '--slurp',
    `repos/${REPO}/rulesets`,
  ]);
  if (list.problem) {
    return { rulesets: [], problem: list.problem };
  }
  const pages = Array.isArray(list.data) ? list.data : [];
  const ids = pages.flat().map((entry) => entry?.id);
  const rulesets = [];
  for (const id of ids) {
    const read = readRuleset(id);
    if (read.problem) {
      return { rulesets: [], problem: read.problem };
    }
    rulesets.push(read.data);
  }
  return { rulesets, problem: null };
}

/**
 * Whether the ruleset's `.conditions.ref_name.include` targets `main`.
 *
 * @param {any} ruleset A full ruleset.
 * @returns {boolean} True when it targets `main`.
 */
function targetsMain(ruleset) {
  const include = ruleset?.conditions?.ref_name?.include;
  return Array.isArray(include) && include.some((ref) => MAIN_REFS.includes(ref));
}

/**
 * The ruleset's `required_status_checks` rules.
 *
 * @param {any} ruleset A full ruleset.
 * @returns {any[]} The rules of that type.
 */
function statusCheckRules(ruleset) {
  const rules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
  return rules.filter((rule) => rule?.type === 'required_status_checks');
}

/**
 * Whether a `required_status_checks` rule of the ruleset lists `Test & Build`.
 *
 * @param {any} ruleset A full ruleset.
 * @returns {boolean} True when the check is required.
 */
function requiresTestAndBuild(ruleset) {
  return statusCheckRules(ruleset).some((rule) => {
    const checks = rule?.parameters?.required_status_checks;
    return Array.isArray(checks) && checks.some((check) => check?.context === REQUIRED_CONTEXT);
  });
}

/**
 * Finds PR-1 and parses the WI-1 snapshot block from its comments.
 *
 * @returns {{ snapshot: { enforcement: unknown, ruleTypes: unknown } | null, problem: string | null }}
 *   The snapshot, or the problem.
 */
function readSnapshot() {
  const search = ghJson([
    'pr',
    'list',
    '--repo',
    REPO,
    '--state',
    'merged',
    '--search',
    SPRINT_PR_SEARCH,
    '--limit',
    '1000',
    '--json',
    'number',
  ]);
  if (search.problem) {
    return { snapshot: null, problem: search.problem };
  }
  const numbers = (Array.isArray(search.data) ? search.data : [])
    .map((pr) => pr?.number)
    .filter((number) => Number.isInteger(number));
  if (numbers.length === 0) {
    return {
      snapshot: null,
      problem: `no merged PR matches the search "${SPRINT_PR_SEARCH}", so PR-1 is not found`,
    };
  }
  const pr1 = Math.min(...numbers);
  const view = ghJson(['pr', 'view', String(pr1), '--repo', REPO, '--json', 'comments']);
  if (view.problem) {
    return { snapshot: null, problem: view.problem };
  }
  const comments = Array.isArray(view.data?.comments) ? view.data.comments : [];
  const match = comments
    .map((comment) => SNAPSHOT_BLOCK.exec(String(comment?.body ?? '')))
    .find((found) => found !== null);
  if (!match) {
    return {
      snapshot: null,
      problem: `PR ${pr1} has no comment with a ${SNAPSHOT_MARKER} block followed by fenced JSON`,
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch (error) {
    return {
      snapshot: null,
      problem: `PR ${pr1}: the snapshot block is not valid JSON: ${error.message}`,
    };
  }
  if (
    typeof parsed?.enforcement !== 'string' ||
    !Array.isArray(parsed?.ruleTypes) ||
    !parsed.ruleTypes.every((type) => typeof type === 'string')
  ) {
    return {
      snapshot: null,
      problem: `PR ${pr1}: the snapshot block lacks a string enforcement and a string array ruleTypes: ${match[1]}`,
    };
  }
  return {
    snapshot: { enforcement: parsed.enforcement, ruleTypes: parsed.ruleTypes },
    problem: null,
  };
}

describe('AC-3: a rule requiring Test & Build exists for main', () => {
  it('AC-3 clauses 1-3: exactly one ruleset other than 15072163 targets main, requires Test & Build, and is disabled', () => {
    const { rulesets, problem: readProblem } = readAllRulesets();
    const matches = rulesets.filter(
      (ruleset) => targetsMain(ruleset) && requiresTestAndBuild(ruleset)
    );
    const ids = matches.map((ruleset) => ruleset?.id);
    let clause1Problem = null;
    if (readProblem) {
      clause1Problem = `AC-3 clause 1: reading the rulesets failed: ${readProblem}`;
    } else if (matches.length !== 1) {
      clause1Problem =
        `AC-3 clause 1: ${matches.length} rulesets both target main and require ${REQUIRED_CONTEXT} ` +
        `(expected exactly 1); matching ids: [${ids.join(', ')}]; ` +
        `all ruleset ids: [${rulesets.map((ruleset) => ruleset?.id).join(', ')}]`;
    }
    expect(clause1Problem).toBeNull();

    const [ruleset] = matches;
    expect(
      ruleset.id === GENERAL_RULESET_ID
        ? `AC-3 clause 2: the matching ruleset is ${GENERAL_RULESET_ID}, the General Ruleset`
        : null
    ).toBeNull();

    const restored = process.env.ACTIONS_RESTORED === '1';
    const expected = restored ? 'active' : 'disabled';
    const condition = restored ? 'ACTIONS_RESTORED=1' : 'ACTIONS_RESTORED is unset';
    expect(
      ruleset.enforcement === expected
        ? null
        : `AC-3 clause 3: ruleset ${ruleset.id} enforcement is ${ruleset.enforcement}, expected ${expected} (${condition})`
    ).toBeNull();
  });

  it('AC-3 clause 4: ruleset 15072163 matches the PR-1 snapshot', () => {
    const { snapshot, problem: snapshotProblem } = readSnapshot();
    expect(snapshotProblem === null ? null : `AC-3 clause 4: ${snapshotProblem}`).toBeNull();

    const general = readRuleset(GENERAL_RULESET_ID);
    expect(general.problem === null ? null : `AC-3 clause 4: ${general.problem}`).toBeNull();

    const rules = Array.isArray(general.data?.rules) ? general.data.rules : [];
    const live = {
      enforcement: general.data?.enforcement,
      ruleTypes: rules.map((rule) => rule?.type).sort(),
    };
    expect(live).toEqual(snapshot);
  });

  it('AC-3 clause 5: ruleset 15072163 has no required_status_checks rule', () => {
    const general = readRuleset(GENERAL_RULESET_ID);
    expect(general.problem === null ? null : `AC-3 clause 5: ${general.problem}`).toBeNull();

    const count = statusCheckRules(general.data).length;
    expect(
      count === 0
        ? null
        : `AC-3 clause 5: ruleset ${GENERAL_RULESET_ID} has ${count} required_status_checks rule(s)`
    ).toBeNull();
  });
});
