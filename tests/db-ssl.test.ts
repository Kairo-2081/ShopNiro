import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import tls from 'node:tls';
import pg from 'pg';
import { buildDatabaseSsl, loadDatabaseCa } from '../server/db/ssl.ts';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----';
const remote = 'aws-0-ap-northeast-1.pooler.supabase.com';

test('without a CA the remote connection stays encrypted but unverified (legacy behaviour)', () => {
  assert.deepEqual(buildDatabaseSsl(remote, {}), { rejectUnauthorized: false });
});

test('local hosts use no TLS by default', () => {
  assert.equal(buildDatabaseSsl('localhost', {}), false);
  assert.equal(buildDatabaseSsl('127.0.0.1', { DB_CA_CERT: PEM }), false);
});

test('a CA certificate turns on full verification', () => {
  const ssl = buildDatabaseSsl(remote, { DB_CA_CERT: PEM }) as { ca: string; rejectUnauthorized: boolean };
  assert.equal(ssl.rejectUnauthorized, true);
  assert.match(ssl.ca, /BEGIN CERTIFICATE/);
});

test('escaped newlines in DB_CA_CERT are repaired', () => {
  const escaped = PEM.replace(/\n/g, '\\n');
  const ssl = buildDatabaseSsl(remote, { DB_CA_CERT: escaped }) as { ca: string };
  assert.ok(ssl.ca.includes('-----BEGIN CERTIFICATE-----\nMIIBfake'));
});

test('a CA can be loaded from a file path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ca-'));
  const file = join(dir, 'prod-ca.crt');
  writeFileSync(file, PEM);
  assert.match(loadDatabaseCa({ DB_CA_CERT_PATH: file }) as string, /BEGIN CERTIFICATE/);
  assert.throws(() => loadDatabaseCa({ DB_CA_CERT_PATH: join(dir, 'missing.crt') }), /could not be read/);
});

test('garbage in DB_CA_CERT fails loudly', () => {
  assert.throws(() => buildDatabaseSsl(remote, { DB_CA_CERT: 'not a certificate' }), /PEM certificate/);
});

test('DATABASE_SSL=false disables TLS even with a CA', () => {
  assert.equal(buildDatabaseSsl(remote, { DATABASE_SSL: 'false', DB_CA_CERT: PEM }), false);
});

test('DB_REQUIRE_TLS_VERIFY refuses to start without a CA', () => {
  assert.throws(() => buildDatabaseSsl(remote, { DB_REQUIRE_TLS_VERIFY: 'true' }), /DB_REQUIRE_TLS_VERIFY/);
  assert.deepEqual(buildDatabaseSsl(remote, { DB_REQUIRE_TLS_VERIFY: 'true', DB_CA_CERT: PEM }) !== false, true);
});

// --- Real TLS handshake against a fake Postgres server --------------------------------------

const makeCert = (cn: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'tls-'));
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
    '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'),
    '-subj', `/CN=${cn}`, '-addext', `subjectAltName=DNS:${cn}`,
  ], { stdio: 'ignore' });
  return { key: readFileSync(join(dir, 'key.pem'), 'utf8'), cert: readFileSync(join(dir, 'cert.pem'), 'utf8') };
};

// Speaks just enough Postgres: answers the SSLRequest with 'S', then does a TLS handshake.
const startFakePostgres = (credentials: { key: string; cert: string }) =>
  new Promise<{ port: number; handshakes: () => number; close: () => void }>((resolve) => {
    let ok = 0;
    const server = net.createServer((socket) => {
      socket.once('data', () => {
        socket.write('S');
        const secure = new tls.TLSSocket(socket, { isServer: true, ...credentials });
        secure.on('secure', () => { ok += 1; secure.destroy(); });
        secure.on('error', () => {});
      });
      socket.on('error', () => {});
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: (server.address() as net.AddressInfo).port, handshakes: () => ok, close: () => server.close() });
    });
  });

const connectWith = async (port: number, ssl: pg.ClientConfig['ssl']) => {
  const client = new pg.Client({ host: '127.0.0.1', port, user: 'u', database: 'd', ssl, connectionTimeoutMillis: 3000 });
  client.on('error', () => {});
  try { await client.connect(); } catch (error: any) { return String(error?.code || error?.message); }
  return 'connected';
};

test('a server whose certificate is not signed by our CA is rejected', async () => {
  const server = await startFakePostgres(makeCert('db.test'));
  const otherCa = makeCert('db.test').cert;
  const ssl = buildDatabaseSsl(remote, { DB_CA_CERT: otherCa }) as pg.ConnectionOptions;
  const result = await connectWith(server.port, { ...ssl, servername: 'db.test' });
  server.close();
  assert.match(result, /SELF_SIGNED|UNABLE_TO_VERIFY|CERT/i, result);
  assert.equal(server.handshakes(), 0);
});

test('a server whose certificate matches our CA and hostname completes the handshake', async () => {
  const creds = makeCert('db.test');
  const server = await startFakePostgres(creds);
  const ssl = buildDatabaseSsl(remote, { DB_CA_CERT: creds.cert }) as pg.ConnectionOptions;
  await connectWith(server.port, { ...ssl, servername: 'db.test' });
  server.close();
  assert.equal(server.handshakes(), 1);
});

test('the right CA with the wrong hostname is rejected', async () => {
  const creds = makeCert('db.test');
  const server = await startFakePostgres(creds);
  const ssl = buildDatabaseSsl(remote, { DB_CA_CERT: creds.cert }) as pg.ConnectionOptions;
  const result = await connectWith(server.port, { ...ssl, servername: 'evil.example' });
  server.close();
  assert.match(result, /ERR_TLS_CERT_ALTNAME_INVALID|altname/i, result);
});
