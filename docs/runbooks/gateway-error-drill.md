# Gateway Error Practice Drill

**Scenario:** SSLCommerz is returning errors during checkout. This is a controlled, local API drill only; it does not touch production credentials, a live gateway, or customer data.

## Drill steps

1. Start a timer when the operator receives the report. State: “Gateway errors are confirmed; switching new checkout to COD-only.”
2. Run `npx tsx scripts/practice-payment-disable.mts` for the isolated code/API exercise; for a realistic operational drill, perform the same setting change in staging's host dashboard.
3. Confirm `onlinePaymentsEnabled` is false and the only method is `cash_on_delivery`.
4. Confirm `/api/ready` and browser checkout behavior in staging before treating a production host change as complete. In the actual production procedure, the timer stops only after the Render restart is healthy and the public methods endpoint returns COD-only; follow [Disable online payments; COD only](disable-online-payments.md).
5. Restore the test-process setting and confirm the normal online methods return.

## Exercise record

- Date: 2026-11-09
- Scenario: “The gateway is returning errors.”
- Result: **Local route-level drill completed: 3.1 ms** from the in-process flag change to the COD-only API response.
- Limitation: The local drill does not measure Render dashboard navigation or deploy/restart propagation. No production switch was made. Schedule the next exercise in staging with an operator who did not write the code and time it through the public endpoint.

**Pass criteria:** The operator can find the switch without reading source code; the endpoint reports COD-only; checkout leaves COD available; the service remains healthy; and existing callbacks are not disabled.
