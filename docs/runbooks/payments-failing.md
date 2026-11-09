# Payments Failing

**Trigger:** Customers report failed, delayed, or duplicate online charges, or SSLCommerz reports elevated errors. The incident lead owns customer updates and the decision to disable online checkout.

1. Record the start time, affected order IDs, timestamps, error text, and request IDs. Do not ask customers to retry a charge until its status is known.
2. Check the production API `/api/ready`, Render service logs by request ID, and the SSLCommerz merchant status/transaction view. Determine whether checkout initialization, gateway authorization, callback/IPN delivery, or finalization is failing.
3. If new online attempts could worsen customer impact, use [Disable online payments; COD only](disable-online-payments.md). Keep the API and callback routes running; do not delete gateway credentials or turn off IPN callbacks as a checkout workaround.
4. Check pending and late transactions through the admin payment/reconciliation view. Do not mark an order paid, refund it, or edit payment rows by hand. Preserve gateway references and escalate unmatched or duplicate charges to the finance/admin owner.
5. Tell support and sellers what is affected, whether COD remains available, and when the next update will be posted. If COD or order creation is also unhealthy, pause checkout through the incident lead and escalate to the production operator.
6. Re-enable online checkout only after the provider is stable, `/api/ready` is healthy, and an authorized verification transaction/callback has succeeded. Review pending transactions and reconciliation findings before closing the incident.

**Close when:** New online payment behavior is verified, COD remains functional, pending/duplicate transactions have owners, and customers have a final status update. Record start, mitigation, recovery, and follow-up actions in the incident log.
