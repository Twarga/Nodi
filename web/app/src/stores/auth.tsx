import { createContext } from 'preact';
import { useContext, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

export interface User {
  name: string;
  initials: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const authState = signal<AuthState>({ user: null, loading: true, error: null });

const AuthContext = createContext<{
  state: typeof authState;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: preact.ComponentChildren }) {
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/whoami', { credentials: 'same-origin' });
      if (res.status === 401) {
        authState.value = { user: null, loading: false, error: null };
        return;
      }
      if (!res.ok) throw new Error('Auth check failed');
      const data = await res.json();
      authState.value = { user: data, loading: false, error: null };
    } catch {
      authState.value = { user: null, loading: false, error: null };
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    authState.value = { ...authState.value, loading: true, error: null };
    try {
      const csrfMatch = document.cookie.match(/ql_csrf=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';

      const res = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
        credentials: 'same-origin',
      });

      if (res.ok) {
        const userRes = await fetch('/api/whoami', { credentials: 'same-origin' });
        if (userRes.ok) {
          const data = await userRes.json();
          authState.value = { user: data, loading: false, error: null };
          return true;
        }
      }

      if (res.status === 429) {
        authState.value = { user: null, loading: false, error: 'Too many attempts. Please wait 15 minutes.' };
      } else {
        authState.value = { user: null, loading: false, error: 'Invalid username or password' };
      }
      return false;
    } catch {
      authState.value = { user: null, loading: false, error: 'Network error. Please try again.' };
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      authState.value = { user: null, loading: false, error: null };
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ state: authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}