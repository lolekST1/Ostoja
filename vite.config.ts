import { defineConfig } from "vite";

// Symulacja (src/sim) to czysty TypeScript bez Phasera i Vite o niej nie musi
// nic wiedziec. Ta konfiguracja obsluguje tylko warstwe przegladarki.
export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
