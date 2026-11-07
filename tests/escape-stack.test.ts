import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEscapeStack } from '../src/hooks/escapeStack.ts';

const press = (target: EventTarget, key: string) => {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'key', { value: key });
  target.dispatchEvent(event);
};

test('Escape calls the handler of the dialog on top only', () => {
  const target = new EventTarget();
  const stack = createEscapeStack(target);
  const calls: string[] = [];
  const removeOuter = stack.push(() => calls.push('outer'));
  const removeInner = stack.push(() => calls.push('inner'));

  press(target, 'Escape');
  assert.deepEqual(calls, ['inner']);

  removeInner();
  press(target, 'Escape');
  assert.deepEqual(calls, ['inner', 'outer']);
  removeOuter();
});

test('other keys do nothing and the listener is removed when no dialog is open', () => {
  const target = new EventTarget();
  const stack = createEscapeStack(target);
  let closed = 0;
  const remove = stack.push(() => { closed += 1; });

  press(target, 'Enter');
  assert.equal(closed, 0);

  remove();
  assert.equal(stack.size, 0);
  press(target, 'Escape');
  assert.equal(closed, 0);
});

test('removing a handler twice is harmless', () => {
  const target = new EventTarget();
  const stack = createEscapeStack(target);
  const remove = stack.push(() => undefined);
  remove();
  remove();
  assert.equal(stack.size, 0);
});
