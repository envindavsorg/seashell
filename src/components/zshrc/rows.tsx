import { useState, type ReactNode } from "react";
import {
  CaretUp as ChevronUp,
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Trash as Trash2,
  X,
  Plus,
  Function as SquareFunction,
  Lightning as Zap,
  PuzzlePiece as Puzzle,
  BracketsCurly as Braces,
  TreeStructure as FolderTree,
  FileArrowDown as FileInput,
  ShieldCheck,
  Info,
} from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "./Kbd";
import type { Block, Category } from "@/lib/zshrc/parser";
import { cn } from "@/lib/utils";

export interface RowProps {
  block: Block;
  selected: boolean;
  range?: { start: number; end: number };
  onSelect: () => void;
  onUpdate: (patch: Partial<Block>) => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}

const RAIL: Record<Category, string> = {
  aliases: "var(--chart-1)",
  environment: "var(--chart-2)",
  path: "var(--chart-3)",
  options: "var(--chart-4)",
  keybindings: "var(--chart-5)",
  plugins: "var(--chart-2)",
  functions: "var(--chart-4)",
  other: "var(--muted-foreground)",
};

function Field({
  value,
  onChange,
  placeholder,
  mono = true,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      className={cn(
        "min-w-0 rounded-[5px] border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] outline-none transition-colors",
        "hover:border-border/70 focus:border-[var(--brand)] focus:bg-background",
        mono && "font-mono",
        className
      )}
    />
  );
}

function RowShell({
  block,
  selected,
  range,
  onSelect,
  onToggle,
  onDelete,
  onMove,
  children,
}: RowProps & { children: ReactNode }) {
  return (
    <div
      onClick={onSelect}
      style={{ boxShadow: selected ? "inset 2px 0 0 0 var(--brand)" : `inset 2px 0 0 0 color-mix(in srgb, ${RAIL[block.category]} 35%, transparent)` }}
      className={cn(
        "group relative flex items-center gap-1.5 rounded-[7px] border px-2 py-1 pl-2.5 transition-colors",
        selected ? "border-border bg-accent/70" : "border-transparent hover:bg-accent/50",
        !block.enabled && "opacity-55"
      )}
    >
      {(block.dirty || block.created) && (
        <span className="absolute -left-[7px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--brand)]" />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>

      {range && (
        <span className="hidden shrink-0 select-none font-mono text-[10px] text-muted-foreground/40 tnum group-hover:inline">
          L{range.start === range.end ? range.start : `${range.start}–${range.end}`}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="rounded p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground" title="Move up">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMove(1); }} className="rounded p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground" title="Move down">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded p-1 text-muted-foreground/60 hover:bg-destructive/15 hover:text-destructive" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <Switch
        checked={block.enabled}
        onCheckedChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
        className="ml-0.5 shrink-0 scale-[0.8] data-[state=checked]:bg-[var(--brand)]"
      />
    </div>
  );
}

function LiteralHint({ value }: { value: string }) {
  if (!/[|"'$`]/.test(value)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0 text-muted-foreground/40">
          <Info className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent>Contains shell syntax — kept literal, never escaped.</TooltipContent>
    </Tooltip>
  );
}

function AliasRow(props: RowProps) {
  const { block, onUpdate } = props;
  return (
    <RowShell {...props}>
      <Field value={block.name ?? ""} onChange={(v) => onUpdate({ name: v })} placeholder="name" className="w-24 shrink-0 font-semibold" autoFocus={block.created} />
      <span className="shrink-0 select-none font-mono text-[12.5px] text-muted-foreground/50">=</span>
      <Field value={block.value ?? ""} onChange={(v) => onUpdate({ value: v })} placeholder="command" className="flex-1" />
      <LiteralHint value={block.value ?? ""} />
    </RowShell>
  );
}

function EnvRow(props: RowProps) {
  const { block, onUpdate } = props;
  return (
    <RowShell {...props}>
      {block.kind === "export" ? (
        <span className="shrink-0 select-none rounded-[4px] bg-secondary px-1 py-px font-mono text-[10px] text-muted-foreground">export</span>
      ) : (
        <span className="shrink-0 select-none font-mono text-[10px] text-muted-foreground/40">set</span>
      )}
      <Field value={block.name ?? ""} onChange={(v) => onUpdate({ name: v })} placeholder="KEY" className="w-28 shrink-0 font-semibold" autoFocus={block.created} />
      <span className="shrink-0 select-none font-mono text-[12.5px] text-muted-foreground/50">=</span>
      <Field value={block.value ?? ""} onChange={(v) => onUpdate({ value: v })} placeholder="value" className="flex-1" />
      <LiteralHint value={block.value ?? ""} />
    </RowShell>
  );
}

function OptionRow(props: RowProps) {
  const { block, onUpdate } = props;
  const options = block.options ?? [];
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (v) onUpdate({ options: [...options, v] });
    setDraft("");
  };
  return (
    <RowShell {...props}>
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {options.map((opt, i) => (
          <span key={i} className="flex items-center gap-1 rounded-[5px] border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11.5px]">
            {opt}
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate({ options: options.filter((_, j) => j !== i) }); }}
              className="text-muted-foreground/50 hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft("");
              e.currentTarget.blur();
            }
          }}
          placeholder="+ flag (⏎)"
          spellCheck={false}
          className="w-20 min-w-0 flex-1 rounded-[5px] border border-transparent bg-transparent px-1 py-0.5 font-mono text-[11.5px] outline-none focus:border-[var(--brand)] focus:bg-background"
        />
      </div>
    </RowShell>
  );
}

