import { createSecureServer } from 'node:http2';
import { request as httpRequest } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// A self-signed HTTP/2 front that forwards every request to the HTTP/1.1 app, like the edge in front of Render.
export function startH2Front(port, target) {
  const dir = mkdtempSync(path.join(tmpdir(), 'shopniro-h2-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1',
    '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
  const upstream = new URL(target);
  const hopByHop = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection']);
  const server = createSecureServer({ key: readFileSync(key), cert: readFileSync(cert), allowHTTP1: true });
  server.on('request', (req, res) => {
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) if (!name.startsWith(':') && !hopByHop.has(name)) headers[name] = value;
    headers.host = req.headers[':authority'] || req.headers.host || `127.0.0.1:${port}`;
    headers['x-forwarded-proto'] = 'https';
    // Each run is a separate visitor. The app trusts one proxy hop (as it does behind Render), so a fresh forwarded
    // address per run gives each its own rate-limit bucket, as real visitors have, instead of sharing one.
    const run = Number(headers['x-measure-run'] ?? 0);
    delete headers['x-measure-run'];
    headers['x-forwarded-for'] = `10.77.${(run >> 8) & 255}.${run & 255}`;
    const forward = httpRequest({ host: upstream.hostname, port: upstream.port, method: req.method, path: req.url, headers }, (reply) => {
      const out = {};
      for (const [name, value] of Object.entries(reply.headers)) if (!hopByHop.has(name)) out[name] = value;
      res.writeHead(reply.statusCode ?? 502, out);
      reply.pipe(res);
    });
    forward.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(forward);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
