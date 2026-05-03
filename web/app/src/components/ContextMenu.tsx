import { useEffect, useRef } from 'preact/hooks';
import type { FileInfo } from '../lib/api';

interface MenuItem {
  label: string;
  icon: preact.VNode;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
}

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

function DownloadIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function EditIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function MoveIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="5 9 2 12 5 15"/>
      <polyline points="9 5 12 2 15 5"/>
      <polyline points="15 19 12 22 9 19"/>
      <polyline points="19 9 22 12 19 15"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="12" y1="2" x2="12" y2="22"/>
    </svg>
  );
}

function CopyIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function DuplicateIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function TrashIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

export function ContextMenu({ x, y, file, onClose, onDownload, onRename, onMove, onCopy, onDuplicate, onDelete }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof MouseEvent) {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      } else if (e.key === 'Escape') {
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

  // Keep menu within viewport
  const menuWidth = 200;
  const menuHeight = 300;
  const posX = Math.min(x, window.innerWidth - menuWidth - 16);
  const posY = Math.min(y, window.innerHeight - menuHeight - 16);

  const items: MenuItem[] = [
    ...(!file.is_dir ? [{ label: 'Download', icon: <DownloadIcon class="h-4 w-4" />, action: onDownload }] : []),
    { label: 'Rename', icon: <EditIcon class="h-4 w-4" />, action: onRename },
    { label: 'Move to…', icon: <MoveIcon class="h-4 w-4" />, action: onMove },
    { label: 'Copy to…', icon: <CopyIcon class="h-4 w-4" />, action: onCopy },
    { label: 'Duplicate', icon: <DuplicateIcon class="h-4 w-4" />, action: onDuplicate },
    { label: 'Delete', icon: <TrashIcon class="h-4 w-4" />, action: onDelete, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      class="fixed z-[130] w-52 rounded-xl border border-border/80 bg-surface/95 py-1 shadow-xl backdrop-blur-xl animate-ql-pop-in"
      style={{ left: posX, top: posY }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          class={[
            'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors',
            item.danger
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-foreground hover:bg-surface-hover',
          ].join(' ')}
        >
          <span class="text-muted-foreground">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
