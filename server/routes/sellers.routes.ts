import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import rateLimit from 'express-rate-limit';
import { pool, query, mapAddress } from '../db/index.ts';
import { hashPassword } from '../db/password.ts';
import { requireAuth, requireRole, optionalAuth, AuthRequest } from '../middleware/auth.ts';
import { createSellerDocumentSignedUrl, deleteSellerDocument, uploadSellerDocument } from '../services/sellerDocuments.service.ts';
import { Seller } from '../../src/types.ts';

const router = Router();
const createApplicationReviewAudit = async (accountType: 'seller' | 'rider', accountId: string, adminId: string, decision: 'approved' | 'rejected', reason: string) => {
  await query(
    `INSERT INTO application_review_audit (id, account_type, account_id, admin_id, decision, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [`APPREV-${randomUUID()}`, accountType, accountId, adminId, decision, reason]
  );
};
const sanitizeReviewReason = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim().slice(0, 2000) : '';
  return text;
};
const decodeIdentityDocument = (value: unknown): { buffer: Buffer; mimeType: string } => {
  if (typeof value !== 'string') throw new Error('Upload a government ID document.');
  const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([a-zA-Z0-9+/]+=*)$/i.exec(value);
  if (!match) throw new Error('ID document must be a PDF, JPG, or PNG.');
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  const validSignature = mimeType === 'application/pdf'
    ? buffer.subarray(0, 4).toString() === '%PDF'
    : mimeType === 'image/jpeg'
    ? buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!buffer.length || buffer.length > 5 * 1024 * 1024 || !validSignature) throw new Error('Upload a valid ID document no larger than 5 MB.');
  return { buffer, mimeType };
};
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many seller application attempts. Try again later.' },
});

/**
 * GET /api/sellers
 * Returns list of all sellers (via schema gocart_sellers_list)
 */
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query('SELECT * FROM seller_profiles ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2', [limit + 1, offset]);
    const formatted: Array<Omit<Seller, 'Email' | 'Number'> & Partial<Pick<Seller, 'Email' | 'Number'>>> = result.rows.map((s: any) => ({
      Seller_ID: s.id,
      Username: s.username || '',
      Name: s.name,
      ...(req.user?.role === 'admin' ? { Email: s.email || '', Number: s.number || '' } : {}),
      ...(req.user?.role === 'admin' ? {
        Identity_Verified: Boolean(s.identity_verified),
        Documents_Reviewed: Boolean(s.documents_reviewed),
        Payout_Verified: Boolean(s.payout_verified),
        Payout_Method: s.payout_method || '',
        Payout_Account: s.payout_account || '',
      } : {}),
      Address: mapAddress(s),
      Logo: s.logo || '',
      Description: s.description || '',
      Status: s.status as any,
      Created_At: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
    }));
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    res.json(formatted.slice(0, limit));
  } catch (error: any) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Failed to fetch sellers' });
  }
});

/**
 * POST /api/sellers
 * Register new seller (via schema gocart_seller_create)
 */
router.post('/', registrationRateLimit, async (req, res) => {
  let client: PoolClient | undefined;
  let identityStoragePath: string | undefined;
  try {
    const { Name, Email, Password, Number: phoneNum, Address, Logo, Description, Username,
      Business_Registration_Number, Payout_Method, Payout_Account, Identity_Document, Identity_Document_File_Name } = req.body;
    if (!Name || !Email) {
      return res.status(400).json({ error: 'Name and Email are required' });
    }
    if (typeof Password !== 'string' || Password.trim().length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const phone = typeof phoneNum === 'string' ? phoneNum.trim() : '';
    if (!phone) {
      return res.status(400).json({ error: 'A phone number is required' });
    }
    const payoutMethod = Payout_Method === 'bkash' || Payout_Method === 'bank' ? Payout_Method : '';
    const payoutAccount = typeof Payout_Account === 'string' ? Payout_Account.trim() : '';
    if (!payoutMethod || payoutAccount.length < 6 || payoutAccount.length > 100) {
      return res.status(400).json({ error: 'Choose bKash or bank payout and provide a valid payout account.' });
    }
    let identityDocument: { buffer: Buffer; mimeType: string };
    try {
      identityDocument = decodeIdentityDocument(Identity_Document);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
    if (!Address?.Street?.trim() || !Address?.City?.trim()) {
      return res.status(400).json({ error: 'Select a location and provide a street and city' });
    }
    const cleanEmail = Email.trim().toLowerCase();

    // Check if user with this email already exists
    const existing = await query(`SELECT * FROM gocart_auth_user_lookup($1, '')`, [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please log in instead.' });
    }

    const id = `SEL-${Date.now()}`;
    const hashedPassword = await hashPassword(Password);
    const logoUrl = Logo || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&auto=format&fit=crop&q=80';
    const desc = Description || '';
    const username = Username || cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const addr = Address || {};
    const houseName = addr.House_Name || '';
    const street = addr.Street.trim();
    const city = addr.City.trim();
    const postalCode = addr.Postal_Code || '';
    const addInfo = addr.Additional_Info || '';

    identityStoragePath = await uploadSellerDocument(id, 'national_id', identityDocument.buffer, identityDocument.mimeType);
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT * FROM gocart_seller_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, username, Name, cleanEmail, hashedPassword, phone, logoUrl, desc, houseName, street, city, postalCode, addInfo]
    );
    await client.query(
      `UPDATE sellers SET address_latitude = $2, address_longitude = $3,
        business_registration_number = $4, payout_method = $5, payout_account = $6 WHERE id = $1`,
      [id, Number.isFinite(Number(addr.Latitude)) ? Number(addr.Latitude) : null, Number.isFinite(Number(addr.Longitude)) ? Number(addr.Longitude) : null,
        typeof Business_Registration_Number === 'string' ? Business_Registration_Number.trim().slice(0, 100) : '', payoutMethod, payoutAccount]
    );
    await client.query(
      `INSERT INTO seller_documents (id, seller_id, doc_type, storage_path)
       VALUES ($1, $2, 'national_id', $3)`,
      [`SDOC-${randomUUID()}`, id, identityStoragePath]
    );
    await client.query('COMMIT');

    const s = result.rows[0];
    const newSeller: Seller = {
      Seller_ID: id,
      Username: username,
      Name,
      Email: cleanEmail,
      Number: phone,
      Address: {
        House_Name: houseName,
        Street: street,
        City: city,
        Postal_Code: postalCode,
        Additional_Info: addInfo,
        Latitude: Number.isFinite(Number(addr.Latitude)) ? Number(addr.Latitude) : undefined,
        Longitude: Number.isFinite(Number(addr.Longitude)) ? Number(addr.Longitude) : undefined,
      },
      Logo: logoUrl,
      Description: desc,
      Status: 'pending',
      Created_At: s?.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
    };

    res.status(201).json(newSeller);
  } catch (error: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (identityStoragePath) await deleteSellerDocument(identityStoragePath);
    console.error('Error creating seller:', error);
    res.status(error?.statusCode || 500).json({ error: error.message || 'Failed to create seller' });
  } finally {
    client?.release();
  }
});

router.get('/applications/:id/identity-document', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT storage_path FROM seller_documents
       WHERE seller_id = $1 AND doc_type = 'national_id'
       ORDER BY uploaded_at DESC LIMIT 1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Seller identity document not found.' });
    const url = await createSellerDocumentSignedUrl(result.rows[0].storage_path);
    return res.json({ url, expiresInSeconds: 300 });
  } catch (error) {
    console.error('Could not fetch seller identity document:', error);
    return res.status((error as any)?.statusCode || 500).json({ error: 'Could not fetch seller identity document.' });
  }
});

router.put('/me/profile', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  const { Name, Username, Email, Number: phone, Logo, Description, Address, Payout_Method, Payout_Account } = req.body ?? {};
  if (![Name, Username, Email, phone].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'Store name, username, email, and phone number are required.' });
  }
  if (
    !Address?.Street?.trim() || !Address?.City?.trim() ||
    !Number.isFinite(Number(Address?.Latitude)) || !Number.isFinite(Number(Address?.Longitude))
  ) {
    return res.status(400).json({ error: 'Select the updated business address on the map.' });
  }

  const client = await pool.connect();
  try {
    const sellerId = req.user!.entityId;
    const username = String(Username).trim().toLowerCase();
    const email = String(Email).trim().toLowerCase();
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT s.*, u.username, u.email FROM sellers s JOIN users u ON u.id = s.id WHERE s.id = $1 FOR UPDATE OF s, u`,
      [sellerId]
    );
    if (!currentResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller profile not found.' });
    }
    const current = currentResult.rows[0];
    const payoutMethod = Payout_Method === undefined ? current.payout_method || '' : Payout_Method;
    const payoutAccount = Payout_Account === undefined ? current.payout_account || '' : String(Payout_Account).trim();
    if (!['', 'bank', 'bkash'].includes(payoutMethod) || payoutAccount.length > 100) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a valid payout method and account.' });
    }
    if ((Payout_Method !== undefined || Payout_Account !== undefined) && Boolean(payoutMethod) !== Boolean(payoutAccount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payout method and payout account must be provided together.' });
    }
    const payoutChanged = payoutMethod !== (current.payout_method || '') || payoutAccount !== (current.payout_account || '');
    const changed = [
      [current.name, String(Name).trim()],
      [current.username, username],
      [current.email, email],
      [current.number || '', String(phone).trim()],
      [current.logo || '', typeof Logo === 'string' ? Logo.trim() : ''],
      [current.description || '', typeof Description === 'string' ? Description.trim() : ''],
      [current.address_house_name || '', String(Address.House_Name || '')],
      [current.address_street || '', String(Address.Street).trim()],
      [current.address_city || '', String(Address.City).trim()],
      [current.address_postal_code || '', String(Address.Postal_Code || '')],
      [current.address_additional_info || '', String(Address.Additional_Info || '')],
      [Number(current.address_latitude), Number(Address.Latitude)],
      [Number(current.address_longitude), Number(Address.Longitude)],
    ].some(([before, after]) => before !== after) || payoutChanged;
    const duplicate = await client.query(
      'SELECT 1 FROM users WHERE id <> $1 AND (lower(username) = $2 OR lower(email) = $3) LIMIT 1',
      [sellerId, username, email]
    );
    if (duplicate.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That username or email is already in use.' });
    }
    await client.query('UPDATE users SET username = $2, email = $3 WHERE id = $1 AND role = $4', [sellerId, username, email, 'seller']);
    await client.query(`
      UPDATE sellers SET name = $2, number = $3, logo = $4, description = $5,
        address_house_name = $6, address_street = $7, address_city = $8,
        address_postal_code = $9, address_additional_info = $10,
        address_latitude = $11, address_longitude = $12,
        payout_method = $13, payout_account = $14,
        payout_verified = CASE WHEN $15 THEN FALSE ELSE payout_verified END,
        status = CASE WHEN $16 THEN 'pending' ELSE status END
      WHERE id = $1
    `, [
      sellerId,
      String(Name).trim(),
      String(phone).trim(),
      typeof Logo === 'string' ? Logo.trim() : '',
      typeof Description === 'string' ? Description.trim() : '',
      String(Address.House_Name || ''),
      String(Address.Street).trim(),
      String(Address.City).trim(),
      String(Address.Postal_Code || ''),
      String(Address.Additional_Info || ''),
      Number(Address.Latitude),
      Number(Address.Longitude),
      payoutMethod,
      payoutAccount,
      payoutChanged,
      changed,
    ]);
    await client.query('COMMIT');
    const profile = await query('SELECT * FROM gocart_seller_get($1)', [sellerId]);
    const seller = profile.rows[0];
    if (!seller) return res.status(404).json({ error: 'Seller profile not found.' });
    return res.json({
      Seller_ID: seller.id,
      Username: seller.username || username,
      Name: seller.name,
      Email: seller.email || email,
      Number: seller.number || '',
      Address: mapAddress(seller),
      Logo: seller.logo || '',
      Description: seller.description || '',
      Status: seller.status,
      Payout_Method: seller.payout_method || payoutMethod,
      Payout_Account: seller.payout_account || payoutAccount,
      Payout_Verified: Boolean(seller.payout_verified),
      Created_At: seller.created_at ? new Date(seller.created_at).toISOString() : new Date().toISOString(),
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return res.status(409).json({ error: 'That username or email is already in use.' });
    console.error('Could not update seller profile:', error);
    return res.status(500).json({ error: 'Could not update store details.' });
  } finally {
    client.release();
  }
});

