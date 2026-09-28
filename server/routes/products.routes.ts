import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Product } from '../../src/types.ts';

const router = Router();

/**
 * GET /api/products
 * Product catalog with query filtering (via schema gocart_products_list)
 */
router.get('/', async (req, res) => {
  try {
    const { sellerId, categoryId, search, status } = req.query;

    const result = await query(`SELECT * FROM gocart_products_list()`);
    const rows: any[] = result.rows;

    let formatted: Product[] = rows.map((p) => ({
      Product_ID: p.id,
      Name: p.name,
      Image: p.image || '',
      Description: p.description || '',
      Price: Number(p.price),
      Voucher: p.voucher || '',
      Stock: Number(p.stock),
      Product_Status: p.product_status as any,
      Category_ID: p.category_id,
      Seller_ID: p.seller_id,
    }));

    if (sellerId) {
      formatted = formatted.filter((p) => p.Seller_ID === sellerId);
    }
    if (categoryId && categoryId !== 'all') {
      formatted = formatted.filter((p) => p.Category_ID === categoryId);
    }
    if (status) {
      formatted = formatted.filter((p) => p.Product_Status === status);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      formatted = formatted.filter(
        (p) => p.Name.toLowerCase().includes(q) || p.Description.toLowerCase().includes(q)
      );
    }

    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 * Retrieve single product by ID (via schema gocart_product_get)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM gocart_product_get($1)`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const p = result.rows[0];
    const product: Product = {
      Product_ID: p.id,
      Name: p.name,
      Image: p.image || '',
      Description: p.description || '',
      Price: Number(p.price),
      Voucher: p.voucher || '',
      Stock: Number(p.stock),
      Product_Status: p.product_status as any,
      Category_ID: p.category_id,
      Seller_ID: p.seller_id,
    };
    res.json(product);
  } catch (error: any) {
    console.error('Error fetching product by id:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * POST /api/products
 * Create product with seller approval moderation check (via schema gocart_product_create)
 */
router.post('/', requireAuth, requireRole(['seller', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { Name, Image, Description, Price, Voucher, Stock, Category_ID, Seller_ID, Product_Status } = req.body;
    if (!Name || Price === undefined || !Category_ID || !Seller_ID) {
      return res.status(400).json({ error: 'Name, Price, Category, and Seller are required' });
    }

    // Moderation: ensure seller exists and is approved via gocart_seller_get
    const sellerCheck = await query(`SELECT * FROM gocart_seller_get($1)`, [Seller_ID]);
    if (sellerCheck.rows.length === 0 || (sellerCheck.rows[0] as any).status !== 'approved') {
      return res.status(403).json({ error: 'Only approved sellers can publish products' });
    }

    const id = `PROD-${Date.now()}`;
    const img = Image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
    const desc = Description || '';
    const priceNum = Number(Price);
    const vouch = Voucher || '';
    const stockNum = Number(Stock) || 0;
    const prodStat = Product_Status || 'active';

    const result = await query(
      `SELECT * FROM gocart_product_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, Name, img, desc, priceNum, vouch, stockNum, prodStat, Category_ID, Seller_ID]
    );

    const row = result.rows[0];
    const newProd: Product = {
      Product_ID: row.id,
      Name: row.name,
      Image: row.image,
      Description: row.description,
      Price: Number(row.price),
      Voucher: row.voucher,
      Stock: Number(row.stock),
      Product_Status: row.product_status,
      Category_ID: row.category_id,
      Seller_ID: row.seller_id,
    };
    res.status(201).json(newProd);
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message || 'Failed to create product' });
  }
});

/**
 * PUT /api/products/:id
 * Updates product details (via schema gocart_product_update)
 */
router.put('/:id', requireAuth, requireRole(['seller', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM gocart_product_get($1)`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const current: any = existing.rows[0];
    const name = req.body.Name ?? current.name;
    const image = req.body.Image ?? current.image;
    const description = req.body.Description ?? current.description;
    const price = req.body.Price !== undefined ? Number(req.body.Price) : Number(current.price);
    const voucher = req.body.Voucher ?? current.voucher;
    const stock = req.body.Stock !== undefined ? Number(req.body.Stock) : Number(current.stock);
    const productStatus = req.body.Product_Status ?? current.product_status;
    const categoryId = req.body.Category_ID ?? current.category_id;

    const result = await query(
      `SELECT * FROM gocart_product_update($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, name, image, description, price, voucher, stock, productStatus, categoryId]
    );

    const row = result.rows[0];
    res.json({
      Product_ID: row.id,
      Name: row.name,
      Image: row.image,
      Description: row.description,
      Price: Number(row.price),
      Voucher: row.voucher,
      Stock: Number(row.stock),
      Product_Status: row.product_status,
      Category_ID: row.category_id,
      Seller_ID: row.seller_id,
    });
  } catch (error: any) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
});

/**
 * PATCH /api/products/:id/status
 * Updates product status (via schema gocart_product_status_update)
 */
router.patch('/:id/status', requireAuth, requireRole(['seller', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['active', 'inactive', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const result = await query(`SELECT * FROM gocart_product_status_update($1, $2)`, [id, status]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const row = result.rows[0];

    res.json({
      Product_ID: row.id,
      Name: row.name,
      Image: row.image,
      Description: row.description,
      Price: Number(row.price),
      Voucher: row.voucher,
      Stock: Number(row.stock),
      Product_Status: row.product_status,
      Category_ID: row.category_id,
      Seller_ID: row.seller_id,
    });
  } catch (error: any) {
    console.error('Error updating product status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * DELETE /api/products/:id
 * Delete a product (via schema gocart_product_delete)
 */
router.delete('/:id', requireAuth, requireRole(['seller', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query(`SELECT * FROM gocart_product_delete($1)`, [id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
