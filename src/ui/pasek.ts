/**
 * Ostoja — pasek u góry: czas, ludzie, surowce.
 *
 * Zwykły HTML nałożony na canvas (zasada 4). Nie zmienia stanu gry, tylko go
 * pokazuje.
 */

import type { Dane } from "../sim/budynki.ts";
import type { StanGry, Surowiec } from "../sim/typy.ts";
import { DNI_W_PORZE, PROG_ODEJSCIA, SUROWCE } from "../sim/typy.ts";
import { WIEK_DOROSLOSCI } from "../sim/tick.ts";

const NAZWY_SUROWCOW: Record<Surowiec, string> = {
  drewno: "drewno",
  deska: "deski",
  glina: "glina",
  cegla: "cegły",
  zboze: "zboże",
  maka: "mąka",
  jagody: "jagody",
  chleb: "chleb",
  opowiesc: "opowieści",
};

const NAZWY_POR: Record<string, string> = {
  wiosna: "wiosna",
  lato: "lato",
  jesien: "jesień",
  zima: "zima",
};

/** Surowce, których nie chowamy przy zerze — ich brak jest informacją. */
const ZAWSZE_WIDOCZNE: Surowiec[] = ["drewno", "deska", "jagody", "chleb"];

export function rysujPasek(el: HTMLElement, stan: StanGry, _dane: Dane): void {
  const dorosli = stan.mieszkancy.filter((m) => m.wiek >= WIEK_DOROSLOSCI).length;
  const budowniczych = stan.mieszkancy.filter((m) => {
    const b = stan.budynki.find((x) => x.id === m.miejscePracy);
    return b !== undefined && !b.wybudowany;
  }).length;
  const place = stan.budynki.filter((b) => !b.wybudowany).length;

  const surowce = SUROWCE.filter(
    (s) => stan.pula[s] > 0.5 || ZAWSZE_WIDOCZNE.includes(s),
  )
    .map((s) => {
      const ile = Math.floor(stan.pula[s]);
      // Pełny magazyn oznacza, że nadwyżka przepada — to musi kłuć w oczy.
      const pelny = s !== "opowiesc" && ile >= stan.pojemnosc;
      return `<span class="surowiec${pelny ? " pelny" : ""}"><b>${ile}</b> ${NAZWY_SUROWCOW[s]}</span>`;
    })
    .join("");

  // Głód i zimno liczą się w tick.ts tym samym licznikiem, więc ostrzeżenie
  // też jest jedno. Ważne jest to, ile dni zostało do odejścia — bez tej liczby
  // gracz dowiaduje się o kłopocie dopiero wtedy, gdy ludzi już nie ma.
  const wPotrzebie = stan.mieszkancy.filter((m) => m.glod > 0);
  const najgorszy = wPotrzebie.reduce((n, m) => Math.max(n, m.glod), 0);
  const alarm =
    wPotrzebie.length > 0
      ? `<span class="alarm">${wPotrzebie.length} osób bez jedzenia lub opału — ` +
        `odejdą za ${Math.max(1, PROG_ODEJSCIA - najgorszy + 1)} dni</span>`
      : "";

  el.innerHTML =
    `<span class="czas">rok ${stan.czas.rok + 1} &middot; ${NAZWY_POR[stan.czas.pora]} ` +
    `&middot; dzień ${(stan.czas.dzien % DNI_W_PORZE) + 1}</span>` +
    `<span class="ludzie">${stan.mieszkancy.length} mieszkańców ` +
    `(${dorosli} do pracy${place > 0 ? `, ${budowniczych} na budowie` : ""})</span>` +
    `<span class="magazyn">magazyn ${stan.pojemnosc}</span>` +
    alarm +
    `<span class="surowce">${surowce}</span>`;
}
