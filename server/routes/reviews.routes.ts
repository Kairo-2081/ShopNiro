import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { Review } from '../../src/types.ts';

const router = Router();

/**
 * GET /api/reviews
 * Retrieve reviews (via schema gocart_reviews_by_product or gocart_reviews_list)
 */
router.get('/', async (req, res) => {
  try {
    const { productId, sellerId } = req.query;
    let result;
    if (productId && typeof productId === 'string') {
      result = await query(`SELECT * FROM gocart_reviews_by_product($1)`, [productId]);
    } else if (sellerId && typeof sellerId === 'string') {
      result = await query(`SELECT * FROM gocart_reviews_by_seller($1)`, [sellerId]);
    } else {
      result = await query(`SELECT * FROM gocart_reviews_list()`);
    }

    const formatted: Review[] = result.rows.map((r: any) => ({
      Review_ID: r.id,
      Product_ID: r.product_id,
      Customer_ID: r.customer_id,
      Customer_Name: r.customer_name,
      Review_text: r.review_text,
      Rating: Number(r.rating),
      Created_At: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

/**
 * POST /api/reviews
 * Submit a review for a product (via schema gocart_review_create)
 */
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { Product_ID, Customer_ID, Customer_Name, Review_text, Rating } = req.body;
    if (!Product_ID || !Customer_ID || !Rating) {
      return res.status(400).json({ error: 'Product_ID, Customer_ID, and Rating are required' });
    }

    const id = `REV-${Date.now()}`;
    const custName = Customer_Name || 'Verified Customer';
    const revText = Review_text || '';
    const ratingNum = Math.min(5, Math.max(1, Number(Rating)));

    const result = await query(
      `SELECT * FROM gocart_review_create($1, $2, $3, $4, $5, $6)`,
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
    console.error('Error creating review:', error);
    res.status(500).json({ error: error.message || 'Failed to create review' });
  }
});

export default router;
