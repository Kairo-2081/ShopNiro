# Production Incident Runbooks

Use the runbook matching the incident. The payment shutdown control requires the `ONLINE_PAYMENTS_ENABLED` flag shipped by this change; until it is deployed to the production API, use the existing incident escalation path and do not assume removing gateway credentials is a safe substitute.

- If you have not used Render before, follow [Disable online payments; COD only](disable-online-payments.md) from top to bottom. Do not make a production change until you have identified the production API service and confirmed you have permission to change its environment.
- [Payments failing](payments-failing.md)
- [Database unavailable](database-down.md)
- [Leaked secret or key](leaked-secret.md)
- [Seller payout dispute](seller-payout-dispute.md)
- [Disable online payments; COD only](disable-online-payments.md)
- [Production password-recovery verification](password-recovery-live-check.md)
- [Production access and secret custody](production-access.md)
- [Gateway error practice drill](gateway-error-drill.md)

**Production access and the Render drill are not verified.** A GitHub API check on 2026-11-12 found no protection rules on the `production` environment; this does not reveal the Render service roster. The primary/backup operator coverage and host-secret custody have not been verified. The only recorded payment-switch measurements are in-process local tests, not Render response times. Complete the restricted operator inventory and independent staging exercise in [Production access and secret custody](production-access.md) and [Gateway error practice drill](gateway-error-drill.md). Do not claim two-person secret rotation or a Render mitigation time is verified until those checks are completed.
