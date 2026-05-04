import { signal } from '@preact/signals';
import type { FileInfo } from '../lib/api';

interface CtxState { open: boolean; x: number; y: number; file: FileInfo | null; }

export const ctxState = signal<CtxState>({ open: false, x: 0, y: 0, file: null });

export function openCtx(e: MouseEvent, file: FileInfo) {
  e.preventDefault();
  e.stopPropagation();
  ctxState.value = { open: true, x: e.clientX, y: e.clientY, file };
}

export function closeCtx() {
  ctxState.value = { ...ctxState.value, open: false };
}

export const previewFileState = signal<FileInfo | null>(null);

export function openPreview(file: FileInfo) {
  previewFileState.value = file;
}

export function closePreview() {
  previewFileState.value = null;
}
