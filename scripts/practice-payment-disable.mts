process.env.NODE_ENV = 'test';
process.env.ONLINE_PAYMENTS_ENABLED = 'true';
for (const name of ['DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_DB_HOST', 'SQL_HOST', 'SQL_USER', 'SQL_PASSWORD', 'SQL_DB_NAME']) {
  delete process.env[name];
}

const [{ default: express }, { default: paymentRoutes }] = await Promise.all([
  import('express'),
  import('../server/routes/payment.routes.ts'),
]);

const app = express();
app.use('/api/payment', paymentRoutes);
const server = await new Promise<import('node:http').Server>((resolve) => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});

try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Practice server did not start.');
  const url = `http://127.0.0.1:${address.port}/api/payment/methods`;
  const baseline = await fetch(url).then((response) => response.json());
  if (!baseline.onlinePaymentsEnabled) throw new Error('Online payment baseline is not enabled.');

  const startedAt = process.hrtime.bigint();
  process.env.ONLINE_PAYMENTS_ENABLED = 'false';
  const response = await fetch(url);
  const disabled = await response.json();
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  if (response.status !== 200 || disabled.onlinePaymentsEnabled || disabled.methods.length !== 1
    || disabled.methods[0].id !== 'cash_on_delivery') {
    throw new Error(`COD-only verification failed: ${JSON.stringify(disabled)}`);
  }

  process.env.ONLINE_PAYMENTS_ENABLED = 'true';
  const restored = await fetch(url).then((result) => result.json());
  if (!restored.onlinePaymentsEnabled) throw new Error('Online payment restore verification failed.');
  console.log(JSON.stringify({
    scenario: 'gateway returns errors',
    elapsedMs: Number(elapsedMs.toFixed(1)),
    verifiedWhenDisabled: disabled.methods.map((method: { id: string }) => method.id),
    restored: restored.onlinePaymentsEnabled,
    scope: 'local in-process API only; no production host deploy',
  }));
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}