# Deployment and rollback rehearsal

This procedure verifies the controlled Render API release path against **staging only** before relying on it for a production change. Never rehearse against production or use production customer/payment data.

## Status

**Rehearsal pending.** The repository contains the automation and checks, but no staging deployment or rollback was performed as part of this change. Render service settings, paid-plan status, deployment IDs, frontend project behavior, and provider credentials require authorized dashboard access and have not been independently verified here.

The GitHub `staging` and `production` Environments existed when checked on 2026-11-12, but each reported zero protection rules. Production migrations/deployments therefore must not be described as second-person approved until an authorized owner configures and verifies a required reviewer and branch restriction.

## One-time setup

For **both** GitHub Environments (`staging`, `production`), configure:

| Kind | Name | Value |
|---|---|---|
| Secret | `MIGRATE_DATABASE_URL` | That environment's own PostgreSQL Session pooler URL |
| Secret | `RENDER_API_KEY` | Render API key with access to the matching API web service |
| Variable | `RENDER_SERVICE_ID` | ID of that environment's Render API web service |
| Variable | `API_URL` | HTTPS origin of that environment's API, without a trailing slash |

Additionally configure the staging-only browser-test values already used by `.github/workflows/staging-e2e.yml`: `E2E_DATABASE_URL`, `STAGING_URL`, and `STAGING_DB_IDENTITY`. The workflow refuses a staging test database whose identity does not match the configured value.

On each Render API service:

- Use a **paid** web-service instance and set the health-check path to `/api/ready`.
- Disable automatic deploys. The deployment workflow verifies that auto-deploy is off; otherwise a branch push could deploy before migrations or undo a rollback.
- Use its own database, storage credentials, application secrets, and SSLCommerz account/credentials. Never reuse staging values in production.
- Set `NODE_ENV=production` and `SHOPNIRO_ENV=staging` or `production`.
- Set `FRONTEND_URL` to that environment's HTTPS browser origin. If `SHOPNIRO_PUBLIC_URL` is also present for email links, keep it identical.
- Staging must set `SSLCOMMERZ_IS_SANDBOX=true`, `PAYMENT_MODE=sandbox-demo`, and `PAYMENT_SIMULATOR=false`.
- Production must set `SSLCOMMERZ_IS_SANDBOX=false`, `PAYMENT_SIMULATOR=false`, and must not set `PAYMENT_MODE=sandbox-demo`.
- Set `JWT_SECRET` and `CRON_SECRET` to distinct random values of at least 32 characters per environment.
- Keep `ONLINE_PAYMENTS_ENABLED` available as the online-checkout incident switch; `false` leaves cash on delivery available and does not disable payment callbacks.

The production GitHub Environment must be restricted to `main` and have an authorized required reviewer. The staging Environment should be restricted to `staging` if supported. A workflow's `environment: production` declaration does **not** create reviewer protection by itself.

Vercel is configured as a **static frontend only**. Configure its build-time `VITE_API_URL` to the matching Render API origin. It must not proxy `/api/*` to a Vercel serverless copy of Express. Keep frontend deployments manual or otherwise ensure the matching Render API has passed migration and readiness checks first.

## Staging deploy and rollback drill

An operator other than the person who implemented the release/rollback workflow must perform this drill, with an observer:

1. Verify the dashboard shows the staging Render service, paid instance, `/api/ready` health check, disabled auto-deploys, and staging-only database and sandbox gateway credentials. Stop if any identity is ambiguous.
2. Verify the commit on `staging` has a successful CI push run. Confirm `MIGRATE_DATABASE_URL`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`, and `API_URL` are configured in the GitHub `staging` Environment.
3. Record the current live Render deploy ID as the known-good rollback target.
4. Dispatch **Deploy Render service** from the `staging` branch with target `staging`:

   ```sh
   gh workflow run deploy-render.yml --ref staging -f target=staging
   ```

   The workflow checks the exact commit's CI result, verifies the Render service is paid with auto-deploy disabled and `/api/ready` configured, applies staging migrations, deploys that commit, waits for Render's deploy to become live, and checks `GET /api/ready` returns `{"ok":true}`. If deployment or smoke checks fail, it requests a rollback to the previously live code deploy. Schema changes are **not** rolled back.
5. Dispatch **Staging browser tests** and verify the configured database identity matches staging. Confirm the application loads and the tested API calls remain on the staging origin/API. Confirm the payment-method response is sandbox and do not submit a real payment.
6. To exercise the one-command rollback, use the known-good deploy ID recorded in step 3:

   ```sh
   gh workflow run rollback-render.yml --ref staging -f target=staging -f deploy_id=<known-good-deploy-id> -f confirm=ROLLBACK
   ```

   Verify the workflow reports the rollback deployment as live and `/api/ready` healthy. Confirm database migrations remain applied; this workflow only rolls back Render application code.
7. Restore staging to the intended current commit by dispatching **Deploy Render service** again, then re-run readiness and staging browser checks. Record that restoration succeeded.
8. Record timestamps, wall-clock deploy and rollback durations, commit/deploy IDs, migration result, `/api/ready` responses, browser-test run URL, operator, observer, and any confusion in a restricted operations record. Do not record credentials or customer data. Update this document's status only after the independent exercise passes.

If a migration is not backward compatible with the previous application version, do not rely on code rollback. Change it to an additive/compatible migration or use an approved forward-fix plan. Database restoration is a separate recovery operation and is never performed automatically by these workflows.

## Production release guardrails

- Production deploys run only from `main`, require a successful CI push run for that exact commit, and require a successful backup within the previous 24 hours.
- The production GitHub Environment must block the job until its required reviewer approves. Verify this in GitHub Settings before using the workflow; do not assume the Environment name enforces it.
- The deploy workflow applies migrations before requesting the exact commit from Render, then polls the Render deployment and `/api/ready`. On failure it requests application-code rollback to the prior live deploy and reports that the database remains migrated.
- The separate **Roll back Render service** workflow requires a previous deploy ID and an explicit `ROLLBACK` confirmation. It uses the target's GitHub Environment and verifies readiness afterwards. It only starts from a branch named after the target (`staging` for staging, `production` for production), and the Render service must track that same branch. The repository has a `staging` branch but no `production` branch, so a production deploy or rollback cannot start as configured; settle that during the staging rehearsal.
- A Render rollback does not roll back a separately deployed Vercel static frontend or reverse database migrations. Keep frontend/API changes backward compatible and restore the frontend deployment separately if needed.
- Do not mark the requirement “staging deploy and one-command rollback rehearsed” complete until the staging exercise record exists and an independent operator has successfully completed every step.
