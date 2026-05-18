import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client/src"),
    },
  },
  root: path.resolve(process.cwd(), "client"),
  publicDir: path.resolve(process.cwd(), "client/public"),
  build: {
    outDir: path.resolve(process.cwd(), "dist"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: ["all"],
  },
});
