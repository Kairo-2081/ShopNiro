import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';

const router = Router();

router.post('/events', async (req, res) => {
  const productId = typeof req.body?.Product_ID === 'string' ? req.body.Product_ID.trim() : '';
  const eventType = req.body?.Event_Type;
  const sessionId = typeof req.body?.Session_ID === 'string' ? req.body.Session_ID : '';
  if (!productId || !['impression', 'click'].includes(eventType) || !/^[a-zA-Z0-9_-]{16,64}$/.test(sessionId)) {
    return res.status(400).json({ error: 'A valid product event is required.' });
  }

  try {
    await query(`
      INSERT INTO product_analytics_events (product_id, event_type, session_id)
      SELECT id, $2, $3 FROM products
      WHERE id = $1 AND product_status = 'active'
      ON CONFLICT (product_id, event_type, session_id, event_date) DO NOTHING
    `, [productId, eventType, sessionId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error recording product event:', error);
    res.status(500).json({ error: 'Could not record product analytics.' });
  }
});

router.get('/seller', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT product.id AS product_id,
        COALESCE(events.impressions_7d, 0)::integer AS impressions_7d,
        COALESCE(events.clicks_7d, 0)::integer AS clicks_7d,
        COALESCE(events.impressions_previous_7d, 0)::integer AS impressions_previous_7d,
        COALESCE(events.clicks_previous_7d, 0)::integer AS clicks_previous_7d,
        COALESCE(sales.returned_units_30d, 0)::integer AS returned_units_30d,
        COALESCE(sales.sold_units_30d, 0)::integer AS sold_units_30d
      FROM products product
      LEFT JOIN (
        SELECT product_id,
          COUNT(*) FILTER (WHERE event_type = 'impression' AND event_date >= CURRENT_DATE - 6) AS impressions_7d,
          COUNT(*) FILTER (WHERE event_type = 'click' AND event_date >= CURRENT_DATE - 6) AS clicks_7d,
          COUNT(*) FILTER (WHERE event_type = 'impression' AND event_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE - 7) AS impressions_previous_7d,
          COUNT(*) FILTER (WHERE event_type = 'click' AND event_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE - 7) AS clicks_previous_7d
        FROM product_analytics_events
        GROUP BY product_id
      ) events ON events.product_id = product.id
      LEFT JOIN (
        SELECT item.product_id_snapshot AS product_id,
          SUM(item.quantity) FILTER (WHERE order_record.payment_status = 'refunded') AS returned_units_30d,
          SUM(item.quantity) FILTER (WHERE order_record.payment_status <> 'refunded' AND order_record.status <> 'cancelled') AS sold_units_30d
        FROM order_items item
        JOIN orders order_record ON order_record.id = item.order_id
        WHERE order_record.order_placed_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        GROUP BY item.product_id_snapshot
      ) sales ON sales.product_id = product.id
      WHERE product.seller_id = $1
      ORDER BY product.name
    `, [req.user!.entityId]);

    res.json(result.rows.map((row) => {
      const impressions = Number(row.impressions_7d) || 0;
      const clicks = Number(row.clicks_7d) || 0;
      const previousImpressions = Number(row.impressions_previous_7d) || 0;
      const previousClicks = Number(row.clicks_previous_7d) || 0;
      const returnedUnits = Number(row.returned_units_30d) || 0;
      const soldUnits = Number(row.sold_units_30d) || 0;
      const ctr = impressions ? (clicks / impressions) * 100 : null;
      const previousCtr = previousImpressions ? (previousClicks / previousImpressions) * 100 : null;
      const returnRate = returnedUnits + soldUnits ? (returnedUnits / (returnedUnits + soldUnits)) * 100 : null;
      return {
        Product_ID: row.product_id,
        Impressions_7d: impressions,
        Clicks_7d: clicks,
        CTR_7d: ctr,
        CTR_Previous_7d: previousCtr,
        Returned_Units_30d: returnedUnits,
        Sold_Units_30d: soldUnits,
        Return_Rate_30d: returnRate,
      };
    }));
  } catch (error) {
    console.error('Error fetching seller product analytics:', error);
    res.status(500).json({ error: 'Could not load product analytics.' });
  }
});

export default router;
