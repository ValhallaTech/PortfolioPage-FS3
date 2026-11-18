/**
 * Local gate runner (stub).
 *
 * CLI seam (spec stabilize-and-cleanup, section 3.7 chain A):
 *
 *   node scripts/gate.mjs [--env <label>]
 *                         [--fresh-clone <url> --ref <sha> [--autocrlf]]
 *                         [--commands-file <json>]
 *                         [--out <file>]
 *
 * This is the WI-2 stub. It accepts every flag in the seam, ignores the
 * content of the commands file, runs no gate step and has no preflight.
 * It prints the v1 gate-evidence header and an empty step table to stdout,
 * writes the same text to `--out <file>` when given, and exits 0.
 * WI-4 replaces this with the real runner.
 */
import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { parseArgs, promisify } from 'node:util';

const execAsync = promisify(exec);

/** Evidence block marker that AC-2 searches for. */
const EVIDENCE_MARKER = '<!-- gate-evidence:v1 -->';

/** Spec slug named in the evidence heading. */
const SPEC_SLUG = 'stabilize-and-cleanup';

/** Upper bound for each version probe, so a hung child never hangs the stub. */
const PROBE_TIMEOUT_MS = 60_000;

/** Printed in place of a value the stub could not read. */
const UNAVAILABLE = 'unavailable';

/** Every option in the chain A seam. */
const CLI_OPTIONS = {
  env: { type: 'string' },
  'fresh-clone': { type: 'string' },
  ref: { type: 'string' },
  autocrlf: { type: 'boolean' },
  'commands-file': { type: 'string' },
  out: { type: 'string' },
};

/**
 * @typedef {object} GateOptions
 * @property {string} [env] Environment label for the evidence block.
 * @property {string} [freshClone] Clone URL (accepted, unused by the stub).
 * @property {string} [ref] Commit to check out (accepted, unused by the stub).
 * @property {boolean} [autocrlf] Clone with core.autocrlf=true (accepted, unused by the stub).
 * @property {string} [commandsFile] Test-only commands file (accepted, content ignored by the stub).
 * @property {string} [out] File the evidence block is also written to.
 */

/**
 * Parses the gate CLI arguments.
 *
 * @param {string[]} argv Arguments after the script path.
 * @returns {GateOptions} The parsed options.
 */
function parseGateArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: CLI_OPTIONS,
    strict: false,
    allowPositionals: true,
  });
  return {
    env: asString(values.env),
    freshClone: asString(values['fresh-clone']),
    ref: asString(values.ref),
    autocrlf: values.autocrlf === true,
    commandsFile: asString(values['commands-file']),
    out: asString(values.out),
  };
}

/**
 * Narrows a parsed option value to a string.
 *
 * @param {unknown} value A value from `parseArgs`.
 * @returns {string | undefined} The value when it is a string.
 */
function asString(value) {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Returns the default environment label for a host run.
 *
 * @returns {string} For example `windows host`.
 */
function defaultEnvironmentLabel() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  return `${platform} host`;
}

/**
 * Runs a fixed probe command through the shell and returns its trimmed stdout,
 * or `UNAVAILABLE` on any failure. The shell resolves the `.cmd` shims that
 * Corepack installs on Windows. Only constant command strings are passed here;
 * no caller input reaches the shell.
 *
 * @param {string} command Constant command line to run.
 * @param {import('node:child_process').ExecOptions} [options] Extra child options.
 * @returns {Promise<string>} The trimmed output.
 */
async function probe(command, options = {}) {
  try {
    const { stdout } = await execAsync(command, {
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
      ...options,
    });
    const text = String(stdout).trim();
    return text === '' ? UNAVAILABLE : text;
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Reads the commit SHA of `HEAD` in the current directory.
 *
 * @returns {Promise<string>} The 40-hex SHA, or `UNAVAILABLE`.
 */
function readHeadSha() {
  return probe('git rev-parse HEAD');
}

/**
 * Reads `yarn --version`, with the Corepack download prompt off unless the
 * caller already set it, so the probe never waits on input.
 *
 * @returns {Promise<string>} The Yarn version, or `UNAVAILABLE`.
 */
function readYarnVersion() {
  return probe('yarn --version', {
    env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', ...process.env },
  });
}

/**
 * Builds the v1 evidence block with an empty step table.
 *
 * @param {{ sha: string, environment: string, nodeVersion: string, yarnVersion: string }} facts
 *   The header values.
 * @returns {string} The block, ending in a newline.
 */
function formatEvidenceBlock({ sha, environment, nodeVersion, yarnVersion }) {
  return [
    EVIDENCE_MARKER,
    `### Gate evidence: ${SPEC_SLUG}`,
    `- Commit: \`${sha}\``,
    `- Environment: \`${environment}\``,
    `- Node: \`${nodeVersion}\` · Yarn: \`${yarnVersion}\``,
    '',
    '| # | Command | Exit code |',
    '| --- | --- | --- |',
    '',
  ].join('\n');
}

/**
 * Entry point: prints the evidence block and writes it to `--out` when given.
 *
 * @param {string[]} argv Arguments after the script path.
 * @returns {Promise<number>} The process exit code.
 */
async function main(argv) {
  const options = parseGateArgs(argv);
  const [sha, yarnVersion] = await Promise.all([readHeadSha(), readYarnVersion()]);
  const block = formatEvidenceBlock({
    sha,
    environment: options.env ?? defaultEnvironmentLabel(),
    nodeVersion: process.version,
    yarnVersion,
  });

  process.stdout.write(block);
  if (options.out !== undefined) {
    await writeFile(options.out, block, { encoding: 'utf8' });
  }
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`gate: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
