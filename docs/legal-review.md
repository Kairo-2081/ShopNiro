# Legal and retention sign-off — pending

The policy pages remain drafts. No Bangladesh-qualified lawyer has reviewed or approved them, and this checklist is not legal advice or a compliance determination. Do not remove the draft banner or mark the policies final until the reviewer records dated sign-off.

## Business decisions and facts

- The owner confirmed that **ShopNiro Ltd. is not registered**. Policies use ShopNiro as a brand only; the legal operator and required registrations remain unverified. Do not describe the brand as a registered company.
- An address was supplied but has not been confirmed as an authorized public business/service address. It is intentionally not published. Confirm an address the operator is authorized to publish, and do not call it a registered office unless it is registered there.
- Confirm which business registrations, tax registrations, marketplace registrations, disclosures, and complaint-handling arrangements apply to ShopNiro's operating model and location.
- The owner selected a refund completion estimate of **7 to 10 business days**. Confirm that the payment provider and support process can meet it, and that the wording is legally appropriate.
- The owner approved this **provisional internal retention schedule**, not as a statement of law:
  - Remove order delivery/contact details from operational records 12 months after final resolution; retain only necessary, minimized or pseudonymized accounting/order/payment evidence for up to 6 years after the relevant tax year, or longer if a legal hold or applicable requirement applies.
  - Keep rider identity, driving-licence, and CV files only while the rider is active and verification remains necessary; delete within 90 days after rejection or the end of the rider relationship, subject to legal holds. Retain only minimal verification outcome/licence-expiry metadata where needed and review active files annually.
  - Automated deletion remains disabled until Bangladesh counsel and an accountant verify the applicable rules, lawful bases, exact start dates, and exceptions.

## Bangladesh counsel review

Use the current official text and gazette status, including amendments or replacement instruments effective on the review date:

- Confirm the current applicability of the Digital Commerce Operation Guidelines 2021 and consumer-protection requirements to an online marketplace, including seller identity and listing disclosures, order confirmation, delivery, returns/refunds, records, complaints, and enforcement.
- Verify the applicable consumer law, including the Consumers' Right Protection Act 2009, and any later amendments or rules.
- Identify the currently operative Bangladesh personal-data protection instrument and its amendments/replacements. The official text of the reported Personal Data Protection Ordinance 2025 and subsequent 2026 instruments was not verified in the preliminary research; confirm the Gazette text, commencement, and any rules before relying on its requirements.
- Review lawful bases and consent language; data-subject access, correction, export and deletion; children; security and breach response; processors; cross-border transfers; and any localization or registration requirements.
- Confirm the statutory scope, period, start date, and exceptions for tax/accounting and payment records; the preliminary research could not verify the current official text or establish a fixed marketplace-specific duration. The Consumer Rights Protection Act 2009 section 60 complaint filing deadline is not itself an order-record retention period.
- Confirm the lawful approach to pseudonymizing a deleted customer's historic order records and whether any fixed retention period applies to rider identity, licence, or CV documents. No fixed rider-document period was verified in the preliminary research.
- Review seller/rider verification, prohibited products, marketplace liability, payment collection, and the business's required trade-licence, tax/VAT, and other registrations.

Official starting points (verify the current instruments and notices directly):

- [Bangladesh Laws portal](https://bdlaws.minlaw.gov.bd/)
- [Bangladesh Gazette archive](https://www.dpp.gov.bd/bgpress/index.php/document/gazettes/140)
- [Legislative and Parliamentary Affairs Division](https://legislativediv.gov.bd/)
- [National Board of Revenue](https://nbr.gov.bd/)
- [Bangladesh Bank](https://www.bb.org.bd/)
- [Ministry of Commerce](https://mincom.gov.bd/)
- [Directorate of National Consumer Rights Protection](https://dncrp.gov.bd/)

## Application behavior to review

- Customer signup and checkout record a versioned acceptance timestamp; the order API rejects checkout without an affirmative terms acceptance.
- Customers can download an account export and request deletion after active orders are complete. Deletion disables login, removes profile/contact data, and clears order addresses, but preserves transaction/order records and consent evidence pending applicable record-keeping obligations.
- Verify the exact export/deletion scope, notice, escalation path, and retention exception language before release.
- Rider CV and verification files are stored in the database. No retention cleanup job is enabled; implement one only after counsel/accountant confirmation and a reviewed operational deletion process.

Reviewer: **pending**
Review date: **pending**
Approved policy versions: **pending**
