import { randomUUID } from 'node:crypto';
import { getSupabaseAdminClient } from '../db/index.ts';

const bucketName = () => process.env.SUPABASE_SELLER_DOCUMENTS_BUCKET || 'seller-verification-documents';

const getStorageClient = () => {
  const client = getSupabaseAdminClient();
  if (!client) {
    const error = new Error('Private seller document storage is not configured.') as Error & { statusCode?: number };
    error.statusCode = 503;
    throw error;
  }
  return client;
};

const getPrivateBucket = async () => {
  const client = getStorageClient();
  const name = bucketName();
  const { data, error } = await client.storage.getBucket(name);
  if (error || !data) throw new Error('Private seller verification bucket is not available.');
  if (data.public) throw new Error('Seller verification bucket must be private.');
  return client.storage.from(name);
};

export async function uploadSellerDocument(
  sellerId: string,
  docType: 'national_id' | 'trade_license' | 'bank_statement',
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const storagePath = `${sellerId}/${docType}/${randomUUID()}.${extension}`;
  const { error } = await (await getPrivateBucket()).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error('Could not securely upload the seller verification document.');
  return storagePath;
}

export async function deleteSellerDocument(storagePath: string): Promise<void> {
  const { error } = await (await getPrivateBucket()).remove([storagePath]);
  if (error) console.error('Could not remove orphaned seller document from private storage:', error.message);
}

export async function createSellerDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await (await getPrivateBucket()).createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) throw new Error('Could not create a temporary seller document link.');
  return data.signedUrl;
}