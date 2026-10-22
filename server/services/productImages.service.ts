import { randomUUID } from 'node:crypto';
import { getSupabaseAdminClient } from '../db/index.ts';

const bucketName = () => process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || 'product-images';
const maxBytes = 2 * 1024 * 1024;

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

function detectType(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

export async function uploadProductImage(sellerId: string, dataUrl: string): Promise<string> {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/i.exec(dataUrl);
  if (!match) throw fail('Unsupported image.', 400);
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length > maxBytes) throw fail('Image is larger than 2 MB.', 400);
  const extension = detectType(buffer);
  if (!extension) throw fail('File is not a real image.', 400);

  const safeSellerId = sellerId.replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeSellerId || safeSellerId !== sellerId) throw fail('Invalid seller ID.', 400);
  const client = getSupabaseAdminClient();
  if (!client) throw fail('Image storage is not configured.', 503);

  const path = `${safeSellerId}/${randomUUID()}.${extension}`;
  const { error } = await client.storage.from(bucketName()).upload(path, buffer, {
    contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
    upsert: false,
  });
  if (error) throw new Error('Could not store the image.');
  return client.storage.from(bucketName()).getPublicUrl(path).data.publicUrl;
}

export type ProductImageKind = 'inline' | 'link' | 'invalid';

/**
 * A product image is either an uploaded file sent as a data URL ("inline"),
 * or a plain http(s) link / root-relative path ("link"). Anything else is rejected.
 */
export function classifyProductImage(value: string): ProductImageKind {
  const image = value.trim();
  if (!image || image.length > 2048 && !image.startsWith('data:image/')) return 'invalid';
  if (image.startsWith('data:image/')) return 'inline';
  if (/^https?:\/\/[^\s]+$/i.test(image)) return 'link';
  if (image.startsWith('/') && !image.startsWith('//') && !/\s/.test(image)) return 'link';
  return 'invalid';
}

/**
 * Uploaded files go to Storage and become a public URL. Links are kept as they are.
 * Anything that is neither is rejected with a 400.
 */
export async function storeProductImageIfInline(sellerId: string, imageUrl: string): Promise<string> {
  const kind = classifyProductImage(imageUrl);
  if (kind === 'invalid') throw fail('Product images must be an uploaded file or an http(s) link.', 400);
  return kind === 'inline' ? uploadProductImage(sellerId, imageUrl.trim()) : imageUrl.trim();
}
