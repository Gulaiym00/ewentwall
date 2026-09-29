'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'theme';
const CHANGE_EVENT = 'themechange';

interface ThemeContextValue {
  dark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Runs before hydration to apply the saved theme without a flash.
export const themeInitScript = `try{if(localStorage.getItem('${STORAGE_KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

const getSnapshot = () => document.documentElement.classList.contains('dark');
const getServerSnapshot = () => false;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleDark = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return <ThemeContext.Provider value={{ dark, toggleDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
