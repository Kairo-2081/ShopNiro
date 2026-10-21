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
2. Apply the updated `schema.sql` to existing databases to create the OAuth identity table.
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
13. Backups: `.github/workflows/backup.yml` dumps the `public` schema weekly and encrypts it with an age public key before uploading it as a 30-day artifact. Requires the `BACKUP_DATABASE_URL` Actions secret, which must use a read-only `backup_reader` role (session pooler, port 5432) with `BYPASSRLS`. Only the private key can open a backup, so keep it off the repo and off this machine's only copy. Decrypt with `age -d -i backup-key.txt -o restored.dump shopniro-DATE.dump.age`, then `pg_restore --list restored.dump`. Storage objects (seller documents, product images) are not included. After any role or schema change, run the workflow manually and restore a file into a scratch database.
