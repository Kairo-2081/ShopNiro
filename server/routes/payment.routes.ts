import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { pool, query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { GatewayError, sslcommerz } from '../services/sslcommerz.service.ts';

const router = Router();
const paymentInitRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 5,
  keyGenerator: (req) => (req as AuthRequest).user?.userId || ipKeyGenerator(req.ip || ''),
  standardHeaders: true,
  legacyHeaders: false,
});

const simulatorProfiles: Record<string, { name: string; accountLabel: string; account: string; codeLabel: string; code: string; securityLabel: string; security: string }> = {
  bkash: { name: 'bKash', accountLabel: 'Demo bKash number', account: '01700000000', codeLabel: 'Demo OTP', code: '123456', securityLabel: 'Demo PIN', security: '12345' },
  nagad: { name: 'Nagad', accountLabel: 'Demo Nagad number', account: '01800000000', codeLabel: 'Demo OTP', code: '123456', securityLabel: 'Demo PIN', security: '12345' },
  rocket: { name: 'Rocket', accountLabel: 'Demo Rocket number', account: '01900000000', codeLabel: 'Demo OTP', code: '123456', securityLabel: 'Demo PIN', security: '12345' },
  visa_mastercard: { name: 'Card', accountLabel: 'Demo card number', account: '4242424242424242', codeLabel: 'Demo verification code', code: '123456', securityLabel: 'Demo CVV', security: '123' },
};

