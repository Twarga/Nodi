import { useEffect, useRef, useState } from 'preact/hooks';
import { appState, setPath, setFiles, setLoading, setSearch, clearSelection, selectAll, setViewMode } from '../stores/app';
import { browseAPI, fileAPI, downloadAPI, searchAPI, hashAPI } from '../lib/api';
import { TopBar } from '../components/TopBar';

import { Breadcrumbs } from '../components/Breadcrumbs';
import { FileList } from '../components/FileList';
import { ContextMenu } from '../components/ContextMenu';
import { Modal } from '../components/Modal';
import { FolderPicker } from '../components/FolderPicker';
import { Preview } from '../components/Preview';
import { MetadataSidebar } from '../components/MetadataSidebar';
import { ShareModal } from '../components/ShareModal';
import { DropOverlay } from '../components/DropOverlay';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { SelectionBar } from '../components/SelectionBar';
import { KeyboardShortcuts } from '../components/KeyboardShortcuts';
import { ToastContainer, toast } from '../hooks/useToast';
import { uploadFiles } from '../hooks/useUpload';
import type { FileInfo, UploadFile } from '../lib/api';
import { navigate } from '../lib/router';

interface CtxState { open: boolean; x: number; y: number; file: FileInfo | null; }

export function DashboardPage() {
  const state = appState.value;
  const lastClicked = useRef(-1);

  const [ctx, setCtx] = useState<CtxState>({ open: false, x: 0, y: 0, file: null });
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'move' | 'copy'>('move');
  const [processing, setProcessing] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileInfo | null>(null);
  const [shareFile, setShareFile] = useState<FileInfo | null>(null);
  const [hashValue, setHashValue] = useState('');
  const [hashLoading, setHashLoading] = useState(false);
  const [hashError, setHashError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const goToFolder = (path: string) => {
    window.history.pushState({ currentPath: path }, '', '/files');
    setPath(path);
  };

  const handleUpload = (files: FileList | Array<File | UploadFile>) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    if (fileArray.length === 0) return;
    uploadFiles(fileArray, state.currentPath, () => {
      loadFiles(state.currentPath);
      toast(`${fileArray.length} file(s) uploaded`, 'success');
    }, { conflict: 'keep-both' });
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const query = appState.value.searchQuery.trim();
      if (query) {
        const data = await searchAPI.search(query, { limit: 500, showHidden: appState.value.showHidden });
        setFiles(data.files);
        return;
      }
      const data = await browseAPI.list({ path, sortBy: state.sortBy, sortOrder: state.sortOrder });
      let files = data.files;
      if (!state.showHidden) files = files.filter(f => !f.name.startsWith('.'));
      setPath(path);
      setFiles(files);
    } catch {
      setFiles([]);
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(state.currentPath); },
    [state.currentPath, state.sortBy, state.sortOrder, state.showHidden]);

  useEffect(() => {
    const timer = setTimeout(() => { loadFiles(state.currentPath); }, 300);
    return () => clearTimeout(timer);
  }, [state.searchQuery]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { clearSelection(); setCtx(p => ({ ...p, open: false })); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const names = state.files.map(f => f.name);
        if (names.length > 0) selectAll(names);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.files.length]);

  // Handle browser back/forward for folder navigation
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      const s = e.state as { currentPath?: string } | null;
      const path = s?.currentPath ?? '';
      if (path !== appState.value.currentPath) {
        setPath(path);
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const fullPath = (name: string) => state.currentPath ? state.currentPath + '/' + name : name;
  const filePath = (file: FileInfo) => file.path || fullPath(file.name);
  const fileParent = (file: FileInfo) => file.parentPath || '';
  const isSearchMode = state.searchQuery.trim() !== '';
  const openLocation = async (file: FileInfo) => {
    const parent = fileParent(file);
    if (isSearchMode) setSearch('');
    goToFolder(parent);
  };

  const handleOpen = async (file: FileInfo) => {
    if (file.is_dir) {
      const np = filePath(file);
      if (isSearchMode) setSearch('');
      goToFolder(np);
    } else {
      setPreviewFile(file);
    }
  };

  const handleContextMenu = (e: MouseEvent, file: FileInfo) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ open: true, x: e.clientX, y: e.clientY, file });
  };

  const closeCtx = () => setCtx(p => ({ ...p, open: false }));

  const actDownload = () => {
    if (ctx.file) window.open(downloadAPI.downloadUrl(filePath(ctx.file), ctx.file.is_dir), '_blank');
  };

  const actRename = () => {
    if (!ctx.file) return;
    setRenameVal(ctx.file.name);
    setRenameOpen(true);
    closeCtx();
  };

  const submitRename = async () => {
    if (!ctx.file || !renameVal.trim() || renameVal === ctx.file.name) {
      setRenameOpen(false);
      return;
    }
    setProcessing(true);
    try {
      await fileAPI.rename(filePath(ctx.file), renameVal.trim());
      loadFiles(state.currentPath);
      toast('Renamed', 'success');
    } catch (err) {
      toast('Rename failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
      setRenameOpen(false);
    }
  };

  const actDelete = () => { setDeleteOpen(true); closeCtx(); };

  const submitDelete = async () => {
    if (!ctx.file) return;
    setProcessing(true);
    try {
      await fileAPI.delete(filePath(ctx.file));
      loadFiles(state.currentPath);
      toast('Moved to trash', 'success');
    } catch (err) {
      toast('Delete failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
      setDeleteOpen(false);
    }
  };

  const actMove = () => { setPickerMode('move'); setFolderPickerOpen(true); closeCtx(); };
  const actCopy = () => { setPickerMode('copy'); setFolderPickerOpen(true); closeCtx(); };

  const submitPicker = async (dest: string) => {
    if (!ctx.file) return;
    setProcessing(true);
    try {
      const src = filePath(ctx.file);
      const filename = ctx.file.name;
      const targetPath = dest ? (dest.endsWith('/') ? dest + filename : dest + '/' + filename) : filename;
      if (pickerMode === 'move') {
        await fileAPI.move(src, targetPath);
        toast('Moved', 'success');
      } else {
        await fileAPI.copy(src, targetPath);
        toast('Copied', 'success');
      }
      loadFiles(state.currentPath);
    } catch (err) {
      toast(pickerMode + ' failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
      setFolderPickerOpen(false);
    }
  };

  const actDuplicate = async () => {
    if (!ctx.file) return;
    closeCtx();
    setProcessing(true);
    try {
      await fileAPI.duplicate(filePath(ctx.file));
      loadFiles(state.currentPath);
      toast('Duplicated', 'success');
    } catch (err) {
      toast('Duplicate failed: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const actDetails = () => {
    if (!ctx.file) return;
    setDetailsFile(ctx.file);
    setHashValue('');
    setHashError('');
    closeCtx();
  };

  const actShare = () => {
    const target = detailsFile || ctx.file;
    if (!target) return;
    setShareFile(target);
    closeCtx();
  };

  const copyDetailsPath = async () => {
    if (!detailsFile) return;
    await navigator.clipboard.writeText(filePath(detailsFile));
    toast('Path copied', 'success');
  };

  const calculateDetailsHash = async () => {
    if (!detailsFile || detailsFile.is_dir) return;
    setHashLoading(true);
    setHashError('');
    try {
      const res = await hashAPI.calculate(filePath(detailsFile));
      setHashValue(res.hash);
      await navigator.clipboard.writeText(res.hash).catch(() => {});
      toast('SHA-256 calculated', 'success');
    } catch (err) {
      setHashError((err as Error).message || 'Hash failed');
    } finally {
      setHashLoading(false);
    }
  };

  const handleNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setProcessing(true);
    try {
      await fileAPI.createFolder(state.currentPath, name);
      setNewFolderOpen(false);
      setNewFolderName('');
      loadFiles(state.currentPath);
      toast('Folder created', 'success');
    } catch (err) {
      toast('Failed to create folder: ' + (err as Error).message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const folderName = state.currentPath ? state.currentPath.split('/').pop() || 'Files' : 'Files';
  const selectedCount = state.selectedFiles.size;

  return (
    <div class="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />

      <main class="flex-1 overflow-y-auto overflow-x-hidden">
          <div class="px-4 sm:px-8 pt-4 sm:pt-6 pb-20 sm:pb-12 max-w-6xl mx-auto">
            {/* Breadcrumbs */}
            <Breadcrumbs onNavigate={goToFolder} />

            {/* Header */}
            <div class="mt-4 flex items-start justify-between gap-4">
              <div>
                <h1 class="text-xl font-semibold tracking-tight text-foreground">{folderName}</h1>
                <p class="mt-1 text-sm text-foreground-muted">
                  {state.isLoading ? 'Loading…' : isSearchMode
                    ? `${state.files.length} of … results`
                    : `${state.files.length} item${state.files.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button onClick={triggerFileInput} class="btn btn-primary h-9 px-3 text-sm">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload
                </button>
                <button onClick={() => setNewFolderOpen(true)} class="btn btn-primary h-9 px-3 text-sm">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                  New folder
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div class="mt-5 flex flex-wrap items-center gap-3">
              <div class="relative flex-1 min-w-[200px] max-w-md">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={state.searchQuery}
                  onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                  placeholder="Search in this folder..."
                  class="input h-9 w-full pl-9 pr-16 text-sm bg-surface"
                />
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-border text-foreground-subtle">/</span>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                {/* View toggle */}
                <div class="inline-flex overflow-hidden rounded-md border border-border">
                  <button
                    onClick={() => setViewMode('list')}
                    class={['inline-flex h-8 w-8 items-center justify-center transition-colors', state.viewMode === 'list' ? 'bg-surface-hover text-foreground' : 'text-foreground-muted hover:text-foreground'].join(' ')}
                    title="List view"
                  >
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    class={['inline-flex h-8 w-8 items-center justify-center border-l border-border transition-colors', state.viewMode === 'grid' ? 'bg-surface-hover text-foreground' : 'text-foreground-muted hover:text-foreground'].join(' ')}
                    title="Grid view"
                  >
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Selection Bar */}
            <SelectionBar />

            {/* File List */}
            <div class="mt-2 border border-border rounded-lg overflow-hidden bg-card">
              {state.isLoading ? (
                <SkeletonList />
              ) : state.files.length === 0 ? (
                isSearchMode ? (
                  <div class="py-20 text-center">
                    <p class="text-base font-medium text-foreground">No matches found</p>
                    <p class="mt-1.5 text-sm text-foreground-muted">Try a shorter filename or extension.</p>
                  </div>
                ) : (
                  <EmptyState onUpload={triggerFileInput} />
                )
              ) : (
                <FileList onOpen={handleOpen} onContextMenu={handleContextMenu} lastClicked={lastClicked} />
              )}
            </div>
          </div>
        </main>

      {/* Context Menu */}
      {ctx.open && ctx.file && (
        <ContextMenu
          x={ctx.x} y={ctx.y} file={ctx.file} onClose={closeCtx}
          onDownload={actDownload} onRename={actRename} onMove={actMove}
          onCopy={actCopy} onDuplicate={actDuplicate} onDetails={actDetails} onDelete={actDelete}
        />
      )}

      {/* Modals */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename" size="sm"
        footer={<>
          <button onClick={() => setRenameOpen(false)} class="btn btn-outline h-9 px-4 text-sm">Cancel</button>
          <button onClick={submitRename} disabled={processing} class="btn btn-primary h-9 px-4 text-sm">{processing ? 'Renaming…' : 'Rename'}</button>
        </>}
      >
        <input type="text" value={renameVal} onInput={(e) => setRenameVal((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); }} class="input" autoFocus />
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete" size="sm"
        footer={<>
          <button onClick={() => setDeleteOpen(false)} class="btn btn-outline h-9 px-4 text-sm">Cancel</button>
          <button onClick={submitDelete} disabled={processing} class="btn btn-danger h-9 px-4 text-sm">{processing ? 'Deleting…' : 'Delete'}</button>
        </>}
      >
        <p class="text-sm text-foreground">Move <span class="font-medium">{ctx.file?.name}</span> to trash?</p>
        <p class="mt-1.5 text-xs text-foreground-muted">You can restore deleted items from Settings.</p>
      </Modal>

      <Modal open={newFolderOpen} onClose={() => { setNewFolderOpen(false); setNewFolderName(''); }} title="New folder" size="sm"
        footer={<>
          <button onClick={() => { setNewFolderOpen(false); setNewFolderName(''); }} class="btn btn-outline h-9 px-4 text-sm">Cancel</button>
          <button onClick={handleNewFolder} disabled={processing || !newFolderName.trim()} class="btn btn-primary h-9 px-4 text-sm">{processing ? 'Creating…' : 'Create'}</button>
        </>}
      >
        <input type="text" value={newFolderName} onInput={(e) => setNewFolderName((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') handleNewFolder(); }} class="input" placeholder="Folder name" autoFocus />
      </Modal>

      <FolderPicker open={folderPickerOpen} onClose={() => setFolderPickerOpen(false)} onSelect={submitPicker} title={pickerMode === 'move' ? 'Move to' : 'Copy to'} actionLabel={pickerMode === 'move' ? 'Move here' : 'Copy here'} />

      {previewFile && <Preview file={previewFile} path={fileParent(previewFile) || state.currentPath} allFiles={state.files} onClose={() => setPreviewFile(null)} />}

      <MetadataSidebar
        file={detailsFile} path={detailsFile ? filePath(detailsFile) : ''}
        onClose={() => setDetailsFile(null)}
        onDownload={() => { if (!detailsFile) return; window.open(downloadAPI.downloadUrl(filePath(detailsFile), detailsFile.is_dir), '_blank'); }}
        onShare={actShare}
        onOpenLocation={() => { if (!detailsFile) return; openLocation(detailsFile); setDetailsFile(null); }}
        onCopyPath={copyDetailsPath}
        onCalculateHash={calculateDetailsHash}
        hashValue={hashValue} hashLoading={hashLoading} hashError={hashError}
      />

      {shareFile && <ShareModal open={!!shareFile} onClose={() => setShareFile(null)} file={{ name: shareFile.name, is_dir: shareFile.is_dir }} path={filePath(shareFile)} />}

      <input ref={fileInputRef} type="file" multiple class="hidden" aria-label="Upload files" onChange={(e) => { const files = (e.target as HTMLInputElement).files; if (files) handleUpload(files); (e.target as HTMLInputElement).value = ''; }} />

      <DropOverlay onDrop={handleUpload} />
      <ToastContainer />
      <KeyboardShortcuts />
    </div>
  );
}
