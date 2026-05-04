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
        setOpen(prev => !prev);
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
      class="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-ql-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        class="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-ql-pop-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Keyboard Shortcuts</h3>
          <button onClick={() => setOpen(false)} class="icon-button h-8 w-8">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} class="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-hover">
              <span class="text-muted-foreground">{s.description}</span>
              <kbd class="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-mono font-semibold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}