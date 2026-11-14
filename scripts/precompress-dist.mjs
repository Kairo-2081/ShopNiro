// Writes a Brotli copy next to every compressible built file (app.js -> app.js.br). The server hands that copy to
// browsers that accept Brotli, so the work is done once at build time at the slowest, smallest setting instead of on
// every request. Browsers that do not accept Brotli still get the gzip the server makes on the fly.
import { brotliCompressSync, constants } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// The Android app ships dist inside the APK and reads the plain files, so the copies would only add weight there.
if (process.env.SKIP_PRECOMPRESS === '1') {
  console.log('precompress: skipped (SKIP_PRECOMPRESS=1)');
  process.exit(0);
}

const root = path.join(process.cwd(), 'dist');
const compressible = /\.(js|mjs|css|html|svg|json|webmanifest|txt|xml)$/;
// Smaller than this and the saving is not worth a second file or a second round of header bytes.
const MIN_BYTES = 1024;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

let written = 0;
let before = 0;
let after = 0;
for (const file of files(root)) {
  // The server bundle is run by node, never sent to a browser.
  if (!compressible.test(file) || file.endsWith('server.cjs') || statSync(file).size < MIN_BYTES) continue;
  const input = readFileSync(file);
  const output = brotliCompressSync(input, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_SIZE_HINT]: input.length,
    },
  });
  // Keep the copy only when it is actually smaller; the server falls back to the plain file otherwise.
  if (output.length >= input.length) continue;
  writeFileSync(`${file}.br`, output);
  written += 1;
  before += input.length;
  after += output.length;
}
console.log(`precompress: ${written} files, ${(before / 1024).toFixed(0)} kB -> ${(after / 1024).toFixed(0)} kB with Brotli`);
