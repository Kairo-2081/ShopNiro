import React from 'react';
import { RotateCcw, WifiOff } from 'lucide-react';
import { API_FAILURE_EVENT, type ApiFailureEventDetail } from '../lib/api';

export const NetworkStatusBanner: React.FC = () => {
  const [isOffline, setIsOffline] = React.useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine
  );
  const [apiFailure, setApiFailure] = React.useState<ApiFailureEventDetail | null>(null);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setApiFailure(null);
    };
    const handleOffline = () => setIsOffline(true);
    const handleApiFailure = (event: Event) => {
      setApiFailure((event as CustomEvent<ApiFailureEventDetail>).detail);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(API_FAILURE_EVENT, handleApiFailure);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(API_FAILURE_EVENT, handleApiFailure);
    };
  }, []);

  if (!isOffline && !apiFailure) return null;

  const message = isOffline
    ? 'You are offline. Some ShopNiro features may be unavailable until your connection returns.'
    : apiFailure?.message || 'ShopNiro could not load this information.';

  return (
    <div role="alert" className="relative z-[90] border-b border-danger-300 bg-danger-50 px-4 py-3 text-danger-900 dark:border-danger-900 dark:bg-danger-950/70 dark:text-danger-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2 text-sm">
          <WifiOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p>{message}</p>
            {apiFailure?.requestId && (
              <p className="mt-1 text-xs">
                Reference ID: <code className="font-mono font-semibold">{apiFailure.requestId}</code>
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-danger-800 px-4 text-sm font-bold text-white hover:bg-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2 dark:bg-danger-200 dark:text-danger-950 dark:hover:bg-danger-100"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
};
