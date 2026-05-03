import { appState, toggleSelect, selectAll, clearSelection } from '../stores/app';
import { FileRow } from './FileRow';
import type { FileInfo } from '../lib/api';

interface FileListProps {
  onOpen: (file: FileInfo) => void;
  onContextMenu: (e: MouseEvent, file: FileInfo) => void;
  lastClicked: { current: number };
}

export function FileList({ onOpen, onContextMenu, lastClicked }: FileListProps) {
  const state = appState.value;
  const allSelected = state.files.length > 0 && state.files.every(f => state.selectedFiles.has(f.name));
  const someSelected = state.selectedFiles.size > 0 && !allSelected;

  const handleToggle = (name: string, index: number, e: MouseEvent) => {
    if (e.shiftKey && lastClicked.current >= 0) {
      // Range selection
      const start = Math.min(lastClicked.current, index);
      const end = Math.max(lastClicked.current, index);
      const names = state.files.slice(start, end + 1).map(f => f.name);
      const next = new Set(state.selectedFiles);
      names.forEach(n => next.add(n));
      selectAll(Array.from(next));
    } else {
      lastClicked.current = index;
      toggleSelect(name);
    }
  };

  return (
    <div class="file-panel overflow-hidden">
      {/* Header */}
      <div class="grid items-center gap-2 border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-surface-hover/50 grid-cols-[34px_1fr_100px_140px_44px] sm:grid-cols-[34px_1fr_110px_160px_56px]">
        <div>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={() => allSelected ? clearSelection() : selectAll(state.files.map(f => f.name))}
            class="selection-checkbox"
          />
        </div>
        <span>Name</span>
        <span class="text-right">Size</span>
        <span class="text-right">Modified</span>
        <span></span>
      </div>

      {/* Rows */}
      <ul class="divide-y divide-border/30">
        {state.files.map((file, i) => (
          <FileRow
            key={file.name}
            file={file}
            selected={state.selectedFiles.has(file.name)}
            onToggle={(name) => handleToggle(name, i, event as any)}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
          />
        ))}
      </ul>
    </div>
  );
}
