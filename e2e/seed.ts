// Seeds a throwaway database for the browser checkout tests. Refuses to touch anything that is not local.
import pg from 'pg';
import { assertTestDatabase, resolveTarget } from './target.ts';
import bcrypt from 'bcryptjs';

export const E2E = {
  customer: { id: 'E2E-CUST', username: 'e2e-customer', email: 'e2e-customer@example.test', password: 'E2e-password-1!' },
  seller: { id: 'E2E-SELL' },
  // A seller who has applied but is not yet approved, with a complete profile, for the admin approval flow.
  newSeller: { id: 'E2E-SELL-NEW', username: 'e2e-new-seller', email: 'e2e-new-seller@example.test', password: 'E2e-password-1!', name: 'E2E New Store' },
  admin: { id: 'E2E-ADMIN', username: 'e2e-admin', email: 'e2e-admin@example.test', password: 'E2e-password-1!' },
  rider: { id: 'E2E-RIDER', username: 'e2e-rider', email: 'e2e-rider@example.test', password: 'E2e-password-1!', name: 'E2E Rider' },
  products: {
    blanket: { id: 'E2E-P-BLANKET', name: 'E2E Linen Blanket', price: 68 },
    dripper: { id: 'E2E-P-DRIPPER', name: 'E2E Ceramic Dripper', price: 45 },
    lamp: { id: 'E2E-P-LAMP', name: 'E2E Desk Lamp', price: 300 },
    voucher: { id: 'E2E-P-VOUCHER', name: 'E2E Voucher Mug', price: 100, code: 'SAVE20' },
  },
} as const;

export async function seedDatabase(databaseUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: assertTestDatabase(databaseUrl, resolveTarget(process.env)) });
  try {
    await pool.query('BEGIN');
    // Start from nothing so the suite can run any number of times. CASCADE also clears every table that points
    // at these (orders, payments, audits, deliveries...), which is why the local-database guard above matters.
    await pool.query('TRUNCATE users, customers, sellers, riders, admins, categories RESTART IDENTITY CASCADE');
    const hash = await bcrypt.hash(E2E.customer.password, 4);
    await pool.query(
      `INSERT INTO users (id, username, password, email, role) VALUES
         ($1, $2, $3, $4, 'customer'),
         ($5, 'e2e-seller', 'x', 'e2e-seller@example.test', 'seller')`,
      [E2E.customer.id, E2E.customer.username, hash, E2E.customer.email, E2E.seller.id]
    );
    await pool.query(
      `INSERT INTO customers (id, name, number, address_house_name, address_street, address_city, address_postal_code, address_latitude, address_longitude)
       VALUES ($1, 'E2E Customer', '01700000000', 'House 1', 'Road 1', 'Dhaka', '1207', 23.78, 90.4)`,
      [E2E.customer.id]
    );
    await pool.query(`INSERT INTO sellers (id, name, status) VALUES ($1, 'E2E Seller', 'approved')`, [E2E.seller.id]);

    const sellerHash = await bcrypt.hash(E2E.newSeller.password, 4);
    await pool.query(
      `INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, 'seller')`,
      [E2E.newSeller.id, E2E.newSeller.username, sellerHash, E2E.newSeller.email]
    );
    await pool.query(
      `INSERT INTO sellers (id, name, number, status, address_house_name, address_street, address_city, address_latitude, address_longitude,
                            business_registration_number, payout_method, payout_account)
       VALUES ($1, $2, '01711111111', 'pending', 'Shop 2', 'Market Road', 'Dhaka', 23.8, 90.41, 'REG-1', 'bkash', '01711111111')`,
      [E2E.newSeller.id, E2E.newSeller.name]
    );
    await pool.query(`INSERT INTO seller_documents (id, seller_id, doc_type, storage_path) VALUES ('E2E-DOC', $1, 'national_id', 'e2e/none.png')`, [E2E.newSeller.id]);

    const adminHash = await bcrypt.hash(E2E.admin.password, 4);
    await pool.query(`INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, 'admin')`, [E2E.admin.id, E2E.admin.username, adminHash, E2E.admin.email]);
    await pool.query(`INSERT INTO admins (id, name) VALUES ($1, 'E2E Admin')`, [E2E.admin.id]);

    const riderHash = await bcrypt.hash(E2E.rider.password, 4);
    await pool.query(`INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, 'rider')`, [E2E.rider.id, E2E.rider.username, riderHash, E2E.rider.email]);
    const riderAddress = JSON.stringify({ House_Name: 'Flat 3', Street: 'Lake Road', City: 'Dhaka', Postal_Code: '1207', Latitude: 23.79, Longitude: 90.41 });
    await pool.query(
      `INSERT INTO riders (id, name, number, status, present_address_json, permanent_address_json, experience_json, previous_jobs_json, education_json, current_latitude, current_longitude)
       VALUES ($1, $2, '01722222222', 'approved', $3, $3, '["None"]', '["None"]', '["HSC"]', 23.79, 90.41)`,
      [E2E.rider.id, E2E.rider.name, riderAddress]
    );
    await pool.query(`INSERT INTO categories (id, name) VALUES ('E2E-CAT', 'E2E Category')`);
    for (const product of Object.values(E2E.products)) {
      await pool.query(
        `INSERT INTO products (id, name, price, stock, category_id, seller_id, voucher)
         VALUES ($1, $2, $3, 100, 'E2E-CAT', $4, $5)`,
        [product.id, product.name, product.price, E2E.seller.id, 'code' in product ? product.code : '']
      );
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
}

// Allow `tsx e2e/seed.ts` for manual use.
if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase(process.env.DATABASE_URL ?? '').then(() => console.log('e2e database seeded'));
}
