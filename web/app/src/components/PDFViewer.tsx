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
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div class="fixed inset-0 z-[140] flex flex-col bg-background" style={{ animation: 'ql-fade-in 0.15s ease-out forwards' }}>
      <div class="flex h-12 items-center justify-between px-4 sm:px-6 border-b border-border shrink-0">
        <span class="text-sm font-medium tracking-tight">PDF</span>
        <button onClick={onClose} class="icon-button h-8 w-8" aria-label="Close">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <iframe
        src={downloadAPI.downloadUrl(path)}
        class="flex-1 w-full border-0"
        title="PDF"
      />
    </div>
  );
}
