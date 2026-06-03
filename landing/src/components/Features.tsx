import { Reveal } from "./Reveal";

const ITEMS: { title: string; body: string }[] = [
  {
    title: "two-pane editor",
    body: "structured controls left, the live syntax-highlighted file right.",
  },
  {
    title: "the right editor per kind",
    body: "fields for aliases & exports, chips for setopt, scoped code for functions.",
  },
  {
    title: "diff before save",
    body: "a real diff of disk vs. your edits. nothing writes until you confirm.",
  },
  {
    title: "zsh -n validation",
    body: "every save is parse-checked by zsh first. you can't break your shell.",
  },
  {
    title: "backups & restore",
    body: "every save snapshots first. browse, diff and restore — reversibly.",
  },
  {
    title: "command palette",
    body: "⌘k to jump anywhere, add blocks, restore, open in your editor.",
  },
  { title: "menu-bar & ⌘⌥z", body: "lives in your menu bar. summon or hide from anywhere." },
  {
    title: "dark & light",
    body: "one restrained accent, hairline borders, first-class both ways.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-[940px] px-6 py-24">
      <Reveal>
        <p className="mono text-[11px] tracking-[0.12em] text-brand">everything you need</p>
        <h2 className="mt-3 max-w-[20ch] text-[clamp(26px,4vw,42px)] leading-[1] tracking-tight">
          friendly where it's safe, honest where it isn't
        </h2>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((it) => (
          <div key={it.title} className="bg-bg p-5 transition-colors hover:bg-surface">
            <h3 className="text-[16px] leading-tight">{it.title}</h3>
            <p className="mt-2 mono text-[12px] leading-relaxed text-muted">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
