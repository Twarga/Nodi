import { FileKind } from "@/lib/fileStore";
import { Folder, FileText, Image as ImageIcon, Film, File } from "lucide-react";

interface Props {
  kind: FileKind;
  className?: string;
  size?: number;
}

const map = {
  folder: { Icon: Folder, color: "text-icon-folder" },
  image:  { Icon: ImageIcon, color: "text-icon-image" },
  pdf:    { Icon: FileText, color: "text-icon-pdf" },
  video:  { Icon: Film, color: "text-icon-video" },
  generic:{ Icon: File, color: "text-icon-generic" },
} as const;

export const FileIcon = ({ kind, className = "", size = 20 }: Props) => {
  const { Icon, color } = map[kind];
  return <Icon size={size} className={`${color} ${className}`} strokeWidth={1.75} />;
};
