import { Router } from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Order, ProductBundle } from '../../src/types.ts';
import { discountedPriceForVoucher, discountedUnitPrice, getVoucherRule, isVoucherExpired, normalizeVoucherCode } from '../../src/lib/vouchers.ts';
import { calculateBundlePrices } from '../../src/lib/bundles.ts';

const router = Router();

/**
 * GET /api/orders
 * Retrieve orders (via schema gocart_orders_list)
 */
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = req.user!;
    const requestedCustomerId = typeof req.query.customerId === 'string' ? req.query.customerId : null;
    const requestedSellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : null;
    if (actor.role === 'customer' && requestedCustomerId && requestedCustomerId !== actor.entityId) {
      return res.status(403).json({ error: 'You can only view your own orders.' });
    }
    if (actor.role === 'seller' && requestedSellerId && requestedSellerId !== actor.entityId) {
      return res.status(403).json({ error: 'You can only view orders containing your products.' });
    }
    if (!['customer', 'seller', 'admin'].includes(actor.role)) {
      return res.status(403).json({ error: 'Your role cannot view order history.' });
    }
    const customerId = actor.role === 'customer' ? actor.entityId : actor.role === 'admin' ? requestedCustomerId : null;
    const sellerId = actor.role === 'seller' ? actor.entityId : actor.role === 'admin' ? requestedSellerId : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(`
      SELECT order_record.* FROM gocart_orders_list() order_record
      WHERE ($1::varchar IS NULL OR order_record.customer_id = $1)
        AND ($2::varchar IS NULL OR EXISTS (
          SELECT 1 FROM order_items item
          WHERE item.order_id = order_record.id AND item.seller_id_snapshot = $2
        ))
      ORDER BY order_record.order_placed_at DESC, order_record.id DESC
      LIMIT $3 OFFSET $4
    `, [customerId, sellerId, limit + 1, offset]);
    const hasMore = result.rows.length > limit;

    let formatted: Order[] = result.rows.map((o: any) => ({
      Order_ID: o.id,
      Tracking_ID: o.tracking_id || '',
      Customer_ID: o.customer_id,
      Items: typeof o.items_json === 'string' ? JSON.parse(o.items_json) : (o.items_json || []),
      Subtotal: Number(o.subtotal),
      Shipping_Fee: Number(o.shipping_fee),
      Status: o.status as any,
      Payment_Status: o.payment_status || 'pending',
      Payment_Method: o.payment_method || 'cash_on_delivery',
      Transaction_ID: o.transaction_id || '',
      Applied_Voucher: o.applied_voucher || undefined,
      Currency: 'BDT',
      Shipping_Address: o.shipping_address_json ? (typeof o.shipping_address_json === 'string' ? JSON.parse(o.shipping_address_json) : o.shipping_address_json) : { Street: '', House_Name: '', City: '', Postal_Code: '' },
      Billing_Address: o.billing_address_json ? (typeof o.billing_address_json === 'string' ? JSON.parse(o.billing_address_json) : o.billing_address_json) : { Street: '', House_Name: '', City: '', Postal_Code: '' },
      Order_Placed_At: o.order_placed_at ? new Date(o.order_placed_at).toISOString() : new Date().toISOString(),
      Additional_Info: o.additional_info || '',
    }));

    const orderIds = formatted.map((order) => order.Order_ID);
    if (orderIds.length > 0) {
      const fulfillmentResult = await query(
        `SELECT sf.id, sf.order_id, sf.seller_id, s.name AS seller_name, sf.items_json, sf.status,
          rd.rider_id, r.name AS rider_name, r.number AS rider_number, rd.status AS delivery_status
        FROM seller_fulfillments sf
        JOIN sellers s ON s.id = sf.seller_id
        LEFT JOIN rider_deliveries rd ON rd.fulfillment_id = sf.id
        LEFT JOIN riders r ON r.id = rd.rider_id
        WHERE sf.order_id = ANY($1::varchar[])
        ORDER BY sf.created_at ASC`,
        [orderIds]
      );
      const fulfillmentsByOrder = new Map<string, NonNullable<Order['Fulfillments']>>();
      for (const fulfillment of fulfillmentResult.rows) {
        const current = fulfillmentsByOrder.get(fulfillment.order_id) || [];
        current.push({
          Fulfillment_ID: fulfillment.id,
          Seller_ID: fulfillment.seller_id,
          Seller_Name: fulfillment.seller_name,
          Status: fulfillment.status,
          Items: typeof fulfillment.items_json === 'string' ? JSON.parse(fulfillment.items_json) : fulfillment.items_json || [],
          Rider_ID: fulfillment.rider_id || undefined,
          Rider_Name: fulfillment.rider_name || undefined,
          Rider_Number: fulfillment.rider_number || undefined,
          Delivery_Status: fulfillment.delivery_status || undefined,
        });
        fulfillmentsByOrder.set(fulfillment.order_id, current);
      }
      formatted.forEach((order) => { order.Fulfillments = fulfillmentsByOrder.get(order.Order_ID) || []; });
    }

    res.setHeader('X-Has-More', String(hasMore));
    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * POST /api/orders
 * Checkout & place order using schema routine process_checkout or gocart_seed_row
 */
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      Customer_ID,
      Items,
      Applied_Voucher,
      Shipping_Address,
      Billing_Address,
      Subtotal,
      Shipping_Fee,
      Additional_Info,
    } = req.body;
    const forbiddenPaymentFields = ['Payment_Status', 'payment_status', 'Payment_Method', 'payment_method', 'Transaction_ID', 'transaction_id'];
    const suppliedForbiddenPaymentFields = forbiddenPaymentFields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
    if (suppliedForbiddenPaymentFields.length) {
      return res.status(400).json({ error: `Order payment state fields are server-controlled: ${suppliedForbiddenPaymentFields.join(', ')}` });
    }
    if (!Customer_ID || !Items || !Items.length || !Shipping_Address) {
      return res.status(400).json({ error: 'Customer_ID, Items, and Shipping Address are required' });
    }
    if (Customer_ID !== req.user!.entityId) {
      return res.status(403).json({ error: 'You can only place orders for your own account.' });
    }

    const trackNum1 = Math.floor(1000 + Math.random() * 9000);
    const trackNum2 = Math.floor(1000 + Math.random() * 9000);
    const Tracking_ID = `TRK-${trackNum1}-${trackNum2}`;
    const id = `ORD-${Date.now()}`;
    const shipAddrJson = JSON.stringify(Shipping_Address);
    const billAddrJson = JSON.stringify(Billing_Address || Shipping_Address);
    const addInfo = Additional_Info || '';
    const orderPlacedAt = new Date().toISOString();

    const cartProducts = await query(`
      SELECT p.id, p.name, p.image, p.price, p.voucher, p.voucher_expires_at, p.seller_id, c.quantity, c.size
      FROM cart c JOIN products p ON p.id = c.product_id
      WHERE c.customer_id = $1
      ORDER BY c.id
    `, [Customer_ID]);
    if (cartProducts.rows.length === 0) {
      return res.status(400).json({ error: 'Checkout Failed: The shopping cart is empty.' });
    }

    const appliedCodes = typeof Applied_Voucher === 'string'
      ? Applied_Voucher.split('+').map(normalizeVoucherCode).filter(Boolean)
      : [];
    const voucherCode = appliedCodes.find((code: string) => code !== 'CART5' && !code.startsWith('BUNDLE:')) || '';
    const eligibleProducts = voucherCode
      ? cartProducts.rows.filter((product: any) => normalizeVoucherCode(product.voucher || '') === voucherCode)
      : [];
    const activeEligibleProducts = eligibleProducts.filter((product: any) => !isVoucherExpired(product.voucher_expires_at));
    let voucherRule = null;
    if (voucherCode) {
      if (!eligibleProducts.length) {
        return res.status(400).json({ error: 'This voucher is not available for any product in your cart.' });
      }
      if (!activeEligibleProducts.length) {
        return res.status(400).json({ error: 'This voucher has expired.' });
      }
      voucherRule = getVoucherRule(String(activeEligibleProducts[0].voucher || ''));
      if (!voucherRule) {
        return res.status(400).json({ error: 'This product voucher is not valid.' });
      }
      if (voucherRule.firstOrderOnly) {
        const orderHistory = await query('SELECT COUNT(*)::integer AS order_count FROM orders WHERE customer_id = $1', [Customer_ID]);
        if (Number(orderHistory.rows[0]?.order_count) > 0) {
          return res.status(400).json({ error: 'NEW20 is available on your first ShopNiro order only.' });
        }
      }
    }
    const eligibleProductIds = new Set(activeEligibleProducts.map((product: any) => product.id));
    const originalSubtotal = cartProducts.rows.reduce((total: number, product: any) => total + (Number(product.price) || 0) * Number(product.quantity), 0);
    const cartDiscountEligible = originalSubtotal >= 500;
    const shippingFee = originalSubtotal >= 400 ? 0 : 5;
    const requestedBundleIds = appliedCodes.filter((code: string) => code.startsWith('BUNDLE:')).map((code: string) => code.slice('BUNDLE:'.length));
    const bundleRows = requestedBundleIds.length ? await query(`
      SELECT id, seller_id, name, product_ids_json, discount_percent, ends_at, active
      FROM seller_bundles
      WHERE id = ANY($1::varchar[]) AND active = TRUE AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
    `, [requestedBundleIds]) : { rows: [] as any[] };
    const activeBundles: ProductBundle[] = bundleRows.rows.map((bundle: any) => ({
      Bundle_ID: bundle.id,
      Seller_ID: bundle.seller_id,
      Name: bundle.name,
      Product_IDs: Array.isArray(bundle.product_ids_json) ? bundle.product_ids_json : [],
      Discount_Percent: Number(bundle.discount_percent),
      Ends_At: bundle.ends_at ? new Date(bundle.ends_at).toISOString() : undefined,
      Active: Boolean(bundle.active),
    }));
    const bundlePricing = calculateBundlePrices(cartProducts.rows.map((product: any) => ({
      Product_ID: product.id,
      Price: eligibleProductIds.has(product.id) ? discountedPriceForVoucher(Number(product.price) || 0, voucherCode) : Number(product.price) || 0,
      Quantity: Number(product.quantity) || 0,
    })), activeBundles);
    const pricingRows = cartProducts.rows.map((product: any) => {
      const originalPrice = Number(product.price) || 0;
      const voucherPrice = eligibleProductIds.has(product.id) ? discountedPriceForVoucher(originalPrice, voucherCode) : originalPrice;
      const bundlePrice = bundlePricing.unitPrices.get(product.id) ?? voucherPrice;
      const unitPrice = cartDiscountEligible ? discountedUnitPrice(bundlePrice, 5) : bundlePrice;
      return { product_id: product.id, unit_price: unitPrice };
    });

    // Checkout uses the database procedure to validate stock and create per-seller fulfillment rows.
    await query(`CALL process_checkout($1, $2, $3, $4, $5, $6, $7)`, [
      id,
      Tracking_ID,
      Customer_ID,
      shippingFee,
      shipAddrJson,
      billAddrJson,
      addInfo,
    ]);

    await query(`
      UPDATE order_items oi
      SET unit_price = pricing.unit_price
      FROM jsonb_to_recordset($2::jsonb) AS pricing(product_id VARCHAR, unit_price NUMERIC)
      WHERE oi.order_id = $1 AND oi.product_id_snapshot = pricing.product_id
    `, [id, JSON.stringify(pricingRows)]);

    await query(`
      UPDATE seller_fulfillments sf SET
        subtotal = COALESCE((
          SELECT SUM(oi.unit_price * oi.quantity) FROM order_items oi
          WHERE oi.order_id = sf.order_id AND oi.seller_id_snapshot = sf.seller_id
        ), 0),
        items_json = COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'Product_ID', oi.product_id_snapshot,
            'Name', oi.product_name,
            'Price', oi.unit_price,
            'Quantity', oi.quantity,
            'Image', COALESCE(oi.image, ''),
            'Size', NULLIF(oi.size, ''),
            'Seller_ID', oi.seller_id_snapshot
          ) ORDER BY oi.order_item_id)
          FROM order_items oi
          WHERE oi.order_id = sf.order_id AND oi.seller_id_snapshot = sf.seller_id
        ), '[]'::jsonb)
      WHERE sf.order_id = $1
    `, [id]);
    const orderedItems = await query(`
      SELECT product_id_snapshot, seller_id_snapshot, product_name, unit_price, quantity, image, size
      FROM order_items WHERE order_id = $1 ORDER BY order_item_id
    `, [id]);
    const finalSubtotal = orderedItems.rows.reduce(
      (total: number, item: any) => total + Number(item.unit_price) * Number(item.quantity),
      0
    );
    const recordedPromotions = [voucherCode, ...bundlePricing.appliedBundleIds.map((bundleId) => `BUNDLE:${bundleId}`), cartDiscountEligible ? 'CART5' : ''].filter(Boolean).join('+');
    await query(`
      UPDATE orders SET subtotal = $2, items_json = $3, applied_voucher = $4 WHERE id = $1
    `, [id, finalSubtotal, JSON.stringify(orderedItems.rows.map((item: any) => ({
      Product_ID: item.product_id_snapshot,
      Seller_ID: item.seller_id_snapshot,
      Name: item.product_name,
      Price: Number(item.unit_price),
      Quantity: Number(item.quantity),
      Image: item.image || '',
      Size: item.size || undefined,
    }))), recordedPromotions]);

    const newOrder: Order = {
      Order_ID: id,
      Tracking_ID,
      Customer_ID,
      Items: orderedItems.rows.map((item: any) => ({
        Product_ID: item.product_id_snapshot,
        Seller_ID: item.seller_id_snapshot,
        Name: item.product_name,
        Price: Number(item.unit_price),
        Quantity: Number(item.quantity),
        Image: item.image || '',
        Size: item.size || undefined,
      })),
      Subtotal: finalSubtotal,
      Shipping_Fee: shippingFee,
      Status: 'placed',
      Payment_Status: 'pending',
      Payment_Method: 'cash_on_delivery',
      Transaction_ID: '',
      Applied_Voucher: recordedPromotions || undefined,
      Currency: 'BDT',
      Shipping_Address,
      Billing_Address: Billing_Address || Shipping_Address,
      Order_Placed_At: orderPlacedAt,
      Additional_Info: addInfo,
    };

    res.status(201).json(newOrder);
  } catch (error: any) {
    console.error('Error placing order:', error);
    const status = error.message?.startsWith('Checkout Failed:') ? 409 : 500;
    res.status(status).json({ error: error.message || 'Failed to place order' });
  }
});

