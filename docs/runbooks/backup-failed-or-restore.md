# Backup Failed or Restore Needed

Two situations share this page: a **backup run failed** (the daily job went red or is missing), and a **restore is needed** (data was lost or damaged). Treat the first as urgent because every day it stays red the recovery point moves back. Nothing here is a reason to touch the live production database.

## A. The backup job failed

**Trigger:** The **db-backup** workflow failed, did not run, or the newest artifact is older than 24 hours. It runs daily at 20:00 UTC and keeps artifacts for 30 days. A migration to production also refuses to run without a successful backup from the last 24 hours.

1. Open the failed run and read the first failing step. Typical causes: the `BACKUP_DATABASE_URL` secret is missing or its role lost access, the dump was under 100 kB (a sign of an empty or wrong database), the dump did not contain the `orders` table data, or no product image could be downloaded.
2. Do not paste the connection string anywhere to test it. Fix the secret in GitHub, then run the workflow by hand (it supports manual runs) and confirm both the database dump and the storage backup jobs succeed.
3. If it cannot be fixed the same day, tell the incident lead: no production migrations and no risky changes until a good backup exists.

## B. A restore is needed

**Trigger:** Confirmed data loss, a bad migration, a wrong bulk change, or provider recovery that lost data. The production operator and the incident lead decide; a second person verifies.

1. **Never restore over the live production database.** Create a new, empty PostgreSQL 17 database (a separate Supabase project or a temporary server) and restore into that first. Never restore production data into staging or a shared developer database; it holds real customers' details.
2. Download the newest good `shopniro-DATE.dump.age` artifact from the **db-backup** run. The backups are encrypted, and **only the private key can open them**. The private key is not in the repository; its holder and location are kept in the restricted operator inventory ([Production access and secret custody](production-access.md)). If nobody can name where it is, that is the first finding to escalate.
3. Decrypt with `age -d -i <key file> -o restored.dump <file>.dump.age`, check with `pg_restore --list restored.dump`, then restore into the new database with `pg_restore --no-owner --no-privileges -d <new database> restored.dump`. The dump holds the `public` schema only. Do not leave the decrypted dump or the key on a shared machine; delete the dump when done.
4. Point a **temporary** copy of the app at the restored database and check row counts for users, orders, payments and refunds against what you expect, and run the migration status check against it. Compare the newest order timestamps with the backup time to state exactly what was lost: the dump is a daily snapshot, so up to about a day of orders and payments may be missing.
5. Decide with the incident lead how to recover the gap: re-enter or reconcile orders from gateway records and customer emails, using [Payments failing](payments-failing.md). Never mark orders paid or edit payment rows by hand.
6. Only then plan the switch of production to the restored database, as a separate approved change. Product images come from the encrypted `shopniro-images-DATE.tgz.age` and the storage backup job, decrypted the same way.

**Close when:** The restored data is verified, the lost window is stated in writing, every affected order or payment has an owner, and the decrypted copies are deleted.

**Not verified:** the private key's location and who can use it, and when the last restore was actually rehearsed end to end. Record both in the restricted inventory and in [Drill record](drill-record.md).
