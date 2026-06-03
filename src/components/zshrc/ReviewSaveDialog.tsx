import {
  CheckCircle,
  CircleNotch,
  Copy,
  ClockCounterClockwise as FolderClock,
  FloppyDisk as Save,
  Warning,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ZshValidation } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { diffLines } from "@/lib/zshrc/diff";
import { DiffView } from "./DiffView";

interface ReviewSaveDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  oldText: string;
  newText: string;
  path: string;
  editedCount: number;
  saving: boolean;
  validation: ZshValidation | null;
  validating: boolean;
  onConfirm: () => void;
  onCopyDiff: () => void;
}

export function ReviewSaveDialog({
  open,
  onOpenChange,
  oldText,
  newText,
  path,
  editedCount,
  saving,
  validation,
  validating,
  onConfirm,
  onCopyDiff,
}: ReviewSaveDialogProps) {
  const stats = useMemo(() => diffLines(oldText, newText), [oldText, newText]);
  const display = path ? path.replace(/^\/Users\/[^/]+/, "~") : "~/.zshrc";
  const invalid = validation != null && !validation.ok;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] gap-3 p-0">
        <DialogHeader className="border-b border-border px-5 py-3.5">
          <DialogTitle className="text-[15px]">Review &amp; Save</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Nothing is written until you confirm. A timestamped backup is created first.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground tnum">{editedCount}</span>{" "}
              {editedCount === 1 ? "block" : "blocks"} changed
            </span>
            <span className="text-[var(--brand)] tnum">+{stats.added}</span>
            <span className="text-destructive tnum">−{stats.removed}</span>
            <span className="text-border">·</span>
            <span className="font-mono text-muted-foreground">{display}</span>
          </div>

          {/* zsh -n syntax check */}
          <div
            className={cn(
              "mb-2 flex items-start gap-2 rounded-[7px] border px-2.5 py-1.5 text-[12px]",
              validating && "border-border bg-secondary/50 text-muted-foreground",
              !validating &&
                validation?.ok &&
                "border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand)]",
              !validating && invalid && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {validating ? (
              <>
                <CircleNotch className="mt-px h-3.5 w-3.5 shrink-0 animate-spin" />
                Checking syntax with <span className="font-mono">zsh -n</span>…
              </>
            ) : validation?.ok ? (
              <>
                <CheckCircle weight="fill" className="mt-px h-3.5 w-3.5 shrink-0" />
                Valid zsh syntax (<span className="font-mono">zsh -n</span>).
              </>
            ) : invalid ? (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium">
                  <Warning weight="fill" className="h-3.5 w-3.5 shrink-0" />
                  Syntax error — saving this would break your shell.
                </div>
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] opacity-90">
                  {validation?.message}
                </pre>
              </div>
            ) : null}
          </div>

          <div className="max-h-[42vh]">
            <DiffView oldText={oldText} newText={newText} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <FolderClock className="h-3.5 w-3.5" />A backup will be saved to{" "}
            <span className="font-mono">~/.zshrc.backups/</span> before writing.
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-3 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={onCopyDiff}
            disabled={stats.unchanged}
          >
            <Copy className="h-3.5 w-3.5" /> Copy diff
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={saving || stats.unchanged}
              className={cn(
                "gap-1.5",
                invalid
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-[var(--brand)] text-[var(--primary-foreground)] hover:bg-[var(--brand)]/90",
              )}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : invalid ? "Save anyway" : "Save to ~/.zshrc"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
