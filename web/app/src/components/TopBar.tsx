import { useState, useRef, useEffect } from 'preact/hooks';
import { useAuth } from '../stores/auth';
import { useTheme } from '../stores/theme';
import { Logo } from './Logo';
import { currentRoute, navigate } from '../lib/router';

interface NavItem { id: string; label: string; path: string; icon: preact.ComponentChildren; }

const navItems: NavItem[] = [
  {
    id: 'files', label: 'Files', path: '/files',
    icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    id: 'send', label: 'Send', path: '/send',
    icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  },
  {
    id: 'share', label: 'Shares', path: '/share',
    icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  },
  {
    id: 'devices', label: 'Devices', path: '/devices',
    icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  },
];

function SunIcon() {
  return <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>;
}
function MoonIcon() {
  return <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
function ChevronDownIcon() {
  return <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="6 9 12 15 18 9"/></svg>;
}

export function TopBar() {
  const { state, logout } = useAuth();
  const { resolvedTheme, toggle } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const route = currentRoute.value;

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

  return (
    <header class="app-header">
      <div class="flex items-center gap-5">
        <button
          onClick={() => navigate('/')}
          class="flex items-center gap-2 border-none bg-transparent cursor-pointer p-0"
          title="Nodi"
        >
          <Logo size={24} class="text-primary" />
          <span class="text-sm font-semibold tracking-tight hidden sm:inline text-foreground">Nodi</span>
        </button>

        <nav class="hidden items-center gap-0.5 sm:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              class={[
                'flex items-center gap-2 h-8 px-3 text-sm font-medium rounded-md transition-colors border-none bg-transparent cursor-pointer',
                route === item.id
                  ? 'text-primary'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
              ].join(' ')}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div class="flex items-center gap-2">
        {/* Global Search */}
        <div class="hidden md:flex items-center gap-2 h-9 px-3 rounded-md bg-surface border border-border text-foreground-muted text-sm cursor-pointer hover:border-border-strong transition-colors"
          onClick={() => navigate('/files')}
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span class="text-xs">Search files...</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-border">Ctrl K</span>
        </div>

        <button onClick={toggle} class="icon-button" title="Toggle theme" aria-label="Toggle theme">
          {resolvedTheme.value === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <div class="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            class="flex items-center gap-1.5 border-none bg-transparent cursor-pointer p-0"
            title="Account"
            aria-label="Account menu"
          >
            <span class="avatar-button">{state.value.user?.initials}</span>
            <ChevronDownIcon />
          </button>

          {dropdownOpen && (
            <div
              class="absolute right-0 top-full z-50 mt-2 w-52 bg-popover border border-border rounded-lg overflow-hidden"
              style={{ animation: 'ql-pop-in 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards', transformOrigin: 'top right' }}
            >
              <div class="px-3 py-2.5 border-b border-border">
                <p class="text-xs text-foreground-subtle">Signed in as</p>
                <p class="mt-0.5 text-sm font-medium truncate text-foreground">{state.value.user?.name}</p>
              </div>
              <div class="py-1">
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                  class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors border-none bg-transparent cursor-pointer"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15 1.65 1.65 0 0 0 3 13.51V13a2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 6.6 9.09a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H12a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V12a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </button>
              </div>
              <div class="border-t border-border py-1">
                <button
                  onClick={handleLogout}
                  class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left text-destructive hover:bg-destructive-soft transition-colors border-none bg-transparent cursor-pointer"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
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
