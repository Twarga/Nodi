import { formatBytes, formatDate } from '../lib/utils';
import type { FileInfo } from '../lib/api';

interface MetadataSidebarProps {
  file: FileInfo | null;
  path: string;
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  onOpenLocation: () => void;
  onCopyPath: () => void;
  onCalculateHash: () => void;
  hashValue?: string;
  hashLoading?: boolean;
  hashError?: string;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p class="eyebrow">{label}</p>
      <p class={['mt-1.5 text-sm truncate', mono ? 'font-mono text-xs' : 'text-foreground'].join(' ')} title={value}>{value}</p>
    </div>
  );
}

export function MetadataSidebar({ file, path, onClose, onDownload, onShare, onOpenLocation, onCopyPath, onCalculateHash, hashValue, hashLoading, hashError }: MetadataSidebarProps) {
  if (!file) return null;

  return (
    <aside
      class="fixed inset-y-0 right-0 z-[125] flex w-full max-w-md flex-col bg-background border-l border-border sm:top-0"
      style={{ animation: 'ql-slide-in-right 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
    >
      <div class="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
        <div class="min-w-0 flex-1">
          <p class="eyebrow">Details</p>
          <h2 class="mt-2 text-xl font-semibold tracking-tight text-foreground truncate">{file.name}</h2>
          <p class="mt-1 text-sm text-foreground-muted">{file.is_dir ? 'Folder' : file.mime || 'Unknown file'}</p>
        </div>
        <button onClick={onClose} class="icon-button h-8 w-8" title="Close details" aria-label="Close details">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="flex-1 space-y-7 overflow-y-auto px-6 py-6">
        <div class="grid grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Size" value={file.is_dir ? 'Folder' : formatBytes(file.size)} />
          <Field label="Modified" value={formatDate(file.mod_time)} />
          <Field label="Type" value={file.is_dir ? 'Folder' : file.ext || 'File'} />
          <Field label="MIME" value={file.is_dir ? 'inode/directory' : file.mime || 'Unknown'} mono />
        </div>

        <div>
          <p class="eyebrow">Full path</p>
          <p class="mt-1.5 break-all font-mono text-xs text-foreground-muted">{path || '/'}</p>
        </div>

        {file.parentPath && (
          <div>
            <p class="eyebrow">Parent folder</p>
            <p class="mt-1.5 break-all font-mono text-xs text-foreground-muted">{file.parentPath}</p>
          </div>
        )}

        {!file.is_dir && (
          <div>
            <div class="flex items-center justify-between">
              <p class="eyebrow">SHA-256</p>
              <button onClick={onCalculateHash} disabled={hashLoading} class="btn btn-outline h-7 px-2.5 text-xs">
                {hashLoading ? 'Calculating…' : hashValue ? 'Recalculate' : 'Calculate'}
              </button>
            </div>
            {hashValue && <p class="mt-2 break-all font-mono text-xs leading-5 text-foreground">{hashValue}</p>}
            {hashError && <p class="mt-2 text-xs text-destructive">{hashError}</p>}
            {!hashValue && !hashError && <p class="mt-2 text-xs text-foreground-subtle">Calculate only when needed. Large files may take a while.</p>}
          </div>
        )}
      </div>

      <div class="grid grid-cols-2 gap-2 px-6 py-4 border-t border-border">
        <button onClick={onDownload} class="btn btn-primary h-9 px-3 text-sm">Download</button>
        <button onClick={onShare} class="btn btn-outline h-9 px-3 text-sm">Share</button>
        <button onClick={onOpenLocation} class="btn btn-outline h-9 px-3 text-sm">Open location</button>
        <button onClick={onCopyPath} class="btn btn-outline h-9 px-3 text-sm">Copy path</button>
      </div>
    </aside>
  );
}
