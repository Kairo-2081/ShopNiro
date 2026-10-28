# Database Design

ShopNiro uses PostgreSQL. `db/migrations/0001_baseline.sql` is the frozen initial schema. All future DDL, indexes, constraints, views, triggers, and routines are added as numbered files in `db/migrations/` and applied by `npm run migrate`.

## Core Relationships

- `users` is the canonical authentication identity. Customer, seller, admin, and rider profiles share its ID and role.
- `orders` belongs to a customer. `order_items` snapshots product and seller IDs so order history survives catalog changes.
- `seller_fulfillments` splits an order by seller; each fulfillment can have one `rider_deliveries` row.
- `payments` records online transactions. `refunds` records the single refund lifecycle per order.
- `products` are owned by sellers and referenced by carts, order snapshots, and reviews.
- `seller_wallet_entries` and `rider_wallet_entries` are append-only ledgers; balances are derived from entries.
- `support_requests` stores contact submissions and admin resolution state.

## Operational Notes

- `process_checkout` validates and decrements stock inside a database transaction.
- Failed online checkout restores stock and cart contents atomically; COD orders cannot use that rollback.
- Order lists query base tables with filters and bounded `LIMIT`/`OFFSET` pagination.
- Run migrations only against the intended database. Integration tests require an isolated `DATABASE_URL`; never point them at production or shared application data.
- Migrate existing plaintext passwords explicitly with `npm run migrate:passwords` for each database before deploying strict bcrypt-only login behavior.