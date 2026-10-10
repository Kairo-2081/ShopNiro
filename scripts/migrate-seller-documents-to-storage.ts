import 'dotenv/config';
import { pool, query } from '../server/db/index.ts';
import { uploadSellerDocument, deleteSellerDocument } from '../server/services/sellerDocuments.service.ts';

const migrate = async () => {
  const legacy = await query(`
    SELECT id, seller_id, document_type, mime_type, document_data
    FROM seller_verification_documents ORDER BY uploaded_at, id
  `);
  let migrated = 0;

  for (const document of legacy.rows) {
    const docType = document.document_type === 'business_registration' ? 'trade_license' : 'national_id';
    const storagePath = await uploadSellerDocument(
      document.seller_id,
      docType,
      Buffer.from(document.document_data),
      document.mime_type
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO seller_documents (id, seller_id, doc_type, storage_path) VALUES ($1, $2, $3, $4)',
        [`SDOC-MIG-${document.id}`, document.seller_id, docType, storagePath]
      );
      await client.query('DELETE FROM seller_verification_documents WHERE id = $1', [document.id]);
      await client.query('COMMIT');
      migrated += 1;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      await deleteSellerDocument(storagePath);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log(`Migrated ${migrated} seller documents to private storage.`);
};

try {
  await migrate();
} finally {
  await pool.end();
}