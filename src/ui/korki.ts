/**
 * Ostoja — panel „gdzie się korkuje".
 *
 * Panel budynku mówi o jednym budynku, ten mówi o całej osadzie: co ją dziś
 * blokuje i którego surowca ubywa szybciej, niż przybywa.
 *
 * Zwykły HTML (zasada 4). Niczego nie liczy — liczby przychodzą gotowe z
 * src/sim/bilans.ts, sprawdzonego narzędziem narzedzia/bilans.ts.
 */

import type { Bilans, Korek } from "../sim/bilans.ts";
import type { Surowiec } from "../sim/typy.ts";

const NAZWY: Record<Surowiec, string> = {
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

/** Ile wierszy pokazać. Dłuższa lista przestaje być listą, a staje się szumem. */
const ILE_KORKOW = 6;

/** Powyżej tylu dni zapasu przestaje to być informacją dla gracza. */
const HORYZONT = 40;

function klasaKorka(k: Korek): string {
  if (k.waga >= 80) return "pilne";
  if (k.waga >= 45) return "wazne";
  return "drobne-korki";
}

function liczba(x: number): string {
  if (Math.abs(x) < 0.05) return "0";
  return (x > 0 ? "+" : "") + x.toFixed(1);
}

function dni(ile: number): string {
  const z = Math.max(1, Math.round(ile));
  return `${z} ${z === 1 ? "dzień" : "dni"}`;
}

export function rysujKorki(
  el: HTMLElement,
  bilans: Bilans,
  naBudynek: (id: string) => void,
): void {
  el.innerHTML = "";

  // --- Lewa strona: co blokuje -------------------------------------------
  const lewa = document.createElement("div");
  lewa.className = "kolumna";
  lewa.innerHTML = "<h3>Gdzie się korkuje</h3>";

  if (bilans.korki.length === 0) {
    lewa.innerHTML += `<p class="drobne">Nic się nie zacięło. Osada pracuje pełną parą.</p>`;
  } else {
    const lista = document.createElement("ul");
    lista.className = "korki";
    for (const k of bilans.korki.slice(0, ILE_KORKOW)) {
      const wiersz = document.createElement("li");
      wiersz.className = klasaKorka(k);
      wiersz.textContent = k.opis;
      // Kliknięcie w wiersz pokazuje winowajcę na mapie — bez tego gracz czyta
      // „Glinianka (3, 25)" i sam szuka jej wzrokiem po całej planszy.
      if (k.budynekId) {
        wiersz.classList.add("klikalny");
        wiersz.addEventListener("click", () => naBudynek(k.budynekId!));
      }
      lista.append(wiersz);
    }
    lewa.append(lista);

    if (bilans.korki.length > ILE_KORKOW) {
      const reszta = document.createElement("p");
      reszta.className = "drobne";
      reszta.textContent = `…i jeszcze ${bilans.korki.length - ILE_KORKOW} drobniejszych.`;
      lewa.append(reszta);
    }
  }

  // Zadowolenie z rozpisanymi powodami. Sama liczba w pasku mówi „ile", ten
  // wiersz mówi „dlaczego" — i to on jest instrukcją, co z tym zrobić.
  const zad = bilans.zadowolenie;
  const powody = zad.skladniki
    .map((s) => `${s.powod} ${s.ile > 0 ? "+" : ""}${s.ile}`)
    .join(", ");
  const stopka = document.createElement("p");
  stopka.className = "drobne";
  stopka.textContent =
    `Zadowolenie ${Math.round(zad.teraz)}` +
    (Math.abs(zad.cel - zad.teraz) > 0.5
      ? ` (idzie do ${Math.round(zad.cel)})`
      : "") +
    (powody ? `: ${powody}.` : ".");
  lewa.append(stopka);

  // --- Prawa strona: bilans dzienny ---------------------------------------
  const prawa = document.createElement("div");
  prawa.className = "kolumna";
  prawa.innerHTML = "<h3>Na dzień</h3>";

  // Następny osadnik nad tabelą, bo to jedyna rzecz, na którą schodzi jedzenie,
  // i jedyny powód, dla którego cała ta tabela ma znaczenie.
  const o = bilans.osadnik;
  const wiersz = document.createElement("p");
  wiersz.className = `osadnik${o.blokada ? " czeka" : ""}`;
  wiersz.textContent =
    `Następny osadnik: ${Math.ceil(o.koszt)} jedzenia — ` +
    (o.blokada === "dach"
      ? "czeka na wolne miejsce w chacie."
      : o.blokada === "jedzenie"
        ? `w spiżarni ${Math.floor(o.zapas)}, brakuje ${Math.ceil(o.koszt - o.zapas)}.`
        : o.blokada === "zadowolenie"
          ? "nikt nie chce tu przyjść."
          : `przyjdzie za ${dni(o.dniDoPrzybycia ?? 1)}.`);
  prawa.append(wiersz);

  // Surowce, których nie ma i nikt ich nie rusza, tylko zaśmiecałyby tabelę.
  const widoczne = bilans.surowce.filter(
    (p) => p.zapas > 0.5 || p.przychod > 0.05 || p.rozchod > 0.05,
  );

  if (widoczne.length === 0) {
    prawa.innerHTML += `<p class="drobne">Pusto w magazynie.</p>`;
  } else {
    const tabela = document.createElement("table");
    tabela.className = "bilans";
    tabela.innerHTML =
      "<thead><tr><th>surowiec</th><th>zapas</th><th>przybywa</th>" +
      "<th>ubywa</th><th>na dzień</th><th></th></tr></thead>";
    const ciało = document.createElement("tbody");

    for (const p of widoczne) {
      const wiersz = document.createElement("tr");
      const kierunek = p.netto < -0.05 ? "spada" : p.netto > 0.05 ? "rosnie" : "";

      // „Starczy na 100 dni" to nie informacja, tylko szum — sesja trwa pięć
      // lat po 96 dni, więc dopiero kilka tygodni zapasu znaczy cokolwiek.
      let uwaga = "";
      if (p.dniDoZera !== null && p.dniDoZera <= HORYZONT) {
        uwaga = `starczy na ${dni(p.dniDoZera)}`;
      } else if (p.dniDoPelna !== null && p.dniDoPelna <= HORYZONT) {
        uwaga = `magazyn pełny za ${dni(p.dniDoPelna)}`;
      }

      wiersz.innerHTML =
        `<td>${NAZWY[p.surowiec]}</td>` +
        `<td class="liczba">${Math.floor(p.zapas)}</td>` +
        `<td class="liczba dodatnie">${p.przychod > 0.05 ? p.przychod.toFixed(1) : "—"}</td>` +
        `<td class="liczba ujemne">${p.rozchod > 0.05 ? p.rozchod.toFixed(1) : "—"}</td>` +
        `<td class="liczba ${kierunek}">${liczba(p.netto)}</td>` +
        `<td class="drobne">${uwaga}</td>`;
      ciało.append(wiersz);
    }

    tabela.append(ciało);
    prawa.append(tabela);
  }

  if (bilans.nieobsadzoneMiejsca > 0) {
    const stopka = document.createElement("p");
    stopka.className = "drobne";
    stopka.textContent =
      `Nieobsadzonych miejsc pracy: ${bilans.nieobsadzoneMiejsca}. ` +
      `Ludzi dostają najpierw budynki postawione wcześniej.`;
    prawa.append(stopka);
  }

  el.append(lewa, prawa);
}
