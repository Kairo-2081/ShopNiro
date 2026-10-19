import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes, randomUUID } from 'node:crypto';
import { pool, query, mapAddress } from '../db/index.ts';
import { hashPassword, comparePassword, needsPasswordRehash } from '../db/password.ts';
import { getUserProfileCompletion } from '../services/profileCompletion.service.ts';
import {
  requireAuth,
  issueAuthCookie,
  issueOAuthRegistrationCookie,
  clearOAuthRegistrationCookie,
  readOAuthRegistrationCookie,
  clearAuthCookie,
  optionalAuth,
  AUTH_COOKIE_NAME,
  AuthRequest,
} from '../middleware/auth.ts';

const router = Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
});
const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const loginFailures = new Map<string, { count: number; windowStartedAt: number; lockedUntil: number }>();
const loginFailureWindowMs = 15 * 60 * 1000;
const maxLoginFailures = 5;
const invalidCredentialsMessage = 'Invalid username/email or password.';
type OAuthProvider = 'google' | 'facebook';

const oauthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

function isOAuthProvider(value: string): value is OAuthProvider {
  return value === 'google' || value === 'facebook';
}

function oauthConfig(provider: OAuthProvider, req: { protocol: string; get: (name: string) => string | undefined }) {
  const prefix = provider === 'google' ? 'GOOGLE' : 'FACEBOOK';
  const appOrigin = process.env.APP_URL || (process.env.NODE_ENV === 'production'
    ? 'https://shopniro.onrender.com'
    : `${req.protocol}://${req.get('host')}`);
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`],
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
    redirectUri: process.env[`${prefix}_OAUTH_REDIRECT_URI`] || new URL(`/api/auth/oauth/${provider}/callback`, appOrigin).toString(),
  };
}

function oauthReturnUrl(
  req: { protocol: string; get: (name: string) => string | undefined },
  error?: string,
  signupRole?: 'seller' | 'rider',
): string {
  const configuredOrigin = process.env.SHOPNIRO_PUBLIC_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || process.env.APP_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://shopniro.onrender.com' : undefined);
  const origin = configuredOrigin
    ? (configuredOrigin.includes('://') ? configuredOrigin : `https://${configuredOrigin}`)
    : `${req.protocol}://${req.get('host')}`;
  const target = new URL('/', origin);
  if (error) target.searchParams.set('oauth_error', error);
  if (signupRole) target.searchParams.set('oauth_signup', signupRole);
  return target.toString();
}

function oauthStateCookieName(provider: OAuthProvider): string {
  return `shopniro_oauth_state_${provider}`;
}

function getCookie(req: { headers: { cookie?: string } }, name: string): string | null {
  const value = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(name.length + 1));
  } catch {
    return null;
  }
}

