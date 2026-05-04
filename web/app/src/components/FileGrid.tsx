import { appState, toggleSelect, selectAll } from '../stores/app';
import { FileCard } from './FileRow';
import type { FileInfo } from '../lib/api';

interface FileGridProps {
  onOpen: (file: FileInfo) => void;
  onContextMenu: (e: MouseEvent, file: FileInfo) => void;
  lastClicked: { current: number };
}

export function FileGrid({ onOpen, onContextMenu, lastClicked }: FileGridProps) {
  const state = appState.value;

  const handleToggle = (name: string, index: number, e: MouseEvent) => {
    if (e.shiftKey && lastClicked.current >= 0) {
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
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {state.files.map((file, i) => (
        <FileCard
          key={file.name}
          file={file}
          currentPath={state.currentPath}
          selected={state.selectedFiles.has(file.name)}
          onToggle={(name) => handleToggle(name, i, window.event as MouseEvent || new MouseEvent('click'))}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}