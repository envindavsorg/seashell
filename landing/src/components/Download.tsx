import { RELEASES, REPO } from "../config";
import { Reveal } from "./Reveal";

const logo = `${import.meta.env.BASE_URL}icon.png`;

export function Download() {
  return (
    <section id="download" className="border-t border-border">
      <div className="mx-auto w-full max-w-[940px] px-6 py-24">
        <Reveal>
          <div className="mx-auto max-w-[560px] border border-border bg-surface p-10 text-center">
            <img src={logo} alt="seashell logo" className="mx-auto mb-5 h-14 w-14 object-contain" />
            <h2 className="text-[clamp(24px,4vw,34px)] leading-tight tracking-tight">
              get seashell
            </h2>
            <p className="mt-3 mono text-[12.5px] text-muted">
              free &amp; open source · macos (apple silicon &amp; intel)
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a
                href={RELEASES}
                className="flex h-11 items-center gap-2 bg-brand px-5 text-[15px] text-bg hover:opacity-90"
              >
                ↓ download .dmg
              </a>
              <a
                href={REPO}
                className="flex h-11 items-center border border-border px-5 text-[15px] hover:border-muted"
              >
                source &amp; docs
              </a>
            </div>

            <div className="mt-8 text-left">
              <p className="mb-2 mono text-[10.5px] tracking-[0.08em] text-faint">
                …or build it yourself
              </p>
              <pre className="overflow-x-auto border border-border bg-bg p-4 text-[12px] leading-relaxed text-muted">
                <span className="text-faint"># requires rust, node ≥ 20 and pnpm</span>
                {"\n"}git clone {REPO}.git{"\n"}cd seashell && pnpm install{"\n"}
                <span className="text-brand">pnpm tauri build</span>
              </pre>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
