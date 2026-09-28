import { Router } from 'express';
import { query, mapAddress } from '../db/index.ts';
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
    const phone = phoneNum || '';
    const username = Username || cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const addr = Address || {};
    const houseName = addr.House_Name || '';
    const street = addr.Street || '';
    const city = addr.City || '';
    const postalCode = addr.Postal_Code || '';
    const addInfo = addr.Additional_Info || '';

    const result = await query(
      `SELECT * FROM gocart_seller_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, username, Name, cleanEmail, hashedPassword, phone, logoUrl, desc, houseName, street, city, postalCode, addInfo]
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
