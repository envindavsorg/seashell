import { useEffect, useMemo, useRef } from "react";
import { tokenizeLine, SYNTAX_COLOR } from "@/lib/zshrc/highlight";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Kbd } from "./Kbd";
import { cn } from "@/lib/utils";

interface SourcePaneProps {
  liveContent: string;
  diskContent: string;
  mode: "live" | "disk";
  onModeChange: (m: "live" | "disk") => void;
  selectedRange: { start: number; end: number } | null;
  onSelectLine: (n: number) => void;
  flash: { start: number; end: number; nonce: number } | null;
}

export function SourcePane({
  liveContent,
  diskContent,
  mode,
  onModeChange,
  selectedRange,
  onSelectLine,
  flash,
}: SourcePaneProps) {
  const content = mode === "live" ? liveContent : diskContent;
  const lines = useMemo(() => {
    const ls = content.split("\n");
    if (ls.length > 0 && ls[ls.length - 1] === "") ls.pop();
    return ls;
  }, [content]);

  const tokenized = useMemo(() => lines.map((l) => tokenizeLine(l)), [lines]);
  const gutterWidth = `${String(lines.length).length + 1}ch`;

  const selectedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedRange?.start, mode]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
          source
        </span>
        <div className="flex items-center gap-2">
          <Kbd className="border-transparent bg-transparent text-muted-foreground/60">⌘D</Kbd>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && onModeChange(v as "live" | "disk")}
            size="sm"
            variant="outline"
            className="h-6"
          >
            <ToggleGroupItem value="live" className="h-6 px-2 text-[11px] data-[state=on]:bg-[var(--brand)]/15 data-[state=on]:text-[var(--brand)]">
              Live
            </ToggleGroupItem>
            <ToggleGroupItem value="disk" className="h-6 px-2 text-[11px]">
              On disk
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto py-2 font-mono text-[12.5px] leading-[1.65]">
        <div className="min-w-max">
          {lines.map((_, i) => {
            const lineNo = i + 1;
            const inSelected =
              selectedRange != null && lineNo >= selectedRange.start && lineNo <= selectedRange.end;
            const inFlash = flash != null && lineNo >= flash.start && lineNo <= flash.end;
            return (
              <div
                key={inFlash ? `l-${i}-${flash!.nonce}` : `l-${i}`}
                ref={inSelected && lineNo === selectedRange!.start ? selectedRef : undefined}
                onClick={() => onSelectLine(lineNo)}
                className={cn(
                  "group flex cursor-text items-baseline transition-colors",
                  inSelected && "bg-[var(--brand-soft)]",
                  !inSelected && "hover:bg-accent/40",
                  inFlash && mode === "live" && "animate-line-settle"
                )}
              >
                <span
                  style={{ width: gutterWidth }}
                  className={cn(
                    "sticky left-0 box-content shrink-0 select-none pl-3 pr-4 text-right font-mono tnum",
                    inSelected ? "text-[var(--brand)]" : "text-muted-foreground/35"
                  )}
                >
                  {lineNo}
                </span>
                <code className="whitespace-pre pr-6">
                  {tokenized[i].map((t, ti) => (
                    <span key={ti} style={{ color: SYNTAX_COLOR[t.type] }}>
                      {t.text}
                    </span>
                  ))}
                  {tokenized[i].length === 1 && tokenized[i][0].text === "" ? " " : ""}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
