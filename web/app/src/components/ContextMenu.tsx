import { useEffect, useRef } from 'preact/hooks';
import { ctxState, closeCtx } from '../stores/ui';
import type { FileInfo } from '../lib/api';

interface ContextMenuProps {
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ContextMenu({ onDownload, onRename, onMove, onCopy, onDuplicate, onDelete }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') closeCtx();
        return;
      }
      if (ctxState.value.open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeCtx();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handler);
    };
  }, []);

  const ctx = ctxState.value;
  const visible = ctx.open && ctx.file;

  const menuWidth = 200;
  const menuHeight = 300;
  const posX = visible ? Math.min(ctx.x, window.innerWidth - menuWidth - 8) : 0;
  const posY = visible ? Math.min(ctx.y, window.innerHeight - menuHeight - 8) : 0;

  const items = visible ? [
    ...(!ctx.file!.is_dir ? [{ label: 'Download', action: onDownload }] : []),
    { label: 'Rename', action: onRename },
    { label: 'Move to', action: onMove },
    { label: 'Copy to', action: onCopy },
    { label: 'Duplicate', action: onDuplicate },
    { label: 'Delete', action: onDelete, danger: true },
  ] : [];

  return (
    <div
      ref={menuRef}
      class={[
        'fixed z-[130] min-w-[200px] rounded-xl glass py-1.5 shadow-2xl',
        'transition-opacity duration-150',
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      ].join(' ')}
      style={{ left: posX, top: posY }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); closeCtx(); }}
          class={[
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 mx-1.5',
            'w-[calc(100%-12px)]',
            item.danger
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-foreground hover:bg-surface-hover/80',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
