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
  onDelete: () => void;
}

export function ContextMenu({ x, y, file, onClose, onDownload, onRename, onMove, onCopy, onDuplicate, onDelete }: ContextMenuProps) {
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
  }, [onClose]);

  // Position within viewport
  const menuWidth = 200;
  const menuHeight = 300;
  const posX = Math.min(x, window.innerWidth - menuWidth - 8);
  const posY = Math.min(y, window.innerHeight - menuHeight - 8);

  const items = [
    ...(!file.is_dir ? [{ label: 'Download', action: onDownload }] : []),
    { label: 'Rename', action: onRename },
    { label: 'Move to', action: onMove },
    { label: 'Copy to', action: onCopy },
    { label: 'Duplicate', action: onDuplicate },
    { label: 'Delete', action: onDelete, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      class="fixed z-[130] min-w-[200px] rounded-xl glass py-1.5 shadow-2xl animate-ql-pop-in"
      style={{ left: posX, top: posY }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          class={[
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 mx-1.5',
            'w-[calc(100%-12px)]',
            item.danger
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-foreground hover:bg-surface-hover/80 hover:scale-[1.01]',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}