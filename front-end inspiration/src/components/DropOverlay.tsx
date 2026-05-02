import { Upload } from "lucide-react";

interface Props {
  visible: boolean;
}
export const DropOverlay = ({ visible }: Props) => {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-40 flex items-center justify-center transition-opacity duration-100 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-primary/10" />
      <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-primary" />
      <div className="relative flex flex-col items-center gap-3 rounded-xl bg-card px-8 py-6 border border-border shadow-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 animate-ql-pulse-soft">
          <Upload size={26} className="text-primary" />
        </div>
        <div className="text-base font-semibold">Drop to upload</div>
        <div className="text-sm text-muted-foreground">Files will upload to the current folder</div>
      </div>
    </div>
  );
};
