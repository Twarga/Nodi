import { useEffect, useMemo, useState } from 'preact/hooks';
import { TopBar } from '../components/TopBar';
import { ToastContainer, toast } from '../hooks/useToast';
import { activityAPI, shareAPI } from '../lib/api';
import type { ActivityEvent, Share } from '../lib/api';
import { datetimeLocalToRFC3339 } from '../lib/utils';

type ShareMode = 'read' | 'upload';
type ShareTab = 'active' | 'expired' | 'dropboxes' | 'all';

function fullShareUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${window.location.origin}${url}`;
}

function copyText(value: string, label = 'Link') {
  if (!value) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(() => toast(`${label} copied`, 'success')).catch(() => toast('Copy failed', 'error'));
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
  toast(`${label} copied`, 'success');
}

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SharePage() {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [path, setPath] = useState('');
  const [mode, setMode] = useState<ShareMode>('read');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxFileSizeMb, setMaxFileSizeMb] = useState('');
  const [maxFileCount, setMaxFileCount] = useState('');
  const [tab, setTab] = useState<ShareTab>('active');

  const dropboxes = useMemo(() => shares.filter((share) => share.mode === 'upload').length, [shares]);
  const protectedCount = useMemo(() => shares.filter((share) => share.has_password).length, [shares]);
  const expiredCount = useMemo(() => shares.filter((share) => share.status === 'expired').length, [shares]);
  const visibleShares = useMemo(() => {
    if (tab === 'all') return shares;
    if (tab === 'expired') return shares.filter((share) => share.status === 'expired');
    if (tab === 'dropboxes') return shares.filter((share) => share.mode === 'upload');
    return shares.filter((share) => share.status !== 'expired');
  }, [shares, tab]);

  const loadShares = async () => {
    setLoading(true);
    try {
      setShares(await shareAPI.list());
    } catch (err) {
      toast((err as Error).message || 'Failed to load shares', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadShares(); }, []);

  const createShare = async (e: Event) => {
    e.preventDefault();
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanPath) { toast('Enter a file or folder path', 'error'); return; }
    setCreating(true);
    try {
      const res = await shareAPI.create({
        path: cleanPath, mode,
        password: password || undefined,
        expires_at: datetimeLocalToRFC3339(expiresAt),
        max_file_size: mode === 'upload' && maxFileSizeMb ? Number(maxFileSizeMb) * 1024 * 1024 : undefined,
        max_file_count: mode === 'upload' && maxFileCount ? Number(maxFileCount) : undefined,
      });
      copyText(fullShareUrl(res.url), 'New share link');
      setPath(''); setPassword(''); setExpiresAt(''); setMaxFileSizeMb(''); setMaxFileCount('');
      await loadShares();
      toast('Share created', 'success');
    } catch (err) {
      toast((err as Error).message || 'Failed to create share', 'error');
    } finally { setCreating(false); }
  };

  const revokeShare = async (token: string) => {
    if (!confirm('Revoke this share link?')) return;
    try {
      await shareAPI.revoke(token);
      setShares((current) => current.filter((share) => share.token !== token));
      toast('Share revoked', 'success');
    } catch (err) {
      toast((err as Error).message || 'Failed to revoke share', 'error');
    }
  };

  const stats = [
    { label: 'Active shares', value: shares.length - expiredCount },
    { label: 'Expiring soon', value: shares.filter(s => s.expires_at && s.status !== 'expired').length },
  ];

  return (
    <div class="min-h-screen bg-background">
      <TopBar />

      <main class="mx-auto max-w-6xl px-5 sm:px-8 pt-8 pb-20 sm:pb-16">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">Shares</h1>
        <p class="mt-1 text-sm text-foreground-muted">Create and manage links to share files and folders.</p>

        {/* Stats */}
        <div class="mt-6 grid gap-4 sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} class="p-4 border border-border rounded-lg bg-card">
              <p class="text-2xl font-semibold text-foreground">{stat.value}</p>
              <p class="mt-1 text-xs text-foreground-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Content Grid */}
        <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left: Share List */}
          <div>
            {/* Tabs */}
            <div class="flex items-center gap-1 border-b border-border">
              {(['active', 'expired', 'dropboxes', 'all'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  class={[
                    'px-3 py-2.5 text-sm font-medium border-b-2 transition-colors border-none bg-transparent cursor-pointer',
                    tab === t ? 'text-primary border-b-primary' : 'text-foreground-muted border-b-transparent hover:text-foreground',
                  ].join(' ')}
                >
                  {t === 'active' ? `Active (${shares.length - expiredCount})`
                    : t === 'expired' ? `Expired (${expiredCount})`
                    : t === 'dropboxes' ? `Dropboxes (${dropboxes})`
                    : `All (${shares.length})`}
                </button>
              ))}
            </div>

            {/* Table */}
            <div class="mt-4 border border-border rounded-lg overflow-hidden bg-card">
              {loading ? (
                <div class="px-4 py-8 text-sm text-foreground-subtle text-center">Loading…</div>
              ) : visibleShares.length === 0 ? (
                <div class="px-4 py-8 text-sm text-foreground-muted text-center">No shares yet.</div>
              ) : (
                <div class="divide-y divide-border">
                  {/* Header */}
                  <div class="grid grid-cols-[1fr_80px_100px_80px_80px_100px] items-center gap-2 px-4 py-2.5 text-xs font-medium text-foreground-subtle border-b border-border bg-surface">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Created</span>
                    <span>Expires</span>
                    <span>Status</span>
                    <span></span>
                  </div>
                  {visibleShares.map((share) => (
                    <div key={share.token} class="grid grid-cols-[1fr_80px_100px_80px_80px_100px] items-center gap-2 px-4 py-3 hover:bg-surface-hover transition-colors">
                      <div class="min-w-0">
                        <p class="truncate text-sm text-foreground font-medium">{share.path.split('/').pop() || share.path}</p>
                        <p class="text-xs text-foreground-subtle truncate">{share.path}</p>
                      </div>
                      <span class={['text-xs font-medium px-2 py-0.5 rounded-full w-fit', share.mode === 'upload' ? 'bg-primary-soft text-primary' : 'bg-surface text-foreground-muted'].join(' ')}>
                        {share.mode === 'upload' ? 'Dropbox' : 'Link'}
                      </span>
                      <span class="text-xs text-foreground-muted">{formatDate(share.created_at)}</span>
                      <span class="text-xs text-foreground-muted">{share.expires_at ? formatDate(share.expires_at) : 'Never'}</span>
                      <span class={['text-xs font-medium', share.status === 'expired' ? 'text-destructive' : 'text-success'].join(' ')}>
                        {share.status === 'expired' ? 'Expired' : 'Active'}
                      </span>
                      <div class="flex items-center gap-1">
                        <button
                          onClick={() => share.url && copyText(fullShareUrl(share.url), 'Link')}
                          disabled={!share.url}
                          class="btn btn-ghost h-7 px-2 text-xs"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => revokeShare(share.token)}
                          class="btn btn-danger h-7 px-2 text-xs"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Create Form */}
          <div class="lg:sticky lg:top-20 lg:self-start">
            <div class="p-5 border border-border rounded-lg bg-card">
              <div class="flex items-center gap-2">
                <svg class="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <h2 class="text-base font-semibold text-foreground">New share</h2>
              </div>
              <p class="mt-1 text-xs text-foreground-muted">Share a file or folder with a link.</p>

              <form onSubmit={createShare} class="mt-5 space-y-4">
                <div>
                  <label class="text-xs font-medium text-foreground-subtle block mb-1.5">Path</label>
                  <input value={path} onInput={(e) => setPath((e.target as HTMLInputElement).value)} placeholder="folder/file/path" class="input" />
                </div>

                <div>
                  <label class="text-xs font-medium text-foreground-subtle block mb-1.5">Type</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('read')}
                      class={['btn h-9 text-xs', mode === 'read' ? 'btn-primary' : 'btn-outline'].join(' ')}
                    >
                      Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('upload')}
                      class={['btn h-9 text-xs', mode === 'upload' ? 'btn-primary' : 'btn-outline'].join(' ')}
                    >
                      Dropbox
                    </button>
                  </div>
                  <p class="mt-1.5 text-xs text-foreground-muted">
                    {mode === 'read' ? 'Anyone with the link can view.' : 'Anyone with the link can upload.'}
                  </p>
                </div>

                <div>
                  <label class="text-xs font-medium text-foreground-subtle block mb-1.5">Expires</label>
                  <select
                    value={expiresAt ? 'custom' : 'never'}
                    onChange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      if (val === 'never') setExpiresAt('');
                      else if (val === '7days') {
                        const d = new Date(); d.setDate(d.getDate() + 7);
                        setExpiresAt(d.toISOString().slice(0, 16));
                      }
                    }}
                    class="select text-sm"
                  >
                    <option value="never">Never</option>
                    <option value="7days">7 days</option>
                    <option value="custom">Custom date</option>
                  </select>
                </div>

                <div>
                  <label class="text-xs font-medium text-foreground-subtle block mb-1.5">Password (optional)</label>
                  <input
                    type="password"
                    value={password}
                    onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                    placeholder="Set a password"
                    class="input"
                  />
                  <p class="mt-1 text-xs text-foreground-muted">Adds an extra layer of security.</p>
                </div>

                {mode === 'upload' && (
                  <>
                    <div>
                      <label class="text-xs font-medium text-foreground-subtle block mb-1.5">Max file size (MB)</label>
                      <input type="number" min="0" value={maxFileSizeMb} onInput={(e) => setMaxFileSizeMb((e.target as HTMLInputElement).value)} placeholder="0 = no limit" class="input" />
                    </div>
                    <div>
                      <label class="text-xs font-medium text-foreground-subtle block mb-1.5">Max files total</label>
                      <input type="number" min="0" value={maxFileCount} onInput={(e) => setMaxFileCount((e.target as HTMLInputElement).value)} placeholder="0 = no limit" class="input" />
                    </div>
                  </>
                )}

                <button disabled={creating || !path.trim()} class="btn btn-primary w-full h-10 text-sm">
                  {creating ? 'Creating…' : 'Create share'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
