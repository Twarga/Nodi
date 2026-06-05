import { useEffect, useState, useRef } from 'preact/hooks';
import type { UploadFile } from '../lib/api';

interface DropOverlayProps {
  onDrop: (files: FileList | UploadFile[]) => void;
}

async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<UploadFile[] | null> {
  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) => (item as any).webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length === 0) return null;

  const files: UploadFile[] = [];
  await Promise.all(entries.map((entry) => walkEntry(entry, '', files)));
  return files;
}

async function walkEntry(entry: any, parentPath: string, files: UploadFile[]): Promise<void> {
  const entryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    await new Promise<void>((resolve) => {
      entry.file((file: File) => {
        files.push({ file, relativePath: entryPath });
        resolve();
      }, () => resolve());
    });
    return;
  }
  if (!entry.isDirectory) return;

  const reader = entry.createReader();
  while (true) {
    const batch = await new Promise<any[]>((resolve) => reader.readEntries(resolve, () => resolve([])));
    if (batch.length === 0) break;
    await Promise.all(batch.map((child) => walkEntry(child, entryPath, files)));
  }
}

export function DropOverlay({ onDrop }: DropOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!isDragging && e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer) {
        const nestedFiles = await collectDroppedFiles(e.dataTransfer);
        if (nestedFiles && nestedFiles.length > 0) {
          onDrop(nestedFiles);
          return;
        }
      }
      if (e.dataTransfer?.files.length) {
        onDrop(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onDrop, isDragging]);

  if (!isDragging) return null;

  return (
    <div class="drop-overlay">
      <div class="drop-overlay-frame">
        <svg class="h-10 w-10 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div>
          <p class="text-lg font-semibold tracking-tight">Drop to upload</p>
          <p class="mt-1 text-sm text-foreground-muted">Files and folders · structure preserved when supported</p>
        </div>
      </div>
    </div>
  );
}
