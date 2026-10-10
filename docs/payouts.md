# Seller and Rider Payout Policy

This policy records the current ShopNiro payout baseline.

## Seller Sales

- Platform commission: 15% of delivered item subtotal.
- Shipping fees remain with the platform and are excluded from seller credits and commission calculations.
- Seller payout cadence: manual admin payout.
- Earnings become eligible seven days after the related fulfillment is delivered.
- Refunds after delivery create a negative seller-ledger entry; they never edit or delete previous ledger rows.
- Sellers can request payouts only from available (not held) ledger funds and only after an admin verifies their payout account.
- Admins must record an external payout reference when marking a request paid. Rejecting a request returns the amount to the available ledger balance.

## Cash on Delivery

- The rider collects the order amount from the customer at delivery.
- The COD amount is recorded as a rider wallet credit and deducted from rider monthly salary.
- The fulfillment item subtotal is credited to the seller ledger as COD sales, less the 15% commission. Shipping is excluded.
- COD remittance occurs only after customer delivery confirmation and rider collection are recorded.

## Reconciliation

- Wallet balances are derived from append-only ledger entries.
- Every payout and COD remittance references its source order or fulfillment and is idempotent.
- Admins record the external payout reference before marking a seller payout paid.