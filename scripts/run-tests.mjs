// Runs the test suite. Two files share the database in a way that makes them unsafe to run beside any other
// file: payment-reconciliation scans every payment in the database, while payment-integrity creates, pays and
// refunds payments there. Run together (node --test runs files in parallel) they intermittently deadlock or see
// each other's rows. So those files run first, one at a time, with nothing else running; every other file then
// runs in parallel as before. Any extra arguments are passed to both runs.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SERIAL = ['payment-reconciliation.test.ts', 'payment-integrity.test.ts'];

const all = readdirSync('tests', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => join(entry.parentPath ?? entry.path, entry.name))
  .sort();
const serial = all.filter((file) => SERIAL.includes(file.split(/[\\/]/).pop()));
const parallel = all.filter((file) => !serial.includes(file));
const missing = SERIAL.filter((name) => !serial.some((file) => file.endsWith(name)));
if (missing.length) {
  console.error(`run-tests: expected serial test files not found: ${missing.join(', ')}`);
  process.exit(1);
}

const extra = process.argv.slice(2);
const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' };
const run = (files, concurrency) =>
  spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test', ...(concurrency ? [`--test-concurrency=${concurrency}`] : []), ...extra, ...files],
    { stdio: 'inherit', env }
  ).status ?? 1;

const serialStatus = run(serial, 1);
const parallelStatus = run(parallel);
process.exit(serialStatus || parallelStatus);
