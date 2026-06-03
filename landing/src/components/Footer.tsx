import { REPO } from "../config";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-[940px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-8 mono text-[12px] text-muted">
        <a href="#top" className="flex items-center gap-2 text-fg">
          <span className="inline-block h-2.5 w-2.5 bg-brand" /> seashell
        </a>
        <span className="ml-auto flex flex-wrap gap-x-5 gap-y-2">
          <a href={REPO} className="hover:text-fg">
            github
          </a>
          <a href="https://tauri.app" className="hover:text-fg">
            built with tauri
          </a>
          <span className="text-faint">© {new Date().getFullYear()} cuzeac florin · mit</span>
        </span>
      </div>
    </footer>
  );
}
