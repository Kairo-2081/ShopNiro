import { Router } from 'express';
import { pool, query, mapAddress } from '../db/index.ts';
import { hashPassword } from '../db/password.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Seller } from '../../src/types.ts';

const router = Router();

/**
 * GET /api/sellers
 * Returns list of all sellers (via schema gocart_sellers_list)
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM gocart_sellers_list()`);
    const formatted: Seller[] = result.rows.map((s: any) => ({
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
    }));
    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Failed to fetch sellers' });
  }
});

/**
 * POST /api/sellers
 * Register new seller (via schema gocart_seller_create)
 */
router.post('/', async (req, res) => {
  try {
    const { Name, Email, Password, Number: phoneNum, Address, Logo, Description, Username } = req.body;
    if (!Name || !Email) {
      return res.status(400).json({ error: 'Name and Email are required' });
    }
    const phone = typeof phoneNum === 'string' ? phoneNum.trim() : '';
    if (!phone) {
      return res.status(400).json({ error: 'A phone number is required' });
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
    const rawPassword = Password || 'seller123';
    const hashedPassword = await hashPassword(rawPassword);
    const logoUrl = Logo || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&auto=format&fit=crop&q=80';
    const desc = Description || '';
    const username = Username || cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const addr = Address || {};
    const houseName = addr.House_Name || '';
    const street = addr.Street.trim();
    const city = addr.City.trim();
    const postalCode = addr.Postal_Code || '';
    const addInfo = addr.Additional_Info || '';

    const result = await query(
      `SELECT * FROM gocart_seller_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, username, Name, cleanEmail, hashedPassword, phone, logoUrl, desc, houseName, street, city, postalCode, addInfo]
    );
    await query(
      'UPDATE sellers SET address_latitude = $2, address_longitude = $3 WHERE id = $1',
      [id, Number.isFinite(Number(addr.Latitude)) ? Number(addr.Latitude) : null, Number.isFinite(Number(addr.Longitude)) ? Number(addr.Longitude) : null]
    );

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
    console.error('Error creating seller:', error);
    res.status(500).json({ error: error.message || 'Failed to create seller' });
  }
});

router.put('/me/profile', requireAuth, requireRole(['seller']), async (req: AuthRequest, res) => {
  const { Name, Username, Email, Number: phone, Logo, Description, Address } = req.body ?? {};
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
    ].some(([before, after]) => before !== after);
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
        status = CASE WHEN $13 THEN 'pending' ELSE status END
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
      `SELECT id, entry_type, amount, reference_id, description, created_at
      FROM seller_wallet_entries WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user!.entityId]
    );
    const total = await query(
      `SELECT COALESCE(SUM(amount), 0) AS balance FROM seller_wallet_entries WHERE seller_id = $1`,
      [req.user!.entityId]
    );
    return res.json({ balance: Number(total.rows[0]?.balance) || 0, entries: result.rows });
  } catch (error: any) {
    console.error('Could not load seller wallet:', error);
    return res.status(500).json({ error: 'Could not load seller COD remittances.' });
  }
});

/**
 * PATCH /api/sellers/:id/status
 * Approves or suspends a seller (via schema gocart_seller_status_update)
 */
router.patch('/:id/status', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const result = await query(`SELECT * FROM gocart_seller_status_update($1, $2)`, [id, status]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const s = result.rows[0];
    res.json({
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
    res.status(500).json({ error: 'Failed to update seller status' });
  }
});

export default router;
