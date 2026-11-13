# Deploy Not Going Live (Migrations Pending)

**Trigger:** A merge has gone through CI but the new version never becomes live, Render shows the deploy failing its health check, or `/api/ready` returns `503` with `{"ok":false,"reason":"migrations_pending"}`.

**This is the readiness gate working, not an outage.** The new build refuses to go live while a migration it ships is not applied, and the previous build keeps serving customers. Migrations are applied only by hand, so every merge that adds a migration stalls its own deploy until someone runs the workflow.

1. Confirm it is this and not a database problem: `/api/ready` answers `503` with the reason `migrations_pending` (a `503` with no reason, or a timeout, is a database problem; use [Database unavailable](database-down.md)). The result is cached for about 15 seconds, so wait that long between checks.
2. Run the **Database migrations** workflow (GitHub Actions, manual) with `target: staging` and `mode: status` first. Read which migration files are not yet recorded. If the list contains a file nobody on the team wrote or reviewed, stop and treat it as an incident ([Leaked secret or key](leaked-secret.md), step 5).
3. Confirm a successful **db-backup** run exists from the last 24 hours. For `target: production` the workflow refuses to apply without one, so a failed or missing backup must be fixed first ([Backup failed or restore needed](backup-failed-or-restore.md)).
4. Run the workflow with `target: production` and `mode: status`, then again with `mode: apply`. Migrations are roll-forward only: there are no down files, on purpose. Do not try to undo one; fix a bad one with a new migration.
5. Wait for the Render health check to pass on its own. Confirm `/api/ready` returns `200` and open a product page and the cart as a smoke test.
6. If the deploy still does not go live, read the Render deploy log (not just the status) for the first error before retrying. Do not set `READY_REQUIRE_MIGRATIONS=false` as a shortcut: it removes the gate for everyone and means a build can go live against a schema it cannot use. It exists only for a readiness check that is itself broken, and needs the production operator's approval and a note in the incident log, then reverting once fixed.

**Close when:** `/api/ready` is `200`, the new build is the live one, and the migration list in `status` shows nothing pending.

**Escalate** if a migration fails part way, if `status` reports drift you cannot explain, or if the backup requirement cannot be met. Do not apply a migration to production that has not run on staging first.

**Not verified:** that anyone other than the author has run this on the live Render and GitHub settings. The production GitHub Environment had no required reviewer when last checked, so applying to production is not second-person approved ([Production access and secret custody](production-access.md)).
