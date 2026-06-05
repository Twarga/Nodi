interface EmptyStateProps {
  onUpload?: () => void;
}

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div class="py-16 flex flex-col items-center text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-xl bg-surface text-foreground-subtle">
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <h3 class="mt-4 text-base font-medium text-foreground">This folder is empty</h3>
      <p class="mt-1 max-w-xs text-sm text-foreground-muted">
        Drop files here or create a new folder to get started.
      </p>
      {onUpload && (
        <button onClick={onUpload} class="btn btn-primary h-9 px-4 text-sm mt-5">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload files
        </button>
      )}
    </div>
  );
}
