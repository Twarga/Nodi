import { useState, useEffect } from 'preact/hooks';
import { shareAPI } from '../lib/api';
import type { Share } from '../lib/api';
import { Modal } from './Modal';
import { toast } from '../hooks/useToast';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  file: { name: string; is_dir: boolean };
  path: string;
}

export function ShareModal({ open, onClose, file, path }: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [mode, setMode] = useState<'read' | 'upload'>('read');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
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
        expires_at: expiresAt || undefined,
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

  const copyUrl = () => {
    if (!resultUrl) return;
    navigator.clipboard.writeText(resultUrl).then(() => toast('Copied to clipboard', 'success'));
  };

  return (
    <Modal open={open} onClose={onClose} title={`Share: ${file.name}`} size="md"
      footer={
        <>
          <button onClick={onClose} class="command-button h-9 px-4 text-sm">Close</button>
          <button onClick={handleCreate} disabled={creating} class="command-button primary h-9 px-4 text-sm">
            {creating ? 'Creating...' : 'Create Link'}
          </button>
        </>
      }
    >
      <div class="space-y-4">
        {resultUrl && (
          <div class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <input
              type="text" value={resultUrl} readOnly
              class="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs font-mono"
              onFocus={(e) => (e.target as HTMLInputElement).select()}
            />
            <button onClick={copyUrl} class="command-button primary h-8 px-3 text-xs">Copy</button>
          </div>
        )}

        <form onSubmit={handleCreate} class="space-y-3">
          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode((e.target as HTMLSelectElement).value as any)}
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="read">Download only</option>
              {file.is_dir && <option value="upload">Upload drop zone</option>}
            </select>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password (optional)</label>
            <input
              type="password" value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              placeholder="Leave empty for no password"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expires (optional)</label>
            <input
              type="datetime-local" value={expiresAt}
              onInput={(e) => setExpiresAt((e.target as HTMLInputElement).value)}
              class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </form>

        {shares.length > 0 && (
          <div>
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Existing shares</h4>
            <ul class="space-y-2">
              {shares.filter(s => s.path === path).map(s => (
                <li key={s.token} class="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div class="min-w-0 flex-1">
                    <span class="font-mono text-xs text-muted-foreground">{s.mode}</span>
                    {s.has_password && <span class="ml-2 text-xs text-muted-foreground">🔒</span>}
                    {s.expires_at && <span class="ml-2 text-xs text-muted-foreground">⏱ {new Date(s.expires_at).toLocaleDateString()}</span>}
                  </div>
                  <button onClick={() => handleRevoke(s.token)} class="text-xs text-destructive hover:underline">Revoke</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