function KeybindingRow(props: RowProps) {
  const { block, onUpdate } = props;
  const text = block.text ?? "";
  const m = text.match(/^bindkey\s+(-\w+\s+)?(\S+)\s+(.+)$/);
  if (!m) {
    // e.g. "bindkey -e" — single field
    return (
      <RowShell {...props}>
        <span className="shrink-0 select-none font-mono text-[10px] text-muted-foreground/40">bindkey</span>
        <Field value={text.replace(/^bindkey\s*/, "")} onChange={(v) => onUpdate({ text: `bindkey ${v}` })} placeholder="-e" className="flex-1" autoFocus={block.created} />
      </RowShell>
    );
  }
  const flag = m[1] ?? "";
  const chord = m[2];
  const widget = m[3];
  const rebuild = (c: string, w: string) => onUpdate({ text: `bindkey ${flag}${c} ${w}` });
  return (
    <RowShell {...props}>
      <span className="shrink-0 select-none font-mono text-[10px] text-muted-foreground/40">bindkey</span>
      <span className="rounded-[5px] border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11.5px]">
        <input
          value={chord}
          onChange={(e) => rebuild(e.target.value, widget)}
          spellCheck={false}
          className="w-12 bg-transparent text-center outline-none"
        />
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
      <Field value={widget} onChange={(v) => rebuild(chord, v)} placeholder="widget" className="flex-1" />
    </RowShell>
  );
}

const CODE_ICON: Partial<Record<string, typeof Braces>> = {
  function: SquareFunction,
  eval: Zap,
  source: Puzzle,
};

