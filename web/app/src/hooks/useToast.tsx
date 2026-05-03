import { panelOpen, uploads } from '../hooks/useUpload';

let toastId = 0;

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  createdAt: number;
}

import { signal } from '@preact/signals';

export const toasts = signal<Toast[]>([]);

export function toast(message: string, type: Toast['type'] = 'info') {
  const id = `toast-${++toastId}-${Date.now()}`;
  const t: Toast = { id, message, type, createdAt: Date.now() };
  toasts.value = [...toasts.value, t];

  // Auto-dismiss after 4s
  setTimeout(() => {
    removeToast(id);
  }, 4000);
}

export function removeToast(id: string) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

export function ToastContainer() {
  const list = toasts.value;
  if (list.length === 0) return null;

  return (
    <div class="toast-container">
      {list.map((t) => (
        <div
          key={t.id}
          class={[
            'toast',
            t.type === 'success' ? 'toast-success' : t.type === 'error' ? 'toast-error' : 'toast-info',
          ].join(' ')}
        >
          {t.type === 'success' ? (
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : t.type === 'error' ? (
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          ) : (
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          )}
          <span class="toast-message">{t.message}</span>
          <button onClick={() => removeToast(t.id)} class="toast-close">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
