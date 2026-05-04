import { formatBytes, formatDate, getFileIconColor } from '../lib/utils';
import type { FileInfo } from '../lib/api';

function FolderIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function FileIconSvg({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function ImageIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

function VideoIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  );
}

function MusicIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  );
}

function PdfIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13h6"/>
      <path d="M9 17h3"/>
    </svg>
  );
}

interface FileIconProps {
  file: FileInfo;
  class?: string;
}

export function FileIcon({ file, class: cls = 'h-5 w-5' }: FileIconProps) {
  if (file.is_dir) {
    return <FolderIcon class={`${cls} text-icon-folder`} />;
  }

  const color = getFileIconColor(file.mime);

  if (file.mime.startsWith('image/')) {
    return <ImageIcon class={`${cls} ${color}`} />;
  }
  if (file.mime.startsWith('video/')) {
    return <VideoIcon class={`${cls} ${color}`} />;
  }
  if (file.mime.startsWith('audio/')) {
    return <MusicIcon class={`${cls} ${color}`} />;
  }
  if (file.mime === 'application/pdf') {
    return <PdfIcon class={`${cls} ${color}`} />;
  }

  return <FileIconSvg class={`${cls} ${color}`} />;
}

interface FileRowProps {
  file: FileInfo;
  selected: boolean;
  onToggle: (name: string) => void;
  onOpen: (file: FileInfo) => void;
  onContextMenu: (e: MouseEvent, file: FileInfo) => void;
}

export function FileRow({ file, selected, onToggle, onOpen, onContextMenu }: FileRowProps) {
  return (
    <li
      class={[
        'group grid cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors',
        'grid-cols-[30px_1fr_44px] sm:grid-cols-[30px_1fr_100px_140px_52px]',
        selected ? 'bg-primary/8 ring-1 ring-inset ring-primary/20' : 'hover:bg-surface-hover',
      ].join(' ')}
      role="listitem"
      aria-selected={selected}
      onClick={() => onOpen(file)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, file); }}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(file.name)}
          class="selection-checkbox"
        />
      </div>

      {/* Name */}
      <div class="flex items-center gap-2.5 min-w-0">
        <FileIcon file={file} />
        <span class="truncate font-medium">{file.name}</span>
      </div>

      {/* Size */}
      <span class="hidden text-right text-xs text-muted-foreground tabular sm:block">
        {file.is_dir ? '—' : formatBytes(file.size)}
      </span>

      {/* Date */}
      <span class="hidden text-right text-xs text-muted-foreground tabular sm:block">
        {formatDate(file.mod_time)}
      </span>

      {/* Actions */}
      <div class="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => onContextMenu(e as any, file)}
          class="icon-button h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          title="More actions"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </li>
  );
}

interface FileCardProps {
  file: FileInfo;
  currentPath: string;
  selected: boolean;
  onToggle: (name: string) => void;
  onOpen: (file: FileInfo) => void;
  onContextMenu: (e: MouseEvent, file: FileInfo) => void;
}

export function FileCard({ file, currentPath, selected, onToggle, onOpen, onContextMenu }: FileCardProps) {
  const isImage = file.mime.startsWith('image/');
  const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;

  return (
    <div
      class={[
        'group relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition-colors',
        selected
          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
      ].join(' ')}
      onClick={() => onOpen(file)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, file); }}
    >
      {/* Checkbox */}
      <div class="absolute left-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(file.name)}
          class="selection-checkbox"
        />
      </div>

      {/* Thumbnail / Icon */}
      <div class="flex aspect-square items-center justify-center rounded-lg bg-muted/50">
        {isImage ? (
          <img
            src={`/api/thumb?path=${encodeURIComponent(filePath)}`}
            alt={file.name}
            class="h-full w-full rounded-lg object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <FileIcon file={file} class="h-10 w-10" />
        )}
      </div>

      {/* Info */}
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">{file.name}</p>
        <p class="text-xs text-muted-foreground tabular">
          {file.is_dir ? 'Folder' : formatBytes(file.size)}
        </p>
      </div>
    </div>
  );
}
