import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL to the specific database being migrated; SUPABASE_DB_URL is intentionally not used.');
}

delete process.env.SUPABASE_DB_URL;

const [{ migrateExistingPasswordsToBcrypt }, { pool, query }] = await Promise.all([
  import('../server/db/seed.ts'),
  import('../server/db/index.ts'),
]);

try {
  const migratedCount = await migrateExistingPasswordsToBcrypt();
  const result = await query('SELECT id, password FROM users');
  const plaintextCount = result.rows.filter((user) => !/^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(String(user.password))).length;
  console.log(`Migrated ${migratedCount} password(s). Remaining non-bcrypt passwords: ${plaintextCount}.`);
  if (plaintextCount > 0) process.exitCode = 1;
} finally {
  await pool.end();
}