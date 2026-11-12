# Gateway Error Practice Drill

**Scenario:** “The gateway is returning errors.” The drill operator must not be the person who wrote the payment switch/runbook. The host-dashboard exercise runs in **staging only**; do not make a production change to practice.

## Staging drill

1. The exercise lead confirms the staging API origin and Render service from the staging deployment record. Verify the dashboard explicitly says **staging**; if it is ambiguous, stop. Confirm online checkout is enabled in staging and that COD is available. Do not copy production secrets or customer data into the exercise.
2. Give the operator only the [Disable online payments; COD only](disable-online-payments.md) runbook and the incident statement: “The gateway is returning errors.” Start a wall-clock timer when the statement is given. The operator should explain the actions as they go and request a second operator if required by the runbook.
3. The operator follows the runbook in the staging Render dashboard, setting `ONLINE_PAYMENTS_ENABLED=false`. Include finding the right service, saving the change, waiting for restart/deploy, and confirming service health in the elapsed time.
4. The operator verifies the staging `/api/payment/methods` response reports `onlinePaymentsEnabled: false` and exactly one method, `cash_on_delivery`; `/api/ready` returns 200; and a fresh staging checkout offers COD but no online methods. Do not create an order or contact a live gateway.
5. Stop the timer only after all checks pass. Record the operator, observer, staging service, start/end timestamps, elapsed time, verification results, and any confusion or escalation in the exercise record below. The operator identifies and fixes unclear instructions before the next drill.
6. Restore staging by setting `ONLINE_PAYMENTS_ENABLED=true` (or removing it), saving/redeploying, and verifying online methods return and the service is healthy. Record who restored it.

If staging access is unavailable, do not claim the host-dashboard drill is complete. The isolated local check can still confirm application behavior:

```sh
npx tsx scripts/practice-payment-disable.mts
```

This script measures only the local in-process API response after the flag changes. It is not the Render drill and its duration must not be reported as production mitigation time.

## Exercise record

- Local route-level check: completed 2026-11-09; **3.1 ms** from the in-process flag change to the COD-only API response.
- Local route-level recheck: completed 2026-11-12; **5.6 ms** from the in-process flag change to the COD-only API response.
- Local check limitation: does not include Render navigation, permissions, environment save, restart/deploy, health, or a fresh checkout. No production switch was made.
- Independent staging operator: **pending**
- Observer and exercise date: **pending**
- Staging Render end-to-end elapsed time: **pending**
- Methods endpoint / readiness / checkout results: **pending**
- Runbook changes and re-test date: **pending**

**Pass criteria:** A person who did not write the code can identify the staging service, find and change the flag without source-code access, wait for the service to recover, verify COD-only through the public endpoint and checkout, restore the setting, and accurately report the end-to-end elapsed time. Keep the exercise marked pending until the record is completed.
