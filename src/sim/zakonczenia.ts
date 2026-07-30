/**
 * Ostoja — koniec sprintu i nazwane zakończenia.
 *
 * Pięć lat i koniec. **To jest zegar całej gry**: bez niego usunięcie zużycia
 * (etap 1) zamienia Ostoję w piaskownicę, w której czekanie jest darmowe,
 * a każda kara mierzona czasem przestaje być karą.
 *
 * Zakończenie jest **nazwą, nie liczbą punktów** (zasada 8 z PLAN.md). Jedna
 * liczba zamienia wszystko, czego nie liczy, w dekorację — zwłaszcza las.
 * Nazwane zakończenia mówią dziecku, jaką osadę zbudowało, a nie ile dostało
 * punktów za jej zbudowanie.
 *
 * Można zdobyć kilka naraz i **nie powinno dać się zdobyć wszystkich w jednym
 * przebiegu**. Ta sprzeczność jest celowa: bez niej to lista do odhaczenia,
 * a nie decyzja. Progi siedzą w `dane/stale.json` właśnie po to, żeby dało się
 * ją stroić pomiarem, a nie na oko.
 *
 * Teksty są w `dane/zakonczenia.json`, warunki tutaj — tak samo jak samouczek
 * trzyma teksty w danych, a `SPELNIONE` w kodzie.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type { StanGry } from "./typy.ts";
import { DNI_W_ROKU, DREWNA_Z_DRZEWA } from "./typy.ts";
import type { Dane } from "./budynki.ts";

export type IdZakonczenia =
  | "z-lasem"
  | "ludna"
  | "lubiana-przez-duchy"
  | "zapobiegliwa";

export interface DefinicjaZakonczenia {
  id: IdZakonczenia;
  nazwa: string;
  opis: string;
  /** Co powiedzieć, gdy zakończenia nie zdobyto. Bez morału — sam fakt. */
  gdyBrak: string;
}

// ---------------------------------------------------------------------------
// Koniec sprintu
// ---------------------------------------------------------------------------

/** Który dzień jest ostatnim dniem sprintu. */
export function ostatniDzien(dane: Dane): number {
  return dane.stale.sprint.lat * DNI_W_ROKU;
}

/** Ile dni zostało do końca. Zero, gdy sprint się skończył. */
export function dniDoKonca(stan: StanGry, dane: Dane): number {
  const minelo = stan.czas.rok * DNI_W_ROKU + stan.czas.dzien;
  return Math.max(0, ostatniDzien(dane) - minelo);
}

export function czyKoniecSprintu(stan: StanGry, dane: Dane): boolean {
  return dniDoKonca(stan, dane) <= 0;
}

// ---------------------------------------------------------------------------
// Zakończenia
// ---------------------------------------------------------------------------

/** Ile drzew stoi dziś na mapie, licząc pniaki jako ułamek drzewa. */
export function drzewNaMapie(stan: StanGry): number {
  let suma = 0;
  for (const k of stan.mapa.kafelki) if (k.teren === "las") suma += k.zasob;
  return suma / DREWNA_Z_DRZEWA;
}

/** Ile drzew stało w dniu pierwszym. Bez migawki — tyle, ile teraz. */
export function drzewNaStarcie(stan: StanGry): number {
  if (!stan.borNaStarcie) return drzewNaMapie(stan);
  let suma = 0;
  for (const znak of stan.borNaStarcie) {
    if (znak === ".") continue;
    suma += Number(znak) / 9;
  }
  return suma;
}

export function ilePrzymierzy(stan: StanGry): number {
  return stan.kodeks.filter((wpis) => wpis.startsWith("przymierze-")).length;
}

const WARUNKI: Record<IdZakonczenia, (stan: StanGry, dane: Dane) => boolean> = {
  // Pniaki liczą się jako ułamek drzewa, więc las wycięty i odsadzony do
  // połowy nie udaje pełnego boru.
  "z-lasem": (stan) => drzewNaMapie(stan) >= drzewNaStarcie(stan) - 1e-9,
  ludna: (stan, dane) => stan.mieszkancy.length >= dane.stale.zakonczenia.ludna,
  "lubiana-przez-duchy": (stan, dane) =>
    ilePrzymierzy(stan) >= dane.stale.zakonczenia.przymierza,
  zapobiegliwa: (stan, dane) =>
    stan.zimyZZapasami >= dane.stale.zakonczenia.zimyZZapasami,
};

/** Które zakończenia osada ma zdobyte **w tej chwili**. */
export function zdobyteZakonczenia(stan: StanGry, dane: Dane): IdZakonczenia[] {
  return (Object.keys(WARUNKI) as IdZakonczenia[]).filter((id) =>
    WARUNKI[id](stan, dane),
  );
}

// ---------------------------------------------------------------------------
// Migawka boru
// ---------------------------------------------------------------------------

/**
 * Bór z pierwszego dnia, spakowany po jednym znaku na kafelek: kropka to nie-las,
 * cyfra 0–9 to poziom zalesienia. Zapisujemy go, bo ekran końcowy pokazuje
 * **bór z pierwszego i z ostatniego dnia obok siebie** — jedno spojrzenie mówi
 * dziecku, co zrobiło, bez ani jednego zdania morału.
 */
export function spakujBor(stan: StanGry): string {
  let wynik = "";
  for (const k of stan.mapa.kafelki) {
    if (k.teren !== "las") {
      wynik += ".";
      continue;
    }
    wynik += String(Math.round((k.zasob / DREWNA_Z_DRZEWA) * 9));
  }
  return wynik;
}

/** Bór na dziś, w tym samym formacie co migawka. Do rysowania obok siebie. */
export function borTeraz(stan: StanGry): string {
  return spakujBor(stan);
}
