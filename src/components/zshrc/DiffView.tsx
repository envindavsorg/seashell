import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { diffLines } from "@/lib/zshrc/diff";

export function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const result = useMemo(() => diffLines(oldText, newText), [oldText, newText]);

  if (result.unchanged) {
    return (
      <div className="flex h-32 items-center justify-center text-[13px] text-muted-foreground">
        No changes.
      </div>
    );
  }

  return (
    <div className="scroll-thin overflow-auto rounded-[8px] border border-border bg-background font-mono text-[12px] leading-[1.6]">
      {result.hunks.map((hunk, hi) => (
        <div key={hi} className={hi > 0 ? "border-t border-border" : undefined}>
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-secondary/80 px-3 py-1 text-[10.5px] uppercase tracking-wider text-muted-foreground backdrop-blur">
            {hunk.label}
          </div>
          {hunk.rows.map((r, ri) => (
            <div
              key={ri}
              className={cn(
                "flex items-baseline",
                r.kind === "add" && "bg-[var(--brand-soft)]",
                r.kind === "del" && "bg-destructive/12",
              )}
            >
              <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/35 tnum">
                {r.oldNo ?? ""}
              </span>
              <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/35 tnum">
                {r.newNo ?? ""}
              </span>
              <span
                className={cn(
                  "w-4 shrink-0 select-none text-center",
                  r.kind === "add" && "text-[var(--brand)]",
                  r.kind === "del" && "text-destructive",
                )}
              >
                {r.kind === "add" ? "+" : r.kind === "del" ? "−" : ""}
              </span>
              <code className="whitespace-pre pr-4">{r.text === "" ? " " : r.text}</code>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
