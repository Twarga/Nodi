import { useEffect, useRef } from 'preact/hooks';
import type { FileInfo } from '../lib/api';

interface ContextMenuProps {
  x: number;
  y: number;
  file: FileInfo;
  onClose: () => void;
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDetails: () => void;
  onDelete: () => void;
}

export function ContextMenu({ x, y, file, onClose, onDownload, onRename, onMove, onCopy, onDuplicate, onDetails, onDelete }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuWidth = 180;
  const menuHeight = 280;
  const posX = Math.min(x, window.innerWidth - menuWidth - 8);
  const posY = Math.min(y, window.innerHeight - menuHeight - 8);

  const items = [
    ...(!file.is_dir ? [{ label: 'Download', action: onDownload }] : []),
    { label: 'Rename', action: onRename },
    { label: 'Move to', action: onMove },
    { label: 'Copy to', action: onCopy },
    { label: 'Duplicate', action: onDuplicate },
    { label: 'Details', action: onDetails },
    { label: 'Delete', action: onDelete, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      class="fixed z-[130] min-w-[180px] bg-background border border-border rounded-[var(--radius)] py-1"
      style={{ left: posX, top: posY, animation: 'ql-pop-in 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards', transformOrigin: 'top left' }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          class={[
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors border-none bg-transparent text-left cursor-pointer',
            item.danger ? 'text-destructive hover:bg-destructive-soft' : 'text-foreground hover:bg-surface-hover',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
