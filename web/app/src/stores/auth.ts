import { signal, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

interface User {
  name: string;
  initials: string;
}

const user = signal<User | null>(null);
const loading = signal(true);

export function useAuth() {
  useEffect(() => {
    fetch('/api/whoami')
      .then((res) => {
        if (res.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!res.ok) throw new Error('Failed to load user');
        return res.json();
      })
      .then((data) => {
        if (data) user.value = data;
      })
      .catch(() => {
        window.location.href = '/login';
      })
      .finally(() => {
        loading.value = false;
      });
  }, []);

  return { user, loading };
}

export { user, loading };
