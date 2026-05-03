import { describe, it, expect } from 'vitest';
import { appState, setPath, setFiles, setViewMode, setSort, toggleSelect, clearSelection } from '../stores/app';

describe('app store', () => {
  it('sets path and clears selection', () => {
    toggleSelect('file1.txt');
    expect(appState.value.selectedFiles.has('file1.txt')).toBe(true);

    setPath('/new/path', [{ name: 'new', path: '/new' }]);
    expect(appState.value.currentPath).toBe('/new/path');
    expect(appState.value.selectedFiles.size).toBe(0);
  });

  it('toggles file selection', () => {
    clearSelection();
    toggleSelect('file1.txt');
    expect(appState.value.selectedFiles.has('file1.txt')).toBe(true);

    toggleSelect('file1.txt');
    expect(appState.value.selectedFiles.has('file1.txt')).toBe(false);
  });

  it('sets view mode and persists to localStorage', () => {
    setViewMode('grid');
    expect(appState.value.viewMode).toBe('grid');
    expect(localStorage.getItem('ql-view-mode')).toBe('grid');
  });

  it('sets sort options and persists', () => {
    setSort('size', 'desc');
    expect(appState.value.sortBy).toBe('size');
    expect(appState.value.sortOrder).toBe('desc');
    expect(localStorage.getItem('ql-sort-by')).toBe('size');
    expect(localStorage.getItem('ql-sort-order')).toBe('desc');
  });

  it('sets files and clears loading', () => {
    const testFiles = [{
      name: 'test.txt',
      size: 100,
      is_dir: false,
      mod_time: new Date().toISOString(),
      ext: '.txt',
      mime: 'text/plain',
    }];
    setFiles(testFiles);
    expect(appState.value.files).toEqual(testFiles);
    expect(appState.value.isLoading).toBe(false);
  });
});
