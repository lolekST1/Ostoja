/**
 * Ostoja — pasek u góry: czas, ludzie, surowce.
 *
 * Zwykły HTML nałożony na canvas (zasada 4). Nie zmienia stanu gry, tylko go
 * pokazuje.
 */

import type { Dane } from "../sim/budynki.ts";
import type { StanGry, Surowiec } from "../sim/typy.ts";
import { DNI_W_PORZE, SUROWCE } from "../sim/typy.ts";
import { WIEK_DOROSLOSCI, stanOsadnika } from "../sim/osada.ts";

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

/**
 * Zadowolenie w trzech progach. Liczba bez koloru nic dziecku nie mówi, a pasek
 * jest jedynym miejscem, w którym tę wartość widać przez cały czas.
 */
function klasaZadowolenia(ile: number): string {
  if (ile >= 60) return "dobre";
  if (ile >= 30) return "srednie";
  return "zle";
}

export function rysujPasek(el: HTMLElement, stan: StanGry, dane: Dane): void {
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

  // Zadowolenie od pierwszej sekundy, bo to ono decyduje o tempie, w jakim
  // osada rośnie — a wzrost jest w tej grze jedyną nagrodą i jedynym zegarem.
  const zadowolenie =
    `<span class="zadowolenie ${klasaZadowolenia(stan.zadowolenie)}">` +
    `zadowolenie <b>${Math.round(stan.zadowolenie)}</b></span>`;

  // „Następny osadnik: N jedzenia, za M dni" — koszt widoczny, zanim zablokuje.
  const osadnik = stanOsadnika(stan, dane);
  const czekaNa =
    osadnik.blokada === "dach"
      ? "brakuje miejsca w chacie"
      : osadnik.blokada === "jedzenie"
        ? `brakuje ${Math.ceil(osadnik.koszt - osadnik.zapas)}`
        : osadnik.blokada === "zadowolenie"
          ? "nikt nie chce przyjść"
          : `za ${osadnik.dniDoPrzybycia} dni`;
  const wiesc =
    `<span class="osadnik${osadnik.blokada ? " czeka" : ""}">` +
    `następny osadnik: <b>${Math.ceil(osadnik.koszt)}</b> jedzenia &middot; ${czekaNa}</span>`;

  el.innerHTML =
    `<span class="czas">rok ${stan.czas.rok + 1} &middot; ${NAZWY_POR[stan.czas.pora]} ` +
    `&middot; dzień ${(stan.czas.dzien % DNI_W_PORZE) + 1}</span>` +
    `<span class="ludzie">${stan.mieszkancy.length} mieszkańców ` +
    `(${dorosli} do pracy${place > 0 ? `, ${budowniczych} na budowie` : ""})</span>` +
    zadowolenie +
    wiesc +
    `<span class="magazyn">magazyn ${stan.pojemnosc}</span>` +
    `<span class="surowce">${surowce}</span>`;
}