function clearOAuthStateCookie(provider: OAuthProvider, res: Response): void {
  const secureAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${oauthStateCookieName(provider)}=; Max-Age=0; Path=/api/auth/oauth/${provider}; HttpOnly; SameSite=Lax${secureAttribute}`);
}

interface OAuthProfile {
  providerUserId: string;
  email: string;
  name: string;
}

async function fetchOAuthProfile(provider: OAuthProvider, code: string, req: { protocol: string; get: (name: string) => string | undefined }): Promise<OAuthProfile> {
  const config = oauthConfig(provider, req);
  if (!config.clientId || !config.clientSecret) throw new Error('provider_unconfigured');

  const tokenUrl = provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : 'https://graph.facebook.com/v24.0/oauth/access_token';
  const tokenBody = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) throw new Error('provider_rejected');
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) throw new Error('provider_rejected');

  if (provider === 'google') {
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileResponse.ok) throw new Error('provider_rejected');
    const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string };
    if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error('email_unverified');
    return { providerUserId: profile.sub, email: profile.email, name: profile.name || profile.email.split('@')[0] };
  }

  const graphBase = 'https://graph.facebook.com/v24.0';
  const debugUrl = new URL(`${graphBase}/debug_token`);
  debugUrl.searchParams.set('input_token', tokenData.access_token);
  debugUrl.searchParams.set('access_token', `${config.clientId}|${config.clientSecret}`);
  const debugResponse = await fetch(debugUrl, { signal: AbortSignal.timeout(10_000) });
  if (!debugResponse.ok) throw new Error('provider_rejected');
  const debugResult = await debugResponse.json() as { data?: { app_id?: string; is_valid?: boolean } };
  if (debugResult.data?.app_id !== config.clientId || debugResult.data?.is_valid !== true) throw new Error('provider_rejected');

  const profileUrl = new URL(`${graphBase}/me`);
  profileUrl.searchParams.set('fields', 'id,name,email');
  profileUrl.searchParams.set('access_token', tokenData.access_token);
  const profileResponse = await fetch(profileUrl, { signal: AbortSignal.timeout(10_000) });
  if (!profileResponse.ok) throw new Error('provider_rejected');
  const profile = await profileResponse.json() as { id?: string; email?: string; name?: string };
  if (!profile.id || !profile.email) throw new Error('email_missing');
  return { providerUserId: profile.id, email: profile.email, name: profile.name || profile.email.split('@')[0] };
}

async function findOrCreateOAuthAccount(provider: OAuthProvider, profile: OAuthProfile, requestedRole: 'customer' | 'seller' | 'rider') {
  const client = await pool.connect();
  const email = profile.email.trim().toLowerCase();
  try {
    await client.query('BEGIN');
    const lockKeys = [`oauth-email:${email}`, `oauth-subject:${provider}:${profile.providerUserId}`].sort();
    for (const key of lockKeys) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    }

    let user = (await client.query(
      `SELECT u.id, u.username, u.email, u.role
       FROM oauth_identities oi JOIN users u ON u.id = oi.user_id
       WHERE oi.provider = $1 AND oi.provider_user_id = $2 FOR UPDATE OF u`,
      [provider, profile.providerUserId],
    )).rows[0];

    if (!user) {
      user = (await client.query(
        'SELECT id, username, email, role FROM users WHERE LOWER(email) = $1 FOR UPDATE',
        [email],
      )).rows[0];

      if (user && (user.role === 'admin' || (requestedRole !== 'customer' && user.role !== requestedRole))) throw new Error('account_conflict');

      if (!user) {
        const userId = randomUUID();
        const usernameBase = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 70) || 'customer';
        const username = `${usernameBase}_${randomBytes(4).toString('hex')}`;
        const randomPassword = await hashPassword(randomBytes(48).toString('base64url'));
        if (requestedRole === 'customer') {
          const created = await client.query(
            'SELECT * FROM gocart_customer_create($1, $2, $3, $4, $5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)',
            [userId, username, profile.name, email, randomPassword],
          );
          if (!created.rowCount) throw new Error('oauth_failed');
        } else if (requestedRole === 'seller') {
          const created = await client.query(
            `SELECT * FROM gocart_seller_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [userId, username, profile.name, email, randomPassword, '', '', '', '', '', '', '', '', null, null],
          );
          if (!created.rowCount) throw new Error('oauth_failed');
        } else {
          await client.query(
            'INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, $5)',
            [userId, username, randomPassword, email, 'rider'],
          );
          await client.query(
            "INSERT INTO riders (id, name, number, status) VALUES ($1, $2, '', 'pending')",
            [userId, profile.name],
          );
        }
        user = { id: userId, username, email, role: requestedRole };
      }

      if (user.role === 'customer' && !(await client.query('SELECT 1 FROM customers WHERE id = $1', [user.id])).rowCount) {
        throw new Error('account_conflict');
      }
      if (user.role === 'seller' && !(await client.query('SELECT 1 FROM sellers WHERE id = $1', [user.id])).rowCount) {
        throw new Error('account_conflict');
      }
      if (user.role === 'rider' && !(await client.query('SELECT 1 FROM riders WHERE id = $1', [user.id])).rowCount) {
        throw new Error('account_conflict');
      }

      await client.query(
        'INSERT INTO oauth_identities (provider, provider_user_id, user_id) VALUES ($1, $2, $3)',
        [provider, profile.providerUserId, user.id],
      );
    }

    if (!['customer', 'seller', 'rider'].includes(user.role)) throw new Error('account_conflict');
    if (requestedRole !== 'customer' && user.role !== requestedRole) throw new Error('account_conflict');
    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const isLoginLocked = (identifier: string, now: number) => {
  const state = loginFailures.get(identifier);
  if (!state) return false;
  if (state.lockedUntil > now) return true;
  if (now - state.windowStartedAt >= loginFailureWindowMs || state.lockedUntil > 0) {
    loginFailures.delete(identifier);
  }
  return false;
};

