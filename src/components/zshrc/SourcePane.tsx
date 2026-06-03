import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SYNTAX_COLOR, type Token, tokenizeLine } from "@/lib/zshrc/highlight";
import { Kbd } from "./Kbd";

interface SourcePaneProps {
  liveContent: string;
  diskContent: string;
  mode: "live" | "disk";
  onModeChange: (m: "live" | "disk") => void;
  selectedRange: { start: number; end: number } | null;
  onSelectLine: (n: number) => void;
  flash: { start: number; end: number; nonce: number } | null;
}

// A single source line. Memoized so that, on a keystroke that changes one line, React
// re-renders only that row — the other rows receive referentially-equal props (tokens come
// from a cache, the select handler is stable) and are skipped.
const Line = memo(function Line({
  lineNo,
  tokens,
  gutterWidth,
  inSelected,
  flashing,
  onSelect,
  anchorRef,
}: {
  lineNo: number;
  tokens: Token[];
  gutterWidth: string;
  inSelected: boolean;
  flashing: boolean;
  onSelect: (n: number) => void;
  anchorRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={anchorRef}
      onClick={() => onSelect(lineNo)}
      className={cn(
        "group flex cursor-text items-baseline transition-colors",
        inSelected && "bg-[var(--brand-soft)]",
        !inSelected && "hover:bg-accent/40",
        flashing && "animate-line-settle",
      )}
    >
      <span
        style={{ width: gutterWidth }}
        className={cn(
          "sticky left-0 box-content shrink-0 select-none pl-3 pr-4 text-right font-mono tnum",
          inSelected ? "text-[var(--brand)]" : "text-muted-foreground/35",
        )}
      >
        {lineNo}
      </span>
      <code className="whitespace-pre pr-6">
        {tokens.map((t, ti) => (
          <span key={ti} style={{ color: SYNTAX_COLOR[t.type] }}>
            {t.text}
          </span>
        ))}
        {tokens.length === 1 && tokens[0].text === "" ? " " : ""}
      </code>
    </div>
  );
});

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

  // Cache tokens by exact line string so unchanged lines are never re-tokenized on a keystroke.
  const cacheRef = useRef(new Map<string, Token[]>());
  const tokenized = useMemo(() => {
    const cache = cacheRef.current;
    if (cache.size > 5000) cache.clear(); // bound memory; values are cheap to recompute
    return lines.map((l) => {
      let t = cache.get(l);
      if (!t) {
        t = tokenizeLine(l);
        cache.set(l, t);
      }
      return t;
    });
  }, [lines]);

  const gutterWidth = `${String(lines.length).length + 1}ch`;

  // Stable select handler so memoized rows don't re-render when App's onSelectLine identity changes.
  const onSelectRef = useRef(onSelectLine);
  onSelectRef.current = onSelectLine;
  const handleSelect = useCallback((n: number) => onSelectRef.current(n), []);

  const selectedRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional scroll triggers; the body only touches the ref
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
            <ToggleGroupItem
              value="live"
              className="h-6 px-2 text-[11px] data-[state=on]:bg-[var(--brand)]/15 data-[state=on]:text-[var(--brand)]"
            >
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
            const flashing = inFlash && mode === "live";
            const isAnchor = inSelected && lineNo === selectedRange?.start;
            return (
              <Line
                // nonce in the key on flashing lines forces a remount so the settle animation replays
                key={flashing ? `l-${i}-${flash?.nonce}` : `l-${i}`}
                lineNo={lineNo}
                tokens={tokenized[i]}
                gutterWidth={gutterWidth}
                inSelected={inSelected}
                flashing={flashing}
                onSelect={handleSelect}
                anchorRef={isAnchor ? selectedRef : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