router.get('/me/wallet', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, entry_type, amount, reference_id, description, available_at, created_at
      FROM seller_wallet_entries WHERE seller_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`,
      [req.user!.entityId]
    );
    const total = await query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE available_at <= CURRENT_TIMESTAMP), 0) AS available,
        COALESCE(SUM(amount) FILTER (WHERE available_at > CURRENT_TIMESTAMP), 0) AS pending
       FROM seller_wallet_entries WHERE seller_id = $1`,
      [req.user!.entityId]
    );
    const payout = await query('SELECT payout_verified FROM sellers WHERE id = $1', [req.user!.entityId]);
    return res.json({
      available: Number(total.rows[0]?.available) || 0,
      pending: Number(total.rows[0]?.pending) || 0,
      payoutVerified: Boolean(payout.rows[0]?.payout_verified),
      entries: result.rows,
    });
  } catch (error: any) {
    console.error('Could not load seller wallet:', error);
    return res.status(500).json({ error: 'Could not load seller COD remittances.' });
  }
});

router.post('/me/payouts', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Payout amount must be greater than zero.' });

  const client = await pool.connect();
  try {
    const sellerId = req.user!.entityId;
    await client.query('BEGIN');
    const sellerResult = await client.query(
      'SELECT payout_verified, payout_method, payout_account FROM sellers WHERE id = $1 FOR UPDATE',
      [sellerId]
    );
    const seller = sellerResult.rows[0];
    if (!seller) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Seller not found.' });
    }
    if (!seller.payout_verified) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An admin must verify your payout account before requesting a payout.' });
    }
    const balanceResult = await client.query(`
      SELECT COALESCE(SUM(amount), 0) AS available
      FROM seller_wallet_entries WHERE seller_id = $1 AND available_at <= CURRENT_TIMESTAMP
    `, [sellerId]);
    const available = Number(balanceResult.rows[0]?.available) || 0;
    if (amount > available) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Payout amount exceeds your available balance.' });
    }

    const payoutId = `POUT-${randomUUID()}`;
    await client.query(`
      INSERT INTO seller_payouts (id, seller_id, amount, method, account)
      VALUES ($1, $2, $3, $4, $5)
    `, [payoutId, sellerId, amount, seller.payout_method, seller.payout_account]);
    await client.query(`
      INSERT INTO seller_wallet_entries (id, seller_id, entry_type, amount, reference_id, description, available_at)
      VALUES ($1, $2, 'payout', $3, $4, $5, now())
      ON CONFLICT (seller_id, entry_type, reference_id) DO NOTHING
    `, [`POUT-ENTRY-${randomUUID()}`, sellerId, -amount, payoutId, `Payout request ${payoutId}`]);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, payoutId, amount, status: 'requested' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Could not request seller payout:', error);
    return res.status(500).json({ error: 'Could not request seller payout.' });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/sellers/:id/status
 * Approves or suspends a seller (via schema gocart_seller_status_update)
 */
