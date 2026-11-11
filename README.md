<div align="center">

<img src="./ShopNiro-new-round-128.png" alt="ShopNiro" width="112" />

# ShopNiro

**Shop smart. Ship fast.**

A multi-vendor marketplace built for Bangladesh. Customers can shop, pay with local payment options, and track deliveries while approved sellers manage their stores.

[![CI](https://github.com/Kairo-2081/ShopNiro/actions/workflows/ci.yml/badge.svg)](https://github.com/Kairo-2081/ShopNiro/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

</div>

---

## Why ShopNiro

Marketplace software often treats local payments, seller onboarding, and last-mile delivery as add-ons. ShopNiro brings those workflows together for customers, sellers, riders, and admins, with Bangladesh-focused payment and delivery options.

## Features

**For customers**

- Browse products, manage a cart, place orders, and track deliveries.
- Choose cash on delivery or an available online payment method, including bKash and SSLCOMMERZ.
- Ask the AI shopping assistant for help discovering products.
- Accept the terms at registration and checkout; consent is recorded with its policy version and timestamp.
- Request a personal-data export or account deletion.

**For sellers**

- Apply to sell; an admin must approve an application before the seller can operate.
- Manage products, inventory, orders, and store information.
- Review earnings and request payouts under the [payout policy](./docs/payouts.md).

**For riders**

- Apply to deliver and manage assigned deliveries after approval.
- Record delivery progress, cash-on-delivery collection, and wallet activity.

**For admins**

- Review seller and rider applications.
- Manage marketplace operations, payments, refunds, and seller payouts.
- Create admin accounts from an existing admin account; there is no public admin signup.

**Platform**

- Process order expiry, refunds, payment reconciliation, and rider payroll through scheduled jobs.
- Store support requests in PostgreSQL and optionally send email notifications.
- Provide Android (Capacitor) and desktop (Electron) application wrappers.

## Demo

![ShopNiro product demo](./ShopNiro-new-round.gif)

Legal and retention decisions are provisional and still require qualified Bangladesh counsel/accountant review. See the [legal review checklist](./docs/legal-review.md).
