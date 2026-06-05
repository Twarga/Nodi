import { useEffect, useState, useRef } from 'preact/hooks';
import { textFileAPI } from '../lib/api';

interface TextPreviewProps {
  path: string;
  name: string;
  onClose: () => void;
}

export function TextPreview({ path, name, onClose }: TextPreviewProps) {
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const copiedTimer = useRef<number>(0);
  const savedTimer = useRef<number>(0);
  const isDirty = draft !== content;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setEditing(false);
    setSaved(false);

    textFileAPI.read(path)
      .then((t) => {
        if (controller.signal.aborted) return;
        setContent(t);
        setDraft(t);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Failed to load file');
          setLoading(false);
        }
      });

    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (editing && isDirty) void save();
        return;
      }
      if (e.key === 'Escape') {
        if (editing && isDirty && !confirm('Discard unsaved changes?')) return;
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      controller.abort();
      document.removeEventListener('keydown', handler);
    };
  }, [path, onClose]);

  useEffect(() => {
    return () => {
      clearTimeout(copiedTimer.current);
      clearTimeout(savedTimer.current);
    };
  }, []);

  const save = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setError('');
    try {
      await textFileAPI.save(path, draft);
      setContent(draft);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const closeSafely = () => {
    if (editing && isDirty && !confirm('Discard unsaved changes?')) return;
    onClose();
  };

  const cancelEdit = () => {
    if (isDirty && !confirm('Discard unsaved changes?')) return;
    setDraft(content);
    setEditing(false);
    setError('');
  };

  const copy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed');
    }
  };

  const visibleText = editing ? draft : content;
  const lines = visibleText.split('\n');

  return (
    <div
      class="fixed inset-0 z-[140] flex flex-col bg-background"
      style={{ animation: 'ql-fade-in 0.15s ease-out forwards' }}
    >
      {/* Header strip — not a card, just a hairline border */}
      <div class="flex items-center justify-between px-4 sm:px-6 h-12 border-b border-border shrink-0">
        <h3 class="text-sm font-medium tracking-tight truncate">{name}</h3>
        <div class="flex items-center gap-2">
          {saved && <span class="text-xs text-success">Saved</span>}
          {editing ? (
            <>
              <button onClick={cancelEdit} disabled={saving} class="btn btn-outline h-8 px-3 text-xs">Cancel</button>
              <button onClick={save} disabled={!isDirty || saving} class="btn btn-primary h-8 px-3 text-xs">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} disabled={loading || !!error} class="btn btn-primary h-8 px-3 text-xs">
              Edit
            </button>
          )}
          <button onClick={copy} class="btn btn-outline h-8 px-3 text-xs">
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={closeSafely} class="icon-button h-8 w-8" aria-label="Close">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div class="flex items-center justify-center py-12">
            <svg class="h-5 w-5 animate-spin text-foreground-muted" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : error ? (
          <div class="flex items-center justify-center py-12 text-sm text-destructive">{error}</div>
        ) : editing ? (
          <div class="flex h-full flex-col gap-2">
            <textarea
              value={draft}
              onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
              class="min-h-0 flex-1 resize-none border border-border bg-background p-4 font-mono text-sm leading-relaxed outline-none focus:border-foreground rounded-[var(--radius)]"
              spellcheck={false}
              autofocus
            />
            <p class="text-xs text-foreground-subtle">
              Safe editor: saves existing text files up to 1 MB. Press Ctrl/Cmd+S to save.
            </p>
          </div>
        ) : (
          <div class="flex gap-4 text-sm">
            <div class="select-none text-right text-foreground-subtle tabular">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <pre class="flex-1 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed text-foreground">
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
