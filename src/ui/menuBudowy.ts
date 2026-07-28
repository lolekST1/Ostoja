/**
 * Ostoja — menu budowy.
 *
 * Lista budynków z kosztem i krótkim „po co to jest". Nie sprawdza miejsca na
 * mapie (od tego jest mozliwaBudowa), tylko czy w ogóle stać, i wybiera typ do
 * postawienia.
 *
 * Zwykły HTML (zasada 4).
 */

import type { Dane } from "../sim/budynki.ts";
import type { StanGry, Surowiec, TypBudynku } from "../sim/typy.ts";
import { TYPY_BUDYNKOW } from "../sim/typy.ts";
import { brakujeNa, stacNa } from "../sim/budowa.ts";

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

/**
 * Jedno zdanie na budynek: co robi i czego potrzebuje, żeby robić. Dziecko ma
 * to przeczytać raz i zrozumieć, a nie odkrywać eksperymentem, że młyn bez
 * zboża stoi pusty.
 */
const PO_CO: Record<TypBudynku, string> = {
  chata: "Dach dla czterech osób. Wolne miejsce ściąga przybyszów.",
  magazyn: "Więcej miejsca w spiżarni. Nadwyżka ponad limit przepada.",
  kapliczka: "Miska dla domowika. Bez niej z magazynu znika po trochu każdego dnia.",
  lesniczowka: "Ścina drzewa w swoim kręgu. Postaw ją w lesie, nie obok lasu.",
  gajowka: "Sadzi drzewa w swoim kręgu. Jedna równoważy dwie leśniczówki.",
  zbieracze: "Jagody z lasu. Karmią słabo, ale od pierwszego dnia i bez zapasu.",
  tartak: "Zamienia drewno w deski. Bez desek nic nie postawisz.",
  glinianka: "Kopie glinę ze złoża w kręgu. Złoże się wyczerpuje.",
  cegielnia: "Wypala cegły z gliny i drewna. Cegły są tylko na młyn, piekarnię i kapliczkę.",
  pole: "Zboże raz w roku, w żniwa. Poza jesienią rolnik chodzi na budowy.",
  mlyn: "Mieli zboże na mąkę.",
  piekarnia: "Piecze chleb z mąki i drewna. Chleb, w odróżnieniu od jagód, leży do zimy.",
  bajarz: "Zamienia chleb w opowieści, a opowieści w ulepszenia. Dziś nie daje nic.",
};

export interface Menu {
  /** Wołane po każdym dniu. Przebudowa całej listy co dwie sekundy migałaby
   *  i gubiła to, na czym stoi kursor — zmieniamy więc tylko to, co się zmienia. */
  odswiez: (stan: StanGry, wybrany: TypBudynku | null) => void;
}

function opisKosztu(dane: Dane, typ: TypBudynku): string {
  return Object.entries(dane.budynki[typ].koszt)
    .map(([s, ile]) => `${ile} ${NAZWY_SUROWCOW[s as Surowiec]}`)
    .join(" + ");
}

export function utworzMenuBudowy(
  el: HTMLElement,
  dane: Dane,
  naWybor: (typ: TypBudynku | null) => void,
): Menu {
  el.innerHTML = "<h2>Budowa</h2>";

  const lista = document.createElement("div");
  lista.className = "lista-budowy";
  const guziki = new Map<TypBudynku, { guzik: HTMLButtonElement; brak: HTMLElement }>();

  for (const typ of TYPY_BUDYNKOW) {
    const def = dane.budynki[typ];

    const guzik = document.createElement("button");
    guzik.className = "budynek";
    guzik.title = PO_CO[typ];
    guzik.innerHTML =
      `<span class="nazwa">${def.nazwa}</span>` +
      `<span class="koszt">${opisKosztu(dane, typ)}</span>` +
      `<span class="po-co">${PO_CO[typ]}</span>` +
      `<span class="brak"></span>`;

    guzik.addEventListener("click", () => {
      naWybor(guzik.classList.contains("wybrany") ? null : typ);
    });

    guziki.set(typ, { guzik, brak: guzik.querySelector(".brak")! });
    lista.append(guzik);
  }

  el.append(lista);

  return {
    odswiez(stan, wybrany) {
      for (const [typ, { guzik, brak }] of guziki) {
        const mozna = stacNa(stan, dane, typ);
        guzik.disabled = !mozna;
        guzik.classList.toggle("wybrany", wybrany === typ);
        brak.textContent = mozna
          ? ""
          : `brakuje: ${brakujeNa(stan, dane, typ)
              .map((s) => NAZWY_SUROWCOW[s])
              .join(", ")}`;
      }
    },
  };
}
