import { useAuth } from '../stores/auth';

export function DashboardPage() {
  const { state, logout } = useAuth();

  return (
    <div class="flex h-screen flex-col">
      {/* Header */}
      <header class="app-header flex items-center justify-between px-4">
        <div class="flex items-center gap-3">
          <div class="brand-mark grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/10 shadow-sm">
            <svg class="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 class="text-lg font-bold">Nodi</h1>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick={logout}
            class="icon-button"
            title="Sign out"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
          {state.value.user && (
            <div class="avatar-button">
              {state.value.user.initials}
            </div>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div class="flex flex-1 overflow-hidden">
        {/* Sidebar placeholder */}
        <aside class="hidden w-64 flex-shrink-0 border-r border-border/80 bg-surface/50 lg:block">
          <nav class="p-3">
            <div class="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Nav
            </div>
            <a href="/" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground bg-primary/10">
              <svg class="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Home
            </a>
          </nav>
        </aside>

        {/* Main content */}
        <main class="flex-1 overflow-auto app-main">
          <div class="rounded-xl border border-border/90 bg-surface/95 shadow-sm backdrop-blur p-8 text-center">
            <p class="text-muted-foreground">Dashboard is coming soon...</p>
            <p class="text-xs text-muted-foreground mt-2">
              Signed in as <strong>{state.value.user?.name}</strong>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
