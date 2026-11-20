/**
 * @jest-environment node
 */
/**
 * S5 release tests for chain R (spec gsap-animations, sections 2.3, 3.0 AD-18,
 * 3.4 WI-17 and 3.7): AC-4, AC-39, AC-43 and AC-44.
 *
 * They read `origin`, not the branch. Each test that reads git history first runs
 * `git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main`, and fetches
 * tag `5.0.0` when the local clone lacks it. Those fetches only update local refs;
 * nothing is pushed or changed on `origin`.
 *
 * The release commit (AD-18) is the first commit in
 * `git log --first-parent --reverse 5.0.0..origin/main` whose `package.json` `version`
 * is `5.1.0`.
 *
 * - AC-4: walks those first-parent commits up to the release commit, or to
 *   `origin/main` until one exists, to find F, the first commit that declares or imports
 *   GSAP. AC-3's checks then run on F's tree.
 * - AC-39: every merged PR whose body contains `gsap-animations` carries a passing v1
 *   gate-evidence block for its head commit. The parser repeats
 *   `pr-gate-evidence.test.js`, because Jest runs every `.js` file under `__tests__`.
 * - AC-43: the one merged `gsap-animations` PR whose body holds the `<!-- js-size:v1 -->`
 *   block. Clean builds of `5.0.0` and the release commit, each in a scratch worktree
 *   in the OS temp directory, are measured and compared within 1 %. The worktrees are
 *   always removed, also when a step fails.
 * - AC-44: the version at the release commit, the remote tag and the GitHub release,
 *   compared as one object.
 *
 * Needs `git`, `gh` (authenticated) and network access. Run with `yarn verify:release`.
 * No test throws: every `git`, `gh` or network failure is reported through an `expect`.
 * Every child runs with `process.env` minus every `JEST_*` variable.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The baseline tag, and the release version (spec section 2.3 Conventions). */
const BASELINE = '5.0.0';
const BASELINE_REF = `refs/tags/${BASELINE}`;
const RELEASE = '5.1.0';
const RELEASE_TAG_REF = `refs/tags/${RELEASE}`;

/** `origin/main`, refreshed from `origin` before history is read. */
const MAIN_REF = 'refs/remotes/origin/main';
const MAIN_FETCH_REFSPEC = `+refs/heads/main:${MAIN_REF}`;

/** The slug every sprint 3 PR carries in its body (AD-14). */
const SPRINT_SEARCH = 'gsap-animations in:body';

/** AC-4: a commit adds GSAP when it imports it from `src`. */
const GSAP_IMPORT_PATTERN = 'from [\'"]gsap';

/** AC-3: the license expression, the README section, and the permission's words. */
const LICENSE_EXPRESSION = /^GPL-3\.0-only( WITH [A-Za-z0-9.+-]+)?$/;
const LICENSE_ID = 'GPL-3.0-only';
const OR_LATER_ID = 'GPL-3.0-or-later';
const LICENSE_HEADING = '## License';
const PERMISSION_WORDS = ['GSAP', 'Valhalla Tech'];
const SECTION_7 = /section 7|§\s?7/i;

/** Marker that opens every v1 gate-evidence block (sprint 1 D-10). */
const EVIDENCE_MARKER = '<!-- gate-evidence:v1 -->';

/** The six gate commands as the Command column names them (sprint 1 D-10). */
const CANONICAL_COMMANDS = [
  'yarn install --immutable',
  'yarn lint',
  'yarn format:check',
  'yarn test:ci',
  'yarn build',
  'yarn test:smoke',
];

