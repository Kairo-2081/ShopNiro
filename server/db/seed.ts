import fs from 'fs';
import path from 'path';
import { query, pool } from './index.ts';
import { hashPassword, isBcryptHash } from './password.ts';
import {
  initialCategories,
  initialSellers,
  initialProducts,
  initialReviews,
  initialOrders,
  initialCustomers,
  initialAdmin,
} from '../../src/data/seedData.ts';

/**
 * Execute schema.sql to ensure all tables, views, triggers, and routines exist.
 * All database related things are defined exclusively in schema.sql.
 */
export async function ensureDatabaseSchema() {
  try {
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('✓ Executed schema.sql successfully (tables, views, triggers, and routines verified)');
    }
  } catch (err: any) {
    console.error('Error applying schema.sql:', err.message || err);
  }
}

/**
 * Migrate plain-text passwords to bcrypt hashes using the schema routine
 */
export async function migrateExistingPasswordsToBcrypt() {
  try {
    const result = await query(`SELECT * FROM gocart_passwords_list()`);
    for (const u of result.rows) {
      if (u.password && !isBcryptHash(u.password)) {
        const hashed = await hashPassword(u.password);
        await query(`SELECT gocart_auth_password_update($1, $2, $3)`, [u.account_type, u.id, hashed]);
      }
    }
  } catch (err: any) {
    // If users table is empty or function not yet ready
  }
}

/**
 * Seed initial demo records using schema.sql routines: gocart_table_count and gocart_seed_row
 */
export async function seedDatabaseIfEmpty() {
  try {
    await ensureDatabaseSchema();

    // 1. Categories
    const catCountRes = await query(`SELECT gocart_table_count('categories') AS count`);
    const catCount = Number(catCountRes.rows[0]?.count || 0);
    if (catCount === 0) {
      for (const cat of initialCategories) {
        await query(`SELECT gocart_seed_row('categories', $1::jsonb)`, [
          JSON.stringify({ id: cat.Category_ID, name: cat.Name }),
        ]);
      }
    }

    // 2. Admin
    const adminCountRes = await query(`SELECT gocart_table_count('admins') AS count`);
    const adminCount = Number(adminCountRes.rows[0]?.count || 0);
    if (adminCount === 0) {
      const hashedPassword = await hashPassword(initialAdmin.Password);
      await query(`SELECT gocart_seed_row('admins', $1::jsonb)`, [
        JSON.stringify({
          id: initialAdmin.Admin_ID,
          username: initialAdmin.Username,
          name: initialAdmin.Name,
          email: initialAdmin.Email,
          password: hashedPassword,
          number: initialAdmin.Number,
          address_house_name: initialAdmin.Address.House_Name,
          address_street: initialAdmin.Address.Street,
          address_city: initialAdmin.Address.City,
          address_postal_code: initialAdmin.Address.Postal_Code,
          address_additional_info: initialAdmin.Address.Additional_Info || '',
        }),
      ]);
    }

    // 3. Sellers
    const sellerCountRes = await query(`SELECT gocart_table_count('sellers') AS count`);
    const sellerCount = Number(sellerCountRes.rows[0]?.count || 0);
    if (sellerCount === 0) {
      for (const seller of initialSellers) {
        const hashedPassword = await hashPassword(seller.Password);
        await query(`SELECT gocart_seed_row('sellers', $1::jsonb)`, [
          JSON.stringify({
            id: seller.Seller_ID,
            username: seller.Username,
            name: seller.Name,
            email: seller.Email,
            password: hashedPassword,
            number: seller.Number,
            logo: seller.Logo || '',
            description: seller.Description || '',
            status: seller.Status,
            address_house_name: seller.Address.House_Name,
            address_street: seller.Address.Street,
            address_city: seller.Address.City,
            address_postal_code: seller.Address.Postal_Code,
            address_additional_info: seller.Address.Additional_Info || '',
          }),
        ]);
      }
    }

    // 4. Customers
    const custCountRes = await query(`SELECT gocart_table_count('customers') AS count`);
    const custCount = Number(custCountRes.rows[0]?.count || 0);
    if (custCount === 0) {
      for (const cust of initialCustomers) {
        const hashedPassword = await hashPassword(cust.Password);
        await query(`SELECT gocart_seed_row('customers', $1::jsonb)`, [
          JSON.stringify({
            id: cust.Customer_ID,
            username: cust.Username,
            name: cust.Name,
            email: cust.Email,
            password: hashedPassword,
            number: cust.Number,
            address_house_name: cust.Address.House_Name,
            address_street: cust.Address.Street,
            address_city: cust.Address.City,
            address_postal_code: cust.Address.Postal_Code,
            address_additional_info: cust.Address.Additional_Info || '',
          }),
        ]);
      }
    }

    // 5. Products
    const prodCountRes = await query(`SELECT gocart_table_count('products') AS count`);
    const prodCount = Number(prodCountRes.rows[0]?.count || 0);
    if (prodCount === 0) {
      for (const p of initialProducts) {
        await query(`SELECT gocart_seed_row('products', $1::jsonb)`, [
          JSON.stringify({
            id: p.Product_ID,
            name: p.Name,
            image: p.Image,
            description: p.Description,
            price: p.Price,
            voucher: p.Voucher || '',
            stock: p.Stock,
            product_status: p.Product_Status,
            category_id: p.Category_ID,
            seller_id: p.Seller_ID,
          }),
        ]);
      }
    }

    // 6. Reviews
    const revCountRes = await query(`SELECT gocart_table_count('reviews') AS count`);
    const revCount = Number(revCountRes.rows[0]?.count || 0);
    if (revCount === 0) {
      for (const r of initialReviews) {
        await query(`SELECT gocart_seed_row('reviews', $1::jsonb)`, [
          JSON.stringify({
            id: r.Review_ID,
            product_id: r.Product_ID,
            customer_id: r.Customer_ID,
            customer_name: r.Customer_Name,
            review_text: r.Review_text,
            rating: r.Rating,
          }),
        ]);
      }
    }

    // 7. Orders
    const ordCountRes = await query(`SELECT gocart_table_count('orders') AS count`);
    const ordCount = Number(ordCountRes.rows[0]?.count || 0);
    if (ordCount === 0) {
      for (const o of initialOrders) {
        await query(`SELECT gocart_seed_row('orders', $1::jsonb)`, [
          JSON.stringify({
            id: o.Order_ID,
            tracking_id: o.Tracking_ID,
            customer_id: o.Customer_ID,
            items_json: JSON.stringify(o.Items),
            subtotal: o.Subtotal,
            shipping_fee: o.Shipping_Fee,
            status: o.Status,
            shipping_address_json: JSON.stringify(o.Shipping_Address),
            billing_address_json: JSON.stringify(o.Billing_Address),
            additional_info: o.Additional_Info || '',
          }),
        ]);
      }
    }

    await migrateExistingPasswordsToBcrypt();
  } catch (err) {
    console.error('Database seeding failed:', err);
  }
}
