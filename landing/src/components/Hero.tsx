import { RELEASES, REPO } from "../config";
import { Reveal } from "./Reveal";

const banner = `${import.meta.env.BASE_URL}banner.png`;

export function Hero() {
  return (
    <header id="top" className="mx-auto w-full max-w-[940px] px-6 pt-20 pb-10 text-center">
      <span className="mb-7 inline-flex items-center gap-2 border border-border bg-surface px-3 py-1 font-mono text-[11px] text-muted">
        <span className="inline-block h-1.5 w-1.5 bg-brand" /> open source · macos · built with tauri
      </span>

      <h1 className="mx-auto max-w-[16ch] text-[clamp(38px,8vw,76px)] leading-[0.95] tracking-tight">
        a visual editor for your <span className="text-brand">.zshrc</span>
      </h1>

      <p className="mx-auto mt-7 max-w-[52ch] font-mono text-[13.5px] leading-relaxed text-muted">
        structured controls on the left, your real file live on the right, and a diff before anything
        touches disk. it never corrupts your config.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <a href={RELEASES} className="flex h-11 items-center gap-2 bg-brand px-5 text-[15px] text-bg hover:opacity-90">
          ↓ download for macos
        </a>
        <a href={REPO} className="flex h-11 items-center gap-2 border border-border bg-surface px-5 text-[15px] hover:border-muted">
          github ↗
        </a>
      </div>
      <p className="mt-4 font-mono text-[11px] text-faint">free &amp; open source · apple silicon &amp; intel</p>

      <Reveal className="mt-14">
        <img
          src={banner}
          alt="seashell — a visual editor for your .zshrc"
          className="mx-auto block w-full max-w-[840px] border border-border"
        />
      </Reveal>
    </header>
  );
}
