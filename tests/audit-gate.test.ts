import assert from 'node:assert/strict';
import test from 'node:test';
import { advisoriesFrom, evaluate } from '../scripts/audit-gate.mjs';

const report = {
  vulnerabilities: {
    picomatch: { via: [{ source: 1, name: 'picomatch', severity: 'high', title: 'ReDoS', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }] },
    vite: { via: ['picomatch', 'fdir'] },
    qs: { via: [{ source: 2, name: 'qs', severity: 'moderate', title: 'DoS', url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff' }] },
  },
};

test('only real advisories are counted, not packages that depend on them', () => {
  assert.deepEqual(advisoriesFrom(report).map((item: { id: string }) => item.id).sort(), ['GHSA-aaaa-bbbb-cccc', 'GHSA-dddd-eeee-ffff']);
});

test('a high advisory with no exception fails the build; a moderate one does not', () => {
  const result = evaluate(report, [], new Date('2026-11-18'));
  assert.deepEqual(result.failing.map((item: { id: string }) => item.id), ['GHSA-aaaa-bbbb-cccc']);
});

test('an exception passes until its expiry date, then fails again', () => {
  const allow = [{ id: 'GHSA-aaaa-bbbb-cccc', expires: '2026-12-18', reason: 'no fix yet' }];
  const before = evaluate(report, allow, new Date('2026-12-18T10:00:00Z'));
  assert.equal(before.failing.length + before.expired.length, 0);
  assert.equal(before.excused.length, 1);
  const after = evaluate(report, allow, new Date('2026-12-19T00:00:01Z'));
  assert.deepEqual(after.expired.map((item: { id: string }) => item.id), ['GHSA-aaaa-bbbb-cccc']);
});
