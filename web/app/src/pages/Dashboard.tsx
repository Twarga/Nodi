import { useEffect, useRef } from 'preact/hooks';
import { appState, setPath, setFiles, setLoading, clearSelection, selectAll } from '../stores/app';
import { browseAPI } from '../lib/api';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { WorkspaceBar } from '../components/WorkspaceBar';
import { FileList } from '../components/FileList';
import { FileGrid } from '../components/FileGrid';
import { SelectionBar } from '../components/SelectionBar';
import type { FileInfo } from '../lib/api';

function FolderOpenIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function UploadCloudIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

export function DashboardPage() {
  const state = appState.value;
  const lastClicked = useRef(-1);

  // Load files when path/sort/hidden changes
  useEffect(() => {
    loadFiles(state.currentPath);
  }, [state.currentPath, state.sortBy, state.sortOrder, state.showHidden]);

  // Reload when search query changes (debounced in real app)
  useEffect(() => {
    if (state.searchQuery) {
      loadFiles(state.currentPath);
    }
  }, [state.searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const names = state.files.map(f => f.name);
        if (names.length > 0) {
          selectAll(names);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.files.length]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const data = await browseAPI.list({
        path,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      });
      let files = data.files;
      if (!state.showHidden) {
        files = files.filter(f => !f.name.startsWith('.'));
      }
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        files = files.filter(f => f.name.toLowerCase().includes(q));
      }
      setPath(path, data.path);
      setFiles(files);
    } catch {
      setFiles([]);
    }
  };

  const handleOpen = async (file: FileInfo) => {
    if (file.is_dir) {
      const newPath = state.currentPath
        ? `${state.currentPath}/${file.name}`
        : file.name;
      const data = await browseAPI.list({ path: newPath });
      setPath(newPath, data.path);
      setFiles(data.files);
    } else {
      // Preview file (TD-20-23)
      window.open(`/api/download?path=${encodeURIComponent(
        state.currentPath ? `${state.currentPath}/${file.name}` : file.name
      )}`, '_blank');
    }
  };

  const handleContextMenu = (e: MouseEvent, file: FileInfo) => {
    // TD-17: Context menu
    // For now, just log - will be replaced with proper context menu
    console.log('Context menu for', file.name, 'at', e.clientX, e.clientY);
  };

  return (
    <div class="flex h-screen flex-col">
      <TopBar />

      <div class="flex flex-1 overflow-hidden">
        <Sidebar />

        <main class="flex-1 overflow-auto app-main">
          <Breadcrumbs />

          <div class="mt-4">
            <WorkspaceBar />
          </div>

          <div class="mt-4">
            <SelectionBar />
          </div>

          <div class="mt-4">
            {state.isLoading ? (
              <div class="flex min-h-[200px] items-center justify-center">
                <svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
            ) : state.files.length === 0 ? (
              <div class="empty-state">
                <div class="mb-4 rounded-2xl border-2 border-dashed border-border p-6">
                  <FolderOpenIcon class="h-12 w-12 text-muted-foreground/50" />
                </div>
                <h3 class="mb-1 text-lg font-semibold text-foreground">This folder is empty</h3>
                <p class="mb-4 max-w-xs text-sm">
                  Drop files here or create a new folder to get started.
                </p>
                <button class="command-button primary gap-2">
                  <UploadCloudIcon class="h-4 w-4" />
                  Upload files
                </button>
              </div>
            ) : state.viewMode === 'list' ? (
              <FileList
                onOpen={handleOpen}
                onContextMenu={handleContextMenu}
                lastClicked={lastClicked}
              />
            ) : (
              <FileGrid
                onOpen={handleOpen}
                onContextMenu={handleContextMenu}
                lastClicked={lastClicked}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
