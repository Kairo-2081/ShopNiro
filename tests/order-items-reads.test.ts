import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import express from 'express';
import { request as httpRequest, Server } from 'node:http';
import { pool, query } from '../server/db/index.ts';

process.env.JWT_SECRET ??= 'order-items-reads-test-secret-at-least-32-characters';
if (process.env.CI && !process.env.DATABASE_URL) throw new Error('DATABASE_URL required in CI');

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const { generateToken, verifyToken } = await import('../server/middleware/auth.ts');
const { default: ordersRoutes } = await import('../server/routes/orders.routes.ts');
const { default: riderDeliveryRoutes } = await import('../server/routes/rider-delivery.routes.ts');

const app = express();
app.use((req, _res, next) => {
  (req as any).log = { error: () => {} };
  next();
});
app.use(express.json());
app.use('/api/orders', ordersRoutes);
app.use('/api/riders', riderDeliveryRoutes);

const server = await new Promise<Server>((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});

const request = async (path: string, cookie: string): Promise<{ status: number; body: any }> => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.');
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: 'GET',
      headers: { cookie, connection: 'close' },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode || 0, body: text ? JSON.parse(text) : null });
      });
    });
    req.on('error', reject);
    req.end();
  });
};

const createUser = async (role: 'customer' | 'seller' | 'rider', id: string) => {
  await query(
    `INSERT INTO users (id, username, password, email, role)
     VALUES ($1, $1, '!test-account-no-login', $2, $3)`,
    [id, `${id}@example.invalid`, role]
  );
};

const createSession = async (role: 'customer' | 'seller' | 'rider', entityId: string) => {
  const token = generateToken({ userId: entityId, email: `${entityId}@example.invalid`, username: entityId, role, entityId });
  const decoded = verifyToken(token);
  await query('SELECT shopniro_session_create($1, $2, $3)', [
    decoded.jti,
    entityId,
    new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  ]);
  return { cookie: `shopniro_session=${encodeURIComponent(token)}`, jti: decoded.jti };
};

type FixtureItem = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  size: string;
};

const itemJson = (item: FixtureItem) => ({
  Product_ID: item.productId,
  Name: item.name,
  Price: item.price,
  Quantity: item.quantity,
  Image: item.image || '',
  ...(item.size ? { Size: item.size } : {}),
  Seller_ID: item.sellerId,
});

