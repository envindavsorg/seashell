import { REPO } from "../config";

export function Nav({ theme, onToggle }: { theme: "dark" | "light"; onToggle: () => void }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[940px] items-center gap-6 px-6">
        <a href="#top" className="flex items-center gap-2 text-[17px]">
          <span className="inline-block h-3 w-3 bg-brand" aria-hidden />
          seashell
        </a>
        <div className="ml-2 hidden gap-5 font-mono text-[12px] text-muted sm:flex">
          <a href="#features" className="hover:text-fg">
            features
          </a>
          <a href="#safety" className="hover:text-fg">
            safety
          </a>
          <a href="#download" className="hover:text-fg">
            download
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label="toggle theme"
            className="grid h-8 w-8 place-items-center border border-border text-muted hover:text-fg"
          >
            {theme === "dark" ? "◐" : "◑"}
          </button>
          <a
            href={REPO}
            className="hidden h-8 items-center border border-border px-3 font-mono text-[12px] text-muted hover:text-fg sm:flex"
          >
            github ↗
          </a>
          <a
            href="#download"
            className="flex h-8 items-center bg-brand px-3 text-[13px] text-bg hover:opacity-90"
          >
            download
          </a>
        </div>
      </div>
    </nav>
  );
}
