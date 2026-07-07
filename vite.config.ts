import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => ({
  // Served from https://thelbertd.github.io/madeea-hub/ in production,
  // but from root during local dev.
  base: command === "build" ? "/madeea-hub/" : "/",
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
