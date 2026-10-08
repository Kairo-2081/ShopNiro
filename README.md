ShopNiro is a multi-vendor marketplace where customers shop, pay with bKash or SSLCOMMERZ, and track orders, while admin-approved sellers manage their stores and a Gemini AI assistant helps shoppers find what they need. Shop smart. Ship fast.

1. Install dependencies:
   `npm install`

2. Configure app-issued JWT authentication. Set `JWT_SECRET` in a local `.env` file (or your deployment's environment settings). Generate a unique secret with Node.js:
   `node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"`

   Add the generated value to `.env` as `JWT_SECRET=<generated-value>`. Keep `.env` out of source control and configure the same variable in the production host's secret/environment settings. The server requires at least 32 characters and exits at startup if `JWT_SECRET` is missing or too short; do not use a checked-in, hard-coded, or fallback secret. Tokens are signed with HS256, expire after one hour, and are sent only in the `shopniro_session` HttpOnly cookie (never in local storage or JSON responses). Each token ID is persisted in `auth_sessions`; logout revokes it server-side. Browser writes using the cookie are restricted to configured trusted origins.

   Configure `SHOPNIRO_PUBLIC_URL` to the exact public frontend origin when it differs from the built-in ShopNiro origin. Vercel deployments also use `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` when present. `AUTH_COOKIE_SAME_SITE` can be set to `lax`, `strict`, or `none`; production defaults to `none` for split frontend/API origins and always sets `Secure`. Use `lax` when frontend and API share a site.

   API requests are checked by centralized authentication middleware before body parsing or route handlers. Login and customer/seller registration are guest-accessible; other API routes require an active session, with role and ownership checks applied by their handlers. Admin accounts are created by an authenticated admin. The frontend/static assets remain accessible so visitors can reach sign-in.

3. Run the app:
   `npm run dev`

   When seeding a fresh database, configure `SHOPNIRO_SEED_ADMIN_PASSWORD`, `SHOPNIRO_SEED_SELLER_PASSWORD`, and `SHOPNIRO_SEED_CUSTOMER_PASSWORD` with unique values of at least 16 characters. These values are hashed before insertion and are never checked into source. Existing databases with those account tables populated do not need these seed variables.

Optional welcome-offer email delivery: customers can opt in to one NEW20 welcome email during registration. Configure `RESEND_API_KEY`, `SHOPNIRO_FROM_EMAIL` (a verified Resend sender), and `SHOPNIRO_PUBLIC_URL` in the server environment. Without all three values, account creation still succeeds and no email is sent.

4. Database model, ERD, keys, cardinalities, normalization, and referential actions are documented in [docs/database-design.md](docs/database-design.md). PostgreSQL DDL and routines are in `schema.sql`; startup applies the schema and seeds demo data if tables are empty.

See [README-DEPLOY.md](README-DEPLOY.md) for Render/Vercel environment configuration and deployment checks.
