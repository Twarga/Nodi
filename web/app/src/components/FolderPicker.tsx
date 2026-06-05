import { useState, useEffect } from 'preact/hooks';
import { Modal } from './Modal';
import { browseAPI } from '../lib/api';
import type { BreadcrumbSegment } from '../lib/api';

function FolderIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function ChevronRightIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="9 18 15 12 9 6"/></svg>;
}

interface FolderPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title: string;
  actionLabel: string;
}

export function FolderPicker({ open, onClose, onSelect, title, actionLabel }: FolderPickerProps) {
  const [folders, setFolders] = useState<BreadcrumbSegment[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadFolders('');
      setCurrentPath('');
    }
  }, [open]);

  const loadFolders = async (path: string) => {
    setLoading(true);
    try {
      const data = await browseAPI.list({ path });
      const dirs = data.files.filter(f => f.is_dir);
      setFolders(dirs.map(d => ({ name: d.name, path: path ? `${path}/${d.name}` : d.name })));
    } catch {
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const navigate = (path: string) => {
    setCurrentPath(path);
    loadFolders(path);
  };

  const breadcrumbParts = currentPath.split('/').filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <button onClick={onClose} class="btn btn-outline h-9 px-3 text-sm">Cancel</button>
          <button onClick={() => onSelect(currentPath)} class="btn btn-primary h-9 px-3 text-sm">
            {actionLabel}
          </button>
        </>
      }
    >
      <div class="flex items-center gap-1 text-sm mb-3 flex-wrap">
        <button
          onClick={() => navigate('')}
          class={['inline-block px-1.5 py-1 transition-colors border-none bg-transparent cursor-pointer', !currentPath ? 'text-foreground font-medium' : 'text-foreground-muted hover:text-foreground'].join(' ')}
        >
          Root
        </button>
        {breadcrumbParts.map((part, i) => {
          const path = breadcrumbParts.slice(0, i + 1).join('/');
          return (
            <span key={i} class="flex items-center">
              <ChevronRightIcon class="h-3 w-3 text-foreground-subtle" />
              <button
                onClick={() => navigate(path)}
                class="inline-block px-1.5 py-1 transition-colors text-foreground-muted hover:text-foreground border-none bg-transparent cursor-pointer"
              >
                {part}
              </button>
            </span>
          );
        })}
      </div>

      <div class="max-h-80 overflow-y-auto border border-border rounded-[var(--radius)]">
        {loading ? (
          <div class="flex items-center justify-center py-8 text-foreground-muted">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : folders.length === 0 ? (
          <div class="py-8 text-center text-sm text-foreground-muted">No folders here</div>
        ) : (
          <div class="divide-y divide-border">
            {folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => navigate(folder.path)}
                class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-hover text-left transition-colors border-none bg-transparent cursor-pointer"
              >
                <FolderIcon class="h-3.5 w-3.5 text-icon-folder" />
                <span class="flex-1 truncate">{folder.name}</span>
                <ChevronRightIcon class="h-3 w-3 text-foreground-subtle" />
              </button>
            ))}
          </div>
        )}
      </div>

      <p class="mt-3 text-xs text-foreground-muted">
        Selected: <span class="text-foreground">{currentPath || 'Root'}</span>
      </p>
    </Modal>
  );
}
