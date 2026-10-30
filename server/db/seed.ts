import { query } from './index.ts';
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
 * Migrate plain-text passwords to bcrypt hashes using the schema routine
 */
export async function migrateExistingPasswordsToBcrypt() {
  const result = await query('SELECT id, password FROM users');
  let migratedCount = 0;
  for (const user of result.rows) {
    if (typeof user.password !== 'string' || isBcryptHash(user.password)) continue;
    const hashedPassword = await hashPassword(user.password);
    const update = await query(
      'UPDATE users SET password = $2 WHERE id = $1 AND password = $3',
      [user.id, hashedPassword, user.password]
    );
    migratedCount += update.rowCount || 0;
  }
  return migratedCount;
}

/**
 * Seed demo records into a database that has already been migrated.
 */
export async function seedDatabaseIfEmpty() {
  try {
    const [adminCountResult, sellerCountResult, customerCountResult] = await Promise.all([
      query(`SELECT shopniro_table_count('admins') AS count`),
      query(`SELECT shopniro_table_count('sellers') AS count`),
      query(`SELECT shopniro_table_count('customers') AS count`),
    ]);
    const adminCount = Number(adminCountResult.rows[0]?.count || 0);
    const sellerCount = Number(sellerCountResult.rows[0]?.count || 0);
    const customerCount = Number(customerCountResult.rows[0]?.count || 0);
    const seedPasswords = {
      admin: process.env.SHOPNIRO_SEED_ADMIN_PASSWORD,
      seller: process.env.SHOPNIRO_SEED_SELLER_PASSWORD,
      customer: process.env.SHOPNIRO_SEED_CUSTOMER_PASSWORD,
    };
    const requireStrongSeedPassword = (name: string, value: string | undefined) => {
      if (!value || value.trim().length < 16) {
        throw new Error(`${name} must be at least 16 characters.`);
      }
    };
    if (adminCount === 0) requireStrongSeedPassword('SHOPNIRO_SEED_ADMIN_PASSWORD', seedPasswords.admin);
    if (sellerCount === 0) requireStrongSeedPassword('SHOPNIRO_SEED_SELLER_PASSWORD', seedPasswords.seller);
    if (customerCount === 0) requireStrongSeedPassword('SHOPNIRO_SEED_CUSTOMER_PASSWORD', seedPasswords.customer);

    // 1. Categories
    const catCountRes = await query(`SELECT shopniro_table_count('categories') AS count`);
    const catCount = Number(catCountRes.rows[0]?.count || 0);
    if (catCount === 0) {
      for (const cat of initialCategories) {
        await query(`SELECT shopniro_seed_row('categories', $1::jsonb)`, [
          JSON.stringify({ id: cat.Category_ID, name: cat.Name }),
        ]);
      }
    }

    // 2. Admin
    if (adminCount === 0) {
      const hashedPassword = await hashPassword(seedPasswords.admin!);
      await query(`SELECT shopniro_seed_row('admins', $1::jsonb)`, [
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
    if (sellerCount === 0) {
      for (const seller of initialSellers) {
        const hashedPassword = await hashPassword(seedPasswords.seller!);
        await query(`SELECT shopniro_seed_row('sellers', $1::jsonb)`, [
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
    if (customerCount === 0) {
      for (const cust of initialCustomers) {
        const hashedPassword = await hashPassword(seedPasswords.customer!);
        await query(`SELECT shopniro_seed_row('customers', $1::jsonb)`, [
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
    const prodCountRes = await query(`SELECT shopniro_table_count('products') AS count`);
    const prodCount = Number(prodCountRes.rows[0]?.count || 0);
    if (prodCount === 0) {
      for (const p of initialProducts) {
        await query(`SELECT shopniro_seed_row('products', $1::jsonb)`, [
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
    const revCountRes = await query(`SELECT shopniro_table_count('reviews') AS count`);
    const revCount = Number(revCountRes.rows[0]?.count || 0);
    if (revCount === 0) {
      for (const r of initialReviews) {
        await query(`SELECT shopniro_seed_row('reviews', $1::jsonb)`, [
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
    const ordCountRes = await query(`SELECT shopniro_table_count('orders') AS count`);
    const ordCount = Number(ordCountRes.rows[0]?.count || 0);
    if (ordCount === 0) {
      for (const o of initialOrders) {
        await query(`SELECT shopniro_seed_row('orders', $1::jsonb)`, [
          JSON.stringify({
            id: o.Order_ID,
            tracking_id: o.Tracking_ID,
            customer_id: o.Customer_ID,
            subtotal: o.Subtotal,
            shipping_fee: o.Shipping_Fee,
            status: o.Status,
            shipping_address_json: JSON.stringify(o.Shipping_Address),
            billing_address_json: JSON.stringify(o.Billing_Address),
            additional_info: o.Additional_Info || '',
          }),
        ]);
        if (o.Items.length) {
          await query(`
            INSERT INTO order_items (
              order_id, product_id, seller_id, product_id_snapshot, seller_id_snapshot,
              product_name, unit_price, quantity, image, size
            )
            SELECT $1, NULLIF(item.value->>'Product_ID', ''), NULLIF(item.value->>'Seller_ID', ''),
              COALESCE(NULLIF(item.value->>'Product_ID', ''), 'deleted-product'),
              COALESCE(NULLIF(item.value->>'Seller_ID', ''), 'deleted-seller'),
              COALESCE(item.value->>'Name', 'Archived product'),
              COALESCE((item.value->>'Price')::NUMERIC, 0),
              GREATEST(COALESCE((item.value->>'Quantity')::INTEGER, 1), 1),
              NULLIF(item.value->>'Image', ''),
              COALESCE(item.value->>'Size', '')
            FROM jsonb_array_elements($2::jsonb) AS item(value)
            ON CONFLICT DO NOTHING
          `, [o.Order_ID, JSON.stringify(o.Items)]);
        }
      }
    }
  } catch (err) {
    console.error('Database seeding failed:', err);
  }
}