const recordLoginFailure = (identifier: string, now: number) => {
  for (const [key, state] of loginFailures) {
    if (now - state.windowStartedAt >= loginFailureWindowMs && state.lockedUntil <= now) loginFailures.delete(key);
  }
  let state = loginFailures.get(identifier);
  if (!state || now - state.windowStartedAt >= loginFailureWindowMs) {
    state = { count: 0, windowStartedAt: now, lockedUntil: 0 };
  }
  state.count += 1;
  if (state.count >= maxLoginFailures) state.lockedUntil = now + loginFailureWindowMs;
  loginFailures.set(identifier, state);
};

router.get('/oauth/registration', (req, res) => {
  const registration = readOAuthRegistrationCookie(req);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ registration });
});

router.post('/signup', signupRateLimit, async (req, res) => {
  try {
  const role = req.body?.role;
  const inputUsername = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const inputEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!['customer', 'seller', 'rider'].includes(role)) {
    return res.status(400).json({ error: 'Choose a customer, seller, or rider account.' });
  }
  if (!inputUsername && !inputEmail) {
    return res.status(400).json({ error: 'Enter a username or email address.' });
  }
  if (inputEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail) || inputEmail.endsWith('.invalid'))) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (inputUsername && !/^[a-z0-9_]{3,50}$/.test(inputUsername)) {
    return res.status(400).json({ error: 'Username must be 3 to 50 letters, numbers, or underscores.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const accountRole = role as 'customer' | 'seller' | 'rider';
  const username = inputUsername || `${inputEmail.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 42) || accountRole}_${randomBytes(3).toString('hex')}`;
  const email = inputEmail || `${username}@pending.shopniro.invalid`;
  const idPrefix = accountRole === 'customer' ? 'CUST' : accountRole === 'seller' ? 'SEL' : 'RDR';
  const userId = `${idPrefix}-${randomUUID()}`;
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const duplicate = await client.query(
      'SELECT 1 FROM users WHERE lower(username) = $1 OR lower(email) = $2 LIMIT 1',
      [username, email],
    );
    if (duplicate.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That username or email is already registered.' });
    }

    if (accountRole === 'customer') {
      await client.query(
        'SELECT * FROM gocart_customer_create($1, $2, $3, $4, $5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)',
        [userId, username, '', email, passwordHash],
      );
    } else if (accountRole === 'seller') {
      await client.query(
        'SELECT * FROM gocart_seller_create($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
        [userId, username, '', email, passwordHash, '', '', '', '', '', '', '', '', null, null],
      );
    } else {
      await client.query(
        'INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, $5)',
        [userId, username, passwordHash, email, 'rider'],
      );
      await client.query("INSERT INTO riders (id, name, number, status) VALUES ($1, '', '', 'pending')", [userId]);
    }
    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    if (error?.code === '23505') return res.status(409).json({ error: 'That username or email is already registered.' });
    throw error;
  } finally {
    client.release();
  }

  await issueAuthCookie(res, { userId, email, username, role: accountRole, entityId: userId });
  const blankAddress = { House_Name: '', Street: '', City: '', Postal_Code: '', Additional_Info: '' };
  const entity = accountRole === 'customer'
    ? { Customer_ID: userId, Username: username, Name: '', Email: email, Number: '', Address: blankAddress }
    : accountRole === 'seller'
      ? { Seller_ID: userId, Username: username, Name: '', Email: email, Number: '', Address: blankAddress, Logo: '', Description: '', Status: 'pending' }
      : {
          Rider_ID: userId,
          Username: username,
          Name: '',
          Email: email,
          Number: '',
          Present_Address: blankAddress,
          Permanent_Address: blankAddress,
          Experience: [],
          Previous_Jobs: [],
          Education: [],
          Status: 'pending',
          Has_CV: false,
        };
  return res.status(201).json({ success: true, role: accountRole, entity, profileComplete: false });
  } catch (error) {
    req.log.error({ err: error }, 'Account signup failed:');
    return res.status(500).json({ error: 'Could not create your account.' });
  }
});

