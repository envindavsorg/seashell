import { type Block, type Category, regenerate, type ZshrcDoc } from "./parser";

export interface CategoryMeta {
  key: Category;
  label: string;
  /** Whether the "+" add affordance is shown for this group. */
  addable: boolean;
  blurb: string;
}

export const CATEGORY_ORDER: CategoryMeta[] = [
  {
    key: "aliases",
    label: "Aliases",
    addable: true,
    blurb: "Shortcuts — name = command. Values kept literal.",
  },
  {
    key: "environment",
    label: "Environment",
    addable: true,
    blurb: "Exports and shell variables.",
  },
  { key: "path", label: "PATH", addable: false, blurb: "Search path entries. $path[@] is locked." },
  { key: "options", label: "Options", addable: true, blurb: "setopt flags." },
  { key: "keybindings", label: "Keybindings", addable: true, blurb: "bindkey chords." },
  {
    key: "plugins",
    label: "Plugins & Tools",
    addable: false,
    blurb: "source includes and eval inits.",
  },
  {
    key: "functions",
    label: "Functions",
    addable: false,
    blurb: "Shell functions — edited as raw code.",
  },
  { key: "other", label: "Other", addable: false, blurb: "Everything else, preserved verbatim." },
];

export type LineRanges = Record<string, { start: number; end: number }>;

/** Map each block id -> its 1-based inclusive line span in the current serialized output. */
export function lineRanges(doc: ZshrcDoc): LineRanges {
  const map: LineRanges = {};
  let line = 1;
  for (const b of doc.blocks) {
    const lines = b.dirty || b.created ? regenerate(b) : b.raw;
    const count = Math.max(1, lines.length);
    map[b.id] = { start: line, end: line + count - 1 };
    line += count;
  }
  return map;
}

export function blockAtLine(doc: ZshrcDoc, ranges: LineRanges, lineNo: number): Block | null {
  for (const b of doc.blocks) {
    const r = ranges[b.id];
    if (r && lineNo >= r.start && lineNo <= r.end) return b;
  }
  return null;
}
