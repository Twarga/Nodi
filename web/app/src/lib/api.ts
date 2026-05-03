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
  path: BreadcrumbSegment[];
  files: FileInfo[];
  total: number;
  page: number;
  per_page: number;
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
  const match = document.cookie.match(/csrf_token=([^;]+)/);
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
      // ignore
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
export interface BrowseParams {
  path?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'name' | 'size' | 'date';
  sortOrder?: 'asc' | 'desc';
  query?: string;
}

export const browseAPI = {
  list: (params: BrowseParams = {}) => {
    const q = new URLSearchParams();
    if (params.path) q.set('path', params.path);
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    if (params.sortBy) q.set('sort', params.sortBy);
    if (params.sortOrder) q.set('order', params.sortOrder);
    if (params.query) q.set('q', params.query);
    return fetchJSON<BrowseResponse>(`/browse?${q.toString()}`);
  },
};

// ─── Files ──────────────────────────────────────────
export const fileAPI = {
  createFolder: (path: string, name: string) =>
    fetchJSON<void>('/api/folder/create', {
      method: 'POST',
      body: JSON.stringify({ path, name }),
    }),

  createFile: (path: string, name: string) =>
    fetchJSON<void>('/api/file/create', {
      method: 'POST',
      body: JSON.stringify({ path, name }),
    }),

  rename: (path: string, newName: string) =>
    fetchJSON<void>('/api/rename', {
      method: 'POST',
      body: JSON.stringify({ path, newName }),
    }),

  delete: (paths: string[]) =>
    fetchJSON<void>('/api/delete', {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),

  duplicate: (path: string) =>
    fetchJSON<void>('/api/duplicate', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  move: (paths: string[], destination: string) =>
    fetchJSON<void>('/api/move', {
      method: 'POST',
      body: JSON.stringify({ paths, destination }),
    }),

  copy: (paths: string[], destination: string) =>
    fetchJSON<void>('/api/copy', {
      method: 'POST',
      body: JSON.stringify({ paths, destination }),
    }),

  compress: (paths: string[]) =>
    fetchJSON<void>('/api/compress', {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),

  extract: (path: string) =>
    fetchJSON<void>('/api/extract', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  restore: (name: string) =>
    fetchJSON<void>('/api/restore', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
};

// ─── Upload ─────────────────────────────────────────
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

    const uploads = files.map((file, i) => {
      const form = new FormData();
      form.append('files', file);
      form.append('path', path);

      const xhr = new XMLHttpRequest();
      const p = progresses[i];

      return new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            p.loaded = e.loaded;
            p.total = e.total;
            p.percent = Math.round((e.loaded / e.total) * 100);
            p.status = 'uploading';
            onProgress?.([...progresses]);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            p.status = 'done';
            p.percent = 100;
            onProgress?.([...progresses]);
            resolve();
          } else {
            p.status = 'error';
            p.error = `HTTP ${xhr.status}`;
            onProgress?.([...progresses]);
            reject(new APIError(p.error, xhr.status));
          }
        });

        xhr.addEventListener('error', () => {
          p.status = 'error';
          p.error = 'Network error';
          onProgress?.([...progresses]);
          reject(new APIError('Network error', 0));
        });

        xhr.addEventListener('abort', () => {
          p.status = 'error';
          p.error = 'Aborted';
          onProgress?.([...progresses]);
          reject(new APIError('Aborted', 0));
        });

        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('X-CSRF-Token', getCSRFToken());
        xhr.send(form);

        p.abort = () => xhr.abort();
      });
    });

    return { progresses, uploads: Promise.all(uploads) };
  },
};

// ─── Download / Preview ─────────────────────────────
export const downloadAPI = {
  downloadUrl: (path: string) => `/api/download?path=${encodeURIComponent(path)}`,
  thumbUrl: (path: string) => `/api/thumb?path=${encodeURIComponent(path)}`,
  streamUrl: (path: string) => `/api/stream?path=${encodeURIComponent(path)}`,
  editUrl: (path: string) => `/api/edit?path=${encodeURIComponent(path)}`,
};

// ─── Favorites / Recent ─────────────────────────────
export const favoritesAPI = {
  list: () => fetchJSON<string[]>('/api/favorite'),
  add: (path: string) =>
    fetchJSON<void>('/api/favorite', {
      method: 'POST',
      body: JSON.stringify({ path, action: 'add' }),
    }),
  remove: (path: string) =>
    fetchJSON<void>('/api/favorite', {
      method: 'POST',
      body: JSON.stringify({ path, action: 'remove' }),
    }),
};

export const recentAPI = {
  list: () => fetchJSON<FileInfo[]>('/api/recent'),
};

// ─── Trash ──────────────────────────────────────────
export const trashAPI = {
  list: () => fetchJSON<TrashItem[]>('/api/trash'),
  restore: (name: string) => fileAPI.restore(name),
};

export { APIError, fetchJSON };
