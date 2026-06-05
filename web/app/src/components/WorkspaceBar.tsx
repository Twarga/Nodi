import { useEffect, useState } from 'preact/hooks';
import { setSearch, searchQuery } from '../stores/app';

function SearchIcon() {
  return <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function CloseIcon() {
  return <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function FolderPlusIcon() {
  return <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>;
}
function UploadIcon() {
  return <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}

interface WorkspaceBarProps {
  onUpload?: () => void;
  onNewFolder?: () => void;
}

export function WorkspaceBar({ onUpload, onNewFolder }: WorkspaceBarProps) {
  const currentSearchQuery = searchQuery.value;
  const [searchVal, setSearchVal] = useState(currentSearchQuery);

  useEffect(() => {
    setSearchVal(currentSearchQuery);
  }, [currentSearchQuery]);

  const handleSearchInput = (val: string) => {
    setSearchVal(val);
    setSearch(val);
  };

  return (
    <div class="flex w-full flex-col gap-3 sm:max-w-[32rem]">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"><SearchIcon /></span>
        <input
          type="text"
          value={searchVal}
          onInput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
          placeholder="Search"
          class="input h-10 w-full pl-9 pr-10 text-sm"
        />
        {searchVal && (
          <button
            onClick={() => { setSearch(''); setSearchVal(''); }}
            class="absolute right-2 top-1/2 -translate-y-1/2 icon-button h-7 w-7"
            aria-label="Clear search"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div class="flex items-center gap-2">
        {onUpload && (
          <button onClick={onUpload} class="btn btn-primary h-9 px-3 text-sm">
            <UploadIcon />
            <span class="ml-1.5">Upload</span>
          </button>
        )}
        {onNewFolder && (
          <button onClick={onNewFolder} class="btn btn-outline h-9 px-3 text-sm">
            <FolderPlusIcon />
            <span class="ml-1.5">New folder</span>
          </button>
        )}
      </div>
    </div>
  );
}
