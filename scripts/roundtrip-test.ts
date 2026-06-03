import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  deleteBlock,
  parse,
  serialize,
  toggleBlock,
  updateBlock,
  type ZshrcDoc,
} from "../src/lib/zshrc/parser.ts";

function diffFirst(a: string, b: string): string {
  const al = a.split("\n");
  const bl = b.split("\n");
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) {
      return `line ${i + 1}:\n  orig: ${JSON.stringify(al[i])}\n  got:  ${JSON.stringify(bl[i])}`;
    }
  }
  return "(no line diff but strings differ — trailing?)";
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${detail}`}`);
  if (!cond) failures++;
}

// Source resolution: $ZSHRC_FIXTURE, then a CLI arg, then the real ~/.zshrc, else the
// checked-in fixture — so the guardrail runs in CI and on fresh clones without a ~/.zshrc.
const fallback = join(import.meta.dirname, "fixtures", "sample.zshrc");
const home = join(homedir(), ".zshrc");
const src = process.env.ZSHRC_FIXTURE ?? process.argv[2] ?? (existsSync(home) ? home : fallback);
console.log(`source: ${src.replace(homedir(), "~")}`);
const content = readFileSync(src, "utf8");
const doc = parse(content);

console.log(`\nParsed ${doc.blocks.length} blocks · fellBack=${doc.fellBack}\n`);

// 1. byte-exact round trip
const rt = serialize(doc);
check("serialize(parse(zshrc)) === zshrc (byte-exact)", rt === content, diffFirst(content, rt));

// 2. not in fallback mode (structured editing available)
check("structured mode (not fellBack)", !doc.fellBack);

// 3. toggle every block off then on === identity
let toggleOk = true;
let toggleDetail = "";
for (const b of doc.blocks) {
  if (b.kind === "blank" || b.kind === "section" || b.kind === "comment") continue;
  let d: ZshrcDoc = toggleBlock(doc, b.id);
  d = toggleBlock(d, b.id);
  const out = serialize(d);
  if (out !== content) {
    toggleOk = false;
    toggleDetail = `block ${b.kind} "${b.name ?? b.text?.slice(0, 30) ?? ""}":\n  ${diffFirst(content, out)}`;
    break;
  }
}
check("toggle off→on is identity for every block", toggleOk, toggleDetail);

// 4. editing one alias changes ONLY that block's line(s)
const alias = doc.blocks.find((b) => b.kind === "alias");
if (alias) {
  const edited = updateBlock(doc, alias.id, { value: '"CHANGED"' });
  const out = serialize(edited);
  const origLines = content.split("\n");
  const newLines = out.split("\n");
  let changed = 0;
  for (let i = 0; i < Math.max(origLines.length, newLines.length); i++) {
    if (origLines[i] !== newLines[i]) changed++;
  }
  check(`editing one alias changes exactly 1 line (changed ${changed})`, changed === 1);
}

// 5. CRITICAL: disable -> save -> reload -> enable round-trips for MULTI-LINE blocks
for (const kind of ["function", "path-array"] as const) {
  const b = doc.blocks.find((x) => x.kind === kind);
  if (!b) continue;
  const disabled = toggleBlock(doc, b.id);
  const s1 = serialize(disabled); // what gets written when you disable + save
  const reparsed = parse(s1); // simulate reload
  const found = reparsed.blocks.find((x) => x.kind === kind && !x.enabled);
  const oneBlock =
    !!found && reparsed.blocks.filter((x) => x.kind === kind && !x.enabled).length === 1;
  check(`disable+reload keeps ${kind} as ONE disabled block (no fragmentation)`, oneBlock);
  if (found) {
    const reEnabled = serialize(toggleBlock(reparsed, found.id));
    check(
      `disable→reload→enable restores original ${kind} bytes`,
      reEnabled === content,
      diffFirst(content, reEnabled),
    );
  }
}

// 6. brace-inside-string does not mis-segment a function or swallow the next statement
{
  const synthetic = `f() {\n  echo "}"\n  x="a { b"\n}\nalias after=2\n`;
  const sd = parse(synthetic);
  check("serialize(parse(brace-in-string)) round-trips", serialize(sd) === synthetic);
  const fn = sd.blocks.find((x) => x.kind === "function");
  check(
    "function with braces in strings spans exactly 4 lines",
    !!fn && fn.raw.length === 4,
    fn ? `got ${fn.raw.length}` : "no fn",
  );
  check(
    "statement after the function is NOT swallowed",
    sd.blocks.some((x) => x.kind === "alias" && x.name === "after"),
  );
}

// 7. non-canonical caption bytes are preserved when an edited block is re-serialized
{
  const synthetic = `##  Loud Header\nalias x="y"\n`;
  const sd = parse(synthetic);
  const ax = sd.blocks.find((x) => x.kind === "alias");
  if (ax) {
    const out = serialize(updateBlock(sd, ax.id, { value: '"z"' }));
    check(
      "editing a block preserves its non-canonical caption bytes",
      out === `##  Loud Header\nalias x="z"\n`,
      diffFirst(`##  Loud Header\nalias x="z"\n`, out),
    );
  }
}

// 8. deleting a block removes exactly its line(s); every other alias survives
{
  const al = doc.blocks.find((b) => b.kind === "alias");
  if (al) {
    const out = serialize(deleteBlock(doc, al.id));
    const others = doc.blocks.filter((b) => b.kind === "alias" && b.id !== al.id);
    const gone = !out.includes(`alias ${al.name}=`);
    const rest = others.every((b) => out.includes(`alias ${b.name}=`));
    check("deleting an alias removes only it and keeps all others", gone && rest);
  }
}

// 9. category coverage sanity
const cats: Record<string, number> = {};
for (const b of doc.blocks) cats[b.category] = (cats[b.category] ?? 0) + 1;
console.log("\nCategory distribution:", JSON.stringify(cats));
const kinds: Record<string, number> = {};
for (const b of doc.blocks) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
console.log("Kind distribution:    ", JSON.stringify(kinds));

console.log(failures === 0 ? "\nALL CHECKS PASSED ✓" : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
