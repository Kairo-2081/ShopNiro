type Handler = () => void;

/**
 * Keeps a stack of "close me" handlers so that Escape only closes the topmost dialog.
 * It listens on an EventTarget so it can be tested without a browser.
 */
export const createEscapeStack = (target: EventTarget) => {
  const handlers: Handler[] = [];
  let listening = false;

  const onKeyDown = (event: Event) => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    const top = handlers[handlers.length - 1];
    if (!top) return;
    event.stopPropagation();
    top();
  };

  const sync = () => {
    if (handlers.length > 0 && !listening) {
      target.addEventListener('keydown', onKeyDown);
      listening = true;
    } else if (handlers.length === 0 && listening) {
      target.removeEventListener('keydown', onKeyDown);
      listening = false;
    }
  };

  return {
    push(handler: Handler) {
      handlers.push(handler);
      sync();
      return () => {
        const index = handlers.lastIndexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
        sync();
      };
    },
    get size() {
      return handlers.length;
    },
  };
};
