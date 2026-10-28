# Deployment Configuration

## Required server variables

- `DATABASE_URL`: PostgreSQL connection URL. Use the provider's pooled connection URL when required.
- `JWT_SECRET`: unique random value of at least 32 characters. The server refuses to start without it.
- `SHOPNIRO_PUBLIC_URL`: exact browser frontend origin, such as `https://shopniro.vercel.app`. This origin is allowed for credentialed API requests and cookie-authenticated writes.
- `CRON_SECRET`: shared bearer secret for order expiry, refund processing, and the Vercel payroll cron.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: required for private seller document uploads and signed links. Keep the service-role key server-side only.
- `SUPABASE_SELLER_DOCUMENTS_BUCKET`: optional private Storage bucket name; defaults to `seller-verification-documents`.
- `SUPABASE_PRODUCT_IMAGES_BUCKET`: optional public Storage bucket name for product images; defaults to `product-images`. Product image uploads also require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`: optional credentials for customer, seller, and rider sign-in/application signup. Configure each provider's OAuth redirect URL as `https://<API origin>/api/auth/oauth/<provider>/callback`; optionally set `GOOGLE_OAUTH_REDIRECT_URI` or `FACEBOOK_OAUTH_REDIRECT_URI` when the registered callback differs. Set `APP_URL` to the API origin when it cannot be inferred from the incoming request.

For a new or empty database, also configure unique values of at least 16 characters for `SHOPNIRO_SEED_ADMIN_PASSWORD`, `SHOPNIRO_SEED_SELLER_PASSWORD`, and `SHOPNIRO_SEED_CUSTOMER_PASSWORD`. The seed process hashes them before saving demo users. Do not reuse production account passwords.

## Frontend variables

- `VITE_API_URL`: API base URL used by the browser build, for example `https://shopniro.onrender.com`. Keep this aligned with the API host and its CORS settings.
- `VITE_CAPACITOR_API_URL`: optional API base URL embedded in the Android/iOS build. Native Capacitor builds ignore a browser-only localhost `VITE_API_URL` and default to `https://shopniro.onrender.com`.

Vercel supplies `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`; the API includes those origins when present. For other frontend hosts, configure `SHOPNIRO_PUBLIC_URL` on the API service.

## Optional integrations

- `AUTH_COOKIE_SAME_SITE`: `lax`, `strict`, or `none`. Production defaults to `none` for separately hosted frontend/API deployments and always sets `Secure`. Prefer `lax` when both are on the same site.
- `RESEND_API_KEY`, `SHOPNIRO_FROM_EMAIL`, `SHOPNIRO_PUBLIC_URL`: welcome-offer email delivery. The sender must be verified with Resend.
- `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_SANDBOX`: payment gateway credentials and environment. Set sandbox mode to `false` only with production credentials.
- `SSLCOMMERZ_IPN_TOKEN`: shared secret configured in SSLCommerz and ShopNiro. This token authenticates IPN callbacks and is required for payment status updates.
- `GROQ_API_KEY`: optional seller/rider AI assistance.
- `GOOGLE_MAPS_API_KEY`: optional Google Maps services.
- `SENTRY_DSN`: enables server error tracking. Unset means Sentry is off. Every 5xx response is reported with its `requestId`.
- `CSP_ENFORCE`: `true` makes the Content-Security-Policy enforcing. Unset or any other value keeps it report-only (violations appear in the browser console, nothing is blocked). Production only.

## Deployment checks