router.patch('/:id/status', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, reason, identityVerified, documentsReviewed, payoutVerified } = req.body ?? {};
    const reviewReason = sanitizeReviewReason(reason);
    if (!status || !['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }
    if (status === 'rejected' && !reviewReason) {
      return res.status(400).json({ error: 'A rejection reason is required.' });
    }
    if (status === 'approved' && [identityVerified, documentsReviewed, payoutVerified].some((value) => value !== true)) {
      return res.status(400).json({ error: 'Confirm identity, document review, and payout verification before approval.' });
    }

    const sellerRow = await query('SELECT id, status FROM sellers WHERE id = $1', [id]);
    if (!sellerRow.rows.length) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    if (status === 'approved') {
      const verification = await query(
        `SELECT 1 FROM seller_documents WHERE seller_id = $1 LIMIT 1`,
        [id]
      );
      if (!verification.rows.length) {
        return res.status(400).json({ error: 'Seller verification documents are required before approval.' });
      }
    }

    await query(`
      UPDATE sellers SET status = $1,
        identity_verified = CASE WHEN $1 = 'approved' THEN $2 ELSE identity_verified END,
        documents_reviewed = CASE WHEN $1 = 'approved' THEN $3 ELSE documents_reviewed END,
        payout_verified = CASE WHEN $1 = 'approved' THEN $4 ELSE payout_verified END
      WHERE id = $5
    `, [status, identityVerified === true, documentsReviewed === true, payoutVerified === true, id]);
    if (status === 'approved' || status === 'rejected') {
      await createApplicationReviewAudit('seller', id, req.user!.entityId, status, reviewReason || 'Approved after administrative review.');
    }

    const profile = await query('SELECT * FROM seller_profiles WHERE id = $1', [id]);
    if (!profile.rows.length) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const s = profile.rows[0];
    return res.json({
      Seller_ID: s.id,
      Username: s.username || '',
      Name: s.name,
      Email: s.email || '',
      Number: s.number || '',
      Address: mapAddress(s),
      Logo: s.logo || '',
      Description: s.description || '',
      Status: s.status as any,
      Created_At: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error updating seller status:', error);
    return res.status(500).json({ error: 'Failed to update seller status' });
  }
});

export default router;
