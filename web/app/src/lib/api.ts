// Typed API client for Nodi backend
// Auto-injects CSRF token, handles 401 redirects, provides typed responses

export interface FileInfo {
  name: string;
  size: number;
  is_dir: boolean;
  mod_time: string;
  ext: string;
  mime: string;
  path?: string;
  parentPath?: string;
}

export interface BreadcrumbSegment {
  name: string;
  path: string;
}

export interface BrowseResponse {
  files: FileInfo[];
  total: number;
  hasMore: boolean;
}

export interface SearchResponse {
  files: FileInfo[];
  total: number;
}

export interface User {
  name: string;
  initials: string;
}

export interface UploadProgress {
  file: string;
  loaded: number;
  total: number;
  percent: number;
  status: 'pending' | 'uploading' | 'paused' | 'skipped' | 'done' | 'error';
  error?: string;
  abort?: () => void;
  speedBps?: number;
  etaSeconds?: number;
  sha256?: string;
}

export type UploadConflictPolicy = 'skip' | 'replace' | 'keep-both';

export interface UploadFile {
  file: File;
  relativePath?: string;
}

export interface UploadOptions {
  conflict?: UploadConflictPolicy;
  verifyHash?: boolean;
}

export interface TrashItem {
  id: string;
  name: string;
  original_path: string;
  is_dir: boolean;
  size: number;
  deleted_at: string;
}

function getCSRFToken(): string {
  const match = document.cookie.match(/ql_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchJSON<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('X-CSRF-Token', getCSRFToken());

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new APIError('Unauthorized', 401);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // try text body
      try { message = await res.text(); } catch { /* ignore */ }
    }
    throw new APIError(message, res.status);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Auth ───────────────────────────────────────────
export const authAPI = {
  whoami: () => fetchJSON<User>('/api/whoami'),
  logout: () => fetchJSON<void>('/logout', { method: 'POST' }),
};

// ─── Browse ─────────────────────────────────────────
// Backend: GET /browse?path=&search=&sort=name|size|modified&order=asc|desc&limit=&page=&showHidden=true
export interface BrowseParams {
  path?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'size' | 'modified';
  sortOrder?: 'asc' | 'desc';
  query?: string;
  showHidden?: boolean;
}

export const browseAPI = {
  list: (params: BrowseParams = {}) => {
    const q = new URLSearchParams();
    if (params.path) q.set('path', params.path);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.sortBy) q.set('sort', params.sortBy);
    if (params.sortOrder) q.set('order', params.sortOrder);
    if (params.query) q.set('search', params.query);
    if (params.showHidden) q.set('showHidden', 'true');
    return fetchJSON<BrowseResponse>(`/browse?${q.toString()}`);
  },
};

export const searchAPI = {
  search: (query: string, params: { limit?: number; showHidden?: boolean } = {}) => {
    const q = new URLSearchParams({ q: query });
    if (params.limit) q.set('limit', String(params.limit));
    if (params.showHidden) q.set('showHidden', 'true');
    return fetchJSON<SearchResponse>(`/api/search?${q.toString()}`);
  },
};

