import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: "./" so the built site works from any static host / subpath (e.g. GitHub Pages).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
});
