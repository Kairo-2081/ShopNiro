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

    // Check if cart has items to use stored procedure process_checkout
    const cartRes = await query(`SELECT * FROM gocart_cart_list($1)`, [Customer_ID]);
    if (cartRes.rows.length > 0) {
      try {
        await query(`CALL process_checkout($1, $2, $3, $4, $5, $6, $7)`, [
          id,
          Tracking_ID,
          Customer_ID,
          shippingFee,
          shipAddrJson,
          billAddrJson,
          addInfo,
        ]);
      } catch (procErr: any) {
        // Fallback to gocart_seed_row
        await query(`SELECT gocart_seed_row('orders', $1::jsonb)`, [
          JSON.stringify({
            id,
            tracking_id: Tracking_ID,
            customer_id: Customer_ID,
            items_json: JSON.stringify(Items),
            subtotal,
            shipping_fee: shippingFee,
            status: 'placed',
            shipping_address_json: shipAddrJson,
            billing_address_json: billAddrJson,
            additional_info: addInfo,
            order_placed_at: orderPlacedAt,
          }),
        ]);
      }
    } else {
      // Direct insertion via schema gocart_seed_row
      await query(`SELECT gocart_seed_row('orders', $1::jsonb)`, [
        JSON.stringify({
          id,
          tracking_id: Tracking_ID,
          customer_id: Customer_ID,
          items_json: JSON.stringify(Items),
          subtotal,
          shipping_fee: shippingFee,
          status: 'placed',
          shipping_address_json: shipAddrJson,
          billing_address_json: billAddrJson,
          additional_info: addInfo,
          order_placed_at: orderPlacedAt,
        }),
      ]);
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
    res.status(500).json({ error: error.message || 'Failed to place order' });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Updates order status (via schema gocart_order_status_update)
 */
router.patch('/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['placed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Valid order status is required' });
    }

    const result = await query(`SELECT * FROM gocart_order_status_update($1, $2)`, [id, status]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
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