1. Configure secrets in the host dashboard, not in committed files.
2. Apply pending database migrations to staging and production through the approved migration workflow (see "Adding a migration" below). The host does not apply them automatically.
3. Confirm the frontend origin exactly matches `SHOPNIRO_PUBLIC_URL` and the API CORS allowlist.
4. Deploy the API before the frontend when changing API contracts.
5. Verify `/api/db/status`, sign in, load a protected page, and sign out in the deployed browser origin.
6. Confirm the session cookie is marked `HttpOnly`, `Secure` in production, and has the intended `SameSite` value.
7. Create the seller-document Storage bucket as private, then run `npx tsx scripts/migrate-seller-documents-to-storage.ts` against a backed-up database to move existing verification files.
8. Configure GitHub Actions secrets `APP_URL` and `CRON_SECRET`; dispatch the scheduled-jobs workflow once and confirm both cron endpoints respond successfully.
9. Before migrating legacy product images, back up both `products` and `order_items`, create the public `product-images` bucket, and run `npm run migrate:product-images -- --limit=3` with `DATABASE_URL` set to the intended database. Review the dry-run output, then apply one small batch using `--apply` and `PRODUCT_IMAGE_MIGRATION_CONFIRM=YES_I_HAVE_A_BACKUP`. Increase the limit in controlled batches; this script never uses `SUPABASE_DB_URL` or runs automatically.
10. Error tracking: create a Sentry project (Node.js), set `SENTRY_DSN` on the host, redeploy, then trigger a test error and confirm it appears with its `requestId`. Logs are structured JSON (pino); search the host's log view by `req.id` or the `requestId` a user reports.
11. Uptime: create an external monitor (for example UptimeRobot, 5-minute interval, email alert) on `GET /api/ready`. It returns 200 when the database answers within 2 seconds and 503 otherwise. Use `/api/health` only for a process-alive check; it does not touch the database.
12. Enforce the CSP: with `CSP_ENFORCE` unset, click through home, product, cart, checkout, the map/tracking pages, rider PDF preview and seller dashboard in the deployed origin with the browser console open. If there are no `Content Security Policy` violations, set `CSP_ENFORCE=true` on the host and repeat the click-through. To roll back, unset the variable; no deploy is needed.
13. Backups: `.github/workflows/backup.yml` dumps the `public` schema daily and encrypts it with an age public key before uploading it as a 30-day artifact. Requires the `BACKUP_DATABASE_URL` Actions secret, which must use a read-only `backup_reader` role (session pooler, port 5432) with `BYPASSRLS`. Only the private key can open a backup, so keep it off the repo and off this machine's only copy. Decrypt with `age -d -i backup-key.txt -o restored.dump shopniro-DATE.dump.age`, then `pg_restore --list restored.dump`. It also saves the public product images that products and past orders reference (`shopniro-images-DATE.tgz.age`, same key). The private seller-documents bucket does not exist yet; if it is ever created, it needs a separate backup with Storage S3 credentials. After any role or schema change, run the workflow manually and restore a file into a scratch database.
14. Storage backups: the `storage-backup` job in the same workflow copies every Supabase Storage bucket through the S3-compatible API and encrypts the archive with the same age public key. It needs the `STORAGE_S3_ACCESS_KEY_ID` and `STORAGE_S3_SECRET_ACCESS_KEY` Actions secrets (Supabase dashboard, Storage, S3 connection, New access key). These keys can read and write all Storage objects but cannot touch the database. Create the private `seller-verification-documents` bucket before accepting seller applications; the upload code refuses to run without it. Decrypt with `age -d -i backup-key.txt -o storage.tar.gz shopniro-storage-DATE.tar.gz.age`, then extract with `tar -xzf`.
15. Database TLS verification: by default the database connection is encrypted but the server certificate is not checked. To verify it, download Supabase's CA certificate (Dashboard, Database Settings, SSL Configuration, Download certificate) and set `DB_CA_CERT` on the host to the full PEM text (`-----BEGIN CERTIFICATE-----` through `-----END CERTIFICATE-----`). Redeploy and confirm the site loads a product page and `/api/ready` returns 200. If the connection fails, delete `DB_CA_CERT` to roll back; no code change is needed. Once verified, also set `DB_REQUIRE_TLS_VERIFY=true` so the server refuses to start without the certificate. For local development `DB_CA_CERT_PATH` can point at the downloaded `.crt` file. Do not turn on Supabase's "Enforce SSL" database setting as part of this step; it reboots the database and is unrelated.

## Adding a migration

`db/migrations/0001_baseline.sql` is an immutable copy of the schema that existed when numbered migrations were introduced. Do not edit it or use `schema.sql` for new database changes. The application does not change the database schema at startup; use the migration runner and a backed-up, isolated database.

For every schema change:

1. Add a numbered `db/migrations/NNNN_description.sql` file. Include a short comment describing a manual rollback. Keep each migration focused. Files that cannot run in a transaction (for example, `CREATE INDEX CONCURRENTLY`) must begin with `-- migrate:no-transaction`.
2. Make changes additive first. Deploy new columns or functions alongside old ones; remove old objects only in a later migration after application code no longer uses them.
3. Add constraints as `NOT VALID`, repair existing data, then validate them in a later migration.
4. Test against a disposable PostgreSQL database using `npm run migrate`, `npm run migrate:status`, `npm run lint`, and `npm test`. Never point migration tests at production or shared data.
5. Apply migrations to staging first. Before production, run `backup.yml`, wait for a successful backup, and use the approved `migrate.yml` workflow with the production Environment approval. The workflow checks for a successful backup from the previous 24 hours before applying changes.
6. Configure the GitHub Actions secret `MIGRATE_DATABASE_URL` with the production Session pooler URL and require approval for the `production` Environment. Run the workflow in `drift` mode first. It builds a reference database from the migration files and compares production with it, listing every missing or different table, column, constraint, index, function, trigger and view. If the schema matches `0001` exactly, run `baseline` once, then `status`; baseline records the existing schema without executing the baseline SQL. If production is an existing, intentionally drifted schema, do not claim it matches `0001`: review the complete drift and data checks, test the reconciliation on a production-shaped copy, take a recent backup, then run `adopt` with production Environment approval. Adoption records the immutable `0001` checksum and a fingerprint of the actual starting schema; it does not mark `0001` as applied or execute SQL. Subsequent `apply` runs skip `0001`, verify the live schema still matches the latest recorded fingerprint, and update that fingerprint atomically with each successful migration. Any untracked schema change blocks migration until reviewed. A database with application tables but no migration history cannot be migrated blindly. Run the same drift check locally with `DATABASE_URL=<live> npm run migrate:drift -- --reference <freshly migrated database>`; it only reads the catalog. The reference should be the same PostgreSQL major version as the live database (the workflow uses 17).

The schema-reconciliation migrations restore the missing foreign keys as `NOT VALID` before validating them in the following migration. They also restore the baseline username uniqueness and review-rating check. They intentionally do not convert the live column types or nullability, backfill legacy orders, or alter the known invalid payment row; those require separate data review and a production-shaped rehearsal before migration.

Use the Session pooler URL for migration connections so the advisory lock remains held for the full run. Never enable schema application at server startup.
