# Disable Online Payments; COD Only

**Use when:** SSLCommerz errors, payment integrity is uncertain, or the incident lead directs a temporary online-checkout stop. Requires the `ONLINE_PAYMENTS_ENABLED` switch deployed to the API service being changed. No database migration is needed.

## Before changing an environment

- Confirm this version of the API, including `ONLINE_PAYMENTS_ENABLED`, is deployed. If it is not, stop and escalate; do not remove gateway credentials as a substitute.
- For a practice drill, select **staging only** and get its API origin and exact Render service name from the staging deployment record. For a live incident, get the production API origin and exact Render service name from the verified operator inventory in [Production access and secret custody](production-access.md). Never use a preview URL or select a database or background worker.
- Be signed into the authorized Render account. If the service or **Environment** page is not visible, stop and contact the named primary/backup operator; do not use someone else's login.
- Notify the incident lead and second operator. For a live incident, start the incident timer when the report is received and record the time. For a drill, follow the start/stop criteria in [Gateway error practice drill](gateway-error-drill.md).

## Switch the selected environment to COD-only

1. In the Render dashboard, open the ShopNiro workspace and select the API web service identified above. Check the exact service name and target environment (**staging** for a drill, **production** for a live incident) before editing anything. If they do not match, stop.
2. Open **Environment** and choose **Edit**. Find `ONLINE_PAYMENTS_ENABLED`. Set its value to exactly `false` (lowercase, no quotes). If it is not present, add it with that exact key and value.
3. Leave `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, and `SSLCOMMERZ_IPN_TOKEN` unchanged. Do not print, copy, or send secret values.
4. Choose Render's save/deploy action (for example **Save, rebuild, and deploy** when shown). Confirm the change and wait for the production service's resulting deploy/restart to report **Live** and healthy. Open the service's **Events** and **Logs** if it fails or stalls; escalate rather than claiming success.
5. In PowerShell, replace the placeholder with the verified API origin for the selected environment (scheme and host only), then run:

   ```powershell
   $ApiOrigin = "https://<api-origin>"
   $methods = Invoke-RestMethod -Uri "$ApiOrigin/api/payment/methods"
   $methods | ConvertTo-Json -Depth 5
   $cod = @($methods.methods)
   if ($methods.onlinePaymentsEnabled -ne $false -or $cod.Count -ne 1 -or $cod[0].id -ne "cash_on_delivery") {
     throw "COD-only verification failed. Keep the incident open and escalate."
   }
   (Invoke-WebRequest -Uri "$ApiOrigin/api/ready").StatusCode
   ```

   The methods response must show `onlinePaymentsEnabled: false` and exactly one method, `cash_on_delivery`; readiness must return `200`. If either check fails, keep the incident open, do not announce the switch as complete, and escalate to the production operator.
6. If the service is healthy, open a fresh customer checkout in the same environment and confirm online methods are absent and COD remains available. Do not submit a real order or payment unless the incident lead explicitly authorizes it. For a live incident, record timer stop time, elapsed time, operator, service/deploy event, endpoint result, and any errors in the incident record. Notify support and the incident lead.

The backend also returns HTTP 503 with code `ONLINE_PAYMENTS_DISABLED` for new online payment initialization, protecting customers with stale pages. Existing SSLCommerz success/fail/cancel/IPN callbacks remain active. Review pending/late transactions using the [payments-failing runbook](payments-failing.md).

**Restore:** For a drill, restore staging immediately after recording the result. For a live incident, wait until the provider and callbacks are healthy, the incident lead authorizes recovery, and pending transactions are reviewed. Set `ONLINE_PAYMENTS_ENABLED` to `true` (or remove it to use the default), save/restart, then verify the methods endpoint reports enabled and an authorized transaction completes. Notify support before closing.

**Never use credential deletion as the switch.** This control stops new online checkout and keeps COD available; it does not cancel already authorized transactions or disable refunds/IPN processing.
