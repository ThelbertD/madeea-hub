import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => ({
  // Base path depends on the host:
  //  - Vercel serves from the domain root → "/"  (Vercel sets process.env.VERCEL)
  //  - GitHub Pages serves from /madeea-hub/ → project-page subpath
  //  - local dev → "/"
  base: process.env.VERCEL ? "/" : command === "build" ? "/madeea-hub/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
}));
