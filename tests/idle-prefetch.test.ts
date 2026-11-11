import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prefetchWhenIdle, type IdlePrefetchEnvironment } from '../src/lib/idlePrefetch.ts';

const fakeEnvironment = (saveData = false) => {
  const queue = new Map<number, () => void>();
  let next = 0;
  const environment: IdlePrefetchEnvironment = {
    saveData,
    schedule: (task) => { queue.set(++next, task); return next; },
    cancel: (handle) => { queue.delete(handle as number); },
  };
  return { environment, runIdle: () => { for (const [id, task] of [...queue]) { queue.delete(id); task(); } }, pending: () => queue.size };
};

test('does nothing until the browser is idle, then loads once', () => {
  const { environment, runIdle } = fakeEnvironment();
  let loads = 0;
  prefetchWhenIdle(async () => { loads += 1; }, environment);
  assert.equal(loads, 0);
  runIdle();
  assert.equal(loads, 1);
  runIdle();
  assert.equal(loads, 1);
});

test('does not load at all when the visitor asked to save data', () => {
  const { environment, pending } = fakeEnvironment(true);
  let loads = 0;
  prefetchWhenIdle(async () => { loads += 1; }, environment);
  assert.equal(pending(), 0);
  assert.equal(loads, 0);
});

test('cancelling before idle time prevents the load', () => {
  const { environment, runIdle } = fakeEnvironment();
  let loads = 0;
  const cancel = prefetchWhenIdle(async () => { loads += 1; }, environment);
  cancel();
  runIdle();
  assert.equal(loads, 0);
});

test('a failed prefetch is swallowed instead of raising an unhandled rejection', async () => {
  const { environment, runIdle } = fakeEnvironment();
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    prefetchWhenIdle(() => Promise.reject(new Error('offline')), environment);
    runIdle();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
