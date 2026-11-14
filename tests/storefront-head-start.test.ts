import assert from 'node:assert/strict';
import { test } from 'node:test';

const requested: string[] = [];
(globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
  requested.push(String(input));
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const { beginStorefrontHeadStart, takeStorefrontHeadStart } = await import('../src/lib/storefrontHeadStart.ts');

test('the head start asks for the five public requests once and hands them over once', async () => {
  beginStorefrontHeadStart();
  beginStorefrontHeadStart();
  const paths = requested.map((url) => new URL(url, 'http://x').pathname);
  assert.equal(new Set(paths).size, paths.length, 'a second begin must not repeat any request');
  assert.ok(paths.some((path) => path.includes('/auth/me')), 'the sign-in check starts early');
  assert.ok(paths.some((path) => path.includes('/products')), 'the first product page starts early');

  const taken = takeStorefrontHeadStart();
  assert.ok(taken, 'the app can take the early requests');
  assert.equal(takeStorefrontHeadStart(), null, 'a second take gets nothing, so a retry asks normally');
  await Promise.allSettled(Object.values(taken));
});

test('a failed early request is the app\'s to handle, not an unhandled rejection', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  process.on('unhandledRejection', onUnhandled);
  (globalThis as { fetch: typeof fetch }).fetch = (async () => { throw new TypeError('offline'); }) as typeof fetch;
  beginStorefrontHeadStart();
  const taken = takeStorefrontHeadStart();
  assert.ok(taken);
  await new Promise((resolve) => setTimeout(resolve, 50));
  process.off('unhandledRejection', onUnhandled);
  assert.deepEqual(unhandled, []);
});
