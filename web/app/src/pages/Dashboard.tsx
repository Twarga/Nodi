import { useEffect, useRef, useState } from 'preact/hooks';
import { appState, setPath, setFiles, setLoading, clearSelection, selectAll } from '../stores/app';
import { browseAPI, fileAPI, downloadAPI } from '../lib/api';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { WorkspaceBar } from '../components/WorkspaceBar';
import { FileList } from '../components/FileList';
import { FileGrid } from '../components/FileGrid';
import { SelectionBar } from '../components/SelectionBar';
import { ContextMenu } from '../components/ContextMenu';
import { Modal } from '../components/Modal';
import { FolderPicker } from '../components/FolderPicker';
import { Preview } from '../components/Preview';
import { UploadPanel } from '../components/UploadPanel';
import { DropOverlay } from '../components/DropOverlay';
import { uploadFiles } from '../hooks/useUpload';
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

interface CtxState { open: boolean; x: number; y: number; file: FileInfo | null; }

export function DashboardPage() {
  const state = appState.value;
  const lastClicked = useRef(-1);

  const [ctx, setCtx] = useState<CtxState>({ open: false, x: 0, y: 0, file: null });
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'move'|'copy'>('move');
  const [processing, setProcessing] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (files: FileList) => {
    const fileArray = Array.from(files);
    uploadFiles(fileArray, state.currentPath, () => loadFiles(state.currentPath));
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  useEffect(() => { loadFiles(state.currentPath); },
    [state.currentPath, state.sortBy, state.sortOrder, state.showHidden]);

  useEffect(() => { if (state.searchQuery) loadFiles(state.currentPath); }, [state.searchQuery]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { clearSelection(); setCtx(p => ({ ...p, open: false })); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const names = state.files.map(f => f.name);
        if (names.length > 0) selectAll(names);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.files.length]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const data = await browseAPI.list({ path, sortBy: state.sortBy, sortOrder: state.sortOrder });
      let files = data.files;
      if (!state.showHidden) files = files.filter(f => !f.name.startsWith('.'));
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        files = files.filter(f => f.name.toLowerCase().includes(q));
      }
      setPath(path, data.path);
      setFiles(files);
    } catch { setFiles([]); }
  };

  const fullPath = (name: string) => state.currentPath ? state.currentPath + '/' + name : name;

  const handleOpen = async (file: FileInfo) => {
    if (file.is_dir) {
      const np = fullPath(file.name);
      const data = await browseAPI.list({ path: np });
      setPath(np, data.path);
      setFiles(data.files);
    } else {
      setPreviewFile(file);
    }
  };

  const handleContextMenu = (e: MouseEvent, file: FileInfo) => {
    e.preventDefault();
    setCtx({ open: true, x: e.clientX, y: e.clientY, file });
  };

  const closeCtx = () => setCtx(p => ({ ...p, open: false }));

  const actDownload = () => { if (ctx.file) window.open(downloadAPI.downloadUrl(fullPath(ctx.file.name)), '_blank'); };

  const actRename = () => {
    if (!ctx.file) return;
    setRenameVal(ctx.file.name);
    setRenameOpen(true);
    closeCtx();
  };

  const submitRename = async () => {
    if (!ctx.file || !renameVal.trim() || renameVal === ctx.file.name) { setRenameOpen(false); return; }
    setProcessing(true);
    try { await fileAPI.rename(fullPath(ctx.file.name), renameVal); loadFiles(state.currentPath); }
    catch (err) { alert('Rename failed: ' + (err as Error).message); }
    finally { setProcessing(false); setRenameOpen(false); }
  };

  const actDelete = () => { setDeleteOpen(true); closeCtx(); };

  const submitDelete = async () => {
    if (!ctx.file) return;
    setProcessing(true);
    try { await fileAPI.delete([fullPath(ctx.file.name)]); loadFiles(state.currentPath); }
    catch (err) { alert('Delete failed: ' + (err as Error).message); }
    finally { setProcessing(false); setDeleteOpen(false); }
  };

  const actMove = () => { setPickerMode('move'); setFolderPickerOpen(true); closeCtx(); };
  const actCopy = () => { setPickerMode('copy'); setFolderPickerOpen(true); closeCtx(); };

  const submitPicker = async (dest: string) => {
    if (!ctx.file) return;
    setProcessing(true);
    try {
      const paths = [fullPath(ctx.file.name)];
      if (pickerMode === 'move') await fileAPI.move(paths, dest);
      else await fileAPI.copy(paths, dest);
      loadFiles(state.currentPath);
    } catch (err) { alert(pickerMode + ' failed: ' + (err as Error).message); }
    finally { setProcessing(false); setFolderPickerOpen(false); }
  };

  const actDuplicate = async () => {
    if (!ctx.file) return;
    closeCtx();
    setProcessing(true);
    try { await fileAPI.duplicate(fullPath(ctx.file.name)); loadFiles(state.currentPath); }
    catch (err) { alert('Duplicate failed: ' + (err as Error).message); }
    finally { setProcessing(false); }
  };

  return (
    <div class="flex h-screen flex-col">
      <TopBar />
      <div class="flex flex-1 overflow-hidden">
        <Sidebar />
        <main class="flex-1 overflow-auto app-main">
          <Breadcrumbs />
          <div class="mt-4"><WorkspaceBar onUpload={triggerFileInput} /></div>
          <div class="mt-4"><SelectionBar /></div>

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
                <p class="mb-4 max-w-xs text-sm">Drop files here or create a new folder to get started.</p>
                <button onClick={triggerFileInput} class="command-button primary gap-2">
                  <UploadCloudIcon class="h-4 w-4" />
                  Upload files
                </button>
              </div>
            ) : state.viewMode === 'list' ? (
              <FileList onOpen={handleOpen} onContextMenu={handleContextMenu} lastClicked={lastClicked} />
            ) : (
              <FileGrid onOpen={handleOpen} onContextMenu={handleContextMenu} lastClicked={lastClicked} />
            )}
          </div>
        </main>
      </div>

      {/* Context Menu */}
      {ctx.open && ctx.file && (
        <ContextMenu
          x={ctx.x} y={ctx.y} file={ctx.file} onClose={closeCtx}
          onDownload={actDownload} onRename={actRename} onMove={actMove}
          onCopy={actCopy} onDuplicate={actDuplicate} onDelete={actDelete}
        />
      )}

      {/* Rename Modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename" size="sm"
        footer={
          <>
            <button onClick={() => setRenameOpen(false)} class="command-button h-9 px-4 text-sm">Cancel</button>
            <button onClick={submitRename} disabled={processing} class="command-button primary h-9 px-4 text-sm">
              {processing ? 'Renaming...' : 'Rename'}
            </button>
          </>
        }
      >
        <input
          type="text" value={renameVal}
          onInput={(e) => setRenameVal((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); }}
          class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
      </Modal>

      {/* Delete Modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteOpen(false)} class="command-button h-9 px-4 text-sm">Cancel</button>
            <button onClick={submitDelete} disabled={processing} class="selection-danger h-9 px-4 text-sm">
              {processing ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p class="text-sm">Are you sure you want to delete <strong class="text-foreground">{ctx.file?.name}</strong>?</p>
        <p class="mt-2 text-xs text-muted-foreground">This item will be moved to trash.</p>
      </Modal>

      {/* Folder Picker */}
      <FolderPicker
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={submitPicker}
        title={pickerMode === 'move' ? 'Move to' : 'Copy to'}
        actionLabel={pickerMode === 'move' ? 'Move here' : 'Copy here'}
      />

      {/* File Preview */}
      {previewFile && (
        <Preview
          file={previewFile}
          path={state.currentPath}
          allFiles={state.files}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        class="hidden"
        onChange={(e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files) handleUpload(files);
          (e.target as HTMLInputElement).value = '';
        }}
      />

      {/* Drag and drop */}
      <DropOverlay onDrop={handleUpload} />

      {/* Upload panel */}
      <UploadPanel />
    </div>
  );
}
