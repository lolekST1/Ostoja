/**
 * Ostoja — punkt wejscia warstwy przegladarki.
 *
 * Na razie tylko szkielet. Zgodnie z kolejnoscia prac z OSTOJA.md scena Phasera
 * (render/scenaGry.ts) wchodzi dopiero po mapie i zapisie stanu. Do tego czasu
 * ten plik trzyma strukture strony i potwierdza, ze projekt sie buduje.
 *
 * Warstwa symulacji (src/sim) jest celowo niezalezna od tego pliku i od Phasera.
 */

const gra = document.querySelector<HTMLDivElement>("#gra");
if (gra) {
  gra.textContent =
    "Ostoja — szkielet projektu. Logika gry powstaje wg OSTOJA.md.";
}

export {};
