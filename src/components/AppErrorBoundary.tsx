import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center text-surface-900 dark:text-surface-100">
          <h1 className="text-2xl font-bold">This page could not be displayed</h1>
          <p className="text-sm text-surface-700 dark:text-surface-300">Reload the page to try again. Your account and orders are unchanged.</p>
          <button type="button" onClick={() => window.location.reload()} className="premium-button min-h-11 rounded-full px-6 font-bold text-white">
            Reload page
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
