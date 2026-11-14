import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gunzipSync } from 'node:zlib';
import { after, before, test } from 'node:test';
import express from 'express';
import { compressResponses } from '../server/middleware/compress.ts';
import { servePrecompressed } from '../server/middleware/precompressed.ts';

const script = `export const x = ${JSON.stringify('ShopNiro '.repeat(400))};`;
const plainOnly = `body{color:red}${' '.repeat(2000)}`;
const html = `<!doctype html><title>ShopNiro</title>${'<p>hello</p>'.repeat(200)}`;
let root = '';
let server: http.Server;
let port = 0;

before(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'shopniro-br-'));
  mkdirSync(path.join(root, 'assets'));
  writeFileSync(path.join(root, 'assets', 'app-abc123.js'), script);
  writeFileSync(path.join(root, 'assets', 'app-abc123.js.br'), brotliCompressSync(script));
  writeFileSync(path.join(root, 'assets', 'plain.css'), plainOnly); // no .br copy: must fall back
  writeFileSync(path.join(root, 'index.html'), html);
  writeFileSync(path.join(root, 'index.html.br'), brotliCompressSync(html));
  const app = express();
  app.use(compressResponses);
  app.use(servePrecompressed(root));
  app.use(express.static(root));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

after(() => new Promise<void>((resolve) => { rmSync(root, { recursive: true, force: true }); server.close(() => resolve()); }));

const get = (urlPath: string, acceptEncoding: string | undefined, method = 'GET') => new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
  const headers: Record<string, string> = acceptEncoding === undefined ? {} : { 'Accept-Encoding': acceptEncoding };
  http.request({ host: '127.0.0.1', port, path: urlPath, method, headers }, (res) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
  }).on('error', reject).end();
});

test('a browser that accepts Brotli gets the precompressed copy, labelled and typed as the original', async () => {
  const { status, headers, body } = await get('/assets/app-abc123.js', 'gzip, deflate, br');
  assert.equal(status, 200);
  assert.equal(headers['content-encoding'], 'br');
  assert.match(String(headers['content-type']), /javascript/);
  assert.match(String(headers.vary), /Accept-Encoding/i);
  assert.equal(brotliDecompressSync(body).toString(), script);
});

test('the site root serves the Brotli index.html as html', async () => {
  const { headers, body } = await get('/', 'br');
  assert.equal(headers['content-encoding'], 'br');
  assert.match(String(headers['content-type']), /text\/html/);
  assert.equal(brotliDecompressSync(body).toString(), html);
});

test('a browser without Brotli, or refusing it with q=0, still gets gzip of the same bytes', async () => {
  for (const accept of ['gzip', 'gzip, br;q=0']) {
    const { headers, body } = await get('/assets/app-abc123.js', accept);
    assert.equal(headers['content-encoding'], 'gzip', accept);
    assert.equal(gunzipSync(body).toString(), script);
  }
});

test('a request that names no encoding gets the plain file', async () => {
  const { headers, body } = await get('/assets/app-abc123.js', undefined);
  assert.equal(headers['content-encoding'], undefined);
  assert.equal(body.toString(), script);
});

test('a file with no Brotli copy is still compressed on the fly, so nothing is sent raw', async () => {
  const { headers, body } = await get('/assets/plain.css', 'br, gzip');
  // The compression middleware answers with Brotli (quality 4) when there is no build-time copy.
  assert.equal(headers['content-encoding'], 'br');
  assert.equal(brotliDecompressSync(body).toString(), plainOnly);
  const gzip = await get('/assets/plain.css', 'gzip');
  assert.equal(gunzipSync(gzip.body).toString(), plainOnly);
});

test('the .br files themselves are not a way around the rules, and unknown paths and traversal fall through', async () => {
  assert.equal((await get('/assets/%2e%2e/%2e%2e/etc/passwd', 'br')).status, 404);
  assert.equal((await get('/assets/missing.js', 'br')).status, 404);
  assert.equal((await get('/assets/%E0%A4%A', 'br')).status, 404);
});

test('HEAD answers with the same encoding and no body', async () => {
  const { headers, body } = await get('/assets/app-abc123.js', 'br', 'HEAD');
  assert.equal(headers['content-encoding'], 'br');
  assert.equal(body.length, 0);
});
