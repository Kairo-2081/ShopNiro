# API route inventory

Routes are listed from `server/routes/*.ts`; prefixes come from the mounts in `server/app.ts`. Access names the public caller or the route-level role guard. “Authenticated” means the session is required and any additional ownership checks still apply.

## App-level routes

| Method | Path | Who may call |
| --- | --- | --- |
| GET | `/api/health` | Public |
| GET | `/api/ready` | Public |
| GET | `/api/db/status` | Admin |
| GET | `/api/stats` | Admin |
| GET | `/api/admin/users` | Admin |
| GET | `/api/analytics/trending-products` | Public |
| GET | `/api/analytics/top-rated-products` | Public |
| GET | `/api/analytics/top-rated-sellers` | Public |
| GET | `/api/analytics/related-products` | Public |

## Admins

| Method | Path | Who may call |
| --- | --- | --- |
| GET | `/api/admins` | Admin |
| POST | `/api/admins` | Admin |
| GET | `/api/admins/users` | Admin |

## AI

| Method | Path | Who may call |
| --- | --- | --- |
| GET | `/api/ai/status` | Authenticated |
| POST | `/api/ai/description` | Authenticated |
| POST | `/api/ai/product-copy` | Seller or admin |
| POST | `/api/ai/review-draft` | Customer |
| POST | `/api/ai/rider-review-draft` | Customer |
| POST | `/api/ai/delivery-instructions` | Customer |
| POST | `/api/ai/size-chart` | Seller or admin |
| POST | `/api/ai/chat` | Public |

## Analytics and auth

| Method | Path | Who may call |
| --- | --- | --- |
| POST | `/api/analytics/events` | Public |
| GET | `/api/analytics/seller` | Seller |
| GET | `/api/auth/oauth/registration` | Public; signed registration cookie is optional |
| GET | `/api/auth/oauth/:provider` | Public |
| GET | `/api/auth/oauth/:provider/callback` | OAuth provider callback |
| GET | `/api/auth/me` | Public; returns current session when present |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Public; revokes current session when present |

## Bundles, cart, and categories

| Method | Path | Who may call |
| --- | --- | --- |
| GET | `/api/bundles` | Public |
| GET | `/api/bundles/seller` | Seller |
| POST | `/api/bundles` | Seller |
| PATCH | `/api/bundles/:id/active` | Seller |
| DELETE | `/api/bundles/:id` | Seller |
| GET | `/api/cart` | Customer |
| POST | `/api/cart` | Customer |
| PUT | `/api/cart/:cartId` | Customer |
| DELETE | `/api/cart/:cartId` | Customer |
| GET | `/api/categories` | Public |
| POST | `/api/categories` | Admin |
| PUT | `/api/categories/:id` | Admin |
| DELETE | `/api/categories/:id` | Admin |

## Cron, customers, maps, and orders

| Method | Path | Who may call |
| --- | --- | --- |
| POST | `/api/cron/expire-orders` | Scheduler with `CRON_SECRET` |
| POST | `/api/cron/refunds` | Scheduler with `CRON_SECRET` |
| GET | `/api/customers` | Authenticated |
| POST | `/api/customers` | Public registration |
| PUT | `/api/customers/:id` | Authenticated; ownership checked |
| GET | `/api/maps/reverse` | Public |
| GET | `/api/orders` | Customer, seller, or admin; role and ownership checked |
| POST | `/api/orders` | Authenticated customer |
| GET | `/api/orders/cancellation-requests` | Customer or admin |
| GET | `/api/orders/:id` | Customer; own order only |
| POST | `/api/orders/:id/cancellation-request` | Authenticated customer |
| PATCH | `/api/orders/cancellation-requests/:requestId/review` | Admin |
| PATCH | `/api/orders/:id/revert-failed-payment` | Customer; own order only |
| PATCH | `/api/orders/:id/status` | Seller or admin; seller ownership checked |

## Payments and payouts

