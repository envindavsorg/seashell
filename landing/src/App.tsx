import { useTheme } from "./hooks/useTheme";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Safety } from "./components/Safety";
import { Shortcuts } from "./components/Shortcuts";
import { Download } from "./components/Download";
import { Footer } from "./components/Footer";

export default function App() {
  const { theme, toggle } = useTheme();
  return (
    <>
      <Nav theme={theme} onToggle={toggle} />
      <main>
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
