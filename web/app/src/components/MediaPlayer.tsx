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

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';

      // Pause media on unmount
      if (mediaRef.current) {
        mediaRef.current.pause();
      }
    };
  }, [onClose]);

  return (
    <div
      class="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-ql-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        class="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-surface sm:right-5 sm:top-5"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {isAudio && (
        <div class="absolute left-3 top-3 rounded-full bg-surface/80 px-3 py-1 text-sm font-medium backdrop-blur shadow-lg sm:left-5 sm:top-5">
          {name}
        </div>
      )}

      <div
        class={[
          'w-full rounded-xl overflow-hidden shadow-2xl',
          isAudio ? 'max-w-md' : 'max-w-4xl',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {isAudio ? (
          <div class="rounded-xl border border-border bg-surface p-6">
            <p class="mb-4 text-center text-sm font-medium">{name}</p>
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
            class="w-full rounded-xl"
            autoPlay
            playsInline
          />
        )}
      </div>
    </div>
  );
}