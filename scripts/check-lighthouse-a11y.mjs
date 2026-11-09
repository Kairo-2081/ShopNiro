import { readFile } from 'node:fs/promises';

const reportPath = process.argv[2];
if (!reportPath) {
  throw new Error('Pass the Lighthouse JSON report path as the first argument.');
}

const report = JSON.parse(await readFile(reportPath, 'utf8'));
const score = report.categories?.accessibility?.score;
if (typeof score !== 'number') {
  throw new Error('The Lighthouse report does not include an accessibility score.');
}

const failedAudits = (report.categories.accessibility.auditRefs || [])
  .filter((audit) => audit.weight > 0 && report.audits?.[audit.id]?.score === 0)
  .map((audit) => report.audits[audit.id].title);

console.log(`Lighthouse accessibility score: ${Math.round(score * 100)}/100`);
if (failedAudits.length > 0) {
  console.error(`Failed audits: ${failedAudits.join('; ')}`);
}
if (score < 0.95) {
  console.error('Lighthouse accessibility score must be at least 95.');
  process.exitCode = 1;
}