import { useEffect, useRef } from 'preact/hooks';
import { downloadAPI } from '../lib/api';

interface MediaPlayerProps {
  path: string;
  name: string;
  mime: string;
  onClose: () => void;
}

export function MediaPlayer({ path, name, mime, onClose }: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const isAudio = mime.startsWith('audio/');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      if (mediaRef.current) {
        mediaRef.current.pause();
      }
    };
  }, [onClose]);

  return (
    <div
      class="fixed inset-0 z-[140] flex items-center justify-center bg-black/90"
      style={{ animation: 'ql-fade-in 0.15s ease-out forwards' }}
    >
      <button
        onClick={onClose}
        class="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center text-white/80 hover:text-white transition-colors sm:right-5 sm:top-5"
        aria-label="Close"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {isAudio && (
        <div class="absolute left-3 top-3 text-sm text-white/80 sm:left-5 sm:top-5">
          {name}
        </div>
      )}

      <div
        class={['w-full', isAudio ? 'max-w-md px-4' : 'max-w-5xl'].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {isAudio ? (
          <div class="bg-background border border-border p-6">
            <p class="mb-4 text-center text-sm font-medium text-foreground truncate">{name}</p>
            <audio
              ref={mediaRef as any}
              src={downloadAPI.downloadUrl(path)}
              controls
              class="w-full"
              autoPlay
            />
          </div>
        ) : (
          <video
            ref={mediaRef}
            src={downloadAPI.downloadUrl(path)}
            controls
            class="w-full"
            autoPlay
            playsInline
          />
        )}
      </div>
    </div>
  );
}
