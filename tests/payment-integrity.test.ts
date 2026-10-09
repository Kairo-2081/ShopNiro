import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { request as httpRequest, Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { query } from '../server/db/index.ts';

process.env.JWT_SECRET ??= 'test-payment-integrity-secret-at-least-32-characters';

const { generateToken, verifyToken } = await import('../server/middleware/auth.ts');
const { default: ordersRoutes } = await import('../server/routes/orders.routes.ts');
const { default: riderDeliveryRoutes } = await import('../server/routes/rider-delivery.routes.ts');
const { default: paymentRoutes } = await import('../server/routes/payment.routes.ts');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for payment-integrity tests. Start PostgreSQL or use the CI workflow.');
}

const listen = (app: express.Express): Promise<Server> =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

const request = async (
  server: Server,
  path: string,
  method = 'POST',
  body?: unknown,
  cookie?: string
): Promise<{ status: number; body: any }> => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.');
  const responseBody: Buffer[] = [];
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
    }, (response) => {
      response.on('data', (chunk) => responseBody.push(Buffer.from(chunk)));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: responseBody.length ? JSON.parse(responseBody.join('')) : null,
      }));
    });
    request.on('error', reject);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
};

const createSession = async (role: 'customer' | 'rider', entityId: string) => {
  const userId = `TEST-${role}-${randomUUID()}`;
  const token = generateToken({ userId, email: `${userId}@example.invalid`, username: userId, role, entityId });
  const decoded = verifyToken(token);
  await query('INSERT INTO users (id, username, email, role) VALUES ($1, $2, $3, $4)', [userId, userId, `${userId}@example.invalid`, role]);
  await query('SELECT gocart_session_create($1, $2, $3)', [decoded.jti, userId, new Date(Date.now() + 60 * 60 * 1000).toISOString()]);
  return `shopniro_session=${encodeURIComponent(token)}`;
};

const createOrder = async (customerId: string, orderId: string) => {
  await query(`
    INSERT INTO orders (
      id, tracking_id, customer_id, items_json, subtotal, shipping_fee, status,
      shipping_address_json, billing_address_json, payment_status, payment_method,
      transaction_id, applied_voucher, order_placed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `, [
    orderId,
    `TRK-${randomUUID().replaceAll('-', '').slice(0, 10)}`,
    customerId,
    JSON.stringify([]),
    100,
    0,
    'placed',
    JSON.stringify({ Street: 'Test street', City: 'Dhaka', Postal_Code: '1200' }),
    JSON.stringify({ Street: 'Test street', City: 'Dhaka', Postal_Code: '1200' }),
    'pending',
    'cash_on_delivery',
    '',
    '',
    new Date().toISOString(),
  ]);
};

const createCodDelivery = async (customerId: string, orderId: string, riderId: string) => {
  const sellerId = `SELLER-${randomUUID()}`;
  const fulfillmentId = `FUL-${randomUUID()}`;
  const deliveryId = `DLV-${randomUUID()}`;
  await query('INSERT INTO sellers (id, name, status) VALUES ($1, $2, $3)', [sellerId, 'Test Seller', 'approved']);
  await query(`
    INSERT INTO seller_fulfillments (id, order_id, seller_id, items_json, subtotal, status)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [fulfillmentId, orderId, sellerId, JSON.stringify([]), 100, 'processing']);
  await query(`
    INSERT INTO riders (id, name, number, status) VALUES ($1, $2, $3, $4)
  `, [riderId, 'Test Rider', '01700000000', 'approved']);
  await query(`
    INSERT INTO rider_deliveries (id, fulfillment_id, rider_id, status, confirmation_code, cod_amount)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [deliveryId, fulfillmentId, riderId, 'on_the_way', '123456', 100]);
  return { deliveryId, orderId };
};

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/riders', riderDeliveryRoutes);
const server = await listen(app);

try {
  test('payment init rejects client-controlled amount and keeps the order pending', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    const customer = await query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customerId, 'Test Customer']);
    assert.equal(customer.rows.length, 1);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const response = await request(server, `/api/payment/init`, 'POST', { orderId, amount: 1 }, cookie);
    assert.equal(response.status, 400);
    const order = await query('SELECT payment_status, payment_method FROM orders WHERE id = $1', [orderId]);
    assert.equal(order.rows[0].payment_status, 'pending');
    assert.equal(order.rows[0].payment_method, 'cash_on_delivery');
  });

  test('customer status updates are denied and do not mutate the order', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    await query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customerId, 'Test Customer']);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const response = await request(server, `/api/orders/${orderId}/status`, 'PATCH', { status: 'delivered' }, cookie);
    assert.equal(response.status, 403);
    const order = await query('SELECT status, payment_status FROM orders WHERE id = $1', [orderId]);
    assert.equal(order.rows[0].status, 'placed');
    assert.equal(order.rows[0].payment_status, 'pending');
  });

  test('COD collection is assigned, idempotent, and only completes after authorized delivery flow', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    const riderId = `RIDER-${randomUUID()}`;
    await query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customerId, 'Test Customer']);
    await createOrder(customerId, orderId);
    const cookie = await createSession('rider', riderId);
    const { deliveryId } = await createCodDelivery(customerId, orderId, riderId);

    const firstCollection = await request(server, `/api/riders/deliveries/${deliveryId}/cod-collected`, 'POST', undefined, cookie);
    assert.equal(firstCollection.status, 200);
    const secondCollection = await request(server, `/api/riders/deliveries/${deliveryId}/cod-collected`, 'POST', undefined, cookie);
    assert.equal(secondCollection.status, 409);

    const delivery = await query('SELECT cod_collected, rider_id, status FROM rider_deliveries WHERE id = $1', [deliveryId]);
    assert.equal(delivery.rows[0].cod_collected, true);
    assert.equal(delivery.rows[0].rider_id, riderId);
    assert.equal(delivery.rows[0].status, 'on_the_way');

    const customerCookie = await createSession('customer', customerId);
    const completion = await request(server, `/api/riders/deliveries/${deliveryId}/complete`, 'POST', { code: '123456' }, customerCookie);
    assert.equal(completion.status, 200);
    const paidOrder = await query('SELECT status, payment_status, payment_method FROM orders WHERE id = $1', [orderId]);
    assert.equal(paidOrder.rows[0].status, 'delivered');
    assert.equal(paidOrder.rows[0].payment_status, 'paid');
    assert.equal(paidOrder.rows[0].payment_method, 'cash_on_delivery');
  });

  test('the forged customer confirmation route is absent', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    await query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customerId, 'Test Customer']);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const response = await request(server, `/api/orders/${orderId}/confirm-payment`, 'POST', undefined, cookie);
    assert.equal(response.status, 404);
    const order = await query('SELECT payment_status FROM orders WHERE id = $1', [orderId]);
    assert.equal(order.rows[0].payment_status, 'pending');
  });

  test('failed online payment restores the order items to the cart instead of creating a COD order', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    await query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customerId, 'Test Customer']);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const response = await request(server, `/api/orders/${orderId}/revert-failed-payment`, 'PATCH', undefined, cookie);
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.restored_to_cart, true);

    const order = await query('SELECT COUNT(*)::integer AS remaining FROM orders WHERE id = $1', [orderId]);
    assert.equal(order.rows[0].remaining, 0);
  });
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
