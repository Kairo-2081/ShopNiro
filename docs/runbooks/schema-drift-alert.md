# Production Schema Watch Failed

**Trigger:** The **Production schema watch** workflow is red. It runs daily at 03:17 UTC. It builds a reference database from the migration files in the repository, then checks the live production schema against the recorded fingerprint, the migration history, and a full comparison with the reference. A red run means production's schema is not what the repository says it is.

**Treat an unexplained difference as possible tampering until proven otherwise.** The legitimate reasons are few: a migration was applied that this check does not know about, a reviewed change was applied by hand and not recorded, or the check itself is broken.

1. Read the failing step. Note whether it failed on the fingerprint, the migration history, or the full comparison, and what differs (a table, column, constraint, function, or a missing migration record). Do not copy connection strings from the log.
2. Ask who changed production and when. Check recent runs of the **Database migrations** workflow and the database provider's audit and query logs. A change nobody can account for is a security incident: [Leaked secret or key](leaked-secret.md), starting at step 5 (review audit logs) and rotating the database credential.
3. Do not fix drift by editing production by hand, and do not drop or add objects to make the check pass. Migrations only move forward.
4. If the difference is a recorded migration that the check did not know about, run the **Database migrations** workflow with `target: production` and `mode: status` and read the result against `mode: drift`. Fix the cause in the repository with a new migration and apply it through the normal flow ([Deploy not going live](deploy-stalled-migrations.md)).
5. If a reviewed manual change is the only difference, the person who owns the change records why and a second person approves before the `refresh-adoption` mode is used to record the new state. Never use `adopt`, `refresh-adoption` or `baseline` to silence an alert nobody understands.
6. Run the schema watch again by hand and confirm it is green.

**Close when:** The live schema matches the reference, the cause is written down, and a future change of the same kind has a path that does not need manual edits.

**Escalate** any difference involving permissions, row-level security, roles or grants straight away: these are the changes that matter most for a leak.
