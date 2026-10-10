import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { query } from './db/index.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { requireAuth, requireRole, optionalAuth, AuthRequest } from './middleware/auth.ts';
import { enforcePublicApiPolicy } from './middleware/publicRoutes.ts';

import authRoutes from './routes/auth.routes.ts';
import categoriesRoutes from './routes/categories.routes.ts';
import sellersRoutes from './routes/sellers.routes.ts';
import customersRoutes from './routes/customers.routes.ts';
import adminsRoutes from './routes/admins.routes.ts';
import productsRoutes from './routes/products.routes.ts';
import cartRoutes from './routes/cart.routes.ts';
import ordersRoutes from './routes/orders.routes.ts';
import reviewsRoutes from './routes/reviews.routes.ts';
import aiRoutes from './routes/ai.routes.ts';
import paymentRoutes from './routes/payment.routes.ts';
import mapsRoutes from './routes/maps.routes.ts';
import ridersRoutes from './routes/riders.routes.ts';
import riderDeliveryRoutes from './routes/rider-delivery.routes.ts';
import bundlesRoutes from './routes/bundles.routes.ts';
import sellerAnalyticsRoutes from './routes/analytics.routes.ts';
import wishlistRoutes from './routes/wishlist.routes.ts';
import supportRoutes from './routes/support.routes.ts';
import cronRoutes from './routes/cron.routes.ts';
import payoutsRoutes from './routes/payouts.routes.ts';

export const app = express();
const isProduction = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

const keyedRateLimit = (req: express.Request) => (req as AuthRequest).user?.userId || ipKeyGenerator(req.ip || '');
const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || /^\/api\/payment\/sslcommerz\/(ipn|success|fail|cancel)$/.test(req.originalUrl.split('?')[0]),
});
const aiRateLimit = rateLimit({ windowMs: 60_000, limit: 10, keyGenerator: keyedRateLimit, standardHeaders: true, legacyHeaders: false });
const mapsRateLimit = rateLimit({ windowMs: 60_000, limit: 30, keyGenerator: keyedRateLimit, standardHeaders: true, legacyHeaders: false });
const directApiRoutes = express.Router();
const allowedOrigins = new Set([
  ...(!isProduction ? [
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'http://localhost:5173',
    'http://localhost:3000',
  ] : []),
  'https://shopniro.onrender.com',
  process.env.SHOPNIRO_PUBLIC_URL?.replace(/\/$/, ''),
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin)));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [...allowedOrigins],
  credentials: true,
}));
app.use('/api', apiRateLimit);
app.use('/api', enforcePublicApiPolicy);
app.use('/api/ai', optionalAuth, aiRateLimit);
app.use('/api/maps', optionalAuth, mapsRateLimit);

app.use((req, res, next) => {
  if (/^\/api\/payment\/sslcommerz\/(success|fail|cancel|ipn)$/.test(req.path)) return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.headers.cookie?.includes('shopniro_session=')) {
    return next();
  }

  let requestOrigin = req.headers.origin;
  if (!requestOrigin && req.headers.referer) {
    try {
      requestOrigin = new URL(req.headers.referer).origin;
    } catch {
      return res.status(403).json({ error: 'Request origin is not allowed for cookie-authenticated changes.' });
    }
  }
  if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
    return res.status(403).json({ error: 'Request origin is not allowed for cookie-authenticated changes.' });
  }

  next();
});

const mediaJsonParser = express.json({ limit: '8mb' });
app.use('/api/products', mediaJsonParser);
app.use('/api/sellers', mediaJsonParser);
app.use('/api/riders', mediaJsonParser);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

directApiRoutes.get('/db/status', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ connected: true });
  } catch (error: any) {
    console.error('Database Connection Error:', error);
    res.status(500).json({ connected: false });
  }
});

