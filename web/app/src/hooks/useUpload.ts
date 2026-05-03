import { signal } from '@preact/signals';
import { uploadAPI } from '../lib/api';
import type { UploadProgress } from '../lib/api';

export interface UploadItem extends UploadProgress {
  id: string;
}

export const uploads = signal<UploadItem[]>([]);
export const panelOpen = signal(false);

let idCounter = 0;

function generateId(): string {
  return `upload-${++idCounter}-${Date.now()}`;
}

export function useUpload() {
  return { uploads, panelOpen };
}

export async function uploadFiles(files: File[], path: string, onComplete?: () => void) {
  if (files.length === 0) return;

  const items: UploadItem[] = files.map(f => ({
    id: generateId(),
    file: f.name,
    loaded: 0,
    total: f.size,
    percent: 0,
    status: 'pending' as const,
  }));

  uploads.value = [...uploads.value, ...items];
  panelOpen.value = true;

  const { progresses, uploads: promise } = uploadAPI.upload(
    files,
    path,
    (updated) => {
      uploads.value = uploads.value.map(u => {
        const found = updated.find(p => p.file === u.file);
        return found ? { ...u, ...found } : u;
      });
    },
  );

  try {
    await promise;
    // Mark all as done
    uploads.value = uploads.value.map(u => {
      if (items.find(i => i.id === u.id)) {
        return { ...u, status: 'done' as const, percent: 100 };
      }
      return u;
    });
    onComplete?.();
    // Auto-hide after 2s if all done
    setTimeout(() => {
      const allDone = uploads.value.every(u => u.status === 'done');
      if (allDone) panelOpen.value = false;
    }, 2000);
  } catch {
    // Error state already set by uploadAPI
  }
}

export function cancelUpload(id: string) {
  // Find and abort if still in progress
  const item = uploads.value.find(u => u.id === id);
  if (item && item.status === 'uploading') {
    item.abort?.();
  }
}

export function clearUploads() {
  uploads.value = [];
  panelOpen.value = false;
}

export function togglePanel() {
  panelOpen.value = !panelOpen.value;
}
