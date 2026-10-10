import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireCronSecret } from '../middleware/cronAuth.ts';
import { processRefundQueue } from './payment.routes.ts';

const router = Router();

router.post('/expire-orders', requireCronSecret, async (_req, res) => {
  try {
    const result = await query('SELECT expire_pending_online_orders(30) AS expired');
    return res.json({ expired: Number(result.rows[0]?.expired) || 0 });
  } catch (error) {
    console.error('Could not expire pending orders:', error);
    return res.status(500).json({ error: 'Could not expire pending orders.' });
  }
});

router.post('/refunds', requireCronSecret, async (_req, res) => {
  try {
    return res.json(await processRefundQueue());
  } catch (error) {
    console.error('Refund processor failed:', error);
    return res.status(500).json({ error: 'Refund processing failed.' });
  }
});

export default router;