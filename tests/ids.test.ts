import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { newId, newTrackingId } from '../server/lib/ids.ts';

test('newId is prefixed, fits the 64-character ID columns, and never repeats', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 20_000; i += 1) {
    const id = newId('ORD');
    assert.match(id, /^ORD-[0-9A-HJKMNP-TV-Z]{20}$/);
    assert.ok(id.length <= 64);
    seen.add(id);
  }
  assert.equal(seen.size, 20_000, 'two IDs generated back to back must never collide');
});

test('newTrackingId is readable, unambiguous and unique', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 20_000; i += 1) {
    const id = newTrackingId();
    assert.match(id, /^TRK-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    seen.add(id);
  }
  assert.equal(seen.size, 20_000);
});

test('no route or service builds an ID from the clock or Math.random', () => {
  const files = [
    ...readdirSync('server/routes').map((name) => `server/routes/${name}`),
    ...readdirSync('server/services').map((name) => `server/services/${name}`),
  ].filter((file) => file.endsWith('.ts'));
  const offenders: string[] = [];
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (/`[A-Z][A-Z-]*-\$\{Date\.now\(\)\}/.test(line) || /Math\.random\(\)/.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], 'Use newId()/newTrackingId() from server/lib/ids.ts');
});
