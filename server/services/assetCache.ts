// Vite writes fingerprinted files as name-HASH.ext (8 chars of base64url) under assets/.
const HASHED_ASSET = /^(?:.+)[-.][A-Za-z0-9_-]{8}\.(?:js|css|woff2?|png|jpe?g|svg|webp|avif|gif|ico|map)$/;

export function isFingerprintedAsset(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/assets/')) return false;
  return HASHED_ASSET.test(normalized.slice(normalized.lastIndexOf('/') + 1));
}
