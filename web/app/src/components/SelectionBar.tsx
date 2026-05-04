import { appState, clearSelection } from '../stores/app';
import { fileAPI } from '../lib/api';

function TrashIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

function XIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function SelectionBar() {
  const state = appState.value;
  const count = state.selectedFiles.size;

  if (count === 0) return null;

  const handleDelete = async () => {
    const paths = Array.from(state.selectedFiles).map(name => {
      return state.currentPath ? `${state.currentPath}/${name}` : name;
    });
    if (!confirm(`Delete ${count} item${count > 1 ? 's' : ''}?`)) return;
    try {
      for (const p of paths) {
        await fileAPI.delete(p);
      }
      clearSelection();
      // Reload will happen via parent
    } catch (err) {
      alert('Failed to delete: ' + (err as Error).message);
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
        <button
          onClick={handleDelete}
          class="selection-danger"
        >
          <TrashIcon class="h-3.5 w-3.5" />
          Delete
        </button>
        <button
          onClick={clearSelection}
          class="icon-button h-9 w-9"
          title="Clear selection"
        >
          <XIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
