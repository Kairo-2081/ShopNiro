# Entity relationships

```mermaid
erDiagram
    customers ||--o{ orders : places
    customers ||--o{ cart : has
    customers ||--o{ reviews : writes
    customers ||--o{ customer_wishlist : saves
    categories ||--o{ products : groups
    sellers ||--o{ products : lists
    sellers ||--o{ seller_documents : uploads
    sellers ||--o{ seller_fulfillments : ships
    sellers ||--o{ seller_wallet_entries : earns
    sellers ||--o{ seller_payouts : requests
    orders ||--o{ order_items : contains
    products o|--o{ order_items : "sold as"
    orders ||--o{ seller_fulfillments : "split into"
    seller_fulfillments ||--o| rider_deliveries : "delivery record"
    riders o|--o{ rider_deliveries : takes
    riders ||--o{ rider_wallet_entries : earns
    rider_deliveries ||--o{ rider_reviews : receives
    orders ||..o{ payments : "application reference; no foreign key"
    payments o|--o{ refunds : "refunded by"
    orders ||--o{ refunds : has
```

`payments.order_id` is intentionally not a foreign key. A delivery references one fulfillment through a unique, non-null `fulfillment_id`, so each fulfillment has at most one delivery record. Wallet and payout rows reference their owning seller or rider; the diagram omits non-FK reference IDs.