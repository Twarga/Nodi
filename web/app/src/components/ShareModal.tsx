import { useState, useEffect } from 'preact/hooks';
import { shareAPI } from '../lib/api';
import type { Share } from '../lib/api';
import { Modal } from './Modal';
import { toast } from '../hooks/useToast';
import { datetimeLocalToRFC3339 } from '../lib/utils';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  file: { name: string; is_dir: boolean };
  path: string;
}

function copyText(value: string) {
  if (!value) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value)
      .then(() => toast('Copied', 'success'))
      .catch(() => toast('Copy failed', 'error'));
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  toast('Copied', 'success');
}

export function ShareModal({ open, onClose, file, path }: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [mode, setMode] = useState<'read' | 'upload'>('read');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxFileSizeMb, setMaxFileSizeMb] = useState('');
  const [maxFileCount, setMaxFileCount] = useState('');
  const [creating, setCreating] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    shareAPI.list()
      .then(setShares)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await shareAPI.create({
        path,
        mode,
        password: password || undefined,
        expires_at: datetimeLocalToRFC3339(expiresAt),
        max_file_size: mode === 'upload' && maxFileSizeMb ? Number(maxFileSizeMb) * 1024 * 1024 : undefined,
        max_file_count: mode === 'upload' && maxFileCount ? Number(maxFileCount) : undefined,
      });
      const fullUrl = window.location.origin + res.url;
      setResultUrl(fullUrl);
      toast('Share link created', 'success');
      const updated = await shareAPI.list();
      setShares(updated);
    } catch (err) {
      toast((err as Error).message || 'Failed to create share', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: string) => {
    try {
      await shareAPI.revoke(token);
      toast('Share revoked', 'success');
      setShares(shares.filter(s => s.token !== token));
    } catch (err) {
      toast((err as Error).message || 'Failed to revoke', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Share ${file.name}`} size="md"
      footer={
        <>
          <button onClick={onClose} class="btn btn-outline h-9 px-3 text-sm">Close</button>
          <button onClick={handleCreate} disabled={creating} class="btn btn-primary h-9 px-3 text-sm">
            {creating ? 'Creating…' : 'Create link'}
          </button>
        </>
      }
    >
      <div class="space-y-5">
        {resultUrl && (
          <div class="flex items-center gap-2 border border-foreground p-2.5">
            <input
              type="text" value={resultUrl} readOnly
              class="input flex-1 h-8 font-mono text-xs"
              onFocus={(e) => (e.target as HTMLInputElement).select()}
            />
            <button onClick={() => copyText(resultUrl)} class="btn btn-primary h-8 px-3 text-xs">Copy</button>
          </div>
        )}

        <form onSubmit={handleCreate} class="space-y-4">
          <div>
            <label class="eyebrow block mb-1.5">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode((e.target as HTMLSelectElement).value as any)}
              class="select"
            >
              <option value="read">Download only</option>
              {file.is_dir && <option value="upload">Upload drop zone</option>}
            </select>
          </div>

          <div>
            <label class="eyebrow block mb-1.5">Password (optional)</label>
            <input
              type="password" value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              class="input"
              placeholder="Leave empty for no password"
            />
          </div>

          <div>
            <label class="eyebrow block mb-1.5">Expires (optional)</label>
            <input
              type="datetime-local" value={expiresAt}
              onInput={(e) => setExpiresAt((e.target as HTMLInputElement).value)}
              class="input"
            />
          </div>

          {mode === 'upload' && (
            <>
              <div>
                <label class="eyebrow block mb-1.5">Max file size (MB)</label>
                <input
                  type="number" min="0" value={maxFileSizeMb}
                  onInput={(e) => setMaxFileSizeMb((e.target as HTMLInputElement).value)}
                  class="input"
                  placeholder="0 = no limit"
                />
              </div>
              <div>
                <label class="eyebrow block mb-1.5">Max files total</label>
                <input
                  type="number" min="0" value={maxFileCount}
                  onInput={(e) => setMaxFileCount((e.target as HTMLInputElement).value)}
                  class="input"
                  placeholder="0 = no limit"
                />
              </div>
            </>
          )}
        </form>

        {shares.length > 0 && (
          <div>
            <h4 class="eyebrow mb-2">Existing shares for this path</h4>
            <ul class="divide-y divide-border border border-border rounded-[var(--radius)]">
              {shares.filter(s => s.path === path).map(s => (
                <li key={s.token} class="flex items-center justify-between px-3 py-2 text-sm">
                  <div class="min-w-0 flex-1">
                    <span class="font-mono text-xs text-foreground-muted">{s.mode}</span>
                    {s.has_password && <span class="ml-2 text-xs text-foreground-muted">🔒</span>}
                    {s.expires_at && <span class="ml-2 text-xs text-foreground-muted">⏱ {new Date(s.expires_at).toLocaleDateString()}</span>}
                    {!s.url && <span class="ml-2 text-xs text-foreground-muted">link shown only at creation</span>}
                  </div>
                  <div class="flex items-center gap-2">
                    <button disabled={!s.url} onClick={() => copyText(window.location.origin + s.url)} class="text-xs text-foreground-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed border-none bg-transparent cursor-pointer">Copy</button>
                    <button onClick={() => handleRevoke(s.token)} class="text-xs text-destructive hover:underline border-none bg-transparent cursor-pointer">Revoke</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
