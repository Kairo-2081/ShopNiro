# AGENTS.md

## Project overview
- This repository is a full-stack marketplace app for customers, sellers, admins, and riders.
- The frontend is React + Vite in `src/`; the API/server is Express in `server/` and the app entrypoint is `server/index.ts`.
- The database layer is PostgreSQL-based, with schema and seed logic in `schema.sql` and `server/db/seed.ts`.
- See [README.md](README.md) for the product requirements and environment setup.

## Getting started
- Install dependencies: `npm install`
- Start the development app: `npm run dev`
- Build the app: `npm run build`
- Type-check the project: `npm run lint`
- Serve the production build: `npm start`

## Environment and runtime expectations
- `JWT_SECRET` is required for app-issued JWT auth. It must be set in a local `.env` or host environment and be strong enough (minimum 32 chars).
- The server expects a PostgreSQL-compatible database connection. Boot seeding is disabled unless `SEED_ON_START=true` in a non-production environment.
- Do not hard-code secrets or commit local `.env` values.
- `NODE_ENV` must be explicit. Only `development` and `test` may use simulator defaults; all other environments require production SSLCommerz credentials and `CRON_SECRET`.
- Integration tests require an isolated `DATABASE_URL`; do not point them at shared Supabase or production data.

## Architecture and conventions
- `server/index.ts` boots Express, mounts the API routes, and serves the Vite app during local development.
- API route modules live under `server/routes/`; middleware and auth checks live under `server/middleware/` and `server/db/`.
- Frontend state and view code live under `src/components/`, with role-specific dashboards split between customer, seller, rider, and admin folders.
- Follow the existing patterns in nearby files before introducing new abstractions or new API layers.
- Route naming follows the established `*.routes.ts` pattern and is mounted centrally in `server/index.ts`.
- Auth and authorization are enforced server-side; changes to protected routes should preserve current cookie/JWT and role checks.
- `server/middleware/auth.ts` is the canonical auth/JWT implementation. Frontend code must not import server auth modules.
- Payment/refund/stock/wallet mutations must be transactional and idempotent when callbacks can be replayed.
- Paged APIs cap `limit` at 100 (default 50) and return array pages with `X-Has-More` metadata.

## Safe workflow for AI coding agents
- Prefer small, targeted edits that match existing module structure.
- For backend changes, update both the route logic and any client-side caller assumptions in `src/`.
- For frontend changes, keep role-based UI flows consistent with the current app architecture and avoid bypassing the authentication guard patterns already in use.
- Validate TypeScript changes with `npm run lint` when touching typed code.
- If changing the database contract, look at `schema.sql` and the related seed/query patterns before modifying API responses.

## Relevant docs
- [README.md](README.md)
- [schema.sql](schema.sql)
- [docs/database-design.md](docs/database-design.md)
- [docs/payouts.md](docs/payouts.md)
