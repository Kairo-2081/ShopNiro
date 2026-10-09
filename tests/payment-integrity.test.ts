import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import express from 'express';
import { request as httpRequest, Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { query } from '../server/db/index.ts';

process.env.JWT_SECRET ??= 'test-payment-integrity-secret-at-least-32-characters';
const dbTest = process.env.DATABASE_URL ? test : test.skip;

const { generateToken, verifyToken } = await import('../server/middleware/auth.ts');
const { default: ordersRoutes } = await import('../server/routes/orders.routes.ts');
const { default: authRoutes } = await import('../server/routes/auth.routes.ts');
const { default: riderDeliveryRoutes } = await import('../server/routes/rider-delivery.routes.ts');
const { default: paymentRoutes, processRefundQueue } = await import('../server/routes/payment.routes.ts');
const { sslcommerz } = await import('../server/services/sslcommerz.service.ts');

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
      response.on('end', () => {
        const text = Buffer.concat(responseBody).toString('utf8');
        let body: any = null;
        if (text) {
          try { body = JSON.parse(text); } catch { body = { raw: text }; }
        }
        resolve({ status: response.statusCode || 0, body });
      });
    });
    request.on('error', reject);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
};

const createTestUser = async (role: 'customer' | 'seller' | 'rider', entityId: string) => {
  await query(
    `INSERT INTO users (id, username, password, email, role)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
    [entityId, entityId, '!test-account-no-login', `${entityId}@example.invalid`, role]
  );
};

const createCustomer = async (customerId: string, name = 'Test Customer') => {
  await createTestUser('customer', customerId);
  return query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customerId, name]);
};

const createSession = async (role: 'customer' | 'seller' | 'rider', entityId: string) => {
  const userId = entityId;
  const token = generateToken({ userId, email: `${userId}@example.invalid`, username: userId, role, entityId });
  const decoded = verifyToken(token);
  await createTestUser(role, entityId);
  await query('SELECT gocart_session_create($1, $2, $3)', [decoded.jti, userId, new Date(Date.now() + 60 * 60 * 1000).toISOString()]);
  return `shopniro_session=${encodeURIComponent(token)}`;
};

const createCheckoutFixture = async (quantity = 2, stock = 10, price = 100) => {
  const customerId = `CUSTOMER-${randomUUID()}`;
  const sellerId = `SELLER-${randomUUID()}`;
  const categoryId = `CATEGORY-${randomUUID()}`;
  const productId = `PRODUCT-${randomUUID()}`;
  await createCustomer(customerId, 'Checkout Test Customer');
  await createTestUser('seller', sellerId);
  await query('INSERT INTO sellers (id, name, status) VALUES ($1, $2, $3)', [sellerId, 'Checkout Test Seller', 'approved']);
  await query('INSERT INTO categories (id, name) VALUES ($1, $2)', [categoryId, `Checkout ${categoryId}`]);
  await query(`
    INSERT INTO products (id, name, image, description, price, stock, product_status, category_id, seller_id)
    VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
  `, [productId, 'Checkout Test Product', '', '', price, stock, categoryId, sellerId]);
  await query('INSERT INTO cart (id, customer_id, product_id, quantity, size) VALUES ($1, $2, $3, $4, $5)', [
    `CART-${randomUUID()}`, customerId, productId, quantity, '',
  ]);

  return {
    customerId,
    sellerId,
    productId,
    quantity,
    price,
    customerCookie: await createSession('customer', customerId),
    sellerCookie: await createSession('seller', sellerId),
  };
};

const placeCartOrder = async (
  fixture: Awaited<ReturnType<typeof createCheckoutFixture>>,
  paymentMethod: 'cash_on_delivery' | 'online'
) => {
  const address = { Street: 'Test street', City: 'Dhaka', Postal_Code: '1200' };
  const response = await request(server, '/api/orders', 'POST', {
    Customer_ID: fixture.customerId,
    Items: [{ Product_ID: fixture.productId, Quantity: fixture.quantity }],
    Shipping_Address: address,
    Billing_Address: address,
    paymentMethod,
  }, fixture.customerCookie);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
};

const createOnlinePayment = async () => {
  const fixture = await createCheckoutFixture();
  const order = await placeCartOrder(fixture, 'online');
  const transactionId = `SSLCZ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  const validationId = `VAL-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  const amount = Number(order.Subtotal) + Number(order.Shipping_Fee);
  await query(`
    INSERT INTO payments (id, order_id, customer_id, amount, currency, gateway, payment_method, transaction_id, status)
    VALUES ($1, $2, $3, $4, 'BDT', 'sslcommerz', 'bkash', $5, 'PENDING')
  `, [`PAY-${randomUUID()}`, order.Order_ID, fixture.customerId, amount, transactionId]);
  return { fixture, order, transactionId, validationId, amount };
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
  await createTestUser('seller', sellerId);
  await query('INSERT INTO sellers (id, name, status) VALUES ($1, $2, $3)', [sellerId, 'Test Seller', 'approved']);
  await createTestUser('rider', riderId);
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
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/riders', riderDeliveryRoutes);
const server = await listen(app);

dbTest('plaintext stored passwords are rejected with the same message as unknown accounts', async () => {
    const userId = `PLAINTEXT-${randomUUID()}`;
    const username = userId.toLowerCase();
    const email = `${username}@example.invalid`;
    const plaintextPassword = 'legacy-plaintext-password';
    await query(
      'INSERT INTO users (id, username, email, password, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, email, plaintextPassword, 'customer']
    );

    const plaintextLogin = await request(server, '/api/auth/login', 'POST', { email, password: plaintextPassword });
    const unknownLogin = await request(server, '/api/auth/login', 'POST', { email: `missing-${username}`, password: plaintextPassword });
    assert.equal(plaintextLogin.status, 401);
    assert.equal(unknownLogin.status, 401);
    assert.equal(plaintextLogin.body.error, 'Invalid username/email or password.');
    assert.equal(unknownLogin.body.error, plaintextLogin.body.error);
    const stored = await query('SELECT password FROM users WHERE id = $1', [userId]);
    assert.equal(stored.rows[0].password, plaintextPassword);
});

  dbTest('refund queue completes approved cancellation refunds and marks the order refunded', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    const paymentId = `PAY-${randomUUID()}`;
    const refundId = `REF-${randomUUID()}`;
    const gatewayRef = `GREF-${randomUUID()}`;
    await createCustomer(customerId);
    await createOrder(customerId, orderId);
    await query(`
      INSERT INTO payments (id, order_id, customer_id, amount, currency, gateway, payment_method, transaction_id, status)
      VALUES ($1, $2, $3, $4, 'BDT', 'sslcommerz', 'bkash', $5, 'VALIDATED')
    `, [paymentId, orderId, customerId, 100, `SSLCZ-${randomUUID().replaceAll('-', '').toUpperCase()}`]);
    await query(`
      INSERT INTO refunds (id, order_id, payment_id, amount, method, gateway_ref, status)
      VALUES ($1, $2, $3, $4, 'sslcommerz', $5, 'submitted')
    `, [refundId, orderId, paymentId, 100, gatewayRef]);
    await query(`
      INSERT INTO order_cancellation_requests (id, order_id, customer_id, reason, status, requested_at, reviewed_at, reviewed_by)
      VALUES ($1, $2, $3, $4, 'approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5)
    `, [`CANCEL-${randomUUID()}`, orderId, customerId, 'Test refund reconciliation', 'ADMIN-TEST']);

    const getRefundStatus = mock.method(sslcommerz, 'getRefundStatus', async () => ({ status: 'refunded' }));
    const result = await processRefundQueue();
    assert.equal(result.completed, 1);
    const order = await query('SELECT payment_status FROM orders WHERE id = $1', [orderId]);
    const payment = await query('SELECT status FROM payments WHERE id = $1', [paymentId]);
    const refund = await query('SELECT status FROM refunds WHERE id = $1', [refundId]);
    assert.equal(order.rows[0].payment_status, 'refunded');
    assert.equal(payment.rows[0].status, 'REFUNDED');
    assert.equal(refund.rows[0].status, 'completed');
    getRefundStatus.mock.restore();
  });

  dbTest('payment init rejects client-controlled amount and keeps the order pending', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    const customer = await createCustomer(customerId);
    assert.equal(customer.rowCount, 1);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const response = await request(server, `/api/payment/init`, 'POST', { orderId, amount: 1 }, cookie);
    assert.equal(response.status, 400);
    const order = await query('SELECT payment_status, payment_method FROM orders WHERE id = $1', [orderId]);
    assert.equal(order.rows[0].payment_status, 'pending');
    assert.equal(order.rows[0].payment_method, 'cash_on_delivery');
  });

  dbTest('the sixth payment initialization attempt in one minute is rate limited', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    await createCustomer(customerId);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await request(server, '/api/payment/init', 'POST', { orderId, amount: 1 }, cookie));
    }
    assert.deepEqual(responses.slice(0, 5).map((response) => response.status), [400, 400, 400, 400, 400]);
    assert.equal(responses[5].status, 429);
  });

  dbTest('invalid SSLCommerz validation response leaves the payment pending', async (t) => {
    const { fixture, order, transactionId, validationId } = await createOnlinePayment();
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
      status: 'INVALID_TRANSACTION',
      tran_id: transactionId,
      val_id: validationId,
      amount: '100.00',
      currency: 'BDT',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const response = await request(server, '/api/payment/sslcommerz/validate', 'POST', {
      tran_id: transactionId,
      val_id: validationId,
    }, fixture.customerCookie);
    assert.equal(response.status, 402);
    const payment = await query('SELECT status FROM payments WHERE transaction_id = $1', [transactionId]);
    assert.equal(payment.rows[0].status, 'PENDING');
    const storedOrder = await query('SELECT payment_status FROM orders WHERE id = $1', [order.Order_ID]);
    assert.equal(storedOrder.rows[0].payment_status, 'pending');
  });

  dbTest('SSLCommerz validator timeout leaves the payment pending', async (t) => {
    const { fixture, order, transactionId, validationId } = await createOnlinePayment();
    t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('timeout', 'TimeoutError'); });

    const response = await request(server, '/api/payment/sslcommerz/validate', 'POST', {
      tran_id: transactionId,
      val_id: validationId,
    }, fixture.customerCookie);
    assert.equal(response.status, 402);
    const payment = await query('SELECT status FROM payments WHERE transaction_id = $1', [transactionId]);
    assert.equal(payment.rows[0].status, 'PENDING');
    const storedOrder = await query('SELECT payment_status FROM orders WHERE id = $1', [order.Order_ID]);
    assert.equal(storedOrder.rows[0].payment_status, 'pending');
  });

  dbTest('SSLCommerz amount mismatch leaves the payment pending', async (t) => {
    const { fixture, order, transactionId, validationId } = await createOnlinePayment();
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
      status: 'VALID',
      tran_id: transactionId,
      val_id: validationId,
      amount: '1.00',
      currency: 'BDT',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const response = await request(server, '/api/payment/sslcommerz/validate', 'POST', {
      tran_id: transactionId,
      val_id: validationId,
    }, fixture.customerCookie);
    assert.equal(response.status, 402);
    const payment = await query('SELECT status FROM payments WHERE transaction_id = $1', [transactionId]);
    assert.equal(payment.rows[0].status, 'PENDING');
    const storedOrder = await query('SELECT payment_status FROM orders WHERE id = $1', [order.Order_ID]);
    assert.equal(storedOrder.rows[0].payment_status, 'pending');
  });

  dbTest('verified SSLCommerz payment is finalized once and replay is idempotent', async (t) => {
    const { fixture, order, transactionId, validationId, amount } = await createOnlinePayment();
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
      status: 'VALID',
      tran_id: transactionId,
      val_id: validationId,
      amount: amount.toFixed(2),
      currency: 'BDT',
      bank_tran_id: 'BANK-TEST-1',
      card_type: 'MOBILE BANKING',
      card_brand: 'bKash',
      card_issuer: 'bKash',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const body = { tran_id: transactionId, val_id: validationId, payment_method: 'cash_on_delivery' };
    const first = await request(server, '/api/payment/sslcommerz/validate', 'POST', body, fixture.customerCookie);
    const second = await request(server, '/api/payment/sslcommerz/validate', 'POST', body, fixture.customerCookie);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(fetchMock.mock.callCount(), 1);
    const finalized = await query('SELECT o.payment_status, o.payment_method, p.status FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id = $1', [order.Order_ID]);
    assert.equal(finalized.rows[0].payment_status, 'paid');
    assert.equal(finalized.rows[0].payment_method, 'bkash');
    assert.equal(finalized.rows[0].status, 'VALIDATED');
  });

  dbTest('customer status updates are denied and do not mutate the order', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    await createCustomer(customerId);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const response = await request(server, `/api/orders/${orderId}/status`, 'PATCH', { status: 'delivered' }, cookie);
    assert.equal(response.status, 403);
    const order = await query('SELECT status, payment_status FROM orders WHERE id = $1', [orderId]);
    assert.equal(order.rows[0].status, 'placed');
    assert.equal(order.rows[0].payment_status, 'pending');
  });

  dbTest('COD collection is assigned, idempotent, and only completes after authorized delivery flow', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    const riderId = `RIDER-${randomUUID()}`;
    await createCustomer(customerId);
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

  dbTest('the forged customer confirmation route is absent', async () => {
    const customerId = `CUSTOMER-${randomUUID()}`;
    const orderId = `ORD-${randomUUID()}`;
    await createCustomer(customerId);
    await createOrder(customerId, orderId);
    const cookie = await createSession('customer', customerId);

    const response = await request(server, `/api/orders/${orderId}/confirm-payment`, 'POST', undefined, cookie);
    assert.equal(response.status, 404);
    const order = await query('SELECT payment_status FROM orders WHERE id = $1', [orderId]);
    assert.equal(order.rows[0].payment_status, 'pending');
  });

  dbTest('COD selected at checkout is persisted and creates a collectable rider amount', async () => {
    const fixture = await createCheckoutFixture();
    const order = await placeCartOrder(fixture, 'cash_on_delivery');
    assert.equal(order.Payment_Method, 'cash_on_delivery');
    assert.equal(order.Payment_Status, 'pending');

    const revert = await request(server, `/api/orders/${order.Order_ID}/revert-failed-payment`, 'PATCH', undefined, fixture.customerCookie);
    assert.equal(revert.status, 409);

    const shipment = await request(server, `/api/orders/${order.Order_ID}/status`, 'PATCH', { status: 'shipped' }, fixture.sellerCookie);
    assert.equal(shipment.status, 200, JSON.stringify(shipment.body));
    assert.equal(shipment.body.Payment_Method, 'cash_on_delivery');
    assert.equal(shipment.body.Payment_Status, 'pending');
    const delivery = await query(`
      SELECT rd.cod_amount FROM rider_deliveries rd
      JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
      WHERE sf.order_id = $1
    `, [order.Order_ID]);
    assert.equal(delivery.rows.length, 1);
    assert.ok(Number(delivery.rows[0].cod_amount) > 0);
  });

  dbTest('failed online checkout rollback restores stock and cart quantity exactly', async () => {
    const fixture = await createCheckoutFixture(3, 12, 100);
    const order = await placeCartOrder(fixture, 'online');
    assert.equal(order.Payment_Method, 'online');
    const afterCheckout = await query('SELECT stock FROM products WHERE id = $1', [fixture.productId]);
    assert.equal(Number(afterCheckout.rows[0].stock), 9);

    const response = await request(server, `/api/orders/${order.Order_ID}/revert-failed-payment`, 'PATCH', undefined, fixture.customerCookie);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const afterRollback = await query('SELECT stock FROM products WHERE id = $1', [fixture.productId]);
    const cart = await query('SELECT quantity FROM cart WHERE customer_id = $1 AND product_id = $2', [fixture.customerId, fixture.productId]);
    const remainingOrder = await query('SELECT COUNT(*)::integer AS remaining FROM orders WHERE id = $1', [order.Order_ID]);
    assert.equal(Number(afterRollback.rows[0].stock), 12);
    assert.equal(Number(cart.rows[0].quantity), 3);
    assert.equal(remainingOrder.rows[0].remaining, 0);
  });

  dbTest('rollback waits while a recent payment is pending IPN confirmation', async () => {
    const fixture = await createCheckoutFixture();
    const order = await placeCartOrder(fixture, 'online');
    const transactionId = `SSLCZ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
    await query(`
      INSERT INTO payments (id, order_id, customer_id, amount, currency, gateway, payment_method, transaction_id, status)
      VALUES ($1, $2, $3, $4, 'BDT', 'sslcommerz', 'bkash', $5, 'PENDING')
    `, [`PAY-${randomUUID()}`, order.Order_ID, fixture.customerId, Number(order.Subtotal) + Number(order.Shipping_Fee), transactionId]);

    const response = await request(server, `/api/orders/${order.Order_ID}/revert-failed-payment`, 'PATCH', undefined, fixture.customerCookie);
    assert.equal(response.status, 409);
    const orderStillExists = await query('SELECT payment_status FROM orders WHERE id = $1', [order.Order_ID]);
    const stock = await query('SELECT stock FROM products WHERE id = $1', [fixture.productId]);
    assert.equal(orderStillExists.rows[0].payment_status, 'pending');
    assert.equal(Number(stock.rows[0].stock), 8);
  });

  dbTest('seller cannot ship an unpaid online order', async () => {
    const fixture = await createCheckoutFixture();
    const order = await placeCartOrder(fixture, 'online');

    const shipment = await request(server, `/api/orders/${order.Order_ID}/status`, 'PATCH', { status: 'shipped' }, fixture.sellerCookie);
    assert.equal(shipment.status, 409);
    assert.equal(shipment.body.error, 'Order payment is not confirmed.');
    const fulfillment = await query('SELECT status FROM seller_fulfillments WHERE order_id = $1', [order.Order_ID]);
    const deliveries = await query('SELECT COUNT(*)::integer AS count FROM rider_deliveries rd JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id WHERE sf.order_id = $1', [order.Order_ID]);
    assert.equal(fulfillment.rows[0].status, 'processing');
    assert.equal(deliveries.rows[0].count, 0);
  });

  dbTest('/validate finalizes via the shared gateway verifier and ignores client payment method', async () => {
    const fixture = await createCheckoutFixture();
    const order = await placeCartOrder(fixture, 'online');
    const transactionId = `SSLCZ-${randomUUID().replaceAll('-', '').toUpperCase()}`;
    const validationId = `VAL-${randomUUID().replaceAll('-', '').toUpperCase()}`;
    const amount = Number(order.Subtotal) + Number(order.Shipping_Fee);
    await query(`
      INSERT INTO payments (id, order_id, customer_id, amount, currency, gateway, payment_method, transaction_id, status)
      VALUES ($1, $2, $3, $4, 'BDT', 'sslcommerz', 'bkash', $5, 'PENDING')
    `, [`PAY-${randomUUID()}`, order.Order_ID, fixture.customerId, amount, transactionId]);

    const originalValidatePayment = sslcommerz.validatePayment;
    (sslcommerz as any).validatePayment = async (valId: string, tranId: string, expectedAmount: number) => ({
      ok: valId === validationId && tranId === transactionId && expectedAmount === amount,
      raw: { status: 'VALID', tran_id: transactionId, val_id: validationId, amount, currency: 'BDT', bank_tran_id: 'BANK-TEST-1', card_type: 'bKash', card_brand: 'bKash', card_issuer: 'bKash' },
    });
    try {
      const response = await request(server, '/api/payment/sslcommerz/validate', 'POST', {
        tran_id: transactionId,
        val_id: validationId,
        order_id: order.Order_ID,
        payment_method: 'cash_on_delivery',
      }, fixture.customerCookie);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.order_id, order.Order_ID);
      const finalized = await query('SELECT o.payment_status, o.payment_method, p.status FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id = $1', [order.Order_ID]);
      assert.equal(finalized.rows[0].payment_status, 'paid');
      assert.equal(finalized.rows[0].payment_method, 'bkash');
      assert.equal(finalized.rows[0].status, 'VALIDATED');
    } finally {
      (sslcommerz as any).validatePayment = originalValidatePayment;
    }
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});
