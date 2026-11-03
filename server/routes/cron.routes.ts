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
  let client: PoolClient | undefined;
  let locked = false;
  try {
    client = await pool.connect();
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [RECONCILIATION_LOCK_CLASS, RECONCILIATION_LOCK_ID]
    );
    locked = lock.rows[0]?.locked === true;
    if (!locked) return res.status(409).json({ error: 'Payment reconciliation is already running.' });

    const summary = await runPaymentReconciliation({
      finalizePayment: (tranId, valId) => finalizeSslCommerzPayment(tranId, valId, sslcommerz),
    });
    return res.json(summary);
  } catch {
    _req.log.error('Payment reconciliation endpoint failed.');
    return res.status(500).json({ error: 'Payment reconciliation failed.' });
  } finally {
    let discardClient = false;
    if (locked) {
      try {
        await client.query(
          'SELECT pg_advisory_unlock($1, $2)',
          [RECONCILIATION_LOCK_CLASS, RECONCILIATION_LOCK_ID]
        );
      } catch {
        discardClient = true;
        _req.log.error('Could not release the payment reconciliation advisory lock.');
      }
    }
    client?.release(discardClient);
  }
});

export default router;