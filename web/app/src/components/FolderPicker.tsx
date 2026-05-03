import { useState, useEffect } from 'preact/hooks';
import { Modal } from './Modal';
import { browseAPI } from '../lib/api';
import type { BreadcrumbSegment } from '../lib/api';

function FolderIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function ChevronRightIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
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
          <button onClick={onClose} class="command-button h-9 px-4 text-sm">Cancel</button>
          <button
            onClick={() => onSelect(currentPath)}
            class="command-button primary h-9 px-4 text-sm"
          >
            {actionLabel}
          </button>
        </>
      }
    >
      {/* Breadcrumbs */}
      <div class="mb-3 flex items-center gap-1 text-sm">
        <button
          onClick={() => navigate('')}
          class={['rounded-md px-2 py-1 transition-colors hover:bg-surface-hover', !currentPath ? 'text-primary font-medium' : ''].join(' ')}
        >
          Root
        </button>
        {breadcrumbParts.map((part, i) => {
          const path = breadcrumbParts.slice(0, i + 1).join('/');
          return (
            <span key={i} class="flex items-center">
              <ChevronRightIcon class="h-3.5 w-3.5 text-muted-foreground/60" />
              <button
                onClick={() => navigate(path)}
                class="rounded-md px-2 py-1 transition-colors hover:bg-surface-hover"
              >
                {part}
              </button>
            </span>
          );
        })}
      </div>

      {/* Folder list */}
      <div class="max-h-80 overflow-y-auto rounded-lg border border-border/60">
        {loading ? (
          <div class="flex items-center justify-center py-8 text-muted-foreground">
            <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : folders.length === 0 ? (
          <div class="py-8 text-center text-sm text-muted-foreground">No folders here</div>
        ) : (
          <div class="divide-y divide-border/30">
            {folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => navigate(folder.path)}
                class="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover text-left"
              >
                <FolderIcon class="h-4 w-4 text-icon-folder" />
                <span class="flex-1 truncate">{folder.name}</span>
                <ChevronRightIcon class="h-3.5 w-3.5 text-muted-foreground/60" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected path */}
      <p class="mt-3 text-xs text-muted-foreground">
        Selected: <span class="font-medium text-foreground">{currentPath || 'Root'}</span>
      </p>
    </Modal>
  );
}
