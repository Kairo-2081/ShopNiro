# Production Incident Runbooks

Use the runbook matching the incident. The payment shutdown control requires the `ONLINE_PAYMENTS_ENABLED` flag shipped by this change; until it is deployed to the production API, use the existing incident escalation path and do not assume removing gateway credentials is a safe substitute.

- [Payments failing](payments-failing.md)
- [Database unavailable](database-down.md)
- [Leaked secret or key](leaked-secret.md)
- [Seller payout dispute](seller-payout-dispute.md)
- [Disable online payments; COD only](disable-online-payments.md)
- [Production password-recovery verification](password-recovery-live-check.md)
- [Production access and secret custody](production-access.md)
- [Gateway error practice drill](gateway-error-drill.md)

**Production access is not yet verified.** As checked on 2026-11-09, the GitHub `production` environment has no protection rules, and the repository collaborator API lists only `Kairo-2081` (admin). That does not reveal who can access the Render production service. Complete the named primary and backup operator inventory in [Production access and secret custody](production-access.md) before calling two-person rotation ready.
