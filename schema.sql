-- Data-preserving application schema with legacy normalization migrations. Demo data is seeded separately with hashed passwords.

-- USERS TABLE (Global Authentication & Identity)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'customer', -- 'customer', 'seller', 'admin'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    number VARCHAR(50),
    address_house_name VARCHAR(255),
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_postal_code VARCHAR(50),
    address_additional_info TEXT,
    address_latitude DOUBLE PRECISION,
    address_longitude DOUBLE PRECISION,
    marketing_consent_at TIMESTAMP WITH TIME ZONE,
    welcome_offer_email_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_latitude DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_longitude DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS welcome_offer_email_sent_at TIMESTAMP WITH TIME ZONE;

-- SELLERS / VENDORS TABLE
CREATE TABLE IF NOT EXISTS sellers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    number VARCHAR(50),
    logo TEXT,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'approved', -- 'pending', 'approved', 'rejected', 'suspended'
    address_house_name VARCHAR(255),
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_postal_code VARCHAR(50),
    address_additional_info TEXT,
    address_latitude DOUBLE PRECISION,
    address_longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_latitude DOUBLE PRECISION;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_longitude DOUBLE PRECISION;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_registration_number VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_method VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS payout_account VARCHAR(255) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS seller_verification_documents (
    id VARCHAR(64) PRIMARY KEY,
    seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    document_type VARCHAR(32) NOT NULL CHECK (document_type IN ('identity', 'business_registration')),
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    document_data BYTEA NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (seller_id, document_type)
);

-- DELIVERY RIDERS. Applicants remain pending until an admin approves their account.
CREATE TABLE IF NOT EXISTS riders (
    id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    number VARCHAR(50) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    present_address_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    permanent_address_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    has_cv BOOLEAN NOT NULL DEFAULT FALSE,
    cv_file_name VARCHAR(255),
    cv_pdf BYTEA,
    profile_image TEXT,
    profile_image_file_name VARCHAR(255),
    experience_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    previous_jobs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    education_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    timely_deliveries INTEGER NOT NULL DEFAULT 0,
    late_deliveries INTEGER NOT NULL DEFAULT 0,
    performance_points INTEGER NOT NULL DEFAULT 100,
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_riders_status CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    CONSTRAINT chk_riders_points CHECK (performance_points BETWEEN 0 AND 100)
);

ALTER TABLE riders ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE riders ADD COLUMN IF NOT EXISTS profile_image_file_name VARCHAR(255);

CREATE TABLE IF NOT EXISTS rider_verification_documents (
    id VARCHAR(64) PRIMARY KEY,
    rider_id VARCHAR(64) NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    document_type VARCHAR(24) NOT NULL CHECK (document_type IN ('identity', 'license')),
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    document_data BYTEA NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (rider_id, document_type)
);

