#!/usr/bin/env node
/**
 * Serves dist/ on http://127.0.0.1:4173 for the Playwright local target (D-11).
 *
 * It applies the [[headers]] blocks of netlify.toml, so the local target carries the
 * same response headers as Netlify. It serves only regular files whose real path lies
 * inside dist/, for GET and HEAD, and needs no server dependency.
 *
 * Usage: node scripts/serve-dist.mjs
 */
import { readFileSync } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pipeline } from 'node:stream';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseToml } from 'smol-toml';

export const HOST = '127.0.0.1';
export const PORT = 4173;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const NETLIFY_TOML = path.join(REPO_ROOT, 'netlify.toml');

const CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

/** True when `candidate` is `root` itself or lies below it. Both must be absolute. */
export function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

/**
 * A decoded segment no file in dist/ is named by: NUL, a backslash (a Windows path
 * separator), a colon (a drive letter or an NTFS stream such as "::$DATA"), or a trailing
 * dot or space, which Windows strips, so "index.html." would alias "index.html".
 */
function isUnsafeSegment(segment) {
  return /[\0\\:]/.test(segment) || (segment !== '..' && /[. ]$/.test(segment));
}

/**
 * Turns a request target into a decoded URL path, or null when it cannot be one.
 * Rejects malformed percent-encoding and any segment `isUnsafeSegment` names. A
 * ".." segment is left for the containment check in `resolveCandidate`.
 */
export function decodeRequestPath(requestTarget) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestTarget, 'http://localhost').pathname);
  } catch {
    return null;
  }
  return pathname.split('/').some(isUnsafeSegment) ? null : pathname;
}

/**
 * Maps a decoded URL path to a candidate file under `root`, or null when the lexical
 * path escapes `root`. A directory path ("/" or ending in "/") maps to its index.html.
 * The caller must still confirm the real path, because a symlink can point outside.
 */
export function resolveCandidate(root, urlPath) {
  const relative = urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath;
  const candidate = path.resolve(root, `.${path.posix.sep}${relative.replace(/^[/\\]+/, '')}`);
  return isInside(root, candidate) ? candidate : null;
}

/**
 * Converts a Netlify `for` pattern to an anchored RegExp: `*` matches any run of
 * characters and `:name` matches one path segment.
 */
export function patternToRegExp(pattern) {
  const source = pattern
    .split(/(\*|:[A-Za-z0-9_]+)/)
    .map((part) => {
      if (part === '*') return '.*';
      if (/^:[A-Za-z0-9_]+$/.test(part)) return '[^/]+';
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${source}$`);
}

/**
 * Netlify collapses a multi-line value into one line: each line is trimmed and the
 * lines are joined with nothing between them.
 */
function collapseValue(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('');
}

/** Reads the [[headers]] blocks of a netlify.toml source into matchable rules. */
export function parseHeaderRules(tomlSource) {
  const blocks = parseToml(tomlSource).headers ?? [];
  return blocks.map((block) => ({
    matcher: patternToRegExp(block.for),
    values: Object.entries(block.values ?? {}).map(([name, value]) => [
      name,
      collapseValue(Array.isArray(value) ? value.join(', ') : value),
    ]),
  }));
}

/**
 * The headers every matching rule sets for a URL path. When two matching rules set
 * the same header, the values are joined with ", ", as RFC 7230 combines repeated
 * header fields.
 */
export function headersFor(rules, urlPath) {
  const headers = new Map();
  for (const rule of rules) {
    if (!rule.matcher.test(urlPath)) continue;
    for (const [name, value] of rule.values) {
      const key = name.toLowerCase();
      const existing = headers.get(key);
      headers.set(
        key,
        existing ? { name: existing.name, value: `${existing.value}, ${value}` } : { name, value }
      );
    }
  }
  return [...headers.values()];
}

function sendText(response, status, message, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
  response.end(`${message}\n`);
}

/**
 * Opens the file a URL path names, or returns null when it is missing, is not a
 * regular file, or its real path lies outside the real dist root.
 */
async function openServedFile(realRoot, urlPath) {
  const candidate = resolveCandidate(realRoot, urlPath);
  if (candidate === null) return null;

  let realFile;
  try {
    realFile = await realpath(candidate);
  } catch {
    return null;
  }
  if (!isInside(realRoot, realFile)) return null;

  const handle = await open(realFile, 'r').catch(() => null);
  if (handle === null) return null;
  const stats = await handle.stat().catch(() => null);
  if (stats === null || !stats.isFile()) {
    await handle.close();
    return null;
  }
  return { handle, size: stats.size, extension: path.extname(realFile).toLowerCase() };
}

/** Builds the request handler for a real dist root and its header rules. */
export function createHandler(realRoot, rules) {
  return async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(response, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
      return;
    }

    const urlPath = decodeRequestPath(request.url);
    if (urlPath === null) {
      sendText(response, 400, 'Bad Request');
      return;
    }

    const file = await openServedFile(realRoot, urlPath);
    if (file === null) {
      sendText(response, 404, 'Not Found');
      return;
    }

    for (const { name, value } of headersFor(rules, urlPath)) {
      response.setHeader(name, value);
    }
    response.setHeader('Content-Type', CONTENT_TYPES[file.extension] ?? 'application/octet-stream');
    response.setHeader('Content-Length', file.size);
    response.writeHead(200);

    if (request.method === 'HEAD') {
      await file.handle.close();
      response.end();
      return;
    }
    pipeline(file.handle.createReadStream(), response, (error) => {
      // A client that disconnects mid-body is not a server fault.
      if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        process.stderr.write(`serve-dist: ${error.stack ?? error}\n`);
      }
    });
  };
}

async function main() {
  let realRoot;
  try {
    realRoot = await realpath(DIST_DIR);
  } catch {
    process.stderr.write(`serve-dist: ${DIST_DIR} does not exist. Run "yarn build" first.\n`);
    process.exit(1);
  }

  const rules = parseHeaderRules(readFileSync(NETLIFY_TOML, 'utf8'));
  const handler = createHandler(realRoot, rules);
  const server = createServer((request, response) => {
    handler(request, response).catch((error) => {
      process.stderr.write(`serve-dist: ${error.stack ?? error}\n`);
      if (!response.headersSent) sendText(response, 500, 'Internal Server Error');
      else response.destroy();
    });
  });

  server.listen(PORT, HOST, () => {
    process.stdout.write(`serve-dist: serving ${realRoot} at http://${HOST}:${PORT}\n`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
