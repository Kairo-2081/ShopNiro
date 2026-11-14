import type { RequestHandler } from 'express';
import { readdirSync } from 'node:fs';
import path from 'node:path';

// Serves the Brotli copies the build wrote next to the built files (app.js.br beside app.js) to browsers that accept
// Brotli. It only rewrites the request to the .br file and labels it; express.static does the sending, so caching,
// ETags and range requests behave exactly as for the plain file. Anything without a copy, and any browser that does not
// accept Brotli, falls through to the plain file and the gzip middleware.
const accepts = (header: string | undefined): boolean =>
  (header ?? '').split(',').some((part) => {
    const [name, ...params] = part.trim().split(';').map((piece) => piece.trim());
    if (name.toLowerCase() !== 'br') return false;
    const quality = params.find((param) => param.startsWith('q='));
    return !quality || Number(quality.slice(2)) > 0;
  });

function brotliCopies(root: string): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.br')) found.add(`/${path.relative(root, full).split(path.sep).join('/').slice(0, -3)}`);
    }
  };
  try { walk(root); } catch { /* no build output: nothing to serve */ }
  return found;
}

export function servePrecompressed(root: string): RequestHandler {
  const copies = brotliCopies(root);
  return (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || copies.size === 0) return next();
    if (!accepts(req.headers['accept-encoding'])) return next();
    let requested: string;
    try { requested = decodeURIComponent(req.path); } catch { return next(); }
    if (requested.endsWith('/')) requested += 'index.html';
    // Only exact, known files: the set is built from the directory listing, so there is no path to walk out of.
    if (!copies.has(requested)) return next();
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `${encodeURI(requested)}.br${query}`;
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Vary', 'Accept-Encoding');
    res.type(path.extname(requested));
    next();
  };
}
