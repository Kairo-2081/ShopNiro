# Scheduled Jobs Failing

**Trigger:** The **Scheduled jobs** workflow is red, missing for more than 15 minutes, or customers report orders that never expire, refunds that never arrive, or riders not paid. GitHub Actions is the only scheduler, so if it stops, nothing else will run these tasks.

| Job | Runs | Calls | If it stops |
| --- | --- | --- | --- |
| tick (expire orders) | every 5 minutes | `POST /api/cron/expire-orders` | unpaid online orders stay pending past 30 minutes and hold stock |
| tick (refunds) | every 5 minutes | `POST /api/cron/refunds` | queued refunds are not sent to the gateway |
| settle payroll | daily at 00:00 UTC | `GET /api/riders/payroll/settle` | month-end rider salary is not credited to wallets |

1. Open the failed run and read the first failing step. If it says `APP_URL` or `CRON_SECRET` are not configured, the repository secret is missing: restore it (never paste the value into chat or tickets).
2. A `401` means `CRON_SECRET` in GitHub does not match the app's. A `503` means the app has no secret set or its database is not ready (check `/api/ready`). A `5xx` or timeout means the app or database is down ([Database unavailable](database-down.md)).
3. GitHub may delay or skip scheduled runs under load, so one missed tick is not an incident. Several in a row, or none for an hour, is. GitHub also turns scheduled workflows off in a repository with no activity for 60 days; if the list shows the workflow as disabled, enable it again.
4. After the cause is fixed, run the workflow by hand (it supports manual runs) and confirm both calls return success.
5. Catch up. Expiry and refunds are safe to run again: the next tick handles everything still due. **Payroll is also safe to repeat:** it credits each rider for each finished month once and skips any month already credited, so a second run adds nothing. After a long outage, check that expired orders released their stock and that the refund queue drained, and tell support which customers waited.

**Close when:** Three consecutive ticks are green, the refund queue and pending orders are back to normal, and the payroll run for any missed month has credited riders.

**Escalate** if refunds stay stuck after the app is healthy, which may be a gateway problem ([Payments failing](payments-failing.md)), or if the secret may have been exposed ([Leaked secret or key](leaked-secret.md)).