router.get('/cancellation-requests', requireAuth, async (req: AuthRequest, res) => {
  if (!['customer', 'admin'].includes(req.user!.role)) return res.status(403).json({ error: 'You cannot view cancellation requests.' });
  try {
    const result = await query(
      `SELECT request.id, request.order_id, request.customer_id, order_record.status AS order_status,
        order_record.payment_status, request.reason, request.status, request.requested_at,
        request.reviewed_at, request.refund_completed_at
       FROM order_cancellation_requests request
       JOIN orders order_record ON order_record.id = request.order_id
       WHERE ($1::varchar IS NULL OR request.customer_id = $1)
       ORDER BY request.requested_at DESC`,
      [req.user!.role === 'customer' ? req.user!.entityId : null]
    );
    res.json(result.rows.map((row) => ({
      Request_ID: row.id,
      Order_ID: row.order_id,
      Customer_ID: row.customer_id,
      Order_Status: row.order_status,
      Payment_Status: row.payment_status,
      Reason: row.reason,
      Status: row.status,
      Requested_At: new Date(row.requested_at).toISOString(),
      Reviewed_At: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
      Refund_Completed_At: row.refund_completed_at ? new Date(row.refund_completed_at).toISOString() : undefined,
    })));
  } catch (error: any) {
    console.error('Could not list cancellation requests:', error);
    res.status(500).json({ error: 'Could not load cancellation requests.' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT o.id, o.customer_id, o.status, o.payment_status, o.payment_method,
          o.transaction_id, o.subtotal, o.shipping_fee, o.tracking_id, o.items_json,
          o.shipping_address_json, o.billing_address_json, o.applied_voucher,
          o.order_placed_at, o.additional_info
       FROM orders o WHERE o.id = $1 AND o.customer_id = $2`,
      [req.params.id, req.user!.entityId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found.' });
    const order = result.rows[0];
    res.json({
      Order_ID: order.id,
      Tracking_ID: order.tracking_id || '',
      Customer_ID: order.customer_id,
      Items: typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []),
      Subtotal: Number(order.subtotal),
      Shipping_Fee: Number(order.shipping_fee),
      Status: order.status,
      Payment_Status: order.payment_status || 'pending',
      Payment_Method: order.payment_method || 'cash_on_delivery',
      Transaction_ID: order.transaction_id || '',
      Applied_Voucher: order.applied_voucher || undefined,
      Currency: 'BDT',
      Shipping_Address: order.shipping_address_json ? (typeof order.shipping_address_json === 'string' ? JSON.parse(order.shipping_address_json) : order.shipping_address_json) : {},
      Billing_Address: order.billing_address_json ? (typeof order.billing_address_json === 'string' ? JSON.parse(order.billing_address_json) : order.billing_address_json) : {},
      Order_Placed_At: order.order_placed_at ? new Date(order.order_placed_at).toISOString() : new Date().toISOString(),
      Additional_Info: order.additional_info || '',
    });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order.' });
  }
});

router.post('/:id/cancellation-request', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can request order cancellation.' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
  try {
    const orderResult = await query(
      `SELECT o.id, o.status, o.payment_status,
        EXISTS (SELECT 1 FROM seller_fulfillments sf WHERE sf.order_id = o.id AND sf.status = 'shipped') AS has_shipped_fulfillment
       FROM orders o WHERE o.id = $1 AND o.customer_id = $2`,
      [req.params.id, req.user.entityId]
    );
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!['placed', 'processing'].includes(order.status) || order.has_shipped_fulfillment) {
      return res.status(409).json({ error: 'Cancellation is available only before any part of the order ships.' });
    }

    const request = await query(
      `INSERT INTO order_cancellation_requests (id, order_id, customer_id, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (order_id) DO UPDATE SET
         reason = EXCLUDED.reason, status = 'pending', requested_at = CURRENT_TIMESTAMP,
         reviewed_at = NULL, reviewed_by = NULL, refund_completed_at = NULL
       WHERE order_cancellation_requests.status = 'rejected'
       RETURNING id, order_id, customer_id, reason, status, requested_at`,
      [`CANCEL-${randomUUID()}`, order.id, req.user.entityId, reason]
    );
    if (!request.rows.length) return res.status(409).json({ error: 'A cancellation request is already open for this order.' });
    res.status(201).json({ ...request.rows[0], order_status: order.status, payment_status: order.payment_status });
  } catch (error: any) {
    console.error('Could not request order cancellation:', error);
    res.status(500).json({ error: 'Could not submit your cancellation request.' });
  }
});

router.patch('/cancellation-requests/:requestId/review', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Only admins can review cancellation requests.' });
  const decision = req.body?.decision;
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Choose approve or reject.' });

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT request.id, request.order_id, request.status AS request_status,
        order_record.status AS order_status, order_record.payment_status
       FROM order_cancellation_requests request
       JOIN orders order_record ON order_record.id = request.order_id
       WHERE request.id = $1 FOR UPDATE OF request, order_record`,
      [req.params.requestId]
    );
    const request = result.rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cancellation request not found.' });
    }
    if (request.request_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This cancellation request has already been reviewed.' });
    }
    const refundCompleted = req.body?.refundCompleted === true;
    if (decision === 'approved' && request.payment_status === 'paid' && !refundCompleted) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Complete the refund with the payment provider before approving this paid order.' });
    }
    if (decision === 'approved' && !['placed', 'processing'].includes(request.order_status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The order has shipped and can no longer be cancelled.' });
    }
    if (decision === 'approved') {
      await client.query('SELECT * FROM gocart_order_status_update($1, $2)', [request.order_id, 'cancelled']);
      await client.query(
        `SELECT product.id
         FROM products product
         JOIN (
           SELECT product_id_snapshot
           FROM order_items
           WHERE order_id = $1
           GROUP BY product_id_snapshot
         ) cancelled_item ON cancelled_item.product_id_snapshot = product.id
         ORDER BY product.id
         FOR UPDATE OF product`,
        [request.order_id]
      );
      await client.query(
        `UPDATE products product
         SET stock = product.stock + cancelled_item.quantity
         FROM (
           SELECT product_id_snapshot, SUM(quantity)::INTEGER AS quantity
           FROM order_items
           WHERE order_id = $1
           GROUP BY product_id_snapshot
         ) cancelled_item
         WHERE product.id = cancelled_item.product_id_snapshot`,
        [request.order_id]
      );
      if (request.payment_status === 'paid') {
        await client.query("UPDATE orders SET payment_status = 'refunded' WHERE id = $1", [request.order_id]);
        await client.query("UPDATE payments SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1", [request.order_id]);
      }
    }
    await client.query(
      `UPDATE order_cancellation_requests SET status = $2, reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $3, refund_completed_at = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $1`,
      [req.params.requestId, decision, req.user!.entityId, refundCompleted]
    );
    await client.query('COMMIT');
    res.json({ success: true, status: decision });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Could not review cancellation request:', error);
    res.status(500).json({ error: 'Could not review cancellation request.' });
  } finally {
    client?.release();
  }
});

/**
 * PATCH /api/orders/:id/status
 * Updates order status (via schema gocart_order_status_update)
 */
router.patch('/:id/revert-failed-payment', requireAuth, async (req: AuthRequest, res) => {
  let client: PoolClient | undefined;
  try {
    if (req.user?.role !== 'customer') {
      return res.status(403).json({ error: 'Only customers can revert a failed online payment.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const paymentResult = await client.query(
      `SELECT status FROM payments WHERE order_id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const orderResult = await client.query(
      `SELECT id, customer_id, status, payment_status
       FROM orders WHERE id = $1 AND customer_id = $2 FOR UPDATE`,
      [req.params.id, req.user.entityId]
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.payment_status !== 'pending' || paymentResult.rows.some((payment) => payment.status === 'VALIDATED')) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This payment was already completed. The order was not returned to the cart.' });
    }
    if (!['placed', 'processing'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This order can no longer be restored to the cart.' });
    }

    const items = await client.query(
      `SELECT product_id_snapshot AS product_id, quantity, size
       FROM order_items WHERE order_id = $1 ORDER BY order_item_id`,
      [order.id]
    );

    for (const item of items.rows) {
      const existing = await client.query(`SELECT * FROM gocart_cart_existing($1, $2, $3)`, [req.user.entityId, item.product_id, item.size || '']);
      if (existing.rows.length > 0) {
        const currentItem: any = existing.rows[0];
        await client.query(`SELECT * FROM gocart_cart_update($1, $2, $3)`, [currentItem.id, Number(currentItem.quantity) + Number(item.quantity), req.user.entityId]);
      } else {
        const cartId = `CART-${randomUUID()}`;
        await client.query(`SELECT * FROM gocart_cart_create($1, $2, $3, $4, $5)`, [cartId, req.user.entityId, item.product_id, Number(item.quantity), item.size || '']);
      }
    }

    await client.query(`DELETE FROM payments WHERE order_id = $1`, [order.id]);
    await client.query(`DELETE FROM orders WHERE id = $1 AND customer_id = $2`, [order.id, req.user.entityId]);
    await client.query('COMMIT');

    res.json({
      success: true,
      order_id: order.id,
      restored_to_cart: true,
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Could not restore failed online payment order to cart:', error);
    res.status(500).json({ error: 'Could not restore your cart items.' });
  } finally {
    client?.release();
  }
});

router.patch('/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const status = req.body?.status ?? req.body?.Status;
    if (!status || !['placed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Valid order status is required' });
    }

    const actor = req.user!;
    const accessResult = await query(
      `SELECT o.customer_id, o.status,
        EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND oi.seller_id_snapshot = $2
        ) AS seller_owns_order
      FROM orders o WHERE o.id = $1`,
      [id, actor.entityId]
    );
    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const existingOrder = accessResult.rows[0];
    let result;
    if (actor.role === 'customer') {
      return res.status(403).json({ error: 'Delivery completion requires the confirmation code from the customer portal.' });
    } else if (actor.role === 'seller') {
      if (!existingOrder.seller_owns_order) {
        return res.status(403).json({ error: 'You can only update orders containing your products' });
      }
      if (!['processing', 'shipped'].includes(status)) {
        return res.status(403).json({ error: 'Sellers may set orders to processing or shipped' });
      }
      if (['shipped', 'delivered', 'cancelled'].includes(existingOrder.status) && status !== existingOrder.status) {
        return res.status(409).json({ error: 'This order can no longer move back to an earlier status' });
      }
      if (status === 'processing') {
        await query(
          `UPDATE seller_fulfillments SET status = 'processing'
          WHERE order_id = $1 AND seller_id = $2 AND status = 'processing'`,
          [id, actor.entityId]
        );
        result = await query(`SELECT * FROM gocart_orders_list() WHERE id = $1`, [id]);
      } else {
        const fulfillmentResult = await query(
          `UPDATE seller_fulfillments sf
          SET status = 'shipped', shipped_at = COALESCE(shipped_at, CURRENT_TIMESTAMP)
          WHERE sf.order_id = $1 AND sf.seller_id = $2
            AND (sf.status = 'processing' OR (sf.status = 'shipped' AND NOT EXISTS (
              SELECT 1 FROM rider_deliveries rd WHERE rd.fulfillment_id = sf.id
            )))
          RETURNING id, seller_id, subtotal`,
          [id, actor.entityId]
        );
        if (!fulfillmentResult.rows.length) {
          return res.status(409).json({ error: 'This seller shipment is already dispatched or not ready to ship.' });
        }

        const fulfillment = fulfillmentResult.rows[0];
        const orderFinancials = await query(
          `SELECT subtotal, shipping_fee, payment_method FROM orders WHERE id = $1`,
          [id]
        );
        const financials = orderFinancials.rows[0];
        const fulfillmentSubtotal = Number(fulfillment.subtotal) || 0;
        const orderSubtotal = Number(financials?.subtotal) || 0;
        const shippingShare = orderSubtotal > 0 ? (Number(financials.shipping_fee) * fulfillmentSubtotal) / orderSubtotal : 0;
        const codAmount = financials?.payment_method === 'cash_on_delivery' ? fulfillmentSubtotal + shippingShare : 0;
        const deliveryId = `DLV-${fulfillment.id.slice(-24)}`;
        const confirmationCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
        await query(
          `INSERT INTO rider_deliveries (id, fulfillment_id, status, confirmation_code, cod_amount)
          VALUES ($1, $2, 'pending', $3, $4)
          ON CONFLICT (fulfillment_id) DO NOTHING`,
          [deliveryId, fulfillment.id, confirmationCode, codAmount]
        );
        await query(`UPDATE orders SET status = 'shipped' WHERE id = $1 AND status NOT IN ('delivered', 'cancelled')`, [id]);
        result = await query(`SELECT * FROM gocart_orders_list() WHERE id = $1`, [id]);
      }
    } else if (actor.role === 'admin') {
      result = await query(`SELECT * FROM gocart_order_status_update($1, $2)`, [id, status]);
    } else {
      return res.status(403).json({ error: 'Your role cannot update order status' });
    }

    const o = result.rows[0];
    res.json({
      Order_ID: o.id,
      Tracking_ID: o.tracking_id || '',
      Customer_ID: o.customer_id,
      Items: typeof o.items_json === 'string' ? JSON.parse(o.items_json) : (o.items_json || []),
      Subtotal: Number(o.subtotal),
      Shipping_Fee: Number(o.shipping_fee),
      Status: o.status as any,
      Payment_Status: 'paid',
      Payment_Method: 'bkash',
      Shipping_Address: o.shipping_address_json ? (typeof o.shipping_address_json === 'string' ? JSON.parse(o.shipping_address_json) : o.shipping_address_json) : { Street: '', House_Name: '', City: '', Postal_Code: '' },
      Billing_Address: o.billing_address_json ? (typeof o.billing_address_json === 'string' ? JSON.parse(o.billing_address_json) : o.billing_address_json) : { Street: '', House_Name: '', City: '', Postal_Code: '' },
      Order_Placed_At: o.order_placed_at ? new Date(o.order_placed_at).toISOString() : new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