router.get('/oauth/:provider', oauthRateLimit, (req, res) => {
  const provider = req.params.provider;
  if (!isOAuthProvider(provider)) return res.redirect(302, oauthReturnUrl(req, 'oauth_failed'));

  const config = oauthConfig(provider, req);
  if (!config.clientId || !config.clientSecret) return res.redirect(302, oauthReturnUrl(req, 'provider_unconfigured'));

  const requestedRole = ['customer', 'seller', 'rider'].includes(String(req.query.role))
    ? String(req.query.role)
    : 'customer';

  const state = randomBytes(32).toString('base64url');
  const secureAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${oauthStateCookieName(provider)}=${encodeURIComponent(`${state}.${requestedRole}`)}; Max-Age=600; Path=/api/auth/oauth/${provider}; HttpOnly; SameSite=Lax${secureAttribute}`);

  const authorizationUrl = provider === 'google'
    ? new URL('https://accounts.google.com/o/oauth2/v2/auth')
    : new URL('https://www.facebook.com/v24.0/dialog/oauth');
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('scope', provider === 'google' ? 'openid email profile' : 'email,public_profile');
  if (provider === 'google') authorizationUrl.searchParams.set('prompt', 'select_account');
  res.redirect(302, authorizationUrl.toString());
});

router.get('/oauth/:provider/callback', oauthRateLimit, async (req, res) => {
  const provider = req.params.provider;
  if (!isOAuthProvider(provider)) return res.redirect(302, oauthReturnUrl(req, 'oauth_failed'));
  clearOAuthStateCookie(provider, res);

  const receivedState = typeof req.query.state === 'string' ? req.query.state : '';
  const savedState = getCookie(req, oauthStateCookieName(provider));
  const [expectedState, requestedRole] = savedState?.split('.') || [];
  if (
    !receivedState || !expectedState || receivedState !== expectedState ||
    !['customer', 'seller', 'rider'].includes(requestedRole)
  ) {
    return res.redirect(302, oauthReturnUrl(req, 'oauth_failed'));
  }
  if (req.query.error || typeof req.query.code !== 'string') {
    return res.redirect(302, oauthReturnUrl(req, 'oauth_cancelled'));
  }

  try {
    const profile = await fetchOAuthProfile(provider, req.query.code, req);
    const user = await findOrCreateOAuthAccount(provider, profile, requestedRole as 'customer' | 'seller' | 'rider');
    if (!user) {
      issueOAuthRegistrationCookie(res, {
        role: requestedRole as 'seller' | 'rider',
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email.trim().toLowerCase(),
        name: profile.name,
      });
      return res.redirect(302, oauthReturnUrl(req, undefined, requestedRole as 'seller' | 'rider'));
    }
    if (user.role === 'rider') {
      const rider = await query('SELECT status FROM riders WHERE id = $1', [user.id]);
      if (!rider.rows.length || ['rejected', 'suspended'].includes(rider.rows[0].status)) {
        return res.redirect(302, oauthReturnUrl(req, 'account_conflict'));
      }
    }
    await issueAuthCookie(res, { userId: user.id, email: user.email, username: user.username, role: user.role, entityId: user.id });
    return res.redirect(302, oauthReturnUrl(req));
  } catch (error) {
    const errorCode = error instanceof Error && [
      'provider_unconfigured', 'provider_rejected', 'email_unverified', 'email_missing', 'account_conflict',
    ].includes(error.message) ? error.message : 'oauth_failed';
    if (errorCode === 'oauth_failed') console.error('OAuth sign-in failed:', error);
    return res.redirect(302, oauthReturnUrl(req, errorCode));
  }
});

/**
 * GET /api/auth/me
 * Optionally retrieves the current user without blocking guest storefront requests.
 */
router.get('/me', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const hasSessionCookie = req.headers.cookie?.includes(`${AUTH_COOKIE_NAME}=`) || false;
    if (!req.user) {
      return hasSessionCookie
        ? res.status(401).json({ error: 'Session is expired or revoked. Please sign in again.' })
        : res.json({ authenticated: false, user: null, role: null, entity: null });
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
          Payout_Method: s.payout_method || '',
          Payout_Account: s.payout_account || '',
          Payout_Verified: Boolean(s.payout_verified),
          Created_At: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
        };
      }
    } else if (role === 'rider') {
      const rRes = await query(`
        SELECT r.*, u.username, u.email,
          COALESCE((SELECT AVG(rr.rating) FROM rider_reviews rr WHERE rr.rider_id = r.id), 0) AS average_rating,
          COALESCE((SELECT ms.performance_points FROM rider_monthly_scores ms WHERE ms.rider_id = r.id
            AND ms.month_start = date_trunc('month', CURRENT_DATE)::date), 100) AS current_month_performance_points
        FROM riders r JOIN users u ON u.id = r.id WHERE r.id = $1
      `, [targetId]);
      if (rRes.rows.length > 0) {
        const r = rRes.rows[0];
        entity = {
          Rider_ID: r.id,
          Username: r.username,
          Name: r.name,
          Email: r.email,
          Number: r.number || '',
          Present_Address: r.present_address_json || {},
          Permanent_Address: r.permanent_address_json || {},
          Experience: r.experience_json || [],
          Previous_Jobs: r.previous_jobs_json || [],
          Education: r.education_json || [],
          Status: r.status,
          Has_CV: Boolean(r.has_cv),
          Current_Latitude: r.current_latitude === null ? undefined : Number(r.current_latitude),
          Current_Longitude: r.current_longitude === null ? undefined : Number(r.current_longitude),
          Total_Deliveries: Number(r.total_deliveries) || 0,
          Timely_Deliveries: Number(r.timely_deliveries) || 0,
          Late_Deliveries: Number(r.late_deliveries) || 0,
          Performance_Points: Number(r.current_month_performance_points) || 0,
          Average_Rating: Number(r.average_rating) || 0,
          Wallet_Balance: Number(r.wallet_balance) || 0,
          Created_At: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
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

    const completion = await getUserProfileCompletion(role, req.user.entityId);
    res.json({
      authenticated: true,
      user: req.user,
      role: req.user.role,
      entity,
      profileComplete: completion.complete,
      profileMissingFields: completion.missingFields,
    });
  } catch (error: any) {
    req.log.error({ err: error }, 'Error fetching current user:');
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * POST /api/auth/login
 * User login with bcrypt verification and JWT issuance using schema routines
 */
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || !email.trim() || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username/Email and Password are required' });
    }

    const cleanInput = email.trim();
    const normalizedIdentifier = cleanInput.toLowerCase();
    if (isLoginLocked(normalizedIdentifier, Date.now())) {
      return res.status(401).json({ error: invalidCredentialsMessage });
    }
    const userRes = await query(`SELECT * FROM gocart_auth_user_lookup($1, $2)`, [cleanInput, cleanInput]);

    if (userRes.rows.length > 0) {
      const userMatch: any = userRes.rows[0];
      const isMatch = await comparePassword(password, userMatch.password);

      if (!isMatch) {
        recordLoginFailure(normalizedIdentifier, Date.now());
        return res.status(401).json({ error: invalidCredentialsMessage });
      }

      loginFailures.delete(normalizedIdentifier);
      if (needsPasswordRehash(userMatch.password)) {
        const newHash = await hashPassword(password);
        await query(`SELECT gocart_auth_password_update('user', $1, $2)`, [userMatch.id, newHash]);
      }

      const userRole = userMatch.role;
      const entityId = userMatch.id;

      if (userRole === 'seller') {
        const sellerRes = await query(`SELECT * FROM gocart_seller_get($1)`, [entityId]);
        const s = sellerRes.rows[0] || {};
        await issueAuthCookie(res, {
          userId: userMatch.id,
          email: s.email || userMatch.email,
          username: s.username || userMatch.username,
          role: 'seller',
          entityId,
        });
        return res.json({
          success: true,
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
            Payout_Method: s.payout_method || '',
            Payout_Account: s.payout_account || '',
            Payout_Verified: Boolean(s.payout_verified),
            Created_At: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
          },
        });
      } else if (userRole === 'rider') {
        const riderRes = await query(`
          SELECT r.*, u.username, u.email,
            COALESCE((SELECT AVG(rr.rating) FROM rider_reviews rr WHERE rr.rider_id = r.id), 0) AS average_rating,
            COALESCE((SELECT ms.performance_points FROM rider_monthly_scores ms WHERE ms.rider_id = r.id
              AND ms.month_start = date_trunc('month', CURRENT_DATE)::date), 100) AS current_month_performance_points
          FROM riders r JOIN users u ON u.id = r.id WHERE r.id = $1
        `, [entityId]);
        const rider = riderRes.rows[0];
        if (!rider) return res.status(404).json({ error: 'Rider profile not found.' });
        if (rider.status === 'rejected' || rider.status === 'suspended') {
          return res.status(403).json({ error: `Rider account is ${rider.status}. Contact marketplace support.` });
        }
        const entity = {
          Rider_ID: rider.id,
          Username: rider.username || userMatch.username,
          Name: rider.name,
          Email: rider.email || userMatch.email,
          Number: rider.number || '',
          Present_Address: rider.present_address_json || {},
          Permanent_Address: rider.permanent_address_json || {},
          Experience: rider.experience_json || [],
          Previous_Jobs: rider.previous_jobs_json || [],
          Education: rider.education_json || [],
          Status: rider.status,
          Has_CV: Boolean(rider.has_cv),
          Current_Latitude: rider.current_latitude === null ? undefined : Number(rider.current_latitude),
          Current_Longitude: rider.current_longitude === null ? undefined : Number(rider.current_longitude),
          Total_Deliveries: Number(rider.total_deliveries) || 0,
          Timely_Deliveries: Number(rider.timely_deliveries) || 0,
          Late_Deliveries: Number(rider.late_deliveries) || 0,
          Performance_Points: Number(rider.current_month_performance_points),
          Average_Rating: Number(rider.average_rating) || 0,
          Wallet_Balance: Number(rider.wallet_balance) || 0,
          Created_At: rider.created_at ? new Date(rider.created_at).toISOString() : new Date().toISOString(),
        };
        await issueAuthCookie(res, {
          userId: userMatch.id,
          email: entity.Email,
          username: entity.Username,
          role: 'rider',
          entityId,
        });
        return res.json({ success: true, role: 'rider', entity });
      } else if (userRole === 'admin') {
        const adminRes = await query(`SELECT * FROM gocart_admin_get($1)`, [entityId]);
        const a = adminRes.rows[0] || {};
        await issueAuthCookie(res, {
          userId: userMatch.id,
          email: a.email || userMatch.email,
          username: a.username || userMatch.username,
          role: 'admin',
          entityId,
        });
        return res.json({
          success: true,
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
        await issueAuthCookie(res, {
          userId: userMatch.id,
          email: c.email || userMatch.email,
          username: c.username || userMatch.username,
          role: 'customer',
          entityId,
        });
        return res.json({
          success: true,
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

    recordLoginFailure(normalizedIdentifier, Date.now());
    return res.status(401).json({ error: invalidCredentialsMessage });
  } catch (error: any) {
    req.log.error({ err: error }, 'Error during login:');
    res.status(500).json({ error: 'Authentication failed due to server error' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.jti) {
      await query(`SELECT gocart_session_revoke($1)`, [req.user.jti]);
    }
    clearAuthCookie(res);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    clearAuthCookie(res);
    return res.status(500).json({ error: 'Could not close the session.' });
  }
});

export default router;
