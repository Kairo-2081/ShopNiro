import React from 'react';

export type Locale = 'en' | 'bn';
export type MessageKey = keyof typeof import('./messages/en').englishMessages;

type MessageTable = Readonly<Record<MessageKey, string>>;

let englishMessages: MessageTable | undefined;
let englishMessagesRequest: Promise<MessageTable> | undefined;

export function loadEnglishMessages(): Promise<MessageTable> {
  if (englishMessages) return Promise.resolve(englishMessages);
  if (!englishMessagesRequest) {
    englishMessagesRequest = import('./messages/en')
      .then(({ englishMessages: messages }) => {
        englishMessages = messages;
        return messages;
      })
      .catch((error: unknown) => {
        englishMessagesRequest = undefined;
        throw error;
      });
  }
  return englishMessagesRequest;
}

let bengaliMessages: MessageTable | undefined;
let bengaliMessagesRequest: Promise<MessageTable> | undefined;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}


export function loadBengaliMessages(): Promise<MessageTable> {
  if (bengaliMessages) return Promise.resolve(bengaliMessages);
  if (!bengaliMessagesRequest) {
    bengaliMessagesRequest = import('./i18n.bn')
      .then(({ bengaliMessages: messages }) => {
        bengaliMessages = messages;
        return messages;
      })
      .catch((error: unknown) => {
        bengaliMessagesRequest = undefined;
        throw error;
      });
  }
  return bengaliMessagesRequest;
}

export function translateMessage(locale: Locale, key: MessageKey, values?: Record<string, string | number>): string {
  const message = locale === 'bn' ? bengaliMessages?.[key] ?? englishMessages?.[key] ?? key : englishMessages?.[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values?.[name];
    return value === undefined ? placeholder : String(value);
  });
}

const LocaleContext = React.createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
  t: (key, values) => translateMessage('en', key, values),
});

export const LocaleProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocaleState] = React.useState<Locale>(() => {
    const stored = window.localStorage.getItem('shopniro_locale');
    return stored === 'bn' ? 'bn' : 'en';
  });
  const [englishReady, setEnglishReady] = React.useState(Boolean(englishMessages));
  const [bengaliReady, setBengaliReady] = React.useState(Boolean(bengaliMessages));

  const setLocale = React.useCallback((nextLocale: Locale) => {
    window.localStorage.setItem('shopniro_locale', nextLocale);
    setLocaleState(nextLocale);
  }, []);

  React.useEffect(() => {
    if (englishReady) return;
    let active = true;
    loadEnglishMessages()
      .then(() => {
        if (active) setEnglishReady(true);
      })
      .catch((error: unknown) => {
        console.error('Unable to load English translations:', error);
        if (active) setEnglishReady(true);
      });
    return () => {
      active = false;
    };
  }, [englishReady]);

  React.useEffect(() => {
    if (locale !== 'bn' || bengaliReady) return;
    let active = true;
    loadBengaliMessages()
      .then(() => {
        if (active) setBengaliReady(true);
      })
      .catch((error: unknown) => {
        console.error('Unable to load Bangla translations:', error);
        if (active) {
          window.localStorage.setItem('shopniro_locale', 'en');
          setLocaleState('en');
        }
      });
    return () => {
      active = false;
    };
  }, [bengaliReady, locale]);

  React.useEffect(() => {
    document.documentElement.lang = locale === 'bn' ? 'bn' : 'en';
  }, [locale]);

  const value = React.useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key, values) => translateMessage(locale, key, values),
  }), [bengaliReady, englishReady, locale, setLocale]);

  if (!englishReady) {
    return null;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => React.useContext(LocaleContext);
