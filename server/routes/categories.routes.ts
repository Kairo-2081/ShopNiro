import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Category } from '../../src/types.ts';

const router = Router();

/**
 * GET /api/categories
 * Returns list of categories ordered by name (via schema gocart_categories_list)
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM gocart_categories_list()`);
    const formatted: Category[] = result.rows.map((c: any) => ({
      Category_ID: c.id,
      Name: c.name,
    }));
    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/categories
 * Creates a new category (via schema gocart_category_create)
 */
router.post('/', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { Name } = req.body;
    if (!Name || !Name.trim()) {
      return res.status(400).json({ error: 'Category Name is required' });
    }
    const id = `CAT-${Date.now()}`;
    const result = await query(`SELECT * FROM gocart_category_create($1, $2)`, [id, Name.trim()]);
    const row = result.rows[0];
    res.status(201).json({ Category_ID: row.id, Name: row.name });
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * PUT /api/categories/:id
 * Updates an existing category (via schema gocart_category_update)
 */
router.put('/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { Name } = req.body;
    if (!Name || !Name.trim()) {
      return res.status(400).json({ error: 'Category Name cannot be empty' });
    }
    const result = await query(`SELECT * FROM gocart_category_update($1, $2)`, [id, Name.trim()]);
    const row = result.rows[0];
    res.json({ Category_ID: row?.id || id, Name: row?.name || Name.trim() });
  } catch (error: any) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/**
 * DELETE /api/categories/:id
 * Deletes a category (via schema gocart_category_delete)
 */
router.delete('/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query(`SELECT * FROM gocart_category_delete($1)`, [id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
