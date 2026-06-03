import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { IconContext } from "@phosphor-icons/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import App from "./App";
import "@fontsource-variable/geist"; // self-hosted Geist Sans (variable)
import "@fontsource-variable/geist-mono"; // self-hosted Geist Mono (variable)
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {/* Phosphor icons: regular weight by default for the calm, hairline aesthetic. */}
      <IconContext.Provider value={{ weight: "regular" }}>
        <TooltipProvider delayDuration={300}>
          <App />
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </IconContext.Provider>
    </ThemeProvider>
  </React.StrictMode>
);
