import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, query, mapAddress } from '../db/index.ts';
import { validateBody, validateParams } from '../middleware/validate.ts';
import { customerDeletionBody, customerRegisterBody, customerUpdateBody, resourceIdParam } from '../validation/schemas.ts';

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
import { clearAuthCookie, requireAuth, AuthRequest } from '../middleware/auth.ts';
import { Customer } from '../../src/types.ts';
import { sendWelcomeOfferEmail } from '../services/email.service.ts';
import { publicMessage } from '../middleware/errorHandler.ts';
import { newId } from '../lib/ids.ts';
import { recordCustomerPolicyConsent } from '../lib/policyConsent.ts';
import { orderItemsForOrderSql } from '../lib/orderItems.ts';

const router = Router();
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many account creation attempts. Try again later.' },
});

/**
 * GET /api/customers
 * Returns all customers (via schema shopniro_customers_list)
 */
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const result = await query(
      `SELECT profile.* FROM customer_profiles profile
       JOIN customers customer ON customer.id = profile.id
       WHERE customer.account_deleted_at IS NULL
       ORDER BY profile.created_at DESC, profile.id DESC LIMIT $1 OFFSET $2`,
      [limit + 1, offset],
    );
    const formatted: Customer[] = result.rows.map((c: any) => ({
      Customer_ID: c.id,
      Username: c.username || '',
      Name: c.name,
      Email: c.email || '',
      Number: c.number || '',
      Address: mapAddress(c),
    }));
    res.setHeader('X-Has-More', String(result.rows.length > limit));
    return res.json(formatted.slice(0, limit));
  } catch (error: any) {
    req.log.error({ err: error }, 'Error fetching customers:');
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/**
 * POST /api/customers
 * Register a new customer (via schema shopniro_customer_create)
 */
router.post('/', registrationRateLimit, validateBody(customerRegisterBody), async (req, res) => {
  try {
    const { Name, Email, Password, Number: phoneNum, Address, Username, Marketing_Consent, acceptedTerms } = req.body;
    if (acceptedTerms !== true) {
      return res.status(400).json({ error: 'Accept the Terms of Service and Privacy Policy to create a customer account.' });
    }
    if (typeof Password !== 'string' || Password.trim().length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
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
    const existing = await query(`SELECT * FROM shopniro_auth_user_lookup($1, '')`, [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please log in instead.' });
    }

    const id = newId('CUST');
    const hashedPassword = await hashPassword(Password);
    const name = Name || Username || 'Customer User';
    const username = Username || cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const addr = Address || {};
    const houseName = addr.House_Name || '';
    const street = addr.Street.trim();
    const city = addr.City.trim();
    const postalCode = addr.Postal_Code || '';
    const addInfo = addr.Additional_Info || '';
    const { latitude, longitude } = getAddressCoordinates(addr);

    const marketingConsent = Marketing_Consent === true;
    const client = await pool.connect();
    let c: Record<string, unknown>;
    try {
      await client.query('BEGIN');
      const duplicate = await client.query(
        'SELECT 1 FROM users WHERE lower(email) = $1 OR lower(username) = $2 LIMIT 1',
        [cleanEmail, username.toLowerCase()],
      );
      if (duplicate.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'An account with this email address already exists. Please log in instead.' });
      }
      const result = await client.query(
        `SELECT * FROM shopniro_customer_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, username, name, cleanEmail, hashedPassword, phone, houseName, street, city, postalCode, addInfo, latitude, longitude],
      );
      if (!result.rows[0]) throw new Error('Customer creation routine returned no profile.');
      c = result.rows[0];
      await recordCustomerPolicyConsent(client, id, 'signup');
      if (marketingConsent) {
        await client.query('UPDATE customers SET marketing_consent_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      }
      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK').catch(() => {});
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'An account with this email address already exists. Please log in instead.' });
      }
      throw error;
    } finally {
      client.release();
    }

    if (marketingConsent) {
      try {
        const welcomeOfferSent = await sendWelcomeOfferEmail({ name, email: cleanEmail });
        if (welcomeOfferSent) {
          await query('UPDATE customers SET welcome_offer_email_sent_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
        }
      } catch (emailError) {
        req.log.error({ err: emailError }, 'Could not send welcome offer email:');
      }
    }

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
    req.log.error({ err: error }, 'Error creating customer:');
    res.status(500).json({ error: publicMessage(error, 'Failed to create customer') });
  }
});

router.get('/me/export', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'customer') return res.status(403).json({ error: 'Customer account required.' });
  try {
    const customerId = req.user!.entityId;
    const profileResult = await query(
      `SELECT u.username, u.email, u.created_at AS account_created_at,
        c.name, c.number, c.address_house_name, c.address_street, c.address_city,
        c.address_postal_code, c.address_additional_info, c.address_latitude,
        c.address_longitude, c.marketing_consent_at, c.welcome_offer_email_sent_at
       FROM users u JOIN customers c ON c.id = u.id
       WHERE c.id = $1 AND c.account_deleted_at IS NULL`,
      [customerId],
    );
    if (!profileResult.rows[0]) return res.status(404).json({ error: 'Customer account not found.' });
    const email = profileResult.rows[0].email;
    const [orders, payments, refunds, cancellationRequests, reviews, cart, wishlist, supportRequests, policyConsents] = await Promise.all([
      query(
        `SELECT o.id, o.tracking_id, ${orderItemsForOrderSql} AS items, o.subtotal, o.shipping_fee,
          o.status, o.payment_status, o.payment_method, o.transaction_id, o.applied_voucher,
          o.shipping_address_json, o.billing_address_json, o.additional_info, o.order_placed_at
         FROM orders o WHERE o.customer_id = $1 ORDER BY o.order_placed_at DESC`,
        [customerId],
      ),
      query(
        `SELECT transaction_id, amount, currency, gateway, payment_method, status, created_at
         FROM payments WHERE customer_id = $1 ORDER BY created_at DESC`,
        [customerId],
      ),
      query(
        `SELECT refund.order_id, refund.amount, refund.method, refund.duplicate_payment,
          refund.status, refund.gateway_ref, refund.created_at, refund.updated_at
         FROM refunds refund JOIN orders o ON o.id = refund.order_id
         WHERE o.customer_id = $1 ORDER BY refund.created_at DESC`,
        [customerId],
      ),
      query(
        `SELECT request.order_id, request.reason, request.status, request.requested_at,
          request.reviewed_at, request.refund_completed_at
         FROM order_cancellation_requests request
         WHERE request.customer_id = $1 ORDER BY request.requested_at DESC`,
        [customerId],
      ),
      query(
        `SELECT product_id, customer_name, review_text, rating, created_at
         FROM reviews WHERE customer_id = $1 ORDER BY created_at DESC`,
        [customerId],
      ),
      query(
        `SELECT product_id, quantity, size FROM cart WHERE customer_id = $1 ORDER BY id`,
        [customerId],
      ),
      query(
        `SELECT product_id, created_at FROM customer_wishlist WHERE customer_id = $1 ORDER BY created_at DESC`,
        [customerId],
      ),
      query(
        `SELECT name, email, subject, message, status, created_at, updated_at, resolved_at
         FROM support_requests WHERE lower(email) = lower($1) ORDER BY created_at DESC`,
        [email],
      ),
      query(
        `SELECT policy_id, policy_version, consent_source, consented_at
         FROM customer_policy_consents WHERE customer_id = $1 ORDER BY consented_at`,
        [customerId],
      ),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="shopniro-data-export.json"');
    return res.json({
      exportedAt: new Date().toISOString(),
      account: profileResult.rows[0],
      orders: orders.rows,
      payments: payments.rows,
      refunds: refunds.rows,
      cancellationRequests: cancellationRequests.rows,
      reviews: reviews.rows,
      cart: cart.rows,
      wishlist: wishlist.rows,
      supportRequests: supportRequests.rows,
      policyConsents: policyConsents.rows,
    });
  } catch (error: any) {
    req.log.error({ err: error }, 'Could not export customer data.');
    return res.status(500).json({ error: 'Could not export customer data.' });
  }
});

router.post('/me/deletion', requireAuth, validateBody(customerDeletionBody), async (req: AuthRequest, res) => {
  if (req.user!.role !== 'customer') return res.status(403).json({ error: 'Customer account required.' });
  const client = await pool.connect();
  try {
    const customerId = req.user!.entityId;
    const randomPassword = await hashPassword(newId('deleted'));
    await client.query('BEGIN');
    const account = await client.query(
      `SELECT u.email FROM users u JOIN customers c ON c.id = u.id
       WHERE c.id = $1 AND c.account_deleted_at IS NULL FOR UPDATE OF u, c`,
      [customerId],
    );
    if (!account.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer account not found.' });
    }
    if (account.rows[0].email.toLowerCase() !== req.body.confirmationEmail.trim().toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Enter the email address on your account to confirm deletion.' });
    }

    const activeOrders = await client.query(
      `SELECT 1 FROM orders WHERE customer_id = $1 AND status NOT IN ('delivered', 'cancelled') LIMIT 1`,
      [customerId],
    );
    if (activeOrders.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Complete or cancel active orders before deleting your account.' });
    }

    const deletedEmail = `deleted+${customerId}@deleted.shopniro.invalid`;
    const deletedUsername = `deleted_${customerId}`;
    await client.query(
      `UPDATE customers SET name = 'Deleted customer', number = NULL,
        address_house_name = NULL, address_street = NULL, address_city = NULL,
        address_postal_code = NULL, address_additional_info = NULL,
        address_latitude = NULL, address_longitude = NULL, marketing_consent_at = NULL,
        welcome_offer_email_sent_at = NULL, account_deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [customerId],
    );
    await client.query(
      'UPDATE users SET username = $2, email = $3, password = $4 WHERE id = $1',
      [customerId, deletedUsername, deletedEmail, randomPassword],
    );
    await client.query('DELETE FROM oauth_identities WHERE user_id = $1', [customerId]);
    await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [customerId]);
    await client.query('DELETE FROM cart WHERE customer_id = $1', [customerId]);
    await client.query('DELETE FROM customer_wishlist WHERE customer_id = $1', [customerId]);
    await client.query('DELETE FROM checkout_idempotency WHERE customer_id = $1', [customerId]);
    await client.query('DELETE FROM reviews WHERE customer_id = $1', [customerId]);
    await client.query(
      `UPDATE support_requests SET name = 'Deleted customer', email = $2,
        subject = '[redacted after account deletion]', message = '[redacted after account deletion]',
        admin_notes = '', updated_at = CURRENT_TIMESTAMP
       WHERE lower(email) = lower($1)`,
      [account.rows[0].email, deletedEmail],
    );
    await client.query(
      `UPDATE orders SET shipping_address_json = $2, billing_address_json = $2, additional_info = ''
       WHERE customer_id = $1`,
      [customerId, JSON.stringify({ House_Name: '', Street: '', City: '', Postal_Code: '', Additional_Info: '' })],
    );
    await client.query(
      `UPDATE order_cancellation_requests SET reason = ''
       WHERE customer_id = $1`,
      [customerId],
    );
    await client.query(
      'UPDATE payments SET customer_phone = NULL WHERE customer_id = $1',
      [customerId],
    );
    await client.query('COMMIT');
    clearAuthCookie(res);
    return res.json({
      success: true,
      message: 'Your account has been deleted. Order and payment records required for fulfilment, accounting, refunds or dispute handling have been retained with profile and address details removed.',
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    req.log.error({ err: error }, 'Could not delete customer account.');
    return res.status(500).json({ error: 'Could not delete customer account.' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/customers/:id
 * Updates customer details (via schema shopniro_customer_update)
 */
router.put('/:id', requireAuth, validateParams(resourceIdParam), validateBody(customerUpdateBody), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (req.user!.role !== 'admin' && req.user!.entityId !== id) {
      return res.status(403).json({ error: 'You can only update your own customer profile.' });
    }
    const { Name, Email, Number: phoneNum, Address } = req.body;

    const addr = Address || {};
    const { latitude, longitude } = getAddressCoordinates(addr);
    const result = await query(
      `SELECT * FROM shopniro_customer_update($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
    req.log.error({ err: error }, 'Error updating customer:');
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

export default router;