function codeMeta(block: Block): { Icon: typeof Braces; label: string } {
  if (block.kind === "function") return { Icon: SquareFunction, label: block.name ?? "function" };
  if (block.kind === "eval") {
    const m = (block.text ?? "").match(/eval\s+"?\$\(([^) ]+)/);
    return { Icon: Zap, label: m ? `${m[1]} init` : "eval init" };
  }
  if (block.kind === "source") {
    const isLocal = /\.zshrc\.local|\$HOME|~\//.test(block.text ?? "");
    const m = (block.text ?? "").match(/([\w.-]+\.zsh|[\w.-]+\.local)/);
    return { Icon: isLocal ? FileInput : Puzzle, label: m ? m[1] : "source" };
  }
  if (block.category === "path") return { Icon: FolderTree, label: pathLabel(block) };
  if (/case\b/.test(block.text ?? "")) return { Icon: ShieldCheck, label: "guarded block" };
  return { Icon: CODE_ICON[block.kind] ?? Braces, label: block.note ?? "raw" };
}

function pathLabel(block: Block): string {
  const t = (block.text ?? "").trim();
  if (/typeset/.test(t)) return "typeset -U path";
  if (/fpath/.test(t)) return "fpath";
  return t.slice(0, 40);
}

function CodeBlockRow(props: RowProps) {
  const { block, onUpdate, selected } = props;
  const [open, setOpen] = useState(false);
  const { Icon, label } = codeMeta(block);
  const lineCount = (block.dirty || block.created ? (block.text ?? "").split("\n").length : block.raw.length);

  return (
    <div
      onClick={props.onSelect}
      style={{ boxShadow: selected ? "inset 2px 0 0 0 var(--brand)" : `inset 2px 0 0 0 color-mix(in srgb, ${RAIL[block.category]} 35%, transparent)` }}
      className={cn(
        "group relative rounded-[7px] border transition-colors",
        selected ? "border-border bg-accent/70" : "border-transparent hover:bg-accent/50",
        !block.enabled && "opacity-55"
      )}
    >
      {(block.dirty || block.created) && (
        <span className="absolute -left-[7px] top-3 h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
      )}
      <div className="flex items-center gap-1.5 px-2 py-1 pl-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </button>
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{label}</span>
        {lineCount > 1 && (
          <span className="shrink-0 select-none font-mono text-[10px] text-muted-foreground/40 tnum">
            {lineCount} lines
          </span>
        )}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); props.onMove(-1); }} className="rounded p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground" title="Move up">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); props.onMove(1); }} className="rounded p-1 text-muted-foreground/60 hover:bg-secondary hover:text-foreground" title="Move down">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); props.onDelete(); }} className="rounded p-1 text-muted-foreground/60 hover:bg-destructive/15 hover:text-destructive" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <Switch
          checked={block.enabled}
          onCheckedChange={() => props.onToggle()}
          onClick={(e) => e.stopPropagation()}
          className="ml-0.5 shrink-0 scale-[0.8] data-[state=checked]:bg-[var(--brand)]"
        />
      </div>
      {open && (
        <div className="px-2.5 pb-2" onClick={(e) => e.stopPropagation()}>
          <div className="mb-1 flex items-center gap-1 text-[10.5px] text-muted-foreground/70">
            <Info className="h-3 w-3" /> Advanced — edited as raw shell.
          </div>
          <textarea
            value={block.dirty || block.created ? block.text ?? "" : block.raw.join("\n")}
            onChange={(e) => onUpdate({ text: e.target.value })}
            spellCheck={false}
            rows={Math.min(20, Math.max(2, lineCount))}
            className="scroll-thin w-full resize-y rounded-[6px] border border-border bg-background p-2 font-mono text-[12px] leading-[1.6] outline-none focus:border-[var(--brand)]"
          />
        </div>
      )}
    </div>
  );
}

export function BlockRow(props: RowProps) {
  switch (props.block.kind) {
    case "alias":
      return <AliasRow {...props} />;
    case "export":
    case "assignment":
      return <EnvRow {...props} />;
    case "option":
      return <OptionRow {...props} />;
    case "keybinding":
      return <KeybindingRow {...props} />;
    default:
      return <CodeBlockRow {...props} />;
  }
}

export function PathLockChip() {
  return (
    <span className="flex items-center gap-1 rounded-[5px] border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground">
      <Plus className="hidden" />
      <Kbd className="border-transparent bg-transparent px-0">🔒</Kbd>
      $path[@] · inherited
    </span>
  );
}
