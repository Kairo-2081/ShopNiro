# First live payment (controlled test)

Status: **not done, and not to be started until the owner decides.** The project rule is sandbox payments until launch.
This page does not change that. It is the procedure to follow on the day the owner chooses to take the first real
transaction, so that the first real money moves under control and not by surprise.

## What the server already enforces

- With `SHOPNIRO_ENV=production` the server **refuses to start** unless `SSLCOMMERZ_IS_SANDBOX=false` and `PAYMENT_MODE` is
  not `sandbox-demo`. Sandbox payments cannot run on a production-labelled service.
- Staging does the reverse: it requires sandbox credentials. So the first live payment is the first time the live
  credentials and the live gateway callbacks are exercised at all. Nothing before it proves they work.
- `ONLINE_PAYMENTS_ENABLED=false` stops new online checkout and keeps cash on delivery ([runbook](../runbooks/disable-online-payments.md)).
  It is the safety switch for this test. It does not cancel authorised transactions or stop refunds and IPN processing.

Confirm in the Render dashboard (names and values by a person with access, never pasted anywhere) what the production
service is currently set to before you rely on any of this.

## Preconditions: all must be true

- [ ] [Production gates](production-gates.md) are done: a required reviewer, the `production` branch, a passing production dispatch.
- [ ] A recent backup succeeded (the deploy workflow checks within 24 hours; check it yourself too).
- [ ] A second person is present and can switch online payments off on the Render dashboard without you. Practise that
      on staging first ([drill](../runbooks/gateway-error-drill.md)).
- [ ] You have live SSLCommerz credentials and the **merchant panel** open, and the IPN address for the production API is
      registered with the gateway. Credentials live in the Render Environment store only.
- [ ] A test seller account and a test customer account you control, and one test product at the lowest price the gateway
      accepts. Mark it clearly as a test (for example "TEST - do not buy") and keep it out of public view if you can.
- [ ] A card or wallet that is yours, with a balance of at least that amount.
- [ ] The nightly reconciliation has completed an `ok` run on production, so a mismatch caused by this test is visible
      as new, not as old noise.
- [ ] Support and anyone else watching the system know a test payment is coming.

## Procedure

1. **Start a timer and a written log.** Record the time, who is present, and the current production deploy.
2. **Enable online payments only if they are off.** Set `ONLINE_PAYMENTS_ENABLED` to `true` (or remove it) per the runbook,
   save, wait for **Live**, then confirm `/api/payment/methods` lists the online methods and `/api/ready` returns 200.
   This is the one change this procedure makes, and it is the owner's call to make it.
3. **Place one order** as the test customer for the test product, choose the online method, and pay with your own card.
   One order, one payment. Do not retry on a slow page; check state first.
4. **Watch the three signals**, and note the time each arrives:
   - the browser returns to the success page and the order shows **paid**;
   - the gateway merchant panel shows one validated transaction for the exact amount;
   - the admin payment view shows one matching transaction (no duplicate).
5. **Check what the gateway sent.** The IPN callback should have been accepted; look at the server logs for the callback
   (no secrets in the log or in your notes). If the browser return succeeded but no IPN arrived, that is a finding, not a pass.
6. **Test the refund path with this same order** instead of delivering it. As the test customer, open the order and choose
   **request cancellation and refund**. As an admin, approve it. That queues a refund for the validated payment, and the
   refund job (`POST /api/cron/refunds`, run by the scheduler) sends it to the gateway and checks its status on a later
   run. Wait for the scheduler or, if you are the operator, trigger the job the way [scheduled jobs failing](../runbooks/scheduled-jobs-failing.md)
   describes. Do not edit payment or refund rows by hand.
7. **Confirm the refund end to end:** the gateway merchant panel shows the refund, the order shows **refunded**, and the
   admin payment view shows the payment refunded. The refund is the part of this flow that has run only against the
   sandbox, so treat any surprise as a finding. If you also want to prove delivery, do that with a second test order,
   never with the same one.
8. **Put the switch back** if you are not launching yet: set `ONLINE_PAYMENTS_ENABLED=false`, verify COD only, and log the time.
9. **Next morning**, read the reconciliation report. The test order should appear as matched and refunded, or as a clearly
   explained finding.

## Stop immediately if

- a payment is taken but the order is not marked paid, or marked paid twice;
- the amount differs from the order total;
- the gateway reports an error you do not understand;
- anyone is unsure what state a payment is in.

Then: switch online payments off ([runbook](../runbooks/disable-online-payments.md)), keep the incident open, preserve the
gateway reference and the order number, and follow [payments failing](../runbooks/payments-failing.md). Do not mark an
order paid or refund it by editing the database.

## Record

| Field | Value |
| --- | --- |
| Date and time | |
| People present | |
| Amount (BDT) | |
| Browser return seen (time) | |
| Order marked paid (time) | |
| Gateway panel shows one validated transaction | yes / no |
| IPN accepted | yes / no |
| Cancellation approved and refund queued (time) | |
| Refund shown at the gateway (time) | |
| Order and payment show refunded | yes / no |
| Reconciliation result next day | |
| Problems found | |
| Online payments left on / off | |
| Result | pass / fail |

Leave anything you did not observe blank.
