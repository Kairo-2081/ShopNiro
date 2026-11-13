import React from 'react';
import { useLocale } from '../lib/i18n';

export const MAIN_CONTENT_ID = 'main-content';

// The first stop for a keyboard or screen-reader user: it jumps past the header and navigation to the page's main
// region. It stays off-screen until it receives focus. The click handler moves focus itself, because a plain #hash
// link would only scroll and leave the next Tab press back in the navigation.
export const SkipLink: React.FC = () => {
  const { t } = useLocale();

  const jumpToMain = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: 'start' });
  };

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={jumpToMain}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[1000] focus:rounded-full focus:bg-surface-900 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#d0c8a5]"
    >
      {t('skipToContent')}
    </a>
  );
};
