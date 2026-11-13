# Production Incident Runbooks

Find the symptom, open the page, follow it from the top. Every runbook names who leads, what to record, what **not** to do, and when it is closed. Keep names, work contacts and service identifiers out of these public pages; they belong in the restricted operator inventory ([Production access and secret custody](production-access.md)).

**If you have not used Render before,** start with [Disable online payments; COD only](disable-online-payments.md) and read it top to bottom. Do not make a production change until you have identified the production API service and confirmed you have permission to change its environment.

## Money and customers

| Symptom | Runbook |
| --- | --- |
| Charges failing, delayed or duplicated; the gateway reports errors | [Payments failing](payments-failing.md) |
| Need to stop online checkout and keep cash on delivery | [Disable online payments; COD only](disable-online-payments.md) |
| The nightly reconciliation went red or shows open findings | [Payment reconciliation failed or found something](reconciliation-findings.md) |
| A seller says a payout is missing, short, late or wrong | [Seller payout dispute](seller-payout-dispute.md) |
| A customer wants a copy of their data or their account deleted | [Customer data export or deletion request](customer-privacy-request.md) |

## Platform

| Symptom | Runbook |
| --- | --- |
| `/api/ready` returns `503` with no reason, pages fail, connection timeouts | [Database unavailable](database-down.md) |
| A merge never goes live; `/api/ready` says `migrations_pending` | [Deploy not going live (migrations pending)](deploy-stalled-migrations.md) |
| A release broke something and needs to be undone | [Roll back a bad release](rollback-bad-release.md) |
| The daily backup failed, or data must be restored | [Backup failed or restore needed](backup-failed-or-restore.md) |
| Orders do not expire, refunds do not go out, riders are not paid | [Scheduled jobs failing](scheduled-jobs-failing.md) |
| The production schema watch is red | [Production schema watch failed](schema-drift-alert.md) |

## Security and access

- [Leaked secret or key](leaked-secret.md)
- [Production access and secret custody](production-access.md)
- [Production password-recovery verification](password-recovery-live-check.md)

## Practice and verification

- [Gateway error practice drill](gateway-error-drill.md)
- [Deployment and rollback rehearsal](../deployment-rehearsal.md)
- [Drill and verification record](drill-record.md): the checks only a person can complete, and their status

## What is and is not verified

The payment switch (`ONLINE_PAYMENTS_ENABLED`) is in the code and runs locally in milliseconds; that timing excludes the Render dashboard and a restart. A GitHub API check on 2026-11-12 found no protection rules on the `production` environment. The Render team roster, who holds the host secrets, the backup decryption key, a timed switch on Render, and a deploy and rollback rehearsal have **not** been verified by anyone other than the author. The repository has no `production` branch, which the deploy and rollback workflows require. Do not claim two-person secret rotation, a Render mitigation time, or a tested rollback until [Drill and verification record](drill-record.md) shows them passed.
