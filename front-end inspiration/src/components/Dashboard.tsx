import { useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Upload, List, LayoutGrid } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FileList } from "@/components/FileList";
import { FileGrid } from "@/components/FileGrid";
import { Modal } from "@/components/Modal";
import { DropOverlay } from "@/components/DropOverlay";
import { EmptyState } from "@/components/EmptyState";
import { UploadList, UploadItem } from "@/components/UploadList";
import { ROOT_ID, store, FsEntry } from "@/lib/fileStore";
import { useFsSnapshot } from "@/lib/useFsSnapshot";

interface Props {
  username: string;
  onLogout: () => void;
}

type View = "list" | "grid";

export const Dashboard = ({ username, onLogout }: Props) => {
  useFsSnapshot();
  const [currentId, setCurrentId] = useState<string>(ROOT_ID);
  const [view, setView] = useState<View>("list");
  const [navKey, setNavKey] = useState(0); // re-trigger fade
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FsEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry | null>(null);
  const [folderName, setFolderName] = useState("");
  const [renameVal, setRenameVal] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const path = useMemo(() => store.pathTo(currentId), [currentId, store.entries]);
  const entries = useMemo(() => store.childrenOf(currentId), [currentId, store.entries]);

  // Drag & drop on window
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragCounter.current++;
      setDragOver(true);
    };
    const onDragLeave = () => {
      dragCounter.current--;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); }
    };
    const onDragOver = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      dragCounter.current = 0;
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) startUploads(files);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  });

  const startUploads = (files: File[]) => {
    const items: UploadItem[] = files.map(f => ({
      id: `u-${Date.now()}-${Math.random()}`,
      name: f.name,
      progress: 0,
      error: f.size > 1024 * 1024 * 1024 ? "File too large (>1 GB)" : undefined,
    }));
    setUploads(prev => [...prev, ...items]);
    items.forEach((it, i) => {
      if (it.error) return;
      const file = files[i];
      const tick = () => {
        setUploads(prev => prev.map(u => {
          if (u.id !== it.id) return u;
          const next = Math.min(100, u.progress + Math.random() * 22 + 8);
          return { ...u, progress: next };
        }));
      };
      const interval = setInterval(() => {
        tick();
        setUploads(prev => {
          const me = prev.find(u => u.id === it.id);
          if (me && me.progress >= 100) {
            clearInterval(interval);
            store.addFile(currentId, file.name, file.size);
            // auto dismiss after 1.5s
            setTimeout(() => setUploads(p => p.filter(x => x.id !== it.id)), 1500);
          }
          return prev;
        });
      }, 180);
    });
  };

  const navigate = (id: string) => {
    setCurrentId(id);
    setNavKey(k => k + 1);
  };

  const onOpen = (e: FsEntry) => {
    if (e.kind === "folder") navigate(e.id);
    else {
      // simulate download
      console.log("Download", e.name);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar username={username} onLogout={onLogout} />

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 sm:px-6 py-5">
        {/* Breadcrumbs row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Breadcrumbs path={path} onNavigate={navigate} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setFolderName(""); setNewFolderOpen(true); }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              <FolderPlus size={15} /> <span className="hidden xs:inline sm:inline">New Folder</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              <Upload size={15} /> Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) startUploads(files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Sub row: counts + view toggle */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground tabular">
            {entries.length} item{entries.length === 1 ? "" : "s"}
          </div>
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List size={14} /> List
            </button>
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
          </div>
        </div>

        {/* Uploads */}
        <div className="mt-4">
          <UploadList items={uploads} onDismiss={(id) => setUploads(p => p.filter(u => u.id !== id))} />

          <div key={navKey} className="animate-ql-slide-in-right">
            {entries.length === 0 ? (
              <EmptyState onUpload={() => fileInputRef.current?.click()} />
            ) : view === "list" ? (
              <FileList
                entries={entries}
                onOpen={onOpen}
                onRename={(e) => { setRenameVal(e.name); setRenameTarget(e); }}
                onDelete={(e) => setDeleteTarget(e)}
                onDownload={(e) => console.log("Download", e.name)}
              />
            ) : (
              <FileGrid
                entries={entries}
                onOpen={onOpen}
                onRename={(e) => { setRenameVal(e.name); setRenameTarget(e); }}
                onDelete={(e) => setDeleteTarget(e)}
                onDownload={(e) => console.log("Download", e.name)}
              />
            )}
          </div>
        </div>
      </div>

      <DropOverlay visible={dragOver} />

      {/* New Folder */}
      <Modal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} title="Create New Folder">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = folderName.trim();
            if (!name) return;
            store.createFolder(currentId, name);
            setNewFolderOpen(false);
          }}
        >
          <input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setNewFolderOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Create</button>
          </div>
        </form>
      </Modal>

      {/* Rename */}
      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!renameTarget) return;
            const v = renameVal.trim();
            if (!v) return;
            store.rename(renameTarget.id, v);
            setRenameTarget(null);
          }}
        >
          <input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setRenameTarget(null)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Save</button>
          </div>
        </form>
      </Modal>

      {/* Delete */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`Delete ${deleteTarget?.name ?? ""}?`}>
        <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
          <button
            onClick={() => { if (deleteTarget) { store.remove(deleteTarget.id); setDeleteTarget(null); } }}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
};
