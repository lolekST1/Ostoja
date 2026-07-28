/**
 * Ostoja — zapis w przeglądarce.
 *
 * Cała wiedza o localStorage siedzi tutaj, a nie w src/sim/stan.ts, bo symulacja
 * musi dać się uruchomić w Node (narzędzia balansujące), gdzie localStorage nie
 * istnieje. Tu wolno dotykać przeglądarki.
 */

import type { StanGry } from "./sim/typy.ts";
import { doTekstu, zTekstu } from "./sim/stan.ts";
import type { WynikOdczytu } from "./sim/stan.ts";

const KLUCZ = "ostoja:zapis";

export function zapiszGre(stan: StanGry): { ok: true } | { ok: false; powod: string } {
  try {
    localStorage.setItem(KLUCZ, doTekstu(stan));
    return { ok: true };
  } catch (blad) {
    // Najczęstszy powód to przepełniony localStorage albo tryb prywatny.
    return { ok: false, powod: `nie udało się zapisać (${(blad as Error).message})` };
  }
}

export function wczytajGre(): WynikOdczytu | null {
  const tekst = localStorage.getItem(KLUCZ);
  if (tekst === null) return null;
  return zTekstu(tekst);
}

export function czyJestZapis(): boolean {
  return localStorage.getItem(KLUCZ) !== null;
}

export function skasujZapis(): void {
  localStorage.removeItem(KLUCZ);
}
