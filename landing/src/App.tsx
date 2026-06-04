import { Download } from "./components/Download";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Nav } from "./components/Nav";
import { Safety } from "./components/Safety";
import { Shortcuts } from "./components/Shortcuts";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const { theme, toggle } = useTheme();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:border focus:border-border focus:bg-bg focus:px-3 focus:py-2 focus:text-fg"
      >
        skip to content
      </a>
      <Nav theme={theme} onToggle={toggle} />
      <main id="main">
        <Hero />
        <Features />
        <Safety />
        <Shortcuts />
        <Download />
      </main>
      <Footer />
    </>
  );
}