CREATE TABLE IF NOT EXISTS application_review_audit (
    id VARCHAR(64) PRIMARY KEY,
    account_type VARCHAR(16) NOT NULL CHECK (account_type IN ('seller', 'rider')),
    account_id VARCHAR(64) NOT NULL,
    admin_id VARCHAR(64) NOT NULL REFERENCES users(id),
    decision VARCHAR(16) NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_application_review_account ON application_review_audit(account_type, account_id, created_at DESC);

-- ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    number VARCHAR(50),
    address_house_name VARCHAR(255),
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_postal_code VARCHAR(50),
    address_additional_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image TEXT,
    description TEXT,
    warranty_information TEXT NOT NULL DEFAULT '',
    return_policy TEXT NOT NULL DEFAULT '',
    size_gender VARCHAR(16),
    sizes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    size_chart_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    images_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    highlights_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    price NUMERIC(10, 2) NOT NULL,
    voucher VARCHAR(50) DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0,
    product_status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'deactivated'
    category_id VARCHAR(64) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS size_gender VARCHAR(16);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_chart_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS highlights_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_information TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_policy TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS voucher_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_deal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS seller_bundles (
    id VARCHAR(64) PRIMARY KEY,
    seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    product_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 50),
    ends_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_bundles_active ON seller_bundles(active, ends_at);

CREATE TABLE IF NOT EXISTS product_analytics_events (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('impression', 'click')),
    session_id VARCHAR(64) NOT NULL,
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_analytics_daily UNIQUE (product_id, event_type, session_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_product_analytics_date_product ON product_analytics_events(event_date, product_id);

-- CART ITEMS TABLE
CREATE TABLE IF NOT EXISTS cart (
    id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    size VARCHAR(20) NOT NULL DEFAULT ''
);

ALTER TABLE cart ADD COLUMN IF NOT EXISTS size VARCHAR(20) NOT NULL DEFAULT '';

-- ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    tracking_id VARCHAR(100) NOT NULL UNIQUE,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    items_json TEXT NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'placed', -- 'placed', 'processing', 'shipped', 'delivered', 'cancelled'
    shipping_address_json TEXT NOT NULL,
    billing_address_json TEXT NOT NULL,
    additional_info TEXT NOT NULL DEFAULT '',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(32) NOT NULL DEFAULT 'unknown',
    transaction_id VARCHAR(100),
    applied_voucher VARCHAR(100) NOT NULL DEFAULT '',
    order_placed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'unknown';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_voucher VARCHAR(100) NOT NULL DEFAULT '';

-- Split each marketplace checkout into seller-owned fulfillment orders.
CREATE TABLE IF NOT EXISTS seller_fulfillments (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'processing',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_seller_fulfillment_order_seller UNIQUE (order_id, seller_id),
    CONSTRAINT chk_seller_fulfillment_status CHECK (status IN ('processing', 'shipped', 'delivered', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS rider_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    fulfillment_id VARCHAR(64) NOT NULL UNIQUE REFERENCES seller_fulfillments(id) ON DELETE CASCADE,
    rider_id VARCHAR(64) REFERENCES riders(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    confirmation_code VARCHAR(12) NOT NULL,
    confirmation_attempts INTEGER NOT NULL DEFAULT 0,
    cod_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cod_collected BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    was_timely BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    CONSTRAINT chk_rider_delivery_status CHECK (status IN ('pending', 'accepted', 'on_the_way', 'delivered', 'cancelled'))
);

ALTER TABLE rider_deliveries ADD COLUMN IF NOT EXISTS confirmation_attempts INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rider_reviews (
    id VARCHAR(64) PRIMARY KEY,
    delivery_id VARCHAR(64) NOT NULL UNIQUE REFERENCES rider_deliveries(id) ON DELETE CASCADE,
    rider_id VARCHAR(64) NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL DEFAULT '',
    was_timely BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rider_monthly_scores (
    rider_id VARCHAR(64) NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    performance_points INTEGER NOT NULL DEFAULT 100 CHECK (performance_points BETWEEN 0 AND 100),
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    timely_deliveries INTEGER NOT NULL DEFAULT 0,
    late_deliveries INTEGER NOT NULL DEFAULT 0,
    salary_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    salary_base_amount NUMERIC(12, 2),
    delivery_pay_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    perfect_month_bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cod_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
    salary_available_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rider_id, month_start)
);

ALTER TABLE rider_monthly_scores ADD COLUMN IF NOT EXISTS cod_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE rider_monthly_scores ADD COLUMN IF NOT EXISTS salary_base_amount NUMERIC(12, 2);
ALTER TABLE rider_monthly_scores ADD COLUMN IF NOT EXISTS delivery_pay_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE rider_monthly_scores ADD COLUMN IF NOT EXISTS perfect_month_bonus NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rider_wallet_entries (
    id VARCHAR(64) PRIMARY KEY,
    rider_id VARCHAR(64) NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    reference_id VARCHAR(100),
    description TEXT NOT NULL DEFAULT '',
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rider_wallet_reference UNIQUE (rider_id, entry_type, reference_id)
);

WITH legacy_debits AS (
    SELECT entry.rider_id, entry.reference_id, -entry.amount AS amount
    FROM rider_wallet_entries entry
        WHERE entry.entry_type IN ('salary_debit', 'cod_remittance')
            AND entry.amount < 0 AND entry.reference_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM rider_wallet_entries reversal
          WHERE reversal.rider_id = entry.rider_id
            AND reversal.entry_type = 'cod_balance_restored'
            AND reversal.reference_id = entry.reference_id
      )
), restored AS (
    INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description)
    SELECT 'CDR-' || md5(legacy.rider_id || ':' || legacy.reference_id), legacy.rider_id,
        'cod_balance_restored', legacy.amount, legacy.reference_id,
        'Previous COD debit restored from available wallet and moved to pending salary deduction'
    FROM legacy_debits legacy
    ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING
    RETURNING rider_id, amount
), totals AS (
    SELECT rider_id, SUM(amount) AS amount FROM restored GROUP BY rider_id
)
UPDATE riders rider SET wallet_balance = rider.wallet_balance + totals.amount, updated_at = CURRENT_TIMESTAMP
FROM totals WHERE rider.id = totals.rider_id;

WITH cod_totals AS (
    SELECT entry.rider_id, date_trunc('month', delivery.delivered_at)::date AS month_start,
        SUM(-entry.amount) AS amount
    FROM rider_wallet_entries entry
    JOIN rider_deliveries delivery ON delivery.id = entry.reference_id
    WHERE entry.entry_type IN ('salary_debit', 'cod_remittance', 'cod_salary_debit')
      AND entry.amount < 0 AND delivery.delivered_at IS NOT NULL
    GROUP BY entry.rider_id, date_trunc('month', delivery.delivered_at)::date
)
UPDATE rider_monthly_scores score
SET salary_amount = score.salary_amount + score.cod_deductions - cod_totals.amount,
    cod_deductions = cod_totals.amount
FROM cod_totals
WHERE score.rider_id = cod_totals.rider_id
  AND score.month_start = cod_totals.month_start
  AND score.cod_deductions IS DISTINCT FROM cod_totals.amount;

CREATE TABLE IF NOT EXISTS seller_wallet_entries (
    id VARCHAR(64) PRIMARY KEY,
    seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    entry_type VARCHAR(32) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    reference_id VARCHAR(100),
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_seller_wallet_reference UNIQUE (seller_id, entry_type, reference_id)
);

CREATE TABLE IF NOT EXISTS rider_withdrawals (
    id VARCHAR(64) PRIMARY KEY,
    rider_id VARCHAR(64) NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payout_method VARCHAR(32) NOT NULL,
    payout_account VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_rider_withdrawal_status CHECK (status IN ('pending', 'paid', 'rejected'))
);

-- Bridge between orders and products; line fields preserve the purchased snapshot.
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
    seller_id VARCHAR(64) REFERENCES sellers(id) ON DELETE SET NULL,
    product_id_snapshot VARCHAR(64) NOT NULL,
    seller_id_snapshot VARCHAR(64) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    image TEXT,
    size VARCHAR(20) NOT NULL DEFAULT '',
    CONSTRAINT uq_order_items_order_product_size UNIQUE (order_id, product_id_snapshot, size)
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(20) NOT NULL DEFAULT '';
UPDATE order_items SET size = '' WHERE size IS NULL;
ALTER TABLE order_items ALTER COLUMN size SET DEFAULT '';
ALTER TABLE order_items ALTER COLUMN size SET NOT NULL;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS uq_order_items_order_product;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS uq_order_items_order_product_size;
ALTER TABLE order_items ADD CONSTRAINT uq_order_items_order_product_size UNIQUE (order_id, product_id_snapshot, size);

INSERT INTO seller_fulfillments (id, order_id, seller_id, items_json, subtotal, status, shipped_at, delivered_at)
SELECT
    'FUL-' || substr(md5(oi.order_id || ':' || oi.seller_id_snapshot), 1, 20),
    oi.order_id,
    oi.seller_id_snapshot,
    jsonb_agg(jsonb_build_object(
        'Product_ID', oi.product_id_snapshot,
        'Name', oi.product_name,
        'Price', oi.unit_price,
        'Quantity', oi.quantity,
        'Image', COALESCE(oi.image, ''),
        'Size', oi.size,
        'Seller_ID', oi.seller_id_snapshot
    ) ORDER BY oi.order_item_id),
    SUM(oi.unit_price * oi.quantity),
    CASE WHEN o.status = 'delivered' THEN 'delivered' WHEN o.status = 'shipped' THEN 'shipped' ELSE 'processing' END,
    CASE WHEN o.status IN ('shipped', 'delivered') THEN o.order_placed_at ELSE NULL END,
    CASE WHEN o.status = 'delivered' THEN o.order_placed_at ELSE NULL END
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
GROUP BY oi.order_id, oi.seller_id_snapshot, o.status, o.order_placed_at
ON CONFLICT (order_id, seller_id) DO NOTHING;

INSERT INTO rider_deliveries (id, fulfillment_id, status, confirmation_code)
SELECT
    'DLV-' || substr(md5(sf.id), 1, 24),
    sf.id,
    'pending',
    lpad(floor(random() * 1000000)::int::text, 6, '0')
FROM seller_fulfillments sf
WHERE sf.status = 'shipped'
ON CONFLICT (fulfillment_id) DO NOTHING;

UPDATE rider_deliveries rd
SET cod_amount = ROUND(sf.subtotal + CASE
            WHEN o.subtotal > 0 THEN o.shipping_fee * sf.subtotal / o.subtotal
            ELSE 0
        END, 2),
        cod_collected = CASE WHEN rd.status = 'delivered' THEN TRUE ELSE rd.cod_collected END
FROM seller_fulfillments sf
JOIN orders o ON o.id = sf.order_id
WHERE rd.fulfillment_id = sf.id
    AND o.payment_method = 'cash_on_delivery'
    AND (rd.cod_amount = 0 OR (rd.status = 'delivered' AND NOT rd.cod_collected));

INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description, available_at)
SELECT 'COD-' || substr(md5(rd.id), 1, 24), rd.rider_id, 'cod_collected', rd.cod_amount, rd.id,
    'ADDED DIRECTLY TO WALLET - COD for order ' || sf.order_id || '; locked until month-end',
    date_trunc('month', rd.delivered_at)::date + INTERVAL '1 month'
FROM rider_deliveries rd
JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
JOIN orders o ON o.id = sf.order_id
WHERE rd.status = 'delivered' AND rd.cod_collected AND rd.cod_amount > 0
    AND o.payment_method = 'cash_on_delivery' AND rd.rider_id IS NOT NULL
ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING;

UPDATE rider_wallet_entries entry
SET description = 'ADDED DIRECTLY TO WALLET - COD for order ' || sf.order_id || '; locked until month-end'
FROM rider_deliveries rd
JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
JOIN orders o ON o.id = sf.order_id
WHERE entry.entry_type = 'cod_collected' AND entry.reference_id = rd.id
    AND o.payment_method = 'cash_on_delivery';

UPDATE rider_wallet_entries entry
SET available_at = date_trunc('month', delivery.delivered_at)::date + INTERVAL '1 month'
FROM rider_deliveries delivery
JOIN seller_fulfillments fulfillment ON fulfillment.id = delivery.fulfillment_id
JOIN orders o ON o.id = fulfillment.order_id
WHERE entry.entry_type = 'cod_collected' AND entry.reference_id = delivery.id
    AND o.payment_method = 'cash_on_delivery' AND delivery.delivered_at IS NOT NULL;

WITH credited AS (
        INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description, available_at)
        SELECT 'WBC-' || substr(md5(entry.rider_id || ':' || entry.reference_id), 1, 24),
                entry.rider_id, 'cod_wallet_balance', entry.amount, entry.reference_id,
                'COD credited to wallet; locked until month-end', entry.available_at
        FROM rider_wallet_entries entry
        WHERE entry.entry_type = 'cod_collected'
            AND NOT EXISTS (
                    SELECT 1 FROM rider_wallet_entries marker
                    WHERE marker.rider_id = entry.rider_id
                        AND marker.entry_type = 'cod_wallet_balance'
                        AND marker.reference_id = entry.reference_id
            )
        ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING
        RETURNING rider_id, amount
), totals AS (
        SELECT rider_id, SUM(amount) AS amount FROM credited GROUP BY rider_id
)
UPDATE riders rider SET wallet_balance = rider.wallet_balance + totals.amount, updated_at = CURRENT_TIMESTAMP
FROM totals WHERE rider.id = totals.rider_id;

INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description)
SELECT 'REM-' || substr(md5(rd.id), 1, 24), rd.rider_id, 'cod_salary_debit', -rd.cod_amount, rd.id,
        'COD deducted from monthly salary and remitted to seller for order ' || sf.order_id
FROM rider_deliveries rd
JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
JOIN orders o ON o.id = sf.order_id
WHERE rd.status = 'delivered' AND rd.cod_collected AND rd.cod_amount > 0
    AND o.payment_method = 'cash_on_delivery' AND rd.rider_id IS NOT NULL
    AND NOT EXISTS (
            SELECT 1 FROM rider_wallet_entries entry
            WHERE entry.rider_id = rd.rider_id AND entry.reference_id = rd.id
                AND entry.entry_type IN ('salary_debit', 'cod_remittance', 'cod_salary_debit')
    )
ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING;

INSERT INTO seller_wallet_entries (id, seller_id, entry_type, amount, reference_id, description)
SELECT 'VCO-' || RIGHT(sf.id, 24), sf.seller_id, 'cod_received', rd.cod_amount, rd.id,
        'Cash-on-delivery remittance for order ' || sf.order_id
FROM rider_deliveries rd
JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
JOIN orders o ON o.id = sf.order_id
WHERE rd.status = 'delivered' AND rd.cod_collected AND rd.cod_amount > 0
    AND o.payment_method = 'cash_on_delivery'
ON CONFLICT (seller_id, entry_type, reference_id) DO NOTHING;

