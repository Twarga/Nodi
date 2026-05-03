import { useState } from 'preact/hooks';
import { appState, setViewMode, setSort, setSearch, toggleHidden } from '../stores/app';

function ListIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

function GridIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function SearchIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function FolderPlusIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      <line x1="12" y1="11" x2="12" y2="17"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
  );
}

function FilePlusIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  );
}

function UploadIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function EyeIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function SortAscIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  );
}

function SortDescIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <polyline points="19 12 12 19 5 12"/>
    </svg>
  );
}

export function WorkspaceBar() {
  const state = appState.value;
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div class="workspace-bar">
      {/* Left: View toggle + Sort */}
      <div class="flex flex-wrap items-center gap-2">
        {/* View switch */}
        <div class="view-switch">
          <button
            onClick={() => setViewMode('list')}
            class={['view-switch-btn', state.viewMode === 'list' ? 'is-active' : ''].join(' ')}
            title="List view"
          >
            <ListIcon class="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            class={['view-switch-btn', state.viewMode === 'grid' ? 'is-active' : ''].join(' ')}
            title="Grid view"
          >
            <GridIcon class="h-4 w-4" />
          </button>
        </div>

        {/* Sort dropdown */}
        <div class="flex items-center gap-1">
          <select
            value={state.sortBy}
            onChange={(e) => setSort((e.target as HTMLSelectElement).value as any, state.sortOrder)}
            class="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="date">Modified</option>
          </select>
          <button
            onClick={() => setSort(state.sortBy, state.sortOrder === 'asc' ? 'desc' : 'asc')}
            class="icon-button h-9 w-9"
            title={state.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {state.sortOrder === 'asc' ? <SortAscIcon class="h-4 w-4" /> : <SortDescIcon class="h-4 w-4" />}
          </button>
        </div>

        {/* Hidden files toggle */}
        <button
          onClick={toggleHidden}
          class={['icon-button h-9 w-9', state.showHidden ? 'text-primary bg-primary/10' : ''].join(' ')}
          title={state.showHidden ? 'Hide hidden files' : 'Show hidden files'}
        >
          {state.showHidden ? <EyeIcon class="h-4 w-4" /> : <EyeOffIcon class="h-4 w-4" />}
        </button>
      </div>

      {/* Right: Actions + Search */}
      <div class="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div class={['flex items-center gap-1 transition-all', searchOpen ? 'w-full sm:w-auto' : ''].join(' ')}>
          {searchOpen ? (
            <div class="flex items-center gap-1">
              <input
                type="text"
                value={state.searchQuery}
                onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                placeholder="Search files..."
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-48"
                autoFocus
              />
              <button onClick={() => { setSearch(''); setSearchOpen(false); }} class="icon-button h-9 w-9">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} class="icon-button h-9 w-9" title="Search">
              <SearchIcon class="h-4 w-4" />
            </button>
          )}
        </div>

        {/* New Folder */}
        <button class="command-button h-9 px-3 text-sm" title="New folder">
          <FolderPlusIcon class="h-4 w-4" />
          <span class="hidden sm:inline">New Folder</span>
        </button>

        {/* New File */}
        <button class="command-button h-9 px-3 text-sm" title="New file">
          <FilePlusIcon class="h-4 w-4" />
          <span class="hidden sm:inline">New File</span>
        </button>

        {/* Upload */}
        <button class="command-button primary h-9 px-3 text-sm" title="Upload files">
          <UploadIcon class="h-4 w-4" />
          <span class="hidden sm:inline">Upload</span>
        </button>
      </div>
    </div>
  );
}
