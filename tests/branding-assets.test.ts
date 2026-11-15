import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

// src/lib/branding.ts loads its images with new URL('<relative path>', import.meta.url). Vite only warns about a
// missing file at build time and ships a broken image, so a README tidy-up that moves one is easy to miss
// (it happened to the 128 px logo). This test fails when any of those files is gone.
test('every image src/lib/branding.ts points at exists', () => {
  const source = readFileSync('src/lib/branding.ts', 'utf8');
  const paths = [...source.matchAll(/new URL\('([^']+)',\s*import\.meta\.url\)/g)].map((match) => match[1]);
  assert.ok(paths.length >= 3, 'expected branding.ts to reference its images with new URL(...)');
  for (const relative of paths) {
    const file = resolve('src/lib', relative);
    assert.ok(existsSync(file), `branding.ts references ${relative}, which does not exist (looked for ${file})`);
  }
});
