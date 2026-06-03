import {
  Clock,
  Command,
  Moon,
  ArrowsClockwise as RefreshCw,
  ShieldWarning as ShieldAlert,
  Sun,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Kbd } from "./Kbd";

interface TitlebarProps {
  path: string;
  lineCount: number;
  dirty: boolean;
  externalChanged: boolean;
  onReviewSave: () => void;
  onOpenBackups: () => void;
  onOpenPalette: () => void;
  onReload: () => void;
}

export function Titlebar({
  path,
  lineCount,
  dirty,
  externalChanged,
  onReviewSave,
  onOpenBackups,
  onOpenPalette,
  onReload,
}: TitlebarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const display = path ? path.replace(/^\/Users\/[^/]+/, "~") : "~/.zshrc";

  return (
    <header
      data-tauri-drag-region
      className="relative flex h-[38px] shrink-0 select-none items-center gap-3 border-b border-border bg-card/60 pl-[80px] pr-2.5 backdrop-blur-xl"
    >
      <div data-tauri-drag-region className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            externalChanged ? "bg-destructive" : dirty ? "bg-amber-400" : "bg-[var(--brand)]",
          )}
        />
        <span className="truncate font-mono text-[12.5px] text-foreground/90">{display}</span>
        <span className="rounded-[5px] border border-border bg-secondary px-1.5 py-px font-mono text-[10.5px] text-muted-foreground tnum">
          {lineCount} lines
        </span>
        {externalChanged && (
          <button
            type="button"
            onClick={onReload}
            className="flex items-center gap-1 rounded-[5px] border border-destructive/40 bg-destructive/10 px-1.5 py-px text-[11px] text-destructive transition-colors hover:bg-destructive/20"
          >
            <ShieldAlert className="h-3 w-3" /> changed on disk · reload
          </button>
        )}
      </div>

      <div data-tauri-drag-region className="flex-1" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={onReload}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reload from disk</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-muted-foreground"
          onClick={onOpenPalette}
        >
          <Command className="h-3.5 w-3.5" />
          <Kbd className="border-transparent bg-transparent">⌘K</Kbd>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-muted-foreground"
          onClick={onOpenBackups}
        >
          <Clock className="h-3.5 w-3.5" />
          Backups
        </Button>

        <Button
          size="sm"
          onClick={onReviewSave}
          disabled={!dirty}
          variant={dirty ? "default" : "outline"}
          className={cn(
            "h-7 px-3 font-medium",
            dirty
              ? "bg-[var(--brand)] text-[var(--primary-foreground)] hover:bg-[var(--brand)]/90"
              : "border-[var(--brand)]/40 text-[var(--brand)]",
          )}
        >
          Review &amp; Save…
        </Button>
      </div>
    </header>
  );
}
