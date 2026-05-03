import { signal } from '@preact/signals';
import type { FileInfo, BreadcrumbSegment } from '../lib/api';

export type ViewMode = 'list' | 'grid';
export type SortBy = 'name' | 'size' | 'date';
export type SortOrder = 'asc' | 'desc';

export interface AppState {
  currentPath: string;
  breadcrumbs: BreadcrumbSegment[];
  files: FileInfo[];
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  searchQuery: string;
  showHidden: boolean;
  selectedFiles: Set<string>;
  isLoading: boolean;
  sidebarOpen: boolean;
}

export const appState = signal<AppState>({
  currentPath: '',
  breadcrumbs: [],
  files: [],
  viewMode: (localStorage.getItem('ql-view-mode') as ViewMode) || 'list',
  sortBy: (localStorage.getItem('ql-sort-by') as SortBy) || 'name',
  sortOrder: (localStorage.getItem('ql-sort-order') as SortOrder) || 'asc',
  searchQuery: '',
  showHidden: localStorage.getItem('ql-show-hidden') === 'true',
  selectedFiles: new Set(),
  isLoading: false,
  sidebarOpen: false,
});

export function setPath(path: string, breadcrumbs: BreadcrumbSegment[]) {
  appState.value = {
    ...appState.value,
    currentPath: path,
    breadcrumbs,
    selectedFiles: new Set(),
  };
}

export function setFiles(files: FileInfo[]) {
  appState.value = { ...appState.value, files, isLoading: false };
}

export function setViewMode(mode: ViewMode) {
  localStorage.setItem('ql-view-mode', mode);
  appState.value = { ...appState.value, viewMode: mode };
}

export function setSort(sortBy: SortBy, sortOrder: SortOrder) {
  localStorage.setItem('ql-sort-by', sortBy);
  localStorage.setItem('ql-sort-order', sortOrder);
  appState.value = { ...appState.value, sortBy, sortOrder };
}

export function setSearch(query: string) {
  appState.value = { ...appState.value, searchQuery: query };
}

export function toggleHidden() {
  const next = !appState.value.showHidden;
  localStorage.setItem('ql-show-hidden', String(next));
  appState.value = { ...appState.value, showHidden: next };
}

export function toggleSelect(name: string) {
  const next = new Set(appState.value.selectedFiles);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  appState.value = { ...appState.value, selectedFiles: next };
}

export function selectAll(names: string[]) {
  appState.value = { ...appState.value, selectedFiles: new Set(names) };
}

export function clearSelection() {
  appState.value = { ...appState.value, selectedFiles: new Set() };
}

export function setLoading(loading: boolean) {
  appState.value = { ...appState.value, isLoading: loading };
}

export function toggleSidebar() {
  appState.value = { ...appState.value, sidebarOpen: !appState.value.sidebarOpen };
}
