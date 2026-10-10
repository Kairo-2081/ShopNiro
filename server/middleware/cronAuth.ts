import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CRON_SECRET || '';
  const authorization = req.headers.authorization || '';
  const got = authorization.replace(/^Bearer\s+/i, '') || String(req.headers['x-cron-secret'] || '');
  if (!expected) {
    res.status(503).json({ error: 'Cron is not configured.' });
    return;
  }

  const expectedBuffer = Buffer.from(expected);
  const gotBuffer = Buffer.from(got);
  if (expectedBuffer.length !== gotBuffer.length || !timingSafeEqual(expectedBuffer, gotBuffer)) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  next();
}