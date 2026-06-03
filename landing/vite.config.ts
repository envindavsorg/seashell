import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base: "./" so the built site works from any static host / subpath (e.g. GitHub Pages).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
});
