import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { BackupsSheet } from "@/components/zshrc/BackupsSheet";
import { CommandPalette } from "@/components/zshrc/CommandPalette";
import { DiffView } from "@/components/zshrc/DiffView";
import { Kbd } from "@/components/zshrc/Kbd";
import { ReviewSaveDialog } from "@/components/zshrc/ReviewSaveDialog";
import { SourcePane } from "@/components/zshrc/SourcePane";
import { StatusBar } from "@/components/zshrc/StatusBar";
import { StructuredPane } from "@/components/zshrc/StructuredPane";
import { Titlebar } from "@/components/zshrc/Titlebar";
import { relativeTime } from "@/lib/format";
import { api, type BackupInfo, type ZshValidation } from "@/lib/tauri";
import { diffLines } from "@/lib/zshrc/diff";
import {
  addBlock,
  type Block,
  type Category,
  deleteBlock,
  moveBlock,
  parse,
  serialize,
  toggleBlock,
  updateBlock,
  type ZshrcDoc,
} from "@/lib/zshrc/parser";
import { blockAtLine, lineRanges } from "@/lib/zshrc/view";

type AddCategory = "aliases" | "environment" | "options" | "keybindings";

export default function App() {
  const { setTheme, resolvedTheme } = useTheme();

  const [doc, setDoc] = useState<ZshrcDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Category | "all">("all");
  const [sourceMode, setSourceMode] = useState<"live" | "disk">("live");

  const [diffOpen, setDiffOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [externalChanged, setExternalChanged] = useState(false);
  const [validation, setValidation] = useState<ZshValidation | null>(null);
  const [validating, setValidating] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupInfo | null>(null);
  const [backupDiff, setBackupDiff] = useState<{ name: string; content: string } | null>(null);

  // Undo history lives in refs (never rendered) so we don't call a setter inside another
  // setter's updater — which React StrictMode double-invokes, double-pushing snapshots.
  const docRef = useRef<ZshrcDoc | null>(null);
  const historyRef = useRef<ZshrcDoc[]>([]);
  const lastKeyRef = useRef<string | null>(null);
  const nonceRef = useRef(0);
  const [flash, setFlash] = useState<{ start: number; end: number; nonce: number } | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  // ---- load ----
  const refreshBackups = useCallback(async () => {
    try {
      setBackups(await api.listBackups());
    } catch {
      /* ignore */
    }
  }, []);

  const loadFresh = useCallback(async () => {
    const file = await api.readZshrc();
    const parsed = parse(file.content);
    return { ...parsed, path: file.path, exists: file.exists } as ZshrcDoc;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const fresh = await loadFresh();
        setDoc(fresh);
      } catch (e) {
        setLoadError(String(e));
      } finally {
        setLoading(false);
      }
      refreshBackups();
    })();
  }, [loadFresh, refreshBackups]);

  // ---- derived ----
  const serialized = useMemo(() => (doc ? serialize(doc) : ""), [doc]);
  const dirty = doc ? serialized !== doc.original : false;
  const ranges = useMemo(() => (doc ? lineRanges(doc) : {}), [doc]);
  const selectedRange = selectedId ? (ranges[selectedId] ?? null) : null;
  const lineCount = useMemo(
    () => serialized.split("\n").length - (serialized.endsWith("\n") ? 1 : 0),
    [serialized],
  );
  const editedCount = doc ? doc.blocks.filter((b) => b.dirty || b.created).length : 0;
  const dirtyCount = editedCount || (dirty ? 1 : 0);

  // ---- mutation core (with undo coalescing for field typing) ----
  const apply = useCallback((next: ZshrcDoc, coalesceKey?: string) => {
    const prev = docRef.current;
    // Compare against the PREVIOUS key (read before reassigning) so the first edit of a new
    // field is checkpointed and only consecutive same-field keystrokes are coalesced.
    if (prev && (!coalesceKey || coalesceKey !== lastKeyRef.current)) {
      historyRef.current = [...historyRef.current.slice(-99), prev];
    }
    lastKeyRef.current = coalesceKey ?? null;
    docRef.current = next;
    setDoc(next);
  }, []);

  const flashBlock = useCallback((d: ZshrcDoc, id: string) => {
    const r = lineRanges(d)[id];
    if (r) setFlash({ ...r, nonce: ++nonceRef.current });
  }, []);

  const onUpdate = useCallback(
    (id: string, patch: Partial<Block>) => {
      if (!doc) return;
      const next = updateBlock(doc, id, patch);
      apply(next, `${id}:${Object.keys(patch).join(",")}`);
      setSelectedId(id);
      flashBlock(next, id);
    },
    [doc, apply, flashBlock],
  );

  const onToggle = useCallback(
    (id: string) => {
      if (!doc) return;
      const next = toggleBlock(doc, id);
      apply(next);
      setSelectedId(id);
      flashBlock(next, id);
    },
    [doc, apply, flashBlock],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: undo() is stable (refs only) and declared below
  const onDelete = useCallback(
    (id: string) => {
      if (!doc) return;
      apply(deleteBlock(doc, id));
      if (selectedId === id) setSelectedId(null);
      toast("Block removed", {
        action: { label: "Undo", onClick: () => undo() },
      });
    },
    [doc, apply, selectedId],
  );

  const onMove = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!doc) return;
      apply(moveBlock(doc, id, dir));
    },
    [doc, apply],
  );

  const onAdd = useCallback(
    (category: Category) => {
      if (!doc) return;
      const id = crypto.randomUUID();
      let base: Partial<Block> & { kind: Block["kind"]; category: Category };
      switch (category) {
        case "aliases":
          base = { id, kind: "alias", category, name: "", value: '""' };
          break;
        case "environment":
          base = { id, kind: "export", category, name: "", value: '""' };
          break;
        case "options":
          base = { id, kind: "option", category, options: [] };
          break;
        case "keybindings":
          base = { id, kind: "keybinding", category, text: "bindkey " };
          break;
        default:
          return;
      }
      apply(addBlock(doc, base));
      setSelectedId(id);
      setQuery(""); // clear any active filter so the new (empty) row isn't filtered out
      if (scope !== "all" && scope !== category) setScope(category);
    },
    [doc, apply, scope],
  );

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      const b = doc?.blocks.find((x) => x.id === id);
      if (b && scope !== "all" && b.category !== scope) setScope("all");
    },
    [doc, scope],
  );

  const onSelectLine = useCallback(
    (n: number) => {
      if (!doc) return;
      // don't hijack a manual text selection in the source pane (preserve copy UX)
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const b = blockAtLine(doc, ranges, n);
      if (b && b.kind !== "blank") select(b.id);
    },
    [doc, ranges, select],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.length === 0) return;
    const restored = h[h.length - 1];
    historyRef.current = h.slice(0, -1);
    docRef.current = restored;
    lastKeyRef.current = null;
    setDoc(restored);
  }, []);

  const onDiscard = useCallback(() => {
    if (!doc) return;
    const fresh = { ...parse(doc.original), path: doc.path, exists: doc.exists } as ZshrcDoc;
    apply(fresh);
    setSelectedId(null);
  }, [doc, apply]);

  const reload = useCallback(async () => {
    try {
      const fresh = await loadFresh();
      setDoc(fresh);
      docRef.current = fresh;
      historyRef.current = [];
      lastKeyRef.current = null;
      setSelectedId(null);
      setExternalChanged(false);
      toast("Reloaded from disk");
    } catch (e) {
      toast.error("Reload failed", { description: String(e) });
    }
  }, [loadFresh]);

  const confirmSave = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const outcome = await api.writeZshrc(serialized);
      const fresh = await loadFresh();
      setDoc(fresh);
      docRef.current = fresh;
      historyRef.current = [];
      lastKeyRef.current = null;
      setDiffOpen(false);
      setExternalChanged(false);
      await refreshBackups();
      const backup = outcome.backup;
      toast.success("Saved · backup created", {
        description: backup ? backup.name : undefined,
        action: backup ? { label: "Undo", onClick: () => setRestoreTarget(backup) } : undefined,
      });
    } catch (e) {
      toast.error("Save failed", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }, [doc, serialized, loadFresh, refreshBackups]);

  const doRestore = useCallback(
    async (b: BackupInfo) => {
      try {
        await api.restoreBackup(b.name);
        const fresh = await loadFresh();
        setDoc(fresh);
        docRef.current = fresh;
        historyRef.current = [];
        setSelectedId(null);
        await refreshBackups();
        toast.success("Backup restored", { description: b.name });
      } catch (e) {
        toast.error("Restore failed", { description: String(e) });
      }
    },
    [loadFresh, refreshBackups],
  );

  const doDelete = useCallback(
    async (b: BackupInfo) => {
      try {
        await api.deleteBackup(b.name);
        await refreshBackups();
        toast("Backup deleted");
      } catch (e) {
        toast.error("Delete failed", { description: String(e) });
      }
    },
    [refreshBackups],
  );

  const viewBackupDiff = useCallback(async (b: BackupInfo) => {
    try {
      const content = await api.readBackup(b.name);
      setBackupDiff({ name: b.name, content });
    } catch (e) {
      toast.error("Could not read backup", { description: String(e) });
    }
  }, []);

  // ---- external change watch (on window focus) ----
  useEffect(() => {
    const onFocus = async () => {
      if (!doc) return;
      try {
        const file = await api.readZshrc();
        if (file.content !== doc.original) setExternalChanged(true);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [doc]);

  // ---- live file watcher (Rust `notify` -> `zshrc-changed` event) ----
  useEffect(() => {
    const unlisten = listen("zshrc-changed", () => setExternalChanged(true));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // ---- run `zsh -n` validation whenever the Review & Save sheet opens ----
  useEffect(() => {
    if (!diffOpen) {
      setValidation(null);
      return;
    }
    let cancelled = false;
    setValidating(true);
    api
      .validateZsh(serialized)
      .then((v) => {
        if (!cancelled) setValidation(v);
      })
      .catch(() => {
        if (!cancelled) setValidation(null);
      })
      .finally(() => {
        if (!cancelled) setValidating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [diffOpen, serialized]);

  // ---- clipboard / open helpers ----
  const copyFile = useCallback(() => {
    writeText(serialized)
      .then(() => toast("File copied to clipboard"))
      .catch((e) => toast.error(String(e)));
  }, [serialized]);

  const copyDiff = useCallback(() => {
    if (!doc) return;
    const r = diffLines(doc.original, serialized);
    const text = r.hunks
      .map((h) =>
        h.rows
          .map((row) => (row.kind === "add" ? "+" : row.kind === "del" ? "-" : " ") + row.text)
          .join("\n"),
      )
      .join("\n\n");
    writeText(text)
      .then(() => toast("Diff copied to clipboard"))
      .catch((e) => toast.error(String(e)));
  }, [doc, serialized]);

  const openInZed = useCallback(() => {
    if (doc?.path) api.openInZed(doc.path).catch((e) => toast.error(String(e)));
  }, [doc]);

  const revealZshrc = useCallback(() => {
    if (doc?.path) api.revealInFinder(doc.path).catch((e) => toast.error(String(e)));
  }, [doc]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) setDiffOpen(true);
      } else if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setSourceMode((m) => (m === "live" ? "disk" : "live"));
      } else if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, undo]);

  // ---- render ----
  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <div className="h-[38px] border-b border-border bg-card/60" />
        <div className="flex flex-1 gap-px">
          <div className="flex-1 space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="flex-1 space-y-2 p-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-3/4" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-center">
        <div>
          <div className="mb-2 text-[15px] font-medium">Couldn't read ~/.zshrc</div>
          <div className="font-mono text-[12.5px] text-muted-foreground">{loadError}</div>
        </div>
      </div>
    );
  }

  const lastBackup = backups[0] ? relativeTime(backups[0].epoch_secs) : null;

  const hint = (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1">
        <Kbd>⏎</Kbd> edit
      </span>
      <span className="flex items-center gap-1">
        <Kbd>⌘K</Kbd> palette
      </span>
      <span className="flex items-center gap-1">
        <Kbd>⌘D</Kbd> live / on-disk
      </span>
      <span className="flex items-center gap-1">
        <Kbd>⌘Z</Kbd> undo
      </span>
      <span className="flex items-center gap-1">
        <Kbd>⌘S</Kbd> review &amp; save
      </span>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Titlebar
        path={doc.path}
        lineCount={lineCount}
        dirty={dirty}
        externalChanged={externalChanged}
        onReviewSave={() => setDiffOpen(true)}
        onOpenBackups={() => setBackupsOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onReload={reload}
      />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id="structured" defaultSize="46%" minSize="30%" maxSize="70%">
          <StructuredPane
            doc={doc}
            ranges={ranges}
            selectedId={selectedId}
            query={query}
            onQueryChange={setQuery}
            scope={scope}
            onScopeChange={setScope}
            onSelect={select}
            onUpdate={onUpdate}
            onToggle={onToggle}
            onDelete={onDelete}
            onMove={onMove}
            onAdd={onAdd}
            searchRef={searchRef}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="source" defaultSize="54%" minSize="30%" maxSize="70%">
          <SourcePane
            liveContent={serialized}
            diskContent={doc.original}
            mode={sourceMode}
            onModeChange={setSourceMode}
            selectedRange={selectedRange}
            onSelectLine={onSelectLine}
            flash={flash}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <StatusBar
        dirty={dirty}
        dirtyCount={dirtyCount}
        path={doc.path}
        lastBackup={lastBackup}
        blockCount={doc.blocks.filter((b) => b.kind !== "blank" && b.kind !== "section").length}
        onDiscard={onDiscard}
        hint={hint}
      />

      <ReviewSaveDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        oldText={doc.original}
        newText={serialized}
        path={doc.path}
        editedCount={dirtyCount}
        saving={saving}
        validation={validation}
        validating={validating}
        onConfirm={confirmSave}
        onCopyDiff={copyDiff}
      />

      <BackupsSheet
        open={backupsOpen}
        onOpenChange={setBackupsOpen}
        backups={backups}
        onRestore={(b) => setRestoreTarget(b)}
        onViewDiff={viewBackupDiff}
        onDelete={(b) => setDeleteTarget(b)}
        onReveal={() => api.revealBackups().catch((e) => toast.error(String(e)))}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        doc={doc}
        dirty={dirty}
        onJump={select}
        onAdd={(c: AddCategory) => onAdd(c)}
        onReviewSave={() => setDiffOpen(true)}
        onOpenBackups={() => setBackupsOpen(true)}
        onReload={reload}
        onDiscard={onDiscard}
        onToggleTheme={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        onOpenInZed={openInZed}
        onRevealFinder={revealZshrc}
        onCopyFile={copyFile}
      />

      {/* backup diff viewer */}
      <Dialog open={backupDiff !== null} onOpenChange={(o) => !o && setBackupDiff(null)}>
        <DialogContent className="max-w-[760px] gap-3 p-0">
          <DialogHeader className="border-b border-border px-5 py-3.5">
            <DialogTitle className="text-[15px]">Restore preview</DialogTitle>
            <DialogDescription className="font-mono text-[12px]">
              {backupDiff?.name} → current on disk
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] px-5 pb-5">
            {backupDiff && <DiffView oldText={doc.original} newText={backupDiff.content} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* restore confirm */}
      <AlertDialog open={restoreTarget !== null} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current ~/.zshrc will be backed up first, then replaced with{" "}
              <span className="font-mono">{restoreTarget?.name}</span>. This is reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (restoreTarget) doRestore(restoreTarget);
                setRestoreTarget(null);
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{deleteTarget?.name}</span> will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) doDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
