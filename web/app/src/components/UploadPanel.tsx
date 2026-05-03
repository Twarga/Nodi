import { uploads, panelOpen, clearUploads, togglePanel } from '../hooks/useUpload';

function XIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function ChevronDownIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function ChevronUpIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  );
}

function CheckIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function AlertIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

export function UploadPanel() {
  const list = uploads.value;
  const open = panelOpen.value;

  if (list.length === 0) return null;

  const pending = list.filter(u => u.status === 'pending' || u.status === 'uploading').length;
  const done = list.filter(u => u.status === 'done').length;
  const failed = list.filter(u => u.status === 'error').length;

  return (
    <div
      class={[
        'fixed bottom-5 right-5 z-[90] w-80 rounded-xl border border-border/80 bg-card shadow-2xl transition-all duration-300',
        open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none',
      ].join(' ')}
    >
      {/* Header */}
      <div class="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Uploads</span>
          {pending > 0 && (
            <span class="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {pending}
            </span>
          )}
        </div>
        <div class="flex items-center gap-1">
          <button onClick={togglePanel} class="icon-button h-7 w-7">
            {open ? <ChevronDownIcon class="h-3.5 w-3.5" /> : <ChevronUpIcon class="h-3.5 w-3.5" />}
          </button>
          <button onClick={clearUploads} class="icon-button h-7 w-7" title="Clear">
            <XIcon class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div class="max-h-60 overflow-y-auto no-scrollbar">
        {list.map((item) => (
          <div key={item.id} class="border-b border-border/30 px-4 py-3 last:border-0">
            <div class="flex items-center gap-2">
              {item.status === 'done' ? (
                <CheckIcon class="h-4 w-4 text-success shrink-0" />
              ) : item.status === 'error' ? (
                <AlertIcon class="h-4 w-4 text-destructive shrink-0" />
              ) : (
                <svg class="h-4 w-4 animate-spin text-primary shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              <span class="flex-1 truncate text-sm">{item.file}</span>
              <span class="text-xs text-muted-foreground tabular">
                {item.status === 'done' ? 'Done' : item.status === 'error' ? 'Failed' : `${item.percent}%`}
              </span>
            </div>

            {/* Progress bar */}
            {item.status !== 'done' && item.status !== 'error' && (
              <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            )}

            {item.status === 'error' && item.error && (
              <p class="mt-1 text-xs text-destructive">{item.error}</p>
            )}
          </div>
        ))}
      </div>

      {/* Footer summary */}
      <div class="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
        {done === list.length ? (
          <span>All uploads complete</span>
        ) : (
          <span>{done} done{failed > 0 ? `, ${failed} failed` : ''}, {pending} pending</span>
        )}
      </div>
    </div>
  );
}
