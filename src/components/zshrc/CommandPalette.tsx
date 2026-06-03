import {
  Clock,
  Code,
  Copy,
  ArrowElbowDownLeft as CornerDownLeft,
  FolderOpen,
  Keyboard,
  ArrowsClockwise as RefreshCw,
  FloppyDisk as Save,
  CircleHalf as SunMoon,
  Terminal,
  ToggleRight,
  ArrowUUpLeft as Undo2,
  CurrencyDollar as Variable,
} from "@phosphor-icons/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Block, ZshrcDoc } from "@/lib/zshrc/parser";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: ZshrcDoc;
  dirty: boolean;
  onJump: (id: string) => void;
  onAdd: (category: "aliases" | "environment" | "options" | "keybindings") => void;
  onReviewSave: () => void;
  onOpenBackups: () => void;
  onReload: () => void;
  onDiscard: () => void;
  onToggleTheme: () => void;
  onOpenInZed: () => void;
  onRevealFinder: () => void;
  onCopyFile: () => void;
}

function labelFor(b: Block): string {
  switch (b.kind) {
    case "alias":
      return `alias ${b.name}`;
    case "export":
      return `export ${b.name}`;
    case "assignment":
      return `${b.name}`;
    case "option":
      return `setopt ${(b.options ?? []).join(" ")}`;
    case "keybinding":
      return b.text ?? "bindkey";
    case "function":
      return `${b.name ?? "function"}()`;
    case "path-array":
      return "path=( … )";
    default:
      return b.note ?? ((b.text ?? "").split("\n")[0].slice(0, 48) || b.kind);
  }
}

export function CommandPalette(props: CommandPaletteProps) {
  const run = (fn: () => void) => {
    props.onOpenChange(false);
    fn();
  };

  const jumpable = props.doc.blocks.filter(
    (b) => b.kind !== "blank" && b.kind !== "comment" && b.kind !== "section",
  );

  return (
    <CommandDialog open={props.open} onOpenChange={props.onOpenChange}>
      <CommandInput placeholder="Type a command or search blocks…" />
      <CommandList className="scroll-thin">
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem value="add alias" onSelect={() => run(() => props.onAdd("aliases"))}>
            <Terminal className="h-4 w-4" /> Add alias
          </CommandItem>
          <CommandItem
            value="add export environment variable"
            onSelect={() => run(() => props.onAdd("environment"))}
          >
            <Variable className="h-4 w-4" /> Add export
          </CommandItem>
          <CommandItem value="add setopt option" onSelect={() => run(() => props.onAdd("options"))}>
            <ToggleRight className="h-4 w-4" /> Add option
          </CommandItem>
          <CommandItem
            value="add keybinding bindkey"
            onSelect={() => run(() => props.onAdd("keybindings"))}
          >
            <Keyboard className="h-4 w-4" /> Add keybinding
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="File">
          {props.dirty && (
            <CommandItem value="review save write" onSelect={() => run(props.onReviewSave)}>
              <Save className="h-4 w-4" /> Review &amp; Save…
            </CommandItem>
          )}
          {props.dirty && (
            <CommandItem value="discard changes revert" onSelect={() => run(props.onDiscard)}>
              <Undo2 className="h-4 w-4" /> Discard changes
            </CommandItem>
          )}
          <CommandItem value="open backups restore" onSelect={() => run(props.onOpenBackups)}>
            <Clock className="h-4 w-4" /> Open backups…
          </CommandItem>
          <CommandItem value="reload from disk" onSelect={() => run(props.onReload)}>
            <RefreshCw className="h-4 w-4" /> Reload from disk
          </CommandItem>
          <CommandItem value="copy file contents clipboard" onSelect={() => run(props.onCopyFile)}>
            <Copy className="h-4 w-4" /> Copy file to clipboard
          </CommandItem>
          <CommandItem value="open in zed editor" onSelect={() => run(props.onOpenInZed)}>
            <Code className="h-4 w-4" /> Open in Zed
          </CommandItem>
          <CommandItem value="reveal finder zshrc" onSelect={() => run(props.onRevealFinder)}>
            <FolderOpen className="h-4 w-4" /> Reveal in Finder
          </CommandItem>
          <CommandItem value="toggle theme dark light" onSelect={() => run(props.onToggleTheme)}>
            <SunMoon className="h-4 w-4" /> Toggle theme
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Jump to block">
          {jumpable.map((b) => (
            <CommandItem
              key={b.id}
              value={`${labelFor(b)} ${b.kind} ${b.note ?? ""}`}
              onSelect={() => run(() => props.onJump(b.id))}
            >
              <CornerDownLeft className="h-4 w-4 opacity-40" />
              <span className="truncate font-mono text-[12.5px]">{labelFor(b)}</span>
              {!b.enabled && (
                <span className="ml-auto text-[10px] text-muted-foreground/50">disabled</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
