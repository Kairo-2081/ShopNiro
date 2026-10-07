import React from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let lastFocusTargetOutsideDialog: HTMLElement | null = null;

export const rememberFocusTarget = (target: HTMLElement) => {
  lastFocusTargetOutsideDialog = target;
};

export const useFocusTrap = <T extends HTMLElement>(isActive: boolean) => {
  const dialogRef = React.useRef<T>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!isActive || !dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const getFocusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => element.getClientRects().length > 0);
    const focusFirstElement = () => {
      (getFocusableElements()[0] || dialog).focus();
    };
    const frame = window.requestAnimationFrame(focusFirstElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === firstElement || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (document.activeElement === lastElement || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener('keydown', handleKeyDown);
      const previousOutsideTarget = previouslyFocused
        && previouslyFocused !== document.body
        && !dialog.contains(previouslyFocused)
        && previouslyFocused.isConnected
        ? previouslyFocused
        : null;
      const restoreTarget = previousOutsideTarget || lastFocusTargetOutsideDialog;
      if (restoreTarget?.isConnected) restoreTarget.focus();
    };
  }, [isActive]);

  return dialogRef;
};