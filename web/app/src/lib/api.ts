// Typed API client for Nodi backend
// Auto-injects CSRF token, handles 401 redirects, provides typed responses

export interface FileInfo {
  name: string;
  size: number;
  is_dir: boolean;
  mod_time: string;
  ext: string;
  mime: string;
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

export interface User {
  name: string;
  initials: string;
}

export interface UploadProgress {
  file: string;
  loaded: number;
  total: number;
  percent: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  abort?: () => void;
}

export interface TrashItem {
  name: string;
  original_path: string;
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

  // POST /api/compress  body: {paths}
  compress: (paths: string[]) =>
    fetchJSON<void>('/api/compress', {
      method: 'POST',
      body: JSON.stringify({ paths }),
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

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const CHUNK_THRESHOLD = 5 * 1024 * 1024; // use chunks for files > 5MB
const MAX_RETRIES = 3;

function uploadChunk(
  file: File,
  chunkIndex: number,
  totalChunks: number,
  flowId: string,
  path: string,
): Promise<void> {
  const start = chunkIndex * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const blob = file.slice(start, end);

  const form = new FormData();
  form.append('chunk', blob);
  form.append('flowId', flowId);
  form.append('chunkIndex', String(chunkIndex));
  form.append('fileName', file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/chunk');
    xhr.setRequestHeader('X-CSRF-Token', getCSRFToken());
    xhr.timeout = 30000; // 30s per chunk

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
  });
}

async function uploadChunked(
  file: File,
  path: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: { aborted: boolean },
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const flowId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new Error('Aborted');

    let attempts = 0;
    let lastErr: Error | null = null;

    while (attempts < MAX_RETRIES) {
      try {
        await uploadChunk(file, i, totalChunks, flowId, path);
        onProgress(Math.min((i + 1) * CHUNK_SIZE, file.size), file.size);
        break;
      } catch (e) {
        lastErr = e as Error;
        attempts++;
        if (attempts < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * attempts)); // exponential backoff
        }
      }
    }

    if (attempts >= MAX_RETRIES && lastErr) {
      throw lastErr;
    }
  }

  // Complete
  const res = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken(),
    },
    body: JSON.stringify({
      flowId,
      fileName: file.name,
      path,
      totalChunks,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Complete failed: ${text || res.status}`);
  }
}

export const uploadAPI = {
  upload: (
    files: File[],
    path: string,
    onProgress?: (progress: UploadProgress[]) => void,
  ) => {
    const progresses: UploadProgress[] = files.map((f) => ({
      file: f.name,
      loaded: 0,
      total: f.size,
      percent: 0,
      status: 'pending' as const,
    }));

    const abortSignals = new Map<number, { aborted: boolean }>();

    const uploads = files.map((file, i) => {
      const p = progresses[i];
      const signal = { aborted: false };
      abortSignals.set(i, signal);

      return new Promise<void>(async (resolve, reject) => {
        p.status = 'uploading';

        try {
          if (file.size > CHUNK_THRESHOLD) {
            // Chunked upload for large files
            await uploadChunked(
              file,
              path,
              (loaded, total) => {
                p.loaded = loaded;
                p.total = total;
                p.percent = Math.round((loaded / total) * 100);
                onProgress?.([...progresses]);
              },
              signal,
            );
          } else {
            // Single-request upload for small files
            const form = new FormData();
            form.append('files', file);
            form.append('path', path);

            await new Promise<void>((res, rej) => {
              const xhr = new XMLHttpRequest();
              xhr.timeout = 300000; // 5 minutes for small files

              xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  p.loaded = e.loaded;
                  p.total = e.total;
                  p.percent = Math.round((e.loaded / e.total) * 100);
                  onProgress?.([...progresses]);
                }
              });

              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  res();
                } else {
                  rej(new Error(`HTTP ${xhr.status}`));
                }
              });

              xhr.addEventListener('error', () => rej(new Error('Network error')));
              xhr.addEventListener('timeout', () => rej(new Error('Upload timeout')));
              xhr.addEventListener('abort', () => rej(new Error('Aborted')));

              xhr.open('POST', '/api/upload');
              xhr.setRequestHeader('X-CSRF-Token', getCSRFToken());
              xhr.send(form);
            });
          }

          p.status = 'done';
          p.percent = 100;
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
      abort: (index: number) => {
        const signal = abortSignals.get(index);
        if (signal) signal.aborted = true;
      },
    };
  },
};

// ─── Download / Preview ─────────────────────────────
export const downloadAPI = {
  downloadUrl: (path: string) => `/api/download?path=${encodeURIComponent(path)}`,
  thumbUrl: (path: string) => `/api/thumb?path=${encodeURIComponent(path)}`,
  streamUrl: (path: string) => `/api/stream?path=${encodeURIComponent(path)}`,
  editUrl: (path: string) => `/api/edit?path=${encodeURIComponent(path)}`,
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
  restore: (name: string) => fileAPI.restore(name),
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

// ─── Shares ──────────────────────────────────────────
export interface Share {
  token: string;
  path: string;
  is_dir: boolean;
  created_at: string;
  expires_at: string | null;
  has_password: boolean;
  mode: 'read' | 'upload';
  url: string;
}

export const shareAPI = {
  list: () => fetchJSON<Share[]>('/api/share'),
  create: (params: { path: string; expires_at?: string; password?: string; mode: 'read' | 'upload' }) =>
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
