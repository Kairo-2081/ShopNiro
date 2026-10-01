import { Router } from 'express';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { pool, query } from '../db/index.ts';

const router = Router();

const requireApprovedRider = async (req: AuthRequest, res: any, next: (error?: unknown) => void) => {
  try {
    const result = await query('SELECT status FROM riders WHERE id = $1', [req.user!.entityId]);
    if (!result.rows.length || result.rows[0].status !== 'approved') {
      return res.status(403).json({ error: 'An approved rider account is required.' });
    }
    next();
  } catch (error) {
    next(error);
  }
};

const parseJson = (value: any) => typeof value === 'string' ? JSON.parse(value) : value || {};
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const salaryForPoints = (points: number) => Math.round(30000 * Math.max(0, Math.min(100, points)) / 100 * 100) / 100;

async function creditAvailableSalary(client: any, riderId: string) {
  await client.query(`
    WITH credited AS (
      INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description)
      SELECT 'SAL-' || ms.rider_id || '-' || to_char(ms.month_start, 'YYYYMM'),
        ms.rider_id, 'salary', ms.salary_amount, to_char(ms.month_start, 'YYYY-MM'),
        'Monthly salary for ' || to_char(ms.month_start, 'Month YYYY')
      FROM rider_monthly_scores ms
      WHERE ms.rider_id = $1
        AND ms.month_start < date_trunc('month', CURRENT_DATE)::date
        AND ms.salary_available_at <= CURRENT_TIMESTAMP
      ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING
      RETURNING rider_id, amount
    ), totals AS (
      SELECT rider_id, SUM(amount) AS amount FROM credited GROUP BY rider_id
    )
    UPDATE riders r SET wallet_balance = r.wallet_balance + totals.amount, updated_at = CURRENT_TIMESTAMP
    FROM totals WHERE r.id = totals.rider_id
  `, [riderId]);
}

router.patch('/location', requireAuth, requireRole(['rider']), requireApprovedRider, async (req: AuthRequest, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Choose a valid location on the map.' });
  }
  try {
    await query('UPDATE riders SET current_latitude = $2, current_longitude = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.user!.entityId, latitude, longitude]);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Could not save rider location:', error);
    return res.status(500).json({ error: 'Could not save current location.' });
  }
});

router.get('/deliveries', requireAuth, requireRole(['rider']), requireApprovedRider, async (req: AuthRequest, res) => {
  try {
    const riderResult = await query('SELECT current_latitude, current_longitude FROM riders WHERE id = $1', [req.user!.entityId]);
    const currentLatitude = riderResult.rows[0]?.current_latitude;
    const currentLongitude = riderResult.rows[0]?.current_longitude;
    if (currentLatitude === null || currentLatitude === undefined || currentLongitude === null || currentLongitude === undefined) {
      return res.status(409).json({ error: 'Save your current map location before loading deliveries.' });
    }

    const result = await query(`
      SELECT rd.id AS delivery_id, rd.status AS delivery_status, rd.confirmation_code, rd.cod_amount, rd.cod_collected,
        rd.rider_id, sf.id AS fulfillment_id, sf.order_id, sf.seller_id, sf.items_json,
        sf.subtotal AS fulfillment_subtotal, s.name AS seller_name,
        s.address_latitude AS pickup_latitude, s.address_longitude AS pickup_longitude,
        o.shipping_address_json, o.payment_method, c.name AS customer_name, c.number AS customer_number
      FROM rider_deliveries rd
      JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
      JOIN sellers s ON s.id = sf.seller_id
      JOIN orders o ON o.id = sf.order_id
      JOIN customers c ON c.id = o.customer_id
      WHERE rd.status = 'pending' OR (rd.rider_id = $1 AND rd.status IN ('accepted', 'on_the_way'))
    `, [req.user!.entityId]);

    const deliveries = result.rows.map((row: any) => {
      const hasPickup = row.pickup_latitude !== null && row.pickup_longitude !== null;
      return {
        Delivery_ID: row.delivery_id,
        Order_ID: row.order_id,
        Seller_Fulfillment_ID: row.fulfillment_id,
        Seller_ID: row.seller_id,
        Seller_Name: row.seller_name,
        Rider_ID: row.rider_id || undefined,
        Status: row.delivery_status,
        Confirmation_Code: row.confirmation_code,
        COD_Amount: Number(row.cod_amount) || 0,
        COD_Collected: Boolean(row.cod_collected),
        Distance_KM: hasPickup ? haversineKm(Number(currentLatitude), Number(currentLongitude), Number(row.pickup_latitude), Number(row.pickup_longitude)) : null,
        Items: parseJson(row.items_json),
        Shipping_Address: parseJson(row.shipping_address_json),
        Payment_Method: row.payment_method,
        Customer_Name: row.customer_name,
        Customer_Number: row.customer_number || '',
      };
    }).sort((left: any, right: any) => {
      const leftActive = left.Rider_ID === req.user!.entityId;
      const rightActive = right.Rider_ID === req.user!.entityId;
      if (leftActive !== rightActive) return leftActive ? -1 : 1;
      return (left.Distance_KM ?? Number.MAX_SAFE_INTEGER) - (right.Distance_KM ?? Number.MAX_SAFE_INTEGER);
    });
    return res.json(deliveries);
  } catch (error: any) {
    console.error('Could not load rider deliveries:', error);
    return res.status(500).json({ error: 'Could not load available deliveries.' });
  }
});

