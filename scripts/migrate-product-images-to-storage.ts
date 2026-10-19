import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL to the specific database being migrated; SUPABASE_DB_URL is intentionally not used.');
}

delete process.env.SUPABASE_DB_URL;

const args = process.argv.slice(2);
const limitArgument = args.find((argument) => argument.startsWith('--limit='));
const limit = limitArgument ? Number(limitArgument.slice('--limit='.length)) : 0;
const apply = args.includes('--apply');

if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
  throw new Error('Pass --limit=N (1-1000). Start with --limit=3 and review before increasing it.');
}
if (apply && process.env.PRODUCT_IMAGE_MIGRATION_CONFIRM !== 'YES_I_HAVE_A_BACKUP') {
  throw new Error('Before applying, back up the database and set PRODUCT_IMAGE_MIGRATION_CONFIRM=YES_I_HAVE_A_BACKUP.');
}

const [{ pool, query }, { uploadProductImage }] = await Promise.all([
  import('../server/db/index.ts'),
  import('../server/services/productImages.service.ts'),
]);

const inlineImage = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:image/');

const targetCte = `
  WITH legacy AS (
    SELECT 'product'::text AS row_type, product.id::text AS row_id,
      product.seller_id, product.image, product.images_json
    FROM products product
    WHERE product.image LIKE 'data:image/%'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(product.images_json) = 'array' THEN product.images_json ELSE '[]'::jsonb END
        ) image_item(value)
        WHERE image_item.value LIKE 'data:image/%'
      )
    UNION ALL
    SELECT 'order_item'::text, item.order_item_id::text,
      COALESCE(item.seller_id, product.seller_id, item.seller_id_snapshot), item.image, '[]'::jsonb
    FROM order_items item
    LEFT JOIN products product ON product.id = item.product_id
    WHERE item.image LIKE 'data:image/%'
  )
`;

try {
  const countResult = await query(`${targetCte} SELECT COUNT(*)::integer AS total FROM legacy`);
  const total = Number(countResult.rows[0]?.total) || 0;
  const rows = await query(
    `${targetCte} SELECT * FROM legacy ORDER BY row_type, row_id LIMIT $1`,
    [limit],
  );

  console.log(`${apply ? 'Apply' : 'Dry run'}: ${total} inline-image row(s) found; processing at most ${limit}.`);
  if (!apply) {
    console.log('No uploads or database updates were performed. Review the target rows, then repeat with --apply after a backup.');
    console.log(rows.rows.map(({ row_type, row_id }) => `${row_type}: ${row_id}`).join('\n') || 'No matching rows.');
    process.exitCode = total > limit ? 2 : 0;
  } else {
    const uploaded = new Map<string, string>();
    let migrated = 0;
    for (const row of rows.rows) {
      if (!row.seller_id) throw new Error(`${row.row_type} ${row.row_id} has no seller ID; cannot choose a storage path.`);
      const storeImage = async (value: string) => {
        if (!inlineImage(value)) return value;
        const cacheKey = `${row.seller_id}:${value}`;
        const existing = uploaded.get(cacheKey);
        if (existing) return existing;
        const url = await uploadProductImage(String(row.seller_id), value);
        uploaded.set(cacheKey, url);
        return url;
      };

      if (row.row_type === 'product') {
        const originalImages = Array.isArray(row.images_json) ? row.images_json : [];
        const sourceImages = originalImages.length ? originalImages : row.image ? [row.image] : [];
        const migratedImages = await Promise.all(sourceImages.map((value: string) => storeImage(String(value))));
        const migratedImage = row.image ? await storeImage(String(row.image)) : migratedImages[0] || null;
        const update = await query(
          `UPDATE products SET image = $2, images_json = $3::jsonb
           WHERE id = $1 AND image IS NOT DISTINCT FROM $4 AND images_json = $5::jsonb`,
          [row.row_id, migratedImage, JSON.stringify(migratedImages), row.image, JSON.stringify(originalImages)],
        );
        if (!update.rowCount) throw new Error(`Product ${row.row_id} changed during migration; rerun a dry run before continuing.`);
      } else {
        const migratedImage = await storeImage(String(row.image));
        const update = await query(
          `UPDATE order_items SET image = $2 WHERE order_item_id = $1 AND image = $3`,
          [row.row_id, migratedImage, row.image],
        );
        if (!update.rowCount) throw new Error(`Order item ${row.row_id} changed during migration; rerun a dry run before continuing.`);
      }
      migrated += 1;
      console.log(`Migrated ${row.row_type} ${row.row_id}.`);
    }
    console.log(`Migrated ${migrated} row(s). ${Math.max(0, total - migrated)} row(s) remain.`);
  }
} finally {
  await pool.end();
}