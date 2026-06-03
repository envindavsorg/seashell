import { Reveal } from "./Reveal";

const KEYS: { combo: string[]; act: string }[] = [
  { combo: ["⌘", "s"], act: "review & save" },
  { combo: ["⌘", "k"], act: "command palette" },
  { combo: ["⌘", "d"], act: "source: live ↔ on disk" },
  { combo: ["⌘", "z"], act: "undo" },
  { combo: ["⌘", "f"], act: "filter blocks" },
  { combo: ["⌘", "⌥", "z"], act: "global: summon / hide" },
];

export function Shortcuts() {
  return (
    <section className="mx-auto w-full max-w-[940px] px-6 py-24">
      <Reveal>
        <p className="mono text-[11px] tracking-[0.12em] text-brand">keyboard-first</p>
        <h2 className="mt-3 text-[clamp(26px,4vw,42px)] leading-[1] tracking-tight">
          built for your fingers
        </h2>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 gap-x-12 sm:grid-cols-2">
        {KEYS.map((k) => (
          <div key={k.act} className="flex items-center gap-4 border-b border-border py-3.5">
            <span className="flex gap-1">
              {k.combo.map((c, i) => (
                <kbd
                  key={i}
                  className="grid h-6 min-w-6 place-items-center border border-border bg-surface px-1.5 text-[12px]"
                >
                  {c}
                </kbd>
              ))}
            </span>
            <span className="mono text-[13px] text-muted">{k.act}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
