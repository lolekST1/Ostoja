/**
 * Ostoja — stopnie osady: Polana, Osada, Gród.
 *
 * Dziś **nic nie blokują**. Awans na stopień jest miarą, nie bramą: narzędzia
 * balansujące pytają „w którym dniu osada weszła na drugi i trzeci stopień",
 * bo bez tej liczby nie da się zobaczyć, czy rozwój rozkłada się na całą sesję,
 * czy kończy się w pierwszym roku. Bramy dostępu do budynków dokłada etap 5
 * z PLAN.md — wtedy ta funkcja zaczyna decydować, a nie tylko opisywać.
 *
 * Warunki są czynami, nie zapasami ani ludnością (zasada 5 z PLAN.md).
 * Jednego czynu jeszcze w grze nie ma: „przeżyta zima **z zapasami**" wymaga
 * decyzji o zapasach na zimę, którą dokłada etap 2. Do tego czasu liczy się
 * sama przeżyta zima — i to jest jedyne miejsce, w którym ten plik jest
 * słabszy od tabeli w PLAN.md.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type { StanGry } from "./typy.ts";

export const STOPNIE = ["polana", "osada", "grod"] as const;
export type Stopien = (typeof STOPNIE)[number];

export const NAZWY_STOPNI: Record<Stopien, string> = {
  polana: "Polana",
  osada: "Osada",
  grod: "Gród",
};

function stoiKapliczka(stan: StanGry): boolean {
  return stan.budynki.some((b) => b.typ === "kapliczka" && b.wybudowany);
}

/** Czy osada ma za sobą choć jedną zimę. Rok zaczyna się wiosną, zima kończy go. */
function przezytychZim(stan: StanGry): number {
  return stan.czas.rok;
}

/** Czy z którymkolwiek duchem zawarto przymierze. Kodeks jest tu źródłem prawdy. */
function jestPrzymierze(stan: StanGry): boolean {
  return stan.kodeks.some((wpis) => wpis.startsWith("przymierze-"));
}

export function stopienOsady(stan: StanGry): Stopien {
  if (jestPrzymierze(stan) && przezytychZim(stan) >= 2) return "grod";
  if (stoiKapliczka(stan) && przezytychZim(stan) >= 1) return "osada";
  return "polana";
}

/** Numer stopnia, 1..3 — do porównań „czy awansował". */
export function numerStopnia(stan: StanGry): number {
  return STOPNIE.indexOf(stopienOsady(stan)) + 1;
}
