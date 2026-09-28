import { Router, Response } from 'express';
import { query, mapAddress } from '../db/index.ts';
import { hashPassword, comparePassword, isBcryptHash } from '../db/password.ts';
import { requireAuth, generateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();

/**
 * GET /api/auth/me
 * Retrieves authenticated user identity, role, and profile entity from schema routines
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ authenticated: false, error: 'Not authenticated' });
    }

    const { role, entityId, userId } = req.user;
    const targetId = entityId || userId;
    let entity: any = null;

    if (role === 'customer') {
      const cRes = await query(`SELECT * FROM gocart_customer_get($1)`, [targetId]);
      if (cRes.rows.length > 0) {
        const c = cRes.rows[0];
        entity = {
          Customer_ID: c.id,
          Username: c.username,
          Name: c.name,
          Email: c.email,
          Number: c.number || '',
          Address: mapAddress(c),
        };
      }
    } else if (role === 'seller') {
      const sRes = await query(`SELECT * FROM gocart_seller_get($1)`, [targetId]);
      if (sRes.rows.length > 0) {
        const s = sRes.rows[0];
        entity = {
          Seller_ID: s.id,
          Username: s.username,
          Name: s.name,
          Email: s.email,
          Number: s.number || '',
          Address: mapAddress(s),
          Logo: s.logo || '',
          Description: s.description || '',
          Status: s.status || 'approved',
          Created_At: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
        };
      }
    } else if (role === 'admin') {
      const aRes = await query(`SELECT * FROM gocart_admin_get($1)`, [targetId]);
      if (aRes.rows.length > 0) {
        const a = aRes.rows[0];
        entity = {
          Admin_ID: a.id,
          Username: a.username,
          Name: a.name,
          Email: a.email,
          Number: a.number || '',
          Address: mapAddress(a),
        };
      }
    }

    res.json({
      authenticated: true,
      user: req.user,
      role: req.user.role,
      entity,
    });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * POST /api/auth/login
 * User login with bcrypt verification and JWT issuance using schema routines
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || !email.trim() || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username/Email and Password are required' });
    }

    const cleanInput = email.trim();
    const userRes = await query(`SELECT * FROM gocart_auth_user_lookup($1, $2)`, [cleanInput, cleanInput]);

    if (userRes.rows.length > 0) {
      const userMatch: any = userRes.rows[0];
      const isMatch = await comparePassword(password, userMatch.password);

      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect password for this account. Please try again.' });
      }

      // Upgrade plain text password if needed via gocart_auth_password_update
      if (userMatch.password && !isBcryptHash(userMatch.password)) {
        const newHash = await hashPassword(password);
        await query(`SELECT gocart_auth_password_update('user', $1, $2)`, [userMatch.id, newHash]);
      }

      const userRole = userMatch.role;
      const entityId = userMatch.id;

      if (userRole === 'seller') {
        const sellerRes = await query(`SELECT * FROM gocart_seller_get($1)`, [entityId]);
        const s = sellerRes.rows[0] || {};
        const token = generateToken({
          userId: userMatch.id,
          email: s.email || userMatch.email,
          username: s.username || userMatch.username,
          role: 'seller',
          entityId,
        });
        return res.json({
          success: true,
          token,
          role: 'seller',
          entity: {
            Seller_ID: s.id || entityId,
            Username: s.username || userMatch.username,
            Name: s.name || userMatch.username,
            Email: s.email || userMatch.email,
            Number: s.number || '',
            Address: mapAddress(s),
            Logo: s.logo || '',
            Description: s.description || '',
            Status: s.status || 'approved',
            Created_At: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
          },
        });
      } else if (userRole === 'admin') {
        const adminRes = await query(`SELECT * FROM gocart_admin_get($1)`, [entityId]);
        const a = adminRes.rows[0] || {};
        const token = generateToken({
          userId: userMatch.id,
          email: a.email || userMatch.email,
          username: a.username || userMatch.username,
          role: 'admin',
          entityId,
        });
        return res.json({
          success: true,
          token,
          role: 'admin',
          entity: {
            Admin_ID: a.id || entityId,
            Username: a.username || userMatch.username,
            Name: a.name || userMatch.username,
            Email: a.email || userMatch.email,
            Number: a.number || '',
            Address: mapAddress(a),
          },
        });
      } else {
        // Customer
        const custRes = await query(`SELECT * FROM gocart_customer_get($1)`, [entityId]);
        const c = custRes.rows[0] || {};
        const token = generateToken({
          userId: userMatch.id,
          email: c.email || userMatch.email,
          username: c.username || userMatch.username,
          role: 'customer',
          entityId,
        });
        return res.json({
          success: true,
          token,
          role: 'customer',
          entity: {
            Customer_ID: c.id || entityId,
            Username: c.username || userMatch.username,
            Name: c.name || userMatch.username,
            Email: c.email || userMatch.email,
            Number: c.number || '',
            Address: mapAddress(c),
          },
        });
      }
    }

    return res.status(401).json({ error: 'No account found with this username or email.' });
  } catch (error: any) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Authentication failed due to server error' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.jti) {
      await query(`SELECT gocart_session_revoke($1)`, [req.user.jti]);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.json({ success: true, message: 'Logged out' });
  }
});

export default router;
