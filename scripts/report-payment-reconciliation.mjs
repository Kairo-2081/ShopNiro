import { appendFileSync, readFileSync } from 'node:fs';

const countFields = ['checked', 'matched', 'repaired', 'findingsOpened', 'highSeverityOpen'];
const readResponse = () => {
  const raw = readFileSync(0, 'utf8');
  let response;
  try {
    response = JSON.parse(raw);
  } catch {
    throw new Error('Reconciliation endpoint returned invalid JSON.');
  }

  if (
    !response
    || typeof response !== 'object'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(response.runId)
    || !['ok', 'partial', 'failed'].includes(response.status)
    || countFields.some((field) => !Number.isSafeInteger(response[field]) || response[field] < 0)
    || (response.error !== undefined && response.error !== null && typeof response.error !== 'string')
  ) {
    throw new Error('Reconciliation endpoint returned an invalid summary.');
  }

  return response;
};

try {
  const result = readResponse();
  const error = result.error ?? null;
  const summary = [
    '# Payment reconciliation',
    '',
    `- Run: \`${result.runId}\``,
    `- Status: **${result.status}**`,
    `- Checked: ${result.checked}`,
    `- Matched: ${result.matched}`,
    `- Repaired: ${result.repaired}`,
    `- New findings: ${result.findingsOpened}`,
    `- Open high-severity findings: ${result.highSeverityOpen}`,
    ...(error ? [`- Detail: ${error}`] : []),
    '',
  ].join('\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  process.stdout.write(summary);
  if (result.status !== 'ok') {
    process.stderr.write(`::error::Reconciliation run ${result.runId} finished with status ${result.status}. ${error || 'Inspect the run summary and application logs.'}\n`);
    process.exitCode = 1;
  } else if (result.highSeverityOpen > 0) {
    process.stdout.write(`::warning::${result.highSeverityOpen} high-severity reconciliation finding(s) remain open. Review the admin reconciliation findings; run ${result.runId} completed successfully.\n`);
  }
} catch (error) {
  process.stderr.write(`::error::${error instanceof Error ? error.message : 'Could not read reconciliation summary.'}\n`);
  process.exitCode = 1;
}
