import { signal } from '@preact/signals';
import { uploadAPI } from '../lib/api';
import type { UploadFile, UploadOptions, UploadProgress } from '../lib/api';

export interface UploadItem extends UploadProgress {
  id: string;
  group: string;
}

export interface UploadHistoryItem {
  id: string;
  file: string;
  group: string;
  total: number;
  status: 'done' | 'skipped' | 'error' | 'canceled';
  finishedAt: string;
  error?: string;
  sha256?: string;
}

interface UploadController {
  upload: UploadFile;
  path: string;
  options: UploadOptions;
  onComplete?: () => void;
  abort?: (options?: { cancelSession?: boolean }) => void;
  runToken: number;
}

export const uploads = signal<UploadItem[]>([]);
export const panelOpen = signal(false);
export const transferHistory = signal<UploadHistoryItem[]>(loadTransferHistory());
export const mobileUploadWarning = signal<string>('');

let idCounter = 0;
let beforeUnloadGuardEnabled = false;
const controllers = new Map<string, UploadController>();
const HISTORY_STORAGE_KEY = 'nodi.transferHistory';

function hasActiveUploads() {
  return uploads.value.some(u => u.status === 'pending' || u.status === 'uploading');
}

function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (!hasActiveUploads()) return;
  e.preventDefault();
  e.returnValue = '';
}

function syncBeforeUnloadGuard() {
  const shouldEnable = hasActiveUploads();
  if (shouldEnable && !beforeUnloadGuardEnabled) {
    window.addEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadGuardEnabled = true;
  } else if (!shouldEnable && beforeUnloadGuardEnabled) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadGuardEnabled = false;
  }
  mobileUploadWarning.value = shouldEnable
    ? 'Keep this browser tab open while uploads are running. Some phones pause background tabs and can interrupt long transfers.'
    : '';
}

function generateId(): string {
  return `upload-${++idCounter}-${Date.now()}`;
}

export function useUpload() {
  return { uploads, panelOpen, transferHistory, mobileUploadWarning };
}

export async function uploadFiles(files: Array<File | UploadFile>, path: string, onComplete?: () => void, options: UploadOptions = {}) {
  if (files.length === 0) return;

  const normalized = files.map(normalizeUploadFile);
  const items: UploadItem[] = normalized.map(f => ({
    id: generateId(),
    file: f.relativePath || f.file.name,
    group: uploadGroupLabel(f.relativePath || f.file.name),
    loaded: 0,
    total: f.file.size,
    percent: 0,
    status: 'pending' as const,
  }));

  uploads.value = [...uploads.value, ...items];
  panelOpen.value = true;
  syncBeforeUnloadGuard();

  const group = { remaining: items.length, completed: 0 };

  for (let i = 0; i < items.length; i++) {
    const controller: UploadController = {
      upload: normalized[i],
      path,
      options,
      onComplete: () => {
        group.completed++;
        if (group.completed === group.remaining) onComplete?.();
      },
      runToken: 0,
    };
    controllers.set(items[i].id, controller);
    void startUploadItem(items[i].id);
  }
}

function normalizeUploadFile(entry: File | UploadFile): UploadFile {
  if (entry instanceof File) {
    return { file: entry, relativePath: (entry as File & { webkitRelativePath?: string }).webkitRelativePath || entry.name };
  }
  return entry;
}

async function startUploadItem(id: string) {
  const controller = controllers.get(id);
  if (!controller) return;
  const runToken = ++controller.runToken;

  updateUpload(id, (item) => ({
    ...item,
    status: 'uploading',
    error: undefined,
    abort: () => pauseUpload(id),
  }));
  syncBeforeUnloadGuard();

  const { uploads: promise, abort } = uploadAPI.upload(
    [controller.upload],
    controller.path,
    (updated) => {
      if (controller.runToken !== runToken) return;
      const progress = updated[0];
      if (!progress) return;
      updateUpload(id, (item) => ({
        ...item,
        ...progress,
        status: progress.status === 'error' && item.status === 'paused' ? 'paused' : progress.status,
        abort: () => pauseUpload(id),
      }));
      syncBeforeUnloadGuard();
    },
    controller.options,
  );
  controller.abort = (options) => abort(0, options);

  try {
    await promise;
    if (controller.runToken !== runToken) return;
    updateUpload(id, (item) => {
      if (item.status === 'skipped') {
        return { ...item, loaded: 0, percent: 100, speedBps: undefined, etaSeconds: undefined };
      }
      return { ...item, status: 'done', loaded: item.total, percent: 100, speedBps: undefined, etaSeconds: undefined };
    });
    const finished = uploads.value.find((item) => item.id === id);
    if (finished) {
      pushTransferHistory({
        id: finished.id,
        file: finished.file,
        group: finished.group,
        total: finished.total,
        status: finished.status === 'skipped' ? 'skipped' : 'done',
        finishedAt: new Date().toISOString(),
        sha256: finished.sha256,
      });
    }
    controller.onComplete?.();
    maybeAutoHide();
  } catch (err) {
    if (controller.runToken !== runToken) return;
    const current = uploads.value.find((item) => item.id === id);
    if (current?.status === 'paused') return;
    updateUpload(id, (item) => ({
      ...item,
      status: 'error',
      error: (err as Error).message || item.error || 'Upload failed',
      speedBps: undefined,
      etaSeconds: undefined,
    }));
    const failed = uploads.value.find((item) => item.id === id);
    if (failed) {
      pushTransferHistory({
        id: failed.id,
        file: failed.file,
        group: failed.group,
        total: failed.total,
        status: 'error',
        finishedAt: new Date().toISOString(),
        error: (err as Error).message || failed.error || 'Upload failed',
      });
    }
  } finally {
    if (controller.runToken === runToken) {
      controller.abort = undefined;
      syncBeforeUnloadGuard();
    }
  }
}

