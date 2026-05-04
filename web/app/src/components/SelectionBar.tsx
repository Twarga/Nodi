import { appState, clearSelection, setLoading, setFiles, setPath } from '../stores/app';
import { fileAPI, browseAPI } from '../lib/api';
import { toast } from '../hooks/useToast';

function TrashIcon() {
  return (
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function SelectionBar() {
  const state = appState.value;
  const count = state.selectedFiles.size;
  const { currentPath } = state;

  if (count === 0) return null;

  const fullPath = (name: string) => currentPath ? `${currentPath}/${name}` : name;

  const handleDelete = async () => {
    const names = Array.from(state.selectedFiles);
    if (!confirm(`Delete ${names.length} item${names.length > 1 ? 's' : ''}?`)) return;

    try {
      for (const name of names) {
        await fileAPI.delete(fullPath(name));
      }
      clearSelection();
      // Reload file list
      setLoading(true);
      const data = await browseAPI.list({ path: currentPath, sortBy: state.sortBy, sortOrder: state.sortOrder });
      let files = data.files;
      if (!state.showHidden) files = files.filter(f => !f.name.startsWith('.'));
      setPath(currentPath);
      setFiles(files);
      toast(`Moved ${names.length} item${names.length > 1 ? 's' : ''} to trash`, 'success');
    } catch (err) {
      toast('Delete failed: ' + (err as Error).message, 'error');
    }
  };

  return (
    <div class="selection-bar">
      <div class="flex items-center gap-3">
        <span class="selection-count">{count}</span>
        <span class="text-sm">
          {count === 1 ? 'item selected' : 'items selected'}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button onClick={handleDelete} class="selection-danger">
          <TrashIcon />
          Delete
        </button>
        <button onClick={clearSelection} class="icon-button h-9 w-9" title="Clear selection">
          <XIcon />
        </button>
      </div>
    </div>
  );
}