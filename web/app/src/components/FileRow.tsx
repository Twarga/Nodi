import { formatBytes, formatDate, getFileIconColor } from '../lib/utils';
import type { FileInfo } from '../lib/api';

function FolderIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function FileIconSvg({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
function ImageIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function VideoIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="20" rx="1"/><polygon points="10 8 16 12 10 16 10 8"/></svg>;
}
function MusicIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
}
function PdfIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
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
  if (file.mime.startsWith('image/')) return <ImageIcon class={`${cls} ${color}`} />;
  if (file.mime.startsWith('video/')) return <VideoIcon class={`${cls} ${color}`} />;
  if (file.mime.startsWith('audio/')) return <MusicIcon class={`${cls} ${color}`} />;
  if (file.mime === 'application/pdf') return <PdfIcon class={`${cls} ${color}`} />;
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
        'group grid items-center gap-2 py-3 text-sm cursor-pointer transition-colors border-b border-border last:border-0',
        'grid-cols-[36px_1fr_44px] sm:grid-cols-[36px_1fr_100px_140px_44px]',
        selected ? 'bg-primary-soft' : 'hover:bg-surface-hover',
      ].join(' ')}
      role="listitem"
      aria-selected={selected}
      onClick={() => onOpen(file)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, file); }}
    >
      <div onClick={(e) => e.stopPropagation()} class="pl-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(file.name)}
          class="selection-checkbox"
          aria-label={`Select ${file.name}`}
        />
      </div>

      <div class="flex items-center gap-3 min-w-0">
        <span class="shrink-0">
          <FileIcon file={file} />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-foreground">{file.name}</span>
          {file.parentPath && <span class="block truncate text-xs text-foreground-subtle">{file.parentPath}</span>}
        </span>
      </div>

      <span class="hidden text-right text-xs text-foreground-muted tabular sm:block">
        {file.is_dir ? '—' : formatBytes(file.size)}
      </span>

      <span class="hidden text-right text-xs text-foreground-muted tabular sm:block">
        {formatDate(file.mod_time)}
      </span>

      <div class="flex justify-end pr-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => onContextMenu(e as any, file)}
          class="icon-button h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          title="More actions"
          aria-label="More actions"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
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
  const filePath = file.path || (currentPath ? `${currentPath}/${file.name}` : file.name);

  return (
    <div
      class={[
        'group relative flex cursor-pointer flex-col gap-2 p-3 rounded-lg transition-colors border border-border',
        selected ? 'bg-primary-soft border-primary/30' : 'hover:bg-surface-hover hover:border-border-strong',
      ].join(' ')}
      onClick={() => onOpen(file)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, file); }}
    >
      <div class="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(file.name)}
          class="selection-checkbox"
          aria-label={`Select ${file.name}`}
        />
      </div>

      <div class="flex aspect-square items-center justify-center bg-surface rounded-md overflow-hidden">
        {isImage ? (
          <img
            src={`/api/thumb?path=${encodeURIComponent(filePath)}`}
            alt={file.name}
            class="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <FileIcon file={file} class="h-10 w-10" />
        )}
      </div>

      <div class="min-w-0">
        <p class="truncate text-sm text-foreground">{file.name}</p>
        <p class="text-xs text-foreground-muted tabular">
          {file.is_dir ? 'Folder' : formatBytes(file.size)}
        </p>
      </div>
    </div>
  );
}
