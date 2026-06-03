<div align="center">

# seashell

### A visual, safe editor for your `~/.zshrc`

Structured controls on the left, your real shell config — live — on the right.
Nothing ever touches disk until you've seen the diff. Built for developers who trust their tools.

[![Website](https://img.shields.io/badge/website-seashell.cuzeacflorin.fr-3B9C7A)](https://seashell.cuzeacflorin.fr)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-stable-CE412B?logo=rust&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon%20%2F%20Intel-000000?logo=apple&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-3B9C7A)

</div>

---

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◉ ◉ ◉   ~/.zshrc  ● 172 lines              ⌘K   Backups   Review & Save…│
├───────────────────────────────────┬────────────────────────────────────┤
│  Filter blocks…   [All|Aliases|…]  │   source                Live ▾     │
│  ▾ ALIASES                  11  +  │   1  #!/usr/bin/env zsh             │
│    cc  = claude --dangerously…  ●  │   2                                 │
│    sz  = source ~/.zshrc        ●  │   3  # aliases                      │
│  ▾ PATH                          + │   4  alias cc="claude --danger…"    │
│    $HOME/.local/bin                │   5  alias sz="source ~/.zshrc"     │
│    🔒 $path[@] · inherited         │   …                                 │
├───────────────────────────────────┴────────────────────────────────────┤
│  ● Saved · ~/.zshrc · 61 blocks · backup 4m ago               Discard    │
└──────────────────────────────────────────────────────────────────────┘
```

> 💡 **Live at [seashell.cuzeacflorin.fr](https://seashell.cuzeacflorin.fr).** The source is in [`landing/`](landing/) — a small Vite + React app (minimalist, all‑lowercase, **Geist Pixel Square**). Run it with `cd landing && pnpm install && pnpm dev`, or `pnpm build` for static output in `landing/dist/`.

---

## Why

Your `~/.zshrc` boots your entire shell. Editing it by hand is fiddly and a single
unbalanced quote can break every new terminal. seashell gives you **friendly,
structured controls** for the things that map cleanly (aliases, exports, PATH,
options, keybindings) and **honest code editing** for the things that don't
(functions, `eval` inits, plugin blocks) — while keeping the **real file visible
at all times** and **guaranteeing it never gets corrupted**.

## Features

- **🪟 Two‑pane editor** — structured controls on the left, the live, syntax‑highlighted file on the right. Click a control and watch the exact lines settle into the source.
- **🧩 The right editor per kind** — opaque inline fields for aliases & exports (pipes and quotes kept *literal*, never re‑escaped), removable chips for `setopt`, chord + widget for `bindkey`, a reorderable **PATH** editor with a locked `$path[@]` sentinel, and a dignified summary‑row + scoped code editor for functions / `eval` / plugin blocks.
- **🔍 Mandatory diff before save** — a real diff of *on‑disk bytes vs. your edits*, hunks labelled by your file's own section comments. Nothing is written until you confirm.
- **✅ `zsh -n` syntax check** — every save is validated by `zsh` itself first, so you can't write a config that breaks your shell.
- **🕒 Automatic backups & restore** — every save snapshots your file to `~/.zshrc.backups/` first. Browse, diff and restore any backup — and restore is itself reversible.
- **🔀 Enable / disable as a comment toggle** — flip any block on/off; disabling comments its exact lines (and re‑enabling is byte‑identical).
- **⌘K command palette** — fuzzy jump to any block, add aliases/exports, restore backups, open in your editor, and more.
- **📋 Copy diff / copy file**, **Open in Zed**, **Reveal in Finder**.
- **🐚 Menu‑bar tray + global shortcut** — summon or hide the window from anywhere with `⌘⌥Z`; the app lives quietly in your menu bar.
- **👀 Live external‑change detection** — if `~/.zshrc` changes on disk under you, seashell tells you.
- **🎨 Calm, native‑mac design** — one restrained green accent, hairline borders, [Geist](https://vercel.com/font) for UI + mono, [Phosphor](https://phosphoricons.com) icons, first‑class dark **and** light.

## The cardinal rule: it never corrupts your file

Safety isn't a feature here, it's the architecture:

- **Byte‑exact round‑trip.** The parser captures every original line into exactly one block. Untouched blocks are re‑emitted *verbatim* — only the blocks you actually edit are regenerated. `serialize(parse(file)) === file`, byte for byte. This is enforced by a test suite that runs against a real 172‑line `.zshrc`.
- **Atomic, symlink‑aware writes.** Saves go to a temp file, get `fsync`'d, preserve the original file mode, then `rename()` over the target — a crash can never leave a half‑written config. If `~/.zshrc` is a symlink (stow / chezmoi / yadm…), seashell writes *through* to the real target instead of clobbering the link.
- **Automatic backups.** The current file is copied to `~/.zshrc.backups/` before every write, so any change is reversible.
- **Graceful fallback.** If the parser ever encounters something it can't safely model, it drops to whole‑file (source‑only) editing — your bytes are preserved, no exceptions.

## Install

### Download (macOS)

Grab the latest `.dmg` from the [**Releases**](https://github.com/envindavsorg/seashell/releases) page, open it, and drag **seashell** to Applications.

> On first launch, right‑click the app → **Open** (it isn't notarized yet, so Gatekeeper will ask).

### Build from source

**Prerequisites:** [Rust](https://rustup.rs) (stable), [Node](https://nodejs.org) ≥ 20, and [pnpm](https://pnpm.io) ≥ 9.

```bash
git clone https://github.com/envindavsorg/seashell.git
cd seashell
pnpm install

pnpm tauri dev      # run the app in development
pnpm tauri build    # produce a .dmg / .app in src-tauri/target/release/bundle/
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘S` | Review & Save (open the diff) |
| `⌘K` | Command palette |
| `⌘D` | Toggle source view: **Live** ↔ **On disk** |
| `⌘Z` | Undo |
| `⌘F` | Focus the block filter |
| `⌘⌥Z` | **Global:** summon / hide the window |
| `↩` | Edit the focused block |

The window's close button **hides seashell to the menu bar** (it's a resident app).
`⌘Q` or the tray's **Quit** exits for real.

## How it works

seashell is a [Tauri 2](https://tauri.app) app — a Rust core and a React webview talking over an IPC bridge, with a strict division of labour:

- **Rust (`src-tauri/`)** does *only* the safety‑critical I/O: read, atomic write + backup, restore, and the `zsh -n` validation. It holds no parsing logic.
- **TypeScript (`src/lib/zshrc/`)** owns the round‑trip‑safe parser, serializer and diff — a single, unit‑tested source of truth for the data model.
- **React (`src/components/zshrc/`)** is the two‑pane UI, styled with **Tailwind v4** + **shadcn/ui**.

## Tech stack

`Tauri 2` · `Rust` · `React 19` · `TypeScript` · `Vite` · `Tailwind v4` · `shadcn/ui` · `Geist` · `Phosphor Icons` · `pnpm`

## Development

```bash
pnpm tauri dev                 # the real desktop app (Rust + webview)
pnpm dev                       # frontend only, in a browser at :1420 (invoke() will fail)
pnpm build                     # typecheck + bundle the frontend
node scripts/roundtrip-test.ts # parser safety suite against your real ~/.zshrc

# from src-tauri/
cargo clippy                   # lint the Rust backend
cargo fmt                      # format
```

If you touch `src/lib/zshrc/parser.ts`, **always** re‑run `node scripts/roundtrip-test.ts` —
it's the guardrail for the cardinal rule (byte‑exact round‑trip, reversible toggles,
isolated edits).

## License

MIT © Cuzeac Florin
