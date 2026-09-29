import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { sslcommerz } from '../services/sslcommerz.service.ts';
import { PaymentTransaction } from '../../src/types.ts';

const router = Router();

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
router.post('/init', async (req, res) => {
  try {
    const {
      orderId,
      customerId,
      amount,
      currency = 'BDT',
      customerName,
      customerEmail,
      customerPhone,
      address,
      paymentMethod = 'bkash',
      productName = 'ShopNiro Marketplace Order',
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const tran_id = `SSLCZ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (String(currency).toUpperCase() !== 'BDT') {
      return res.status(400).json({ error: 'Only BDT payments are supported' });
    }

    const finalAmountBDT = Number(amount);
    const paymentId = `PAY-${Date.now()}`;

    // Record initial pending payment in PostgreSQL via schema function gocart_payment_create
    await query(
      `SELECT * FROM gocart_payment_create($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        paymentId,
        orderId || null,
        customerId || null,
        finalAmountBDT,
        'BDT',
        'sslcommerz',
        paymentMethod,
        tran_id,
        customerPhone || '',
      ]
    );

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const hostUrl = `${protocol}://${host}`;

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
        product_name: productName,
        preferred_channel: paymentMethod === 'bkash' ? 'bkash' : 'any',
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
router.post('/sslcommerz/validate', async (req, res) => {
  try {
    const {
      tran_id,
      val_id,
      order_id,
      payment_method = 'bkash',
      customer_phone,
      card_brand,
    } = req.body;

    if (!tran_id) {
      return res.status(400).json({ error: 'Transaction ID (tran_id) is required' });
    }

    const validation = await sslcommerz.validatePayment(val_id, tran_id);
    const bankTranId = validation.bank_tran_id || `BANK-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const finalValId = validation.val_id || val_id || `VAL-${Date.now()}`;
    const cardType = validation.card_type || `${payment_method.toUpperCase()}-Gateway`;
    const cardBrand = card_brand || validation.card_brand || (payment_method === 'bkash' ? 'bKash' : 'SSLCommerz');
    const cardIssuer = validation.card_issuer || (payment_method === 'bkash' ? 'bKash MFS Limited' : 'SSL Wireless');

    // Update payment record in database via schema routine gocart_payment_update
    await query(
      `SELECT * FROM gocart_payment_update($1, 'VALIDATED', $2, $3, $4, $5, $6)`,
      [tran_id, bankTranId, finalValId, cardType, cardBrand, cardIssuer]
    );

    // If order exists, update status via schema gocart_order_status_update
    if (order_id) {
      await query(`SELECT * FROM gocart_order_status_update($1, 'processing')`, [order_id]);
    }

    res.json({
      success: true,
      status: 'VALIDATED',
      tran_id,
      val_id: finalValId,
      bank_tran_id: bankTranId,
      payment_method,
      card_brand: cardBrand,
      card_issuer: cardIssuer,
      validated_at: new Date().toISOString(),
      order_id,
    });
  } catch (error: any) {
    console.error('Error validating payment:', error);
    res.status(500).json({ error: error.message || 'Payment validation failed' });
  }
});

/**
 * Standard SSLCommerz redirect callbacks (Success, Fail, Cancel, IPN)
 */
router.post('/sslcommerz/success', async (req, res) => {
  const { tran_id, val_id, card_type, bank_tran_id } = req.body;
  if (tran_id) {
    await query(
      `SELECT * FROM gocart_payment_update($1, 'VALIDATED', $2, $3, $4, 'SSLCommerz', 'SSL Wireless')`,
      [tran_id, bank_tran_id || '', val_id || '', card_type || '']
    );
  }

  res.send(`
    <html>
      <head><title>SSLCommerz Payment Successful</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: #16a34a;">Payment Confirmed Successfully!</h2>
        <p>Transaction ID: <strong>${tran_id}</strong></p>
        <p>Please return to the marketplace application.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'SSLCOMMERZ_SUCCESS', tran_id: '${tran_id}' }, '*');
            window.close();
          }
        </script>
      </body>
    </html>
  `);
});

router.post('/sslcommerz/fail', async (req, res) => {
  const { tran_id, error } = req.body;
  if (tran_id) {
    await query(`SELECT * FROM gocart_payment_update($1, 'FAILED', '', '', '', '', '')`, [tran_id]);
  }

  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: #dc2626;">Payment Failed or Declined</h2>
        <p>Transaction ID: ${tran_id}</p>
        <p>${error || 'The payment could not be processed.'}</p>
      </body>
    </html>
  `);
});

router.post('/sslcommerz/cancel', async (req, res) => {
  const { tran_id } = req.body;
  if (tran_id) {
    await query(`SELECT * FROM gocart_payment_update($1, 'CANCELLED', '', '', '', '', '')`, [tran_id]);
  }

  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Payment Cancelled by User</h2>
        <p>Transaction ID: ${tran_id}</p>
      </body>
    </html>
  `);
});

router.post('/sslcommerz/ipn', async (req, res) => {
  const { tran_id, val_id, status } = req.body;
  if (tran_id && (status === 'VALID' || status === 'VALIDATED')) {
    await query(
      `SELECT * FROM gocart_payment_update($1, 'VALIDATED', '', $2, '', '', '')`,
      [tran_id, val_id || '']
    );
  }
  res.status(200).send('IPN Received');
});

/**
 * GET /api/payment/transactions
 * Retrieve payments list via schema gocart_payments_list
 */
router.get('/transactions', async (req, res) => {
  try {
    const { orderId } = req.query;
    const result = await query(`SELECT * FROM gocart_payments_list($1)`, [orderId ? String(orderId) : null]);
    res.json(result.rows);
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
