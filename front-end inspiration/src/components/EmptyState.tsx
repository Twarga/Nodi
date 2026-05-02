import { Upload, FolderPlus } from "lucide-react";

interface Props {
  onUpload: () => void;
}
export const EmptyState = ({ onUpload }: Props) => (
  <div className="rounded-lg border-2 border-dashed border-border bg-surface/50 p-10 sm:p-16 text-center animate-ql-fade-in">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
      <FolderPlus size={28} className="text-muted-foreground" />
    </div>
    <h3 className="mt-5 text-base font-semibold">This folder is empty</h3>
    <p className="mt-1 text-sm text-muted-foreground">Drag files here to upload them.</p>
    <button
      onClick={onUpload}
      className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
    >
      <Upload size={15} /> Upload Files
    </button>
  </div>
);
