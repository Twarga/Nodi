import { useEffect, useState } from 'preact/hooks';
import { downloadAPI } from '../lib/api';

interface LightboxProps {
  files: { name: string; path: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ files, index, onClose, onNavigate }: LightboxProps) {
  const [loaded, setLoaded] = useState(false);
  const current = files[index];

  useEffect(() => {
    setLoaded(false);
  }, [current?.path]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < files.length - 1) onNavigate(index + 1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [index, files.length, onClose, onNavigate]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!current) return null;

  return (
    <div
      class="fixed inset-0 z-[140] flex items-center justify-center bg-black/95"
      style={{ animation: 'ql-fade-in 0.15s ease-out forwards' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-white/80 hover:text-white transition-colors"
        title="Close (Esc)"
        aria-label="Close"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div class="absolute left-4 top-4 text-sm font-medium text-white/80 tabular">
        {index + 1} / {files.length}
      </div>

      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          class="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-white/80 hover:text-white transition-colors sm:left-4"
          aria-label="Previous"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      )}

      {index < files.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          class="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-white/80 hover:text-white transition-colors sm:right-4"
          aria-label="Next"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      )}

      <img
        src={downloadAPI.downloadUrl(current.path)}
        alt={current.name}
        class={['max-h-[90vh] max-w-[90vw] object-contain transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0'].join(' ')}
        onLoad={() => setLoaded(true)}
        onClick={(e) => e.stopPropagation()}
      />

      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80 max-w-[80vw] truncate">
        {current.name}
      </div>
    </div>
  );
}
