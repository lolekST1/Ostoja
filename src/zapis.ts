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
const KLUCZ_SAMOUCZKA = "ostoja:samouczek";

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

/**
 * Postęp samouczka trzymamy osobno od zapisu gry. To nie jest stan osady, tylko
 * to, ile gracz już wie — i ma przeżyć „Nową osadę", żeby dziecko zaczynające
 * od nowa nie przeklikiwało tych samych siedmiu okienek.
 */
export function krokSamouczka(): number {
  const zapisany = Number(localStorage.getItem(KLUCZ_SAMOUCZKA));
  return Number.isFinite(zapisany) && zapisany > 0 ? zapisany : 0;
}

export function zapamietajKrokSamouczka(krok: number): void {
  try {
    localStorage.setItem(KLUCZ_SAMOUCZKA, String(krok));
  } catch {
    // Tryb prywatny albo pełny magazyn. Samouczek pokaże się ponownie i tyle.
  }
}
