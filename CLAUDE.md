# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`seashell` is a Tauri 2 desktop app: a Rust backend (`src-tauri/`) hosting a React 19 + TypeScript + Vite frontend (`src/`). Bundle identifier `com.florin.seashell`.

It is a **visual `~/.zshrc` manager** ("Plate & Source"): a two-pane editor with structured controls on the left (aliases, environment, PATH, options, keybindings, plugins, functions) and the live, syntax-highlighted file always on the right. Edits are staged in-memory; nothing is written until a mandatory diff (`Review & Save`). Frontend is styled with **Tailwind v4** (`src/index.css`, CSS-first, `@custom-variant dark`) + **shadcn/ui** (new-york, `components.json`, `src/components/ui/`), `next-themes` for dark/light, **`@phosphor-icons/react`** icons (regular weight via a global `IconContext` in `main.tsx`; duotone on category headers), `sonner` toasts. Fonts are self-hosted **Geist** (`@fontsource-variable/geist` + `geist-mono`, imported in `main.tsx`) wired through the `--font-ui` / `--font-code` CSS variables in `src/index.css`.

Package manager is **pnpm** (workspace file + lockfile present); don't use npm/yarn.

## Commands

```bash
pnpm install            # install frontend deps (Cargo deps fetch on first Rust build)

pnpm tauri dev          # run the actual desktop app (Rust + webview) — use this to develop
pnpm tauri build        # produce platform installers/bundles

pnpm dev                # Vite frontend ONLY, in a browser at :1420 — no Rust, invoke() fails
pnpm build              # tsc typecheck + vite build (frontend bundle into ../dist)
pnpm preview            # serve the built frontend bundle
```

Rust (run from `src-tauri/`): `cargo build`, `cargo clippy`, `cargo fmt`.

```bash
node scripts/roundtrip-test.ts   # parser safety test against the real ~/.zshrc (Node TS-strip)
```

`scripts/roundtrip-test.ts` is the guardrail for the cardinal rule: it asserts `serialize(parse(~/.zshrc)) === ~/.zshrc` byte-for-byte, that disable→reload→enable round-trips for multi-line blocks, and that single edits/deletes are isolated. Run it after any change to `src/lib/zshrc/parser.ts`. (`scripts/` is excluded from `tsconfig`, so it isn't part of `pnpm build`.)

## Architecture

**Two processes, one IPC bridge.** The Rust core and the web frontend are separate; they communicate only through Tauri's `invoke` channel. Adding a backend feature touches three files in lockstep:

1. **Define** the command in `src-tauri/src/lib.rs` with `#[tauri::command]`, and register it in the `generate_handler!` macro inside `run()`.
2. **Permit** it — *plugin/core* commands are unreachable unless listed in `src-tauri/capabilities/default.json`. (App-defined `#[tauri::command]`s like ours don't need a per-command permission entry; the capability gate is for plugin/core commands.)
3. **Call** it from the frontend via `invoke("command_name", { args })` — wrapped with types in `src/lib/tauri.ts` (`api.readZshrc`, `api.writeZshrc`, `api.listBackups`, …).

**Backend = safety only; parsing lives in TS.** `lib.rs` does *just* file I/O + OS glue: `read_zshrc`, `write_zshrc` (atomic temp-file + `rename`, preserves mode, writes through symlinks, auto-creates a timestamped backup in `~/.zshrc.backups/` first), `list_backups`/`read_backup`/`restore_backup`/`delete_backup`/`reveal_backups`, `validate_zsh` (runs `zsh -n` for a pre-save syntax check), `open_in_zed`/`reveal_in_finder`. All `.zshrc` parsing/serialization is the **round-trip-safe TS parser** in `src/lib/zshrc/parser.ts`: every original line is captured into exactly one block's `raw`, so `serialize` emits untouched blocks verbatim and only *edited* blocks are regenerated. If line-coverage ever breaks it falls back to a single whole-file block (source-only editing) — never corruption. UI components live in `src/components/zshrc/`; the view-model (categories, block→line ranges) in `src/lib/zshrc/view.ts`.

**Plugins & resident behavior.** Registered in `run()`: `single-instance` (second launch focuses the existing window), `window-state` (restores size/position), `global-shortcut` (⌘⌥Z toggles the window), `clipboard-manager` (Copy diff / Copy file), plus `opener`. A **menu-bar tray** (Show/Hide/Quit) is built in `setup_desktop()`, and a **`notify` file watcher** (set up in `setup_watcher()`) emits a `zshrc-changed` event the frontend listens for (external-change banner); self-writes are ignored via `LAST_SELF_WRITE`. The window's close button **hides to the tray** (resident app) — `⌘Q` and the tray's Quit still exit. New plugin permissions live in `capabilities/default.json` (`clipboard-manager:allow-write-text`, `window-state:default`); the tray/shortcut are wired in Rust so they need no JS permission.

**Entry points.** `src-tauri/src/main.rs` is a thin shim that calls `seashell_lib::run()`; all backend logic lives in `lib.rs`. The crate is named `seashell_lib` (not `seashell`) deliberately — the lib/bin name split avoids a Windows linker collision (see comment in `Cargo.toml`). The `#[cfg_attr(mobile, tauri::mobile_entry_point)]` on `run()` is what makes the same entry point reusable for mobile targets.

**Build orchestration.** `src-tauri/tauri.conf.json` is the source of truth that ties the two halves together: `beforeDevCommand`/`beforeBuildCommand` invoke the pnpm scripts, `devUrl` (`http://localhost:1420`) and `frontendDist` (`../dist`) tell Tauri where to find the frontend in dev vs. release. Because of this, `vite.config.ts` pins the dev server to a **fixed port 1420 with `strictPort: true`** — Tauri expects that exact port and the build fails rather than falling back to another. Vite is also told to ignore `src-tauri/**` so Rust changes don't trigger HMR.

**Mobile / remote dev.** `vite.config.ts` reads `TAURI_DEV_HOST` to expose the dev server and a separate HMR websocket (port 1421) for testing on a physical device.
