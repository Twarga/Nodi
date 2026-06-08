import { createContext } from 'preact';
import { useContext, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

type Theme = 'light' | 'dark' | 'system';

const theme = signal<Theme>('system');
const resolvedTheme = signal<Theme>('light');

const ThemeContext = createContext<{
  theme: typeof theme;
  resolvedTheme: typeof resolvedTheme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
} | null>(null);

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyThemeClass(next: Theme) {
  const html = document.documentElement;
  const resolved = next === 'system' ? resolveSystemTheme() : next;
  resolvedTheme.value = resolved;
  if (resolved === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: preact.ComponentChildren }) {
  useEffect(() => {
    const saved = localStorage.getItem('ql-theme') as Theme | null;
    const next = saved || 'system';
    theme.value = next;
    applyThemeClass(next);

    // Listen for system theme changes when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme.value === 'system') {
        applyThemeClass('system');
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
    } else if (mq.addListener) {
      mq.addListener(onChange);
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', onChange);
      } else if (mq.removeListener) {
        mq.removeListener(onChange);
      }
    };
  }, []);

  const toggle = () => {
    const next = resolvedTheme.value === 'light' ? 'dark' : 'light';
    setTheme(next);
  };

  const setTheme = (next: Theme) => {
    theme.value = next;
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
