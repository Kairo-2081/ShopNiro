import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/index.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth, requireRole(['admin']));

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await pool.query(`
      SELECT payout.id, payout.seller_id, seller.name AS seller_name, payout.amount,
        payout.method, payout.account, payout.status, payout.requested_at
      FROM seller_payouts payout
      JOIN sellers seller ON seller.id = payout.seller_id
      WHERE payout.status = 'requested'
      ORDER BY payout.requested_at ASC, payout.id ASC
      LIMIT $1 OFFSET $2
    `, [limit + 1, offset]);
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    return res.json(result.rows.slice(0, limit));
  } catch (error) {
    console.error('Could not load seller payouts:', error);
    return res.status(500).json({ error: 'Could not load seller payouts.' });
  }
});

router.patch('/:id/pay', async (req: AuthRequest, res) => {
  const externalReference = typeof req.body?.externalReference === 'string'
    ? req.body.externalReference.trim().slice(0, 100)
    : '';
  if (!externalReference) return res.status(400).json({ error: 'An external payout reference is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payoutResult = await client.query('SELECT * FROM seller_payouts WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!payoutResult.rows.length || payoutResult.rows[0].status !== 'requested') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Payout is not awaiting processing.' });
    }
    await client.query(`
      UPDATE seller_payouts SET status = 'paid', external_reference = $2,
        processed_by = $3, processed_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [req.params.id, externalReference, req.user!.entityId]);
    await client.query('COMMIT');
    return res.json({ success: true, status: 'paid' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Could not pay seller payout:', error);
    return res.status(500).json({ error: 'Could not process seller payout.' });
  } finally {
    client.release();
  }
});

router.patch('/:id/reject', async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payoutResult = await client.query('SELECT * FROM seller_payouts WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!payoutResult.rows.length || payoutResult.rows[0].status !== 'requested') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Payout is not awaiting processing.' });
    }
    const payout = payoutResult.rows[0];
    await client.query(`
      UPDATE seller_payouts SET status = 'rejected', processed_by = $2, processed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [req.params.id, req.user!.entityId]);
    await client.query(`
      INSERT INTO seller_wallet_entries (id, seller_id, entry_type, amount, reference_id, description, available_at)
      VALUES ($1, $2, 'adjustment', $3, $4, $5, now())
      ON CONFLICT (seller_id, entry_type, reference_id) DO NOTHING
    `, [`ADJ-${randomUUID()}`, payout.seller_id, payout.amount, payout.id, `Rejected payout ${payout.id} returned to available balance`]);
    await client.query('COMMIT');
    return res.json({ success: true, status: 'rejected' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Could not reject seller payout:', error);
    return res.status(500).json({ error: 'Could not reject seller payout.' });
  } finally {
    client.release();
  }
});

export default router;