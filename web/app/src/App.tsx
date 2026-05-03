import { useAuth } from './stores/auth';

export function App() {
  const { user } = useAuth();

  if (!user) {
    // Auth gate: the Go backend will redirect to /login on 401,
    // but this component handles the SPA shell state.
    return <div class="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div class="flex h-screen flex-col">
      <header class="app-header flex items-center px-4 border-b border-border/80 bg-surface/90 backdrop-blur-xl shadow-sm sticky top-0 z-30 h-16">
        <div class="brand-mark grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/10 shadow-sm mr-3">
          <svg class="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <h1 class="text-lg font-bold">Nodi</h1>
      </header>
      <main class="flex-1 overflow-auto app-main mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
        <div class="rounded-xl border border-border/90 bg-surface/95 shadow-sm backdrop-blur p-8 text-center">
          <p class="text-muted-foreground">Nodi frontend is loading...</p>
          <p class="text-xs text-muted-foreground mt-2">Preact + Vite + Tailwind v4</p>
        </div>
      </main>
    </div>
  );
}
