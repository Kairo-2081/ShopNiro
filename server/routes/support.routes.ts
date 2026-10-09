import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db/index.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { sendSupportRequestEmail } from '../services/email.service.ts';

const router = Router();
const supportSubmissionLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many support requests. Please try again later.' },
});

router.post('/requests', supportSubmissionLimit, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 160) : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 255) : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 160) : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 5000) : '';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || message.length < 10) {
    return res.status(400).json({ error: 'Provide your name, a valid email, a subject, and a message of at least 10 characters.' });
  }

  const requestId = `SUP-${randomUUID()}`;
  try {
    await query(
      `INSERT INTO support_requests (id, name, email, subject, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [requestId, name, email, subject, message]
    );
    try {
      await sendSupportRequestEmail({ name, email, subject, message, requestId });
    } catch (emailError) {
      console.error('Support request email notification failed:', emailError);
    }
    return res.status(201).json({ success: true, Request_ID: requestId });
  } catch (error) {
    console.error('Could not save support request:', error);
    return res.status(500).json({ error: 'Could not send your support request. Please try again later.' });
  }
});

router.get('/requests', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(
      `SELECT id, name, email, subject, message, status, admin_notes, created_at, updated_at, resolved_at
       FROM support_requests ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
      [limit + 1, offset]
    );
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    return res.json(result.rows.slice(0, limit).map((row) => ({
      Request_ID: row.id,
      Name: row.name,
      Email: row.email,
      Subject: row.subject,
      Message: row.message,
      Status: row.status,
      Admin_Notes: row.admin_notes,
      Created_At: new Date(row.created_at).toISOString(),
      Updated_At: new Date(row.updated_at).toISOString(),
      Resolved_At: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
    })));
  } catch (error) {
    console.error('Could not load support requests:', error);
    return res.status(500).json({ error: 'Could not load support requests.' });
  }
});

router.patch('/requests/:id/status', requireAuth, requireRole(['admin']), async (req, res) => {
  const status = req.body?.status;
  const adminNotes = typeof req.body?.adminNotes === 'string' ? req.body.adminNotes.trim().slice(0, 2000) : '';
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Choose open, in progress, or resolved.' });
  }
  try {
    const result = await query(
      `UPDATE support_requests SET status = $2, admin_notes = $3, updated_at = CURRENT_TIMESTAMP,
        resolved_at = CASE WHEN $2 = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $1 RETURNING id, status`,
      [req.params.id, status, adminNotes]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Support request not found.' });
    return res.json({ success: true, Request_ID: result.rows[0].id, Status: result.rows[0].status });
  } catch (error) {
    console.error('Could not update support request:', error);
    return res.status(500).json({ error: 'Could not update support request.' });
  }
});

export default router;