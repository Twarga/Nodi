import { useEffect, useState, useRef } from 'preact/hooks';

interface DropOverlayProps {
  onDrop: (files: FileList) => void;
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
      // Highlight the drop zone continuously
      if (!isDragging && e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
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
    <div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-ql-fade-in">
      <div class="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-surface p-12 text-center shadow-xl animate-ql-pop-in">
        <svg class="h-12 w-12 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div>
          <p class="text-lg font-semibold">Drop files to upload</p>
          <p class="mt-1 text-sm text-muted-foreground">Release to start uploading</p>
        </div>
      </div>
    </div>
  );
}