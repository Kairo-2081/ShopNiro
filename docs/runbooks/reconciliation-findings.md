# Payment Reconciliation Failed or Found Something

**Trigger:** The **Nightly payment reconciliation** workflow went red, or finished with the warning that high-severity findings remain open. It runs daily at 20:00 UTC and compares paid online orders and validated payments with what SSLCommerz reports. The admin payment owner leads; the production operator helps only with access.

## A. The run failed (red)

Read the step log. The workflow prints a hint for the common status codes:

- **401:** `CRON_SECRET` in GitHub does not match the one on the app that `APP_URL` points to. A login-wall wording in the error ("Missing or invalid authentication session") instead of `Unauthorized.` means the route is missing from the public-route list in that build, so the app is on an older version than the workflow expects. Check the live deploy before changing any secret.
- **503:** the app has no `CRON_SECRET`, or its database is not ready. Check `/api/ready` ([Database unavailable](database-down.md)).
- **409:** another reconciliation run is in progress. Wait and run it again.
- **Anything else, or a `partial` or `failed` status in the summary:** read the run-level error in the summary and the application log for the payment, refund and run IDs. A failed run means nothing was checked that night, so run it again by hand once the cause is fixed and do not count it as a clean day.

## B. The run finished but findings are open (warning)

A completed run with high-severity findings now succeeds with a warning on purpose: the run was healthy, and the open findings are the work.

1. Open the admin reconciliation findings and sort by severity. Each finding has a kind. The high-severity kinds are: a paid online order with no validated payment, an order with several validated payments, an order amount that differs from the payment, a validated payment missing at the gateway, a validated payment whose gateway status disagrees, a payment paid at the gateway but unknown here, a gateway amount or currency mismatch, a validated payment whose order is missing or not marked paid, and a completed refund missing at the gateway. A refund that is stuck and a validated payment with no order ID are medium.
2. For each, find the order, payment and gateway transaction references and compare them with the merchant view at SSLCommerz. Decide which side is right.
3. **Never mark an order paid, refund it, or edit a payment, ledger or finding row by hand to make a finding disappear.** Resolve through the application's own actions (a refund through the refund queue, a payment finalization through the callback path) and keep the gateway reference. A duplicate charge is refunded at the gateway and recorded, not hidden.
4. Acknowledge a finding in the admin view only after it has an owner and a written next step. Acknowledging records that someone has seen it; it does not fix it.
5. If the same kind of finding repeats every night, treat it as a code or gateway-configuration bug and open an incident, not a nightly chore.

## C. The counting rule

Real confidence needs **14 consecutive clean nightly runs with real orders**. Any red run, any run with an open high-severity finding, and any night with no run resets the count. The first successful production run was on 13 November 2026 (42 checked, 42 matched, 0 findings); that is day one, not proof.

**Close when:** Every high-severity finding is resolved or has a named owner and date, the next run is green with no open high-severity findings, and any gateway-side correction is recorded.

**Escalate** a duplicate charge, an unmatched gateway payment, or any finding you cannot explain within a day. The cash-on-delivery side (riders' collected totals against remittances) is **not covered** by this job; check it with the payouts process in [Seller and Rider Payout Policy](../payouts.md).