router.post('/deliveries/:id/accept', requireAuth, requireRole(['rider']), requireApprovedRider, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `UPDATE rider_deliveries SET rider_id = $2, status = 'accepted', accepted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending' AND rider_id IS NULL RETURNING id`,
      [req.params.id, req.user!.entityId]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'This delivery was already accepted or is no longer available.' });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Could not accept rider delivery:', error);
    return res.status(500).json({ error: 'Could not accept this delivery.' });
  }
});

router.post('/deliveries/:id/on-way', requireAuth, requireRole(['rider']), requireApprovedRider, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `UPDATE rider_deliveries SET status = 'on_the_way'
      WHERE id = $1 AND rider_id = $2 AND status = 'accepted' RETURNING id`,
      [req.params.id, req.user!.entityId]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Accept this delivery before starting it.' });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Could not start rider delivery:', error);
    return res.status(500).json({ error: 'Could not start this delivery.' });
  }
});

router.post('/deliveries/:id/cod-collected', requireAuth, requireRole(['rider']), requireApprovedRider, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `UPDATE rider_deliveries SET cod_collected = TRUE
      WHERE id = $1 AND rider_id = $2 AND status = 'on_the_way' AND cod_amount > 0
      RETURNING id`,
      [req.params.id, req.user!.entityId]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'This delivery has no COD amount to collect or is not on the way.' });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Could not confirm COD collection:', error);
    return res.status(500).json({ error: 'Could not confirm COD collection.' });
  }
});

