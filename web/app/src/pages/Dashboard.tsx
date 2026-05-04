import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { appState, setPath, setFiles, setLoading, clearSelection, selectAll, currentPath, sortBy as sortBySig, sortOrder as sortOrderSig, showHidden as showHiddenSig, searchQuery as searchQuerySig, files as filesSig, isLoading as isLoadingSig, viewMode as viewModeSig } from '../stores/app';
import { ctxState, openCtx, closeCtx, previewFileState, openPreview, closePreview } from '../stores/ui';
import { browseAPI, fileAPI, downloadAPI } from '../lib/api';
import { TopBar } from '../components/TopBar';
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
import { SkeletonList, SkeletonGrid } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { KeyboardShortcuts } from '../components/KeyboardShortcuts';
import { ToastContainer, toast } from '../hooks/useToast';
import { uploadFiles } from '../hooks/useUpload';
import type { FileInfo } from '../lib/api';

function buildBreadcrumbs(path: string): { name: string; path: string }[] {
  if (!path || path === '/') return [];
  const parts = path.replace(/^\//, '').split('/');
  const segments: { name: string; path: string }[] = [];
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    current += '/' + part;
    segments.push({ name: part, path: current });
  }
  return segments;
}

export function DashboardPage() {
  const lastClicked = useRef(-1);
  const loadGeneration = useRef(0);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'move' | 'copy'>('move');
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const _curPath = currentPath.value;
  const _sortBy = sortBySig.value;
  const _sortOrder = sortOrderSig.value;
  const _showHidden = showHiddenSig.value;
  const _searchQuery = searchQuerySig.value;
  const _files = filesSig.value;
  const _isLoading = isLoadingSig.value;
  const _viewMode = viewModeSig.value;

  const fullPath = useCallback((name: string) => appState.value.currentPath ? appState.value.currentPath + '/' + name : name, []);

  const loadFiles = useCallback(async (path: string, showLoading: boolean) => {
    const gen = ++loadGeneration.current;
    if (showLoading) setLoading(true);
    try {
      const data = await browseAPI.list({
        path,
        sortBy: appState.value.sortBy,
        sortOrder: appState.value.sortOrder,
        showHidden: appState.value.showHidden,
        query: appState.value.searchQuery || undefined,
      });
      if (gen !== loadGeneration.current) return;
      const files = data.files || [];
      setPath(path, buildBreadcrumbs(path));
      setFiles(files);
    } catch {
      if (gen !== loadGeneration.current) return;
      setFiles([]);
    }
  }, []);

  const silentReload = useCallback(() => {
    loadFiles(appState.value.currentPath, false);
  }, [loadFiles]);

  const handleUpload = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    uploadFiles(fileArray, appState.value.currentPath, () => {
      silentReload();
      toast(`${fileArray.length} file(s) uploaded`, 'success');
    });
  }, [silentReload]);

  const triggerFileInput = useCallback(() => fileInputRef.current?.click(), []);

  useEffect(() => { loadFiles(_curPath, true); }, [_curPath, _sortBy, _sortOrder, _showHidden]);

  useEffect(() => {
    if (!_searchQuery && !_curPath) return;
    const timer = setTimeout(() => { loadFiles(appState.value.currentPath, _searchQuery !== ''); }, 300);
    return () => clearTimeout(timer);
  }, [_searchQuery]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { clearSelection(); closeCtx(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const names = _files.map(f => f.name);
        if (names.length > 0) selectAll(names);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [_files.length]);

  const handleOpen = useCallback((file: FileInfo) => {
    if (file.is_dir) {
      loadFiles(appState.value.currentPath ? appState.value.currentPath + '/' + file.name : file.name, true);
    } else {
      openPreview(file);
    }
  }, [loadFiles]);

  const handleContextMenu = useCallback((e: MouseEvent, file: FileInfo) => {
    openCtx(e, file);
  }, []);

  const actDownload = useCallback(() => {
    const f = ctxState.value.file;
    if (!f) return;
    window.open(downloadAPI.downloadUrl(fullPath(f.name)), '_blank');
  }, [fullPath]);

  const actRename = useCallback(() => {
    const f = ctxState.value.file;
    if (!f) return;
    setRenameVal(f.name);
    setRenameOpen(true);
  }, []);

  const submitRename = useCallback(async () => {
    const f = ctxState.value.file;
    if (!f || !renameVal.trim() || renameVal === f.name) {
      setRenameOpen(false);
      return;
    }
    setProcessing(true);
    try {
      await fileAPI.rename(fullPath(f.name), renameVal.trim());
      silentReload();
      toast('Renamed successfully', 'success');
    } catch (err) {
      toast('Rename failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
      setRenameOpen(false);
    }
  }, [renameVal, fullPath, silentReload]);

  const actDelete = useCallback(() => { setDeleteOpen(true); }, []);

  const submitDelete = useCallback(async () => {
    const f = ctxState.value.file;
    if (!f) return;
    setProcessing(true);
    try {
      await fileAPI.delete(fullPath(f.name));
      silentReload();
      toast('Moved to trash', 'success');
    } catch (err) {
      toast('Delete failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
      setDeleteOpen(false);
    }
  }, [fullPath, silentReload]);

  const actMove = useCallback(() => { setPickerMode('move'); setFolderPickerOpen(true); }, []);
  const actCopy = useCallback(() => { setPickerMode('copy'); setFolderPickerOpen(true); }, []);

  const submitPicker = useCallback(async (dest: string) => {
    const f = ctxState.value.file;
    if (!f) return;
    setProcessing(true);
    try {
      const srcPath = fullPath(f.name);
      const dstPath = dest + '/' + f.name;
      if (pickerMode === 'move') {
        await fileAPI.move(srcPath, dstPath);
        toast('Moved successfully', 'success');
      } else {
        await fileAPI.copy(srcPath, dstPath);
        toast('Copied successfully', 'success');
      }
      silentReload();
    } catch (err) {
      toast(pickerMode + ' failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
      setFolderPickerOpen(false);
    }
  }, [fullPath, pickerMode, silentReload]);

  const actDuplicate = useCallback(async () => {
    const f = ctxState.value.file;
    if (!f) return;
    setProcessing(true);
    try {
      await fileAPI.duplicate(fullPath(f.name));
      silentReload();
      toast('Duplicated successfully', 'success');
    } catch (err) {
      toast('Duplicate failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
    }
  }, [fullPath, silentReload]);

  const handleNewFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setProcessing(true);
    try {
      await fileAPI.createFolder(appState.value.currentPath, name);
      setNewFolderOpen(false);
      setNewFolderName('');
      silentReload();
      toast('Folder created', 'success');
    } catch (err) {
      toast('Failed to create folder: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
    }
  }, [newFolderName, silentReload]);

  const handleNewFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name) return;
    setProcessing(true);
    try {
      await fileAPI.createFile(appState.value.currentPath, name);
      setNewFileOpen(false);
      setNewFileName('');
      silentReload();
      toast('File created', 'success');
    } catch (err) {
      toast('Failed to create file: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
    }
  }, [newFileName, silentReload]);

  return (
    <div class="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <div class="flex flex-1 overflow-hidden relative z-0">
        <main class="flex-1 overflow-y-auto overflow-x-hidden relative z-0">
          <div class="px-4 sm:px-6 lg:px-8 pt-6 pb-8 mx-auto max-w-screen-2xl">
            <Breadcrumbs />
            <div class="mt-4"><WorkspaceBar onUpload={triggerFileInput} onNewFolder={() => setNewFolderOpen(true)} onNewFile={() => setNewFileOpen(true)} /></div>
            <div class="mt-3"><SelectionBar /></div>
            <div class="mt-4">
              {_isLoading ? (
                _viewMode === 'list' ? <SkeletonList /> : <SkeletonGrid />
              ) : _files.length === 0 ? (
                <EmptyState onUpload={triggerFileInput} />
              ) : _viewMode === 'list' ? (
                <FileList onOpen={handleOpen} onContextMenu={handleContextMenu} lastClicked={lastClicked} />
              ) : (
                <FileGrid onOpen={handleOpen} onContextMenu={handleContextMenu} lastClicked={lastClicked} />
              )}
            </div>
          </div>
        </main>
      </div>

      <ContextMenu
        onDownload={actDownload} onRename={actRename} onMove={actMove}
        onCopy={actCopy} onDuplicate={actDuplicate} onDelete={actDelete}
      />

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
        <p class="text-sm">Are you sure you want to delete <strong class="text-foreground">{ctxState.value.file?.name}</strong>?</p>
        <p class="mt-2 text-xs text-muted-foreground">This item will be moved to trash.</p>
      </Modal>

      <Modal open={newFolderOpen} onClose={() => { setNewFolderOpen(false); setNewFolderName(''); }} title="New Folder" size="sm"
        footer={
          <>
            <button onClick={() => { setNewFolderOpen(false); setNewFolderName(''); }} class="command-button h-9 px-4 text-sm">Cancel</button>
            <button onClick={handleNewFolder} disabled={processing || !newFolderName.trim()} class="command-button primary h-9 px-4 text-sm">
              {processing ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <input
          type="text" value={newFolderName}
          onInput={(e) => setNewFolderName((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNewFolder(); }}
          class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Folder name"
          autoFocus
        />
      </Modal>

      <Modal open={newFileOpen} onClose={() => { setNewFileOpen(false); setNewFileName(''); }} title="New File" size="sm"
        footer={
          <>
            <button onClick={() => { setNewFileOpen(false); setNewFileName(''); }} class="command-button h-9 px-4 text-sm">Cancel</button>
            <button onClick={handleNewFile} disabled={processing || !newFileName.trim()} class="command-button primary h-9 px-4 text-sm">
              {processing ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <input
          type="text" value={newFileName}
          onInput={(e) => setNewFileName((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleNewFile(); }}
          class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="File name"
          autoFocus
        />
      </Modal>

      <FolderPicker
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={submitPicker}
        title={pickerMode === 'move' ? 'Move to' : 'Copy to'}
        actionLabel={pickerMode === 'move' ? 'Move here' : 'Copy here'}
      />

      <PreviewOverlay />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        class="hidden"
        aria-label="Upload files"
        onChange={(e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files) handleUpload(files);
          (e.target as HTMLInputElement).value = '';
        }}
      />

      <DropOverlay onDrop={handleUpload} />
      <UploadPanel />
      <ToastContainer />
      <KeyboardShortcuts />
    </div>
  );
}

function PreviewOverlay() {
  const file = previewFileState.value;
  if (!file) return null;
  return (
    <Preview
      file={file}
      path={appState.value.currentPath}
      allFiles={appState.value.files}
      onClose={closePreview}
    />
  );
}
