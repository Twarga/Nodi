import { uploads, panelOpen, clearCompleted, clearUploads, togglePanel, cancelUpload, pauseUpload, resumeUpload, retryUpload } from '../hooks/useUpload';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return '';
  if (seconds < 60) return `${Math.round(seconds)}s left`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m left` : `${hours}h left`;
}

export function UploadPanel() {
  const list = uploads.value;
  const open = panelOpen.value;

  if (list.length === 0) return null;

  const pending = list.filter((u) => u.status === 'pending' || u.status === 'uploading').length;
  const paused = list.filter((u) => u.status === 'paused').length;
  const done = list.filter((u) => u.status === 'done').length;
  const skipped = list.filter((u) => u.status === 'skipped').length;
  const failed = list.filter((u) => u.status === 'error').length;
  const finished = done + skipped + failed;
  const canClearCompleted = finished > 0;
  const groups = Array.from(new Set(list.map((item) => item.group)));

  const cancelAll = () => {
    if (!confirm('Cancel every active upload? Finished items will stay in history.')) return;
    clearUploads();
  };

  return (
    <div
      class={[
        'fixed bottom-4 right-4 z-[90] w-full max-w-[400px] bg-popover border border-border rounded-xl shadow-2xl transition-all duration-300 overflow-hidden',
        open ? 'translate-y-0 opacity-100' : 'translate-y-[calc(100%-48px)] opacity-100',
      ].join(' ')}
    >
      {/* Header */}
      <button
        onClick={togglePanel}
        class="flex w-full items-center justify-between gap-3 px-4 h-12 text-left border-b border-border"
      >
        <div class="flex items-center gap-2.5">
          <span class="text-sm font-medium">Uploads</span>
          {pending > 0 && (
            <span class="flex h-5 items-center px-1.5 rounded-full bg-primary-soft text-xs text-primary font-medium tabular">{pending}</span>
          )}
        </div>
        <div class="flex items-center gap-1">
          {canClearCompleted && (
            <button
              onClick={(e) => { e.stopPropagation(); clearCompleted(); }}
              class="text-xs text-primary hover:underline border-none bg-transparent cursor-pointer px-2 py-1"
            >
              Clear finished
            </button>
          )}
          {pending > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); cancelAll(); }}
              class="text-xs text-destructive hover:underline border-none bg-transparent cursor-pointer px-2 py-1"
            >
              Cancel all
            </button>
          )}
          <svg class={['h-4 w-4 text-foreground-muted transition-transform', open ? '' : 'rotate-180'].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="18 15 12 9 6 15"/></svg>
        </div>
      </button>

      {/* List */}
      <div class="max-h-80 overflow-y-auto">
        {groups.map((group) => (
          <div key={group}>
            <div class="px-4 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-foreground-subtle">
              {group}
            </div>
            {list.filter((item) => item.group === group).map((item) => (
              <div key={item.id} class="px-4 py-2.5">
                <div class="flex items-center gap-2.5">
                  {item.status === 'done' ? (
                    <svg class="h-4 w-4 text-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : item.status === 'error' ? (
                    <svg class="h-4 w-4 text-destructive shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  ) : (
                    <svg class="h-3.5 w-3.5 animate-spin text-primary shrink-0" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  )}
                  <span class="flex-1 truncate text-sm text-foreground">{item.file}</span>
                  <span class="text-xs text-foreground-muted tabular shrink-0">
                    {item.status === 'done' ? 'Done'
                      : item.status === 'error' ? 'Failed'
                      : `${item.percent}%`}
                  </span>
                  <div class="flex items-center gap-0.5 shrink-0">
                    {item.status === 'error' && (
                      <button onClick={() => retryUpload(item.id)} class="icon-button h-6 w-6" title="Retry">
                        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                      </button>
                    )}
                    {item.status !== 'done' && item.status !== 'skipped' && (
                      <button onClick={() => cancelUpload(item.id)} class="icon-button h-6 w-6" title="Cancel">
                        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {item.status !== 'done' && item.status !== 'skipped' && item.status !== 'error' && (
                  <>
                    <div class="mt-1.5 h-1 w-full bg-surface rounded-full overflow-hidden">
                      <div
                        class="h-full bg-primary rounded-full"
                        style={{ width: `${item.percent}%`, transition: 'width 0.3s ease-out' }}
                      />
                    </div>
                    <div class="mt-1 flex items-center justify-between text-[11px] text-foreground-muted tabular">
                      <span>{formatBytes(item.loaded)} / {formatBytes(item.total)}</span>
                      <span>
                        {item.speedBps ? `${formatBytes(item.speedBps)}/s` : ''}
                        {item.etaSeconds ? ` · ${formatDuration(item.etaSeconds)}` : ''}
                      </span>
                    </div>
                  </>
                )}

                {item.status === 'error' && item.error && (
                  <p class="mt-1 text-xs text-destructive">{item.error}</p>
                )}
                {item.status === 'done' && item.sha256 && (
                  <p class="mt-1 font-mono text-[11px] text-foreground-muted truncate" title={item.sha256}>SHA-256 {item.sha256}</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
