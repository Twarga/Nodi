import { useState } from 'preact/hooks';
import { useAuth } from '../stores/auth';
import { navigate } from '../lib/router';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { login, state } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    <div class="flex min-h-screen items-center justify-center px-5 bg-background">
      <div class="w-full max-w-[360px]">
        {/* Header */}
        <div class="flex flex-col items-center gap-3 text-center mb-8">
          <Logo size={40} class="text-primary" />
          <h1 class="text-xl font-semibold tracking-tight text-foreground">Nodi</h1>
          <p class="text-sm text-foreground-muted">Your files, on your network.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} class="space-y-4">
          {/* Username */}
          <div>
            <label class="block text-sm font-medium text-foreground mb-1.5" for="login-username">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              class="input h-10 w-full"
              placeholder="Enter your username"
              required
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div>
            <label class="block text-sm font-medium text-foreground mb-1.5" for="login-password">
              Password
            </label>
            <div class="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                class="input h-10 w-full pr-10"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground transition-colors border-none bg-transparent cursor-pointer p-0"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {state.value.error && (
            <div class="text-sm text-destructive border border-destructive/20 bg-destructive-soft rounded-md px-3 py-2.5" style={{ animation: 'ql-slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              {state.value.error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={state.value.loading}
            class="btn btn-primary w-full h-10 text-sm font-medium"
          >
            {state.value.loading ? (
              <span class="flex items-center justify-center gap-2">
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Footer */}
        <p class="mt-8 text-center text-xs text-foreground-subtle leading-relaxed">
          Nodi is self-hosted and runs on your local network.
        </p>
      </div>
    </div>
  );
}
