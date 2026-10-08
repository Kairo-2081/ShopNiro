# Deployment Configuration

## Required server variables

- `DATABASE_URL`: PostgreSQL connection URL. Use the provider's pooled connection URL when required.
- `JWT_SECRET`: unique random value of at least 32 characters. The server refuses to start without it.
- `SHOPNIRO_PUBLIC_URL`: exact browser frontend origin, such as `https://shopniro.vercel.app`. This origin is allowed for credentialed API requests and cookie-authenticated writes.

For a new or empty database, also configure unique values of at least 16 characters for `SHOPNIRO_SEED_ADMIN_PASSWORD`, `SHOPNIRO_SEED_SELLER_PASSWORD`, and `SHOPNIRO_SEED_CUSTOMER_PASSWORD`. The seed process hashes them before saving demo users. Do not reuse production account passwords.

## Frontend variables

- `VITE_API_URL`: API base URL used by the browser build, for example `https://shopniro.onrender.com`. Keep this aligned with the API host and its CORS settings.
- `VITE_CAPACITOR_API_URL`: optional API base URL embedded in the Android/iOS build. Native Capacitor builds ignore a browser-only localhost `VITE_API_URL` and default to `https://shopniro.onrender.com`.

Vercel supplies `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`; the API includes those origins when present. For other frontend hosts, configure `SHOPNIRO_PUBLIC_URL` on the API service.

## Optional integrations

- `AUTH_COOKIE_SAME_SITE`: `lax`, `strict`, or `none`. Production defaults to `none` for separately hosted frontend/API deployments and always sets `Secure`. Prefer `lax` when both are on the same site.
- `RESEND_API_KEY`, `SHOPNIRO_FROM_EMAIL`, `SHOPNIRO_PUBLIC_URL`: welcome-offer email delivery. The sender must be verified with Resend.
- `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_SANDBOX`: payment gateway credentials and environment. Set sandbox mode to `false` only with production credentials.
- `GROQ_API_KEY`: optional seller/rider AI assistance.
- `GOOGLE_MAPS_API_KEY`: optional Google Maps services.

## Deployment checks

1. Configure secrets in the host dashboard, not in committed files.
2. Confirm the frontend origin exactly matches `SHOPNIRO_PUBLIC_URL` and the API CORS allowlist.
3. Deploy the API before the frontend when changing API contracts.
4. Verify `/api/db/status`, sign in, load a protected page, and sign out in the deployed browser origin.
5. Confirm the session cookie is marked `HttpOnly`, `Secure` in production, and has the intended `SameSite` value.