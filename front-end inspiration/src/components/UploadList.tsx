import { Loader2, X, AlertCircle } from "lucide-react";

export interface UploadItem {
  id: string;
  name: string;
  progress: number; // 0-100
  error?: string;
}

interface Props {
  items: UploadItem[];
  onDismiss: (id: string) => void;
}

export const UploadList = ({ items, onDismiss }: Props) => {
  if (items.length === 0) return null;
  const totalProgress = items.reduce((a, b) => a + b.progress, 0) / items.length;
  const allDone = items.every(i => i.progress >= 100 || i.error);

  return (
    <div className="mb-3 rounded-lg border border-border bg-surface overflow-hidden animate-ql-fade-in">
      {!allDone && (
        <div className="h-1 w-full bg-secondary">
          <div className="h-full bg-primary transition-all duration-150" style={{ width: `${totalProgress}%` }} />
        </div>
      )}
      <ul>
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
            {it.error ? (
              <AlertCircle size={16} className="text-destructive shrink-0" />
            ) : it.progress >= 100 ? (
              <div className="h-4 w-4 rounded-full bg-success shrink-0" />
            ) : (
              <Loader2 size={16} className="animate-spin text-primary shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{it.name}</div>
              {it.error ? (
                <div className="text-xs text-destructive">{it.error}</div>
              ) : (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-all duration-150" style={{ width: `${it.progress}%` }} />
                </div>
              )}
            </div>
            <span className="text-xs tabular text-muted-foreground w-10 text-right shrink-0">
              {it.error ? "" : `${Math.round(it.progress)}%`}
            </span>
            {(it.progress >= 100 || it.error) && (
              <button onClick={() => onDismiss(it.id)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
