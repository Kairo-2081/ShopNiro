import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { query } from '../db/index.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';

const router = Router();

/**
 * GET /api/cart
 * Fetch cart items (via schema gocart_cart_list and gocart_products_list)
 */
router.get('/', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  try {
    const customerId = req.user!.entityId;
    const itemsRes = await query(`SELECT * FROM gocart_cart_list($1)`, [customerId]);
    const productsRes = await query(`SELECT * FROM gocart_products_list()`);
    const allProducts: any[] = productsRes.rows;

    const enriched = itemsRes.rows.map((item: any) => {
      const p = allProducts.find((prod) => prod.id === item.product_id);
      return {
        Cart_ID: item.id,
        Customer_ID: item.customer_id,
        Product_ID: item.product_id,
        Quantity: item.quantity,
        Size: item.size || undefined,
        Product: p
          ? {
              Product_ID: p.id,
              Name: p.name,
              Image: p.image || '',
              Description: p.description || '',
              Size_Gender: p.size_gender || undefined,
              Sizes: Array.isArray(p.sizes_json) ? p.sizes_json : [],
              Size_Chart: Array.isArray(p.size_chart_json) ? p.size_chart_json : [],
              Price: Number(p.price),
              Voucher: p.voucher || '',
              Stock: Number(p.stock),
              Product_Status: p.product_status as any,
              Category_ID: p.category_id,
              Seller_ID: p.seller_id,
            }
          : undefined,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

/**
 * POST /api/cart
 * Add item to cart or increment quantity if already exists (via schema gocart_cart_existing, gocart_cart_update, gocart_cart_create)
 */
router.post('/', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  try {
    const { Customer_ID, Product_ID, Quantity = 1, Size = '' } = req.body;
    const custId = req.user!.entityId;
    if ((Customer_ID && Customer_ID !== custId) || !Product_ID) {
      return res.status(400).json({ error: 'Customer_ID and Product_ID are required' });
    }

    const qty = Number(Quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive whole number' });
    }
    const size = typeof Size === 'string' ? Size.trim() : '';

    const productRes = await query(`SELECT stock, product_status, sizes_json FROM products WHERE id = $1`, [Product_ID]);
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productRes.rows[0];
    if (product.product_status !== 'active') {
      return res.status(409).json({ error: 'This product is no longer available' });
    }
    const availableSizes = Array.isArray(product.sizes_json) ? product.sizes_json : [];
    if ((availableSizes.length && !size) || (size && !availableSizes.includes(size))) {
      return res.status(400).json({ error: availableSizes.length ? 'Choose a valid product size.' : 'This product does not have size variants.' });
    }
    if (Number(product.stock) < qty) {
      return res.status(409).json({ error: 'Insufficient stock for this product' });
    }

    const existing = await query(`SELECT * FROM gocart_cart_existing($1, $2, $3)`, [custId, Product_ID, size]);

    if (existing.rows.length > 0) {
      const currentItem: any = existing.rows[0];
      const newQty = Number(currentItem.quantity) + qty;
      if (newQty > Number(product.stock)) {
        return res.status(409).json({ error: 'Requested quantity exceeds available stock' });
      }
      await query(`SELECT * FROM gocart_cart_update($1, $2, $3)`, [currentItem.id, newQty, custId]);
      return res.json({ Cart_ID: currentItem.id, Customer_ID: custId, Product_ID, Quantity: newQty });
    }

    const cartId = `CART-${randomUUID()}`;
    await query(`SELECT * FROM gocart_cart_create($1, $2, $3, $4, $5)`, [cartId, custId, Product_ID, qty, size]);

    res.status(201).json({ Cart_ID: cartId, Customer_ID: custId, Product_ID, Quantity: qty, Size: size || undefined });
  } catch (error: any) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: error.message || 'Failed to update cart' });
  }
});

/**
 * PUT /api/cart/:cartId
 * Update item quantity in cart (via schema gocart_cart_update)
 */
router.put('/:cartId', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  try {
    const { cartId } = req.params;
    const { Quantity } = req.body;
    const custId = req.user!.entityId;
    const qty = Number(Quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive whole number' });
    }

    const cartItemRes = await query(
      `SELECT p.stock, p.product_status FROM cart c JOIN products p ON p.id = c.product_id WHERE c.id = $1 AND c.customer_id = $2`,
      [cartId, custId]
    );
    if (cartItemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    const cartProduct = cartItemRes.rows[0];
    if (cartProduct.product_status !== 'active') {
      return res.status(409).json({ error: 'This product is no longer available' });
    }
    if (qty > Number(cartProduct.stock)) {
      return res.status(409).json({ error: 'Requested quantity exceeds available stock' });
    }

    const result = await query(`SELECT * FROM gocart_cart_update($1, $2, $3)`, [cartId, qty, custId]);
    res.json({ Cart_ID: cartId, Quantity: qty, updated: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating cart item quantity:', error);
    res.status(500).json({ error: error.message || 'Failed to update cart item quantity' });
  }
});

/**
 * DELETE /api/cart/:cartId
 * Remove item from cart (via schema gocart_cart_delete)
 */
router.delete('/:cartId', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  try {
    const { cartId } = req.params;
    const custId = req.user!.entityId;
    await query(`SELECT * FROM gocart_cart_delete($1, $2)`, [cartId, custId]);
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error: any) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({ error: error.message || 'Failed to remove item from cart' });
  }
});

export default router;
