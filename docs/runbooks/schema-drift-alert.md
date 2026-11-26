# Production Schema Watch Failed

**Trigger:** The **Production schema watch** workflow is red. It runs daily at 03:17 UTC. It calls the live app, which compares its database with `db/expected-schema.json` (the schema the migration files build, kept honest by a test) and checks that every shipped migration is recorded. A red run means production's schema is not what the repository says it is.

**Treat an unexplained difference as possible tampering until proven otherwise.** The legitimate reasons are few: a migration was applied that this check does not know about, a reviewed change was applied by hand and not recorded, or the check itself is broken.

0. **Check that the check ran.** Open the failed run and read the HTTP status it printed. `409` is real drift: continue below. Anything else means the schema was never compared. `401` or `503`: the `CRON_SECRET` repository secret does not match the app's `CRON_SECRET`. `404` or a connection error: `APP_URL` is wrong or the app is down. `500`: the app could not read its snapshot or the database; check the app logs. The watch runs inside the live app and uses its existing database login, so it needs no database secret. Fix the cause, run the watch again from the Actions tab (workflow_dispatch), and confirm it is green.
1. Read the failing step. Note whether it failed on the fingerprint, the migration history, or the full comparison, and what differs (a table, column, constraint, function, or a missing migration record). Do not copy connection strings from the log.
2. Ask who changed production and when. Check recent runs of the **Database migrations** workflow and the database provider's audit and query logs. A change nobody can account for is a security incident: [Leaked secret or key](leaked-secret.md), starting at step 5 (review audit logs) and rotating the database credential.
3. Do not fix drift by editing production by hand, and do not drop or add objects to make the check pass. Migrations only move forward.
4. If the difference is a recorded migration that the check did not know about, run the **Database migrations** workflow with `target: production` and `mode: status` and read the result against `mode: drift`. Fix the cause in the repository with a new migration and apply it through the normal flow ([Deploy not going live](deploy-stalled-migrations.md)).
5. If a reviewed manual change is the only difference, the person who owns the change records why and a second person approves before the `refresh-adoption` mode is used to record the new state. Never use `adopt`, `refresh-adoption` or `baseline` to silence an alert nobody understands.
6. Run the schema watch again from the Actions tab and confirm it is green.
7. If the fix was a new migration, run `npm run migrate:snapshot` on an empty database after `npm run migrate` and commit `db/expected-schema.json`; a test fails until you do.

**Close when:** The live schema matches the reference, the cause is written down, and a future change of the same kind has a path that does not need manual edits.

**Escalate** any difference involving permissions, row-level security, roles or grants straight away: these are the changes that matter most for a leak.
