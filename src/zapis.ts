/**
 * Ostoja — zapis w przeglądarce.
 *
 * Cała wiedza o localStorage siedzi tutaj, a nie w src/sim/stan.ts, bo symulacja
 * musi dać się uruchomić w Node (narzędzia balansujące), gdzie localStorage nie
 * istnieje. Tu wolno dotykać przeglądarki.
 */

import type { StanGry } from "./sim/typy.ts";
import type { StanKrainy } from "./sim/kraina.ts";
import { WERSJA_KRAINY } from "./sim/kraina.ts";
import { doTekstu, zTekstu } from "./sim/stan.ts";
import type { WynikOdczytu } from "./sim/stan.ts";

const KLUCZ = "ostoja:zapis";
const KLUCZ_SAMOUCZKA = "ostoja:samouczek";
const KLUCZ_KRAINY = "ostoja:kraina";

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

/**
 * Stan krainy żyje w osobnym kluczu, tak samo jak postęp samouczka. Inaczej
 * „Nowa osada" skasowałaby całą kampanię — a tego się potem nie odkręci.
 * Osada jest jedną mapą i wolno ją zacząć od nowa; droga przez pięć miejsc nie.
 */
export function wczytajKraine(): StanKrainy | null {
  const tekst = localStorage.getItem(KLUCZ_KRAINY);
  if (tekst === null) return null;
  try {
    const stan = JSON.parse(tekst) as StanKrainy;
    // Zapis z przyszłej wersji odrzucamy w całości, zamiast wczytywać po
    // kawałku: pół kampanii jest gorsze niż jej brak, bo wygląda jak błąd gry.
    if (stan.wersja !== WERSJA_KRAINY) return null;
    return stan;
  } catch {
    return null;
  }
}

export function zapiszKraine(stan: StanKrainy): void {
  try {
    localStorage.setItem(KLUCZ_KRAINY, JSON.stringify(stan));
  } catch {
    // Tryb prywatny albo pełny magazyn. Kampania nie przeżyje odświeżenia
    // i tyle — gra działa dalej, bo osada zapisuje się osobno.
  }
}

export function skasujKraine(): void {
  localStorage.removeItem(KLUCZ_KRAINY);
}
