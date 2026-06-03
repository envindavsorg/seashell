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
