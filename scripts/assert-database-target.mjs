// Refuses to continue unless DATABASE_URL points at the database this GitHub Environment is meant to use.
//
// Each Environment keeps its own MIGRATE_DATABASE_URL secret under the same name, so a wrong value in one Environment
// would send migrations to another environment's database with no error. This compares the database's project reference
// (the Supabase project id that appears in the host, or in the pooler user name) with EXPECTED_DATABASE_REF, a
// non-secret variable set per Environment. It fails closed: no expected reference, no run.
//
// It never prints the connection string, the host or the password. Usage: node scripts/assert-database-target.mjs <label>

const label = process.argv[2] ?? 'this environment';
const expected = (process.env.EXPECTED_DATABASE_REF ?? '').trim();
const url = (process.env.DATABASE_URL ?? '').trim();

const fail = (message) => {
  console.error(`::error::${message}`);
  process.exit(1);
};

if (!/^[a-z0-9]{8,64}$/.test(expected)) {
  fail(`The '${label}' Environment has no valid EXPECTED_DATABASE_REF variable (the database project reference, lower-case letters and digits). Set it in Settings, Environments, ${label}, Environment variables. Nothing was changed.`);
}
if (!url) fail(`The '${label}' Environment has no database URL, so its target cannot be checked. Nothing was changed.`);

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail(`The '${label}' database URL is not a valid URL. Nothing was changed.`);
}

const hostLabels = parsed.hostname.toLowerCase().split('.');
const userParts = decodeURIComponent(parsed.username).toLowerCase().split('.');
// Direct connections carry the reference in the host (db.<ref>.supabase.co); the pooler carries it in the user (postgres.<ref>).
const matches = hostLabels.includes(expected) || userParts.includes(expected);

if (!matches) {
  fail(`The database URL in the '${label}' Environment does not belong to the project reference "${expected}". Refusing to run, so nothing was changed. Check MIGRATE_DATABASE_URL and EXPECTED_DATABASE_REF for this Environment.`);
}
console.log(`Database target check passed for '${label}' (project reference ${expected}).`);
