// Run work that does not have to happen before the first paint once the browser has a free moment, and not at all if the
// screen that wanted it is gone by then. The orbit globe uses it: drawing it takes a phone with a slow processor a
// noticeable stretch of the main thread, and a visitor who taps "Explore Marketplace" straight away never needed it.
export interface IdleTaskEnvironment {
  schedule: (task: () => void) => unknown;
  cancel: (handle: unknown) => void;
}

const browserEnvironment = (): IdleTaskEnvironment => {
  const idle = window.requestIdleCallback?.bind(window);
  return {
    // The timeout bounds the wait on a busy page, so the picture still appears within a moment.
    // Safari has no requestIdleCallback, so wait a short while after the frame instead.
    schedule: (task) => (idle ? idle(task, { timeout: 700 }) : window.setTimeout(task, 200)),
    cancel: (handle) => (idle ? window.cancelIdleCallback(handle as number) : window.clearTimeout(handle as number)),
  };
};

/** Returns a function that cancels the task if it has not started yet. */
export function runWhenIdle(task: () => void, environment: IdleTaskEnvironment = browserEnvironment()): () => void {
  const handle = environment.schedule(task);
  return () => environment.cancel(handle);
}
