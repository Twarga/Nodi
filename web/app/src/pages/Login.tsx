import { useState } from 'preact/hooks';
import { useAuth } from '../stores/auth';
import { navigate } from '../lib/router';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { login, state } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    const ok = await login(username, password);
    if (ok) {
      navigate('/');
    }
  };

  const handleFormSubmit = (e: Event) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div class="flex min-h-screen items-center justify-center px-4 bg-background">
      <div class="w-full max-w-sm animate-ql-pop-in">
        {/* Brand */}
        <div class="mb-8 flex flex-col items-center gap-3">
          <Logo size={56} class="drop-shadow-md" />
          <div class="text-center">
            <h1 class="text-xl font-bold tracking-tight text-foreground">Nodi</h1>
            <p class="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
          </div>
        </div>

        {/* Card */}
        <div class="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <form onSubmit={handleFormSubmit} class="space-y-4">
            <div>
              <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Username
              </label>
              <input
                type="text"
                value={username}
                onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <input
                type="password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                placeholder="Enter password"
                required
              />
            </div>

            {state.value.error && (
              <div class="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-ql-slide-up">
                {state.value.error}
              </div>
            )}

            <button
              type="submit"
              disabled={state.value.loading}
              class="command-button primary h-10 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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

        <p class="mt-4 text-center text-xs text-muted-foreground/60">
          Nodi · Self-hosted file manager
        </p>
      </div>
    </div>
  );
}