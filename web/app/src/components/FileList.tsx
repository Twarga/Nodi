import { toggleSelect, selectAll, clearSelection, files, selectedFiles } from '../stores/app';
import { FileRow } from './FileRow';
import type { FileInfo } from '../lib/api';

interface FileListProps {
  onOpen: (file: FileInfo) => void;
  onContextMenu: (e: MouseEvent, file: FileInfo) => void;
  lastClicked: { current: number };
}

export function FileList({ onOpen, onContextMenu, lastClicked }: FileListProps) {
  const _files = files.value;
  const _selected = selectedFiles.value;
  const allSelected = _files.length > 0 && _files.every(f => _selected.has(f.name));
  const someSelected = _selected.size > 0 && !allSelected;

  const handleToggle = (name: string, index: number, e: MouseEvent) => {
    if (e.shiftKey && lastClicked.current >= 0) {
      const start = Math.min(lastClicked.current, index);
      const end = Math.max(lastClicked.current, index);
      const names = _files.slice(start, end + 1).map(f => f.name);
      const next = new Set(_selected);
      names.forEach(n => next.add(n));
      selectAll(Array.from(next));
    } else {
      lastClicked.current = index;
      toggleSelect(name);
    }
  };

  return (
    <div class="file-panel overflow-hidden">
      {/* Header row */}
      <div class="grid items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid-cols-[34px_1fr_110px_160px_56px] grid-cols-[34px_1fr_44px]">
        <div>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={() => allSelected ? clearSelection() : selectAll(_files.map(f => f.name))}
            class="selection-checkbox"
          />
        </div>
        <span>Name</span>
        <span class="hidden text-right sm:block">Size</span>
        <span class="hidden text-right sm:block">Modified</span>
        <span></span>
      </div>

      {/* File rows */}
      <ul class="divide-y divide-border/30">
        {_files.map((file, i) => (
          <FileRow
            key={file.name}
            file={file}
            selected={_selected.has(file.name)}
            onToggle={(name) => handleToggle(name, i, window.event as MouseEvent || new MouseEvent('click'))}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
          />
        ))}
      </ul>
    </div>
  );
}