router.post('/deliveries/:id/complete', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const code = String(req.body?.code || '').trim();
    await client.query('BEGIN');
    const deliveryResult = await client.query(`
      SELECT rd.*, sf.order_id, sf.seller_id, o.customer_id
      FROM rider_deliveries rd
      JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
      JOIN orders o ON o.id = sf.order_id
      WHERE rd.id = $1 AND o.customer_id = $2
      FOR UPDATE OF rd
    `, [req.params.id, req.user!.entityId]);
    if (!deliveryResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Delivery not found for this customer.' });
    }
    const delivery = deliveryResult.rows[0];
    const riderId = delivery.rider_id;
    if (!riderId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No rider is assigned to this delivery yet.' });
    }
    if (delivery.status !== 'on_the_way') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Start the delivery before confirming it.' });
    }
    if (Number(delivery.confirmation_attempts) >= 5) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Too many incorrect codes. Contact ShopNiro support to verify delivery.' });
    }
    if (code.length !== 6 || code !== delivery.confirmation_code) {
      await client.query('UPDATE rider_deliveries SET confirmation_attempts = confirmation_attempts + 1 WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'The customer confirmation code is incorrect.' });
    }
    if (Number(delivery.cod_amount) > 0 && !delivery.cod_collected) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The rider must record cash collection before you confirm delivery.' });
    }

    const deliveryUpdate = await client.query(`
      UPDATE rider_deliveries
      SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP,
        was_timely = CURRENT_TIMESTAMP <= due_at
      WHERE id = $1
      RETURNING was_timely
    `, [req.params.id]);
    const wasTimely = Boolean(deliveryUpdate.rows[0].was_timely);
    await client.query(`UPDATE seller_fulfillments SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = $1`, [delivery.fulfillment_id]);
    await client.query(`
      UPDATE orders o SET status = CASE
        WHEN NOT EXISTS (SELECT 1 FROM seller_fulfillments sf WHERE sf.order_id = o.id AND sf.status <> 'delivered') THEN 'delivered'
        ELSE 'shipped' END
      WHERE o.id = $1
    `, [delivery.order_id]);
    await client.query(`
      UPDATE orders o SET payment_status = 'paid'
      WHERE o.id = $1 AND o.payment_method = 'cash_on_delivery'
        AND NOT EXISTS (
          SELECT 1 FROM seller_fulfillments sf
          LEFT JOIN rider_deliveries pending_rd ON pending_rd.fulfillment_id = sf.id
          WHERE sf.order_id = o.id
            AND (pending_rd.id IS NULL OR pending_rd.status <> 'delivered' OR NOT pending_rd.cod_collected)
        )
    `, [delivery.order_id]);

    const now = new Date();
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const scoreResult = await client.query(`
      INSERT INTO rider_monthly_scores (rider_id, month_start, performance_points, total_deliveries, timely_deliveries, late_deliveries)
      VALUES ($1, $2::date, 100, 0, 0, 0)
      ON CONFLICT (rider_id, month_start) DO UPDATE SET rider_id = EXCLUDED.rider_id
      RETURNING performance_points, late_deliveries, total_deliveries, timely_deliveries
    `, [riderId, monthStart]);
    const score = scoreResult.rows[0];
    const lateCount = Number(score.late_deliveries) + (wasTimely ? 0 : 1);
    const pointPenalty = lateCount === 5 || (lateCount > 5 && (lateCount - 5) % 6 === 0) ? 1 : 0;
    const points = Math.max(0, Math.min(100, Number(score.performance_points) + 1 - pointPenalty));
    const totalDeliveries = Number(score.total_deliveries) + 1;
    const timelyDeliveries = Number(score.timely_deliveries) + (wasTimely ? 1 : 0);
    const salary = salaryForPoints(points);
    await client.query(`
      UPDATE rider_monthly_scores SET performance_points = $3, total_deliveries = $4,
        timely_deliveries = $5, late_deliveries = $6, salary_amount = $7,
        salary_available_at = ($2::date + INTERVAL '1 month 30 days' + CASE WHEN $3 < 60 THEN INTERVAL '7 days' ELSE INTERVAL '0 days' END)
      WHERE rider_id = $1 AND month_start = $2::date
    `, [riderId, monthStart, points, totalDeliveries, timelyDeliveries, lateCount, salary]);
    await client.query(`
      UPDATE riders SET total_deliveries = total_deliveries + 1,
        timely_deliveries = timely_deliveries + $2,
        late_deliveries = late_deliveries + $3,
        performance_points = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [riderId, wasTimely ? 1 : 0, wasTimely ? 0 : 1, points]);

    if (Number(delivery.cod_amount) > 0) {
      await client.query(`
        INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description)
        VALUES ($1, $2, 'cod_collected', $3, $4, $5)
        ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING
      `, [`COD-${req.params.id}`, riderId, Number(delivery.cod_amount), req.params.id, `Cash collected for order ${delivery.order_id}; vendor remittance pending`]);
      await client.query(
        'UPDATE riders SET wallet_balance = wallet_balance - $2 WHERE id = $1',
        [riderId, Number(delivery.cod_amount)]
      );
      await client.query(`
        INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description)
        VALUES ($1, $2, 'cod_remittance', $3, $4, $5)
        ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING
      `, [`REM-${req.params.id}`, riderId, -Number(delivery.cod_amount), req.params.id, `COD transferred to seller for order ${delivery.order_id}`]);
      await client.query(`
        INSERT INTO seller_wallet_entries (id, seller_id, entry_type, amount, reference_id, description)
        VALUES ($1, $2, 'cod_received', $3, $4, $5)
        ON CONFLICT (seller_id, entry_type, reference_id) DO NOTHING
      `, [`VCO-${delivery.fulfillment_id.slice(-24)}`, delivery.seller_id, Number(delivery.cod_amount), req.params.id, `Cash-on-delivery remittance for order ${delivery.order_id}`]);
    }

    await client.query('COMMIT');
    return res.json({ success: true, wasTimely, performancePoints: points, monthlySalary: salary });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Could not complete rider delivery:', error);
    return res.status(500).json({ error: 'Could not confirm delivery.' });
  } finally {
    client.release();
  }
});

router.get('/customer-deliveries', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT rd.id AS delivery_id, rd.status AS delivery_status,
        rd.cod_amount, rd.cod_collected, sf.order_id, sf.id AS fulfillment_id,
        sf.seller_id, s.name AS seller_name, sf.items_json, sf.status AS fulfillment_status,
        o.shipping_address_json, o.payment_method, r.id AS rider_id, r.name AS rider_name, r.number AS rider_number,
        rv.id AS review_id
      FROM orders o
      JOIN seller_fulfillments sf ON sf.order_id = o.id
      JOIN sellers s ON s.id = sf.seller_id
      JOIN rider_deliveries rd ON rd.fulfillment_id = sf.id
      LEFT JOIN riders r ON r.id = rd.rider_id
      LEFT JOIN rider_reviews rv ON rv.delivery_id = rd.id
      WHERE o.customer_id = $1
      ORDER BY rd.created_at DESC
    `, [req.user!.entityId]);
    return res.json(result.rows.map((row: any) => ({
      Delivery_ID: row.delivery_id,
      Order_ID: row.order_id,
      Seller_Fulfillment_ID: row.fulfillment_id,
      Seller_ID: row.seller_id,
      Seller_Name: row.seller_name,
      Rider_ID: row.rider_id || undefined,
      Status: row.delivery_status,
      COD_Amount: Number(row.cod_amount) || 0,
      COD_Collected: Boolean(row.cod_collected),
      Items: parseJson(row.items_json),
      Shipping_Address: parseJson(row.shipping_address_json),
      Payment_Method: row.payment_method,
      Customer_Name: '',
      Customer_Number: '',
      Rider_Name: row.rider_name || undefined,
      Rider_Number: row.rider_number || undefined,
      Review_ID: row.review_id || undefined,
    })));
  } catch (error: any) {
    console.error('Could not load customer deliveries:', error);
    return res.status(500).json({ error: 'Could not load shipment details.' });
  }
});

