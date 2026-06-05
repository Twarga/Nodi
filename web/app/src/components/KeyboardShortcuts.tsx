import { useEffect, useState } from 'preact/hooks';

interface Shortcut {
  key: string;
  description: string;
}

const shortcuts: Shortcut[] = [
  { key: 'Esc', description: 'Clear selection / close modal' },
  { key: 'Ctrl + A', description: 'Select all files' },
  { key: 'Enter', description: 'Open selected file or folder' },
  { key: 'Delete', description: 'Delete selected items' },
  { key: 'Shift + Click', description: 'Select range of files' },
  { key: '?', description: 'Show this help' },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isInput) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!open) return null;

  return (
    <div
      class="fixed inset-0 z-[150] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4"
      style={{ animation: 'ql-fade-in 0.15s ease-out forwards' }}
      onClick={() => setOpen(false)}
    >
      <div
        class="w-full max-w-sm bg-background border border-border rounded-[var(--radius)] p-5"
        style={{ animation: 'ql-pop-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-medium tracking-tight">Keyboard shortcuts</h3>
          <button onClick={() => setOpen(false)} class="icon-button h-7 w-7" aria-label="Close">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="divide-y divide-border">
          {shortcuts.map((s) => (
            <div key={s.key} class="flex items-center justify-between py-2.5 text-sm">
              <span class="text-foreground-muted">{s.description}</span>
              <kbd class="font-mono text-xs px-1.5 py-0.5 border border-border rounded-[var(--radius)] text-foreground">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
