function FolderOpenIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function UploadCloudIcon({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

interface EmptyStateProps {
  onUpload?: () => void;
}

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div class="empty-state">
      <div class="mb-4 rounded-2xl border-2 border-dashed border-border p-6">
        <FolderOpenIcon class="h-12 w-12 text-muted-foreground/50" />
      </div>
      <h3 class="mb-1 text-lg font-semibold text-foreground">This folder is empty</h3>
      <p class="mb-4 max-w-xs text-sm text-muted-foreground">
        Drop files here or create a new folder to get started.
      </p>
      {onUpload && (
        <button onClick={onUpload} class="command-button primary gap-2">
          <UploadCloudIcon class="h-4 w-4" />
          Upload files
        </button>
      )}
    </div>
  );
}
