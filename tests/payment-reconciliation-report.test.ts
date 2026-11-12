import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const scriptPath = resolve(process.cwd(), 'scripts/report-payment-reconciliation.mjs');
const runId = 'c78b31c2-350c-4c44-a953-131f7de66c3d';

const runReport = (summary: Record<string, unknown>) => {
  const directory = mkdtempSync(join(tmpdir(), 'payment-reconciliation-report-'));
  const summaryPath = join(directory, 'summary.md');
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      input: JSON.stringify(summary),
      encoding: 'utf8',
      env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath },
    });
    return {
      ...result,
      stepSummary: existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8') : '',
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const baseSummary = {
  runId,
  status: 'ok',
  checked: 12,
  matched: 10,
  repaired: 0,
  findingsOpened: 2,
  highSeverityOpen: 4,
  error: null,
};

test('open high-severity findings warn without marking a healthy run failed', () => {
  const result = runReport(baseSummary);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::warning::4 high-severity/);
  assert.match(result.stepSummary, /Status: \*\*ok\*\*/);
  assert.match(result.stepSummary, /Open high-severity findings: 4/);
});

test('partial and failed runs produce actionable errors and a summary', () => {
  for (const status of ['partial', 'failed']) {
    const result = runReport({
      ...baseSummary,
      status,
      error: 'Inspect the application log for this run.',
    });
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, new RegExp(`finished with status ${status}`));
    assert.match(result.stderr, /Inspect the application log/);
    assert.match(result.stepSummary, new RegExp(`Status: \\*\\*${status}\\*\\*`));
  }
});

test('invalid or malformed summaries fail instead of appearing successful', () => {
  for (const summary of [
    { ...baseSummary, status: 'unknown' },
    { ...baseSummary, checked: -1 },
    { ...baseSummary, runId: 'not-a-run-id' },
  ]) {
    const result = runReport(summary);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid summary/);
  }
});
