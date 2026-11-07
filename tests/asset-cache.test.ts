import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFingerprintedAsset } from '../server/services/assetCache.ts';

test('matches Vite name-HASH files under assets', () => {
  assert.equal(isFingerprintedAsset('/app/dist/assets/AdminDashboard-DnEEh1gI.js'), true);
  assert.equal(isFingerprintedAsset('/app/dist/assets/index-V4MK-cCI.css'), true);
});

test('does not mark html or root files immutable', () => {
  assert.equal(isFingerprintedAsset('/app/dist/index.html'), false);
  assert.equal(isFingerprintedAsset('/app/dist/favicon.ico'), false);
  assert.equal(isFingerprintedAsset('/app/dist/assets/readme.txt'), false);
});
