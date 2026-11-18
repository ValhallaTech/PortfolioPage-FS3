/**
 * Command-line options of the gate runner (spec stabilize-and-cleanup, section
 * 3.7 chain A):
 *
 *   node scripts/gate.mjs [--env <label>]
 *                         [--fresh-clone <url> --ref <sha> [--autocrlf]]
 *                         [--commands-file <json>]
 *                         [--out <file>]
 *
 * Every value is validated here, before anything runs. A value that fails
 * validation is a usage error (exit 64). No value parsed here is ever spliced
 * into a shell string: the runner passes git its arguments as an array, and
 * prints `--env` only after the allow-list below has accepted it.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { CANONICAL_COMMANDS } from './evidence.mjs';

/** Exit code of a usage error (sysexits EX_USAGE). */
export const EXIT_USAGE = 64;

/**
 * Characters an `--env` label may hold. The label is printed inside backticks
 * on one line of the evidence block, so backticks, `|`, `<`, `>` and every
 * control character (newlines included) are refused: none of them can then
 * close the code span, start a new line, or forge a table row or a marker.
 */
const ENV_LABEL_PATTERN = /^[A-Za-z0-9 .,:;@()+/_=#-]{1,200}$/;

/**
 * A commit SHA: abbreviated (7+ hex) up to a full SHA-1 (40) or SHA-256 (64).
 * Hex only, so the value can never be read by git as an option or a range.
 */
const REF_PATTERN = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;

/** Code unit of a byte-order mark, which JSON.parse refuses at the start of a file. */
const BYTE_ORDER_MARK = 0xfeff;

/** The only clone transport accepted by `--fresh-clone`. */
const CLONE_PROTOCOL = 'https:';

/** Options of the chain A seam; `strict` parsing refuses anything else. */
const CLI_OPTIONS = {
  env: { type: 'string' },
  'fresh-clone': { type: 'string' },
  ref: { type: 'string' },
  autocrlf: { type: 'boolean' },
  'commands-file': { type: 'string' },
  out: { type: 'string' },
};

/** A usage error: the runner prints its message on stderr and exits 64. */
export class UsageError extends Error {
  /**
   * @param {string} message What was wrong with the invocation.
   */
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * @typedef {object} FreshClone
 * @property {string} url Validated `https:` clone URL.
 * @property {string} ref Validated commit SHA, lower-cased.
 * @property {boolean} autocrlf Clone with `core.autocrlf=true`.
 */

/**
 * @typedef {object} GateOptions
 * @property {string | undefined} env Validated Environment label, if given.
 * @property {FreshClone | undefined} freshClone Fresh-clone request, if given.
 * @property {string | undefined} commandsFile Absolute path of the test-only commands file.
 * @property {string | undefined} out Absolute path the block alone is written to.
 */

/**
 * Parses and validates the gate CLI arguments.
 *
 * @param {string[]} argv Arguments after the script path.
 * @param {string} cwd Directory that relative paths resolve against.
 * @returns {GateOptions} The validated options.
 * @throws {UsageError} On an unknown option, a missing value, or an invalid value.
 */
export function parseGateArgs(argv, cwd) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: CLI_OPTIONS,
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }

  return {
    env: values.env === undefined ? undefined : validateEnvLabel(values.env),
    freshClone: parseFreshClone(values),
    commandsFile: resolvePath(values['commands-file'], cwd, '--commands-file'),
    out: resolvePath(values.out, cwd, '--out'),
  };
}

/**
 * Checks an `--env` label against the allow-list.
 *
 * @param {string} label The raw label.
 * @returns {string} The label, unchanged.
 * @throws {UsageError} When the label is empty, too long, or holds a refused character.
 */
function validateEnvLabel(label) {
  if (!ENV_LABEL_PATTERN.test(label)) {
    throw new UsageError(
      '--env must be 1 to 200 characters of letters, digits, spaces and . , : ; @ ( ) + / _ = # -'
    );
  }
  return label;
}

