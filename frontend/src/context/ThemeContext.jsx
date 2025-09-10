import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: (_t) => {},
  toggleTheme: () => {},
});

const THEME_STORAGE_KEY = 'theme';

function getSystemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyThemeClass(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement; // html element
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // initialize from localStorage or system preference
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {
      // ignore
    }
    return getSystemPrefersDark() ? 'dark' : 'light';
  });

  // Apply and persist theme as soon as layout is calculated to avoid FOUC
  useLayoutEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  // Listen to system changes only if user hasn't explicitly chosen?
  // For simplicity, we'll update if user uses 'system' in future; now we stick to explicit choice.

  const setTheme = (t) => setThemeState(t === 'dark' ? 'dark' : 'light');
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
