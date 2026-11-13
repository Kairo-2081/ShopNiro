import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWhenIdle, type IdleTaskEnvironment } from '../src/lib/idleTask.ts';

const fakeEnvironment = () => {
  const queue = new Map<number, () => void>();
  let next = 0;
  const environment: IdleTaskEnvironment = {
    schedule: (task) => { queue.set(++next, task); return next; },
    cancel: (handle) => { queue.delete(handle as number); },
  };
  return { environment, runIdle: () => { for (const [id, task] of [...queue]) { queue.delete(id); task(); } } };
};

test('does not run the task until the browser is idle, then runs it once', () => {
  const { environment, runIdle } = fakeEnvironment();
  let runs = 0;
  runWhenIdle(() => { runs += 1; }, environment);
  assert.equal(runs, 0);
  runIdle();
  runIdle();
  assert.equal(runs, 1);
});

test('cancelling before idle time means the work is never done', () => {
  const { environment, runIdle } = fakeEnvironment();
  let runs = 0;
  const cancel = runWhenIdle(() => { runs += 1; }, environment);
  cancel();
  runIdle();
  assert.equal(runs, 0);
});