/**
 * Builds the fresh-clone request from the parsed values. `--ref` and
 * `--autocrlf` are meaningful only with `--fresh-clone`, and `--fresh-clone`
 * needs `--ref`.
 *
 * @param {{ ref?: string, autocrlf?: boolean, 'fresh-clone'?: string }} values Parsed option values.
 * @returns {FreshClone | undefined} The request, or undefined without `--fresh-clone`.
 * @throws {UsageError} On a missing or invalid value, or a flag used without `--fresh-clone`.
 */
function parseFreshClone(values) {
  const url = values['fresh-clone'];
  const ref = values.ref;
  const autocrlf = values.autocrlf === true;

  if (url === undefined) {
    if (ref !== undefined || autocrlf) {
      throw new UsageError('--ref and --autocrlf are valid only with --fresh-clone');
    }
    return undefined;
  }
  if (ref === undefined) {
    throw new UsageError('--fresh-clone needs --ref <sha>');
  }
  if (!REF_PATTERN.test(ref)) {
    throw new UsageError('--ref must be a commit SHA: 7 to 40, or 64, hexadecimal characters');
  }
  return { url: validateCloneUrl(url), ref: ref.toLowerCase(), autocrlf };
}

/**
 * Accepts only an absolute `https:` URL with no embedded credentials. That
 * rules out git's `ext::` and `file` transports, local paths, and a value git
 * could read as an option.
 *
 * @param {string} raw The `--fresh-clone` value.
 * @returns {string} The URL as given.
 * @throws {UsageError} When the value is not such a URL.
 */
function validateCloneUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UsageError('--fresh-clone must be an absolute https:// URL');
  }
  if (parsed.protocol !== CLONE_PROTOCOL || parsed.hostname === '') {
    throw new UsageError('--fresh-clone must be an absolute https:// URL');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new UsageError('--fresh-clone must not carry credentials in the URL');
  }
  return raw;
}

/**
 * Resolves an optional path option against `cwd`.
 *
 * @param {string | undefined} value The parsed option value.
 * @param {string} cwd Base directory.
 * @param {string} flag Option name, for the error message.
 * @returns {string | undefined} The absolute path, or undefined when not given.
 * @throws {UsageError} When the value is empty.
 */
function resolvePath(value, cwd, flag) {
  if (value === undefined) {
    return undefined;
  }
  if (value === '') {
    throw new UsageError(`${flag} needs a file path`);
  }
  return path.resolve(cwd, value);
}

/**
 * Loads the test-only `--commands-file` (chain A format): a UTF-8 JSON array
 * of exactly six strings, string i being the shell command run for step i + 1.
 *
 * @param {string} file Absolute path of the commands file.
 * @returns {Promise<string[]>} The six commands.
 * @throws {UsageError} When the file cannot be read or is not that array.
 */
export async function loadCommandsFile(file) {
  let text;
  try {
    text = await readFile(file, { encoding: 'utf8' });
  } catch (error) {
    throw new UsageError(`--commands-file could not be read: ${describe(error)}`);
  }

  let commands;
  try {
    commands = JSON.parse(text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text);
  } catch (error) {
    throw new UsageError(`--commands-file is not valid JSON: ${describe(error)}`);
  }

  const expected = CANONICAL_COMMANDS.length;
  if (!Array.isArray(commands)) {
    throw new UsageError(`--commands-file must hold a JSON array of ${expected} strings`);
  }
  if (commands.length !== expected) {
    throw new UsageError(
      `--commands-file must hold exactly ${expected} strings, found ${commands.length}`
    );
  }
  const nonString = commands.findIndex((command) => typeof command !== 'string');
  if (nonString !== -1) {
    throw new UsageError(`--commands-file item ${nonString + 1} is not a string`);
  }
  return commands;
}

/**
 * Describes an unknown thrown value in one line.
 *
 * @param {unknown} error The thrown value.
 * @returns {string} Its message.
 */
function describe(error) {
  return error instanceof Error ? error.message : String(error);
}
