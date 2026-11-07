import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const read = (file: string) => readFile(path.resolve(process.cwd(), file), 'utf8');

test('the glass layer is imported and sorts after Tailwind utilities', async () => {
  const index = await read('src/index.css');
  assert.match(index, /@import "\.\/glass\.css";/);
  const glass = await read('src/glass.css');
  assert.match(glass, /@layer theme, base, components, utilities, glass;/);
});

test('every blurred surface has the accessibility and compatibility fallbacks', async () => {
  const glass = await read('src/glass.css');
  assert.match(glass, /@media \(prefers-reduced-transparency: reduce\)/, 'reduced transparency fallback');
  assert.match(glass, /@media \(forced-colors: active\)/, 'forced colors fallback');
  assert.match(glass, /@supports not \(\(backdrop-filter: blur\(1px\)\)/, 'no backdrop-filter fallback');
  assert.match(glass, /@media print/, 'print reset');
});

test('glass rules never set position, which would override Tailwind absolute and fixed on shared classes', async () => {
  const glass = await read('src/glass.css');
  assert.doesNotMatch(glass, /^\s*position\s*:/m);
});

test('both themes define every glass token', async () => {
  const glass = await read('src/glass.css');
  const light = glass.slice(glass.indexOf(':root {'), glass.indexOf('.dark {'));
  const dark = glass.slice(glass.indexOf('.dark {'), glass.indexOf('/* Base recipe'));
  const tokens = ['--glass-tint', '--glass-tint-strong', '--glass-tint-soft', '--glass-edge', '--glass-edge-dim', '--glass-highlight', '--glass-shade', '--glass-shadow', '--glass-scrim', '--glass-blur', '--glass-blur-strong', '--glass-saturate'];
  for (const token of tokens) {
    assert.ok(light.includes(`${token}:`), `light theme is missing ${token}`);
    assert.ok(dark.includes(`${token}:`), `dark theme is missing ${token}`);
  }
});

test('the scrolling header keeps its glass tint but no backdrop-filter, which made its tab clicks unstable at 360 px', async () => {
  const glass = await read('src/glass.css');
  const start = glass.indexOf('  .glass-header {');
  assert.ok(start > -1, 'glass-header rule exists');
  const rule = glass.slice(start, glass.indexOf('}', start));
  assert.doesNotMatch(rule, /backdrop-filter/);
  const navbar = await read('src/components/Navbar.tsx');
  assert.match(navbar, /<header className="glass-header /);
});

test('mapped panels get a solid fill under reduced transparency and the scene is dimmed or hidden', async () => {
  const glass = await read('src/glass.css');
  const reduced = glass.slice(glass.lastIndexOf('@media (prefers-reduced-transparency: reduce)'));
  assert.match(reduced, /background: var\(--glass-tint-strong\)/);
  assert.match(reduced, /body::before/);
  assert.match(glass, /@media \(forced-colors: active\) \{\s*body::before/);
});

test('the scene behind the glass has colour blobs for both themes', async () => {
  const glass = await read('src/glass.css');
  assert.match(glass, /html:not\(\.dark\) body::before \{/);
  assert.match(glass, /html\.dark body::before \{/);
  assert.match(glass, /@media \(prefers-reduced-motion: reduce\) \{\s*body::before/);
});
