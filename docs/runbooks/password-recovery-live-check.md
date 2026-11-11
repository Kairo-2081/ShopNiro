# Production Password-Recovery Verification

**Purpose:** Verify that a real password-reset email is sent from the production site, its link changes the account password once, and the reset revokes existing sessions. This is an operator-run check using an account you own. It is not a substitute for the automated tests.

**Current status:** Not verified from this repository session. No Render environment or Resend delivery access was available. Do not mark the production email flow verified until the record at the end is completed.

## Before you start

- Use only your own production account and mailbox. Confirm you can sign in with its current password before starting. Do not use a customer account or ask someone to share a password.
- Confirm with the production owner that a reset email is expected and that this account can safely be used for a test.
- Make sure you can access Render and the Resend account using your own authorized account. If not, stop and ask the named production operator; do not borrow a login or copy secrets into a ticket, terminal, browser console, or chat.
- Have two separate browser profiles available: one with an active session for the account, and one for the reset. This lets you verify that the old session is revoked.
- Do not request multiple links to work around a delivery delay. A live link is not replaced, and another email is not sent, for 60 seconds; recovery is also rate-limited per IP.

## Check production email configuration

1. In Render, open the verified **production API web service** (not staging, a preview, or a worker) and open **Environment**.
2. Confirm that `RESEND_API_KEY`, `SHOPNIRO_FROM_EMAIL`, and `SHOPNIRO_PUBLIC_URL` are present. Do not reveal, copy, screenshot, or record the value of `RESEND_API_KEY`.
3. Confirm `SHOPNIRO_PUBLIC_URL` is the HTTPS origin of the production customer-facing site. The reset email link is built from this origin.
4. In Resend, confirm the sender/domain used by `SHOPNIRO_FROM_EMAIL` is verified and active. Check only the sender/domain status; never copy an API key into Render notes or this runbook.
5. If any value is missing or the sender is not verified, stop. Have the production operator configure the correct values and complete the resulting Render deploy/restart. Confirm the API is healthy at `/api/ready` before continuing.

## Request and complete a real reset

1. In browser profile A, sign in to your own account and leave the session open. Confirm you can reach an authenticated page.
2. In profile B, open the production site, choose **Forgot password**, enter the email address belonging to your own account, and submit once. The site intentionally displays the same generic response for known and unknown addresses; an HTTP 202 response alone does **not** prove that an email was sent.
3. Check Inbox, Spam/Junk, and any Promotions/Other tab for **Reset your ShopNiro password**. Confirm the visible sender matches the verified sender. Allow a short delivery interval; if it does not arrive, inspect the Resend email event for delivery, bounce, or rejection before making another request. Do not paste the reset link into a support ticket.
4. If the message is in spam, record that fact, move it to Inbox if appropriate, and do not call the deliverability check a pass. Ask the email owner to investigate sender/domain authentication and provider events.
5. Open the link from the message and set a new, unique password that you have not used elsewhere. Do not record the password. The token is in the URL fragment; do not copy it, take a screenshot of it, or include it in a report.
6. Confirm the page reports success. In browser profile A, refresh an authenticated page. The old session must be rejected and require sign-in again.
7. Attempt sign-in in profile B with the old password; it must fail. Then sign in with the new password; it must succeed.
8. Reopen the **same original email link**. Submit the reset form again if it is shown. The server must reject the already-used link as invalid/expired and must not change the password again. Confirm the new password still works afterward.
9. Sign out and close the test browser profiles. Record only the outcome and timestamps below. Do not record the email address, passwords, reset URL/token, cookies, or provider/API secrets.

## Failure handling

- **No email:** Check Render's service health/logs and Resend's event status. The forgot-password endpoint intentionally returns the same 202 for a matching and non-matching address, and delivery is asynchronous. Do not infer success from the response or change account data manually.
- **Wrong sender or spam:** Stop and have the email owner verify the configured sender and domain authentication in Resend before retesting.
- **Link is broken or wrong site:** Do not forward the link or expose its fragment. Record that the link origin is wrong, then have the production operator verify `SHOPNIRO_PUBLIC_URL` and deploy the correction.
- **Old password/session still works or replay succeeds:** Treat this as a security incident. Stop testing, preserve timestamps and non-secret evidence, notify the production/security owner, and use [Leaked secret or key](leaked-secret.md) if credentials or tokens may have been exposed.
- **Unexpected lockout:** Use the account's normal support path. Do not disable rate limiting or edit the database to complete the test.

## Verification record

- Production API service and site origin confirmed by: **pending**
- Configured variable names present (values not recorded): **pending**
- Resend sender/domain verified: **pending**
- Test date and operator: **pending**
- Email arrived and visible sender matched: **pending**
- Spam/Junk result: **pending**
- New password accepted; old password rejected: **pending**
- Previously open session revoked: **pending**
- Reuse of the same link rejected: **pending**
- Evidence location (must contain no tokens, passwords, email addresses, or secrets): **pending**

**Pass only when** the live email arrives from the verified sender, the link changes the password once, a second use fails, the old password fails, and an existing session is revoked. Until the record is completed by an authorized operator, production verification remains **pending**.
