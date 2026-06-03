// Round-trip-safe .zshrc parser.
//
// SAFETY MODEL — the whole point of this file:
//   * Every original physical line is captured into exactly ONE block's `raw`.
//   * serialize() emits a block's `raw` verbatim UNLESS the block was edited
//     (`dirty`). So `serialize(parse(x)) === x` for any untouched document — the
//     parser can never silently rewrite a line it didn't understand.
//   * Only blocks the user actually changes are regenerated from structured fields.
//   * If the line-coverage invariant ever breaks (a parser bug), parse() falls back
//     to a single whole-file `raw` block: structured editing is disabled, but the
//     file is preserved exactly. We never corrupt a real shell config.

export type Category =
  | "aliases"
  | "environment"
  | "path"
  | "functions"
  | "plugins"
  | "options"
  | "keybindings"
  | "other";

export type BlockKind =
  | "alias"
  | "export"
  | "assignment"
  | "option"
  | "keybinding"
  | "eval"
  | "source"
  | "function"
  | "path-array"
  | "comment"
  | "section"
  | "blank"
  | "raw";

export type Quote = '"' | "'" | "";

export interface Block {
  id: string;
  kind: BlockKind;
  category: Category;
  enabled: boolean;
  /** Leading comment attached as this block's human caption (text without the leading '#'). */
  note?: string;
  /** Exact original physical lines (the source of truth for round-trip fidelity). */
  raw: string[];
  /** When true, serialize() regenerates this block from structured fields instead of `raw`. */
  dirty: boolean;
  /** Marks blocks created during this session (never had a `raw` to fall back to). */
  created?: boolean;

  // Structured fields (presence depends on kind):
  name?: string; // alias | export | assignment
  value?: string; // inner value (unquoted)
  quote?: Quote; // quote style for value
  options?: string[]; // option (setopt)
  entries?: string[]; // path-array
  header?: string; // path-array opener, e.g. "path=("
  /** Inner non-entry lines of a path array (comments), preserved verbatim across edits. */
  arrayExtra?: string[];
  /** Exact original bytes of an attached leading comment caption (preserves non-canonical form). */
  noteRaw?: string;
  /** Editable statement text for free-form kinds (function/source/eval/keybinding/raw/comment). */
  text?: string;
}

export interface ZshrcDoc {
  path: string;
  exists: boolean;
  trailingNewline: boolean;
  blocks: Block[];
  /** True when the parser had to fall back to whole-file mode (structured editing unsafe). */
  fellBack: boolean;
  /** The exact bytes we parsed, for diffing and dirty detection. */
  original: string;
}

// ---------------------------------------------------------------------------
// id generation
// ---------------------------------------------------------------------------

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Math.abs(hash(String(idCounter++)))}`;
}
let idCounter = 0;
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ---------------------------------------------------------------------------
// quoting
// ---------------------------------------------------------------------------

export function splitQuote(rawValue: string): { value: string; quote: Quote } {
  const t = rawValue.trim();
  if (
    t.length >= 2 &&
    (t[0] === '"' || t[0] === "'") &&
    t[t.length - 1] === t[0]
  ) {
    return { value: t.slice(1, -1), quote: t[0] as Quote };
  }
  return { value: t, quote: "" };
}

export function requote(value: string, quote: Quote): string {
  return quote === "" ? value : `${quote}${value}${quote}`;
}

// ---------------------------------------------------------------------------
// low-level line helpers
// ---------------------------------------------------------------------------

const RE_BLANK = /^\s*$/;
const RE_COMMENT = /^\s*#/;

function endsWithBackslash(line: string): boolean {
  // odd number of trailing backslashes => line continuation
  const m = line.match(/\\+$/);
  return !!m && m[0].length % 2 === 1;
}

function firstWord(line: string): string {
  return line.trim().split(/[\s(]/)[0] ?? "";
}

/** Net `{` minus `}` on a line, ignoring braces inside quotes or after an unquoted `#`.
 * `state.q` carries quote context across lines so multi-line strings don't miscount. */