router.post('/customer-deliveries/:id/review', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  const rating = Number(req.body?.rating);
  const reviewText = typeof req.body?.reviewText === 'string' ? req.body.reviewText.trim().slice(0, 2000) : '';
  const wasTimely = req.body?.wasTimely;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof wasTimely !== 'boolean') {
    return res.status(400).json({ error: 'Choose a 1–5 rating and whether delivery was timely.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deliveryResult = await client.query(`
      SELECT rd.id, rd.rider_id, rd.was_timely, rd.delivered_at
      FROM rider_deliveries rd
      JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
      JOIN orders o ON o.id = sf.order_id
      WHERE rd.id = $1 AND rd.status = 'delivered' AND o.customer_id = $2
      FOR UPDATE OF rd
    `, [req.params.id, req.user!.entityId]);
    if (!deliveryResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Completed delivery not found for this customer.' });
    }
    const delivery = deliveryResult.rows[0];
    if (!delivery.rider_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This delivery has no assigned rider to review.' });
    }
    await client.query(
      `INSERT INTO rider_reviews (id, delivery_id, rider_id, customer_id, rating, review_text, was_timely)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [`RRV-${Date.now()}-${randomInt(1000, 10000)}`, delivery.id, delivery.rider_id, req.user!.entityId, rating, reviewText, wasTimely]
    );

    if (Boolean(delivery.was_timely) !== wasTimely) {
      const monthStart = new Date(delivery.delivered_at);
      monthStart.setUTCDate(1);
      const monthKey = monthStart.toISOString().slice(0, 10);
      const scoreResult = await client.query(
        'SELECT performance_points, late_deliveries, timely_deliveries FROM rider_monthly_scores WHERE rider_id = $1 AND month_start = $2::date FOR UPDATE',
        [delivery.rider_id, monthKey]
      );
      if (scoreResult.rows.length) {
        const score = scoreResult.rows[0];
        const oldLateCount = Number(score.late_deliveries);
        const newLateCount = oldLateCount + (wasTimely ? -1 : 1);
        const crossedPenalty = wasTimely
          ? oldLateCount === 5 || (oldLateCount > 5 && (oldLateCount - 5) % 6 === 0)
          : newLateCount === 5 || (newLateCount > 5 && (newLateCount - 5) % 6 === 0);
        const points = Math.max(0, Math.min(100, Number(score.performance_points) + (crossedPenalty ? (wasTimely ? 1 : -1) : 0)));
        const timelyCount = Number(score.timely_deliveries) + (wasTimely ? 1 : -1);
        const salary = salaryForPoints(points);
        await client.query(`
          UPDATE rider_monthly_scores SET late_deliveries = $3, timely_deliveries = $4,
            performance_points = $5, salary_amount = $6,
            salary_available_at = ($2::date + INTERVAL '1 month 30 days' + CASE WHEN $5 < 60 THEN INTERVAL '7 days' ELSE INTERVAL '0 days' END)
          WHERE rider_id = $1 AND month_start = $2::date
        `, [delivery.rider_id, monthKey, Math.max(0, newLateCount), Math.max(0, timelyCount), points, salary]);
        await client.query(`
          UPDATE riders SET late_deliveries = GREATEST(0, late_deliveries + $2),
            timely_deliveries = GREATEST(0, timely_deliveries + $3), performance_points = $4,
            updated_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [delivery.rider_id, wasTimely ? -1 : 1, wasTimely ? 1 : -1, points]);
      }
      await client.query('UPDATE rider_deliveries SET was_timely = $2 WHERE id = $1', [delivery.id, wasTimely]);
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return res.status(409).json({ error: 'A review was already submitted for this delivery.' });
    console.error('Could not submit rider review:', error);
    return res.status(500).json({ error: 'Could not submit your delivery review.' });
  } finally {
    client.release();
  }
});

router.get('/wallet', requireAuth, requireRole(['rider']), requireApprovedRider, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    const riderId = req.user!.entityId;
    await client.query('BEGIN');
    await creditAvailableSalary(client, riderId);
    const [riderResult, entriesResult, withdrawalsResult, pendingSalaryResult] = await Promise.all([
      client.query('SELECT wallet_balance FROM riders WHERE id = $1', [riderId]),
      client.query('SELECT id, entry_type, amount, reference_id, description, available_at, created_at FROM rider_wallet_entries WHERE rider_id = $1 ORDER BY created_at DESC LIMIT 100', [riderId]),
      client.query('SELECT id, amount, payout_method, payout_account, status, requested_at, processed_at FROM rider_withdrawals WHERE rider_id = $1 ORDER BY requested_at DESC LIMIT 100', [riderId]),
      client.query('SELECT COALESCE(SUM(salary_amount), 0) AS total FROM rider_monthly_scores WHERE rider_id = $1 AND salary_available_at > CURRENT_TIMESTAMP', [riderId]),
    ]);
    await client.query('COMMIT');
    return res.json({
      balance: Number(riderResult.rows[0]?.wallet_balance) || 0,
      pendingSalary: Number(pendingSalaryResult.rows[0]?.total) || 0,
      entries: entriesResult.rows,
      withdrawals: withdrawalsResult.rows,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Could not load rider wallet:', error);
    return res.status(500).json({ error: 'Could not load your wallet.' });
  } finally {
    client.release();
  }
});

router.get('/payroll/settle', async (req, res) => {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!expectedSecret || !providedSecret) return res.status(403).json({ error: 'Payroll settlement is not authorized.' });
  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return res.status(403).json({ error: 'Payroll settlement is not authorized.' });
  }

  try {
    const result = await query(`
      WITH credited AS (
        INSERT INTO rider_wallet_entries (id, rider_id, entry_type, amount, reference_id, description)
        SELECT 'SAL-' || ms.rider_id || '-' || to_char(ms.month_start, 'YYYYMM'),
          ms.rider_id, 'salary', ms.salary_amount, to_char(ms.month_start, 'YYYY-MM'),
          'Monthly salary for ' || to_char(ms.month_start, 'Month YYYY')
        FROM rider_monthly_scores ms
        WHERE ms.month_start < date_trunc('month', CURRENT_DATE)::date
          AND ms.salary_available_at <= CURRENT_TIMESTAMP
        ON CONFLICT (rider_id, entry_type, reference_id) DO NOTHING
        RETURNING rider_id, amount
      ), totals AS (
        SELECT rider_id, SUM(amount) AS amount FROM credited GROUP BY rider_id
      )
      UPDATE riders r SET wallet_balance = r.wallet_balance + totals.amount, updated_at = CURRENT_TIMESTAMP
      FROM totals WHERE r.id = totals.rider_id
      RETURNING r.id AS rider_id, totals.amount AS credited_amount
    `);
    return res.json({ success: true, creditedRiders: result.rows.length, totalCredited: result.rows.reduce((sum, row) => sum + Number(row.credited_amount), 0) });
  } catch (error: any) {
    console.error('Could not settle rider payroll:', error);
    return res.status(500).json({ error: 'Could not settle rider payroll.' });
  }
});

router.post('/wallet/withdrawals', requireAuth, requireRole(['rider']), requireApprovedRider, async (req: AuthRequest, res) => {
  const amount = Number(req.body?.amount);
  const payoutMethod = String(req.body?.payoutMethod || '');
  const payoutAccount = String(req.body?.payoutAccount || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !['bkash', 'bank', 'nagad'].includes(payoutMethod) || !payoutAccount) {
    return res.status(400).json({ error: 'Enter a valid amount and payout account.' });
  }

  const client = await pool.connect();
  try {
    const riderId = req.user!.entityId;
    await client.query('BEGIN');
    await creditAvailableSalary(client, riderId);
    const riderResult = await client.query('SELECT wallet_balance FROM riders WHERE id = $1 FOR UPDATE', [riderId]);
    const balance = Number(riderResult.rows[0]?.wallet_balance) || 0;
    if (amount > balance) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal amount exceeds your available salary balance.' });
    }
    const withdrawalId = `WD-${Date.now()}-${randomInt(1000, 10000)}`;
    await client.query(
      `INSERT INTO rider_withdrawals (id, rider_id, amount, payout_method, payout_account)
      VALUES ($1, $2, $3, $4, $5)`,
      [withdrawalId, riderId, amount, payoutMethod, payoutAccount]
    );
    await client.query('UPDATE riders SET wallet_balance = wallet_balance - $2 WHERE id = $1', [riderId, amount]);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, withdrawalId });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Could not request rider withdrawal:', error);
    return res.status(500).json({ error: 'Could not create withdrawal request.' });
  } finally {
    client.release();
  }
});

router.get('/wallet/withdrawals', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const result = await query(`
      SELECT w.id, w.rider_id, r.name AS rider_name, w.amount, w.payout_method,
        w.payout_account, w.status, w.requested_at
      FROM rider_withdrawals w JOIN riders r ON r.id = w.rider_id
      WHERE w.status = 'pending' ORDER BY w.requested_at ASC
    `);
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Could not load rider withdrawals:', error);
    return res.status(500).json({ error: 'Could not load withdrawal requests.' });
  }
});

router.patch('/wallet/withdrawals/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const { status } = req.body ?? {};
  if (!['paid', 'rejected'].includes(status)) return res.status(400).json({ error: 'Choose paid or rejected.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const withdrawalResult = await client.query('SELECT * FROM rider_withdrawals WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!withdrawalResult.rows.length || withdrawalResult.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal is not pending.' });
    }
    const withdrawal = withdrawalResult.rows[0];
    await client.query('UPDATE rider_withdrawals SET status = $2, processed_at = CURRENT_TIMESTAMP WHERE id = $1', [withdrawal.id, status]);
    if (status === 'rejected') {
      await client.query('UPDATE riders SET wallet_balance = wallet_balance + $2 WHERE id = $1', [withdrawal.rider_id, withdrawal.amount]);
    }
    await client.query('COMMIT');
    return res.json({ success: true, status });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Could not process rider withdrawal:', error);
    return res.status(500).json({ error: 'Could not process withdrawal.' });
  } finally {
    client.release();
  }
});

export default router;