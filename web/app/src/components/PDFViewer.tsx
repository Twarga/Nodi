import { useEffect } from 'preact/hooks';
import { downloadAPI } from '../lib/api';

interface PDFViewerProps {
  path: string;
  onClose: () => void;
}

export function PDFViewer({ path, onClose }: PDFViewerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div class="fixed inset-0 z-[140] flex flex-col bg-background animate-ql-fade-in">
      {/* Toolbar */}
      <div class="flex h-14 items-center justify-between border-b border-border/80 bg-surface/90 px-4 backdrop-blur-xl">
        <span class="text-sm font-semibold">PDF Viewer</span>
        <button onClick={onClose} class="icon-button h-9 w-9">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* PDF iframe */}
      <iframe
        src={downloadAPI.downloadUrl(path)}
        class="flex-1 w-full border-0"
        title="PDF"
      />
    </div>
  );
}
