# Disable Online Payments; COD Only

**Use when:** SSLCommerz errors, payment integrity is uncertain, or the incident lead directs a temporary online-checkout stop. Requires the `ONLINE_PAYMENTS_ENABLED` switch deployed to the production API. No database migration is needed.

1. Start an incident timer and notify the second named production operator. Open the production API service in the Render dashboard; verify the service name and environment are **production**.
2. In **Environment**, set `ONLINE_PAYMENTS_ENABLED` to the exact value `false`. Do not delete `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, or `SSLCOMMERZ_IPN_TOKEN`; callbacks and refunds for existing transactions still need to run.
3. Save the environment change and wait for Render to finish the resulting restart/deploy. Watch service events and logs. If it does not become healthy, escalate; do not claim the switch is active yet.
4. Verify `GET https://<production-api-origin>/api/payment/methods` returns `onlinePaymentsEnabled: false` and only `cash_on_delivery`. Verify `/api/ready` returns 200. In a fresh customer checkout, confirm online choices are absent and COD is available. Do not place a real test order unless the incident lead authorizes it.
5. The backend also returns HTTP 503 with code `ONLINE_PAYMENTS_DISABLED` for new online payment initialization, protecting customers with stale pages. Existing SSLCommerz success/fail/cancel/IPN callbacks remain active. Review pending/late transactions using the payments-failing runbook.

**Restore:** After the provider and callbacks are healthy, the incident lead authorizes recovery, and pending transactions are reviewed, set `ONLINE_PAYMENTS_ENABLED` to `true` (or remove it to use the default), save/restart, then verify the methods endpoint reports enabled and an authorized transaction completes. Notify support before closing.

**Never use credential deletion as the switch.** This control stops new online checkout and keeps COD available; it does not cancel already authorized transactions or disable refunds/IPN processing.
