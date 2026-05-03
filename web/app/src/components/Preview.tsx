import { useState, useEffect } from 'preact/hooks';
import type { FileInfo } from '../lib/api';

// Lazy-loaded components for code splitting
const LightboxPromise = import('./Lightbox').then(m => m.Lightbox);
const MediaPlayerPromise = import('./MediaPlayer').then(m => m.MediaPlayer);
const TextPreviewPromise = import('./TextPreview').then(m => m.TextPreview);
const PDFViewerPromise = import('./PDFViewer').then(m => m.PDFViewer);

interface PreviewProps {
  file: FileInfo;
  path: string;
  allFiles: FileInfo[];
  onClose: () => void;
}

function FullPath(path: string, name: string): string {
  return path ? `${path}/${name}` : name;
}

export function Preview({ file, path, allFiles, onClose }: PreviewProps) {
  const [Component, setComponent] = useState<preact.ComponentType<any> | null>(null);
  const [props, setProps] = useState<any>(null);

  useEffect(() => {
    // Image
    if (file.mime.startsWith('image/')) {
      const images = allFiles
        .filter(f => f.mime.startsWith('image/'))
        .map(f => ({
          name: f.name,
          path: FullPath(path, f.name),
        }));
      const idx = images.findIndex(i => i.name === file.name);
      LightboxPromise.then(Lightbox => {
        setComponent(() => Lightbox);
        setProps({
          files: images,
          index: idx >= 0 ? idx : 0,
          onClose,
          onNavigate: () => {},
        });
      });
      return;
    }

    // Video / Audio
    if (file.mime.startsWith('video/') || file.mime.startsWith('audio/')) {
      MediaPlayerPromise.then(MediaPlayer => {
        setComponent(() => MediaPlayer);
        setProps({
          path: FullPath(path, file.name),
          name: file.name,
          mime: file.mime,
          onClose,
        });
      });
      return;
    }

    // PDF
    if (file.mime === 'application/pdf') {
      PDFViewerPromise.then(PDFViewer => {
        setComponent(() => PDFViewer);
        setProps({
          path: FullPath(path, file.name),
          onClose,
        });
      });
      return;
    }

    // Text / Code
    if (
      file.mime.startsWith('text/') ||
      file.mime === 'application/json' ||
      file.mime === 'application/javascript' ||
      file.mime === 'application/xml' ||
      file.ext.match(/\.(md|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|fish|ps1|bat|cmd)$/i)
    ) {
      TextPreviewPromise.then(TextPreview => {
        setComponent(() => TextPreview);
        setProps({
          path: FullPath(path, file.name),
          name: file.name,
          onClose,
        });
      });
      return;
    }

    // Fallback: open download
    window.open(`/api/download?path=${encodeURIComponent(FullPath(path, file.name))}`, '_blank');
    onClose();
  }, [file.name, file.mime, path]);

  if (!Component) {
    return (
      <div class="fixed inset-0 z-[140] flex items-center justify-center bg-background/90 backdrop-blur-md animate-ql-fade-in">
        <svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  return <Component {...props} />;
}
