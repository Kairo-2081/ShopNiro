import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';
import { after, before, test } from 'node:test';
import express from 'express';
import { compressResponses } from '../server/middleware/compress.ts';

const bigText = JSON.stringify({ rows: Array.from({ length: 400 }, (_, i) => ({ id: `row-${i}`, name: 'ShopNiro product listing' })) });
let server: http.Server;
let port = 0;

before(async () => {
  const app = express();
  app.use(compressResponses);
  app.get('/big.json', (_req, res) => res.type('application/json').send(bigText));
  app.get('/small.json', (_req, res) => res.json({ ok: true }));
  app.get('/photo.png', (_req, res) => res.type('image/png').send(Buffer.alloc(8000, 1)));
  app.get('/no-transform.json', (_req, res) => res.set('Cache-Control', 'no-transform').type('application/json').send(bigText));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const get = (path: string, acceptEncoding = 'gzip') => new Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path, headers: { 'Accept-Encoding': acceptEncoding } }, (res) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
  }).on('error', reject);
});

test('compresses large text responses for clients that accept gzip', async () => {
  const { headers, body } = await get('/big.json');
  assert.equal(headers['content-encoding'], 'gzip');
  assert.ok(body.length < Buffer.byteLength(bigText) / 5, `expected a large saving, got ${body.length} of ${Buffer.byteLength(bigText)} bytes`);
  assert.equal(gunzipSync(body).toString(), bigText);
});

test('sends the original bytes when the client does not accept compression', async () => {
  const { headers, body } = await get('/big.json', 'identity');
  assert.equal(headers['content-encoding'], undefined);
  assert.equal(body.toString(), bigText);
});

test('leaves tiny responses alone', async () => {
  const { headers } = await get('/small.json');
  assert.equal(headers['content-encoding'], undefined);
});

test('does not recompress images', async () => {
  const { headers, body } = await get('/photo.png');
  assert.equal(headers['content-encoding'], undefined);
  assert.equal(body.length, 8000);
});

test('respects Cache-Control: no-transform', async () => {
  const { headers } = await get('/no-transform.json');
  assert.equal(headers['content-encoding'], undefined);
});
