// Minimal LCS line diff for the Review & Save sheet (no external dep).

export type DiffKind = "eq" | "del" | "add";

export interface DiffRow {
  kind: DiffKind;
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

export interface DiffHunk {
  label: string;
  rows: DiffRow[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  added: number;
  removed: number;
  unchanged: boolean;
}

function splitLines(s: string): string[] {
  const lines = s.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function lcsOps(a: string[], b: string[]): DiffRow[] {
  const n = a.length;
  const m = b.length;
  // dp table of LCS lengths
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: "eq", text: a[i], oldNo: oldNo++, newNo: newNo++ });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: "del", text: a[i], oldNo: oldNo++, newNo: null });
      i++;
    } else {
      rows.push({ kind: "add", text: b[j], oldNo: null, newNo: newNo++ });
      j++;
    }
  }
  while (i < n) rows.push({ kind: "del", text: a[i++], oldNo: oldNo++, newNo: null });
  while (j < m) rows.push({ kind: "add", text: b[j++], oldNo: null, newNo: newNo++ });
  return rows;
}

export function diffLines(oldText: string, newText: string, context = 3): DiffResult {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const rows = lcsOps(a, b);

  const added = rows.filter((r) => r.kind === "add").length;
  const removed = rows.filter((r) => r.kind === "del").length;
  if (added === 0 && removed === 0) {
    return { hunks: [], added, removed, unchanged: true };
  }

  // mark which rows to keep (changed + N context)
  const keep = new Array(rows.length).fill(false);
  rows.forEach((r, idx) => {
    if (r.kind !== "eq") {
      for (let k = Math.max(0, idx - context); k <= Math.min(rows.length - 1, idx + context); k++) {
        keep[k] = true;
      }
    }
  });

  const hunks: DiffHunk[] = [];
  let current: DiffRow[] | null = null;
  for (let idx = 0; idx < rows.length; idx++) {
    if (keep[idx]) {
      if (!current) current = [];
      current.push(rows[idx]);
    } else if (current) {
      hunks.push(finalizeHunk(current));
      current = null;
    }
  }
  if (current) hunks.push(finalizeHunk(current));

  return { hunks, added, removed, unchanged: false };
}

function finalizeHunk(rows: DiffRow[]): DiffHunk {
  // Label the hunk with the nearest comment line in its context, else a line range.
  const comment = rows.find((r) => r.kind === "eq" && /^\s*#\s*\S/.test(r.text));
  const firstNo =
    rows.find((r) => r.oldNo != null)?.oldNo ?? rows.find((r) => r.newNo != null)?.newNo ?? 0;
  const lastRow = [...rows].reverse().find((r) => r.newNo != null || r.oldNo != null);
  const lastNo = lastRow ? (lastRow.newNo ?? lastRow.oldNo ?? firstNo) : firstNo;
  const label = comment
    ? comment.text.replace(/^\s*#\s?/, "").trim()
    : `lines ${firstNo}–${lastNo}`;
  return { label, rows };
}