// ─── Files ──────────────────────────────────────────
// Backend expects specific JSON shapes per endpoint
export const fileAPI = {
  // POST /api/folder/create  body: {path, name}
  createFolder: (path: string, name: string) =>
    fetchJSON<void>('/api/folder/create', {
      method: 'POST',
      body: JSON.stringify({ path, name }),
    }),

  // POST /api/file/create  body: {path, name}
  createFile: (path: string, name: string) =>
    fetchJSON<void>('/api/file/create', {
      method: 'POST',
      body: JSON.stringify({ path, name }),
    }),

  // POST /api/rename  body: {oldPath, newName}
  rename: (oldPath: string, newName: string) =>
    fetchJSON<void>('/api/rename', {
      method: 'POST',
      body: JSON.stringify({ oldPath, newName }),
    }),

  // POST /api/delete  body: {path}  (single item)
  delete: (path: string) =>
    fetchJSON<void>('/api/delete', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // POST /api/duplicate  body: {path}
  duplicate: (path: string) =>
    fetchJSON<void>('/api/duplicate', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // POST /api/move  body: {src, dst}
  move: (src: string, dst: string) =>
    fetchJSON<void>('/api/move', {
      method: 'POST',
      body: JSON.stringify({ src, dst }),
    }),

  // POST /api/copy  body: {src, dst}
  copy: (src: string, dst: string) =>
    fetchJSON<void>('/api/copy', {
      method: 'POST',
      body: JSON.stringify({ src, dst }),
    }),

  // POST /api/compress  body: {paths, path?, name?}
  compress: (paths: string[], path?: string, name?: string) =>
    fetchJSON<void>('/api/compress', {
      method: 'POST',
      body: JSON.stringify({ paths, path, name }),
    }),

  // POST /api/extract  body: {path}
  extract: (path: string) =>
    fetchJSON<void>('/api/extract', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // POST /api/restore  body: {name}
  restore: (name: string) =>
    fetchJSON<void>('/api/restore', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
};

// ─── Upload ─────────────────────────────────────────

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
const CHUNK_THRESHOLD = 20 * 1024 * 1024; // use chunks for files > 20MB
const MAX_RETRIES = 3;
const CHUNK_CONCURRENCY = 3;

interface UploadSession {
  uploadId: string;
  fileName: string;
  originalFileName?: string;
  path: string;
  relativePath?: string;
  originalRelativePath?: string;
  skipped?: boolean;
  size: number;
  chunkSize: number;
  totalChunks: number;
  verifyHash?: boolean;
  createdAt: string;
}

interface UploadResult {
  name: string;
  error?: string;
  skipped?: boolean;
  sha256?: string;
}

interface StoredUploadSession extends UploadSession {
  storageKey: string;
}

interface UploadStatus {
  uploadId: string;
  fileName: string;
  path: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  received: number[];
}

interface UploadAbortSignal {
  aborted: boolean;
  uploadId?: string;
  abortXHRs: Set<() => void>;
}

function asUploadFile(input: File | UploadFile): UploadFile {
  if (input instanceof File) {
    return { file: input, relativePath: fileRelativePath(input) };
  }
  return { ...input, relativePath: input.relativePath || fileRelativePath(input.file) };
}

function fileRelativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

async function startUploadSession(upload: UploadFile, path: string, totalChunks: number, options: UploadOptions): Promise<UploadSession> {
  const file = upload.file;
  return fetchJSON<UploadSession>('/api/upload/start', {
    method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        path,
        relativePath: upload.relativePath || file.name,
        conflict: options.conflict || 'skip',
        size: file.size,
        chunkSize: CHUNK_SIZE,
        totalChunks,
        verifyHash: !!options.verifyHash,
      }),
    });
}

function normalizeUploadPath(path: string): string {
  return path || '/';
}

function uploadStorageKey(upload: UploadFile, path: string): string {
  const file = upload.file;
  return `nodi.upload.${normalizeUploadPath(path)}.${upload.relativePath || file.name}.${file.size}.${file.lastModified}`;
}

function loadStoredUploadSession(upload: UploadFile, path: string): StoredUploadSession | null {
  const file = upload.file;
  const storageKey = uploadStorageKey(upload, path);
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as UploadSession;
    if (
      (session.originalFileName || session.fileName) === file.name &&
      (session.originalRelativePath || session.relativePath) === (upload.relativePath || file.name) &&
      session.path === normalizeUploadPath(path) &&
      session.size === file.size &&
      session.chunkSize === CHUNK_SIZE &&
      session.totalChunks === Math.ceil(file.size / CHUNK_SIZE)
    ) {
      return { ...session, storageKey };
    }
  } catch {
    // Bad local metadata should not block a fresh upload.
  }
  localStorage.removeItem(storageKey);
  return null;
}

function saveUploadSession(upload: UploadFile, path: string, session: UploadSession): StoredUploadSession {
  const storageKey = uploadStorageKey(upload, path);
  localStorage.setItem(storageKey, JSON.stringify(session));
  return { ...session, storageKey };
}

function clearUploadSession(session: StoredUploadSession): void {
  localStorage.removeItem(session.storageKey);
}

async function getUploadStatus(uploadId: string): Promise<UploadStatus> {
  return fetchJSON<UploadStatus>(`/api/upload/status?uploadId=${encodeURIComponent(uploadId)}`);
}

async function cancelUploadSession(uploadId: string): Promise<void> {
  await fetchJSON<void>(`/api/upload/${encodeURIComponent(uploadId)}`, { method: 'DELETE' });
}

function uploadChunk(
  file: File,
  chunkIndex: number,
  totalChunks: number,
  uploadId: string,
  path: string,
  signal?: UploadAbortSignal,
  onProgress?: (loaded: number) => void,
): Promise<void> {
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const blob = file.slice(start, end);

  const form = new FormData();
  form.append('flowId', uploadId);
  form.append('chunkIndex', String(chunkIndex));
  form.append('fileName', file.name);
  form.append('chunk', blob);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abortXHR = () => xhr.abort();
    signal?.abortXHRs.add(abortXHR);
    xhr.open('POST', '/api/upload/chunk');
    xhr.setRequestHeader('X-CSRF-Token', getCSRFToken());
    xhr.timeout = 120000; // 120s per chunk

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Chunk ${chunkIndex} failed: HTTP ${xhr.status}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error(`Chunk ${chunkIndex} network error`)));
    xhr.addEventListener('timeout', () => reject(new Error(`Chunk ${chunkIndex} timeout`)));
    xhr.addEventListener('abort', () => reject(new Error(`Chunk ${chunkIndex} aborted`)));

    xhr.send(form);
    xhr.addEventListener('loadend', () => signal?.abortXHRs.delete(abortXHR));
  });
}

