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
    <div class="relative flex min-h-screen items-center justify-center px-5 bg-background overflow-hidden">
      {/* Subtle background network art */}
      <div class="absolute inset-0 opacity-20 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 50%, rgba(20, 184, 166, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(20, 184, 166, 0.05) 0%, transparent 50%)',
      }} />
      <svg class="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div class="relative w-full max-w-[420px]" style={{ animation: 'ql-fade-in 0.3s ease-out forwards' }}>
        <div class="p-8 border border-border rounded-xl bg-card">
          {/* Logo & Title */}
          <div class="flex flex-col items-center gap-3 text-center">
            <Logo size={48} class="text-primary" />
            <h1 class="text-2xl font-bold tracking-tight text-foreground">Nodi</h1>
            <p class="text-sm text-foreground-muted">Your files, on your network.</p>
          </div>

          <form onSubmit={handleFormSubmit} class="mt-8 space-y-5">
            {/* Username */}
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="login-username">Username</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                  class="input h-10 pl-10"
                  placeholder="Enter your username"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="login-password">Password</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                  class="input h-10 pl-10 pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground transition-colors border-none bg-transparent cursor-pointer"
                >
                  {showPassword ? (
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  ) : (
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me + forgot */}
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="selection-checkbox" defaultChecked />
                <span class="text-sm text-foreground-muted">Remember me</span>
              </label>
              <button type="button" class="text-sm text-primary hover:underline border-none bg-transparent cursor-pointer">
                Forgot password?
              </button>
            </div>

            {state.value.error && (
              <div class="text-sm text-destructive bg-destructive-soft rounded-md px-3 py-2" style={{ animation: 'ql-slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                {state.value.error}
              </div>
            )}

            <button
              type="submit"
              disabled={state.value.loading}
              class="btn btn-primary w-full h-10 text-sm font-medium"
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

          {/* Divider */}
          <div class="mt-6 flex items-center gap-3">
            <div class="flex-1 h-px bg-border" />
            <span class="text-xs text-foreground-subtle">or</span>
            <div class="flex-1 h-px bg-border" />
          </div>

          {/* LAN access button */}
          <button
            onClick={() => navigate('/')}
            class="btn btn-outline w-full h-10 mt-6 text-sm font-medium"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Continue on this device (LAN)
          </button>
        </div>

        {/* Footer */}
        <p class="mt-6 text-center text-xs text-foreground-subtle">
          Nodi is self-hosted and runs on your local network.
        </p>
        <p class="mt-2 text-center text-xs text-foreground-subtle">
          Made with <span class="text-primary">♥</span>
        </p>
      </div>
    </div>
  );
}