WITH monthly_totals AS (
        SELECT rd.rider_id, date_trunc('month', rd.delivered_at)::date AS month_start,
                COUNT(*)::integer AS total_deliveries,
                COUNT(*) FILTER (WHERE COALESCE(rd.was_timely, rd.delivered_at <= rd.due_at, FALSE))::integer AS timely_deliveries,
                COUNT(*) FILTER (WHERE NOT COALESCE(rd.was_timely, rd.delivered_at <= rd.due_at, FALSE))::integer AS late_deliveries,
                SUM(rd.cod_amount) FILTER (WHERE rd.cod_collected AND rd.cod_amount > 0) AS cod_deductions
        FROM rider_deliveries rd
        WHERE rd.status = 'delivered' AND rd.rider_id IS NOT NULL AND rd.delivered_at IS NOT NULL
                    AND (
                        date_trunc('month', rd.delivered_at) >= date_trunc('month', CURRENT_DATE)
                        OR NOT EXISTS (
                            SELECT 1 FROM rider_wallet_entries paid
                            WHERE paid.rider_id = rd.rider_id AND paid.entry_type = 'salary'
                                AND paid.reference_id = to_char(date_trunc('month', rd.delivered_at), 'YYYY-MM')
                        )
                    )
        GROUP BY rd.rider_id, date_trunc('month', rd.delivered_at)::date
), previous_salary AS (
                SELECT monthly_totals.*,
                    COALESCE(score.performance_points, 100) AS previous_points,
                    COALESCE(score.salary_base_amount,
                        NULLIF(score.salary_amount + score.cod_deductions - score.delivery_pay_amount - score.perfect_month_bonus, 0),
                        30000) AS previous_salary_base
                FROM monthly_totals
                LEFT JOIN rider_monthly_scores score
                    ON score.rider_id = monthly_totals.rider_id AND score.month_start = monthly_totals.month_start
), monthly_points AS (
                SELECT previous_salary.*,
                    GREATEST(0, 100 - LEAST(late_deliveries, 5) - GREATEST(late_deliveries - 5, 0) * 6) AS points
                FROM previous_salary
)
INSERT INTO rider_monthly_scores (
        rider_id, month_start, performance_points, total_deliveries, timely_deliveries,
                late_deliveries, salary_amount, salary_base_amount, delivery_pay_amount,
                perfect_month_bonus, cod_deductions, salary_available_at
)
SELECT rider_id, month_start, points, total_deliveries, timely_deliveries, late_deliveries,
                GREATEST(0, ROUND(previous_salary_base * (1 + (points - previous_points) / 100.0) +
                    total_deliveries * 50 + CASE WHEN total_deliveries > 0 AND late_deliveries = 0 THEN 10000 ELSE 0 END -
                    COALESCE(cod_deductions, 0), 2)),
                ROUND(previous_salary_base * (1 + (points - previous_points) / 100.0), 2),
                total_deliveries * 50,
                CASE WHEN total_deliveries > 0 AND late_deliveries = 0 THEN 10000 ELSE 0 END,
                COALESCE(cod_deductions, 0), month_start + INTERVAL '1 month 29 days'
FROM monthly_points
ON CONFLICT (rider_id, month_start) DO UPDATE SET
        performance_points = EXCLUDED.performance_points,
        total_deliveries = EXCLUDED.total_deliveries,
        timely_deliveries = EXCLUDED.timely_deliveries,
        late_deliveries = EXCLUDED.late_deliveries,
        salary_amount = EXCLUDED.salary_amount,
        salary_base_amount = EXCLUDED.salary_base_amount,
        delivery_pay_amount = EXCLUDED.delivery_pay_amount,
        perfect_month_bonus = EXCLUDED.perfect_month_bonus,
        cod_deductions = EXCLUDED.cod_deductions,
        salary_available_at = EXCLUDED.salary_available_at;

-- PRODUCT REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    review_text TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENTS TABLE (SSLCommerz & bKash Transactions)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64),
    customer_id VARCHAR(64),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    gateway VARCHAR(32) NOT NULL DEFAULT 'sslcommerz',
    payment_method VARCHAR(32) NOT NULL,
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    bank_tran_id VARCHAR(100),
    val_id VARCHAR(100),
    card_type VARCHAR(50),
    card_brand VARCHAR(50),
    card_issuer VARCHAR(100),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    customer_phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS refunds (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL UNIQUE REFERENCES orders(id),
    payment_id VARCHAR(64) REFERENCES payments(id),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    method VARCHAR(24) NOT NULL CHECK (method IN ('sslcommerz', 'manual_cash')),
    status VARCHAR(16) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'submitted', 'completed', 'failed')),
    gateway_ref VARCHAR(100),
    processed_by VARCHAR(64) REFERENCES users(id),
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Upgrade old deployments: copy profile credentials into users, then remove duplicate columns.
DO $$
BEGIN
    IF to_regclass('public.auth_sessions') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.auth_sessions'::regclass
              AND conname = 'auth_sessions_user_id_fkey'
        ) THEN
            ALTER TABLE auth_sessions DROP CONSTRAINT auth_sessions_user_id_fkey;
        END IF;
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.auth_sessions'::regclass
              AND conname = 'fk_auth_sessions_user'
              AND confupdtype <> 'c'
        ) THEN
            ALTER TABLE auth_sessions DROP CONSTRAINT fk_auth_sessions_user;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'entity_id') THEN
        UPDATE users u
        SET id = u.entity_id
        WHERE u.entity_id IS NOT NULL
            AND u.id <> u.entity_id
            AND NOT EXISTS (SELECT 1 FROM users other WHERE other.id = u.entity_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'username') THEN
        INSERT INTO users (id, username, password, email, role, created_at)
        SELECT c.id, c.username, c.password, c.email, 'customer', COALESCE(c.created_at, CURRENT_TIMESTAMP)
        FROM customers c
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.id)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'username') THEN
        INSERT INTO users (id, username, password, email, role, created_at)
        SELECT s.id, s.username, s.password, s.email, 'seller', COALESCE(s.created_at, CURRENT_TIMESTAMP)
        FROM sellers s
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.id)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'username') THEN
        INSERT INTO users (id, username, password, email, role, created_at)
        SELECT a.id, a.username, a.password, a.email, 'admin', COALESCE(a.created_at, CURRENT_TIMESTAMP)
        FROM admins a
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.id)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'entity_id') THEN
        ALTER TABLE users DROP COLUMN entity_id;
    END IF;
END;
$$;

-- Profile rows must match the immutable role recorded in the canonical user row.
CREATE OR REPLACE FUNCTION enforce_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_role VARCHAR(32);
    account_role VARCHAR(32);
BEGIN
    expected_role := CASE TG_TABLE_NAME
        WHEN 'customers' THEN 'customer'
        WHEN 'sellers' THEN 'seller'
        WHEN 'admins' THEN 'admin'
    END;
    SELECT role INTO account_role FROM users WHERE id = NEW.id;
    IF account_role IS NULL OR account_role <> expected_role THEN
        RAISE EXCEPTION 'Profile role mismatch for account %: expected %, found %', NEW.id, expected_role, account_role;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_customers_profile_role ON customers;
CREATE TRIGGER trigger_customers_profile_role BEFORE INSERT OR UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION enforce_profile_role();
DROP TRIGGER IF EXISTS trigger_sellers_profile_role ON sellers;
CREATE TRIGGER trigger_sellers_profile_role BEFORE INSERT OR UPDATE ON sellers
FOR EACH ROW EXECUTE FUNCTION enforce_profile_role();
DROP TRIGGER IF EXISTS trigger_admins_profile_role ON admins;
CREATE TRIGGER trigger_admins_profile_role BEFORE INSERT OR UPDATE ON admins
FOR EACH ROW EXECUTE FUNCTION enforce_profile_role();

CREATE OR REPLACE FUNCTION prevent_user_role_change_with_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND (
        EXISTS (SELECT 1 FROM customers WHERE id = OLD.id) OR
        EXISTS (SELECT 1 FROM sellers WHERE id = OLD.id) OR
        EXISTS (SELECT 1 FROM admins WHERE id = OLD.id)
    ) THEN
        RAISE EXCEPTION 'Account role cannot change while its role profile exists.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_user_role_change ON users;
CREATE TRIGGER trigger_prevent_user_role_change BEFORE UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION prevent_user_role_change_with_profile();

UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
ALTER TABLE users ALTER COLUMN created_at SET NOT NULL;
UPDATE customers SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
ALTER TABLE customers ALTER COLUMN created_at SET NOT NULL;
UPDATE sellers SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
ALTER TABLE sellers ALTER COLUMN created_at SET NOT NULL;
UPDATE admins SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
ALTER TABLE admins ALTER COLUMN created_at SET NOT NULL;
UPDATE products SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
ALTER TABLE products ALTER COLUMN created_at SET NOT NULL;
UPDATE orders SET order_placed_at = CURRENT_TIMESTAMP WHERE order_placed_at IS NULL;
ALTER TABLE orders ALTER COLUMN order_placed_at SET NOT NULL;
UPDATE orders SET shipping_address_json = '{}' WHERE shipping_address_json IS NULL;
UPDATE orders SET billing_address_json = COALESCE(shipping_address_json, '{}') WHERE billing_address_json IS NULL;
UPDATE orders SET additional_info = '' WHERE additional_info IS NULL;
ALTER TABLE orders ALTER COLUMN shipping_address_json SET NOT NULL;
ALTER TABLE orders ALTER COLUMN billing_address_json SET NOT NULL;
ALTER TABLE orders ALTER COLUMN additional_info SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN additional_info SET NOT NULL;
UPDATE reviews SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
ALTER TABLE reviews ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE customers DROP COLUMN IF EXISTS username CASCADE, DROP COLUMN IF EXISTS email CASCADE, DROP COLUMN IF EXISTS password CASCADE;
ALTER TABLE sellers DROP COLUMN IF EXISTS username CASCADE, DROP COLUMN IF EXISTS email CASCADE, DROP COLUMN IF EXISTS password CASCADE;
ALTER TABLE admins DROP COLUMN IF EXISTS username CASCADE, DROP COLUMN IF EXISTS email CASCADE, DROP COLUMN IF EXISTS password CASCADE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_customers_user') THEN
        ALTER TABLE customers ADD CONSTRAINT fk_customers_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sellers_user') THEN
        ALTER TABLE sellers ADD CONSTRAINT fk_sellers_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_admins_user') THEN
        ALTER TABLE admins ADD CONSTRAINT fk_admins_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END;
$$;

-- Backfill normalized order lines from the previous JSON representation.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'items_json') THEN
        INSERT INTO order_items (order_id, product_id, seller_id, product_id_snapshot, seller_id_snapshot, product_name, unit_price, quantity, image, size)
        SELECT o.id,
                CASE WHEN EXISTS (SELECT 1 FROM products p WHERE p.id = item.value->>'Product_ID')
                    THEN NULLIF(item.value->>'Product_ID', '') END,
                CASE WHEN EXISTS (SELECT 1 FROM sellers s WHERE s.id = item.value->>'Seller_ID')
                    THEN NULLIF(item.value->>'Seller_ID', '') END,
                COALESCE(NULLIF(item.value->>'Product_ID', ''), 'deleted-product'),
                COALESCE(NULLIF(item.value->>'Seller_ID', ''), 'deleted-seller'),
               COALESCE(item.value->>'Name', 'Archived product'),
               COALESCE((item.value->>'Price')::NUMERIC, 0),
               GREATEST(COALESCE((item.value->>'Quantity')::INTEGER, 1), 1),
                             NULLIF(item.value->>'Image', ''),
                             COALESCE(item.value->>'Size', '')
        FROM orders o
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(NULLIF(o.items_json, '')::JSONB, '[]'::JSONB)) AS item(value)
         ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

-- Remove legacy cached review pointer
DROP TRIGGER IF EXISTS trg_update_product_review_id ON reviews;
DROP FUNCTION IF EXISTS update_product_review_id();
ALTER TABLE products DROP COLUMN IF EXISTS review_id;

