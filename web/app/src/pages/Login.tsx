import { useState } from 'preact/hooks';
import { useAuth } from '../stores/auth';
import { navigate } from '../lib/router';

export function LoginPage() {
  const { login, state } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const ok = await login(username, password);
    if (ok) {
      navigate('/');
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm rounded-2xl border border-border/80 bg-surface/90 p-8 shadow-xl backdrop-blur-xl">
        <div class="mb-8 flex items-center justify-center gap-3">
          <div class="brand-mark grid h-12 w-12 place-items-center rounded-xl border border-primary/25 bg-primary/10 shadow-sm">
            <svg class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 class="text-2xl font-bold tracking-tight">Nodi</h1>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium">Username</label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Enter password"
              required
            />
          </div>

          {state.value.error && (
            <div class="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.value.error}
            </div>
          )}

          <button
            type="submit"
            disabled={state.value.loading}
            class="command-button primary h-10 w-full justify-center"
          >
            {state.value.loading ? (
              <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
