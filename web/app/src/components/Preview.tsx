import { useState, useEffect, useCallback } from 'preact/hooks';
import type { FileInfo } from '../lib/api';

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
  const [currentIndex, setCurrentIndex] = useState(() => {
    const images = allFiles.filter(f => f.mime.startsWith('image/'));
    return images.findIndex(f => f.name === file.name);
  });

  const handleNavigate = useCallback((newIndex: number) => {
    setCurrentIndex(newIndex);
  }, []);

  useEffect(() => {
    // Reset when file changes
    setCurrentIndex(allFiles.filter(f => f.mime.startsWith('image/')).findIndex(f => f.name === file.name));
  }, [file.name]);

  // Image preview with gallery
  if (file.mime.startsWith('image/')) {
    const images = allFiles
      .filter(f => f.mime.startsWith('image/'))
      .map(f => ({
        name: f.name,
        path: FullPath(path, f.name),
      }));

    return (
      <LightboxComponent
        files={images}
        index={currentIndex >= 0 ? currentIndex : 0}
        onClose={onClose}
        onNavigate={handleNavigate}
      />
    );
  }

  // Video / Audio
  if (file.mime.startsWith('video/') || file.mime.startsWith('audio/')) {
    return <MediaPlayerComponent path={FullPath(path, file.name)} name={file.name} mime={file.mime} onClose={onClose} />;
  }

  // PDF
  if (file.mime === 'application/pdf') {
    return <PDFViewerComponent path={FullPath(path, file.name)} onClose={onClose} />;
  }

  // Text / Code
  if (
    file.mime.startsWith('text/') ||
    file.mime === 'application/json' ||
    file.mime === 'application/javascript' ||
    file.mime === 'application/xml' ||
    file.ext.match(/\.(md|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|fish|ps1|bat|cmd|go|rs|py|rb|java|c|cpp|h|hpp|cs|php|sql|r|tex|log|csv)$/i)
  ) {
    return <TextPreviewComponent path={FullPath(path, file.name)} name={file.name} onClose={onClose} />;
  }

  // Fallback: open download
  window.open(`/api/download?path=${encodeURIComponent(FullPath(path, file.name))}`, '_blank');
  onClose();
  return null;
}

function LightboxComponent({ files, index, onClose, onNavigate }: {
  files: { name: string; path: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const [Loaded, setLoaded] = useState<any>(null);

  useEffect(() => {
    LightboxPromise.then(m => setLoaded(() => m));
  }, []);

  if (!Loaded) return <LoadingSpinner />;
  return <Loaded files={files} index={index} onClose={onClose} onNavigate={onNavigate} />;
}

function MediaPlayerComponent({ path, name, mime, onClose }: {
  path: string; name: string; mime: string; onClose: () => void;
}) {
  const [Loaded, setLoaded] = useState<any>(null);

  useEffect(() => {
    MediaPlayerPromise.then(m => setLoaded(() => m));
  }, []);

  if (!Loaded) return <LoadingSpinner />;
  return <Loaded path={path} name={name} mime={mime} onClose={onClose} />;
}

function PDFViewerComponent({ path, onClose }: { path: string; onClose: () => void }) {
  const [Loaded, setLoaded] = useState<any>(null);

  useEffect(() => {
    PDFViewerPromise.then(m => setLoaded(() => m));
  }, []);

  if (!Loaded) return <LoadingSpinner />;
  return <Loaded path={path} onClose={onClose} />;
}

function TextPreviewComponent({ path, name, onClose }: {
  path: string; name: string; onClose: () => void;
}) {
  const [Loaded, setLoaded] = useState<any>(null);

  useEffect(() => {
    TextPreviewPromise.then(m => setLoaded(() => m));
  }, []);

  if (!Loaded) return <LoadingSpinner />;
  return <Loaded path={path} name={name} onClose={onClose} />;
}

function LoadingSpinner() {
  return (
    <div class="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-ql-fade-in">
      <svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  );
}