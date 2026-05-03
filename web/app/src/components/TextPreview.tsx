import { useEffect, useState } from 'preact/hooks';
import { downloadAPI } from '../lib/api';

interface TextPreviewProps {
  path: string;
  name: string;
  onClose: () => void;
}

export function TextPreview({ path, name, onClose }: TextPreviewProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(downloadAPI.downloadUrl(path))
      .then(r => r.text())
      .then(t => { setContent(t); setLoading(false); })
      .catch(() => { setContent('Failed to load file'); setLoading(false); });

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [path, onClose]);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = content.split('\n');

  return (
    <div
      class="fixed inset-0 z-[140] flex items-center justify-center bg-background/90 backdrop-blur-md animate-ql-fade-in"
      onClick={onClose}
    >
      <div
        class="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-xl animate-ql-pop-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h3 class="text-sm font-semibold truncate">{name}</h3>
          <div class="flex items-center gap-2">
            <button
              onClick={copy}
              class="command-button h-8 px-3 text-xs"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={onClose} class="icon-button h-8 w-8">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-4">
          {loading ? (
            <div class="flex items-center justify-center py-12">
              <svg class="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <div class="flex gap-4 text-sm">
              {/* Line numbers */}
              <div class="select-none text-right text-muted-foreground/60 tabular">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              {/* Code */}
              <pre class="flex-1 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                <code>{content}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
