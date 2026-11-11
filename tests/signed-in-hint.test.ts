import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SIGNED_IN_HINT_KEY,
  SIGNED_IN_HINT_MAX_AGE_MS,
  forgetSignedIn,
  hasSignedInHint,
  rememberSignedIn,
  type HintStorage,
} from '../src/lib/signedInHint.ts';

const memoryStorage = (): HintStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
};

const brokenStorage: HintStorage = {
  getItem: () => { throw new Error('storage blocked'); },
  setItem: () => { throw new Error('storage blocked'); },
  removeItem: () => { throw new Error('storage blocked'); },
};

test('there is no hint until a sign-in has been confirmed', () => {
  assert.equal(hasSignedInHint(1_000, memoryStorage()), false);
});

test('a confirmed sign-in is remembered for the length of a session and not longer', () => {
  const storage = memoryStorage();
  rememberSignedIn(1_000, storage);
  assert.equal(hasSignedInHint(1_000, storage), true);
  assert.equal(hasSignedInHint(1_000 + SIGNED_IN_HINT_MAX_AGE_MS - 1, storage), true);
  assert.equal(hasSignedInHint(1_000 + SIGNED_IN_HINT_MAX_AGE_MS, storage), false);
});

test('forgetting the hint clears it', () => {
  const storage = memoryStorage();
  rememberSignedIn(1_000, storage);
  forgetSignedIn(storage);
  assert.equal(hasSignedInHint(1_000, storage), false);
  assert.equal(storage.data.has(SIGNED_IN_HINT_KEY), false);
});

test('the hint holds only a timestamp, nothing that identifies the visitor', () => {
  const storage = memoryStorage();
  rememberSignedIn(1_234_567, storage);
  assert.equal(storage.data.get(SIGNED_IN_HINT_KEY), '1234567');
});

test('garbage or a timestamp from the future is not trusted', () => {
  const storage = memoryStorage();
  storage.setItem(SIGNED_IN_HINT_KEY, 'yes');
  assert.equal(hasSignedInHint(1_000, storage), false);
  storage.setItem(SIGNED_IN_HINT_KEY, '9999999');
  assert.equal(hasSignedInHint(1_000, storage), false);
});

test('missing or blocked storage never throws and simply means no hint', () => {
  assert.equal(hasSignedInHint(1_000, null), false);
  assert.equal(hasSignedInHint(1_000, brokenStorage), false);
  assert.doesNotThrow(() => rememberSignedIn(1_000, brokenStorage));
  assert.doesNotThrow(() => forgetSignedIn(brokenStorage));
  assert.doesNotThrow(() => rememberSignedIn(1_000, null));
});
