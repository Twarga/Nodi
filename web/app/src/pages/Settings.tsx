import { useEffect, useState } from 'preact/hooks';
import { storageAPI, passwordAPI, versionAPI, activityAPI, backupAPI, trashAPI, cleanupAPI, healthAPI } from '../lib/api';
import type { StorageStats, VersionInfo, ActivityEvent, TrashItem, HealthDetails } from '../lib/api';
import { TopBar } from '../components/TopBar';
import { toast, ToastContainer } from '../hooks/useToast';
import { navigate } from '../lib/router';
import { useTheme } from '../stores/theme';
import { appState, toggleHidden } from '../stores/app';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

type SettingsTab = 'general' | 'password' | 'storage' | 'trash' | 'backup' | 'health';

const sidebarItems: { id: SettingsTab; label: string; icon: preact.ComponentChildren }[] = [
  { id: 'general', label: 'General', icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.67 15 1.65 1.65 0 0 0 3 13.51V13a2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 6.6 9.09a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H12a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V12a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  { id: 'password', label: 'Password', icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  { id: 'storage', label: 'Storage', icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/></svg> },
  { id: 'trash', label: 'Trash', icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
  { id: 'backup', label: 'Backup', icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { id: 'health', label: 'Health', icon: <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
];

export function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [health, setHealth] = useState<HealthDetails | null>(null);
  const [tab, setTab] = useState<SettingsTab>('general');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [trashConfirm, setTrashConfirm] = useState('');
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [cleaning, setCleaning] = useState('');

  useEffect(() => {
    storageAPI.stats().then(setStats).catch(() => toast('Failed to load storage stats', 'error')).finally(() => setStatsLoading(false));
    versionAPI.get().then(setVersion).catch(() => {});
    activityAPI.list(50).then(setActivities).catch(() => {});
    trashAPI.list().then((res) => setTrashItems(res.items)).catch(() => {});
    healthAPI.details().then(setHealth).catch(() => {});
  }, []);

  const submitPassword = async (e: Event) => {
    e.preventDefault();
    if (next.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
    if (next !== confirm) { toast('Passwords do not match', 'error'); return; }
    setPwLoading(true);
    try {
      await passwordAPI.change(current, next);
      toast('Password updated', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      toast((err as Error).message || 'Failed to change password', 'error');
    } finally { setPwLoading(false); }
  };

  const diskUsed = stats ? Math.max(0, stats.total - stats.free) : 0;
  const diskFillPercent = stats && stats.total > 0 ? Math.min(100, (diskUsed / stats.total) * 100) : 0;

  const emptyTrash = async () => {
    if (trashConfirm !== 'EMPTY') return;
    setEmptyingTrash(true);
    try {
      await trashAPI.empty();
      setTrashItems([]);
      setTrashConfirm('');
      toast('Trash emptied', 'success');
    } catch (err) {
      toast((err as Error).message || 'Failed to empty trash', 'error');
    } finally { setEmptyingTrash(false); }
  };

  const runCleanup = async (target: 'uploads' | 'trash' | 'all') => {
    setCleaning(target);
    try {
      const res = await cleanupAPI.run(target);
      if (target === 'trash' || target === 'all') {
        const updated = await trashAPI.list();
        setTrashItems(updated.items);
      }
      const suffix = res.trash_removed ? ` (${res.trash_removed} trash item${res.trash_removed === 1 ? '' : 's'} removed)` : '';
      toast(`Cleanup complete${suffix}`, 'success');
    } catch (err) {
      toast((err as Error).message || 'Cleanup failed', 'error');
    } finally { setCleaning(''); }
  };

  return (
    <div class="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <div class="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside class="hidden lg:flex flex-col w-56 border-r border-border bg-background shrink-0">
          <div class="p-5 pb-3">
            <h1 class="text-lg font-semibold text-foreground">Settings</h1>
            <p class="text-xs text-foreground-muted mt-0.5">Manage your server and preferences.</p>
          </div>
          <nav class="flex-1 px-3 py-2 space-y-0.5">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                class={[
                  'flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors border-none bg-transparent cursor-pointer',
                  tab === item.id ? 'text-primary bg-primary-soft' : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover',
                ].join(' ')}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div class="p-4 border-t border-border">
            <div class="flex items-center gap-2 text-xs text-foreground-subtle">
              <span class="h-2 w-2 rounded-full bg-success" />
              <span>Nodi v{version?.version ?? '—'}</span>
            </div>
            <p class="mt-1 text-[11px] text-foreground-subtle">Up to date</p>
          </div>
        </aside>

        {/* Main Content */}
        <main class="flex-1 overflow-y-auto pb-20 sm:pb-0">
          <div class="px-5 sm:px-8 pt-8 pb-16 max-w-3xl">
            {/* General */}
            {tab === 'general' && (
              <section>
                <h2 class="text-lg font-semibold text-foreground">Server information</h2>
                <div class="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Server name</label>
                    <input value="Nodi" class="input" readOnly />
                    <p class="mt-1.5 text-xs text-foreground-muted">This name is shown on your local network.</p>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Server address</label>
                    <input value="http://nodi.local" class="input" readOnly />
                    <p class="mt-1.5 text-xs text-foreground-muted">Used to access Nodi from other devices.</p>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Version</label>
                    <input value={version?.version ?? '—'} class="input" readOnly />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Uptime</label>
                    <input value={health?.uptime ?? '—'} class="input" readOnly />
                  </div>
                </div>

                <div class="mt-8 pt-8 border-t border-border">
                  <h2 class="text-lg font-semibold text-foreground">Appearance</h2>
                  <div class="mt-5">
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Theme</label>
                    <div class="flex gap-2 max-w-sm">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        class={['btn h-9 px-3 text-xs flex-1', resolvedTheme.value === 'light' ? 'btn-primary' : 'btn-outline'].join(' ')}
                      >
                        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                        Light
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        class={['btn h-9 px-3 text-xs flex-1', resolvedTheme.value === 'dark' ? 'btn-primary' : 'btn-outline'].join(' ')}
                      >
                        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        Dark
                      </button>
                    </div>
                  </div>
                  <div class="mt-5 flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="selection-checkbox"
                      checked={appState.value.showHidden}
                      onChange={toggleHidden}
                    />
                    <span class="text-sm text-foreground">Show hidden files</span>
                  </div>
                  <p class="ml-6 text-xs text-foreground-muted">Files and folders starting with a dot (.)</p>
                </div>
              </section>
            )}

            {/* Password */}
            {tab === 'password' && (
              <section>
                <h2 class="text-lg font-semibold text-foreground">Change password</h2>
                <form onSubmit={submitPassword} class="mt-6 space-y-5 max-w-md">
                  <div>
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Current password</label>
                    <input type="password" value={current} required onInput={(e) => setCurrent((e.target as HTMLInputElement).value)} class="input" autoComplete="current-password" />
                  </div>
                  <div>
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">New password</label>
                    <input type="password" value={next} required minLength={8} onInput={(e) => setNext((e.target as HTMLInputElement).value)} class="input" autoComplete="new-password" />
                    <p class="mt-1.5 text-xs text-foreground-muted">Minimum 8 characters.</p>
                  </div>
                  <div>
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Confirm new password</label>
                    <input type="password" value={confirm} required onInput={(e) => setConfirm((e.target as HTMLInputElement).value)} class="input" autoComplete="new-password" />
                  </div>
                  <button type="submit" disabled={pwLoading || !current || !next || !confirm} class="btn btn-primary h-9 px-4 text-sm">
                    {pwLoading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              </section>
            )}

            {/* Storage */}
            {tab === 'storage' && (
              <section>
                <h2 class="text-lg font-semibold text-foreground">Storage</h2>
                {statsLoading ? (
                  <p class="mt-6 text-sm text-foreground-subtle">Loading…</p>
                ) : stats ? (
                  <div class="mt-6 space-y-5">
                    <div>
                      <div class="flex items-baseline justify-between gap-4">
                        <span class="text-2xl font-semibold tracking-tight tabular text-foreground">{formatBytes(diskUsed)} <span class="text-base text-foreground-muted font-normal">of {formatBytes(stats.total)}</span></span>
                        <span class="text-sm tabular text-foreground-muted">{diskFillPercent.toFixed(0)}% full</span>
                      </div>
                      <div class="mt-3 h-2 w-full bg-surface rounded-full overflow-hidden">
                        <div class="h-full bg-primary rounded-full" style={{ width: `${diskFillPercent}%`, transition: 'width 0.4s ease-out' }} />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Nodi data', value: formatBytes(stats.used) },
                        { label: 'Free', value: formatBytes(stats.free) },
                        { label: 'Files', value: stats.file_count.toLocaleString() },
                        { label: 'Folders', value: stats.dir_count.toLocaleString() },
                      ].map((s) => (
                        <div key={s.label} class="p-3 border border-border rounded-lg bg-card">
                          <p class="text-xs text-foreground-subtle">{s.label}</p>
                          <p class="mt-1 text-sm font-medium text-foreground tabular">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p class="mt-6 text-sm text-foreground-muted">Storage stats unavailable.</p>
                )}
              </section>
            )}

            {/* Trash */}
            {tab === 'trash' && (
              <section>
                <h2 class="text-lg font-semibold text-foreground">Trash</h2>
                <p class="mt-3 text-sm text-foreground-muted">
                  <span class="text-foreground font-medium">{trashItems.length.toLocaleString()}</span> deleted item{trashItems.length === 1 ? '' : 's'} waiting for restore or permanent cleanup.
                </p>
                <div class="mt-6 flex flex-col sm:flex-row sm:items-end gap-3 sm:max-w-md">
                  <div class="flex-1">
                    <label class="text-xs font-medium text-foreground-subtle block mb-2">Empty trash confirmation</label>
                    <input value={trashConfirm} onInput={(e) => setTrashConfirm((e.target as HTMLInputElement).value)} placeholder='Type "EMPTY"' class="input" />
                  </div>
                  <button onClick={emptyTrash} disabled={trashConfirm !== 'EMPTY' || emptyingTrash || trashItems.length === 0} class="btn btn-danger h-9 px-4 text-sm">
                    {emptyingTrash ? 'Emptying…' : 'Empty trash'}
                  </button>
                </div>
                <div class="mt-8 pt-8 border-t border-border">
                  <h3 class="text-base font-medium text-foreground">Maintenance</h3>
                  <p class="mt-2 text-sm text-foreground-muted">Run safe cleanup jobs without touching your active files.</p>
                  <div class="mt-4 flex flex-wrap gap-3">
                    <button onClick={() => runCleanup('uploads')} disabled={!!cleaning} class="btn btn-outline h-9 px-4 text-sm">{cleaning === 'uploads' ? 'Cleaning…' : 'Abandoned uploads'}</button>
                    <button onClick={() => runCleanup('trash')} disabled={!!cleaning} class="btn btn-outline h-9 px-4 text-sm">{cleaning === 'trash' ? 'Cleaning…' : 'Expired trash'}</button>
                    <button onClick={() => runCleanup('all')} disabled={!!cleaning} class="btn btn-primary h-9 px-4 text-sm">{cleaning === 'all' ? 'Cleaning…' : 'Run all cleanup'}</button>
                  </div>
                </div>
              </section>
            )}

            {/* Backup */}
            {tab === 'backup' && (
              <section>
                <h2 class="text-lg font-semibold text-foreground">Backup & restore</h2>
                <div class="mt-6 space-y-8">
                  <div class="p-5 border border-border rounded-lg bg-card">
                    <h3 class="text-sm font-medium text-foreground">Download backup</h3>
                    <p class="mt-1 text-sm text-foreground-muted">Create a streaming TAR of everything in your storage root. App metadata, trash, cache, and logs are excluded.</p>
                    <button onClick={() => { window.location.href = backupAPI.downloadUrl(); }} class="btn btn-primary h-9 px-4 text-sm mt-4">Download backup</button>
                  </div>
                  <div class="p-5 border border-border rounded-lg bg-card">
                    <h3 class="text-sm font-medium text-foreground">Restore</h3>
                    <p class="mt-1 text-sm text-foreground-muted">Restore overwrites existing files. Type <span class="font-mono text-foreground">DELETE</span> to confirm.</p>
                    <div class="mt-4 space-y-3 max-w-md">
                      <input type="text" value={restoreConfirm} onInput={(e) => setRestoreConfirm((e.target as HTMLInputElement).value)} class="input" placeholder='Type "DELETE" to confirm' />
                      <input
                        type="file" accept=".zip,.tar"
                        class="block w-full text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-hover"
                        disabled={restoreConfirm !== 'DELETE'}
                        onChange={async (e) => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          if (!f || restoreConfirm !== 'DELETE') return;
                          setRestoring(true);
                          try {
                            await backupAPI.restore(f);
                            toast('Restore complete', 'success');
                            setRestoreConfirm('');
                          } catch (err) {
                            toast((err as Error).message || 'Restore failed', 'error');
                          } finally { setRestoring(false); }
                        }}
                      />
                      {restoring && <p class="text-xs text-foreground-muted">Restoring…</p>}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Health */}
            {tab === 'health' && (
              <section>
                <h2 class="text-lg font-semibold text-foreground">System health</h2>
                {health ? (
                  <div class="mt-6 border border-border rounded-lg bg-card overflow-hidden">
                    {[
                      { label: 'Status', value: health.status.toUpperCase() },
                      { label: 'Uptime', value: health.uptime },
                      { label: 'Active uploads', value: String(health.active_uploads) },
                      { label: 'Abandoned uploads', value: String(health.abandoned_uploads), warn: health.abandoned_uploads > 0 },
                      { label: 'Trash items', value: String(health.trash_items) },
                      { label: 'Disk free', value: formatBytes(health.storage.free) },
                      { label: 'Upload TTL', value: `${Math.round(health.upload_ttl_seconds / 3600)}h` },
                      { label: 'Trash retention', value: `${Math.round(health.trash_retention_sec / 86400)}d` },
                      { label: 'Version', value: health.version },
                    ].map((row, i) => (
                      <div key={row.label} class={['flex items-baseline justify-between gap-4 px-5 py-3', i !== 0 ? 'border-t border-border' : ''].join(' ')}>
                        <span class="text-sm text-foreground-muted">{row.label}</span>
                        <span class={['text-sm tabular font-medium', row.warn ? 'text-warning' : 'text-foreground'].join(' ')}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p class="mt-6 text-sm text-foreground-muted">Health details unavailable.</p>
                )}

                {activities.length > 0 && (
                  <div class="mt-8">
                    <h3 class="text-base font-medium text-foreground">Recent activity</h3>
                    <div class="mt-4 border border-border rounded-lg bg-card overflow-hidden">
                      <div class="grid grid-cols-[140px_1fr_80px_1fr] items-center gap-2 px-5 py-2.5 text-xs font-medium text-foreground-subtle border-b border-border bg-surface">
                        <span>Time</span>
                        <span>Action</span>
                        <span>User</span>
                        <span>Path</span>
                      </div>
                      {activities.slice(0, 10).map((ev, i) => (
                        <div key={i} class="grid grid-cols-[140px_1fr_80px_1fr] items-center gap-2 px-5 py-2.5 text-sm border-b border-border last:border-0">
                          <span class="font-mono text-xs text-foreground-muted whitespace-nowrap">{new Date(ev.at).toLocaleString()}</span>
                          <span class="text-foreground">{ev.action}</span>
                          <span class="text-foreground-muted">{ev.user}</span>
                          <span class="font-mono text-xs text-foreground-muted truncate" title={ev.path}>{ev.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <div class="mt-10 pt-6 border-t border-border">
              <button onClick={() => navigate('/files')} class="text-sm text-primary hover:underline border-none bg-transparent cursor-pointer">
                ← Back to files
              </button>
            </div>
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
