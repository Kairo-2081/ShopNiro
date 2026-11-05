import React from 'react';
import { useLocale } from '../lib/i18n';

interface AppErrorBoundaryState {
  hasError: boolean;
}

const ErrorFallback: React.FC = () => {
  const { t } = useLocale();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center text-surface-900 dark:text-surface-100">
      <h1 className="text-2xl font-bold">{t('pageErrorTitle')}</h1>
      <p className="text-sm text-surface-700 dark:text-surface-300">{t('pageErrorDescription')}</p>
      <button type="button" onClick={() => window.location.reload()} className="premium-button min-h-11 rounded-full px-6 font-bold text-white">
        {t('reloadPage')}
      </button>
    </main>
  );
};

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
      return <ErrorFallback />;
    }

    return this.props.children;
  }
}
