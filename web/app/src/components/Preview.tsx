import { useState } from 'preact/hooks';
import { Lightbox } from './Lightbox';
import { MediaPlayer } from './MediaPlayer';
import { TextPreview } from './TextPreview';
import { PDFViewer } from './PDFViewer';
import type { FileInfo } from '../lib/api';

interface PreviewProps {
  file: FileInfo;
  path: string;
  allFiles: FileInfo[];
  onClose: () => void;
}

export function Preview({ file, path, allFiles, onClose }: PreviewProps) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  // Image
  if (file.mime.startsWith('image/')) {
    const images = allFiles
      .filter(f => f.mime.startsWith('image/'))
      .map(f => ({
        name: f.name,
        path: path ? `${path}/${f.name}` : f.name,
      }));
    const idx = images.findIndex(i => i.name === file.name);

    return (
      <Lightbox
        files={images}
        index={idx >= 0 ? idx : 0}
        onClose={onClose}
        onNavigate={setLightboxIndex}
      />
    );
  }

  // Video / Audio
  if (file.mime.startsWith('video/') || file.mime.startsWith('audio/')) {
    return (
      <MediaPlayer
        path={path ? `${path}/${file.name}` : file.name}
        name={file.name}
        mime={file.mime}
        onClose={onClose}
      />
    );
  }

  // PDF
  if (file.mime === 'application/pdf') {
    return (
      <PDFViewer
        path={path ? `${path}/${file.name}` : file.name}
        onClose={onClose}
      />
    );
  }

  // Text / Code
  if (
    file.mime.startsWith('text/') ||
    file.mime === 'application/json' ||
    file.mime === 'application/javascript' ||
    file.mime === 'application/xml' ||
    file.ext.match(/\.(md|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|fish|ps1|bat|cmd)$/i)
  ) {
    return (
      <TextPreview
        path={path ? `${path}/${file.name}` : file.name}
        name={file.name}
        onClose={onClose}
      />
    );
  }

  // Fallback: open download
  window.open(`/api/download?path=${encodeURIComponent(path ? `${path}/${file.name}` : file.name)}`, '_blank');
  onClose();
  return null;
}
