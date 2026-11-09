# Database Unavailable

**Trigger:** Production `/api/ready` returns 503, database-backed pages fail, or API logs show connection timeouts/refusals. The production operator owns recovery; do not use a developer laptop or shared database as a substitute.

1. Record the time, `/api/ready` response, affected requests/request IDs, and the first database error. Check Render API service health/logs and the Supabase project status/incident page.
2. Check whether the database, pooler, network allowlist, or credentials changed. Compare recent deploys and approved migrations. Use read-only status checks only; do not print connection strings or passwords into chat, tickets, or logs.
3. If the database is unavailable, stop repeated customer checkout attempts. Do not claim an order exists until it can be read back. If online payments are also at risk, use [Disable online payments; COD only](disable-online-payments.md) once the API is healthy enough to apply the setting; otherwise escalate for the provider's recovery path.
4. Do not run migrations, change constraints, disable TLS/RLS, restore over production, or repeatedly restart the database. A restore or failover requires the production owner and a verified backup/recovery plan.
5. After the provider recovers, confirm `/api/ready` returns 200, review API errors and checkout/payment records from the outage window, and verify pending payments against gateway records. Resolve uncertain orders with the customer before retrying or refunding.

**Escalate immediately** for suspected data loss, an unrecognized schema change, a backup/restore request, or an outage longer than the customer-impact threshold set by the incident lead. Record the recovery point, backup used (if any), and reconciliation owner.
