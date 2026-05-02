import { useEffect, useRef, useState } from "react";
import { MoreVertical, Download, Pencil, Trash2 } from "lucide-react";
import { FsEntry, formatBytes, formatRelative } from "@/lib/fileStore";
import { FileIcon } from "./FileIcon";

interface Props {
  entries: FsEntry[];
  onOpen: (e: FsEntry) => void;
  onRename: (e: FsEntry) => void;
  onDelete: (e: FsEntry) => void;
  onDownload: (e: FsEntry) => void;
}

export const FileList = ({ entries, onOpen, onRename, onDelete, onDownload }: Props) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="rounded-lg border border-border bg-surface overflow-hidden animate-ql-fade-in">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[1fr_110px_160px_56px] items-center gap-4 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div>Name</div>
        <div className="text-right">Size</div>
        <div>Modified</div>
        <div></div>
      </div>

      <ul>
        {entries.map((e, i) => (
          <li
            key={e.id}
            className="ql-row-hover group grid grid-cols-[1fr_56px] sm:grid-cols-[1fr_110px_160px_56px] items-center gap-4 border-b border-border last:border-b-0 px-4 py-2.5 cursor-pointer animate-ql-fade-in"
            style={{ animationDelay: `${Math.min(i, 12) * 15}ms` }}
            onClick={() => onOpen(e)}
            onContextMenu={(ev) => { ev.preventDefault(); setOpenMenu(e.id); }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileIcon kind={e.kind} size={20} />
              <span className="truncate text-sm font-medium">{e.name}</span>
            </div>
            <div className="hidden sm:block text-right text-sm text-muted-foreground tabular">
              {formatBytes(e.size)}
            </div>
            <div className="hidden sm:block text-sm text-muted-foreground tabular">
              {formatRelative(e.modified)}
            </div>
            <div className="relative flex justify-end">
              <button
                onClick={(ev) => { ev.stopPropagation(); setOpenMenu(openMenu === e.id ? null : e.id); }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-secondary hover:text-foreground transition-all"
                aria-label="Actions"
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === e.id && (
                <div
                  className="absolute right-0 top-9 z-20 w-44 rounded-md border border-border bg-popover py-1 shadow-md animate-ql-fade-in"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  {e.kind !== "folder" && (
                    <button
                      onClick={() => { setOpenMenu(null); onDownload(e); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover"
                    >
                      <Download size={15} /> Download
                    </button>
                  )}
                  <button
                    onClick={() => { setOpenMenu(null); onRename(e); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover"
                  >
                    <Pencil size={15} /> Rename
                  </button>
                  <button
                    onClick={() => { setOpenMenu(null); onDelete(e); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-surface-hover"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
