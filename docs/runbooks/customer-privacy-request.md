# Customer Data Export or Deletion Request

**Trigger:** A customer asks for a copy of their data, asks for their account to be deleted, or complains about marketing email they did not agree to. Support handles the conversation; the production operator is needed only if the self-service route fails. This page covers **customer** accounts only: the code has no export or deletion route for sellers or riders.

## What the customer can do themselves

- **Export:** a signed-in customer downloads their own data from their account (`GET /api/customers/me/export`). It returns the account profile and address, and their orders, payments, refunds, cancellation requests, reviews, cart, wishlist, support requests and policy consents, for an account that has not been deleted.
- **Delete:** a signed-in customer deletes their own account (`POST /api/customers/me/deletion`) after typing the email address on the account to confirm. Their name, phone, saved addresses and marketing consent are cleared, their login and any social sign-in links are removed, their sessions, cart, wishlist and reviews are deleted, and the email is replaced with a placeholder. Their support messages are redacted. Order and payment records are kept with the address and phone details removed, because fulfilment, accounting, refunds and disputes need them.
- **Marketing consent:** consent is recorded with a timestamp, and deletion clears it.

## Handling a request

1. Verify the person is the account holder. If they can still sign in, send them to the account page to export or delete. Never accept a request from an unverified email thread to hand over data.
2. If they cannot sign in, help them recover the password first (the password recovery flow), then let them use the same account page. Do not reset or change a password on their behalf.
3. A deletion is refused with a `409` while the customer has an order that is not delivered or cancelled. Tell them to wait for it to finish or cancel it, and that this protects their refund and delivery.
4. Do not edit or delete customer rows in the database by hand to speed a request up. There is no admin action for this; a hand edit can break orders, refunds and the reconciliation checks. If the self-service route is broken, escalate it as a bug to the production operator.
5. Reply in writing with what was done and what is kept and why: order and payment records without personal profile details. Do not send the export file by email unencrypted if it contains an address and phone; ask them to download it from their own signed-in account.
6. Record the date, the type of request and the outcome in the incident log. Do not copy the customer's data into the log.

**Close when:** The customer has the result in writing, and any bug found is tracked.

**Escalate** a request that cites a legal deadline, a seller or rider asking for the same, a suspected account takeover, or a data export that looks wrong. Whether the retention described above meets any particular law is a question for the policy-page legal review, not for this runbook.
