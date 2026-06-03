// Lightweight zsh highlighter for the live source pane and scoped code editing.
// Deliberately restrained (5 hues) so disabled/commented blocks visibly recede.

export type TokenType = "comment" | "string" | "var" | "number" | "keyword" | "builtin" | "plain";

export interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "for",
  "while",
  "until",
  "do",
  "done",
  "case",
  "esac",
  "in",
  "function",
  "select",
  "return",
]);

const BUILTINS = new Set([
  "export",
  "alias",
  "setopt",
  "unsetopt",
  "bindkey",
  "source",
  "eval",
  "typeset",
  "unset",
  "local",
  "readonly",
  "autoload",
  "command",
  "zstyle",
  "fpath",
  "path",
]);

const TOKEN_RE =
  /(#.*$)|('[^']*')|("(?:\\.|[^"\\])*")|(\$\{[^}]*\}|\$\([^)]*\)|\$[A-Za-z_][A-Za-z0-9_]*|\$[@*#?$!0-9-])|(\b\d+\b)|([A-Za-z_][A-Za-z0-9_]*)/g;

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null = TOKEN_RE.exec(line);
  while (m !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), type: "plain" });
    if (m[1] !== undefined) tokens.push({ text: m[1], type: "comment" });
    else if (m[2] !== undefined) tokens.push({ text: m[2], type: "string" });
    else if (m[3] !== undefined) tokens.push({ text: m[3], type: "string" });
    else if (m[4] !== undefined) tokens.push({ text: m[4], type: "var" });
    else if (m[5] !== undefined) tokens.push({ text: m[5], type: "number" });
    else if (m[6] !== undefined) {
      const w = m[6];
      const type: TokenType = KEYWORDS.has(w) ? "keyword" : BUILTINS.has(w) ? "builtin" : "plain";
      tokens.push({ text: w, type });
    }
    last = TOKEN_RE.lastIndex;
    m = TOKEN_RE.exec(line);
  }
  if (last < line.length) tokens.push({ text: line.slice(last), type: "plain" });
  if (tokens.length === 0) tokens.push({ text: line, type: "plain" });
  return tokens;
}

export const SYNTAX_COLOR: Record<TokenType, string | undefined> = {
  comment: "var(--syn-comment)",
  string: "var(--syn-string)",
  var: "var(--syn-var)",
  number: "var(--syn-number)",
  keyword: "var(--syn-keyword)",
  builtin: "var(--syn-builtin)",
  plain: undefined,
};
