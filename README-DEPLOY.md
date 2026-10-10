# Deployment Configuration

## Required server variables

- `DATABASE_URL`: PostgreSQL connection URL. Use the provider's pooled connection URL when required.
- `JWT_SECRET`: unique random value of at least 32 characters. The server refuses to start without it.
- `SHOPNIRO_PUBLIC_URL`: exact browser frontend origin, such as `https://shopniro.vercel.app`. This origin is allowed for credentialed API requests and cookie-authenticated writes.
- `CRON_SECRET`: shared bearer secret for order expiry, refund processing, and the Vercel payroll cron.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: required for private seller document uploads and signed links. Keep the service-role key server-side only.
- `SUPABASE_SELLER_DOCUMENTS_BUCKET`: optional private Storage bucket name; defaults to `seller-verification-documents`.

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

## Deployment checks

1. Configure secrets in the host dashboard, not in committed files.
2. Confirm the frontend origin exactly matches `SHOPNIRO_PUBLIC_URL` and the API CORS allowlist.
3. Deploy the API before the frontend when changing API contracts.
4. Verify `/api/db/status`, sign in, load a protected page, and sign out in the deployed browser origin.
5. Confirm the session cookie is marked `HttpOnly`, `Secure` in production, and has the intended `SameSite` value.
6. Create the seller-document Storage bucket as private, then run `npx tsx scripts/migrate-seller-documents-to-storage.ts` against a backed-up database to move existing verification files.
7. Configure GitHub Actions secrets `APP_URL` and `CRON_SECRET`; dispatch the scheduled-jobs workflow once and confirm both cron endpoints respond successfully.