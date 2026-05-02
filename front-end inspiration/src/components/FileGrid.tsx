import { useEffect, useRef, useState } from "react";
import { MoreVertical, Download, Pencil, Trash2 } from "lucide-react";
import { FsEntry, formatRelative } from "@/lib/fileStore";
import { FileIcon } from "./FileIcon";

interface Props {
  entries: FsEntry[];
  onOpen: (e: FsEntry) => void;
  onRename: (e: FsEntry) => void;
  onDelete: (e: FsEntry) => void;
  onDownload: (e: FsEntry) => void;
}

export const FileGrid = ({ entries, onOpen, onRename, onDelete, onDownload }: Props) => {
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
    <div ref={ref} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 animate-ql-fade-in">
      {entries.map((e, i) => (
        <div
          key={e.id}
          onClick={() => onOpen(e)}
          className="group relative aspect-square rounded-lg border border-border bg-surface p-3 cursor-pointer hover:border-border-strong hover:bg-surface-hover transition-colors animate-ql-fade-in flex flex-col"
          style={{ animationDelay: `${Math.min(i, 12) * 15}ms` }}
        >
          <div className="flex-1 flex items-center justify-center">
            <FileIcon kind={e.kind} size={48} />
          </div>
          <div className="mt-2 min-w-0">
            <div className="text-sm font-medium truncate">{e.name}</div>
            <div className="text-xs text-muted-foreground tabular truncate">{formatRelative(e.modified)}</div>
          </div>

          <button
            onClick={(ev) => { ev.stopPropagation(); setOpenMenu(openMenu === e.id ? null : e.id); }}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground transition-all"
            aria-label="Actions"
          >
            <MoreVertical size={15} />
          </button>

          {openMenu === e.id && (
            <div
              className="absolute right-2 top-10 z-20 w-40 rounded-md border border-border bg-popover py-1 shadow-md animate-ql-fade-in"
              onClick={(ev) => ev.stopPropagation()}
            >
              {e.kind !== "folder" && (
                <button onClick={() => { setOpenMenu(null); onDownload(e); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover">
                  <Download size={15} /> Download
                </button>
              )}
              <button onClick={() => { setOpenMenu(null); onRename(e); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover">
                <Pencil size={15} /> Rename
              </button>
              <button onClick={() => { setOpenMenu(null); onDelete(e); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-surface-hover">
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
