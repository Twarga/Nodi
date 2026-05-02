export type FileKind = "folder" | "image" | "pdf" | "video" | "generic";

export interface FsEntry {
  id: string;
  name: string;
  kind: FileKind;
  size: number; // bytes; 0 for folders
  modified: number; // epoch ms
  parentId: string | null;
}

const ROOT = "root";
const now = Date.now();
const D = (days: number) => now - days * 86400000;
const H = (hours: number) => now - hours * 3600000;

let _id = 0;
const uid = () => `e${++_id}`;

const seed: FsEntry[] = [
  { id: uid(), name: "Documents", kind: "folder", size: 0, modified: D(2), parentId: ROOT },
  { id: uid(), name: "Photos", kind: "folder", size: 0, modified: D(7), parentId: ROOT },
  { id: uid(), name: "Backups", kind: "folder", size: 0, modified: D(30), parentId: ROOT },
  { id: uid(), name: "resume.pdf", kind: "pdf", size: 2_400_000, modified: D(7), parentId: ROOT },
  { id: uid(), name: "vacation.jpg", kind: "image", size: 1_800_000, modified: D(3), parentId: ROOT },
  { id: uid(), name: "homelab-setup.mp4", kind: "video", size: 248_000_000, modified: H(5), parentId: ROOT },
  { id: uid(), name: "notes.txt", kind: "generic", size: 4_200, modified: H(1), parentId: ROOT },
];
// Children of Documents
const docsId = seed[0].id;
seed.push(
  { id: uid(), name: "Invoices", kind: "folder", size: 0, modified: D(14), parentId: docsId },
  { id: uid(), name: "tax-2024.pdf", kind: "pdf", size: 5_200_000, modified: D(10), parentId: docsId },
  { id: uid(), name: "contract.pdf", kind: "pdf", size: 980_000, modified: D(20), parentId: docsId },
);

type Listener = () => void;
class Store {
  entries: FsEntry[] = seed;
  listeners = new Set<Listener>();
  totalBytes = 512 * 1024 ** 3; // 512 GB

  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  emit() { this.listeners.forEach(l => l()); }

  childrenOf(parentId: string) {
    return this.entries
      .filter(e => e.parentId === parentId)
      .sort((a, b) => {
        if (a.kind === "folder" && b.kind !== "folder") return -1;
        if (a.kind !== "folder" && b.kind === "folder") return 1;
        return a.name.localeCompare(b.name);
      });
  }

  pathTo(id: string): FsEntry[] {
    if (id === ROOT) return [];
    const path: FsEntry[] = [];
    let cur: FsEntry | undefined = this.entries.find(e => e.id === id);
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? this.entries.find(e => e.id === cur!.parentId) : undefined;
    }
    return path;
  }

  usedBytes() {
    return this.entries.reduce((acc, e) => acc + e.size, 0);
  }

  createFolder(parentId: string, name: string) {
    this.entries.push({ id: uid(), name, kind: "folder", size: 0, modified: Date.now(), parentId });
    this.emit();
  }
  rename(id: string, name: string) {
    const e = this.entries.find(x => x.id === id);
    if (e) { e.name = name; e.modified = Date.now(); this.emit(); }
  }
  remove(id: string) {
    // recursive
    const toDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of this.entries) {
        if (e.parentId && toDelete.has(e.parentId) && !toDelete.has(e.id)) {
          toDelete.add(e.id); changed = true;
        }
      }
    }
    this.entries = this.entries.filter(e => !toDelete.has(e.id));
    this.emit();
  }
  addFile(parentId: string, name: string, size: number) {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const kind: FileKind =
      ["jpg","jpeg","png","gif","webp","heic","svg"].includes(ext) ? "image" :
      ext === "pdf" ? "pdf" :
      ["mp4","mov","mkv","webm","avi"].includes(ext) ? "video" : "generic";
    this.entries.push({ id: uid(), name, kind, size, modified: Date.now(), parentId });
    this.emit();
  }
}

export const store = new Store();
export const ROOT_ID = ROOT;

export const formatBytes = (n: number) => {
  if (n === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

export const formatRelative = (ts: number) => {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const y = Math.round(mo / 12);
  return `${y} year${y === 1 ? "" : "s"} ago`;
};