directApiRoutes.get('/stats', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const statsRes = await query('SELECT * FROM gocart_admin_dashboard_stats()');
    const row = statsRes.rows[0] || {};
    res.json({
      totalCustomers: Number(row.total_customers || 0),
      totalSellers: Number(row.total_sellers || 0),
      approvedSellers: Number(row.approved_sellers || 0),
      pendingSellers: Number(row.pending_sellers || 0),
      totalProducts: Number(row.total_products || 0),
      activeProducts: Number(row.active_products || 0),
      totalOrders: Number(row.total_orders || 0),
      totalRevenue: Number(row.total_revenue || 0),
      dbProvider: 'Supabase / Cloud SQL (PostgreSQL - Schema Routines)',
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

directApiRoutes.get('/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(`
      SELECT id, username, email, role, id AS entity_id, created_at
      FROM users ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2
    `, [limit + 1, offset]);
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

directApiRoutes.get('/analytics/trending-products', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 12;
    const result = await query('SELECT * FROM gocart_trending_products($1)', [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ error: 'Failed to fetch trending products' });
  }
});

directApiRoutes.get('/analytics/top-rated-products', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 12;
    const result = await query('SELECT * FROM gocart_top_rated_products($1)', [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching top rated products:', error);
    res.status(500).json({ error: 'Failed to fetch top rated products' });
  }
});

directApiRoutes.get('/analytics/top-rated-sellers', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 3;
    const result = await query('SELECT * FROM gocart_top_rated_sellers($1)', [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching top rated sellers:', error);
    res.status(500).json({ error: 'Failed to fetch top rated sellers' });
  }
});

directApiRoutes.get('/analytics/related-products', async (req, res) => {
  try {
    const productId = typeof req.query.productId === 'string' ? req.query.productId.trim() : '';
    const limit = Math.min(5, Math.max(1, Number(req.query.limit) || 3));
    if (!productId) return res.status(400).json({ error: 'A productId is required.' });

    const result = await query(`
      SELECT companion.product_id_snapshot AS product_id,
        COUNT(DISTINCT companion.order_id)::integer AS co_purchase_orders,
        SUM(companion.quantity)::integer AS units_together
      FROM order_items selected
      JOIN orders order_record ON order_record.id = selected.order_id
      JOIN order_items companion
        ON companion.order_id = selected.order_id
        AND companion.product_id_snapshot <> selected.product_id_snapshot
      JOIN products product ON product.id = companion.product_id_snapshot
      WHERE selected.product_id_snapshot = $1
        AND order_record.status <> 'cancelled'
        AND product.product_status = 'active'
        AND product.stock > 0
      GROUP BY companion.product_id_snapshot
      ORDER BY COUNT(DISTINCT companion.order_id) DESC, SUM(companion.quantity) DESC
      LIMIT $2
    `, [productId, limit]);

    res.json(result.rows.map((row) => ({
      product_id: row.product_id,
      co_purchase_orders: Number(row.co_purchase_orders) || 0,
      units_together: Number(row.units_together) || 0,
    })));
  } catch (error: any) {
    console.error('Error fetching related products:', error);
    res.status(500).json({ error: 'Failed to fetch related products' });
  }
});

export const apiRouterMounts: Array<[string, express.Router]> = [
  ['/api', directApiRoutes],
  ['/api/auth', authRoutes],
  ['/api/categories', categoriesRoutes],
  ['/api/sellers', sellersRoutes],
  ['/api/customers', customersRoutes],
  ['/api/admins', adminsRoutes],
  ['/api/products', productsRoutes],
  ['/api/cart', cartRoutes],
  ['/api/orders', ordersRoutes],
  ['/api/bundles', bundlesRoutes],
  ['/api/analytics', sellerAnalyticsRoutes],
  ['/api/wishlist', wishlistRoutes],
  ['/api/support', supportRoutes],
  ['/api/reviews', reviewsRoutes],
  ['/api/ai', aiRoutes],
  ['/api/payment', paymentRoutes],
  ['/api/maps', mapsRoutes],
  ['/api/riders', ridersRoutes],
  ['/api/riders', riderDeliveryRoutes],
  ['/api/cron', cronRoutes],
  ['/api/payouts', payoutsRoutes],
];

for (const [prefix, routes] of apiRouterMounts) {
  app.use(prefix, routes);
}

app.use(errorHandler);