-- 3. INDEXES FOR COMMON LOOKUPS AND FILTERS
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users(LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name_lower ON categories(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_seller_status ON products(seller_id, product_status);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(product_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_placed ON orders(customer_id, order_placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_placed ON orders(order_placed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON reviews(product_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_cart_customer ON cart(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_seller ON order_items(order_id, seller_id_snapshot);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_snapshot ON order_items(product_id_snapshot);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_snapshot ON order_items(seller_id_snapshot);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(created_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_riders_status_created ON riders(status, created_at DESC, id DESC);

-- 4. FOREIGN KEY & DATA CONSTRAINTS

-- USERS TABLE CONSTRAINTS
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_role,
    ADD CONSTRAINT chk_users_role CHECK (role IN ('customer', 'seller', 'admin', 'rider'));

-- SELLERS TABLE CONSTRAINTS
ALTER TABLE sellers
    DROP CONSTRAINT IF EXISTS chk_sellers_status,
    ADD CONSTRAINT chk_sellers_status CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

-- PRODUCTS TABLE CONSTRAINTS
ALTER TABLE products
    DROP CONSTRAINT IF EXISTS chk_products_price,
    DROP CONSTRAINT IF EXISTS chk_products_stock,
    DROP CONSTRAINT IF EXISTS chk_products_status,
    DROP CONSTRAINT IF EXISTS fk_products_review,
    ADD CONSTRAINT chk_products_price CHECK (price >= 0),
    ADD CONSTRAINT chk_products_stock CHECK (stock >= 0),
    ADD CONSTRAINT chk_products_status CHECK (product_status IN ('active', 'inactive', 'deactivated'));

-- CART TABLE CONSTRAINTS
ALTER TABLE cart
    DROP CONSTRAINT IF EXISTS chk_cart_quantity,
    DROP CONSTRAINT IF EXISTS uq_cart_customer_product,
    DROP CONSTRAINT IF EXISTS uq_cart_customer_product_size,
    ADD CONSTRAINT chk_cart_quantity CHECK (quantity > 0),
    ADD CONSTRAINT uq_cart_customer_product_size UNIQUE (customer_id, product_id, size);

-- ORDERS TABLE CONSTRAINTS
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS chk_orders_subtotal,
    DROP CONSTRAINT IF EXISTS chk_orders_shipping_fee,
    DROP CONSTRAINT IF EXISTS chk_orders_status,
    ADD CONSTRAINT chk_orders_subtotal CHECK (subtotal >= 0),
    ADD CONSTRAINT chk_orders_shipping_fee CHECK (shipping_fee >= 0),
    ADD CONSTRAINT chk_orders_status CHECK (status IN ('placed', 'processing', 'shipped', 'delivered', 'cancelled'));

-- REVIEWS TABLE CONSTRAINTS
ALTER TABLE reviews
    DROP CONSTRAINT IF EXISTS chk_reviews_rating,
    DROP CONSTRAINT IF EXISTS uq_reviews_product_customer,
    ADD CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_email') THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key') THEN
        ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_tracking_id_key') THEN
        UPDATE orders SET tracking_id = 'TRK-LEGACY-' || id WHERE tracking_id IS NULL OR tracking_id = '';
        ALTER TABLE orders ALTER COLUMN tracking_id SET NOT NULL;
        ALTER TABLE orders ADD CONSTRAINT orders_tracking_id_key UNIQUE (tracking_id);
    END IF;
END;
$$;

-- Record seller status transitions for administrative auditing.
CREATE TABLE IF NOT EXISTS seller_status_audit (
    audit_id SERIAL PRIMARY KEY,
    seller_id VARCHAR(64) NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    old_status VARCHAR(32),
    new_status VARCHAR(32),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

UPDATE seller_status_audit SET changed_at = CURRENT_TIMESTAMP WHERE changed_at IS NULL;
ALTER TABLE seller_status_audit ALTER COLUMN changed_at SET NOT NULL;

CREATE OR REPLACE FUNCTION log_seller_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO seller_status_audit (seller_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seller_status_change ON sellers;
CREATE TRIGGER trigger_seller_status_change
AFTER UPDATE ON sellers
FOR EACH ROW
EXECUTE FUNCTION log_seller_status_change();

-- Record order status transitions for administrative auditing.
CREATE TABLE IF NOT EXISTS order_status_audit (
    audit_id SERIAL PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(32),
    new_status VARCHAR(32),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

UPDATE order_status_audit SET changed_at = CURRENT_TIMESTAMP WHERE changed_at IS NULL;
ALTER TABLE order_status_audit ALTER COLUMN changed_at SET NOT NULL;

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_audit (order_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_status_change ON orders;
CREATE TRIGGER trigger_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION log_order_status_change();

-- Serialize cart changes per customer and prevent quantities above inventory.
CREATE OR REPLACE FUNCTION check_cart_stock()
RETURNS TRIGGER AS $$
DECLARE
    available_stock INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(OLD.customer_id, 0));
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
        RAISE EXCEPTION 'Cannot change the owner of a cart item.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.customer_id, 0));
    SELECT stock INTO available_stock FROM products WHERE id = NEW.product_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory Error: Product % does not exist.', NEW.product_id;
    END IF;

    IF NEW.quantity IS NULL OR NEW.quantity > COALESCE(available_stock, 0) THEN
        RAISE EXCEPTION 'Inventory Error: Cannot add % units. Only % units available.', NEW.quantity, COALESCE(available_stock, 0);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_cart_stock ON cart;
CREATE TRIGGER trigger_check_cart_stock
BEFORE INSERT OR UPDATE OR DELETE ON cart
FOR EACH ROW
EXECUTE FUNCTION check_cart_stock();

-- Reject product writes for sellers who are suspended or rejected.
CREATE OR REPLACE FUNCTION enforce_seller_status_on_product()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_status VARCHAR(32);
BEGIN
    SELECT status INTO v_seller_status FROM sellers WHERE id = NEW.seller_id;

    IF v_seller_status IS NULL OR v_seller_status IN ('suspended', 'rejected') THEN
        RAISE EXCEPTION 'Data Validation Failed: Cannot insert or update product. Seller % is currently %.', NEW.seller_id, v_seller_status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_product_seller ON products;
DROP FUNCTION IF EXISTS validate_product_seller();
DROP TRIGGER IF EXISTS trigger_enforce_seller_status ON products;
CREATE TRIGGER trigger_enforce_seller_status
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION enforce_seller_status_on_product();

-- Validate and lock the cart, create the order, decrement inventory, and empty the cart atomically.
CREATE OR REPLACE PROCEDURE process_checkout(
    p_order_id VARCHAR,
    p_tracking_id VARCHAR,
    p_customer_id VARCHAR,
    p_shipping_fee NUMERIC,
    p_shipping_address TEXT,
    p_billing_address TEXT,
    p_additional_info TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cart_count INTEGER;
    v_subtotal NUMERIC(10, 2);
    v_items_json TEXT;
    v_product_name TEXT;
    v_requested_quantity INTEGER;
    v_available_stock INTEGER;
BEGIN
    IF p_customer_id IS NULL OR p_shipping_fee IS NULL OR p_shipping_fee < 0 THEN
        RAISE EXCEPTION 'Checkout Failed: Customer and a non-negative shipping fee are required.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id, 0));

    SELECT COUNT(*) INTO v_cart_count
    FROM cart
    WHERE customer_id = p_customer_id;

    IF v_cart_count = 0 THEN
        RAISE EXCEPTION 'Checkout Failed: The shopping cart is empty.';
    END IF;

    PERFORM c.id
    FROM cart c
    WHERE c.customer_id = p_customer_id
    ORDER BY c.id
    FOR UPDATE;

    PERFORM p.id
    FROM products p
    JOIN cart c ON c.product_id = p.id
    WHERE c.customer_id = p_customer_id
    ORDER BY p.id
    FOR UPDATE OF p;

    SELECT p.name INTO v_product_name
    FROM cart c
    JOIN products p ON p.id = c.product_id
    JOIN sellers s ON s.id = p.seller_id
    WHERE c.customer_id = p_customer_id
      AND (p.product_status <> 'active' OR s.status IN ('suspended', 'rejected'))
    ORDER BY c.id
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Checkout Failed: Product % is no longer available.', v_product_name;
    END IF;

    SELECT p.name, c.quantity, p.stock
    INTO v_product_name, v_requested_quantity, v_available_stock
    FROM cart c
    JOIN products p ON p.id = c.product_id
    WHERE c.customer_id = p_customer_id
      AND c.quantity > p.stock
    ORDER BY c.id
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Checkout Failed: Insufficient stock for %. Requested %, available %.',
            v_product_name, v_requested_quantity, v_available_stock;
    END IF;

    SELECT COALESCE(SUM(c.quantity * p.price), 0.00)
    INTO v_subtotal
    FROM cart c
    JOIN products p ON p.id = c.product_id
    WHERE c.customer_id = p_customer_id;

    SELECT COALESCE(json_agg(json_build_object(
        'Product_ID', p.id,
        'Name', p.name,
        'Price', p.price,
        'Quantity', c.quantity,
        'Image', COALESCE(p.image, ''),
        'Size', NULLIF(c.size, ''),
        'Seller_ID', p.seller_id
    ) ORDER BY c.id), '[]'::json)::text
    INTO v_items_json
    FROM cart c
    JOIN products p ON p.id = c.product_id
    WHERE c.customer_id = p_customer_id;

    INSERT INTO orders (
        id, tracking_id, customer_id, items_json, subtotal, shipping_fee, status,
        shipping_address_json, billing_address_json, additional_info, order_placed_at
    ) VALUES (
        p_order_id, p_tracking_id, p_customer_id, v_items_json, v_subtotal, p_shipping_fee,
        'placed', p_shipping_address, p_billing_address, COALESCE(p_additional_info, ''), CURRENT_TIMESTAMP
    );

    INSERT INTO order_items (order_id, product_id, seller_id, product_id_snapshot, seller_id_snapshot, product_name, unit_price, quantity, image, size)
    SELECT p_order_id, p.id, p.seller_id, p.id, p.seller_id, p.name, p.price, c.quantity, p.image, c.size
    FROM cart c
    JOIN products p ON p.id = c.product_id
    WHERE c.customer_id = p_customer_id;

    INSERT INTO seller_fulfillments (id, order_id, seller_id, items_json, subtotal)
    SELECT
        'FUL-' || substr(md5(p_order_id || ':' || oi.seller_id_snapshot), 1, 20),
        p_order_id,
        oi.seller_id_snapshot,
        jsonb_agg(jsonb_build_object(
            'Product_ID', oi.product_id_snapshot,
            'Name', oi.product_name,
            'Price', oi.unit_price,
            'Quantity', oi.quantity,
            'Image', COALESCE(oi.image, ''),
            'Size', NULLIF(oi.size, ''),
            'Seller_ID', oi.seller_id_snapshot
        ) ORDER BY oi.order_item_id),
        SUM(oi.unit_price * oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = p_order_id
    GROUP BY oi.seller_id_snapshot;

    UPDATE products p
    SET stock = p.stock - c.quantity
    FROM cart c
    WHERE c.customer_id = p_customer_id
      AND p.id = c.product_id;

    DELETE FROM cart WHERE customer_id = p_customer_id;
END;
$$;

DROP VIEW IF EXISTS admin_profiles CASCADE;
DROP VIEW IF EXISTS seller_profiles CASCADE;
DROP VIEW IF EXISTS customer_profiles CASCADE;
DROP VIEW IF EXISTS admin_dashboard_stats CASCADE;
DROP VIEW IF EXISTS category_performance CASCADE;
DROP VIEW IF EXISTS top_rated_products CASCADE;
DROP VIEW IF EXISTS top_customers CASCADE;
DROP VIEW IF EXISTS trending_products CASCADE;
DROP FUNCTION IF EXISTS gocart_top_sellers(INTEGER);
DROP VIEW IF EXISTS top_sellers CASCADE;

-- Rank active products by lifetime units sold across all non-cancelled orders.
CREATE OR REPLACE VIEW trending_products AS
WITH lifetime_sales AS (
    SELECT
        oi.product_id_snapshot AS product_id,
        SUM(oi.quantity)::BIGINT AS total_units_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY oi.product_id_snapshot
)
SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.image,
    cat.name AS category_name,
    p.price,
    p.stock AS available_stock,
    sales.total_units_sold
FROM products p
JOIN categories cat ON cat.id = p.category_id
JOIN lifetime_sales sales ON sales.product_id = p.id
WHERE p.product_status = 'active'
;

-- Summarize customer spend and order counts for delivered orders.
-- List active, approved-seller products with reviews.
CREATE OR REPLACE VIEW top_rated_products AS
SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.image,
    c.name AS category_name,
    s.name AS seller_name,
    p.price,
    ROUND(AVG(r.rating), 1) AS average_rating,
    COUNT(r.id) AS total_reviews
FROM products p
JOIN categories c ON c.id = p.category_id
JOIN sellers s ON s.id = p.seller_id
JOIN reviews r ON r.product_id = p.id
WHERE p.product_status = 'active'
    AND s.status = 'approved'
GROUP BY p.id, p.name, p.image, c.name, s.name, p.price
HAVING COUNT(r.id) >= 3 AND AVG(r.rating) >= 4.0;

CREATE OR REPLACE VIEW top_rated_sellers AS
SELECT
    s.id AS seller_id,
    s.name AS seller_name,
    s.logo,
    ROUND(AVG(r.rating), 1) AS average_rating,
    COUNT(r.id) AS total_reviews
FROM sellers s
JOIN products p ON p.seller_id = s.id
JOIN reviews r ON r.product_id = p.id
WHERE s.status = 'approved'
GROUP BY s.id, s.name, s.logo;

-- Provide the aggregate counts and revenue used by the admin dashboard.
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
    (SELECT COUNT(*) FROM sellers) AS total_sellers,
    (SELECT COUNT(*) FROM sellers WHERE status = 'approved') AS approved_sellers,
    (SELECT COUNT(*) FROM sellers WHERE status = 'pending') AS pending_sellers,
    (SELECT COUNT(*) FROM products) AS total_products,
    (SELECT COUNT(*) FROM products WHERE product_status = 'active') AS active_products,
    (SELECT COUNT(*) FROM orders) AS total_orders,
    (SELECT COALESCE(SUM(subtotal), 0) FROM orders) AS total_revenue;

-- Profile views expose account identity fields without duplicating credentials in profile tables.
CREATE OR REPLACE VIEW customer_profiles AS
SELECT c.id, u.username, c.name, u.email, c.number,
       c.address_house_name, c.address_street, c.address_city,
    c.address_postal_code, c.address_additional_info, c.created_at,
    c.address_latitude, c.address_longitude
FROM customers c JOIN users u ON u.id = c.id AND u.role = 'customer';

CREATE OR REPLACE VIEW seller_profiles AS
SELECT s.id, u.username, s.name, u.email, s.number, s.logo, s.description, s.status,
       s.address_house_name, s.address_street, s.address_city,
    s.address_postal_code, s.address_additional_info,
    s.address_latitude, s.address_longitude, s.created_at
FROM sellers s JOIN users u ON u.id = s.id AND u.role = 'seller';

CREATE OR REPLACE VIEW admin_profiles AS
SELECT a.id, u.username, a.name, u.email, a.number,
       a.address_house_name, a.address_street, a.address_city,
       a.address_postal_code, a.address_additional_info, a.created_at
FROM admins a JOIN users u ON u.id = a.id AND u.role = 'admin';

-- Category read and write operations used by the API.
CREATE OR REPLACE FUNCTION gocart_categories_list()
RETURNS SETOF categories
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM categories ORDER BY name ASC;
$$;

CREATE OR REPLACE FUNCTION gocart_category_create(p_id VARCHAR, p_name TEXT)
RETURNS SETOF categories
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO categories (id, name) VALUES (p_id, p_name)
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_category_update(p_id VARCHAR, p_name TEXT)
RETURNS SETOF categories
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE categories SET name = p_name WHERE id = p_id
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_category_delete(p_id VARCHAR)
RETURNS TABLE(deleted_id VARCHAR)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    DELETE FROM categories WHERE id = p_id
    RETURNING categories.id;
END;
$$;

-- Drop prior composite return types before switching from base tables to profile views.
DROP FUNCTION IF EXISTS gocart_sellers_list();
DROP FUNCTION IF EXISTS gocart_seller_create(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS gocart_seller_status_update(VARCHAR, TEXT);
DROP FUNCTION IF EXISTS gocart_admins_list();
DROP FUNCTION IF EXISTS gocart_admin_create(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS gocart_customers_list();
DROP FUNCTION IF EXISTS gocart_customer_create(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS gocart_customer_update(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS gocart_seller_get(VARCHAR);
DROP FUNCTION IF EXISTS gocart_customer_get(VARCHAR);
DROP FUNCTION IF EXISTS gocart_admin_get(VARCHAR);
DROP FUNCTION IF EXISTS gocart_orders_list();
DROP FUNCTION IF EXISTS gocart_order_get(VARCHAR);
DROP FUNCTION IF EXISTS gocart_auth_admin_lookup(TEXT, VARCHAR);
DROP FUNCTION IF EXISTS gocart_auth_seller_lookup(TEXT, VARCHAR);
DROP FUNCTION IF EXISTS gocart_auth_customer_lookup(TEXT, VARCHAR);
DROP FUNCTION IF EXISTS gocart_user_role_update(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS gocart_user_create(VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS gocart_user_create(VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR, TEXT);

-- Seller listing, registration, and approval-status operations.
CREATE OR REPLACE FUNCTION gocart_sellers_list()
RETURNS SETOF seller_profiles
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM seller_profiles ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION gocart_seller_create(
    p_id VARCHAR,
    p_username TEXT,
    p_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_number TEXT,
    p_logo TEXT,
    p_description TEXT,
    p_house_name TEXT,
    p_street TEXT,
    p_city TEXT,
    p_postal_code TEXT,
    p_additional_info TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS SETOF seller_profiles
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO users (id, username, password, email, role, created_at)
    VALUES (p_id, p_username, p_password, p_email, 'seller', CURRENT_TIMESTAMP);

    INSERT INTO sellers (
        id, name, number, logo, description, status,
        address_house_name, address_street, address_city, address_postal_code,
        address_additional_info, address_latitude, address_longitude, created_at
    ) VALUES (
        p_id, p_name, p_number, p_logo, p_description, 'pending',
        p_house_name, p_street, p_city, p_postal_code, p_additional_info,
        p_latitude, p_longitude, CURRENT_TIMESTAMP
    );

    RETURN QUERY SELECT * FROM seller_profiles WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_seller_status_update(p_id VARCHAR, p_status TEXT)
RETURNS SETOF seller_profiles
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE sellers SET status = p_status WHERE id = p_id;
    IF NOT FOUND THEN RETURN; END IF;
    RETURN QUERY SELECT * FROM seller_profiles WHERE id = p_id;
END;
$$;

-- Admin listing, registration, and linked-user listing operations.
CREATE OR REPLACE FUNCTION gocart_admins_list()
RETURNS SETOF admin_profiles
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM admin_profiles ORDER BY created_at ASC;
$$;

CREATE OR REPLACE FUNCTION gocart_admin_create(
    p_id VARCHAR,
    p_username TEXT,
    p_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_number TEXT,
    p_house_name TEXT,
    p_street TEXT,
    p_city TEXT,
    p_postal_code TEXT,
    p_additional_info TEXT
)
RETURNS SETOF admin_profiles
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO users (id, username, password, email, role, created_at)
    VALUES (p_id, p_username, p_password, p_email, 'admin', CURRENT_TIMESTAMP);

    INSERT INTO admins (
        id, name, number, address_house_name,
        address_street, address_city, address_postal_code, address_additional_info,
        address_latitude, address_longitude, created_at
    ) VALUES (
        p_id, p_name, p_number, p_house_name,
        p_street, p_city, p_postal_code, p_additional_info,
        p_latitude, p_longitude, CURRENT_TIMESTAMP
    );

    RETURN QUERY SELECT * FROM admin_profiles WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_admins_users_list()
RETURNS TABLE(id VARCHAR, username VARCHAR, email VARCHAR, role VARCHAR, entity_id VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE SQL STABLE
AS $$
    SELECT u.id, u.username, u.email, u.role, u.id, u.created_at
    FROM users u
    ORDER BY u.created_at DESC;
$$;

-- Customer listing, registration, profile updates, and lookup operations.
CREATE OR REPLACE FUNCTION gocart_customers_list()
RETURNS SETOF customer_profiles
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM customer_profiles ORDER BY created_at ASC;
$$;

CREATE OR REPLACE FUNCTION gocart_customer_create(
    p_id VARCHAR,
    p_username TEXT,
    p_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_number TEXT,
    p_house_name TEXT,
    p_street TEXT,
    p_city TEXT,
    p_postal_code TEXT,
    p_additional_info TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS SETOF customer_profiles
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO users (id, username, password, email, role, created_at)
    VALUES (p_id, p_username, p_password, p_email, 'customer', CURRENT_TIMESTAMP);

    INSERT INTO customers (
        id, name, number, address_house_name,
        address_street, address_city, address_postal_code, address_additional_info,
        address_latitude, address_longitude, created_at
    ) VALUES (
        p_id, p_name, p_number, p_house_name,
        p_street, p_city, p_postal_code, p_additional_info,
        p_latitude, p_longitude, CURRENT_TIMESTAMP
    );

    RETURN QUERY SELECT * FROM customer_profiles WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_customer_update(
    p_id VARCHAR,
    p_name TEXT,
    p_email TEXT,
    p_number TEXT,
    p_house_name TEXT,
    p_street TEXT,
    p_city TEXT,
    p_postal_code TEXT,
    p_additional_info TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS SETOF customer_profiles
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE customers
    SET name = COALESCE(p_name, name),
        number = COALESCE(p_number, number),
        address_house_name = COALESCE(p_house_name, address_house_name),
        address_street = COALESCE(p_street, address_street),
        address_city = COALESCE(p_city, address_city),
        address_postal_code = COALESCE(p_postal_code, address_postal_code),
        address_additional_info = COALESCE(p_additional_info, address_additional_info),
        address_latitude = COALESCE(p_latitude, address_latitude),
        address_longitude = COALESCE(p_longitude, address_longitude)
    WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF p_email IS NOT NULL AND p_email <> '' THEN
        UPDATE users SET email = p_email WHERE id = p_id AND role = 'customer';
    END IF;

    RETURN QUERY SELECT * FROM customer_profiles WHERE id = p_id;
END;
$$;

-- Product listing, lookup, creation, updates, status changes, and deletion.
CREATE OR REPLACE FUNCTION gocart_products_list()
RETURNS SETOF products
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM products ORDER BY id DESC;
$$;

CREATE OR REPLACE FUNCTION gocart_product_get(p_id VARCHAR)
RETURNS SETOF products
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM products WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION gocart_seller_get(p_id VARCHAR)
RETURNS SETOF seller_profiles
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM seller_profiles WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION gocart_product_create(
    p_id VARCHAR,
    p_name TEXT,
    p_image TEXT,
    p_description TEXT,
    p_price NUMERIC,
    p_voucher TEXT,
    p_stock INTEGER,
    p_product_status TEXT,
    p_category_id VARCHAR,
    p_seller_id VARCHAR
)
RETURNS SETOF products
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO products (
        id, name, image, description, price, voucher, stock, product_status,
        category_id, seller_id, created_at
    ) VALUES (
        p_id, p_name, p_image, p_description, p_price, p_voucher, p_stock,
        p_product_status, p_category_id, p_seller_id, CURRENT_TIMESTAMP
    )
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_product_update(
    p_id VARCHAR,
    p_name TEXT,
    p_image TEXT,
    p_description TEXT,
    p_price NUMERIC,
    p_voucher TEXT,
    p_stock INTEGER,
    p_product_status TEXT,
    p_category_id VARCHAR
)
RETURNS SETOF products
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE products
    SET name = p_name,
        image = p_image,
        description = p_description,
        price = p_price,
        voucher = p_voucher,
        stock = p_stock,
        product_status = p_product_status,
        category_id = p_category_id
    WHERE id = p_id
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_product_status_update(p_id VARCHAR, p_status TEXT)
RETURNS SETOF products
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE products SET product_status = p_status WHERE id = p_id
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_product_delete(p_id VARCHAR)
RETURNS TABLE(deleted_id VARCHAR)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY DELETE FROM products WHERE id = p_id RETURNING products.id;
END;
$$;

-- Cart reads and writes, including ownership-scoped updates and deletes.
CREATE OR REPLACE FUNCTION gocart_cart_list(p_customer_id VARCHAR)
RETURNS SETOF cart
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM cart WHERE customer_id = p_customer_id;
$$;

CREATE OR REPLACE FUNCTION gocart_active_product(p_product_id VARCHAR)
RETURNS TABLE(id VARCHAR)
LANGUAGE SQL STABLE
AS $$
    SELECT p.id FROM products p WHERE p.id = p_product_id AND p.product_status = 'active';
$$;

CREATE OR REPLACE FUNCTION gocart_cart_existing(p_customer_id VARCHAR, p_product_id VARCHAR)
RETURNS SETOF cart
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM cart WHERE customer_id = p_customer_id AND product_id = p_product_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION gocart_cart_existing(p_customer_id VARCHAR, p_product_id VARCHAR, p_size VARCHAR)
RETURNS SETOF cart
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM cart WHERE customer_id = p_customer_id AND product_id = p_product_id AND size = p_size LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION gocart_cart_create(
    p_id VARCHAR,
    p_customer_id VARCHAR,
    p_product_id VARCHAR,
    p_quantity INTEGER
)
RETURNS SETOF cart
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO cart (id, customer_id, product_id, quantity)
    VALUES (p_id, p_customer_id, p_product_id, p_quantity)
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_cart_create(
    p_id VARCHAR,
    p_customer_id VARCHAR,
    p_product_id VARCHAR,
    p_quantity INTEGER,
    p_size VARCHAR
)
RETURNS SETOF cart
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO cart (id, customer_id, product_id, quantity, size)
    VALUES (p_id, p_customer_id, p_product_id, p_quantity, p_size)
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_cart_update(p_id VARCHAR, p_quantity INTEGER, p_customer_id VARCHAR)
RETURNS SETOF cart
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE cart SET quantity = p_quantity
    WHERE id = p_id AND customer_id = p_customer_id
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_cart_delete(p_id VARCHAR, p_customer_id VARCHAR)
RETURNS SETOF cart
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    DELETE FROM cart WHERE id = p_id AND customer_id = p_customer_id
    RETURNING *;
END;
$$;

-- Order listing, lookup, and status update operations.
CREATE OR REPLACE FUNCTION gocart_orders_list()
RETURNS TABLE(
    id VARCHAR, tracking_id VARCHAR, customer_id VARCHAR, items_json TEXT,
    subtotal NUMERIC, shipping_fee NUMERIC, status VARCHAR,
    shipping_address_json TEXT, billing_address_json TEXT,
    additional_info TEXT, order_placed_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
    SELECT o.id, o.tracking_id, o.customer_id,
           COALESCE((
               SELECT json_agg(json_build_object(
                   'Product_ID', oi.product_id_snapshot,
                   'Name', oi.product_name,
                   'Price', oi.unit_price,
                   'Quantity', oi.quantity,
                'Image', COALESCE(oi.image, ''),
                'Size', NULLIF(oi.size, ''),
                   'Seller_ID', oi.seller_id_snapshot
               ) ORDER BY oi.order_item_id)::TEXT
               FROM order_items oi WHERE oi.order_id = o.id
           ), o.items_json, '[]') AS items_json,
           o.subtotal, o.shipping_fee, o.status, o.shipping_address_json,
           o.billing_address_json, o.additional_info, o.order_placed_at
    FROM orders o ORDER BY o.order_placed_at DESC;
$$;

CREATE OR REPLACE FUNCTION gocart_order_get(p_id VARCHAR)
RETURNS TABLE(
    id VARCHAR, tracking_id VARCHAR, customer_id VARCHAR, items_json TEXT,
    subtotal NUMERIC, shipping_fee NUMERIC, status VARCHAR,
    shipping_address_json TEXT, billing_address_json TEXT,
    additional_info TEXT, order_placed_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
    SELECT o.id, o.tracking_id, o.customer_id,
           COALESCE((
               SELECT json_agg(json_build_object(
                   'Product_ID', oi.product_id_snapshot,
                   'Name', oi.product_name,
                   'Price', oi.unit_price,
                   'Quantity', oi.quantity,
                'Image', COALESCE(oi.image, ''),
                'Size', NULLIF(oi.size, ''),
                   'Seller_ID', oi.seller_id_snapshot
               ) ORDER BY oi.order_item_id)::TEXT
               FROM order_items oi WHERE oi.order_id = o.id
           ), o.items_json, '[]') AS items_json,
           o.subtotal, o.shipping_fee, o.status, o.shipping_address_json,
           o.billing_address_json, o.additional_info, o.order_placed_at
    FROM orders o WHERE o.id = p_id;
$$;

CREATE OR REPLACE FUNCTION gocart_order_status_update(p_id VARCHAR, p_status TEXT)
RETURNS SETOF orders
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE orders SET status = p_status WHERE id = p_id
    RETURNING *;
END;
$$;

-- Review listing and filtering by product or seller.
CREATE OR REPLACE FUNCTION gocart_reviews_list()
RETURNS SETOF reviews
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM reviews ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION gocart_reviews_by_product(p_product_id VARCHAR)
RETURNS SETOF reviews
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM reviews WHERE product_id = p_product_id ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION gocart_reviews_by_seller(p_seller_id VARCHAR)
RETURNS SETOF reviews
LANGUAGE SQL STABLE
AS $$
    SELECT r.* FROM reviews r
    JOIN products p ON p.id = r.product_id
    WHERE p.seller_id = p_seller_id
    ORDER BY r.created_at DESC;
$$;

-- Look up a customer profile by its entity ID.
CREATE OR REPLACE FUNCTION gocart_customer_get(p_id VARCHAR)
RETURNS SETOF customer_profiles
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM customer_profiles WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION gocart_review_create(
    p_id VARCHAR,
    p_product_id VARCHAR,
    p_customer_id VARCHAR,
    p_customer_name TEXT,
    p_review_text TEXT,
    p_rating INTEGER
)
RETURNS SETOF reviews
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO reviews (id, product_id, customer_id, customer_name, review_text, rating, created_at)
    VALUES (p_id, p_product_id, p_customer_id, p_customer_name, p_review_text, p_rating, CURRENT_TIMESTAMP)
    RETURNING *;
END;
$$;

-- Authentication and profile lookups.
CREATE OR REPLACE FUNCTION gocart_auth_user_lookup(p_identifier TEXT, p_id VARCHAR)
RETURNS SETOF users
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM users
    WHERE LOWER(username) = LOWER(p_identifier)
       OR LOWER(email) = LOWER(p_identifier)
       OR id = p_id
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION gocart_admin_get(p_id VARCHAR)
RETURNS SETOF admin_profiles
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM admin_profiles WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION gocart_auth_password_update(p_role TEXT, p_id VARCHAR, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    CASE p_role
        WHEN 'user' THEN UPDATE users SET password = p_password WHERE id = p_id;
        WHEN 'admin' THEN UPDATE users SET password = p_password WHERE id = p_id AND role = 'admin';
        WHEN 'seller' THEN UPDATE users SET password = p_password WHERE id = p_id AND role = 'seller';
        WHEN 'customer' THEN UPDATE users SET password = p_password WHERE id = p_id AND role = 'customer';
        ELSE RAISE EXCEPTION 'Unsupported password account type: %', p_role;
    END CASE;
    RETURN FOUND;
END;
$$;

-- Statistics queries, including their ordering and limits.
CREATE OR REPLACE FUNCTION gocart_admin_dashboard_stats()
RETURNS SETOF admin_dashboard_stats
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM admin_dashboard_stats;
$$;

CREATE OR REPLACE FUNCTION gocart_top_rated_products(p_limit INTEGER DEFAULT 12)
RETURNS SETOF top_rated_products
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM top_rated_products
    ORDER BY average_rating DESC, total_reviews DESC, product_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 3), 0), 3);
$$;

CREATE OR REPLACE FUNCTION gocart_top_rated_sellers(p_limit INTEGER DEFAULT 3)
RETURNS SETOF top_rated_sellers
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM top_rated_sellers
    ORDER BY average_rating DESC, total_reviews DESC, seller_name
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 3), 0), 3);
$$;

CREATE OR REPLACE FUNCTION gocart_trending_products(p_limit INTEGER DEFAULT 10)
RETURNS SETOF trending_products
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM trending_products
    ORDER BY total_units_sold DESC, product_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 3), 0), 3);
$$;

CREATE OR REPLACE FUNCTION gocart_database_status()
RETURNS TABLE(test INTEGER, db_name NAME, pg_version TEXT)
LANGUAGE SQL STABLE
AS $$
    SELECT 1, current_database(), version();
$$;

-- User provisioning and seed helpers.
CREATE OR REPLACE FUNCTION gocart_user_find(p_identifier VARCHAR, p_email VARCHAR, p_username VARCHAR)
RETURNS SETOF users
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM users
    WHERE id = p_identifier OR email = p_email OR username = p_username
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION gocart_user_create(
    p_username VARCHAR, p_password TEXT, p_email VARCHAR,
    p_role VARCHAR, p_id VARCHAR, p_name TEXT, p_number TEXT,
    p_house_name TEXT, p_street TEXT, p_city TEXT, p_postal_code TEXT, p_additional_info TEXT
)
RETURNS SETOF users
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO users (id, username, password, email, role, created_at)
    VALUES (p_id, p_username, p_password, p_email, p_role, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password;

    CASE p_role
        WHEN 'customer' THEN
            INSERT INTO customers (id, name, number, address_house_name, address_street, address_city, address_postal_code, address_additional_info)
            VALUES (p_id, p_name, p_number, p_house_name, p_street, p_city, p_postal_code, p_additional_info) ON CONFLICT (id) DO NOTHING;
        WHEN 'seller' THEN
            INSERT INTO sellers (id, name, number, status, address_house_name, address_street, address_city, address_postal_code, address_additional_info)
            VALUES (p_id, p_name, p_number, 'pending', p_house_name, p_street, p_city, p_postal_code, p_additional_info) ON CONFLICT (id) DO NOTHING;
        WHEN 'admin' THEN
            INSERT INTO admins (id, name, number, address_house_name, address_street, address_city, address_postal_code, address_additional_info)
            VALUES (p_id, p_name, p_number, p_house_name, p_street, p_city, p_postal_code, p_additional_info) ON CONFLICT (id) DO NOTHING;
        ELSE RAISE EXCEPTION 'Unsupported user role: %', p_role;
    END CASE;

    RETURN QUERY SELECT * FROM users WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_table_count(p_table TEXT)
RETURNS BIGINT
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    CASE p_table
        WHEN 'categories' THEN RETURN (SELECT COUNT(*) FROM categories);
        WHEN 'admins' THEN RETURN (SELECT COUNT(*) FROM admins);
        WHEN 'sellers' THEN RETURN (SELECT COUNT(*) FROM sellers);
        WHEN 'customers' THEN RETURN (SELECT COUNT(*) FROM customers);
        WHEN 'products' THEN RETURN (SELECT COUNT(*) FROM products);
        WHEN 'reviews' THEN RETURN (SELECT COUNT(*) FROM reviews);
        WHEN 'orders' THEN RETURN (SELECT COUNT(*) FROM orders);
        ELSE RAISE EXCEPTION 'Unsupported seed table: %', p_table;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_seed_row(p_table TEXT, p_row JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    CASE p_table
        WHEN 'categories' THEN
            INSERT INTO categories SELECT (jsonb_populate_record(NULL::categories, p_row)).*
            ON CONFLICT (id) DO NOTHING;
        WHEN 'admins' THEN
            INSERT INTO users (id, username, password, email, role, created_at)
            VALUES (p_row->>'id', p_row->>'username', p_row->>'password', p_row->>'email', 'admin', CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING;
            INSERT INTO admins SELECT (jsonb_populate_record(NULL::admins, p_row)).* ON CONFLICT (id) DO NOTHING;
        WHEN 'sellers' THEN
            INSERT INTO users (id, username, password, email, role, created_at)
            VALUES (p_row->>'id', p_row->>'username', p_row->>'password', p_row->>'email', 'seller', CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING;
            INSERT INTO sellers SELECT (jsonb_populate_record(NULL::sellers, p_row)).* ON CONFLICT (id) DO NOTHING;
        WHEN 'customers' THEN
            INSERT INTO users (id, username, password, email, role, created_at)
            VALUES (p_row->>'id', p_row->>'username', p_row->>'password', p_row->>'email', 'customer', CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING;
            INSERT INTO customers SELECT (jsonb_populate_record(NULL::customers, p_row)).* ON CONFLICT (id) DO NOTHING;
        WHEN 'products' THEN
            INSERT INTO products SELECT (jsonb_populate_record(NULL::products, p_row)).*
            ON CONFLICT (id) DO NOTHING;
        WHEN 'reviews' THEN
            INSERT INTO reviews SELECT (jsonb_populate_record(NULL::reviews, p_row)).*
            ON CONFLICT (id) DO NOTHING;
        WHEN 'orders' THEN
            INSERT INTO orders SELECT (jsonb_populate_record(NULL::orders, p_row)).*
            ON CONFLICT (id) DO NOTHING;
            INSERT INTO order_items (order_id, product_id, seller_id, product_id_snapshot, seller_id_snapshot, product_name, unit_price, quantity, image, size)
            SELECT p_row->>'id', NULLIF(item.value->>'Product_ID', ''), NULLIF(item.value->>'Seller_ID', ''),
                COALESCE(NULLIF(item.value->>'Product_ID', ''), 'deleted-product'),
                COALESCE(NULLIF(item.value->>'Seller_ID', ''), 'deleted-seller'),
                COALESCE(item.value->>'Name', 'Archived product'),
                COALESCE((item.value->>'Price')::NUMERIC, 0),
                GREATEST(COALESCE((item.value->>'Quantity')::INTEGER, 1), 1),
                NULLIF(item.value->>'Image', ''),
                COALESCE(item.value->>'Size', '')
            FROM jsonb_array_elements(COALESCE(NULLIF(p_row->>'items_json', '')::JSONB, '[]'::JSONB)) AS item(value)
            ON CONFLICT DO NOTHING;
        ELSE RAISE EXCEPTION 'Unsupported seed table: %', p_table;
    END CASE;
END;
$$;

DROP FUNCTION IF EXISTS gocart_passwords_list();

-- Persist issued JWT IDs so sessions can be invalidated immediately on logout.
CREATE TABLE IF NOT EXISTS auth_sessions (
    jti VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_wishlist (
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS order_cancellation_requests (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(64),
    refund_completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_requested ON order_cancellation_requests(requested_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS support_requests (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    admin_notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_support_requests_status_created ON support_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_sessions_user') THEN
        ALTER TABLE auth_sessions ADD CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_session_create(p_jti VARCHAR, p_user_id VARCHAR, p_expires_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP;
    INSERT INTO auth_sessions (jti, user_id, expires_at)
    VALUES (p_jti, p_user_id, p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION gocart_session_active(p_jti VARCHAR)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth_sessions
        WHERE jti = p_jti
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
    );
$$;

CREATE OR REPLACE FUNCTION gocart_session_revoke(p_jti VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE auth_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE jti = p_jti
      AND revoked_at IS NULL;
    RETURN FOUND;
END;
$$;

-- Payment Functions
CREATE OR REPLACE FUNCTION gocart_payment_create(
    p_id VARCHAR, p_order_id VARCHAR, p_customer_id VARCHAR, p_amount NUMERIC,
    p_currency VARCHAR, p_gateway VARCHAR, p_payment_method VARCHAR,
    p_transaction_id VARCHAR, p_customer_phone VARCHAR
)
RETURNS SETOF payments
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO payments (
        id, order_id, customer_id, amount, currency, gateway, payment_method,
        transaction_id, status, customer_phone, created_at
    ) VALUES (
        p_id, p_order_id, p_customer_id, p_amount, p_currency, p_gateway, p_payment_method,
        p_transaction_id, 'PENDING', p_customer_phone, CURRENT_TIMESTAMP
    )
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_payment_update(
    p_tran_id VARCHAR, p_status VARCHAR, p_bank_tran_id VARCHAR,
    p_val_id VARCHAR, p_card_type VARCHAR, p_card_brand VARCHAR, p_card_issuer VARCHAR
)
RETURNS SETOF payments
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE payments
    SET status = p_status,
        bank_tran_id = COALESCE(p_bank_tran_id, bank_tran_id),
        val_id = COALESCE(p_val_id, val_id),
        card_type = COALESCE(p_card_type, card_type),
        card_brand = COALESCE(p_card_brand, card_brand),
        card_issuer = COALESCE(p_card_issuer, card_issuer),
        updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = p_tran_id
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION gocart_payments_list(p_order_id VARCHAR DEFAULT NULL)
RETURNS SETOF payments
LANGUAGE SQL STABLE
AS $$
    SELECT * FROM payments
    WHERE (p_order_id IS NULL OR order_id = p_order_id)
    ORDER BY created_at DESC;
$$;
