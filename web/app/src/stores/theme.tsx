import { createContext } from 'preact';
import { useContext, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

type Theme = 'light' | 'dark';

const theme = signal<Theme>('dark');
const resolvedTheme = signal<Theme>('dark');

const ThemeContext = createContext<{
  theme: typeof theme;
  resolvedTheme: typeof resolvedTheme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
} | null>(null);

function applyThemeClass(next: Theme) {
  const html = document.documentElement;
  if (next === 'light') {
    html.classList.add('light');
    html.classList.remove('dark');
  } else {
    html.classList.remove('light');
    html.classList.add('dark');
  }
}

export function ThemeProvider({ children }: { children: preact.ComponentChildren }) {
  useEffect(() => {
    const saved = localStorage.getItem('ql-theme') as Theme | null;
    const next = saved || 'dark';
    theme.value = next;
    resolvedTheme.value = next;
    applyThemeClass(next);
  }, []);

  const toggle = () => {
    const next = theme.value === 'light' ? 'dark' : 'light';
    setTheme(next);
  };

  const setTheme = (next: Theme) => {
    theme.value = next;
    resolvedTheme.value = next;
    localStorage.setItem('ql-theme', next);
    applyThemeClass(next);
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