const STEP_ROW = /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*$/;
const COMMIT_LINE = /^- Commit: `([^`]*)`\s*$/;

/** AC-43: the size record's marker, its four labels, and the tolerance (AD-16, AD-18). */
const SIZE_MARKER = '<!-- js-size:v1 -->';
const SIZE_LINE = /^- (\d+\.\d+\.\d+) (raw|gzip): (\d+) bytes\s*$/;
const SIZE_LABELS = [`${BASELINE} raw`, `${BASELINE} gzip`, `${RELEASE} raw`, `${RELEASE} gzip`];
const SIZE_TOLERANCE = 0.01;
const GZIP_LEVEL = 9;

/** The commands each scratch worktree runs. Constant strings, so the shell sees no input. */
const INSTALL_COMMAND = 'yarn install --immutable';
const BUILD_COMMAND = 'yarn build';

const GIT_TIMEOUT_MS = 5 * 60 * 1000;
const GH_TIMEOUT_MS = 2 * 60 * 1000;
const INSTALL_TIMEOUT_MS = 15 * 60 * 1000;
const BUILD_TIMEOUT_MS = 10 * 60 * 1000;
const AC_43_TIMEOUT_MS = 2 * (INSTALL_TIMEOUT_MS + BUILD_TIMEOUT_MS) + 4 * GIT_TIMEOUT_MS;

/** How much of a failed step's output a failure message shows. */
const OUTPUT_TAIL_CHARS = 4000;

/**
 * The children's environment: this process's environment minus every `JEST_*`
 * variable, without color codes and without a Corepack download prompt.
 *
 * @returns {NodeJS.ProcessEnv} The filtered environment.
 */
function childEnv() {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('JEST_'))
  );
  return { ...env, FORCE_COLOR: '0', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
}

/**
 * Formats how a child process ended, with the tail of its output.
 *
 * @param {string} label What ran.
 * @param {import('node:child_process').SpawnSyncReturns<string>} run The finished process.
 * @returns {string} The description.
 */
function describeRun(label, run) {
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trimEnd();
  const tail = output ? output.slice(-OUTPUT_TAIL_CHARS) : '(empty)';
  const spawnError = run.error ? `, spawn error: ${run.error.message}` : '';
  return `${label} failed (exit ${run.status}${spawnError}): ${tail}`;
}

/**
 * Runs a program with an argument array from the repo root. Never throws.
 *
 * @param {string} program `git` or `gh`.
 * @param {string[]} args The arguments.
 * @param {number} timeout Upper bound in milliseconds.
 * @returns {{ status: number | null, stdout: string, stderr: string, failure: string }}
 *   The exit status, the output, and a description of the run for failure messages.
 */
function run(program, args, timeout) {
  const result = spawnSync(program, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv(),
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    status: result.error ? null : result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    failure: describeRun(`${program} ${args.join(' ')}`, result),
  };
}

/**
 * Runs `git` and treats any exit but 0 as a problem. Never throws.
 *
 * @param {string[]} args The arguments.
 * @returns {{ stdout: string, problem: string | null }} The stdout, or the problem.
 */
function git(args) {
  const result = run('git', args, GIT_TIMEOUT_MS);
  return result.status === 0
    ? { stdout: result.stdout, problem: null }
    : { stdout: '', problem: result.failure };
}

/**
 * Runs `gh` with JSON output and parses it. Never throws.
 *
 * @param {string[]} args The arguments.
 * @returns {{ data: unknown, problem: string | null }} The parsed output, or the problem.
 */
function ghJson(args) {
  const result = run('gh', args, GH_TIMEOUT_MS);
  if (result.status !== 0) {
    return { data: null, problem: result.failure };
  }
  try {
    return { data: JSON.parse(result.stdout), problem: null };
  } catch (error) {
    return { data: null, problem: `gh ${args.join(' ')} printed invalid JSON: ${error.message}` };
  }
}

/**
 * Refreshes `origin/main` from `origin`, and fetches the baseline tag when the local
 * clone lacks it.
 *
 * @returns {string | null} The problem, or null.
 */
function syncOrigin() {
  const fetchedMain = git(['fetch', '--no-tags', 'origin', MAIN_FETCH_REFSPEC]);
  if (fetchedMain.problem) {
    return fetchedMain.problem;
  }
  const baseline = git(['rev-parse', '--verify', '--quiet', `${BASELINE_REF}^{commit}`]);
  if (!baseline.problem) {
    return null;
  }
  return git(['fetch', '--no-tags', 'origin', `${BASELINE_REF}:${BASELINE_REF}`]).problem;
}

/**
 * Reads `package.json` in a commit's tree.
 *
 * @param {string} commit The commit.
 * @returns {{ manifest: Record<string, any>, problem: string | null }} The manifest, or
 *   the problem.
 */
function manifestAt(commit) {
  const shown = git(['show', `${commit}:package.json`]);
  if (shown.problem) {
    return { manifest: {}, problem: shown.problem };
  }
  try {
    return { manifest: JSON.parse(shown.stdout), problem: null };
  } catch (error) {
    return {
      manifest: {},
      problem: `package.json at ${commit} is not valid JSON: ${error.message}`,
    };
  }
}

/**
 * Lists `origin/main`'s first-parent commits after the baseline, oldest first, and
 * resolves the release commit among them (AD-18).
 *
 * @returns {{ commits: string[], mainSha: string, releaseCommit: string | null,
 *   problem: string | null }} The commits, `origin/main`'s SHA, the release commit
 *   (null until one exists), or the problem.
 */
function readSprintHistory() {
  const none = { commits: [], mainSha: '', releaseCommit: null };
  const syncProblem = syncOrigin();
  if (syncProblem) {
    return { ...none, problem: syncProblem };
  }
  const main = git(['rev-parse', '--verify', `${MAIN_REF}^{commit}`]);
  const log = git([
    'log',
    '--first-parent',
    '--reverse',
    '--format=%H',
    `${BASELINE_REF}..${MAIN_REF}`,
  ]);
  const problem = main.problem ?? log.problem;
  if (problem) {
    return { ...none, problem };
  }
  const commits = log.stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
  for (const commit of commits) {
    const { manifest, problem: manifestProblem } = manifestAt(commit);
    if (manifestProblem) {
      return { ...none, problem: manifestProblem };
    }
    if (manifest.version === RELEASE) {
      return { commits, mainSha: main.stdout.trim(), releaseCommit: commit, problem: null };
    }
  }
  return { commits, mainSha: main.stdout.trim(), releaseCommit: null, problem: null };
}

/**
 * Names the end point of the first-parent walk, for failure messages.
 *
 * @param {ReturnType<typeof readSprintHistory>} history The sprint history.
 * @returns {string} The end point and its SHA.
 */
function endPoint(history) {
  return history.releaseCommit
    ? `release commit ${history.releaseCommit}`
    : `origin/main ${history.mainSha} (no release commit yet)`;
}

/**
 * Whether a commit declares GSAP in `package.json` or imports it from `src`.
 *
 * @param {string} commit The commit.
 * @returns {{ addsGsap: boolean, problem: string | null }} The answer, or the problem.
 */
function commitAddsGsap(commit) {
  const { manifest, problem } = manifestAt(commit);
  if (problem) {
    return { addsGsap: false, problem };
  }
  if (manifest.dependencies?.gsap !== undefined && manifest.dependencies?.gsap !== null) {
    return { addsGsap: true, problem: null };
  }
  const grep = run(
    'git',
    ['grep', '-l', '-E', GSAP_IMPORT_PATTERN, commit, '--', 'src'],
    GIT_TIMEOUT_MS
  );
  if (grep.status === 0) {
    return { addsGsap: grep.stdout.trim() !== '', problem: null };
  }
  return grep.status === 1
    ? { addsGsap: false, problem: null }
    : { addsGsap: false, problem: grep.failure };
}

/**
 * Splits Markdown into lines, each marked as inside or outside a fenced code block, as
 * `readme.test.js` does. Fence lines themselves count as inside.
 *
 * @param {string} text The Markdown.
 * @returns {{ text: string, inFence: boolean }[]} The lines.
 */
function markdownLines(text) {
  let inFence = false;
  return text.split(/\r?\n/).map((line) => {
    const isFence = /^```/.test(line);
    const opensOrCloses = isFence && (!inFence || /^```\s*$/.test(line));
    const entry = { text: line, inFence: inFence || opensOrCloses };
    if (opensOrCloses) {
      inFence = !inFence;
    }
    return entry;
  });
}

/**
 * Returns the text of a Markdown section, from after its heading to the next heading
 * of the same or a higher level, as `readme.test.js` does.
 *
 * @param {string} markdown The Markdown.
 * @param {string} heading The full heading line, such as `## License`.
 * @returns {string | null} The section's text, or null when the heading is missing.
 */
function sectionText(markdown, heading) {
  const lines = markdownLines(markdown);
  const level = heading.indexOf(' ');
  const start = lines.findIndex((line) => !line.inFence && line.text.trimEnd() === heading);
  if (start === -1) {
    return null;
  }
  const ends = new RegExp(`^#{1,${level}}\\s`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => !line.inFence && ends.test(line.text));
  return (end === -1 ? rest : rest.slice(0, end)).map((line) => line.text).join('\n');
}

/**
 * Lists the relative link targets in Markdown, as repo paths without a fragment or query.
 *
 * @param {string} markdown The Markdown.
 * @returns {string[]} The paths.
 */
function relativeLinkPaths(markdown) {
  const targets = [...markdown.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map(
    (match) => match[1]
  );
  return targets
    .filter((target) => !/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^[#/]/.test(target))
    .map((target) => path.posix.normalize(target.replace(/[#?].*$/, '')))
    .filter((target) => target !== '.' && !target.startsWith('../'));
}

/**
 * Whether a text holds the section 7 permission for GSAP granted by Valhalla Tech.
 *
 * @param {string} text The candidate text.
 * @returns {boolean} True when it names GSAP, Valhalla Tech and section 7.
 */
function holdsPermission(text) {
  return PERMISSION_WORDS.every((word) => text.includes(word)) && SECTION_7.test(text);
}

/**
 * Runs AC-3's checks on a commit's tree.
 *
 * @param {string} commit The commit (F).
 * @returns {string[]} One line per failed check; empty when all pass.
 */
function licenseCheckFailures(commit) {
  const { manifest, problem: manifestProblem } = manifestAt(commit);
  const readme = git(['show', `${commit}:README.md`]);
  const license = git(['show', `${commit}:LICENSE`]);
  const baselineLicense = git(['show', `${BASELINE_REF}:LICENSE`]);
  const problems = [manifestProblem, readme.problem, license.problem, baselineLicense.problem];
  if (problems.some((problem) => problem !== null)) {
    return problems.filter((problem) => problem !== null);
  }

  const failures = [];
  if (!LICENSE_EXPRESSION.test(String(manifest.license))) {
    failures.push(
      `package.json license is ${JSON.stringify(manifest.license)}, not ${LICENSE_EXPRESSION}`
    );
  }
  const licenseSection = sectionText(readme.stdout, LICENSE_HEADING);
  if (licenseSection === null) {
    return [...failures, `README.md has no "${LICENSE_HEADING}" section`];
  }
  if (!licenseSection.includes(LICENSE_ID) || licenseSection.includes(OR_LATER_ID)) {
    failures.push(`README "${LICENSE_HEADING}" must contain ${LICENSE_ID} and not ${OR_LATER_ID}`);
  }
  const linkedTexts = relativeLinkPaths(licenseSection)
    .map((linked) => git(['show', `${commit}:${linked}`]))
    .filter((shown) => !shown.problem)
    .map((shown) => shown.stdout);
  if (![licenseSection, ...linkedTexts].some(holdsPermission)) {
    failures.push(
      `neither README "${LICENSE_HEADING}" nor a tracked file it links to names GSAP, ` +
        `Valhalla Tech and section 7`
    );
  }
  if (!license.stdout.includes(baselineLicense.stdout)) {
    failures.push(`LICENSE does not hold ${BASELINE}'s LICENSE as one contiguous block`);
  }
  return failures;
}

/**
 * AC-4: finds F and runs AC-3's checks on its tree.
 *
 * @returns {string[]} One line per problem; empty when AC-4 holds.
 */
function permissionOrderProblems() {
  const history = readSprintHistory();
  if (history.problem) {
    return [`AC-4: reading history failed: ${history.problem}`];
  }
  const end = history.releaseCommit
    ? history.commits.indexOf(history.releaseCommit) + 1
    : history.commits.length;
  const walked = history.commits.slice(0, end);
  for (const commit of walked) {
    const { addsGsap, problem } = commitAddsGsap(commit);
    if (problem) {
      return [`AC-4: checking ${commit} for GSAP failed: ${problem}`];
    }
    if (addsGsap) {
      return licenseCheckFailures(commit).map(
        (failure) => `AC-4: F = ${commit}, walked to ${endPoint(history)}: ${failure}`
      );
    }
  }
  return [
    `AC-4: no first-parent commit after ${BASELINE} adds GSAP ` +
      `(walked ${walked.length} commit(s) to ${endPoint(history)})`,
  ];
}

/**
 * Parses every v1 gate-evidence block in `text`, as `pr-gate-evidence.test.js` does.
 *
 * @param {string} text A PR body or comment.
 * @returns {Array<{ sha: string | null, commands: string[], exitCodes: Array<number | string> }>}
 *   One entry per marker, in order.
 */
function parseEvidenceBlocks(text) {
  return text
    .split(EVIDENCE_MARKER)
    .slice(1)
    .map((section) => {
      const block = { sha: null, commands: [], exitCodes: [] };
      let inTable = false;
      for (const line of section.split(/\r?\n/)) {
        const commit = COMMIT_LINE.exec(line);
        if (commit && block.sha === null) {
          block.sha = commit[1];
        }
        const row = STEP_ROW.exec(line);
        if (row) {
          inTable = true;
          block.commands.push(row[2]);
          block.exitCodes.push(/^\d+$/.test(row[3]) ? Number(row[3]) : row[3]);
        } else if (inTable && !line.startsWith('|')) {
          break;
        }
      }
      return block;
    });
}

/**
 * Lists the merged sprint 3 PRs (AC-39's search).
 *
 * @returns {{ prs: Array<{ number: number, headRefOid: string }>, problem: string | null }}
 *   The PRs, or the problem.
 */
function listSprintPrs() {
  const search = ghJson([
    'pr',
    'list',
    '--state',
    'merged',
    '--search',
    SPRINT_SEARCH,
    '--json',
    'number,headRefOid',
  ]);
  return { prs: Array.isArray(search.data) ? search.data : [], problem: search.problem };
}

/**
 * Reads a PR's body and comments.
 *
 * @param {number} number The PR number.
 * @returns {{ body: string, comments: string[], problem: string | null }} The texts, or
 *   the problem.
 */
function readPr(number) {
  const view = ghJson(['pr', 'view', String(number), '--json', 'body,comments']);
  const comments = Array.isArray(view.data?.comments) ? view.data.comments : [];
  return {
    body: view.data?.body ?? '',
    comments: comments.map((comment) => comment?.body ?? ''),
    problem: view.problem,
  };
}

/**
 * Checks one merged PR for a passing v1 block on its head commit.
 *
 * @param {{ number: number, headRefOid: string }} pr The PR.
 * @returns {string | null} The problem, or null when the PR carries the evidence.
 */
function gateEvidenceProblem(pr) {
  const view = readPr(pr.number);
  if (view.problem) {
    return `AC-39: reading PR #${pr.number} failed: ${view.problem}`;
  }
  const passing = [view.body, ...view.comments]
    .flatMap(parseEvidenceBlocks)
    .some(
      (block) =>
        block.sha === pr.headRefOid &&
        block.commands.join('\n') === CANONICAL_COMMANDS.join('\n') &&
        block.exitCodes.every((code) => code === 0)
    );
  return passing
    ? null
    : `AC-39: PR #${pr.number} has no v1 gate-evidence block for ${pr.headRefOid} with six 0 exit codes`;
}

/**
 * Parses the size record in a PR body (AD-18).
 *
 * @param {string} body The PR body.
 * @returns {Record<string, number> | null} The byte counts by label, or null when the
 *   body holds no marker.
 */
function parseSizeRecord(body) {
  const sections = body.split(SIZE_MARKER);
  if (sections.length < 2) {
    return null;
  }
  const record = {};
  for (const line of sections[1].split(/\r?\n/)) {
    const entry = SIZE_LINE.exec(line);
    if (entry) {
      record[`${entry[1]} ${entry[2]}`] = Number(entry[3]);
    } else if (line.trim() !== '' && Object.keys(record).length > 0) {
      break;
    }
  }
  return record;
}

/**
 * Finds the one merged sprint 3 PR whose body holds the size record.
 *
 * @returns {{ number: number | null, record: Record<string, number>, problem: string | null }}
 *   The PR and its record, or the problem.
 */
function findSizeRecord() {
  const none = { number: null, record: {} };
  const { prs, problem } = listSprintPrs();
  if (problem) {
    return { ...none, problem: `AC-43: listing merged PRs failed: ${problem}` };
  }
  const holders = [];
  for (const pr of prs) {
    const view = readPr(pr.number);
    if (view.problem) {
      return { ...none, problem: `AC-43: reading PR #${pr.number} failed: ${view.problem}` };
    }
    const record = parseSizeRecord(view.body);
    if (record) {
      holders.push({ number: pr.number, record });
    }
  }
  if (holders.length !== 1) {
    const which = holders.map((holder) => `#${holder.number}`).join(', ') || 'none';
    const reason =
      holders.length === 0
        ? `no merged gsap-animations PR holds a size record (${SIZE_MARKER})`
        : `${holders.length} merged gsap-animations PRs hold a size record, not 1`;
    return {
      ...none,
      problem: `AC-43: ${reason}; ${prs.length} merged PR(s) searched, holders: ${which}`,
    };
  }
  return { ...holders[0], problem: null };
}

/**
 * Runs a constant command line through the shell in a worktree.
 *
 * @param {string} command The command line.
 * @param {string} cwd Where it runs.
 * @param {number} timeout Upper bound in milliseconds.
 * @returns {string | null} The problem, or null when it exited 0.
 */
function runInWorktree(command, cwd, timeout) {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout,
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    env: childEnv(),
  });
  return result.error || result.status !== 0 ? describeRun(`"${command}" in ${cwd}`, result) : null;
}

/**
 * Lists every `.js` file under a directory.
 *
 * @param {string} directory The directory.
 * @returns {string[]} The files' paths.
 */
function jsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return jsFiles(full);
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

/**
 * Sums the raw and gzip sizes of `dist/**\/*.js` (AC-43).
 *
 * @param {string} dist The `dist` directory.
 * @returns {{ raw: number, gzip: number }} The two sums.
 */
function measureScripts(dist) {
  return jsFiles(dist).reduce(
    (sums, file) => {
      const bytes = fs.readFileSync(file);
      return {
        raw: sums.raw + bytes.length,
        gzip: sums.gzip + zlib.gzipSync(bytes, { level: GZIP_LEVEL }).length,
      };
    },
    { raw: 0, gzip: 0 }
  );
}

/**
 * Adds a worktree of `ref`, installs and builds it, and measures its scripts.
 *
 * @param {string} ref The commit or tag.
 * @param {string} worktree Where the worktree goes.
 * @returns {{ raw: number, gzip: number } | string} The sums, or the problem.
 */
function buildAndMeasure(ref, worktree) {
  const added = git(['worktree', 'add', '--detach', worktree, ref]);
  const problem =
    added.problem ??
    runInWorktree(INSTALL_COMMAND, worktree, INSTALL_TIMEOUT_MS) ??
    runInWorktree(BUILD_COMMAND, worktree, BUILD_TIMEOUT_MS);
  if (problem) {
    return problem;
  }
  try {
    return measureScripts(path.join(worktree, 'dist'));
  } catch (error) {
    return `measuring ${ref}'s dist failed: ${error.message}`;
  }
}

/**
 * Removes the scratch worktrees and their directory, then prunes git's worktree list.
 * Each step runs whether or not an earlier one failed.
 *
 * @param {string} scratch The temp directory holding the worktrees.
 * @param {string[]} worktrees The worktrees' paths.
 * @returns {string[]} One line per failed step; empty when all worked.
 */
function removeScratch(scratch, worktrees) {
  const failures = worktrees
    .filter((worktree) => fs.existsSync(worktree))
    .map((worktree) => git(['worktree', 'remove', '--force', worktree]).problem);
  try {
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
  } catch (error) {
    failures.push(`removing ${scratch} failed: ${error.message}`);
  }
  failures.push(git(['worktree', 'prune']).problem);
  return failures
    .filter((failure) => failure !== null)
    .map((failure) => `AC-43 cleanup: ${failure}`);
}

/**
 * Builds the baseline and the release commit in scratch worktrees and measures both,
 * always removing the worktrees.
 *
 * @param {string} releaseCommit The release commit.
 * @returns {{ sizes: Record<string, number>, problems: string[] }} The four measured
 *   sums by label, and any problems.
 */
function measureBothBuilds(releaseCommit) {
  const builds = [
    { version: BASELINE, ref: BASELINE_REF },
    { version: RELEASE, ref: releaseCommit },
  ];
  const sizes = {};
  const problems = [];
  let scratch = null;
  try {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'gsap-animations-size-'));
    for (const build of builds) {
      const measured = buildAndMeasure(build.ref, path.join(scratch, build.version));
      if (typeof measured === 'string') {
        problems.push(`AC-43: building ${build.version} (${build.ref}) failed: ${measured}`);
        break;
      }
      sizes[`${build.version} raw`] = measured.raw;
      sizes[`${build.version} gzip`] = measured.gzip;
    }
  } catch (error) {
    problems.push(`AC-43: the scratch builds failed: ${error.message}`);
  } finally {
    if (scratch !== null) {
      const worktrees = builds.map((build) => path.join(scratch, build.version));
      problems.push(...removeScratch(scratch, worktrees));
    }
  }
  return { sizes, problems };
}

/**
 * AC-43: compares the size record with fresh measurements.
 *
 * @returns {string[]} One line per problem or mismatch; empty when AC-43 holds.
 */
function sizeRecordProblems() {
  const found = findSizeRecord();
  if (found.problem) {
    return [found.problem];
  }
  const missing = SIZE_LABELS.filter((label) => !(label in found.record));
  if (missing.length > 0) {
    return [`AC-43: PR #${found.number}'s size record lacks ${missing.join(', ')}`];
  }
  const history = readSprintHistory();
  if (history.problem) {
    return [`AC-43: reading history failed: ${history.problem}`];
  }
  if (!history.releaseCommit) {
    return [`AC-43: no release commit yet: ${endPoint(history)} has no ${RELEASE} commit`];
  }
  const { sizes, problems } = measureBothBuilds(history.releaseCommit);
  if (problems.length > 0) {
    return problems;
  }
  return SIZE_LABELS.filter(
    (label) => Math.abs(found.record[label] - sizes[label]) > SIZE_TOLERANCE * sizes[label]
  ).map(
    (label) =>
      `AC-43: PR #${found.number} records ${label} as ${found.record[label]} bytes; ` +
      `measured ${sizes[label]} bytes, outside 1 %`
  );
}

/**
 * AC-44: reads the version at the release commit.
 *
 * @returns {string} The version, or a line naming why there is none.
 */
function releaseVersion() {
  const history = readSprintHistory();
  if (history.problem) {
    return `PROBLEM: reading history failed: ${history.problem}`;
  }
  if (!history.releaseCommit) {
    return (
      `no release commit yet: no first-parent commit in ${BASELINE}..origin/main ` +
      `(${history.mainSha}) has version ${RELEASE}`
    );
  }
  const { manifest, problem } = manifestAt(history.releaseCommit);
  return problem ? `PROBLEM: ${problem}` : String(manifest.version);
}

/**
 * AC-44: reads whether `origin` has the release tag.
 *
 * @returns {string} `absent`, `present: <lines>`, or a line naming the problem.
 */
function remoteTagState() {
  const listed = git(['ls-remote', '--tags', 'origin', RELEASE_TAG_REF]);
  if (listed.problem) {
    return `PROBLEM: ${listed.problem}`;
  }
  const lines = listed.stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.length === 0 ? 'absent' : `present: ${lines.join('; ')}`;
}

/**
 * AC-44: reads whether GitHub has the release. Only gh's "release not found" counts as
 * absent; any other non-zero exit is a problem, not an absence.
 *
 * @returns {string} `absent`, `present`, or a line naming the problem.
 */
function githubReleaseState() {
  const result = run('gh', ['release', 'view', RELEASE], GH_TIMEOUT_MS);
  if (result.status === 0) {
    return 'present';
  }
  return /release not found/i.test(result.stderr) ? 'absent' : `PROBLEM: ${result.failure}`;
}

describe('gsap-animations chain R: the sprint 3 release records', () => {
  it('AC-4: the section 7 permission is on main no later than the first GSAP code', () => {
    // Arrange, Act
    const problems = permissionOrderProblems();

    // Assert
    expect(problems).toEqual([]);
  });

  it('AC-39: each merged gsap-animations PR carries a passing v1 gate block for its head', () => {
    // Arrange
    const { prs, problem } = listSprintPrs();

    // Act
    const problems = problem
      ? [`AC-39: listing merged PRs failed: ${problem}`]
      : prs.length === 0
        ? [`AC-39: no merged PR has "${SPRINT_SEARCH}"; the list is empty`]
        : prs.map(gateEvidenceProblem).filter((line) => line !== null);

    // Assert
    expect(problems).toEqual([]);
  });

  it(
    'AC-43: the size record in the merged PR matches clean builds of 5.0.0 and the release commit',
    () => {
      // Arrange, Act
      const problems = sizeRecordProblems();

      // Assert
      expect(problems).toEqual([]);
    },
    AC_43_TIMEOUT_MS
  );

  it('AC-44: the release commit is version 5.1.0, with no tag and no GitHub release', () => {
    // Arrange, Act
    const state = {
      version: releaseVersion(),
      remoteTag: remoteTagState(),
      githubRelease: githubReleaseState(),
    };

    // Assert
    expect(state).toEqual({ version: RELEASE, remoteTag: 'absent', githubRelease: 'absent' });
  });
});