async function uploadChunked(
  upload: UploadFile,
  path: string,
  options: UploadOptions,
  onProgress: (loaded: number, total: number) => void,
  signal?: UploadAbortSignal,
): Promise<{ skipped?: boolean; fileName?: string; sha256?: string }> {
  const file = upload.file;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let session = loadStoredUploadSession(upload, path);
  let status: UploadStatus | null = null;

  if (session) {
    try {
      status = await getUploadStatus(session.uploadId);
    } catch {
      clearUploadSession(session);
      session = null;
    }
  }

  if (!session) {
    const started = await startUploadSession(upload, normalizeUploadPath(path), totalChunks, options);
    if (started.skipped) {
      return { skipped: true, fileName: started.fileName || upload.file.name };
    }
    started.originalRelativePath = upload.relativePath || file.name;
    started.originalFileName = file.name;
    session = saveUploadSession(upload, path, started);
    status = await getUploadStatus(session.uploadId);
  }
  if (signal) signal.uploadId = session.uploadId;
  if (!status) {
    throw new Error('Could not read upload status');
  }

  const received = new Set(status.received);
  let completedBytes = 0;
  for (const idx of received) {
    completedBytes += chunkByteLength(file, idx);
  }
  const inFlight = new Map<number, number>();
  const pendingChunks: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!received.has(i)) pendingChunks.push(i);
  }

  const emitProgress = () => {
    const inFlightBytes = Array.from(inFlight.values()).reduce((sum, value) => sum + value, 0);
    onProgress(Math.min(completedBytes + inFlightBytes, file.size), file.size);
  };
  emitProgress();

  let nextPending = 0;
  const worker = async () => {
    while (nextPending < pendingChunks.length) {
      if (signal?.aborted) throw new Error('Aborted');
      const i = pendingChunks[nextPending++];
      if (received.has(i)) continue;
      let attempts = 0;
      let lastErr: Error | null = null;

      while (attempts < MAX_RETRIES) {
        try {
          inFlight.set(i, 0);
          emitProgress();
          await uploadChunk(file, i, totalChunks, session.uploadId, path, signal, (loaded) => {
            inFlight.set(i, loaded);
            emitProgress();
          });
          inFlight.delete(i);
          received.add(i);
          completedBytes += chunkByteLength(file, i);
          emitProgress();
          lastErr = null;
          break;
        } catch (e) {
          inFlight.delete(i);
          lastErr = e as Error;
          attempts++;
          emitProgress();
          if (signal?.aborted) throw lastErr;

          try {
            const freshStatus = await getUploadStatus(session.uploadId);
            for (const receivedIndex of freshStatus.received) {
              if (!received.has(receivedIndex)) {
                received.add(receivedIndex);
                completedBytes += chunkByteLength(file, receivedIndex);
              }
            }
            emitProgress();
            if (received.has(i)) {
              lastErr = null;
              break;
            }
          } catch {
            // If the status request fails too, keep the retry path alive. A later
            // retry or manual Retry will use the persisted upload id and status.
          }

          if (attempts < MAX_RETRIES) {
            await waitForNetworkRecovery();
            await new Promise((r) => setTimeout(r, retryDelay(attempts)));
          }
        }
      }

      if (lastErr) throw lastErr;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CHUNK_CONCURRENCY, pendingChunks.length) }, () => worker()),
  );

  // Complete
  const res = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
    },
    body: JSON.stringify({
      uploadId: session.uploadId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Complete failed: ${text || res.status}`);
  }
  const payload = await res.json().catch(() => ({ success: true } as { sha256?: string }));
  clearUploadSession(session);
  if (signal) signal.uploadId = undefined;
  return { fileName: session.fileName, sha256: payload?.sha256 };
}

function chunkByteLength(file: File, chunkIndex: number): number {
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  return Math.max(0, end - start);
}

function browserAppearsOffline(): boolean {
  return typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false;
}

async function waitForNetworkRecovery(maxWaitMs = 30000): Promise<void> {
  if (!browserAppearsOffline()) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('online', finish);
      resolve();
    };
    window.addEventListener('online', finish, { once: true });
    window.setTimeout(finish, maxWaitMs);
  });
}

function retryDelay(attempt: number): number {
  const base = 1000 * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
}

export const uploadAPI = {
  upload: (
    files: Array<File | UploadFile>,
    path: string,
    onProgress?: (progress: UploadProgress[]) => void,
    options: UploadOptions = {},
  ) => {
    const uploadFiles = files.map(asUploadFile);
    const progresses: UploadProgress[] = uploadFiles.map((u) => ({
      file: u.relativePath || u.file.name,
      loaded: 0,
      total: u.file.size,
      percent: 0,
      status: 'pending' as const,
    }));

    const abortSignals = new Map<number, UploadAbortSignal>();

    const uploads = uploadFiles.map((upload, i) => {
      const file = upload.file;
      const p = progresses[i];
      const signal: UploadAbortSignal = { aborted: false, abortXHRs: new Set() };
      abortSignals.set(i, signal);

      return new Promise<void>(async (resolve, reject) => {
        p.status = 'uploading';
        const startedAt = Date.now();

        const updateProgress = (loaded: number, total: number) => {
          p.loaded = loaded;
          p.total = total;
          p.percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
          const elapsedSeconds = Math.max(0.001, (Date.now() - startedAt) / 1000);
          p.speedBps = loaded / elapsedSeconds;
          p.etaSeconds = p.speedBps > 0 && loaded < total ? Math.ceil((total - loaded) / p.speedBps) : undefined;
          onProgress?.([...progresses]);
        };

        try {
          if (file.size > CHUNK_THRESHOLD) {
            // Chunked upload for large files
            await uploadChunked(
              upload,
              path,
              options,
              (loaded, total) => {
                updateProgress(loaded, total);
              },
              signal,
            ).then((result) => {
              if (result.fileName) p.file = result.fileName;
              if (result.sha256) p.sha256 = result.sha256;
              if (result.skipped) {
                p.status = 'skipped';
                p.loaded = 0;
                p.percent = 100;
                p.speedBps = undefined;
                p.etaSeconds = undefined;
                onProgress?.([...progresses]);
              }
            });
          } else {
            // Single-request upload for small files
            const form = new FormData();
            form.append('conflict', options.conflict || 'skip');
            if (options.verifyHash) form.append('verifyHash', 'true');
            form.append('path', path);
            form.append('relativePath', upload.relativePath || file.name);
            form.append('files', file);

            await new Promise<void>((res, rej) => {
              const xhr = new XMLHttpRequest();
              const abortXHR = () => xhr.abort();
              signal.abortXHRs.add(abortXHR);
              xhr.timeout = 300000; // 5 minutes for small files

              xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  updateProgress(e.loaded, e.total);
                }
              });

              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const results = JSON.parse(xhr.responseText || '[]') as UploadResult[];
                    const result = results[0];
                    if (result?.name) p.file = result.name;
                    if (result?.sha256) p.sha256 = result.sha256;
                    if (result?.skipped) {
                      p.status = 'skipped';
                      p.loaded = 0;
                      p.percent = 100;
                      onProgress?.([...progresses]);
                    }
                    if (result?.error) {
                      rej(new Error(result.error));
                      return;
                    }
                  } catch {
                    // Older servers may return an empty success body.
                  }
                  res();
                } else {
                  rej(new Error(`HTTP ${xhr.status}`));
                }
              });

              xhr.addEventListener('error', () => rej(new Error('Network error')));
              xhr.addEventListener('timeout', () => rej(new Error('Upload timeout')));
              xhr.addEventListener('abort', () => rej(new Error('Aborted')));
              xhr.addEventListener('loadend', () => signal.abortXHRs.delete(abortXHR));

              xhr.open('POST', '/api/upload');
              xhr.setRequestHeader('X-CSRF-Token', getCSRFToken());
              xhr.send(form);
            });
          }

          if ((p as UploadProgress).status !== 'skipped') {
            p.status = 'done';
            p.percent = 100;
            p.loaded = p.total;
          }
          p.speedBps = undefined;
          p.etaSeconds = undefined;
          onProgress?.([...progresses]);
          resolve();
        } catch (err) {
          p.status = 'error';
          p.error = (err as Error).message || 'Upload failed';
          onProgress?.([...progresses]);
          reject(new APIError(p.error, 0));
        }
      });
    });

    return {
      progresses,
      uploads: Promise.all(uploads),
      abort: (index: number, options: { cancelSession?: boolean } = {}) => {
        const signal = abortSignals.get(index);
        if (signal) {
          signal.aborted = true;
          for (const abortXHR of Array.from(signal.abortXHRs)) abortXHR();
          if (signal.uploadId && options.cancelSession !== false) {
            void cancelUploadSession(signal.uploadId);
          }
        }
      },
    };
  },
};

// ─── Download / Preview ─────────────────────────────
export const downloadAPI = {
  downloadUrl: (path: string, isDir = false) => {
    const q = new URLSearchParams({ path });
    if (isDir) q.set('format', 'zip');
    return `/api/download?${q.toString()}`;
  },
  downloadSelection: async (paths: string[]) => {
    const res = await fetch('/api/compress', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken(),
      },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'download.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  thumbUrl: (path: string) => `/api/thumb?path=${encodeURIComponent(path)}`,
  streamUrl: (path: string) => `/api/stream?path=${encodeURIComponent(path)}`,
  editUrl: (path: string) => `/api/edit?path=${encodeURIComponent(path)}`,
};

export const textFileAPI = {
  read: async (path: string) => {
    const res = await fetch(downloadAPI.editUrl(path), {
      credentials: 'same-origin',
      headers: {
        'Accept': 'text/plain',
        'X-CSRF-Token': getCSRFToken(),
      },
    });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    return res.text();
  },
  save: async (path: string, content: string) => {
    const res = await fetch(downloadAPI.editUrl(path), {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-CSRF-Token': getCSRFToken(),
      },
      body: content,
    });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  },
};

export interface FileHash {
  path: string;
  algorithm: 'sha256';
  hash: string;
  size: number;
}

export const hashAPI = {
  calculate: (path: string) => fetchJSON<FileHash>(`/api/hash?path=${encodeURIComponent(path)}`),
};

// ─── Favorites ──────────────────────────────────────
// Backend: POST /api/favorite  body: {path}  — adds favorite
//          DELETE /api/favorite  body: {path} — removes favorite
//          GET /api/favorite — returns string[] (or reads .nodifav.json)
export const favoritesAPI = {
  list: () => fetchJSON<string[]>('/api/favorite'),
  add: (path: string) =>
    fetchJSON<void>('/api/favorite', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  remove: (path: string) =>
    fetchJSON<void>('/api/favorite', {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    }),
};

export const recentAPI = {
  list: () => fetchJSON<{ files: FileInfo[] }>('/api/recent'),
};

// ─── Trash ──────────────────────────────────────────
export const trashAPI = {
  list: () => fetchJSON<{ items: TrashItem[] }>('/api/trash'),
  restore: (id: string) => fileAPI.restore(id),
  delete: (id: string) => fetchJSON<void>(`/api/trash?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  empty: () => fetchJSON<void>('/api/trash', { method: 'DELETE' }),
};

export const cleanupAPI = {
  run: (target: 'uploads' | 'trash' | 'all') =>
    fetchJSON<{ trash_removed?: number }>('/api/cleanup', {
      method: 'POST',
      body: JSON.stringify({ target }),
    }),
};

// ─── Storage ─────────────────────────────────────────
export interface StorageStats {
  used: number;
  total: number;
  free: number;
  file_count: number;
  dir_count: number;
}

export const storageAPI = {
  stats: () => fetchJSON<StorageStats>('/api/storage'),
};

export interface HealthDetails {
  status: string;
  version: string;
  uptime: string;
  storage: StorageStats;
  active_uploads: number;
  abandoned_uploads: number;
  trash_items: number;
  upload_ttl_seconds: number;
  trash_retention_sec: number;
}

export const healthAPI = {
  details: () => fetchJSON<HealthDetails>('/api/health/details'),
};

// ─── Password ────────────────────────────────────────
export const passwordAPI = {
  change: (currentPassword: string, newPassword: string) =>
    fetchJSON<{ success: boolean }>('/api/password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),
};

// ─── Version ─────────────────────────────────────────
export interface VersionInfo {
  version: string;
  go_version: string;
}

export const versionAPI = {
  get: () => fetchJSON<VersionInfo>('/api/version'),
};

// ─── Devices ────────────────────────────────────────
export interface DeviceAddress {
  label: string;
  url: string;
  webdav: string;
}

export interface DevicesInfo {
  recommended: string;
  addresses: DeviceAddress[];
}

export const devicesAPI = {
  get: () => fetchJSON<DevicesInfo>('/api/devices'),
};

// ─── Shares ──────────────────────────────────────────
export interface Share {
  token: string;
  path: string;
  is_dir: boolean;
  created_at: string;
  created_by?: string;
  expires_at: string | null;
  has_password: boolean;
  mode: 'read' | 'upload';
  url: string;
  status?: 'active' | 'expired';
  max_file_size?: number;
  max_file_count?: number;
}

export const shareAPI = {
  list: () => fetchJSON<Share[]>('/api/share'),
  create: (params: { path: string; expires_at?: string; password?: string; mode: 'read' | 'upload'; max_file_size?: number; max_file_count?: number }) =>
    fetchJSON<{ token: string; url: string }>('/api/share', { method: 'POST', body: JSON.stringify(params) }),
  revoke: (token: string) =>
    fetchJSON<void>(`/api/share?token=${encodeURIComponent(token)}`, { method: 'DELETE' }),
};

// ─── Activity ─────────────────────────────────────────
export interface ActivityEvent {
  at: string;
  user: string;
  action: string;
  path: string;
  extra?: string;
}

export const activityAPI = {
  list: (limit = 50) => fetchJSON<ActivityEvent[]>(`/api/activity?limit=${limit}`),
};

// ─── Backup ──────────────────────────────────────────
export const backupAPI = {
  downloadUrl: () => '/api/backup',
  restore: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const csrfMatch = document.cookie.match(/ql_csrf=([^;]+)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    return fetch('/api/restore-backup', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken, 'X-Confirm': 'DELETE' },
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    });
  },
};

export { APIError, fetchJSON };
