import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { app } from './app.ts';
import { ensureDatabaseSchema, seedDatabaseIfEmpty } from './db/seed.ts';
import { startRefundProcessor } from './routes/payment.routes.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    const shouldRunSchemaOnStart = process.env.RUN_SCHEMA_ON_START === 'true' || (process.env.NODE_ENV !== 'production' && process.env.RUN_SCHEMA_ON_START !== 'false');
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
    app.get('*', (_req, res) => {
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
    if (process.env.RUN_IN_PROCESS_JOBS === 'true') {
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