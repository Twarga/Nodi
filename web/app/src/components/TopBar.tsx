import { useState, useRef, useEffect } from 'preact/hooks';
import { useAuth } from '../stores/auth';
import { useTheme } from '../stores/theme';
import { toggleSidebar } from '../stores/app';

export function TopBar() {
  const { state, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  const themeLabel = theme.value === 'system' ? 'System' : theme.value === 'dark' ? 'Dark' : 'Light';

  return (
    <header class="app-header flex items-center justify-between px-4">
      <div class="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={toggleSidebar}
          class="icon-button lg:hidden"
          title="Toggle sidebar"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div class="brand-mark grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/10 shadow-sm">
          <svg class="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h1 class="text-lg font-bold">Nodi</h1>
      </div>

      <div class="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          class="icon-button"
          title={`Theme: ${themeLabel}`}
        >
          {theme.value === 'dark' ? (
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          )}
        </button>

        {/* User dropdown */}
        <div class="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            class="avatar-button"
            title="Account"
          >
            {state.value.user?.initials}
          </button>

          {dropdownOpen && (
            <div class="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border/80 bg-surface/95 shadow-xl backdrop-blur-xl animate-ql-pop-in overflow-hidden">
              <div class="border-b border-border/50 px-4 py-3">
                <p class="text-sm font-medium">Signed in as</p>
                <p class="text-sm text-muted-foreground">{state.value.user?.name}</p>
              </div>
              <div class="p-1">
                <button
                  onClick={handleLogout}
                  class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
