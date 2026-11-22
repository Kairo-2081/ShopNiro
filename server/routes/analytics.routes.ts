import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { analyticsEventBody } from '../validation/schemas.ts';

const router = Router();

router.post('/events', validateBody(analyticsEventBody), async (req, res) => {
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
    req.log.error({ err: error }, 'Error recording product event:');
    res.status(500).json({ error: 'Could not record product analytics.' });
  }
});

/**
 * GET /api/analytics/monthly?months=25
 * Calendar-month totals counted in the database, so the dashboards stay right however many orders there are (the app
 * only loads the newest page of orders). A customer gets their own orders, a seller the lines of their own products,
 * the admin marketplace-wide counts and sums with no names or order details. Months are Asia/Dhaka months.
 */
router.get('/monthly', requireAuth, requireRole(['customer', 'seller', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { role, entityId } = req.user!;
    const months = Math.min(36, Math.max(1, Math.floor(Number(req.query.months)) || 25));
    const month = "date_trunc('month', o.order_placed_at AT TIME ZONE 'Asia/Dhaka')";
    const since = "date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka') - make_interval(months => $1::int)";
    const billable = "o.status <> 'cancelled' AND o.payment_status <> 'refunded'";
    const result = role === 'seller'
      ? await query(`
          SELECT EXTRACT(YEAR FROM ${month})::int AS year, EXTRACT(MONTH FROM ${month})::int AS month,
            COUNT(DISTINCT o.id)::int AS orders,
            COUNT(DISTINCT o.id) FILTER (WHERE ${billable})::int AS billable,
            COALESCE(SUM(i.unit_price * i.quantity) FILTER (WHERE ${billable}), 0)::float8 AS value,
            COALESCE(SUM(i.quantity) FILTER (WHERE ${billable}), 0)::int AS units,
            COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered')::int AS delivered
          FROM orders o JOIN order_items i ON i.order_id = o.id
          WHERE i.seller_id_snapshot = $2 AND o.order_placed_at AT TIME ZONE 'Asia/Dhaka' >= ${since}
          GROUP BY 1, 2 ORDER BY 1, 2`, [months - 1, entityId])
      : await query(`
          SELECT EXTRACT(YEAR FROM ${month})::int AS year, EXTRACT(MONTH FROM ${month})::int AS month,
            COUNT(*)::int AS orders,
            COUNT(*) FILTER (WHERE ${billable})::int AS billable,
            COALESCE(SUM(o.subtotal + o.shipping_fee) FILTER (WHERE ${billable}), 0)::float8 AS value,
            0::int AS units,
            COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered
          FROM orders o
          WHERE ($2::text IS NULL OR o.customer_id = $2) AND o.order_placed_at AT TIME ZONE 'Asia/Dhaka' >= ${since}
          GROUP BY 1, 2 ORDER BY 1, 2`, [months - 1, role === 'customer' ? entityId : null]);
    return res.json({ months: result.rows });
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching monthly totals:');
    return res.status(500).json({ error: 'Failed to fetch monthly totals' });
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
    req.log.error({ err: error }, 'Error fetching seller product analytics:');
    res.status(500).json({ error: 'Could not load product analytics.' });
  }
});

export default router;
