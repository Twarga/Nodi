import { useEffect, useState } from 'preact/hooks';
import { storageAPI, passwordAPI, versionAPI, activityAPI, backupAPI } from '../lib/api';
import type { StorageStats, VersionInfo, ActivityEvent } from '../lib/api';
import { TopBar } from '../components/TopBar';
import { toast, ToastContainer } from '../hooks/useToast';
import { navigate } from '../lib/router';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function SettingsPage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    storageAPI.stats()
      .then(setStats)
      .catch(() => toast('Failed to load storage stats', 'error'))
      .finally(() => setStatsLoading(false));
    versionAPI.get().then(setVersion).catch(() => {});
    activityAPI.list(50).then(setActivities).catch(() => {});
  }, []);

  const submitPassword = async (e: Event) => {
    e.preventDefault();
    if (next.length < 8) {
      toast('New password must be at least 8 characters', 'error');
      return;
    }
    if (next !== confirm) {
      toast('Passwords do not match', 'error');
      return;
    }
    setPwLoading(true);
    try {
      await passwordAPI.change(current, next);
      toast('Password updated', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      toast((err as Error).message || 'Failed to change password', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  // Two ratios:
  //   diskFillPercent — how full the underlying filesystem is (used by everything)
  //   nodiSharePercent — how much of the disk Nodi's own data accounts for
  const diskUsed = stats ? Math.max(0, stats.total - stats.free) : 0;
  const diskFillPercent = stats && stats.total > 0
    ? Math.min(100, (diskUsed / stats.total) * 100)
    : 0;
  const nodiSharePercent = stats && stats.total > 0
    ? Math.min(100, (stats.used / stats.total) * 100)
    : 0;

  return (
    <div class="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <main class="flex-1 overflow-y-auto">
        <div class="px-4 sm:px-6 lg:px-8 pt-6 pb-12 mx-auto max-w-3xl">
          <div class="mb-6 flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              class="icon-button h-9 w-9"
              title="Back to files"
              aria-label="Back to files"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
            <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
          </div>

          {/* Storage card */}
          <section class="rounded-2xl border border-border bg-surface p-6 mb-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Storage</h2>
            {statsLoading ? (
              <div class="h-20 animate-pulse rounded-lg bg-muted/50" />
            ) : stats ? (
              <>
                <div class="flex items-baseline justify-between mb-2">
                  <div class="text-2xl font-bold">{formatBytes(diskUsed)}</div>
                  <div class="text-sm text-muted-foreground">
                    of {formatBytes(stats.total)} ({diskFillPercent.toFixed(1)}% full)
                  </div>
                </div>
                <div class="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 rounded-full"
                    style={`width: ${diskFillPercent.toFixed(2)}%`}
                    title={`Disk usage: ${diskFillPercent.toFixed(1)}%`}
                  />
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="inline-block h-2.5 w-2.5 rounded-sm bg-gradient-to-r from-cyan-500 to-blue-600" />
                    <span class="text-muted-foreground">Nodi data:</span>
                    <span class="font-semibold text-foreground">{formatBytes(stats.used)}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="inline-block h-2.5 w-2.5 rounded-sm bg-muted border border-border" />
                    <span class="text-muted-foreground">Free:</span>
                    <span class="font-semibold text-foreground">{formatBytes(stats.free)}</span>
                  </div>
                </div>
                <div class="mt-4 flex gap-6 text-xs text-muted-foreground border-t border-border pt-3">
                  <div><span class="font-semibold text-foreground">{stats.file_count.toLocaleString()}</span> files</div>
                  <div><span class="font-semibold text-foreground">{stats.dir_count.toLocaleString()}</span> folders</div>
                </div>
              </>
            ) : (
              <p class="text-sm text-muted-foreground">Storage stats unavailable.</p>
            )}
          </section>

          {/* Password card */}
          <section class="rounded-2xl border border-border bg-surface p-6 mb-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Change Password</h2>
            <form onSubmit={submitPassword} class="space-y-4">
              <div>
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current password</label>
                <input
                  type="password" value={current} required
                  onInput={(e) => setCurrent((e.target as HTMLInputElement).value)}
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">New password</label>
                <input
                  type="password" value={next} required minLength={8}
                  onInput={(e) => setNext((e.target as HTMLInputElement).value)}
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="new-password"
                />
                <p class="mt-1 text-xs text-muted-foreground">Minimum 8 characters.</p>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm new password</label>
                <input
                  type="password" value={confirm} required
                  onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={pwLoading || !current || !next || !confirm}
                class="command-button primary h-10 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwLoading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </section>

          {/* Backup card */}
          <section class="rounded-2xl border border-border bg-surface p-6 mb-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Backup & Restore</h2>
            <div class="space-y-4">
              <div>
                <button
                  onClick={() => { window.location.href = backupAPI.downloadUrl(); }}
                  class="command-button primary h-10 px-4 text-sm inline-flex items-center gap-2"
                  title="Backup everything inside nodi_files as a ZIP"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Backup
                </button>
                <p class="mt-1.5 text-xs text-muted-foreground">
                  Creates a ZIP of your entire <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">nodi_files</code> folder
                  (includes files, shares, favorites, and activity log; excludes trash and cache).
                </p>
              </div>
              <hr class="border-border" />
              <div>
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Restore from file</label>
                <p class="mb-2 text-xs text-destructive font-medium">Warning: This overwrites existing files. Type DELETE to confirm.</p>
                <input
                  type="text" value={restoreConfirm}
                  onInput={(e) => setRestoreConfirm((e.target as HTMLInputElement).value)}
                  class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 mb-2"
                  placeholder='Type "DELETE" to confirm'
                />
                <input
                  type="file" accept=".zip"
                  class="h-10 w-full text-sm"
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
                    } finally {
                      setRestoring(false);
                    }
                  }}
                />
                {restoring && <p class="mt-2 text-xs text-muted-foreground">Restoring...</p>}
              </div>
            </div>
          </section>

          {/* About card */}
          <section class="rounded-2xl border border-border bg-surface p-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">About</h2>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Version</dt>
                <dd class="font-mono">{version?.version ?? '—'}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Runtime</dt>
                <dd class="font-mono">Go {version?.go_version ?? '—'}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted-foreground">Project</dt>
                <dd>Nodi · Self-hosted file manager</dd>
              </div>
            </dl>
          </section>

          {/* Activity card */}
          <section class="rounded-2xl border border-border bg-surface p-6 mb-6">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Recent Activity</h2>
            {activities.length === 0 ? (
              <p class="text-sm text-muted-foreground">No activity recorded.</p>
            ) : (
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th class="pb-2 text-left">Time</th>
                      <th class="pb-2 text-left">Action</th>
                      <th class="pb-2 text-left">User</th>
                      <th class="pb-2 text-left">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((ev, i) => (
                      <tr key={i} class="border-b border-border/30 last:border-0">
                        <td class="py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{new Date(ev.at).toLocaleString()}</td>
                        <td class="py-1.5"><span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">{ev.action}</span></td>
                        <td class="py-1.5 text-muted-foreground">{ev.user}</td>
                        <td class="py-1.5 font-mono text-xs truncate max-w-[200px]" title={ev.path}>{ev.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
