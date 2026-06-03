import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  dirty: boolean;
  dirtyCount: number;
  path: string;
  lastBackup: string | null;
  blockCount: number;
  onDiscard: () => void;
  hint: ReactNode;
}

export function StatusBar({
  dirty,
  dirtyCount,
  path,
  lastBackup,
  blockCount,
  onDiscard,
  hint,
}: StatusBarProps) {
  const display = path ? path.replace(/^\/Users\/[^/]+/, "~") : "~/.zshrc";
  return (
    <footer className="shrink-0 select-none border-t border-border bg-card/60 backdrop-blur-xl">
      <div className="flex h-6 items-center gap-3 px-3 text-[11.5px]">
        <span className="flex items-center gap-1.5">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-amber-400" : "bg-[var(--brand)]")}
          />
          <span className={dirty ? "text-foreground" : "text-muted-foreground"}>
            {dirty ? `${dirtyCount} unsaved ${dirtyCount === 1 ? "change" : "changes"}` : "Saved"}
          </span>
        </span>
        <span className="text-border">·</span>
        <span className="min-w-0 truncate font-mono text-muted-foreground">{display}</span>
        <span className="text-border">·</span>
        <span className="text-muted-foreground tnum">{blockCount} blocks</span>
        {lastBackup && (
          <>
            <span className="text-border">·</span>
            <span className="text-muted-foreground tnum">backup {lastBackup}</span>
          </>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty}
          className="text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
        >
          Discard
        </button>
      </div>
      <div className="flex h-6 items-center gap-2 border-t border-border/50 px-3 font-mono text-[10.5px] text-muted-foreground/70">
        {hint}
      </div>
    </footer>
  );
}
