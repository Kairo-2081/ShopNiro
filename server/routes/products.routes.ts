import { Router } from 'express';
import { query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Product } from '../../src/types.ts';

const router = Router();

const parseVoucherExpiry = (value: unknown): Date | null | undefined => {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

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
      Video_URL: p.video_url || undefined,
      Images: Array.isArray(p.images_json) && p.images_json.length ? p.images_json : (p.image ? [p.image] : []),
      Highlights: Array.isArray(p.highlights_json) ? p.highlights_json : [],
      Description: p.description || '',
      Warranty_Information: p.warranty_information || '',
      Return_Policy: p.return_policy || '',
      Size_Gender: p.size_gender || undefined,
      Sizes: Array.isArray(p.sizes_json) ? p.sizes_json : [],
      Size_Chart: Array.isArray(p.size_chart_json) ? p.size_chart_json : [],
      Price: Number(p.price),
      Voucher: p.voucher || '',
      Voucher_Expires_At: p.voucher_expires_at ? new Date(p.voucher_expires_at).toISOString() : undefined,
      Featured_Deal: Boolean(p.featured_deal),
      Stock: Number(p.stock),
      Product_Status: p.product_status as any,
      Category_ID: p.category_id,
      Seller_ID: p.seller_id,
      Created_At: p.created_at,
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
      Video_URL: p.video_url || undefined,
      Images: Array.isArray(p.images_json) && p.images_json.length ? p.images_json : (p.image ? [p.image] : []),
      Highlights: Array.isArray(p.highlights_json) ? p.highlights_json : [],
      Description: p.description || '',
      Warranty_Information: p.warranty_information || '',
      Return_Policy: p.return_policy || '',
      Size_Gender: p.size_gender || undefined,
      Sizes: Array.isArray(p.sizes_json) ? p.sizes_json : [],
      Size_Chart: Array.isArray(p.size_chart_json) ? p.size_chart_json : [],
      Price: Number(p.price),
      Voucher: p.voucher || '',
      Voucher_Expires_At: p.voucher_expires_at ? new Date(p.voucher_expires_at).toISOString() : undefined,
      Featured_Deal: Boolean(p.featured_deal),
      Stock: Number(p.stock),
      Product_Status: p.product_status as any,
      Category_ID: p.category_id,
      Seller_ID: p.seller_id,
      Created_At: p.created_at,
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
    const { Name, Image, Video_URL, Images, Highlights, Description, Warranty_Information, Return_Policy, Price, Voucher, Voucher_Expires_At, Featured_Deal, Stock, Category_ID, Seller_ID, Product_Status, Size_Gender, Sizes, Size_Chart } = req.body;
    if (!Name || Price === undefined || !Category_ID || !Seller_ID) {
      return res.status(400).json({ error: 'Name, Price, Category, and Seller are required' });
    }
    if (String(Name).trim().length > 80) return res.status(400).json({ error: 'Product titles must be 80 characters or fewer.' });
    if (String(Description || '').trim().split(/\s+/).filter(Boolean).length > 300) {
      return res.status(400).json({ error: 'Product descriptions must be 300 words or fewer.' });
    }
    if (Array.isArray(Images) && Images.filter((value: unknown) => String(value).trim()).length > 7) {
      return res.status(400).json({ error: 'A product can have up to 7 images.' });
    }
    const priceNum = Number(Price);
    if (!Number.isFinite(priceNum) || priceNum <= 0 || priceNum > 99999999.99) {
      return res.status(400).json({ error: 'Price must be between 0.01 and 99,999,999.99.' });
    }
    const voucherExpiry = parseVoucherExpiry(Voucher_Expires_At);
    if (voucherExpiry === undefined) return res.status(400).json({ error: 'Enter a valid voucher end date.' });
    const videoUrl = typeof Video_URL === 'string' ? Video_URL.trim() : '';
    if (videoUrl && (!/^https?:\/\//i.test(videoUrl) || videoUrl.length > 2048)) {
      return res.status(400).json({ error: 'Product video must use a valid HTTP or HTTPS URL under 2048 characters.' });
    }
    const sizes = Array.isArray(Sizes) ? Sizes.map(String).map((size: string) => size.trim()).filter(Boolean) : [];
    const highlights = Array.isArray(Highlights) ? Highlights.map(String).map((text: string) => text.trim()).filter(Boolean).slice(0, 5) : [];
    const sizeChart = Array.isArray(Size_Chart) ? Size_Chart : [];
    if (sizes.length > 0 && !['men', 'women', 'unisex'].includes(Size_Gender)) {
      return res.status(400).json({ error: 'Choose a size-chart category for apparel sizes.' });
    }

    // Moderation: ensure seller exists and is approved via gocart_seller_get
    const sellerCheck = await query(`SELECT * FROM gocart_seller_get($1)`, [Seller_ID]);
    if (sellerCheck.rows.length === 0 || (sellerCheck.rows[0] as any).status !== 'approved') {
      return res.status(403).json({ error: 'Only approved sellers can publish products' });
    }

    const id = `PROD-${Date.now()}`;
    const images = Array.isArray(Images) ? Images.map(String).map((url: string) => url.trim()).filter(Boolean) : [];
    const img = images[0] || Image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
    const desc = Description || '';
    const vouch = Voucher || '';
    const stockNum = Number(Stock) || 0;
    const prodStat = Product_Status || 'active';

    const result = await query(
      `SELECT * FROM gocart_product_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, Name, img, desc, priceNum, vouch, stockNum, prodStat, Category_ID, Seller_ID]
    );
    await query('UPDATE products SET size_gender = $2, sizes_json = $3::jsonb, size_chart_json = $4::jsonb, images_json = $5::jsonb, highlights_json = $6::jsonb, warranty_information = $7, return_policy = $8, video_url = $9 WHERE id = $1', [id, sizes.length ? Size_Gender : null, JSON.stringify(sizes), JSON.stringify(sizeChart), JSON.stringify(images.length ? images : [img]), JSON.stringify(highlights), String(Warranty_Information || '').trim(), String(Return_Policy || '').trim(), videoUrl]);
    await query('UPDATE products SET voucher_expires_at = $2, featured_deal = $3 WHERE id = $1', [id, vouch ? voucherExpiry : null, Boolean(vouch && Featured_Deal)]);

    const row = result.rows[0];
    const newProd: Product = {
      Product_ID: row.id,
      Name: row.name,
      Image: row.image,
      Video_URL: videoUrl || undefined,
      Images: images.length ? images : [img],
      Highlights: highlights,
      Description: row.description,
      Warranty_Information: Warranty_Information || '',
      Return_Policy: Return_Policy || '',
      Price: Number(row.price),
      Voucher: row.voucher,
      Voucher_Expires_At: vouch && voucherExpiry ? voucherExpiry.toISOString() : undefined,
      Featured_Deal: Boolean(vouch && Featured_Deal),
      Stock: Number(row.stock),
      Product_Status: row.product_status,
      Category_ID: row.category_id,
      Seller_ID: row.seller_id,
      Created_At: row.created_at,
      Size_Gender: sizes.length ? Size_Gender : undefined,
      Sizes: sizes,
      Size_Chart: sizeChart,
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
    const description = req.body.Description ?? current.description;
    const warrantyInformation = req.body.Warranty_Information ?? current.warranty_information ?? '';
    const returnPolicy = req.body.Return_Policy ?? current.return_policy ?? '';
    const videoUrl = req.body.Video_URL === undefined ? String(current.video_url || '') : String(req.body.Video_URL || '').trim();
    if (videoUrl && (!/^https?:\/\//i.test(videoUrl) || videoUrl.length > 2048)) {
      return res.status(400).json({ error: 'Product video must use a valid HTTP or HTTPS URL under 2048 characters.' });
    }
    if (String(name).trim().length > 80) return res.status(400).json({ error: 'Product titles must be 80 characters or fewer.' });
    if (String(description || '').trim().split(/\s+/).filter(Boolean).length > 300) {
      return res.status(400).json({ error: 'Product descriptions must be 300 words or fewer.' });
    }
    const requestedImages = Array.isArray(req.body.Images) ? req.body.Images.map(String).map((url: string) => url.trim()).filter(Boolean) : null;
    const currentImages = Array.isArray(current.images_json) ? current.images_json : [];
    const image = requestedImages?.[0] ?? req.body.Image ?? current.image;
    const price = req.body.Price !== undefined ? Number(req.body.Price) : Number(current.price);
    if (!Number.isFinite(price) || price <= 0 || price > 99999999.99) {
      return res.status(400).json({ error: 'Price must be between 0.01 and 99,999,999.99.' });
    }
    const voucher = req.body.Voucher ?? current.voucher;
    const voucherExpiry = req.body.Voucher_Expires_At === undefined
      ? (current.voucher_expires_at ? new Date(current.voucher_expires_at) : null)
      : parseVoucherExpiry(req.body.Voucher_Expires_At);
    if (voucherExpiry === undefined) return res.status(400).json({ error: 'Enter a valid voucher end date.' });
    const featuredDeal = req.body.Featured_Deal === undefined ? Boolean(current.featured_deal) : Boolean(req.body.Featured_Deal);
    const stock = req.body.Stock !== undefined ? Number(req.body.Stock) : Number(current.stock);
    const productStatus = req.body.Product_Status ?? current.product_status;
    const categoryId = req.body.Category_ID ?? current.category_id;
    const sizeGender = req.body.Size_Gender !== undefined ? req.body.Size_Gender : current.size_gender;
    const sizes = Array.isArray(req.body.Sizes) ? req.body.Sizes.map(String).map((size: string) => size.trim()).filter(Boolean) : (Array.isArray(current.sizes_json) ? current.sizes_json : []);
    const sizeChart = Array.isArray(req.body.Size_Chart) ? req.body.Size_Chart : (Array.isArray(current.size_chart_json) ? current.size_chart_json : []);
    const highlights = Array.isArray(req.body.Highlights)
      ? req.body.Highlights.map(String).map((text: string) => text.trim()).filter(Boolean).slice(0, 5)
      : (Array.isArray(current.highlights_json) ? current.highlights_json : []);
    if (sizes.length && !['men', 'women', 'unisex'].includes(sizeGender)) {
      return res.status(400).json({ error: 'Choose a size-chart category for apparel sizes.' });
    }

    const result = await query(
      `SELECT * FROM gocart_product_update($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, name, image, description, price, voucher, stock, productStatus, categoryId]
    );
    const images = requestedImages ?? currentImages;
    await query('UPDATE products SET size_gender = $2, sizes_json = $3::jsonb, size_chart_json = $4::jsonb, images_json = $5::jsonb, highlights_json = $6::jsonb, warranty_information = $7, return_policy = $8, video_url = $9 WHERE id = $1', [id, sizes.length ? sizeGender : null, JSON.stringify(sizes), JSON.stringify(sizeChart), JSON.stringify(images.length ? images : [image]), JSON.stringify(highlights), String(warrantyInformation).trim(), String(returnPolicy).trim(), videoUrl]);
    await query('UPDATE products SET voucher_expires_at = $2, featured_deal = $3 WHERE id = $1', [id, voucher ? voucherExpiry : null, Boolean(voucher && featuredDeal)]);

    const row = result.rows[0];
    res.json({
      Product_ID: row.id,
      Name: row.name,
      Image: row.image,
      Video_URL: videoUrl || undefined,
      Images: images.length ? images : [image],
      Highlights: highlights,
      Description: row.description,
      Warranty_Information: String(warrantyInformation),
      Return_Policy: String(returnPolicy),
      Price: Number(row.price),
      Voucher: row.voucher,
      Voucher_Expires_At: voucher && voucherExpiry ? voucherExpiry.toISOString() : undefined,
      Featured_Deal: Boolean(voucher && featuredDeal),
      Stock: Number(row.stock),
      Product_Status: row.product_status,
      Category_ID: row.category_id,
      Seller_ID: row.seller_id,
      Created_At: row.created_at,
      Size_Gender: sizes.length ? sizeGender : undefined,
      Sizes: sizes,
      Size_Chart: sizeChart,
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