function updateUpload(id: string, updater: (item: UploadItem) => UploadItem) {
  uploads.value = uploads.value.map((item) => item.id === id ? updater(item) : item);
}

function maybeAutoHide() {
  syncBeforeUnloadGuard();
  setTimeout(() => {
    const allDone = uploads.value.length > 0 && uploads.value.every(u => u.status === 'done');
    if (allDone) panelOpen.value = false;
  }, 2000);
}

export function pauseUpload(id: string) {
  const controller = controllers.get(id);
  if (!controller) return;
  controller.runToken++;
  controller.abort?.({ cancelSession: false });
  updateUpload(id, (item) => ({ ...item, status: 'paused', speedBps: undefined, etaSeconds: undefined, error: undefined }));
  syncBeforeUnloadGuard();
}

export function resumeUpload(id: string) {
  const item = uploads.value.find(u => u.id === id);
  if (!item || item.status !== 'paused') return;
  void startUploadItem(id);
}

export function retryUpload(id: string) {
  const item = uploads.value.find(u => u.id === id);
  if (!item || item.status !== 'error') return;
  void startUploadItem(id);
}

export function cancelUpload(id: string) {
  const item = uploads.value.find((entry) => entry.id === id);
  const controller = controllers.get(id);
  if (controller) {
    controller.runToken++;
    controller.abort?.({ cancelSession: true });
    controllers.delete(id);
  }
  uploads.value = uploads.value.filter((item) => item.id !== id);
  if (item) {
    pushTransferHistory({
      id: item.id,
      file: item.file,
      group: item.group,
      total: item.total,
      status: 'canceled',
      finishedAt: new Date().toISOString(),
    });
  }
  syncBeforeUnloadGuard();
}

export function clearUploads() {
  for (const item of uploads.value) {
    if (item.status === 'pending' || item.status === 'uploading') {
      cancelUpload(item.id);
    }
  }
  controllers.clear();
  uploads.value = [];
  panelOpen.value = false;
  syncBeforeUnloadGuard();
}

/* Remove only finished/skipped/error items from the panel. Active uploads
   keep running. Use this from the upload panel "clear" button so the user
   can never accidentally kill a 20 GB upload by clicking the dismiss
   affordance meant for completed entries. */
export function clearCompleted() {
  uploads.value = uploads.value.filter(
    (item) => item.status !== 'done' && item.status !== 'skipped' && item.status !== 'error',
  );
  if (uploads.value.length === 0) {
    panelOpen.value = false;
  }
  syncBeforeUnloadGuard();
}

export function togglePanel() {
  panelOpen.value = !panelOpen.value;
}

function uploadGroupLabel(relativePath: string): string {
  const clean = relativePath.replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length <= 1) return 'Loose files';
  return parts.slice(0, -1).join('/');
}

function loadTransferHistory(): UploadHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UploadHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransferHistory() {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(transferHistory.value.slice(0, 50)));
}

function pushTransferHistory(item: UploadHistoryItem) {
  transferHistory.value = [item, ...transferHistory.value.filter((entry) => entry.id !== item.id)].slice(0, 50);
  saveTransferHistory();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && hasActiveUploads()) {
      mobileUploadWarning.value = 'Uploads are still running. Keep Nodi visible if your browser pauses background transfers.';
    } else if (!document.hidden && hasActiveUploads()) {
      mobileUploadWarning.value = 'Keep this browser tab open while uploads are running. Some phones pause background tabs and can interrupt long transfers.';
    }
  });
}
