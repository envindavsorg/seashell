import { FolderOpen, ArrowCounterClockwise as RotateCcw, GitDiff as GitCompare, Trash as Trash2, Clock } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { BackupInfo } from "@/lib/tauri";
import { formatBytes, relativeTime, absoluteTime } from "@/lib/format";

interface BackupsSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  backups: BackupInfo[];
  onRestore: (b: BackupInfo) => void;
  onViewDiff: (b: BackupInfo) => void;
  onDelete: (b: BackupInfo) => void;
  onReveal: () => void;
}

export function BackupsSheet({
  open,
  onOpenChange,
  backups,
  onRestore,
  onViewDiff,
  onDelete,
  onReveal,
}: BackupsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[420px] flex-col gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b border-border px-5 py-3.5">
          <SheetTitle className="flex items-center gap-2 text-[15px]">
            <Clock className="h-4 w-4" /> Backups
          </SheetTitle>
          <SheetDescription className="text-[12.5px]">
            Every save snapshots your file first. Restore is itself reversible.
          </SheetDescription>
        </SheetHeader>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          {backups.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-[12.5px] text-muted-foreground">
              <Clock className="h-6 w-6 opacity-40" />
              No backups yet. One is created the first time you save.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {backups.map((b) => (
                <div
                  key={b.name}
                  className="group rounded-[8px] border border-border bg-card px-3 py-2.5 transition-colors hover:border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{relativeTime(b.epoch_secs)}</div>
                      <div className="font-mono text-[11px] text-muted-foreground tnum">
                        {absoluteTime(b.epoch_secs)} · {formatBytes(b.size)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 flex-1 gap-1.5 text-[11.5px]" onClick={() => onViewDiff(b)}>
                      <GitCompare className="h-3.5 w-3.5" /> Diff
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 flex-1 gap-1.5 text-[11.5px]" onClick={() => onRestore(b)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/60 hover:text-destructive"
                      onClick={() => onDelete(b)}
                      title="Delete backup"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border px-5 py-3">
          <Button variant="outline" className="w-full gap-1.5" onClick={onReveal}>
            <FolderOpen className="h-4 w-4" /> Reveal in Finder
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
