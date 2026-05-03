import { useEffect, useRef } from 'preact/hooks';
import { downloadAPI } from '../lib/api';

interface MediaPlayerProps {
  path: string;
  name: string;
  mime: string;
  onClose: () => void;
}

export function MediaPlayer({ path, name, mime, onClose }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isAudio = mime.startsWith('audio/');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      class="fixed inset-0 z-[140] flex items-center justify-center bg-background/90 backdrop-blur-md animate-ql-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-surface-hover"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div
        class={[
          'w-full rounded-xl overflow-hidden shadow-2xl',
          isAudio ? 'max-w-md' : 'max-w-4xl',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {isAudio ? (
          <div class="rounded-xl border border-border/80 bg-surface/95 p-6 backdrop-blur">
            <p class="mb-4 text-center text-sm font-medium">{name}</p>
            <audio
              ref={videoRef as any}
              src={downloadAPI.downloadUrl(path)}
              controls
              class="w-full"
              autoPlay
            />
          </div>
        ) : (
          <video
            ref={videoRef}
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
