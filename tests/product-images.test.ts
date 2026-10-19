import assert from 'node:assert/strict';
import test from 'node:test';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { uploadProductImage, storeProductImageIfInline } = await import('../server/services/productImages.service.ts');

const dataUrl = (mime: string, bytes: Buffer) => `data:image/${mime};base64,${bytes.toString('base64')}`;
const pngBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

const rejects = (promise: Promise<unknown>, statusCode: number, message?: RegExp) =>
  assert.rejects(promise, (err: any) => {
    assert.equal(err.statusCode, statusCode);
    if (message) assert.match(err.message, message);
    return true;
  });

test('rejects non-image data URLs and unsupported types', async () => {
  await rejects(uploadProductImage('seller-1', 'data:text/html;base64,PGI+'), 400, /Unsupported/);
  await rejects(uploadProductImage('seller-1', dataUrl('gif', pngBytes)), 400, /Unsupported/);
});

test('rejects images over 2 MB', async () => {
  const big = Buffer.concat([pngBytes, Buffer.alloc(2 * 1024 * 1024)]);
  await rejects(uploadProductImage('seller-1', dataUrl('png', big)), 400, /2 MB/);
});

test('rejects files whose bytes are not a real image', async () => {
  await rejects(uploadProductImage('seller-1', dataUrl('png', Buffer.from('<script>alert(1)</script>'))), 400, /not a real image/);
});

test('rejects unsafe seller ids (path traversal)', async () => {
  await rejects(uploadProductImage('../evil', dataUrl('png', pngBytes)), 400, /Invalid seller/);
});

test('a valid image fails closed with 503 when storage is not configured', async () => {
  await rejects(uploadProductImage('seller-1', dataUrl('png', pngBytes)), 503, /not configured/);
});

test('non-inline image URLs pass through untouched', async () => {
  assert.equal(await storeProductImageIfInline('seller-1', 'https://images.unsplash.com/x.jpg'), 'https://images.unsplash.com/x.jpg');
});
