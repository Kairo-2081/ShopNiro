import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireCronSecret } from '../middleware/cronAuth.ts';
import { validateBody } from '../middleware/validate.ts';
import { emptyBody } from '../validation/schemas.ts';
import { finalizeSslCommerzPayment, processRefundQueue } from './payment.routes.ts';
import { ReconciliationBusyError, runPaymentReconciliation } from '../services/paymentReconciliation.service.ts';
import { sslcommerz } from '../services/sslcommerz.service.ts';

const router = Router();

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

router.post('/reconcile-payments', requireCronSecret, validateBody(emptyBody), async (req, res) => {
  try {
    const summary = await runPaymentReconciliation({
      finalizePayment: (tranId, valId) => finalizeSslCommerzPayment(tranId, valId, sslcommerz),
    });
    return res.json(summary);
  } catch (error) {
    if (error instanceof ReconciliationBusyError) {
      return res.status(409).json({ error: 'Payment reconciliation is already running.' });
    }
    req.log.error('Payment reconciliation endpoint failed.');
    return res.status(500).json({ error: 'Payment reconciliation failed.' });
  }
});

export default router;