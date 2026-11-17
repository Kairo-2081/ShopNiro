import React from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'marketpulse_theme';

/** What a first-time visitor sees. A saved choice always wins over it. */
export const DEFAULT_THEME: Theme = 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({ theme: DEFAULT_THEME, toggleTheme: () => undefined });

function readStoredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be blocked; fall back to the default.
  }
  return DEFAULT_THEME;
}

/**
 * One theme for the whole page. It lives above both the app and the standalone policy pages, so the choice made in the
 * header of one is the choice every other screen shows.
 */
export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [theme, setTheme] = React.useState<Theme>(readStoredTheme);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not being able to remember the choice must not break the page.
    }
  }, [theme]);

  const toggleTheme = React.useCallback(() => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark')), []);
  const value = React.useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => React.useContext(ThemeContext);
