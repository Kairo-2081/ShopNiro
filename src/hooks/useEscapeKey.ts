import React from 'react';
import { createEscapeStack } from './escapeStack';

const stack = typeof document === 'undefined' ? null : createEscapeStack(document);

/** Closes the dialog on Escape. When dialogs are stacked, only the one on top reacts. */
export const useEscapeKey = (onEscape: () => void, isActive = true) => {
  const latest = React.useRef(onEscape);
  latest.current = onEscape;

  React.useEffect(() => {
    if (!isActive || !stack) return;
    return stack.push(() => latest.current());
  }, [isActive]);
};
