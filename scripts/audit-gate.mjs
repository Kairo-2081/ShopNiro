// Fails the build on a high or critical dependency advisory, like `npm audit --audit-level=high`, except for advisories
// listed in .github/audit-allowlist.json. An allowlist entry needs a reason and an expiry date; once the date passes
// the advisory fails the build again, so an exception cannot be forgotten.
//
// Why this exists: npm marks every package that depends on a vulnerable one as vulnerable too, and for an advisory with
// no patched release the only "fix" npm offers is a forced downgrade (vite 6.2.7 and electron-builder 24), which
// brings in a critical and more high advisories than it removes. So the gate looks at the advisories themselves.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);

/** The advisories (not the packages that merely depend on them) found in an `npm audit --json` report. */
export function advisoriesFrom(report) {
  const found = new Map();
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== 'object') continue;
      const id = String(via.url ?? '').split('/').pop() || String(via.source);
      found.set(id, { id, package: via.name ?? name, severity: via.severity, title: via.title, url: via.url });
    }
  }
  return [...found.values()];
}

/** Splits blocking advisories into those that fail the build, those excused for now, and expired exceptions. */
export function evaluate(report, allowlist, today = new Date()) {
  const failing = [];
  const excused = [];
  const expired = [];
  for (const advisory of advisoriesFrom(report)) {
    if (!BLOCKING.has(advisory.severity)) continue;
    const entry = allowlist.find((item) => item.id === advisory.id);
    if (!entry) failing.push(advisory);
    else if (new Date(`${entry.expires}T23:59:59Z`) < today) expired.push({ ...advisory, expires: entry.expires });
    else excused.push({ ...advisory, expires: entry.expires, reason: entry.reason });
  }
  return { failing, excused, expired };
}

function runAudit() {
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch (error) {
    // npm audit exits non-zero when it finds anything; the report is still on stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const allowlist = JSON.parse(readFileSync('.github/audit-allowlist.json', 'utf8'));
  const { failing, excused, expired } = evaluate(runAudit(), allowlist);
  for (const item of excused) console.log(`allowed until ${item.expires}: ${item.id} (${item.package}, ${item.severity}) - ${item.reason}`);
  for (const item of expired) console.error(`EXPIRED ${item.expires}: ${item.id} (${item.package}, ${item.severity}) ${item.url}`);
  for (const item of failing) console.error(`FAILING: ${item.id} (${item.package}, ${item.severity}) ${item.title} ${item.url}`);
  if (failing.length || expired.length) process.exit(1);
  console.log('audit gate: no unexcused high or critical advisories');
}
