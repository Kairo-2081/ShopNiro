import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { query } from './db/index.ts';
import { ensureDatabaseSchema, seedDatabaseIfEmpty } from './db/seed.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { requireAuth, requireRole, optionalAuth, AuthRequest } from './middleware/auth.ts';
import { enforcePublicApiPolicy } from './middleware/publicRoutes.ts';

// Route handlers
import authRoutes from './routes/auth.routes.ts';
import categoriesRoutes from './routes/categories.routes.ts';
import sellersRoutes from './routes/sellers.routes.ts';
import customersRoutes from './routes/customers.routes.ts';
import adminsRoutes from './routes/admins.routes.ts';
import productsRoutes from './routes/products.routes.ts';
import cartRoutes from './routes/cart.routes.ts';
import ordersRoutes, { expirePendingOrders } from './routes/orders.routes.ts';
import reviewsRoutes from './routes/reviews.routes.ts';
import aiRoutes from './routes/ai.routes.ts';
import paymentRoutes, { startRefundProcessor } from './routes/payment.routes.ts';
import mapsRoutes from './routes/maps.routes.ts';
import ridersRoutes from './routes/riders.routes.ts';
import riderDeliveryRoutes from './routes/rider-delivery.routes.ts';
import bundlesRoutes from './routes/bundles.routes.ts';
import sellerAnalyticsRoutes from './routes/analytics.routes.ts';
import wishlistRoutes from './routes/wishlist.routes.ts';
import supportRoutes from './routes/support.routes.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set('trust proxy', 1);
const isProduction = process.env.NODE_ENV === 'production';
const keyedRateLimit = (req: express.Request) => (req as AuthRequest).user?.userId || ipKeyGenerator(req.ip || '');
const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => /^\/api\/payment\/sslcommerz\/(ipn|success|fail|cancel)$/.test(req.originalUrl.split('?')[0]),
});
const aiRateLimit = rateLimit({ windowMs: 60_000, limit: 10, keyGenerator: keyedRateLimit, standardHeaders: true, legacyHeaders: false });
const mapsRateLimit = rateLimit({ windowMs: 60_000, limit: 30, keyGenerator: keyedRateLimit, standardHeaders: true, legacyHeaders: false });
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

// Keep larger JSON allowances isolated to APIs that accept inline media.
const mediaJsonParser = express.json({ limit: '8mb' });
app.use('/api/products', mediaJsonParser);
app.use('/api/sellers', mediaJsonParser);
app.use('/api/riders', mediaJsonParser);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Database Health & Connectivity Status Endpoint
app.get('/api/db/status', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ connected: true });
  } catch (error: any) {
    console.error('Database Connection Error:', error);
    res.status(500).json({ connected: false });
  }
});

// Admin Analytics & Management (Calling schema.sql stored routines)
app.get('/api/stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const statsRes = await query(`SELECT * FROM gocart_admin_dashboard_stats()`);
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

app.get('/api/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(`
      SELECT id, username, email, role, id AS entity_id, created_at
      FROM users ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2
    `, [limit + 1, offset]);
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/analytics/trending-products', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 12;
    const result = await query(`SELECT * FROM gocart_trending_products($1)`, [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ error: 'Failed to fetch trending products' });
  }
});

app.get('/api/analytics/top-rated-products', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 12;
    const result = await query(`SELECT * FROM gocart_top_rated_products($1)`, [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching top rated products:', error);
    res.status(500).json({ error: 'Failed to fetch top rated products' });
  }
});

app.get('/api/analytics/top-rated-sellers', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 3;
    const result = await query(`SELECT * FROM gocart_top_rated_sellers($1)`, [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching top rated sellers:', error);
    res.status(500).json({ error: 'Failed to fetch top rated sellers' });
  }
});

app.get('/api/analytics/related-products', async (req, res) => {
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

// Mount Modular Route Handlers
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/sellers', sellersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/admins', adminsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/bundles', bundlesRoutes);
app.use('/api/analytics', sellerAnalyticsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/riders', ridersRoutes);
app.use('/api/riders', riderDeliveryRoutes);

// Global Error Handler for API routes
app.use(errorHandler);

// Vite Frontend Middleware Integration
async function startServer() {
  try {
    const shouldRunSchemaOnStart = process.env.RUN_SCHEMA_ON_START === 'true';
    if (shouldRunSchemaOnStart) {
      await ensureDatabaseSchema();
    }
    if (process.env.SEED_ON_START === 'true' && process.env.NODE_ENV !== 'production') {
      await seedDatabaseIfEmpty();
    }
  } catch (error) {
    console.error('Database initialization failed; server was not started:', error);
    process.exitCode = 1;
    return;
  }

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const listenOnAvailablePort = (port: number): Promise<number> =>
    new Promise((resolve, reject) => {
      const onListening = () => {
        httpServer.off('error', onError);
        const address = httpServer.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Could not determine the server port.'));
          return;
        }
        resolve(address.port);
      };

      const onError = (error: NodeJS.ErrnoException) => {
        httpServer.off('listening', onListening);
        httpServer.off('error', onError);
        if (error.code !== 'EADDRINUSE') {
          reject(error);
          return;
        }

        const nextPort = port + 1;
        console.warn(`Port ${port} is already in use; trying port ${nextPort}.`);
        listenOnAvailablePort(nextPort).then(resolve, reject);
      };

      httpServer.once('listening', onListening);
      httpServer.once('error', onError);
      httpServer.listen(port, '0.0.0.0');
    });

  try {
    if (process.env.RUN_BACKGROUND_JOBS === 'true') {
      await expirePendingOrders();
      startRefundProcessor();
    }
    const actualPort = await listenOnAvailablePort(PORT);
    console.log(`ShopNiro E-Commerce Server running on http://localhost:${actualPort}`);
  } catch (error) {
    console.error('Failed to start ShopNiro server:', error);
    process.exitCode = 1;
  }
}

startServer();

export default app;
