import { useState, type RefObject } from "react";
import {
  MagnifyingGlass as Search,
  Plus,
  CaretDown as ChevronDown,
  Terminal,
  CurrencyDollar as Variable,
  TreeStructure as FolderTree,
  ToggleRight,
  Keyboard,
  PuzzlePiece as Puzzle,
  Function as SquareFunction,
  BracketsCurly as Braces,
  ShieldWarning as ShieldAlert,
} from "@phosphor-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BlockRow } from "./rows";
import { PathArrayCard } from "./PathArrayCard";
import {
  visibleBlocks,
  categoryCounts,
  type Block,
  type Category,
  type ZshrcDoc,
} from "@/lib/zshrc/parser";
import { CATEGORY_ORDER, type LineRanges } from "@/lib/zshrc/view";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<Category, typeof Terminal> = {
  aliases: Terminal,
  environment: Variable,
  path: FolderTree,
  options: ToggleRight,
  keybindings: Keyboard,
  plugins: Puzzle,
  functions: SquareFunction,
  other: Braces,
};

interface StructuredPaneProps {
  doc: ZshrcDoc;
  ranges: LineRanges;
  selectedId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  scope: Category | "all";
  onScopeChange: (s: Category | "all") => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAdd: (category: Category) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

function matchesQuery(b: Block, q: string): boolean {
  if (!q) return true;
  const hay = [
    b.name,
    b.value,
    b.text,
    b.note,
    (b.options ?? []).join(" "),
    (b.entries ?? []).join(" "),
    b.kind,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function StructuredPane(props: StructuredPaneProps) {
  const { doc, ranges, selectedId, query, scope } = props;
  const counts = categoryCounts(doc);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const scopes: (Category | "all")[] = ["all", ...CATEGORY_ORDER.map((c) => c.key)];

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* toolbar */}
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            ref={props.searchRef}
            value={query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            placeholder="Filter blocks…"
            spellCheck={false}
            className="h-8 w-full rounded-[7px] border border-border bg-background pl-8 pr-3 text-[12.5px] outline-none focus:border-[var(--brand)]"
          />
        </div>
        <div className="scroll-thin mt-2 flex gap-1 overflow-x-auto pb-0.5">
          {scopes.map((s) => {
            const meta = s === "all" ? null : CATEGORY_ORDER.find((c) => c.key === s)!;
            const count = s === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s as Category];
            const active = scope === s;
            return (
              <button
                key={s}
                onClick={() => props.onScopeChange(s)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[11.5px] transition-colors",
                  active
                    ? "border-[var(--brand)]/40 bg-[var(--brand)]/12 text-[var(--brand)]"
                    : "border-transparent text-muted-foreground hover:bg-accent/60"
                )}
              >
                {meta ? meta.label : "All"}
                <span className="font-mono text-[10px] opacity-60 tnum">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* fellback banner */}
      {doc.fellBack && (
        <div className="flex items-start gap-2 border-b border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11.5px] text-amber-600 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This file uses constructs we parse conservatively. It's preserved exactly — edit it in the source pane or as raw below.
          </span>
        </div>
      )}

      {/* groups */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {CATEGORY_ORDER.map((cat) => {
          if (scope !== "all" && scope !== cat.key) return null;
          const blocks = visibleBlocks(doc, cat.key).filter((b) => matchesQuery(b, query));
          if (blocks.length === 0 && scope === "all" && !cat.addable) return null;
          if (blocks.length === 0 && query) return null;

          const Icon = CATEGORY_ICON[cat.key];
          const open = !collapsed[cat.key];

          return (
            <Collapsible
              key={cat.key}
              open={open}
              onOpenChange={(o) => setCollapsed((c) => ({ ...c, [cat.key]: !o }))}
              className="mb-3"
            >
              <div className="flex items-center gap-1.5 px-1 py-1">
                <CollapsibleTrigger className="flex flex-1 items-center gap-1.5 text-left">
                  <ChevronDown className={cn("h-3 w-3 text-muted-foreground/50 transition-transform", !open && "-rotate-90")} />
                  <Icon weight="duotone" className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/40 tnum">{blocks.length}</span>
                </CollapsibleTrigger>
                {cat.addable && (
                  <button
                    onClick={() => props.onAdd(cat.key)}
                    className="rounded-[5px] p-1 text-muted-foreground/60 transition-colors hover:bg-[var(--brand)]/15 hover:text-[var(--brand)]"
                    title={`Add ${cat.label.toLowerCase()}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <CollapsibleContent className="flex flex-col gap-0.5 pl-1">
                {blocks.length === 0 ? (
                  <button
                    onClick={() => cat.addable && props.onAdd(cat.key)}
                    className="rounded-[6px] border border-dashed border-border px-2.5 py-2 text-left text-[12px] text-muted-foreground/70 hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
                  >
                    {cat.addable ? `No ${cat.label.toLowerCase()} yet — add one.` : `No ${cat.label.toLowerCase()}.`}
                  </button>
                ) : (
                  blocks.map((b) =>
                    b.kind === "path-array" ? (
                      <PathArrayCard
                        key={b.id}
                        block={b}
                        selected={selectedId === b.id}
                        onSelect={() => props.onSelect(b.id)}
                        onUpdate={(patch) => props.onUpdate(b.id, patch)}
                        onToggle={() => props.onToggle(b.id)}
                      />
                    ) : (
                      <BlockRow
                        key={b.id}
                        block={b}
                        range={ranges[b.id]}
                        selected={selectedId === b.id}
                        onSelect={() => props.onSelect(b.id)}
                        onUpdate={(patch) => props.onUpdate(b.id, patch)}
                        onToggle={() => props.onToggle(b.id)}
                        onDelete={() => props.onDelete(b.id)}
                        onMove={(dir) => props.onMove(b.id, dir)}
                      />
                    )
                  )
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
