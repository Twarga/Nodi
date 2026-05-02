import { useTheme } from "@/lib/theme";
import { Moon, Sun, LogOut, Info } from "lucide-react";
import { NodiLogo } from "./NodiLogo";
import { useEffect, useRef, useState } from "react";
import { formatBytes, store } from "@/lib/fileStore";
import { useFsSnapshot } from "@/lib/useFsSnapshot";

interface Props {
  username: string;
  onLogout: () => void;
}

export const TopBar = ({ username, onLogout }: Props) => {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useFsSnapshot();
  const used = store.usedBytes();
  const total = store.totalBytes;
  const pct = Math.min(100, (used / total) * 100);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2.5">
            <NodiLogo className="h-7 w-7 text-primary" />
            <h1 className="text-[15px] font-semibold tracking-tight">
              Nodi
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-border bg-background px-3 py-1">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular text-muted-foreground">
              {formatBytes(used)} / {formatBytes(total)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors"
              aria-label="User menu"
            >
              {username.charAt(0).toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover py-1 shadow-md animate-ql-fade-in">
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-xs text-muted-foreground">Signed in as</div>
                  <div className="text-sm font-medium truncate">{username}</div>
                </div>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-surface-hover">
                  <Info size={15} /> About
                  <span className="ml-auto text-xs text-muted-foreground tabular">v1.0</span>
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-surface-hover"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
