/**
 * Ostoja — stopnie osady: Polana, Osada, Gród.
 *
 * Od etapu 5 stopień **decyduje, a nie tylko opisuje**: rozkłada trzynaście
 * budynków na całą sesję zamiast wykładać je wszystkie w dniu pierwszym.
 * Jest przy tym nadal miarą — narzędzia balansujące pytają „w którym dniu
 * osada weszła na drugi i trzeci stopień", bo bez tej liczby nie widać, czy
 * rozwój rozkłada się na całą sesję, czy kończy w pierwszym roku.
 *
 * Warunki są czynami, nie zapasami ani ludnością (zasada 5 z PLAN.md) i od
 * etapu 2 wszystkie trzy są prawdziwe: „przeżyta zima z zapasami" liczy zimy
 * faktycznie przezimowane, nie sam upływ kalendarza.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type { Stopien, StanGry, TypBudynku } from "./typy.ts";
import type { Dane } from "./budynki.ts";

export const STOPNIE = ["polana", "osada", "grod"] as const;
export type { Stopien };

export const NAZWY_STOPNI: Record<Stopien, string> = {
  polana: "Polana",
  osada: "Osada",
  grod: "Gród",
};

function stoiKapliczka(stan: StanGry): boolean {
  return stan.budynki.some((b) => b.typ === "kapliczka" && b.wybudowany);
}

/** Czy z którymkolwiek duchem zawarto przymierze. Kodeks jest tu źródłem prawdy. */
function jestPrzymierze(stan: StanGry): boolean {
  return stan.kodeks.some((wpis) => wpis.startsWith("przymierze-"));
}

export function stopienOsady(stan: StanGry): Stopien {
  if (jestPrzymierze(stan) && stan.zimyZZapasami >= 2) return "grod";
  if (stoiKapliczka(stan) && stan.zimyZZapasami >= 1) return "osada";
  return "polana";
}

/** Numer stopnia, 1..3 — do porównań „czy awansował". */
export function numerStopnia(stan: StanGry): number {
  return STOPNIE.indexOf(stopienOsady(stan)) + 1;
}

/**
 * Czego brakuje do następnego stopnia. Pusta lista znaczy „już go masz" albo
 * „dalej nie ma dokąd". Panel ma to wypisać wprost — brama, o której gracz nie
 * wie, jest karą, nie celem.
 */
export function czegoBrakujeDoNastepnego(stan: StanGry): string[] {
  const teraz = stopienOsady(stan);
  if (teraz === "grod") return [];

  const brakuje: string[] = [];
  if (teraz === "polana") {
    if (!stoiKapliczka(stan)) brakuje.push("kapliczka");
    if (stan.zimyZZapasami < 1) brakuje.push("przeżyta zima z zapasami");
  } else {
    if (!jestPrzymierze(stan)) brakuje.push("przymierze z duchem");
    if (stan.zimyZZapasami < 2) {
      brakuje.push(`druga zima z zapasami (masz ${stan.zimyZZapasami})`);
    }
  }
  return brakuje;
}

/** Jak nazywa się stopień, którego osada jeszcze nie ma. */
export function nastepnyStopien(stan: StanGry): Stopien | null {
  const teraz = STOPNIE.indexOf(stopienOsady(stan));
  return teraz + 1 < STOPNIE.length ? STOPNIE[teraz + 1] : null;
}

/**
 * Czy wolno dziś postawić ten budynek. Stopnie rozkładają trzynaście budynków
 * na całą sesję zamiast wykładać je wszystkie w dniu pierwszym.
 *
 * Kolejność stopni jest sprawdzona po **grafie kosztów**, nie na oko (zasada 4
 * z PLAN.md): każdy stopień musi dać się przejść z tego, co sam produkuje.
 * Dlatego kapliczka kosztuje deski i drewno, a nie cegły — jest warunkiem
 * awansu na Osadę, a cegielnia stoi dopiero za tą bramą, więc cegły zamykały
 * drzwi, które sama miała otwierać.
 */
export function budynekDostepny(
  stan: StanGry,
  dane: Dane,
  typ: TypBudynku,
): boolean {
  const potrzebny = STOPNIE.indexOf(dane.budynki[typ].stopien);
  // Brak stopnia w budynki.json otwierał **wszystko od pierwszego dnia** i nie
  // mówił o tym ani słowa: indexOf(undefined) to −1, czyli „poniżej Polany".
  // Cichy brak bramy wygląda w pomiarach jak hojna ekonomia, więc krzyczymy.
  if (potrzebny < 0) {
    throw new Error(`budynek ${typ} nie ma stopnia w dane/budynki.json`);
  }
  return potrzebny <= STOPNIE.indexOf(stopienOsady(stan));
}
