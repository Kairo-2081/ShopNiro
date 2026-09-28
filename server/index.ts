import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { query, getDatabaseProviderInfo } from './db/index.ts';
import { seedDatabaseIfEmpty } from './db/seed.ts';
import { errorHandler } from './middleware/errorHandler.ts';

// Route handlers
import authRoutes from './routes/auth.routes.ts';
import categoriesRoutes from './routes/categories.routes.ts';
import sellersRoutes from './routes/sellers.routes.ts';
import customersRoutes from './routes/customers.routes.ts';
import adminsRoutes from './routes/admins.routes.ts';
import productsRoutes from './routes/products.routes.ts';
import cartRoutes from './routes/cart.routes.ts';
import ordersRoutes from './routes/orders.routes.ts';
import reviewsRoutes from './routes/reviews.routes.ts';
import geminiRoutes from './routes/gemini.routes.ts';
import paymentRoutes from './routes/payment.routes.ts';

const app = express();
const PORT = 3000;

// Parse incoming JSON payloads
app.use(express.json());

// Seed database schema and sample data on server startup if empty
seedDatabaseIfEmpty().catch((err) => {
  console.error('Database seeding check failed on startup:', err);
});

// Database Health & Connectivity Status Endpoint
app.get('/api/db/status', async (req, res) => {
  const providerInfo = getDatabaseProviderInfo();
  try {
    const result = await query(`SELECT * FROM gocart_database_status()`);
    res.json({
      connected: true,
      provider: providerInfo.provider,
      isSupabase: providerInfo.isSupabase,
      database: result.rows[0]?.db_name || providerInfo.database,
      host: providerInfo.host,
      status: 'Connected & Healthy',
      queryTest: result.rows[0] || null,
    });
  } catch (error: any) {
    console.error('Database Connection Error:', error);
    res.status(500).json({
      connected: false,
      provider: providerInfo.provider,
      isSupabase: providerInfo.isSupabase,
      database: providerInfo.database,
      error: error.message || 'Database connection error',
    });
  }
});

// Admin Analytics & Management (Calling schema.sql stored routines)
app.get('/api/stats', async (req, res) => {
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

app.get('/api/admin/users', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM gocart_admins_users_list()`);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Top Charts, Top Trends, Top Sellers, and Category Performance (from schema.sql routines)
app.get('/api/analytics/top-sellers', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const result = await query(`SELECT * FROM gocart_top_sellers($1)`, [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching top sellers:', error);
    res.status(500).json({ error: 'Failed to fetch top sellers' });
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

app.get('/api/analytics/category-performance', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM gocart_category_performance()`);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching category performance:', error);
    res.status(500).json({ error: 'Failed to fetch category performance' });
  }
});

app.get('/api/analytics/top-customers', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const result = await query(`SELECT * FROM gocart_top_customers($1)`, [limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching top customers:', error);
    res.status(500).json({ error: 'Failed to fetch top customers' });
  }
});

app.post('/api/reset-seed', async (req, res) => {
  try {
    await seedDatabaseIfEmpty();
    res.json({ success: true, message: 'Database seed completed.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reset seed' });
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
app.use('/api/reviews', reviewsRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/payment', paymentRoutes);

// Global Error Handler for API routes
app.use(errorHandler);

// Vite Frontend Middleware Integration
async function startServer() {
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`GoCart E-Commerce Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
