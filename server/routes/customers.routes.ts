import { Router } from 'express';
import { query, mapAddress } from '../db/index.ts';

function getAddressCoordinates(address: any) {
  const latitude = address?.Latitude;
  const longitude = address?.Longitude;
  const hasValidCoordinates = typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

  return hasValidCoordinates
    ? { latitude, longitude }
    : { latitude: null, longitude: null };
}
import { hashPassword } from '../db/password.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { Customer } from '../../src/types.ts';
import { sendWelcomeOfferEmail } from '../services/email.service.ts';

const router = Router();

/**
 * GET /api/customers
 * Returns all customers (via schema gocart_customers_list)
 */
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await query(`SELECT * FROM gocart_customers_list()`);
    const formatted: Customer[] = result.rows.map((c: any) => ({
      Customer_ID: c.id,
      Username: c.username || '',
      Name: c.name,
      Email: c.email || '',
      Number: c.number || '',
      Address: mapAddress(c),
    }));
    return res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/**
 * POST /api/customers
 * Register a new customer (via schema gocart_customer_create)
 */
router.post('/', async (req, res) => {
  try {
    const { Name, Email, Password, Number: phoneNum, Address, Username, Marketing_Consent } = req.body;
    const phone = typeof phoneNum === 'string' ? phoneNum.trim() : '';
    if (!phone) {
      return res.status(400).json({ error: 'A phone number is required' });
    }
    if (!Address?.Street?.trim() || !Address?.City?.trim()) {
      return res.status(400).json({ error: 'Select a location and provide a street and city' });
    }
    const email = Email || (Username ? `${Username}@gmail.com` : 'customer@gmail.com');
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists with this email
    const existing = await query(`SELECT * FROM gocart_auth_user_lookup($1, '')`, [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please log in instead.' });
    }

    const id = `CUST-${Date.now()}`;
    const rawPassword = Password || 'password123';
    const hashedPassword = await hashPassword(rawPassword);
    const name = Name || Username || 'Customer User';
    const username = Username || cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const addr = Address || {};
    const houseName = addr.House_Name || '';
    const street = addr.Street.trim();
    const city = addr.City.trim();
    const postalCode = addr.Postal_Code || '';
    const addInfo = addr.Additional_Info || '';
    const { latitude, longitude } = getAddressCoordinates(addr);

    const result = await query(
      `SELECT * FROM gocart_customer_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, username, name, cleanEmail, hashedPassword, phone, houseName, street, city, postalCode, addInfo, latitude, longitude]
    );

    const marketingConsent = Marketing_Consent === true;
    let welcomeOfferSent = false;
    if (marketingConsent) {
      await query('UPDATE customers SET marketing_consent_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      try {
        welcomeOfferSent = await sendWelcomeOfferEmail({ name, email: cleanEmail });
        if (welcomeOfferSent) {
          await query('UPDATE customers SET welcome_offer_email_sent_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
        }
      } catch (emailError) {
        console.error('Could not send welcome offer email:', emailError);
      }
    }

    const c = result.rows[0];
    const newCustomer: Customer = {
      Customer_ID: id,
      Username: username,
      Name: name,
      Email: cleanEmail,
      Number: phone,
      Address: mapAddress(c),
      Marketing_Consent: marketingConsent,
    };

    res.status(201).json(newCustomer);
  } catch (error: any) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: error.message || 'Failed to create customer' });
  }
});

/**
 * PUT /api/customers/:id
 * Updates customer details (via schema gocart_customer_update)
 */
router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { Name, Email, Number: phoneNum, Address } = req.body;

    const addr = Address || {};
    const { latitude, longitude } = getAddressCoordinates(addr);
    const result = await query(
      `SELECT * FROM gocart_customer_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        Name || null,
        Email ? Email.trim().toLowerCase() : null,
        phoneNum || null,
        addr.House_Name || null,
        addr.Street || null,
        addr.City || null,
        addr.Postal_Code || null,
        addr.Additional_Info || null,
        latitude,
        longitude,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const c = result.rows[0];

    const nextAddress = {
      House_Name: addr.House_Name || c.address_house_name || '',
      Street: addr.Street || c.address_street || '',
      City: addr.City || c.address_city || '',
      Postal_Code: addr.Postal_Code || c.address_postal_code || '',
      Additional_Info: addr.Additional_Info || c.address_additional_info || '',
      Latitude: latitude ?? c.address_latitude ?? undefined,
      Longitude: longitude ?? c.address_longitude ?? undefined,
    };

    await query(
      `UPDATE orders
       SET shipping_address_json = $2,
           billing_address_json = CASE
             WHEN billing_address_json IS NULL OR billing_address_json = '{}'::text OR billing_address_json = shipping_address_json THEN $2
             ELSE billing_address_json
           END
       WHERE customer_id = $1
         AND status IN ('placed', 'processing')`,
      [id, JSON.stringify(nextAddress)]
    );

    const updated: Customer = {
      Customer_ID: c.id,
      Username: c.username || '',
      Name: c.name,
      Email: c.email || '',
      Number: c.number || '',
      Address: mapAddress(c),
    };

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

export default router;