dbTest('order and fulfillment endpoints preserve stored item JSON when reading order_items', { timeout: 30_000 }, async () => {
  const suffix = randomUUID();
  const customerId = `OI-CUST-${suffix}`;
  const sellerA = `OI-SELLER-A-${suffix}`;
  const sellerB = `OI-SELLER-B-${suffix}`;
  const riderId = `OI-RIDER-${suffix}`;
  const orderIds = [`OI-ORD-MULTI-${suffix}`, `OI-ORD-SIZES-${suffix}`, `OI-ORD-LEGACY-${suffix}`];
  const fulfillments: Array<{ id: string; orderId: string; sellerId: string }> = [];
  const sessionJtis: string[] = [];

  try {
    await createUser('customer', customerId);
    await createUser('seller', sellerA);
    await createUser('seller', sellerB);
    await createUser('rider', riderId);
    await query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customerId, 'Items Read Customer']);
    await query('INSERT INTO sellers (id, name, status) VALUES ($1, $2, $3), ($4, $5, $3)', [
      sellerA, 'Items Read Seller A', 'approved', sellerB, 'Items Read Seller B',
    ]);
    await query(
      'INSERT INTO riders (id, name, number, status, current_latitude, current_longitude) VALUES ($1, $2, $3, $4, $5, $6)',
      [riderId, 'Items Read Rider', '01700000000', 'approved', 23.8103, 90.4125]
    );

    const customerSession = await createSession('customer', customerId);
    const sellerSession = await createSession('seller', sellerA);
    const riderSession = await createSession('rider', riderId);
    sessionJtis.push(customerSession.jti, sellerSession.jti, riderSession.jti);

    const orders: Array<{ id: string; items: FixtureItem[] }> = [
      {
        id: orderIds[0],
        items: [
          { productId: `OI-PROD-1-${suffix}`, sellerId: sellerA, name: 'Multi Seller Shirt', price: 42.5, quantity: 1, image: null, size: 'M' },
          { productId: `OI-PROD-2-${suffix}`, sellerId: sellerB, name: 'Multi Seller Mug', price: 15, quantity: 2, image: 'mug.png', size: '' },
        ],
      },
      {
        id: orderIds[1],
        items: [
          { productId: `OI-PROD-3-${suffix}`, sellerId: sellerA, name: 'Sized Shoes', price: 80, quantity: 1, image: 'shoe.png', size: '42' },
          { productId: `OI-PROD-3-${suffix}`, sellerId: sellerA, name: 'Sized Shoes', price: 80, quantity: 1, image: 'shoe.png', size: '43' },
        ],
      },
      {
        id: orderIds[2],
        items: [
          { productId: `OI-PROD-4-${suffix}`, sellerId: sellerA, name: 'Legacy Snapshot Item', price: 12.25, quantity: 3, image: null, size: '' },
        ],
      },
    ];

    for (const order of orders) {
      await query(`
        INSERT INTO orders (
          id, tracking_id, customer_id, items_json, subtotal, shipping_fee,
          shipping_address_json, billing_address_json
        ) VALUES ($1, $2, $3, $4, $5, 0, '{}', '{}')
      `, [
        order.id,
        `TRK-${order.id}`,
        customerId,
        JSON.stringify(order.items.map(itemJson)),
        order.items.reduce((total, item) => total + item.price * item.quantity, 0),
      ]);

      for (const item of order.items) {
        await query(`
          INSERT INTO order_items (
            order_id, product_id_snapshot, seller_id_snapshot, product_name,
            unit_price, quantity, image, size
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [order.id, item.productId, item.sellerId, item.name, item.price, item.quantity, item.image, item.size]);
      }

      const bySeller = new Map<string, FixtureItem[]>();
      for (const item of order.items) {
        bySeller.set(item.sellerId, [...(bySeller.get(item.sellerId) || []), item]);
      }
      for (const [sellerId, sellerItems] of bySeller) {
        const fulfillmentId = `OI-FUL-${randomUUID()}`;
        fulfillments.push({ id: fulfillmentId, orderId: order.id, sellerId });
        await query(`
          INSERT INTO seller_fulfillments (id, order_id, seller_id, items_json, subtotal)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          fulfillmentId,
          order.id,
          sellerId,
          JSON.stringify(sellerItems.map(itemJson)),
          sellerItems.reduce((total, item) => total + item.price * item.quantity, 0),
        ]);
        await query(`
          INSERT INTO rider_deliveries (id, fulfillment_id, rider_id, status, confirmation_code)
          VALUES ($1, $2, $3, 'on_the_way', '123456')
        `, [`OI-DLV-${randomUUID()}`, fulfillmentId, riderId]);
      }
    }

    const storedOrderItems = new Map<string, unknown[]>();
    for (const id of orderIds) {
      const result = await query('SELECT items_json FROM orders WHERE id = $1', [id]);
      storedOrderItems.set(id, JSON.parse(result.rows[0].items_json));
    }
    const storedFulfillmentItems = new Map<string, unknown[]>();
    for (const fulfillment of fulfillments) {
      const result = await query('SELECT items_json FROM seller_fulfillments WHERE id = $1', [fulfillment.id]);
      storedFulfillmentItems.set(fulfillment.id, result.rows[0].items_json);
    }

    const customerOrders = await request('/api/orders', customerSession.cookie);
    assert.equal(customerOrders.status, 200);
    assert.equal(customerOrders.body.length, orderIds.length);
    for (const order of customerOrders.body) {
      assert.deepEqual(order.Items, storedOrderItems.get(order.Order_ID));
      for (const fulfillment of order.Fulfillments) {
        assert.deepEqual(fulfillment.Items, storedFulfillmentItems.get(fulfillment.Fulfillment_ID));
      }
    }

    for (const orderId of orderIds) {
      const detail = await request(`/api/orders/${orderId}`, customerSession.cookie);
      assert.equal(detail.status, 200);
      assert.deepEqual(detail.body.Items, storedOrderItems.get(orderId));
    }

    const sellerOrders = await request(`/api/orders?sellerId=${encodeURIComponent(sellerA)}`, sellerSession.cookie);
    assert.equal(sellerOrders.status, 200);
    assert.equal(sellerOrders.body.length, orderIds.length);
    for (const order of sellerOrders.body) {
      assert.deepEqual(order.Items, storedOrderItems.get(order.Order_ID));
      for (const fulfillment of order.Fulfillments) {
        assert.deepEqual(fulfillment.Items, storedFulfillmentItems.get(fulfillment.Fulfillment_ID));
      }
    }

    const riderDeliveries = await request('/api/riders/deliveries', riderSession.cookie);
    assert.equal(riderDeliveries.status, 200);
    for (const delivery of riderDeliveries.body) {
      assert.deepEqual(delivery.Items, storedFulfillmentItems.get(delivery.Seller_Fulfillment_ID));
    }

    const customerDeliveries = await request('/api/riders/customer-deliveries', customerSession.cookie);
    assert.equal(customerDeliveries.status, 200);
    for (const delivery of customerDeliveries.body) {
      assert.deepEqual(delivery.Items, storedFulfillmentItems.get(delivery.Seller_Fulfillment_ID));
    }
  } finally {
    if (sessionJtis.length) await query('DELETE FROM auth_sessions WHERE jti = ANY($1::varchar[])', [sessionJtis]);
    await query('DELETE FROM orders WHERE id = ANY($1::varchar[])', [orderIds]);
    await query('DELETE FROM customers WHERE id = $1', [customerId]);
    await query('DELETE FROM sellers WHERE id = ANY($1::varchar[])', [[sellerA, sellerB]]);
    await query('DELETE FROM riders WHERE id = $1', [riderId]);
    await query('DELETE FROM users WHERE id = ANY($1::varchar[])', [[customerId, sellerA, sellerB, riderId]]);
  }
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
  await pool.end();
});
