import { toggleSelect, selectAll, clearSelection, files, selectedFiles, sortBy, sortOrder, setSort } from '../stores/app';
import { FileRow } from './FileRow';
import type { FileInfo } from '../lib/api';

function SortAscIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M5 12l7-7 7 7"/></svg>;
}
function SortDescIcon({ class: cls }: { class?: string }) {
  return <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 19V5M5 12l7 7 7-7"/></svg>;
}

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
  const activeSort = sortBy.value;
  const activeOrder = sortOrder.value;

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

  const handleSort = (field: 'name' | 'size' | 'modified') => {
    const order = activeSort === field && activeOrder === 'asc' ? 'desc' : 'asc';
    setSort(field, order);
  };

  const SortIcon = ({ field }: { field: 'name' | 'size' | 'modified' }) => {
    if (activeSort !== field) return null;
    return activeOrder === 'asc'
      ? <SortAscIcon class="h-3 w-3 text-primary ml-1 inline-block" />
      : <SortDescIcon class="h-3 w-3 text-primary ml-1 inline-block" />;
  };

  return (
    <div>
      <div class="file-header bg-surface select-none">
        <div>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={() => allSelected ? clearSelection() : selectAll(_files.map(f => f.name))}
            class="selection-checkbox"
            aria-label="Select all"
          />
        </div>
        <button
          onClick={() => handleSort('name')}
          class="flex items-center text-left border-none bg-transparent cursor-pointer hover:text-foreground transition-colors p-0"
        >
          <span>Name</span>
          <SortIcon field="name" />
        </button>
        <button
          onClick={() => handleSort('size')}
          class="hidden sm:flex items-center justify-end text-right border-none bg-transparent cursor-pointer hover:text-foreground transition-colors p-0"
        >
          <span>Size</span>
          <SortIcon field="size" />
        </button>
        <button
          onClick={() => handleSort('modified')}
          class="hidden sm:flex items-center justify-end text-right border-none bg-transparent cursor-pointer hover:text-foreground transition-colors p-0"
        >
          <span>Modified</span>
          <SortIcon field="modified" />
        </button>
        <span></span>
      </div>

      <ul>
        {_files.map((file, i) => (
          <FileRow
            key={file.path || file.name}
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
