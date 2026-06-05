import { useState } from 'preact/hooks';
import { appState, clearSelection, setLoading, setFiles, setPath } from '../stores/app';
import { fileAPI, browseAPI, downloadAPI, shareAPI } from '../lib/api';
import { toast } from '../hooks/useToast';
import { FolderPicker } from './FolderPicker';

function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve();
}

export function SelectionBar() {
  const state = appState.value;
  const count = state.selectedFiles.size;
  const { currentPath } = state;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'move' | 'copy'>('move');
  const [compressing, setCompressing] = useState(false);

  if (count === 0) return null;

  const fullPath = (name: string) => currentPath ? `${currentPath}/${name}` : name;
  const selectedNames = () => Array.from(appState.value.selectedFiles);
  const selectedPaths = () => selectedNames().map(fullPath);

  const reloadFiles = async () => {
    setLoading(true);
    const current = appState.value;
    const data = await browseAPI.list({ path: current.currentPath, sortBy: current.sortBy, sortOrder: current.sortOrder });
    let files = data.files;
    if (!current.showHidden) files = files.filter(f => !f.name.startsWith('.'));
    setPath(current.currentPath);
    setFiles(files);
  };

  const handleDelete = async () => {
    const names = selectedNames();
    if (!confirm(`Delete ${names.length} item${names.length > 1 ? 's' : ''}?`)) return;
    try {
      for (const name of names) await fileAPI.delete(fullPath(name));
      clearSelection();
      await reloadFiles();
      toast(`Moved ${names.length} item${names.length > 1 ? 's' : ''} to trash`, 'success');
    } catch (err) {
      toast('Delete failed: ' + (err as Error).message, 'error');
    }
  };

  const handleDownload = async () => {
    const names = selectedNames();
    const paths = names.map(fullPath);
    try {
      if (paths.length === 1) {
        const file = state.files.find(f => f.name === names[0]);
        window.open(downloadAPI.downloadUrl(paths[0], file?.is_dir), '_blank');
      } else {
        await downloadAPI.downloadSelection(paths);
      }
      toast(`Downloading ${paths.length} item${paths.length > 1 ? 's' : ''}`, 'success');
    } catch (err) {
      toast('Download failed: ' + (err as Error).message, 'error');
    }
  };

  const openPicker = (mode: 'move' | 'copy') => {
    setPickerMode(mode);
    setPickerOpen(true);
  };

  const handlePickerSelect = async (dest: string) => {
    const names = selectedNames();
    try {
      for (const name of names) {
        const src = fullPath(name);
        const dst = dest ? `${dest}/${name}` : name;
        if (pickerMode === 'move') await fileAPI.move(src, dst);
        else await fileAPI.copy(src, dst);
      }
      setPickerOpen(false);
      clearSelection();
      await reloadFiles();
      toast(`${pickerMode === 'move' ? 'Moved' : 'Copied'} ${names.length} item${names.length > 1 ? 's' : ''}`, 'success');
    } catch (err) {
      toast(`${pickerMode} failed: ` + (err as Error).message, 'error');
    }
  };

  const handleCompress = async () => {
    const name = prompt('Archive name', 'Archive.zip');
    if (!name) return;
    setCompressing(true);
    toast('Compressing…', 'info');
    try {
      await fileAPI.compress(selectedPaths(), currentPath, name);
      clearSelection();
      await reloadFiles();
      toast('Archive created', 'success');
    } catch (err) {
      toast('Compress failed: ' + (err as Error).message, 'error');
    } finally {
      setCompressing(false);
    }
  };

  const handleShare = async () => {
    const paths = selectedPaths();
    if (!confirm(`Create read links for ${paths.length} selected item${paths.length === 1 ? '' : 's'}?`)) return;
    try {
      const links: string[] = [];
      for (const path of paths) {
        const res = await shareAPI.create({ path, mode: 'read' });
        links.push(`${window.location.origin}${res.url}`);
      }
      await copyText(links.join('\n'));
      clearSelection();
      toast(`${links.length} share link${links.length === 1 ? '' : 's'} created and copied`, 'success');
    } catch (err) {
      toast('Share failed: ' + (err as Error).message, 'error');
    }
  };

  return (
    <>
      <div class="mt-4 flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
        <div class="flex items-center gap-2 pl-1">
          <input type="checkbox" checked class="selection-checkbox" readOnly />
          <span class="text-sm font-medium text-foreground tabular">{count}</span>
          <span class="text-sm text-foreground-muted">selected</span>
        </div>

        <span class="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        <div class="flex flex-wrap items-center gap-1.5">
          <button onClick={handleDownload} class="btn btn-outline h-8 px-2.5 text-xs">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
          <button onClick={() => openPicker('move')} class="btn btn-outline h-8 px-2.5 text-xs">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Move
          </button>
          <button onClick={() => openPicker('copy')} class="btn btn-outline h-8 px-2.5 text-xs">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button onClick={handleShare} class="btn btn-outline h-8 px-2.5 text-xs">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Share
          </button>
          <button onClick={handleCompress} disabled={compressing} class="btn btn-outline h-8 px-2.5 text-xs">
            {compressing ? (
              <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><polyline points="14 10 21 3 21 10"/><polyline points="10 14 3 21 3 14"/></svg>
            )}
            {compressing ? 'Compressing…' : 'Compress'}
          </button>
          <button onClick={handleDelete} class="btn btn-danger h-8 px-2.5 text-xs">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
          </button>
        </div>

        <button onClick={clearSelection} class="icon-button h-7 w-7 ml-auto" title="Clear selection" aria-label="Clear selection">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <FolderPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handlePickerSelect} title={pickerMode === 'move' ? 'Move selected to' : 'Copy selected to'} actionLabel={pickerMode === 'move' ? 'Move here' : 'Copy here'} />
    </>
  );
}
