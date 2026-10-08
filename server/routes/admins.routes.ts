import { Router } from 'express';
import { query, mapAddress } from '../db/index.ts';
import { hashPassword } from '../db/password.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { Admin } from '../../src/types.ts';

const router = Router();

// Protect all admin endpoints with authentication and admin role validation
router.use(requireAuth);
router.use(requireRole(['admin']));

/**
 * GET /api/admins
 * Returns all admins (via schema gocart_admins_list)
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM gocart_admins_list()`);
    const formatted: Admin[] = result.rows.map((a: any) => ({
      Admin_ID: a.id,
      Username: a.username || '',
      Name: a.name,
      Email: a.email || '',
      Number: a.number || '',
      Address: mapAddress(a),
    }));
    return res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

/**
 * POST /api/admins
 * Creates a new admin (via schema gocart_admin_create)
 */
router.post('/', async (req, res) => {
  try {
    const { Name, Email, Password, Number: phoneNum, Address, Username } = req.body;
    const phone = typeof phoneNum === 'string' ? phoneNum.trim() : '';
    if (!phone) {
      return res.status(400).json({ error: 'A phone number is required' });
    }
    if (!Address?.Street?.trim() || !Address?.City?.trim()) {
      return res.status(400).json({ error: 'Select a location and provide a street and city' });
    }
    const email = Email || (Username ? `${Username}@shopniro.com` : 'admin@shopniro.com');
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists with this email
    const existing = await query(`SELECT * FROM gocart_auth_user_lookup($1, '')`, [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please log in instead.' });
    }

    const id = `ADM-${Date.now()}`;
    if (typeof Password !== 'string' || Password.trim().length < 12) {
      return res.status(400).json({ error: 'Admin password must be at least 12 characters.' });
    }
    const hashedPassword = await hashPassword(Password);
    const name = Name || Username || 'Admin User';
    const username = Username || cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const addr = Address || {};
    const houseName = addr.House_Name || '';
    const street = addr.Street.trim();
    const city = addr.City.trim();
    const postalCode = addr.Postal_Code || '';
    const addInfo = addr.Additional_Info || 'ShopNiro Operations Center';

    const result = await query(
      `SELECT * FROM gocart_admin_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, username, name, cleanEmail, hashedPassword, phone, houseName, street, city, postalCode, addInfo]
    );

    const a = result.rows[0];
    res.status(201).json({
      Admin_ID: id,
      Username: username,
      Name: name,
      Email: cleanEmail,
      Number: phone,
      Address: {
        House_Name: houseName,
        Street: street,
        City: city,
        Postal_Code: postalCode,
        Additional_Info: addInfo,
      },
    });
  } catch (error: any) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: error.message || 'Failed to create admin' });
  }
});

/**
 * GET /api/admins/users
 * Returns list of platform accounts (via schema gocart_admins_users_list)
 */
router.get('/users', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM gocart_admins_users_list()`);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch platform users' });
  }
});

export default router;
