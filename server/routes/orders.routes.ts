import { Router } from 'express';
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
      Payment_Status: 'paid',
      Payment_Method: 'bkash',
      Transaction_ID: o.tracking_id || '',
      Currency: 'BDT',
      Shipping_Address: o.shipping_address_json ? (typeof o.shipping_address_json === 'string' ? JSON.parse(o.shipping_address_json) : o.shipping_address_json) : { Street: '', House_Name: '', City: '', Postal_Code: '' },
      Billing_Address: o.billing_address_json ? (typeof o.billing_address_json === 'string' ? JSON.parse(o.billing_address_json) : o.billing_address_json) : { Street: '', House_Name: '', City: '', Postal_Code: '' },
      Order_Placed_At: o.order_placed_at ? new Date(o.order_placed_at).toISOString() : new Date().toISOString(),
      Additional_Info: o.additional_info || '',
    }));

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
      if (status !== 'delivered') {
        return res.status(403).json({ error: 'Customers can only confirm delivery of their own shipped orders' });
      }
      result = await query(
        `UPDATE orders SET status = 'delivered'
        WHERE id = $1 AND customer_id = $2 AND status = 'shipped'
        RETURNING *`,
        [id, actor.entityId]
      );
      if (result.rows.length === 0) {
        return res.status(409).json({ error: 'Only your shipped orders can be marked delivered' });
      }
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
      result = await query(`SELECT * FROM gocart_order_status_update($1, $2)`, [id, status]);
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
