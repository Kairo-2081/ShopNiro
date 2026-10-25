import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query } from '../db/index.ts';
import { validateBody } from '../middleware/validate.ts';
import * as schemas from '../validation/schemas.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { Review } from '../../src/types.ts';
import { publicMessage } from '../middleware/errorHandler.ts';

const router = Router();

/**
 * GET /api/reviews
 * Retrieve reviews (via schema shopniro_reviews_by_product or shopniro_reviews_list)
 */
router.get('/', async (req, res) => {
  try {
    const { productId, sellerId } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    let result;
    if (productId && typeof productId === 'string') {
      result = await query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3', [productId, limit + 1, offset]);
    } else if (sellerId && typeof sellerId === 'string') {
      result = await query(`
        SELECT review.* FROM reviews review
        JOIN products product ON product.id = review.product_id
        WHERE product.seller_id = $1
        ORDER BY review.created_at DESC, review.id DESC LIMIT $2 OFFSET $3
      `, [sellerId, limit + 1, offset]);
    } else {
      result = await query('SELECT * FROM reviews ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2', [limit + 1, offset]);
    }

    const hasMore = result.rows.length > limit;
    const formatted: Review[] = result.rows.map((r: any) => ({
      Review_ID: r.id,
      Product_ID: r.product_id,
      Customer_ID: r.customer_id,
      Customer_Name: r.customer_name,
      Review_text: r.review_text,
      Rating: Number(r.rating),
      Created_At: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
    res.setHeader('X-Has-More', String(hasMore));
    res.json(formatted.slice(0, limit));
  } catch (error: any) {
    req.log.error({ err: error }, 'Error fetching reviews:');
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

/**
 * POST /api/reviews
 * Submit a review for a product (via schema shopniro_review_create)
 */
router.post('/', requireAuth, validateBody(schemas.createReviewBody), async (req: AuthRequest, res) => {
  try {
    const { Product_ID, Customer_ID, Review_text, Rating } = req.body;
    if (req.user!.role !== 'customer' || Customer_ID !== req.user!.entityId) {
      return res.status(403).json({ error: 'You can only post reviews from your own customer account.' });
    }
    const ratingNum = Number(Rating);

    const customer = await query('SELECT name FROM customers WHERE id = $1', [req.user!.entityId]);
    if (!customer.rows.length) return res.status(404).json({ error: 'Customer account not found.' });

    const id = `REV-${randomUUID()}`;
    const custName = String(customer.rows[0].name || '').trim() || 'Verified Customer';
    const revText = Review_text || '';

    const result = await query(
      `SELECT * FROM shopniro_review_create($1, $2, $3, $4, $5, $6)`,
      [id, Product_ID, Customer_ID, custName, revText, ratingNum]
    );

    const r = result.rows[0];
    res.status(201).json({
      Review_ID: r.id,
      Product_ID: r.product_id,
      Customer_ID: r.customer_id,
      Customer_Name: r.customer_name,
      Review_text: r.review_text,
      Rating: Number(r.rating),
      Created_At: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    });
  } catch (error: any) {
    req.log.error({ err: error }, 'Error creating review:');
    res.status(500).json({ error: publicMessage(error, 'Failed to create review') });
  }
});

export default router;