const finalizeSslCommerzPayment = async (tranId: string, valId: string) => {
  const paymentResult = await query(
    `SELECT order_id, amount, status, payment_method, val_id, bank_tran_id,
      card_type, card_brand, card_issuer
     FROM payments WHERE transaction_id = $1`,
    [tranId]
  );
  const payment = paymentResult.rows[0];
  if (!payment?.order_id) throw new GatewayError('Payment record not found. Restart checkout and try again.');

  if (payment.status === 'PENDING') {
    const validation = await sslcommerz.validatePayment(valId, tranId, Number(payment.amount));
    if (!validation.ok || !validation.raw) throw new GatewayError('SSLCommerz could not verify this payment.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lockedPayment = await client.query(
        `SELECT order_id, status FROM payments WHERE transaction_id = $1 FOR UPDATE`,
        [tranId]
      );
      const currentPayment = lockedPayment.rows[0];
      if (!currentPayment || currentPayment.order_id !== payment.order_id) {
        throw new GatewayError('Payment record changed during verification.');
      }

      if (currentPayment.status === 'PENDING') {
        const lockedOrder = await client.query(
          `SELECT payment_status FROM orders WHERE id = $1 FOR UPDATE`,
          [currentPayment.order_id]
        );
        if (!lockedOrder.rows.length || !['pending', 'paid'].includes(lockedOrder.rows[0].payment_status)) {
          throw new GatewayError('The order is no longer eligible for payment.');
        }
        await client.query(
          `UPDATE payments SET status = 'VALIDATED', bank_tran_id = $2, val_id = $3,
            card_type = $4, card_brand = $5, card_issuer = $6, updated_at = CURRENT_TIMESTAMP
           WHERE transaction_id = $1 AND status = 'PENDING'`,
          [tranId, validation.raw.bank_tran_id || '', validation.raw.val_id || valId,
            validation.raw.card_type || '', validation.raw.card_brand || '', validation.raw.card_issuer || '']
        );
        await client.query(
          `UPDATE orders SET payment_status = 'paid', payment_method = $2, transaction_id = $3
           WHERE id = $1 AND payment_status = 'pending'`,
          [currentPayment.order_id, payment.payment_method, tranId]
        );
      } else if (currentPayment.status !== 'VALIDATED') {
        throw new GatewayError('Payment is already finalized.');
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } else if (payment.status !== 'VALIDATED') {
    throw new GatewayError('Payment is already finalized.');
  }

  const orderResult = await query('SELECT payment_status FROM orders WHERE id = $1', [payment.order_id]);
  if (orderResult.rows[0]?.payment_status !== 'paid') {
    throw new GatewayError('The order payment could not be finalized.');
  }
  return { orderId: String(payment.order_id) };
};

const paymentReturnUrl = (status: 'success' | 'verification' | 'failed' | 'cancelled', orderId?: string) => {
  const params = new URLSearchParams({ sslcommerz: status });
  if (orderId) params.set('orderId', orderId);
  return `/?${params.toString()}`;
};

const orderIdForTransaction = async (tranId: unknown): Promise<string | undefined> => {
  if (typeof tranId !== 'string' || !/^SSLCZ-[A-Z0-9-]+$/.test(tranId)) return undefined;
  const result = await query('SELECT order_id FROM payments WHERE transaction_id = $1', [tranId]);
  return result.rows[0]?.order_id ? String(result.rows[0].order_id) : undefined;
};

export const processRefundQueue = async () => {
  const result = await query(`
    SELECT refund.id, refund.order_id, refund.payment_id, refund.amount, refund.status,
      refund.gateway_ref, payment.bank_tran_id, payment.transaction_id
    FROM refunds refund
    LEFT JOIN payments payment ON payment.id = refund.payment_id
    WHERE refund.method = 'sslcommerz' AND refund.status IN ('requested', 'submitted')
    ORDER BY refund.created_at ASC
    LIMIT 50
  `);
  const summary = { initiated: 0, completed: 0, failed: 0, pending: 0 };

  for (const refund of result.rows) {
    try {
      if (refund.status === 'requested') {
        if (!refund.bank_tran_id) {
          await query("UPDATE refunds SET status = 'failed', last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'requested'", [refund.id, 'Verified bank transaction ID is unavailable.']);
          summary.failed += 1;
          continue;
        }
        const initiated = await sslcommerz.initiateRefund({
          bankTranId: refund.bank_tran_id,
          refundTransId: `RF-${String(refund.id).replace(/[^A-Za-z0-9]/g, '').slice(-24)}`,
          amount: Number(refund.amount),
          remarks: `ShopNiro cancellation refund for order ${refund.order_id}`,
          referenceId: String(refund.order_id),
        });
        await query(
          `UPDATE refunds SET status = 'submitted', gateway_ref = $2, last_error = NULL,
            updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'requested'`,
          [refund.id, initiated.refund_ref_id]
        );
        summary.initiated += 1;
        continue;
      }

      if (!refund.gateway_ref) {
        await query("UPDATE refunds SET status = 'failed', last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'submitted'", [refund.id, 'Refund reference is missing.']);
        summary.failed += 1;
        continue;
      }
      const status = await sslcommerz.getRefundStatus(refund.gateway_ref);
      if (status.status === 'refunded') {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const locked = await client.query('SELECT order_id, payment_id, status FROM refunds WHERE id = $1 FOR UPDATE', [refund.id]);
          if (locked.rows[0]?.status === 'submitted') {
            await client.query("UPDATE refunds SET status = 'completed', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [refund.id]);
            await client.query("UPDATE orders SET payment_status = 'refunded' WHERE id = $1", [locked.rows[0].order_id]);
            if (locked.rows[0].payment_id) {
              await client.query("UPDATE payments SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [locked.rows[0].payment_id]);
            }
            await client.query(`
              INSERT INTO seller_wallet_entries (id, seller_id, entry_type, amount, reference_id, description, available_at)
              SELECT 'CLW-' || substr(md5(wallet.reference_id), 1, 20), wallet.seller_id, 'refund_clawback',
                -SUM(wallet.amount), wallet.reference_id, 'Refund clawback', now()
              FROM seller_wallet_entries wallet
              JOIN seller_fulfillments fulfillment ON fulfillment.id = wallet.reference_id
              WHERE fulfillment.order_id = $1
                AND wallet.entry_type IN ('sale', 'cod_received', 'commission')
              GROUP BY wallet.seller_id, wallet.reference_id
              HAVING SUM(wallet.amount) <> 0
              ON CONFLICT (seller_id, entry_type, reference_id) DO NOTHING
            `, [locked.rows[0].order_id]);
            await client.query('UPDATE order_cancellation_requests SET refund_completed_at = COALESCE(refund_completed_at, CURRENT_TIMESTAMP) WHERE order_id = $1 AND status = \'approved\'', [locked.rows[0].order_id]);
            summary.completed += 1;
          } else {
            summary.pending += 1;
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      } else if (status.status === 'failed' || status.status === 'cancelled') {
        await query("UPDATE refunds SET status = 'failed', last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'submitted'", [refund.id, status.errorReason || `Gateway refund status: ${status.status}`]);
        summary.failed += 1;
      } else {
        summary.pending += 1;
      }
    } catch (error: any) {
      await query('UPDATE refunds SET last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [refund.id, error.message || 'Refund processing failed.']).catch(() => {});
      summary.pending += 1;
    }
  }
  return summary;
};

export const startRefundProcessor = (intervalMs = 60_000) => {
  const globalKey = '__shopniro_refund_processor__';
  const existing = (globalThis as typeof globalThis & Record<string, any>)[globalKey];
  if (existing) return existing;

  const timer = setInterval(() => {
    void processRefundQueue().catch((error) => {
      console.error('Background refund reconciliation failed:', error);
    });
  }, intervalMs);

  (globalThis as typeof globalThis & Record<string, any>)[globalKey] = timer;
  void processRefundQueue().catch((error) => {
    console.error('Initial refund reconciliation failed:', error);
  });

  return timer;
};

/**
 * GET /api/payment/methods
 * Returns available payment methods, SSLCommerz gateway status, and exchange rates
 */
router.get('/methods', async (req, res) => {
  const settings = sslcommerz.getSettings();
  res.json({
    gateway: 'SSLCommerz (SSL Wireless)',
    isSandbox: settings.isSandbox,
    currency: 'BDT',
    methods: [
      {
        id: 'bkash',
        name: 'bKash Mobile Banking',
        type: 'mfs',
        gateway: 'sslcommerz',
        badge: 'Recommended in Bangladesh',
        brandColor: '#E2136E',
        icon: 'Smartphone',
        description: 'Instant payment via bKash Account (PIN & OTP secured)',
        testAccount: '01700000000',
        testOtp: '123456',
        testPin: '12345',
      },
      {
        id: 'nagad',
        name: 'Nagad Digital Payment',
        type: 'mfs',
        gateway: 'sslcommerz',
        badge: 'Post Office Digital Service',
        brandColor: '#F7941D',
        icon: 'Smartphone',
        description: 'Fast checkout via Nagad Account',
        testAccount: '01800000000',
        testOtp: '123456',
        testPin: '12345',
      },
      {
        id: 'rocket',
        name: 'Rocket (DBBL MFS)',
        type: 'mfs',
        gateway: 'sslcommerz',
        badge: 'Dutch-Bangla Bank',
        brandColor: '#8C3494',
        icon: 'Smartphone',
        description: 'Direct payment via DBBL Rocket Account',
        testAccount: '01900000000',
        testOtp: '123456',
        testPin: '12345',
      },
      {
        id: 'visa_mastercard',
        name: 'Cards & Internet Banking',
        type: 'card',
        gateway: 'sslcommerz',
        badge: 'Visa / Mastercard / Amex',
        brandColor: '#2563EB',
        icon: 'CreditCard',
        description: 'Local & International Credit/Debit Cards via SSLCommerz 3D Secure',
      },
      {
        id: 'cash_on_delivery',
        name: 'Cash on Delivery (COD)',
        type: 'offline',
        gateway: 'direct',
        badge: 'Pay Upon Receiving',
        brandColor: '#059669',
        icon: 'Banknote',
        description: 'Pay cash to the dispatch courier at your doorstep',
      },
    ],
  });
});

/**
 * POST /api/payment/init
 * Initializes an SSLCommerz payment session for an order (via schema gocart_payment_create)
 */
router.get('/simulator', async (req, res) => {
  if (!sslcommerz.isPaymentSimulatorEnabled()) return res.sendStatus(404);
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : '';
  if (!/^SSLCZ-[A-Z0-9-]+$/.test(tranId)) return res.status(400).send('Invalid simulated transaction.');

  try {
    const payment = await query('SELECT status, amount, payment_method FROM payments WHERE transaction_id = $1', [tranId]);
    if (!payment.rows.length || payment.rows[0].status !== 'PENDING') {
      return res.status(404).send('This simulated payment is no longer available.');
    }
    const profile = simulatorProfiles[String(payment.rows[0].payment_method)] || simulatorProfiles.bkash;
    const amount = Number(payment.rows[0].amount).toFixed(2);
    const showError = req.query.error === 'credentials';
    res.type('html').send(`<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ShopNiro Payment Test</title>
      <style>body{margin:0;background:#111820;color:#f4f4ef;font:15px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;padding:20px;box-sizing:border-box}.panel{width:min(460px,100%);padding:28px;background:#1b242d;border:1px solid #39444e;border-radius:16px;box-shadow:0 18px 48px #0006}h1{font-size:23px;margin:0 0 8px}p{color:#bac2c7;line-height:1.5}.amount{margin:18px 0;padding:14px 0;border-block:1px solid #39444e;display:flex;justify-content:space-between;font-weight:700}.demo{padding:12px;border:1px solid #53634f;border-radius:8px;background:#263227;color:#d8e8d4;font-size:13px;line-height:1.6}.fields{display:grid;gap:12px;margin-top:20px}label{display:grid;gap:6px;color:#d2d7d8;font-size:13px}input{width:100%;box-sizing:border-box;border:1px solid #56616a;border-radius:7px;background:#111820;color:#fff;padding:11px;font:inherit}button,a{display:block;box-sizing:border-box;width:100%;padding:13px 16px;border:0;border-radius:8px;text-align:center;font:700 14px system-ui,sans-serif;text-decoration:none;cursor:pointer}.pay{background:#e2136e;color:white}.cancel{background:#313b44;color:#f4f4ef}.error{margin-top:12px;color:#ffb4b4;font-size:13px}</style></head>
      <body><main class="panel"><h1>${profile.name} payment demo</h1><p>Test the payment flow with the demo details below. No real money will be charged.</p>
      <div class="amount"><span>Order total</span><span>BDT ${amount}</span></div>
      <div class="demo"><strong>Demo values</strong><br>${profile.accountLabel}: ${profile.account}<br>${profile.codeLabel}: ${profile.code}<br>${profile.securityLabel}: ${profile.security}</div>
      ${showError ? '<p class="error" role="alert">Those demo details did not match. Check the values and try again.</p>' : ''}
      <form class="fields" method="post" action="/api/payment/simulator/complete"><input type="hidden" name="tran_id" value="${tranId}">
      <label>${profile.accountLabel}<input name="account" inputmode="numeric" autocomplete="off" required value="${profile.account}"></label>
      <label>${profile.codeLabel}<input name="code" inputmode="numeric" autocomplete="off" required value="${profile.code}"></label>
      <label>${profile.securityLabel}<input name="security" type="password" autocomplete="off" required value="${profile.security}"></label>
      <button class="pay" type="submit">Complete demo payment</button></form>
      <p><a class="cancel" href="/api/payment/sslcommerz/fail?tran_id=${encodeURIComponent(tranId)}">Simulate failed payment</a></p>
      <a class="cancel" href="/api/payment/sslcommerz/cancel?tran_id=${encodeURIComponent(tranId)}">Cancel payment</a></main></body></html>`);
  } catch (error) {
    console.error('Could not load payment simulator:', error);
    res.status(500).send('Could not load payment simulator.');
  }
});

router.post('/simulator/complete', async (req, res) => {
  if (!sslcommerz.isPaymentSimulatorEnabled()) return res.sendStatus(404);
  const tranId = typeof req.body?.tran_id === 'string' ? req.body.tran_id : '';
  if (!/^SSLCZ-[A-Z0-9-]+$/.test(tranId)) return res.status(400).send('Invalid simulated transaction.');

  try {
    const paymentResult = await query(
      'SELECT status, payment_method FROM payments WHERE transaction_id = $1',
      [tranId]
    );
    const payment = paymentResult.rows[0];
    if (!payment || payment.status !== 'PENDING') return res.status(404).send('This simulated payment is no longer available.');

    const profile = simulatorProfiles[String(payment.payment_method)] || simulatorProfiles.bkash;
    if (req.body?.account !== profile.account || req.body?.code !== profile.code || req.body?.security !== profile.security) {
      return res.redirect(303, `/api/payment/simulator?tran_id=${encodeURIComponent(tranId)}&error=credentials`);
    }

    const result = await finalizeSslCommerzPayment(tranId, `SIM-${tranId}`);
    return res.redirect(303, paymentReturnUrl('success', result.orderId));
  } catch (error) {
    console.error('Could not complete simulated payment:', error);
    return res.redirect(303, `/api/payment/simulator?tran_id=${encodeURIComponent(tranId)}&error=credentials`);
  }
});

router.post('/init', requireAuth, requireRole(['customer']), paymentInitRateLimit, async (req: AuthRequest, res) => {
  try {
    const {
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      address,
      paymentMethod = 'bkash',
      productName = 'ShopNiro Marketplace Order',
    } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'A valid orderId is required.' });
    }
    if (!['bkash', 'nagad', 'rocket', 'visa_mastercard'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method.' });
    }
    const forbiddenFields = ['amount', 'customerId', 'customerID', 'paymentStatus', 'Payment_Status', 'transactionId', 'Transaction_ID'];
    const suppliedForbiddenFields = forbiddenFields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
    if (suppliedForbiddenFields.length) {
      return res.status(400).json({ error: `Payment initialization fields are server-controlled: ${suppliedForbiddenFields.join(', ')}` });
    }

    const order = await query(
      `SELECT id, customer_id, status, subtotal, shipping_fee, payment_status, shipping_address_json
       FROM orders WHERE id = $1 AND customer_id = $2`,
      [String(orderId), req.user!.entityId]
    );
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
    if (order.rows[0].status !== 'placed') {
      return res.status(409).json({ error: 'This order is no longer eligible for payment.' });
    }
    if (order.rows[0].payment_status !== 'pending') {
      return res.status(409).json({ error: 'Order payment is already finalized.' });
    }

    const finalAmountBDT = Number(order.rows[0].subtotal) + Number(order.rows[0].shipping_fee);
    if (!Number.isFinite(finalAmountBDT) || finalAmountBDT <= 0) {
      return res.status(400).json({ error: 'Order total is invalid.' });
    }
    const shippingAddress = JSON.parse(String(order.rows[0].shipping_address_json || '{}')) as Record<string, unknown>;
    const shipAdd1 = [shippingAddress.House_Name, shippingAddress.Street]
      .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
      .join(' ')
      .slice(0, 255);

    const ipnToken = process.env.SSLCOMMERZ_IPN_TOKEN || sslcommerz.getIpnToken();
    if (!ipnToken) {
      return res.status(503).json({ error: 'SSLCommerz IPN authentication is not configured.' });
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const hostUrl = `${protocol}://${host}`;
    const ipnUrl = `${hostUrl}/api/payment/sslcommerz/ipn?token=${encodeURIComponent(ipnToken)}`;

    const tran_id = `SSLCZ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentId = `PAY-${Date.now()}`;
    await query(
      `SELECT * FROM gocart_payment_create($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        paymentId,
        orderId,
        req.user!.entityId,
        finalAmountBDT,
        'BDT',
        'sslcommerz',
        paymentMethod,
        tran_id,
        customerPhone || '',
      ]
    );

    const session = await sslcommerz.initPayment(
      {
        tran_id,
        total_amount: finalAmountBDT,
        currency: 'BDT',
        cus_name: customerName || 'Marketplace Customer',
        cus_email: customerEmail || 'customer@example.com',
        cus_phone: customerPhone || '01700000000',
        cus_add1: typeof address === 'object' ? `${address.House_Name || ''} ${address.Street || ''}`.trim() : String(address || ''),
        cus_city: typeof address === 'object' ? address.City || 'Dhaka' : 'Dhaka',
        cus_postcode: typeof address === 'object' ? address.Postal_Code || '1200' : '1200',
        ship_name: customerName || 'Marketplace Customer',
        ship_add1: shipAdd1 || 'Dhaka, Bangladesh',
        ship_city: typeof shippingAddress.City === 'string' && shippingAddress.City.trim() ? shippingAddress.City.trim() : 'Dhaka',
        ship_postcode: typeof shippingAddress.Postal_Code === 'string' && shippingAddress.Postal_Code.trim() ? shippingAddress.Postal_Code.trim() : '1200',
        ship_country: 'Bangladesh',
        product_name: productName,
        preferred_channel: paymentMethod === 'bkash' ? 'bkash' : 'any',
        ipn_url: ipnUrl,
      },
      hostUrl
    );

    res.json({
      success: true,
      tran_id,
      paymentId,
      amountBDT: finalAmountBDT,
      currency: 'BDT',
      session,
      gateway: 'SSLCommerz',
      paymentMethod,
    });
  } catch (error: any) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize payment gateway' });
  }
});

/**
 * POST /api/payment/sslcommerz/validate
 * Validates SSLCommerz payment and updates via schema gocart_payment_update
 */
router.post('/sslcommerz/validate', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  try {
    const { tran_id, val_id, order_id } = req.body;

    if (!tran_id || typeof tran_id !== 'string' || !/^SSLCZ-[A-Z0-9-]+$/.test(tran_id)) {
      return res.status(400).json({ error: 'A valid SSLCommerz transaction ID is required' });
    }
    if (typeof val_id !== 'string' || !val_id.trim()) {
      return res.status(400).json({ error: 'A payment validation ID is required' });
    }

    const payment = await query(
      `SELECT customer_id, order_id FROM payments WHERE transaction_id = $1`,
      [tran_id]
    );
    if (payment.rows.length === 0) {
      return res.status(404).json({ error: 'Payment record not found. Restart checkout and try again.' });
    }
    if (payment.rows[0].customer_id !== req.user!.entityId) {
      return res.status(403).json({ error: 'You can only validate your own payments.' });
    }
    if (order_id && payment.rows[0].order_id !== String(order_id)) {
      return res.status(403).json({ error: 'The order does not match this payment.' });
    }
    const finalized = await finalizeSslCommerzPayment(tran_id, val_id);

    res.json({
      success: true,
      status: 'VALIDATED',
      tran_id,
      order_id: finalized.orderId,
      validated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return res.status(402).json({ error: 'Payment validation failed.', reason: error.message });
    }
    console.error('Error validating payment:', error);
    res.status(500).json({ error: error.message || 'Payment validation failed' });
  }
});

/**
 * Standard SSLCommerz redirect callbacks (Success, Fail, Cancel, IPN)
 */
const handleSslCommerzSuccess = async (req: AuthRequest, res: any) => {
  const tranId = req.body?.tran_id || req.query.tran_id;
  const valId = req.body?.val_id || req.query.val_id;
  try {
    if (typeof tranId !== 'string' || typeof valId !== 'string' || !valId) {
      throw new GatewayError('SSLCommerz did not return a valid payment reference.');
    }
    const result = await finalizeSslCommerzPayment(tranId, valId);
    return res.redirect(303, paymentReturnUrl('success', result.orderId));
  } catch (error: any) {
    console.error('SSLCommerz success callback could not verify payment:', error);
    const orderId = await orderIdForTransaction(tranId).catch(() => undefined);
    return res.redirect(303, paymentReturnUrl('verification', orderId));
  }
};

const handleSslCommerzExit = async (req: AuthRequest, res: any, status: 'failed' | 'cancelled') => {
  const tranId = req.body?.tran_id || req.query.tran_id;
  const orderId = await orderIdForTransaction(tranId).catch(() => undefined);
  return res.redirect(303, paymentReturnUrl(status, orderId));
};

router.post('/sslcommerz/success', handleSslCommerzSuccess);
router.get('/sslcommerz/success', handleSslCommerzSuccess);
router.post('/sslcommerz/fail', (req, res) => handleSslCommerzExit(req, res, 'failed'));
router.get('/sslcommerz/fail', (req, res) => handleSslCommerzExit(req, res, 'failed'));
router.post('/sslcommerz/cancel', (req, res) => handleSslCommerzExit(req, res, 'cancelled'));
router.get('/sslcommerz/cancel', (req, res) => handleSslCommerzExit(req, res, 'cancelled'));

router.post('/sslcommerz/ipn', async (req, res) => {
  const configuredToken = process.env.SSLCOMMERZ_IPN_TOKEN || sslcommerz.getIpnToken();
  const receivedToken = typeof req.query.token === 'string' ? req.query.token : '';
  const expectedToken = configuredToken ? Buffer.from(configuredToken) : Buffer.alloc(0);
  const tokenBuffer = Buffer.from(receivedToken);
  if (!configuredToken || tokenBuffer.length !== expectedToken.length || !timingSafeEqual(tokenBuffer, expectedToken)) {
    return res.status(401).json({ error: 'Invalid SSLCommerz IPN authentication token.' });
  }

  const { tran_id, val_id, status } = req.body;
  if (!tran_id || typeof tran_id !== 'string' || !/^SSLCZ-[A-Z0-9-]+$/.test(tran_id)) {
    return res.status(400).json({ error: 'A valid SSLCommerz transaction ID is required' });
  }
  if (status !== 'VALID' && status !== 'VALIDATED') {
    return res.status(202).send('IPN Ignored');
  }

  try {
    await finalizeSslCommerzPayment(tran_id, val_id);
    res.status(200).send('IPN Received');
  } catch (error: any) {
    console.error('SSLCommerz IPN validation failed:', error);
    res.status(402).json({ error: 'Payment validation failed.' });
  }
});

/**
 * GET /api/payment/transactions
 * Retrieve payments list via schema gocart_payments_list
 */
router.get('/transactions', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : null;
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(`
      SELECT * FROM payments
      WHERE ($1::varchar IS NULL OR order_id = $1)
        AND ($2::varchar IS NULL OR customer_id = $2)
      ORDER BY created_at DESC, id DESC
      LIMIT $3 OFFSET $4
    `, [orderId, customerId, limit + 1, offset]);
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    res.json(result.rows.slice(0, limit));
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * GET /api/payment/bkash/direct
 */
router.get('/bkash/direct', (req, res) => {
  const { tran_id } = req.query;
  res.redirect(`/?bkash=true&tran_id=${tran_id || ''}`);
});

export default router;
