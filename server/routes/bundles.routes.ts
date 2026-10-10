import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { ProductBundle } from '../../src/types.ts';

const router = Router();

const mapBundle = (row: any): ProductBundle => ({
  Bundle_ID: row.id,
  Seller_ID: row.seller_id,
  Name: row.name,
  Product_IDs: Array.isArray(row.product_ids_json) ? row.product_ids_json : [],
  Discount_Percent: Number(row.discount_percent),
  Ends_At: row.ends_at ? new Date(row.ends_at).toISOString() : undefined,
  Active: Boolean(row.active),
});

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(`
      SELECT id, seller_id, name, product_ids_json, discount_percent, ends_at, active
      FROM seller_bundles
      WHERE active = TRUE AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC, id DESC
      LIMIT $1 OFFSET $2
    `, [limit + 1, offset]);
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    res.json(result.rows.slice(0, limit).map(mapBundle));
  } catch (error) {
    console.error('Error fetching active bundles:', error);
    res.status(500).json({ error: 'Could not load bundle offers.' });
  }
});

router.get('/seller', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(`
      SELECT id, seller_id, name, product_ids_json, discount_percent, ends_at, active
      FROM seller_bundles WHERE seller_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3
    `, [req.user!.entityId, limit + 1, offset]);
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    res.json(result.rows.slice(0, limit).map(mapBundle));
  } catch (error) {
    console.error('Error fetching seller bundles:', error);
    res.status(500).json({ error: 'Could not load your bundles.' });
  }
});

router.post('/', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  try {
    const name = typeof req.body?.Name === 'string' ? req.body.Name.trim() : '';
    const productIds = Array.isArray(req.body?.Product_IDs)
      ? [...new Set(req.body.Product_IDs.filter((id: unknown) => typeof id === 'string').map((id: string) => id.trim()).filter(Boolean))]
      : [];
    const discountPercent = Number(req.body?.Discount_Percent);
    const endsAt = req.body?.Ends_At ? new Date(String(req.body.Ends_At)) : null;

    if (!name || name.length > 120) return res.status(400).json({ error: 'Bundle name is required and must be 120 characters or fewer.' });
    if (productIds.length < 2 || productIds.length > 5) return res.status(400).json({ error: 'Choose between 2 and 5 products for a bundle.' });
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 50) {
      return res.status(400).json({ error: 'Bundle discount must be between 0 and 50 percent.' });
    }
    if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= Date.now())) {
      return res.status(400).json({ error: 'Bundle end date must be in the future.' });
    }

    const sellerId = req.user!.entityId;
    const sellerProducts = await query(
      `SELECT id FROM products WHERE id = ANY($1::varchar[]) AND seller_id = $2 AND product_status = 'active' AND stock > 0`,
      [productIds, sellerId]
    );
    if (sellerProducts.rows.length !== productIds.length) {
      return res.status(400).json({ error: 'Bundles can include only active, in-stock products from your store.' });
    }

    const id = `BND-${Date.now()}`;
    const result = await query(`
      INSERT INTO seller_bundles (id, seller_id, name, product_ids_json, discount_percent, ends_at, active)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, TRUE)
      RETURNING id, seller_id, name, product_ids_json, discount_percent, ends_at, active
    `, [id, sellerId, name, JSON.stringify(productIds), discountPercent, endsAt]);
    res.status(201).json(mapBundle(result.rows[0]));
  } catch (error) {
    console.error('Error creating seller bundle:', error);
    res.status(500).json({ error: 'Could not create this bundle.' });
  }
});

router.patch('/:id/active', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  if (typeof req.body?.Active !== 'boolean') return res.status(400).json({ error: 'Active must be a boolean.' });
  try {
    const result = await query(`
      UPDATE seller_bundles SET active = $3
      WHERE id = $1 AND seller_id = $2
      RETURNING id, seller_id, name, product_ids_json, discount_percent, ends_at, active
    `, [req.params.id, req.user!.entityId, req.body.Active]);
    if (!result.rows.length) return res.status(404).json({ error: 'Bundle not found.' });
    res.json(mapBundle(result.rows[0]));
  } catch (error) {
    console.error('Error updating seller bundle:', error);
    res.status(500).json({ error: 'Could not update this bundle.' });
  }
});

router.delete('/:id', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  try {
    const result = await query('DELETE FROM seller_bundles WHERE id = $1 AND seller_id = $2 RETURNING id', [req.params.id, req.user!.entityId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Bundle not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting seller bundle:', error);
    res.status(500).json({ error: 'Could not delete this bundle.' });
  }
});

export default router;
