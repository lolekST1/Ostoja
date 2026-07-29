import { defineConfig } from "vite";

// Symulacja (src/sim) to czysty TypeScript bez Phasera i Vite o niej nie musi
// nic wiedziec. Ta konfiguracja obsluguje tylko warstwe przegladarki.
// GitHub Pages serwuje projekt z podkatalogu (/Ostoja/), a nie z korzenia
// domeny — bez tego przeglądarka szuka skryptu pod złym adresem i widać białą
// stronę. Lokalnie zmiennej nie ma i wszystko idzie z korzenia jak dotąd.
const podkatalog = process.env.GITHUB_PAGES ? "/Ostoja/" : "/";

export default defineConfig({
  base: podkatalog,
  root: ".",
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