function netBraceDelta(line: string, state: { q: '"' | "'" | "" }): number {
  let delta = 0;
  for (let k = 0; k < line.length; k++) {
    const c = line[k];
    if (state.q) {
      if (c === state.q) state.q = "";
      continue;
    }
    if (c === '"' || c === "'") {
      state.q = c;
      continue;
    }
    if (c === "#") {
      // a comment only starts at a word boundary; '#' inside a token
      // (e.g. ${#arr[@]} length, ${var#pat} removal) is NOT a comment
      const prev = k === 0 ? "" : line[k - 1];
      if (prev === "" || /\s/.test(prev)) break;
      continue;
    }
    if (c === "{") delta++;
    else if (c === "}") delta--;
  }
  return delta;
}

const KW_OPENERS: Record<string, string> = {
  if: "fi",
  for: "done",
  while: "done",
  until: "done",
  select: "done",
  case: "esac",
};
const KW_CLOSERS = new Set(["fi", "done", "esac"]);

const RE_FUNC = /^\s*(?:function\s+[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*\s*\(\))\s*\{?\s*$/;
const RE_FUNC_INLINE_BRACE = /\{/;

// ---------------------------------------------------------------------------
// statement classification
// ---------------------------------------------------------------------------

function classifyByContent(text: string): { kind: BlockKind; category: Category } {
  if (/\bsource\b|^\s*\.\s|&&\s*\.\s/.test(text)) return { kind: "source", category: "plugins" };
  if (/\beval\b/.test(text)) return { kind: "eval", category: "plugins" };
  if (/\bfpath\b|typeset[^\n]*\bpath\b|^\s*path=\(|\bPATH=/.test(text))
    return { kind: "raw", category: "path" };
  return { kind: "raw", category: "other" };
}

/** Classify a single enabled logical statement; returns kind/category + structured fields. */
function classifyStatement(text: string): Partial<Block> & { kind: BlockKind; category: Category } {
  const t = text.trim();

  // alias NAME=VALUE — value is ONE OPAQUE STRING (everything after the first '='),
  // kept exactly (quotes, pipes, $()), never re-quoted or escaped.
  let m = t.match(/^alias\s+([^=\s]+)=(.*)$/s);
  if (m) {
    return { kind: "alias", category: "aliases", name: m[1], value: m[2] };
  }

  // export NAME=VALUE
  m = t.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
  if (m) {
    return { kind: "export", category: "environment", name: m[1], value: m[2] };
  }

  // setopt OPT...
  if (/^setopt\s+/.test(t)) {
    const options = t.replace(/^setopt\s+/, "").trim().split(/\s+/).filter(Boolean);
    return { kind: "option", category: "options", options };
  }

  // bindkey ...
  if (/^bindkey\b/.test(t)) return { kind: "keybinding", category: "keybindings", text };

  // eval-based tool init
  if (/\beval\b/.test(t)) return { kind: "eval", category: "plugins", text };

  // source / dot include
  if (/(^|&&\s*)(source\s|\.\s)/.test(t) || /^source\s/.test(t))
    return { kind: "source", category: "plugins", text };

  // PATH-related
  if (/^typeset\b[^\n]*\bpath\b/.test(t) || /\bfpath=/.test(t) || /^path=/.test(t) || /\bPATH=/.test(t))
    return { kind: "raw", category: "path", text };

  // bare assignment NAME=VALUE (opaque value, kept literal)
  m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
  if (m) {
    const category: Category = /^[A-Z]/.test(m[1]) ? "environment" : "other";
    return { kind: "assignment", category, name: m[1], value: m[2] };
  }

  return { kind: "raw", category: "other", text };
}

/** Try to read a disabled (commented-out) single-line statement. Returns null if it's a real comment. */
function classifyDisabled(line: string): (Partial<Block> & { kind: BlockKind; category: Category }) | null {
  const m = line.match(/^(\s*)#+\s?(.*)$/);
  if (!m) return null;
  const inner = m[2].trim();
  if (!inner) return null;

  // Only treat as a disabled statement if it strictly looks like one (avoids
  // misreading explanatory prose as code).
  const looksLikeStatement =
    /^alias\s+[^=\s]+=.+/.test(inner) ||
    /^export\s+[A-Za-z_][A-Za-z0-9_]*=.+/.test(inner) ||
    /^setopt\s+\S/.test(inner) ||
    /^bindkey\b/.test(inner) ||
    /^[A-Za-z_][A-Za-z0-9_]*=\S/.test(inner);

  if (!looksLikeStatement) return null;
  const c = classifyStatement(inner);
  return c;
}

// ---------------------------------------------------------------------------
// section-header detection (for comments that label a group rather than an item)
// ---------------------------------------------------------------------------

const SECTION_KEYWORDS = new Set([
  "options",
  "option",
  "history",
  "path",
  "exports",
  "export",
  "environment",
  "env",
  "plugins",
  "plugin",
  "aliases",
  "alias",
  "keybindings",
  "keybinding",
  "functions",
  "function",
]);

function isSectionHeader(commentText: string): boolean {
  const t = commentText.trim().toLowerCase().replace(/[()]/g, " ");
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  // "# path (typeset -U removes duplicates)" -> first word "path" is a section keyword.
  return SECTION_KEYWORDS.has(words[0]);
}

function commentText(rawLine: string): string {
  const m = rawLine.match(/^\s*#+\s?(.*)$/);
  return m ? m[1] : rawLine;
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

function newBlock(b: Partial<Block> & { kind: BlockKind; category: Category; raw: string[] }): Block {
  return {
    id: uid(),
    enabled: true,
    dirty: false,
    ...b,
  } as Block;
}

export function parse(content: string): ZshrcDoc {
  const trailingNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (trailingNewline) lines.pop(); // drop the empty element after the final newline

  const blocks: Block[] = [];
  const n = lines.length;
  let i = 0;

  while (i < n) {
    const line = lines[i];

    // blank
    if (RE_BLANK.test(line)) {
      blocks.push(newBlock({ kind: "blank", category: "other", raw: [line] }));
      i++;
      continue;
    }

    // comment (possibly a disabled statement, or a fully commented-out multi-line construct)
    if (RE_COMMENT.test(line)) {
      const multi = consumeDisabledMultiline(lines, i);
      if (multi) {
        blocks.push(multi.block);
        i = multi.end + 1;
        continue;
      }
      const disabled = classifyDisabled(line);
      if (disabled) {
        blocks.push(newBlock({ ...disabled, enabled: false, raw: [line] }));
      } else {
        const text = commentText(line);
        const kind: BlockKind = isSectionHeader(text) ? "section" : "comment";
        blocks.push(newBlock({ kind, category: "other", raw: [line], text: line }));
      }
      i++;
      continue;
    }

    // function (brace block)
    if (RE_FUNC.test(line) || (RE_FUNC.test(line.replace(/\{[^]*$/, "{")) && RE_FUNC_INLINE_BRACE.test(line))) {
      const end = consumeBraceBlock(lines, i);
      const raw = lines.slice(i, end + 1);
      const nameMatch = line.match(/^\s*(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)/);
      blocks.push(
        newBlock({
          kind: "function",
          category: "functions",
          raw,
          text: raw.join("\n"),
          name: nameMatch ? nameMatch[1] : undefined,
        })
      );
      i = end + 1;
      continue;
    }

    // keyword compound (if/for/while/until/select/case) — multi-line only
    const fw = firstWord(line);
    if (fw in KW_OPENERS && !isOneLineCompound(line, fw)) {
      const end = consumeKeywordBlock(lines, i);
      const raw = lines.slice(i, end + 1);
      const { kind, category } = classifyByContent(raw.join("\n"));
      blocks.push(newBlock({ kind: kind === "source" || kind === "eval" ? kind : "raw", category, raw, text: raw.join("\n") }));
      i = end + 1;
      continue;
    }

    // array assignment that opens multi-line, e.g. `path=(`
    if (/=\(\s*$/.test(line)) {
      const end = consumeUntil(lines, i, (l) => /^\s*\)\s*$/.test(l) || /\)\s*$/.test(l.trim()));
      const raw = lines.slice(i, end + 1);
      const headerMatch = line.match(/^(\s*[A-Za-z_][A-Za-z0-9_]*=\()\s*$/);
      const inner = raw.slice(1, raw.length - 1);
      const entries = inner.filter((l) => l.trim() && !RE_COMMENT.test(l)).map((l) => l.trim());
      const arrayExtra = inner.filter((l) => RE_COMMENT.test(l));
      blocks.push(
        newBlock({
          kind: "path-array",
          category: "path",
          raw,
          header: headerMatch ? line.trim() : "path=(",
          entries,
          arrayExtra,
          text: raw.join("\n"),
        })
      );
      i = end + 1;
      continue;
    }

    // line continuation (joined logical statement)
    if (endsWithBackslash(line)) {
      const end = consumeUntil(lines, i, (l) => !endsWithBackslash(l));
      const raw = lines.slice(i, end + 1);
      const fullText = raw.join("\n");
      const { kind, category } = classifyByContent(fullText);
      blocks.push(newBlock({ kind, category, raw, text: fullText }));
      i = end + 1;
      continue;
    }

    // single-line statement
    const cls = classifyStatement(line);
    blocks.push(newBlock({ ...cls, raw: [line] }));
    i++;
  }

  // Attach eligible leading comments as the following block's caption.
  attachNotes(blocks);

  // SAFETY: verify byte-for-byte coverage. If anything was dropped/duplicated,
  // fall back to whole-file mode so we can never corrupt the file.
  const reconstructed = blocks.flatMap((b) => b.raw).join("\n") + (trailingNewline ? "\n" : "");
  if (reconstructed !== content) {
    return {
      path: "",
      exists: true,
      trailingNewline,
      fellBack: true,
      original: content,
      blocks: [
        newBlock({
          kind: "raw",
          category: "other",
          raw: lines,
          text: content,
        }),
      ],
    };
  }

  return { path: "", exists: true, trailingNewline, fellBack: false, original: content, blocks };
}

function attachNotes(blocks: Block[]): void {
  for (let i = blocks.length - 1; i > 0; i--) {
    const cur = blocks[i];
    const prev = blocks[i - 1];
    const attachable =
      cur.kind !== "comment" &&
      cur.kind !== "section" &&
      cur.kind !== "blank" &&
      cur.enabled;
    if (
      attachable &&
      prev.kind === "comment" &&
      prev.raw.length === 1
    ) {
      cur.note = commentText(prev.raw[0]);
      cur.noteRaw = prev.raw[0];
      cur.raw = [...prev.raw, ...cur.raw];
      blocks.splice(i - 1, 1);
      i--; // we removed one element
    }
  }
}

// ---------------------------------------------------------------------------
// multi-line consumers
// ---------------------------------------------------------------------------

function consumeBraceBlock(lines: string[], start: number): number {
  let depth = 0;
  let seen = false;
  const state: { q: '"' | "'" | "" } = { q: "" };
  for (let j = start; j < lines.length; j++) {
    depth += netBraceDelta(lines[j], state);
    if (depth > 0) seen = true;
    if (seen && depth <= 0) return j;
  }
  return lines.length - 1;
}

function consumeKeywordBlock(lines: string[], start: number): number {
  const stack: string[] = [];
  for (let j = start; j < lines.length; j++) {
    const w = firstWord(lines[j]);
    if (w in KW_OPENERS) stack.push(KW_OPENERS[w]);
    else if (KW_CLOSERS.has(w)) stack.pop();
    if (j > start && stack.length === 0) return j;
    if (j === start && stack.length === 0) return j; // defensive
  }
  return lines.length - 1;
}

function consumeUntil(lines: string[], start: number, isEnd: (l: string) => boolean): number {
  for (let j = start; j < lines.length; j++) {
    if (j > start && isEnd(lines[j])) return j;
    if (j === start && /\)\s*$/.test(lines[j].trim()) && /=\(.*\)/.test(lines[j])) return j;
  }
  return lines.length - 1;
}

function isOneLineCompound(line: string, opener: string): boolean {
  const closer = KW_OPENERS[opener];
  // closer appears as a trailing token on the same line => one-liner, not a block
  const re = new RegExp(`(^|[;\\s])${closer}\\s*;?\\s*$`);
  return re.test(line.trim());
}

/** Strip exactly the `# ` (or `#`) prefix this app adds when disabling, preserving indent. */
function uncomment(line: string): string | null {
  const m = line.match(/^(\s*)#\s?(.*)$/);
  return m ? m[1] + m[2] : null;
}

/** Maximal run of commented/blank lines from `start`, uncommented (blank lines kept as ""). */
function disabledBodies(lines: string[], start: number): string[] {
  const bodies: string[] = [];
  for (let j = start; j < lines.length; j++) {
    const l = lines[j];
    if (RE_BLANK.test(l)) {
      bodies.push("");
      continue;
    }
    const u = uncomment(l);
    if (u === null) break;
    bodies.push(u);
  }
  return bodies;
}

/**
 * Recognize a fully commented-out multi-line construct (function / array / if-case-for) as
 * ONE disabled block. Without this, disabling a multi-line block then reloading would fragment
 * it into loose comments and re-enabling would emit broken shell. Returns null if `start` is
 * not such a construct (the caller then handles it as a single comment / disabled statement).
 */
function consumeDisabledMultiline(lines: string[], start: number): { block: Block; end: number } | null {
  const body0 = uncomment(lines[start]);
  if (body0 === null) return null;
  const bodies = disabledBodies(lines, start);

  let endRel = -1;
  let mode: "function" | "array" | "keyword" | null = null;

  if (RE_FUNC.test(body0) || (RE_FUNC.test(body0.replace(/\{[^]*$/, "{")) && RE_FUNC_INLINE_BRACE.test(body0))) {
    endRel = consumeBraceBlock(bodies, 0);
    mode = "function";
  } else if (/=\(\s*$/.test(body0)) {
    endRel = consumeUntil(bodies, 0, (l) => /^\s*\)\s*$/.test(l) || /\)\s*$/.test(l.trim()));
    mode = "array";
  } else {
    const fw = firstWord(body0);
    // require a real shell opener (then/do/in present) so prose comments aren't mis-read
    if (fw in KW_OPENERS && /\b(then|do|in)\b/.test(body0) && !isOneLineCompound(body0, fw)) {
      endRel = consumeKeywordBlock(bodies, 0);
      mode = "keyword";
    }
  }

  // require a genuine multi-line span fully contained within the commented run
  if (mode === null || endRel <= 0 || endRel >= bodies.length) return null;

  const raw = lines.slice(start, start + endRel + 1);
  const text = bodies.slice(0, endRel + 1).join("\n");

  if (mode === "function") {
    const nameMatch = body0.match(/^\s*(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)/);
    return {
      block: newBlock({ kind: "function", category: "functions", raw, text, name: nameMatch ? nameMatch[1] : undefined, enabled: false }),
      end: start + endRel,
    };
  }
  if (mode === "array") {
    const headerMatch = body0.match(/^(\s*[A-Za-z_][A-Za-z0-9_]*=\()\s*$/);
    const inner = bodies.slice(1, endRel);
    const entries = inner.filter((l) => l.trim() && !RE_COMMENT.test(l)).map((l) => l.trim());
    const arrayExtra = inner.filter((l) => RE_COMMENT.test(l));
    return {
      block: newBlock({ kind: "path-array", category: "path", raw, header: headerMatch ? body0.trim() : "path=(", entries, arrayExtra, text, enabled: false }),
      end: start + endRel,
    };
  }
  const { kind, category } = classifyByContent(text);
  return {
    block: newBlock({ kind: kind === "source" || kind === "eval" ? kind : "raw", category, raw, text, enabled: false }),
    end: start + endRel,
  };
}

// ---------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------

function commentLine(l: string): string {
  if (l.trim() === "") return l;
  const m = l.match(/^(\s*)(.*)$/);
  return m ? `${m[1]}# ${m[2]}` : `# ${l}`;
}

export function regenerate(b: Block): string[] {
  let stmt: string[];
  switch (b.kind) {
    case "alias":
      stmt = [`alias ${b.name ?? ""}=${b.value ?? ""}`];
      break;
    case "export":
      stmt = [`export ${b.name ?? ""}=${b.value ?? ""}`];
      break;
    case "assignment":
      stmt = [`${b.name ?? ""}=${b.value ?? ""}`];
      break;
    case "option":
      stmt = [`setopt ${(b.options ?? []).join(" ")}`];
      break;
    case "path-array":
      stmt = [
        b.header ?? "path=(",
        ...(b.entries ?? []).map((e) => `  ${e}`),
        ...(b.arrayExtra ?? []),
        ")",
      ];
      break;
    case "blank":
      return [""];
    case "comment":
    case "section":
      return (b.text ?? b.raw.join("\n")).split("\n");
    default:
      stmt = (b.text ?? b.raw.join("\n")).split("\n");
  }

  const out: string[] = [];
  // Preserve the caption's exact original bytes (non-canonical spacing/indent) when available.
  if (b.note != null && b.note !== "") out.push(b.noteRaw ?? `# ${b.note}`);
  if (!b.enabled) stmt = stmt.map(commentLine);
  out.push(...stmt);
  return out;
}

export function serialize(doc: ZshrcDoc): string {
  const lines: string[] = [];
  for (const b of doc.blocks) {
    if (b.dirty || b.created) lines.push(...regenerate(b));
    else lines.push(...b.raw);
  }
  return lines.join("\n") + (doc.trailingNewline ? "\n" : "");
}

// ---------------------------------------------------------------------------
// mutations (return new docs; never mutate in place)
// ---------------------------------------------------------------------------

function clone(doc: ZshrcDoc, blocks: Block[]): ZshrcDoc {
  return { ...doc, blocks };
}

export function updateBlock(doc: ZshrcDoc, id: string, patch: Partial<Block>): ZshrcDoc {
  return clone(
    doc,
    doc.blocks.map((b) =>
      b.id === id
        ? {
            ...b,
            ...patch,
            // if the caption text itself is edited, drop the stale verbatim copy
            ...(patch.note !== undefined ? { noteRaw: undefined } : {}),
            dirty: true,
          }
        : b
    )
  );
}

export function toggleBlock(doc: ZshrcDoc, id: string): ZshrcDoc {
  return clone(
    doc,
    doc.blocks.map((b) => (b.id === id ? { ...b, enabled: !b.enabled, dirty: true } : b))
  );
}

export function deleteBlock(doc: ZshrcDoc, id: string): ZshrcDoc {
  return clone(doc, doc.blocks.filter((b) => b.id !== id));
}

export function moveBlock(doc: ZshrcDoc, id: string, dir: -1 | 1): ZshrcDoc {
  const idx = doc.blocks.findIndex((b) => b.id === id);
  if (idx < 0) return doc;
  // find the nearest sibling in the same category in the requested direction
  let target = -1;
  for (let j = idx + dir; j >= 0 && j < doc.blocks.length; j += dir) {
    if (doc.blocks[j].category === doc.blocks[idx].category && isStructuralKind(doc.blocks[j].kind)) {
      target = j;
      break;
    }
  }
  if (target < 0) return doc;
  const next = [...doc.blocks];
  const [moved] = next.splice(idx, 1);
  next.splice(target, 0, moved);
  return clone(doc, next);
}

function isStructuralKind(k: BlockKind): boolean {
  return k !== "blank" && k !== "comment" && k !== "section";
}

export function addBlock(doc: ZshrcDoc, block: Partial<Block> & { kind: BlockKind; category: Category }): ZshrcDoc {
  const created = newBlock({
    raw: [],
    enabled: true,
    ...block,
    dirty: true,
    created: true,
  });
  // insert after the last structural block of the same category, else append
  let insertAt = doc.blocks.length;
  for (let j = doc.blocks.length - 1; j >= 0; j--) {
    if (doc.blocks[j].category === block.category && isStructuralKind(doc.blocks[j].kind)) {
      insertAt = j + 1;
      break;
    }
  }
  const next = [...doc.blocks];
  next.splice(insertAt, 0, created);
  return clone(doc, next);
}

// ---------------------------------------------------------------------------
// helpers for the UI
// ---------------------------------------------------------------------------

export function isStructured(b: Block): boolean {
  return (
    b.kind === "alias" ||
    b.kind === "export" ||
    b.kind === "assignment" ||
    b.kind === "option" ||
    b.kind === "path-array"
  );
}

/** Blocks that should appear as cards in the structured views (hide blank/section noise). */
export function visibleBlocks(doc: ZshrcDoc, category: Category): Block[] {
  return doc.blocks.filter(
    (b) => b.category === category && b.kind !== "blank" && b.kind !== "section"
  );
}

export function categoryCounts(doc: ZshrcDoc): Record<Category, number> {
  const counts: Record<Category, number> = {
    aliases: 0,
    environment: 0,
    path: 0,
    functions: 0,
    plugins: 0,
    options: 0,
    keybindings: 0,
    other: 0,
  };
  for (const b of doc.blocks) {
    if (b.kind === "blank" || b.kind === "section") continue;
    counts[b.category]++;
  }
  return counts;
}

export function isDirty(doc: ZshrcDoc): boolean {
  return serialize(doc) !== doc.original;
}
