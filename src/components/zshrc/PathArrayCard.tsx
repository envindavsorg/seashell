import {
  CaretDown as ChevronDown,
  CaretUp as ChevronUp,
  Lock,
  Plus,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/zshrc/parser";

interface PathArrayCardProps {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Block>) => void;
  onToggle: () => void;
}

// matches $path, $path[@], ${path}, ${path[@]}, and the quoted forms — but not $PATH
const SENTINEL_RE = /^"?\$\{?path(\[@\])?\}?"?$/;

export function PathArrayCard({
  block,
  selected,
  onSelect,
  onUpdate,
  onToggle,
}: PathArrayCardProps) {
  const entries = block.entries ?? [];
  const sentinelIdx = entries.findIndex((e) => SENTINEL_RE.test(e.trim()));
  const editableEnd = sentinelIdx === -1 ? entries.length : sentinelIdx;
  const [draft, setDraft] = useState("");

  const setEntries = (next: string[]) => onUpdate({ entries: next });
  const updateAt = (i: number, v: string) => setEntries(entries.map((e, j) => (j === i ? v : e)));
  const removeAt = (i: number) => setEntries(entries.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= editableEnd) return;
    const next = [...entries];
    [next[i], next[j]] = [next[j], next[i]];
    setEntries(next);
  };
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    const insertAt = sentinelIdx === -1 ? entries.length : sentinelIdx;
    const next = [...entries];
    next.splice(insertAt, 0, v);
    setEntries(next);
    setDraft("");
  };

  return (
    <div
      onClick={onSelect}
      style={{
        boxShadow: selected
          ? "inset 2px 0 0 0 var(--brand)"
          : "inset 2px 0 0 0 color-mix(in srgb, var(--chart-3) 35%, transparent)",
      }}
      className={cn(
        "rounded-[8px] border transition-colors",
        selected ? "border-border bg-accent/60" : "border-border/60 hover:bg-accent/30",
        !block.enabled && "opacity-55",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
        <span className="font-mono text-[12px] text-muted-foreground">path=( … )</span>
        <span className="rounded-[4px] bg-secondary px-1.5 py-px font-mono text-[10px] text-muted-foreground tnum">
          {editableEnd} {editableEnd === 1 ? "entry" : "entries"}
        </span>
        <div className="flex-1" />
        <Switch
          checked={block.enabled}
          onCheckedChange={() => onToggle()}
          onClick={(e) => e.stopPropagation()}
          className="scale-[0.8] data-[state=checked]:bg-[var(--brand)]"
        />
      </div>

      <div className="flex flex-col gap-0.5 p-1.5">
        {entries.map((entry, i) => {
          const isSentinel = i >= editableEnd;
          if (isSentinel) {
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-[6px] bg-secondary/40 px-2 py-1"
              >
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span className="flex-1 font-mono text-[12px] text-muted-foreground">{entry}</span>
                <span className="select-none text-[10px] text-muted-foreground/50">
                  inherited · locked
                </span>
              </div>
            );
          }
          return (
            <div
              key={i}
              className="group flex items-center gap-1 rounded-[6px] px-1 py-0.5 hover:bg-accent/50"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                value={entry}
                onChange={(e) => updateAt(i, e.target.value)}
                spellCheck={false}
                className="min-w-0 flex-1 rounded-[5px] border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[12px] outline-none hover:border-border/60 focus:border-[var(--brand)] focus:bg-background"
              />
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
                  title="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
                  title="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="rounded p-0.5 text-muted-foreground/60 hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-1 px-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-[var(--brand)]"
            title="Add entry"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft("");
                e.currentTarget.blur();
              }
            }}
            placeholder="add path entry — ⏎ to insert above $path[@]"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-[5px] border border-transparent bg-transparent px-1 py-0.5 font-mono text-[12px] outline-none focus:border-[var(--brand)] focus:bg-background"
          />
        </div>
      </div>
    </div>
  );
}
