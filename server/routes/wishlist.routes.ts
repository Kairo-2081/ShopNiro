import { Router } from 'express';
import { query } from '../db/index.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth, requireRole(['customer']));

router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT product_id FROM customer_wishlist WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.user!.entityId]
    );
    res.json(result.rows.map((row) => row.product_id));
  } catch (error) {
    console.error('Could not load customer wishlist:', error);
    res.status(500).json({ error: 'Could not load your saved products.' });
  }
});

router.post('/:productId', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `INSERT INTO customer_wishlist (customer_id, product_id)
       SELECT $1, p.id FROM products p WHERE p.id = $2
       ON CONFLICT (customer_id, product_id) DO NOTHING
       RETURNING product_id`,
      [req.user!.entityId, req.params.productId]
    );
    if (!result.rows.length) {
      const product = await query('SELECT 1 FROM products WHERE id = $1', [req.params.productId]);
      if (!product.rows.length) return res.status(404).json({ error: 'Product not found.' });
    }
    res.status(200).json({ saved: true, productId: req.params.productId });
  } catch (error) {
    console.error('Could not save wishlist product:', error);
    res.status(500).json({ error: 'Could not save this product.' });
  }
});

router.delete('/:productId', async (req: AuthRequest, res) => {
  try {
    await query('DELETE FROM customer_wishlist WHERE customer_id = $1 AND product_id = $2', [
      req.user!.entityId,
      req.params.productId,
    ]);
    res.json({ saved: false, productId: req.params.productId });
  } catch (error) {
    console.error('Could not remove wishlist product:', error);
    res.status(500).json({ error: 'Could not remove this saved product.' });
  }
});

export default router;