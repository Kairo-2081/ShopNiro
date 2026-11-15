# Render service and GitHub Environment settings

A checklist for a deployed ShopNiro service. It exists because the first staging deploy failed four times on settings that
were each documented somewhere but never checked against the service. Names and rules only: **never write a secret value into
this file, a pull request, an issue or a chat.**

The server refuses to start a deployed service whose settings break these rules (`server/config/runtimeAssertions.ts`,
`server/services/sslcommerz.service.ts`). A refused start shows in Render as a deploy that ends `update_failed`, and the old
version keeps serving. The log line names the rule that failed; the table at the end says how to fix each.

## 1. Render service settings (staging and production)

| Setting | Value |
| --- | --- |
| Type | Web Service |
| Branch | `staging` for the staging service, `production` for the production service. The deploy workflow refuses any other. |
| Health check path | exactly `/api/ready` |
| Auto-Deploy | **Off.** The workflow deploys on purpose, after migrations. |
| Instance type | Free is allowed (a decision, with a warning on every deploy run). See [Render instance type](launch-checks/render-instance-type.md). |
| Build / start | the repository's `npm run build` and `npm start` |

## 2. Environment variables on the Render service

Set these in the service's **Environment** page. "Boot" means the server will not start without it.

### Both services

| Variable | Rule | Boot |
| --- | --- | --- |
| `NODE_ENV` | `production` | yes |
| `SHOPNIRO_ENV` | `staging` on staging, `production` on production | yes |
| `DATABASE_URL` | that environment's own database (the staging project for staging). Never share one between environments. | yes |
| `JWT_SECRET` | at least 32 characters, unique per environment | yes |
| `CRON_SECRET` | at least 32 characters; the same value as the `CRON_SECRET` secret the scheduled workflows use for that environment | yes |
| `FRONTEND_URL` or `SHOPNIRO_PUBLIC_URL` | an HTTPS origin: `https://host` with no path, query, credentials or trailing slash. One of the two is enough. | yes |
| `PAYMENT_SIMULATOR` | unset, or anything but `true` | yes |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IPN_TOKEN` | the gateway credentials for **that** environment (sandbox for staging, live for production). Not the development defaults `testbox` and `qwerty`. | yes |

### Staging only

| Variable | Rule |
| --- | --- |
| `SSLCOMMERZ_IS_SANDBOX` | exactly `true` |
| `PAYMENT_MODE` | exactly `sandbox-demo` |
| `LOGIN_RATE_LIMIT_MAX` | `100` (the browser suite signs several roles in from one address); not on production |

### Production only

| Variable | Rule |
| --- | --- |
| `SSLCOMMERZ_IS_SANDBOX` | exactly `false` |
| `PAYMENT_MODE` | unset, or anything but `sandbox-demo` |

> **Production and sandbox payments cannot coexist.** With `SHOPNIRO_ENV=production` the server refuses to start in sandbox
> mode. The first deploy of this code to production is therefore the step that turns live payments on, so do it when you
> mean to launch, with the live gateway credentials ready and a second person present
> ([first live payment](launch-checks/first-live-payment.md)). Production keeps serving whatever it was running until then.

### Optional, by feature

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (storage), `GROQ_API_KEY` (AI features), `RESEND_API_KEY`,
`SHOPNIRO_FROM_EMAIL` and `SHOPNIRO_PUBLIC_URL` (email), `SHOPNIRO_SUPPORT_EMAIL`, `SENTRY_DSN`, `ONLINE_PAYMENTS_ENABLED`
(`false` switches off new online payments while keeping cash on delivery). `SEED_ON_START` is ignored in production.
See [`.env.example`](../.env.example) and the [README](../README.md#environment-variables).

## 3. GitHub Environment settings

Under **Settings, Environments**, per Environment, using the Environment's own sections (not the repository-wide page):

| Environment | Secrets | Variables |
| --- | --- | --- |
| `staging` | `MIGRATE_DATABASE_URL` (staging Session-pooler URL), `RENDER_API_KEY`, `E2E_DATABASE_URL` | `RENDER_SERVICE_ID`, `API_URL`, `EXPECTED_DATABASE_REF`, `STAGING_URL`, `STAGING_DB_IDENTITY` |
| `production` | `MIGRATE_DATABASE_URL` (production Session-pooler URL), `RENDER_API_KEY` | `RENDER_SERVICE_ID`, `API_URL`, `EXPECTED_DATABASE_REF` |

- `RENDER_SERVICE_ID` is exactly `srv-` followed by letters and digits, taken from the service page's address. No spaces, quotes or slashes.
- `API_URL` is the service's HTTPS address with no trailing slash.
- `EXPECTED_DATABASE_REF` is that environment's own Supabase project Reference ID, and is how a wrong database secret is caught. See [Production gates](launch-checks/production-gates.md#6-set-expected_database_ref-in-both-environments-do-this-before-any-migration-or-deploy).
- The production Environment also needs a required reviewer and to allow only the `production` branch ([Production gates](launch-checks/production-gates.md)).

## 4. Before the first deploy to a service

1. Add every variable in section 2 for that service. Check each name and each rule, not just that it exists.
2. Check the four Render settings in section 1.
3. Check the GitHub Environment names and spelling in section 3.
4. Dispatch **Deploy Render service**. On a good run the log shows the deploy moving through `build_in_progress`, `update_in_progress`
   and `live`, then `/api/ready returned {"ok":true}`.

## 5. When a deploy ends `update_failed`

Open the failed deploy in Render (the service, then **Events**, then the deploy, then its **Logs**). Look for
`Runtime configuration is invalid; server was not started:` and match the line:

| Log line | Fix |
| --- | --- |
| `NODE_ENV must be set explicitly.` | Set `NODE_ENV=production`. |
| `SHOPNIRO_ENV must be set to staging or production on deployed services.` | Add `SHOPNIRO_ENV` with the value for that service. |
| `JWT_SECRET must be configured with at least 32 characters.` | Set a longer `JWT_SECRET`. |
| `CRON_SECRET must be configured with at least 32 characters.` | Set a longer `CRON_SECRET` and the matching GitHub secret. |
| `FRONTEND_URL must be an HTTPS origin in deployed environments.` | Fix `FRONTEND_URL` or `SHOPNIRO_PUBLIC_URL`: `https://host`, no path, no trailing slash. |
| `PAYMENT_SIMULATOR must not be enabled in deployed environments.` | Remove it or set it to `false`. |
| `Production requires live SSLCommerz mode; sandbox payments are prohibited.` | On production set `SSLCOMMERZ_IS_SANDBOX=false` and remove `PAYMENT_MODE=sandbox-demo`. This is the launch step. |
| `Staging requires isolated SSLCommerz sandbox credentials and PAYMENT_MODE=sandbox-demo.` | On staging set `SSLCOMMERZ_IS_SANDBOX=true` and `PAYMENT_MODE=sandbox-demo`. |
| `PAYMENT_SIMULATOR must not be true outside development.` | Remove `PAYMENT_SIMULATOR` or set it to `false`. |
| `Production requires SSLCOMMERZ_IPN_TOKEN.` | Add `SSLCOMMERZ_IPN_TOKEN`. |
| `Production requires valid SSLCommerz store credentials.` | Set real `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD`, not the development defaults. |
| `PAYMENT_MODE=sandbox-demo requires SSLCOMMERZ_IS_SANDBOX=true.` | Set `SSLCOMMERZ_IS_SANDBOX=true`. |
| `Production requires SSLCOMMERZ_IS_SANDBOX=false.` | Set it to `false` on a non-demo service. |

The server checks `SHOPNIRO_ENV` first, so one missing setting hides the later ones: fix them all in one pass.
The workflow's own message after a failed deploy also names the state Render reported and points to this page's log.
