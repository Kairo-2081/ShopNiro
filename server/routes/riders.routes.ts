import { Router } from 'express';
import Groq from 'groq-sdk';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pool, query } from '../db/index.ts';
import { hashPassword } from '../db/password.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { Address, Rider } from '../../src/types.ts';

const router = Router();
const require = createRequire(resolve(process.cwd(), 'server/routes/riders.routes.ts'));
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
const groqApiKey = process.env.GROQ_API_KEY?.trim();
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const maxCvBytes = 3 * 1024 * 1024;

function requireGroq() {
  if (!groq) {
    const error = new Error('AI CV assistance is unavailable. Please enter the information manually.');
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
}

function decodePdf(value: unknown): Buffer {
  if (typeof value !== 'string') throw new Error('Upload a PDF CV to continue.');
  const base64 = value.replace(/^data:application\/pdf;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > maxCvBytes || buffer.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('CV must be a valid PDF file under 3 MB.');
  }
  return buffer;
}

function parseJsonResponse(value: string): Record<string, unknown> {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI returned an unreadable CV result. Please fill the fields manually.');
  return JSON.parse(value.slice(start, end + 1));
}

function cleanList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20) : [];
}

function mapRider(row: any): Rider {
  return {
    Rider_ID: row.id,
    Username: row.username || '',
    Name: row.name,
    Email: row.email || '',
    Number: row.number || '',
    Present_Address: row.present_address_json || {},
    Permanent_Address: row.permanent_address_json || {},
    Experience: cleanList(row.experience_json),
    Previous_Jobs: cleanList(row.previous_jobs_json),
    Education: cleanList(row.education_json),
    Status: row.status,
    Has_CV: Boolean(row.has_cv),
    CV_File_Name: row.cv_file_name || undefined,
    Current_Latitude: row.current_latitude === null ? undefined : Number(row.current_latitude),
    Current_Longitude: row.current_longitude === null ? undefined : Number(row.current_longitude),
    Total_Deliveries: Number(row.total_deliveries) || 0,
    Timely_Deliveries: Number(row.timely_deliveries) || 0,
    Late_Deliveries: Number(row.late_deliveries) || 0,
    Performance_Points: Number(row.performance_points) || 100,
    Average_Rating: Number(row.average_rating) || 0,
    Wallet_Balance: Number(row.wallet_balance) || 0,
    Created_At: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

router.post('/cv/parse', async (req, res) => {
  try {
    requireGroq();
    const pdfBuffer = decodePdf(req.body?.cvBase64);
    const pdf = await pdfParse(pdfBuffer);
    const text = pdf.text.replace(/\s+/g, ' ').trim().slice(0, 45000);
    if (text.length < 40) return res.status(422).json({ error: 'This PDF has no readable text. Please enter your work and education details manually.' });

    const aiResult = await groq!.chat.completions.create({
      model: process.env.GROQ_MODEL_FAST?.trim() || 'openai/gpt-oss-20b',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Extract only facts explicitly present in the CV. Return one JSON object with string-array fields experience, previousJobs, and education. Use empty arrays for missing information. Do not infer facts.' },
        { role: 'user', content: text },
      ],
    });
    const parsed = parseJsonResponse(aiResult.choices[0]?.message?.content || '');
    const extracted = {
      experience: cleanList(parsed.experience),
      previousJobs: cleanList(parsed.previousJobs),
      education: cleanList(parsed.education),
    };
    const missingFields = Object.entries(extracted).filter(([, values]) => values.length === 0).map(([field]) => field);
    return res.json({ extracted, missingFields });
  } catch (error: any) {
    const statusCode = error?.statusCode || 400;
    return res.status(statusCode).json({ error: error.message || 'Could not read this CV.' });
  }
});

router.post('/cv/format', async (req, res) => {
  try {
    requireGroq();
    const { experience, previousJobs, education } = req.body ?? {};
    const response = await groq!.chat.completions.create({
      model: process.env.GROQ_MODEL_FAST?.trim() || 'openai/gpt-oss-20b',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Organize the applicant-provided facts into clear, consistent CV bullet points. Do not add or infer facts. Return one JSON object with string-array fields experience, previousJobs, and education. Preserve empty arrays.' },
        { role: 'user', content: JSON.stringify({ experience, previousJobs, education }) },
      ],
    });
    const parsed = parseJsonResponse(response.choices[0]?.message?.content || '');
    return res.json({
      experience: cleanList(parsed.experience),
      previousJobs: cleanList(parsed.previousJobs),
      education: cleanList(parsed.education),
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || 503;
    return res.status(statusCode).json({ error: error.message || 'Could not format the CV. You can continue with your manual details.' });
  }
});

router.post('/apply', async (req, res) => {
  const {
    Username,
    Name,
    Email,
    Password,
    Number: phone,
    Present_Address,
    Permanent_Address,
    Has_CV,
    CV_Base64,
    CV_File_Name,
    Experience,
    Previous_Jobs,
    Education,
  } = req.body ?? {};

  if (![Username, Name, Email, Password, phone].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'Name, username, email, password, and phone number are required.' });
  }
  if (String(Password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (
    !Present_Address?.Street || !Present_Address?.City || !Permanent_Address?.Street || !Permanent_Address?.City ||
    !Number.isFinite(Number(Present_Address?.Latitude)) || !Number.isFinite(Number(Present_Address?.Longitude)) ||
    !Number.isFinite(Number(Permanent_Address?.Latitude)) || !Number.isFinite(Number(Permanent_Address?.Longitude))
  ) {
    return res.status(400).json({ error: 'Select map locations and complete both present and permanent addresses.' });
  }

  let cvBuffer: Buffer | null = null;
  if (Has_CV) {
    try {
      cvBuffer = decodePdf(CV_Base64);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  const client = await pool.connect();
  try {
    const riderId = `RDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const username = String(Username).trim().toLowerCase();
    const email = String(Email).trim().toLowerCase();
    await client.query('BEGIN');
    const duplicate = await client.query(
      'SELECT 1 FROM users WHERE lower(email) = $1 OR lower(username) = $2 LIMIT 1',
      [email, username]
    );
    if (duplicate.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That email or username is already registered.' });
    }
    await client.query(
      'INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, $5)',
      [riderId, username, await hashPassword(String(Password)), email, 'rider']
    );
    await client.query(
      `INSERT INTO riders (
        id, name, number, status, present_address_json, permanent_address_json,
        has_cv, cv_file_name, cv_pdf, experience_json, previous_jobs_json, education_json
      ) VALUES ($1, $2, $3, 'pending', $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)`,
      [
        riderId,
        String(Name).trim(),
        String(phone).trim(),
        JSON.stringify(Present_Address as Address),
        JSON.stringify(Permanent_Address as Address),
        Boolean(Has_CV),
        Has_CV && typeof CV_File_Name === 'string' ? CV_File_Name.slice(0, 255) : null,
        cvBuffer,
        JSON.stringify(cleanList(Experience)),
        JSON.stringify(cleanList(Previous_Jobs)),
        JSON.stringify(cleanList(Education)),
      ]
    );
    await client.query('COMMIT');
    return res.status(201).json({ success: true, status: 'pending', message: 'Application received. An administrator must approve your rider account before sign-in.' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Rider application failed:', error);
    return res.status(500).json({ error: 'Could not submit rider application.' });
  } finally {
    client.release();
  }
});

router.get('/applications', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const result = await query(`
      SELECT r.*, u.username, u.email
      FROM riders r JOIN users u ON u.id = r.id
      ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
    `);
    res.json(result.rows.map(mapRider));
  } catch (error: any) {
    console.error('Failed to load rider applications:', error);
    res.status(500).json({ error: 'Failed to load rider applications.' });
  }
});

router.get('/applications/:id/cv', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await query('SELECT cv_file_name, cv_pdf FROM riders WHERE id = $1 AND has_cv = TRUE', [req.params.id]);
    if (!result.rows.length || !result.rows[0].cv_pdf) return res.status(404).json({ error: 'CV not found.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${String(result.rows[0].cv_file_name || 'rider-cv.pdf').replace(/[\r\n"]+/g, '')}"`);
    return res.send(result.rows[0].cv_pdf);
  } catch (error: any) {
    console.error('Failed to fetch rider CV:', error);
    return res.status(500).json({ error: 'Failed to fetch CV.' });
  }
});

router.patch('/applications/:id/status', requireAuth, requireRole(['admin']), async (req, res) => {
  const { status } = req.body ?? {};
  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Choose approved, rejected, or suspended.' });
  }
  try {
    const result = await query(
      'UPDATE riders SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, status',
      [req.params.id, status]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Rider application not found.' });
    return res.json({ Rider_ID: result.rows[0].id, Status: result.rows[0].status });
  } catch (error: any) {
    console.error('Failed to update rider application:', error);
    return res.status(500).json({ error: 'Failed to update rider application.' });
  }
});

router.get('/me', requireAuth, requireRole(['rider']), async (req: AuthRequest, res) => {
  try {
    const currentDate = new Date();
    const monthStart = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
    await query(
      `INSERT INTO rider_monthly_scores (rider_id, month_start, performance_points)
      VALUES ($1, $2::date, 100) ON CONFLICT (rider_id, month_start) DO NOTHING`,
      [req.user!.entityId, monthStart]
    );
    await query(
      `UPDATE riders SET performance_points = (
        SELECT performance_points FROM rider_monthly_scores WHERE rider_id = $1 AND month_start = $2::date
      ) WHERE id = $1`,
      [req.user!.entityId, monthStart]
    );
    const result = await query(`
      SELECT r.*, u.username, u.email,
        COALESCE((SELECT AVG(rr.rating) FROM rider_reviews rr WHERE rr.rider_id = r.id), 0) AS average_rating
      FROM riders r JOIN users u ON u.id = r.id WHERE r.id = $1
    `, [req.user!.entityId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Rider profile not found.' });
    return res.json(mapRider(result.rows[0]));
  } catch (error: any) {
    console.error('Failed to load rider profile:', error);
    return res.status(500).json({ error: 'Failed to load rider profile.' });
  }
});

export default router;