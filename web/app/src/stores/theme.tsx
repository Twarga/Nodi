import { createContext } from 'preact';
import { useContext, useEffect } from 'preact/hooks';
import { signal, useSignal } from '@preact/signals';

type Theme = 'light' | 'dark' | 'system';

const theme = signal<Theme>('system');
const resolvedTheme = signal<'light' | 'dark'>('light');

const ThemeContext = createContext<{
  theme: typeof theme;
  resolvedTheme: typeof resolvedTheme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
} | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(t: Theme) {
  const resolved = t === 'system' ? getSystemTheme() : t;
  resolvedTheme.value = resolved;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: preact.ComponentChildren }) {
  useEffect(() => {
    const saved = localStorage.getItem('ql-theme') as Theme | null;
    theme.value = saved || 'system';
    applyTheme(theme.value);

    const listener = (e: MediaQueryListEvent) => {
      if (theme.value === 'system') {
        applyTheme('system');
      }
    };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener);
    return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', listener);
  }, []);

  const setTheme = (t: Theme) => {
    theme.value = t;
    localStorage.setItem('ql-theme', t);
    applyTheme(t);
  };

  const toggle = () => {
    const next = theme.value === 'light' ? 'dark' : theme.value === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
