import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { query } from '../db/index.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { Order } from '../../src/types.ts';

const router = Router();

/**
 * GET /api/orders
 * Retrieve orders (via schema gocart_orders_list)
 */
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { customerId, sellerId } = req.query;
    const result = await query(`SELECT * FROM gocart_orders_list()`);

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

    if (customerId) {
      formatted = formatted.filter((o) => o.Customer_ID === customerId);
    }
    if (sellerId) {
      formatted = formatted.filter((o) => o.Items.some((item: any) => item.Seller_ID === sellerId));
    }

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
      Shipping_Address,
      Billing_Address,
      Subtotal,
      Shipping_Fee,
      Additional_Info,
      Payment_Status = 'paid',
      Payment_Method = 'bkash',
      Transaction_ID = '',
    } = req.body;
    if (!Customer_ID || !Items || !Items.length || !Shipping_Address) {
      return res.status(400).json({ error: 'Customer_ID, Items, and Shipping Address are required' });
    }

    const trackNum1 = Math.floor(1000 + Math.random() * 9000);
    const trackNum2 = Math.floor(1000 + Math.random() * 9000);
    const Tracking_ID = `TRK-${trackNum1}-${trackNum2}`;
    const id = `ORD-${Date.now()}`;
    const subtotal = Number(Subtotal) || 0;
    const shippingFee = Number(Shipping_Fee) || 0.0;
    const shipAddrJson = JSON.stringify(Shipping_Address);
    const billAddrJson = JSON.stringify(Billing_Address || Shipping_Address);
    const addInfo = Additional_Info || '';
    const orderPlacedAt = new Date().toISOString();

    // Checkout must use the database procedure so stock is validated and decremented atomically.
    const cartRes = await query(`SELECT * FROM gocart_cart_list($1)`, [Customer_ID]);
    if (cartRes.rows.length === 0) {
      return res.status(400).json({ error: 'Checkout Failed: The shopping cart is empty.' });
    }

    await query(`CALL process_checkout($1, $2, $3, $4, $5, $6, $7)`, [
      id,
      Tracking_ID,
      Customer_ID,
      shippingFee,
      shipAddrJson,
      billAddrJson,
      addInfo,
    ]);

    await query(
      'UPDATE orders SET payment_status = $2, payment_method = $3, transaction_id = $4 WHERE id = $1',
      [id, Payment_Status, Payment_Method, Transaction_ID || null]
    );
    if (Transaction_ID && Payment_Method !== 'cash_on_delivery') {
      await query(
        'UPDATE payments SET order_id = $2 WHERE transaction_id = $1',
        [Transaction_ID, id]
      );
    }

    const newOrder: Order = {
      Order_ID: id,
      Tracking_ID,
      Customer_ID,
      Items,
      Subtotal: subtotal,
      Shipping_Fee: shippingFee,
      Status: 'placed',
      Payment_Status,
      Payment_Method,
      Transaction_ID: Transaction_ID || Tracking_ID,
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

/**
 * PATCH /api/orders/:id/status
 * Updates order status (via schema gocart_order_status_update)
 */
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
