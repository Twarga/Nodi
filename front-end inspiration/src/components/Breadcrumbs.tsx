import { Home, ChevronRight } from "lucide-react";
import { FsEntry } from "@/lib/fileStore";

interface Props {
  path: FsEntry[];
  onNavigate: (id: string) => void;
}

export const Breadcrumbs = ({ path, onNavigate }: Props) => {
  // Mobile truncation: show home / ... / last
  const showEllipsis = path.length > 2;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm min-w-0">
        <li>
          <button
            onClick={() => onNavigate("root")}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Home size={15} />
            <span className="font-medium">Home</span>
          </button>
        </li>

        {/* Mobile ellipsis */}
        {showEllipsis && (
          <li className="sm:hidden flex items-center gap-1">
            <ChevronRight size={14} className="text-muted-foreground/60" />
            <span className="px-1.5 text-muted-foreground">…</span>
          </li>
        )}

        {path.map((seg, i) => {
          const isLast = i === path.length - 1;
          const hideOnMobile = showEllipsis && !isLast;
          return (
            <li key={seg.id} className={`flex items-center gap-1 min-w-0 ${hideOnMobile ? "hidden sm:flex" : ""}`}>
              <ChevronRight size={14} className="text-muted-foreground/60 shrink-0" />
              {isLast ? (
                <span className="px-1.5 py-1 font-semibold truncate" aria-current="page">{seg.name}</span>
              ) : (
                <button
                  onClick={() => onNavigate(seg.id)}
                  className="px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded transition-colors truncate max-w-[160px]"
                >
                  {seg.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
