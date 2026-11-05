import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool, query } from '../db/index.ts';
import { requireCronSecret } from '../middleware/cronAuth.ts';
import { validateBody } from '../middleware/validate.ts';
import { emptyBody } from '../validation/schemas.ts';
import { finalizeSslCommerzPayment, processRefundQueue } from './payment.routes.ts';
import { runPaymentReconciliation } from '../services/paymentReconciliation.service.ts';
import { sslcommerz } from '../services/sslcommerz.service.ts';

const router = Router();
const RECONCILIATION_LOCK_CLASS = 1_572_902_391;
const RECONCILIATION_LOCK_ID = 901;

router.post('/expire-orders', requireCronSecret, validateBody(emptyBody), async (_req, res) => {
  try {
    const result = await query('SELECT expire_pending_online_orders(30) AS expired');
    return res.json({ expired: Number(result.rows[0]?.expired) || 0 });
  } catch (error) {
    console.error('Could not expire pending orders:', error);
    return res.status(500).json({ error: 'Could not expire pending orders.' });
  }
});

router.post('/refunds', requireCronSecret, validateBody(emptyBody), async (_req, res) => {
  try {
    return res.json(await processRefundQueue());
  } catch (error) {
    console.error('Refund processor failed:', error);
    return res.status(500).json({ error: 'Refund processing failed.' });
  }
});

router.post('/reconcile-payments', requireCronSecret, validateBody(emptyBody), async (_req, res) => {
  // The lock is held by an open transaction on one dedicated connection. A session-level advisory lock would not
  // be reliable through Supabase's transaction pooler (port 6543), which can hand the unlock to another server
  // connection; a transaction pins one, and the lock is released when the transaction ends.
  let client: PoolClient | undefined;
  let inTransaction = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    inTransaction = true;
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1, $2) AS locked',
      [RECONCILIATION_LOCK_CLASS, RECONCILIATION_LOCK_ID]
    );
    if (lock.rows[0]?.locked !== true) {
      return res.status(409).json({ error: 'Payment reconciliation is already running.' });
    }

    const summary = await runPaymentReconciliation({
      finalizePayment: (tranId, valId) => finalizeSslCommerzPayment(tranId, valId, sslcommerz),
    });
    return res.json(summary);
  } catch {
    _req.log.error('Payment reconciliation endpoint failed.');
    return res.status(500).json({ error: 'Payment reconciliation failed.' });
  } finally {
    let discardClient = false;
    if (client && inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The connection may be gone (for example an idle-transaction timeout). Drop it instead of reusing it.
        discardClient = true;
        _req.log.error('Could not end the payment reconciliation lock transaction.');
      }
    }
    client?.release(discardClient);
  }
});

export default router;