import { Reveal } from "./Reveal";

const CHECKS: { title: string; body: string }[] = [
  {
    title: "byte-exact round-trip",
    body: "untouched blocks re-emit verbatim. only what you edit is regenerated.",
  },
  {
    title: "atomic, symlink-aware writes",
    body: "temp → fsync → rename, preserving mode. writes through stow / chezmoi symlinks.",
  },
  {
    title: "automatic backups",
    body: "the file is copied to ~/.zshrc.backups/ before every write.",
  },
  {
    title: "graceful fallback",
    body: "anything unmodelable drops to source-only editing. your bytes are safe.",
  },
];

export function Safety() {
  return (
    <section id="safety" className="border-y border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[940px] grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-2">
        <Reveal>
          <p className="mono text-[11px] tracking-[0.12em] text-brand">the cardinal rule</p>
          <h2 className="mt-3 text-[clamp(28px,5vw,52px)] leading-[0.96] tracking-tight">
            it never corrupts your file
          </h2>
          <p className="mt-5 mono text-[13px] leading-relaxed text-muted">
            safety isn't a feature here — it's the architecture. a test suite proves it against a
            real .zshrc on every change.
          </p>
          <div className="mt-6 border border-border bg-bg p-4 mono text-[12.5px]">
            <span className="text-faint">{"// the invariant, enforced by tests"}</span>
            <br />
            serialize(parse(file)) <span className="text-brand">===</span> file{" "}
            <span className="text-faint">{"// byte for byte"}</span>
          </div>
        </Reveal>

        <Reveal>
          <div className="flex flex-col">
            {CHECKS.map((c) => (
              <div key={c.title} className="flex gap-3 border-b border-border py-4 last:border-0">
                <span className="text-brand">✓</span>
                <div>
                  <p className="text-[15px] leading-tight">{c.title}</p>
                  <p className="mt-1 mono text-[12px] leading-relaxed text-muted">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
