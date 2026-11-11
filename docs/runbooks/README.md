# Production Incident Runbooks

Use the runbook matching the incident. The payment shutdown control requires the `ONLINE_PAYMENTS_ENABLED` flag shipped by this change; until it is deployed to the production API, use the existing incident escalation path and do not assume removing gateway credentials is a safe substitute.

- If you have not used Render before, follow [Disable online payments; COD only](disable-online-payments.md) from top to bottom. Do not make a production change until you have identified the production API service and confirmed you have permission to change its environment.
- [Payments failing](payments-failing.md)
- [Database unavailable](database-down.md)
- [Leaked secret or key](leaked-secret.md)
- [Seller payout dispute](seller-payout-dispute.md)
- [Disable online payments; COD only](disable-online-payments.md)
- [Production access and secret custody](production-access.md)
- [Gateway error practice drill](gateway-error-drill.md)

**Production access and the Render drill are not verified.** The 2026-11-09 review found no GitHub `production` environment protection rules and only one visible repository collaborator; neither fact reveals the Render service roster. The only recorded payment-switch measurement is an in-process local test, not a Render operation. Complete the named primary/backup inventory and the independent-operator staging drill in [Production access and secret custody](production-access.md) and [Gateway error practice drill](gateway-error-drill.md). Do not describe two-person rotation or the Render response time as verified until then.
