// Fetch code the visitor will probably need next while the browser has nothing better to do, so opening it later does
// not wait on the network. Skipped when the visitor has asked to save data, and a failed fetch is ignored: the real
// import still runs, and reports its own error, when the screen is opened.
export interface IdlePrefetchEnvironment {
  saveData: boolean;
  schedule: (task: () => void) => unknown;
  cancel: (handle: unknown) => void;
}

const browserEnvironment = (): IdlePrefetchEnvironment => {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const idle = window.requestIdleCallback?.bind(window);
  return {
    saveData: connection?.saveData === true,
    // Safari has no requestIdleCallback, so wait a moment after load instead.
    schedule: (task) => (idle ? idle(task, { timeout: 4000 }) : window.setTimeout(task, 1500)),
    cancel: (handle) => (idle ? window.cancelIdleCallback(handle as number) : window.clearTimeout(handle as number)),
  };
};

export function prefetchWhenIdle(load: () => Promise<unknown>, environment: IdlePrefetchEnvironment = browserEnvironment()): () => void {
  if (environment.saveData) return () => {};
  const handle = environment.schedule(() => {
    void load().catch(() => {});
  });
  return () => environment.cancel(handle);
}