| Method | Path | Who may call |
| --- | --- | --- |
| GET | `/api/payment/methods` | Public |
| GET | `/api/payment/simulator` | Public; simulator mode only |
| POST | `/api/payment/simulator/complete` | Public; simulator mode only |
| POST | `/api/payment/init` | Customer |
| POST | `/api/payment/sslcommerz/validate` | Customer |
| GET | `/api/payment/sslcommerz/success` | SSLCommerz callback |
| POST | `/api/payment/sslcommerz/success` | SSLCommerz callback |
| GET | `/api/payment/sslcommerz/fail` | SSLCommerz callback |
| POST | `/api/payment/sslcommerz/fail` | SSLCommerz callback |
| GET | `/api/payment/sslcommerz/cancel` | SSLCommerz callback |
| POST | `/api/payment/sslcommerz/cancel` | SSLCommerz callback |
| POST | `/api/payment/sslcommerz/ipn` | SSLCommerz IPN with configured token |
| GET | `/api/payment/transactions` | Admin |
| GET | `/api/payment/bkash/direct` | Public |
| GET | `/api/payouts` | Admin |
| PATCH | `/api/payouts/:id/pay` | Admin |
| PATCH | `/api/payouts/:id/reject` | Admin |

## Products and reviews

| Method | Path | Who may call |
| --- | --- | --- |
| GET | `/api/products` | Public |
| GET | `/api/products/:id` | Public |
| POST | `/api/products` | Seller or admin |
| PUT | `/api/products/:id` | Seller or admin; ownership checked |
| PATCH | `/api/products/:id/status` | Seller or admin; ownership checked |
| DELETE | `/api/products/:id` | Seller or admin; ownership checked |
| GET | `/api/reviews` | Public |
| POST | `/api/reviews` | Authenticated customer |

## Riders and deliveries

| Method | Path | Who may call |
| --- | --- | --- |
| POST | `/api/riders/cv/parse` | Public |
| POST | `/api/riders/cv/format` | Public |
| POST | `/api/riders/apply` | Public registration |
| GET | `/api/riders/leaderboard` | Admin |
| GET | `/api/riders/applications` | Admin |
| GET | `/api/riders/applications/:id/cv` | Admin |
| PATCH | `/api/riders/applications/:id/status` | Admin |
| GET | `/api/riders/me` | Rider |
| GET | `/api/riders/me/cv` | Rider |
| PUT | `/api/riders/me` | Rider |
| PATCH | `/api/riders/location` | Approved rider |
| GET | `/api/riders/deliveries` | Approved rider |
| POST | `/api/riders/deliveries/:id/accept` | Approved rider |
| POST | `/api/riders/deliveries/:id/on-way` | Approved rider |
| POST | `/api/riders/deliveries/:id/cod-collected` | Approved rider |
| POST | `/api/riders/deliveries/:id/complete` | Customer |
| GET | `/api/riders/customer-deliveries` | Customer |
| POST | `/api/riders/customer-deliveries/:id/review` | Customer |
| GET | `/api/riders/wallet` | Approved rider |
| GET | `/api/riders/payroll/settle` | Scheduler with `CRON_SECRET` |
| POST | `/api/riders/wallet/withdrawals` | Approved rider |
| GET | `/api/riders/wallet/withdrawals` | Admin |
| PATCH | `/api/riders/wallet/withdrawals/:id` | Admin |

## Sellers, support, and wishlist

| Method | Path | Who may call |
| --- | --- | --- |
| GET | `/api/sellers` | Public; private fields depend on role |
| POST | `/api/sellers` | Public application |
| GET | `/api/sellers/applications/:id/identity-document` | Admin |
| PUT | `/api/sellers/me/profile` | Seller |
| GET | `/api/sellers/me/wallet` | Seller |
| POST | `/api/sellers/me/payouts` | Seller |
| PATCH | `/api/sellers/:id/status` | Admin |
| POST | `/api/support/requests` | Public |
| GET | `/api/support/requests` | Admin |
| PATCH | `/api/support/requests/:id/status` | Admin |
| GET | `/api/wishlist` | Customer |
| POST | `/api/wishlist/:productId` | Customer |
| DELETE | `/api/wishlist/:productId` | Customer |