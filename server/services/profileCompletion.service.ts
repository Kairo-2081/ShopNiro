import { UserRole } from '../../src/types.ts';
import { getProfileCompletion, ProfileCompletion } from '../../src/lib/profileCompletion.ts';
import { query } from '../db/index.ts';

export async function getUserProfileCompletion(role: UserRole, userId: string): Promise<ProfileCompletion> {
  if (role === 'admin') return getProfileCompletion(role, {});

  if (role === 'customer') {
    const result = await query(`
      SELECT u.username, u.email, c.name, c.number,
        c.address_house_name, c.address_street, c.address_city, c.address_postal_code,
        c.address_latitude, c.address_longitude
      FROM users u JOIN customers c ON c.id = u.id
      WHERE u.id = $1 AND u.role = 'customer'
    `, [userId]);
    const row = result.rows[0];
    return getProfileCompletion(role, row ? {
      Username: row.username,
      Email: row.email,
      Name: row.name,
      Number: row.number,
      Address: {
        House_Name: row.address_house_name,
        Street: row.address_street,
        City: row.address_city,
        Postal_Code: row.address_postal_code,
        Latitude: row.address_latitude === null ? undefined : Number(row.address_latitude),
        Longitude: row.address_longitude === null ? undefined : Number(row.address_longitude),
      },
    } : null);
  }

  if (role === 'seller') {
    const result = await query(`
      SELECT u.username, u.email, s.name, s.number,
        s.address_house_name, s.address_street, s.address_city,
        s.address_latitude, s.address_longitude, s.payout_method, s.payout_account,
        EXISTS (
          SELECT 1 FROM seller_documents document
          WHERE document.seller_id = s.id AND document.doc_type = 'national_id'
        ) AS has_identity_document
      FROM users u JOIN sellers s ON s.id = u.id
      WHERE u.id = $1 AND u.role = 'seller'
    `, [userId]);
    const row = result.rows[0];
    return getProfileCompletion(role, row ? {
      Username: row.username,
      Email: row.email,
      Name: row.name,
      Number: row.number,
      Address: {
        House_Name: row.address_house_name,
        Street: row.address_street,
        City: row.address_city,
        Latitude: row.address_latitude === null ? undefined : Number(row.address_latitude),
        Longitude: row.address_longitude === null ? undefined : Number(row.address_longitude),
      },
      Payout_Method: row.payout_method,
      Payout_Account: row.payout_account,
      Has_Identity_Document: row.has_identity_document,
    } : null);
  }

  if (role === 'rider') {
    const result = await query(`
      SELECT u.username, u.email, r.name, r.number,
        r.present_address_json, r.permanent_address_json,
        r.experience_json, r.previous_jobs_json, r.education_json
      FROM users u JOIN riders r ON r.id = u.id
      WHERE u.id = $1 AND u.role = 'rider'
    `, [userId]);
    const row = result.rows[0];
    return getProfileCompletion(role, row ? {
      Username: row.username,
      Email: row.email,
      Name: row.name,
      Number: row.number,
      Present_Address: row.present_address_json,
      Permanent_Address: row.permanent_address_json,
      Experience: row.experience_json,
      Previous_Jobs: row.previous_jobs_json,
      Education: row.education_json,
    } : null);
  }

  return { complete: true, missingFields: [] };
}