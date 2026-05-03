import { useState, useEffect } from 'preact/hooks';
import { appState, setPath, toggleSidebar } from '../stores/app';
import { browseAPI } from '../lib/api';
import type { BreadcrumbSegment } from '../lib/api';

function HomeIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function FolderIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function StarIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function XIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function Sidebar() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const state = appState.value;

  useEffect(() => {
    fetch('/api/favorite', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFavorites(data || []))
      .catch(() => setFavorites([]));
  }, []);

  const navigateTo = async (path: string) => {
    const data = await browseAPI.list({ path });
    setPath(path, data.path);
    if (window.innerWidth < 1024) toggleSidebar();
  };

  const isActive = (path: string) => state.currentPath === path;

  return (
    <>
      {/* Mobile overlay */}
      {state.sidebarOpen && (
        <div
          class="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        class={[
          'fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 border-r border-border/80 bg-surface/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0',
          state.sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div class="flex h-16 items-center justify-between border-b border-border/50 px-4 lg:hidden">
          <span class="text-sm font-semibold">Navigation</span>
          <button onClick={toggleSidebar} class="icon-button h-8 w-8">
            <XIcon class="h-4 w-4" />
          </button>
        </div>

        <nav class="space-y-6 p-3">
          {/* Quick Nav */}
          <div>
            <div class="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Nav
            </div>
            <button
              onClick={() => navigateTo('')}
              class={[
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive('')
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-surface-hover',
              ].join(' ')}
            >
              <HomeIcon class={['h-4 w-4', isActive('') ? 'text-primary' : 'text-muted-foreground'].join(' ')} />
              Home
            </button>
          </div>

          {/* Favorites */}
          {favorites.length > 0 && (
            <div>
              <div class="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Favorites
              </div>
              <div class="space-y-0.5">
                {favorites.map((fav) => (
                  <button
                    key={fav}
                    onClick={() => navigateTo(fav)}
                    class={[
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive(fav)
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-surface-hover',
                    ].join(' ')}
                    title={fav}
                  >
                    <StarIcon class={['h-4 w-4 shrink-0', isActive(fav) ? 'text-primary' : 'text-muted-foreground'].join(' ')} />
                    <span class="truncate">{fav.split('/').pop() || fav}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
