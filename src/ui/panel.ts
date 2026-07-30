/**
 * Ostoja — panel zaznaczonego budynku.
 *
 * Pokazuje to, czego z mapy nie widać: ilu ludzi tu pracuje, ile zostało w
 * zasięgu i dlaczego budynek stoi. Pełny rozbiór wąskich gardeł to dopiero
 * krok 5 („gdzie się korkuje"), tu chodzi o jeden budynek pod kursorem.
 *
 * Zwykły HTML (zasada 4). Zmiany stanu idą przez przekazane akcje, panel sam
 * niczego nie przestawia.
 */

import type { Dane } from "../sim/budynki.ts";
import { efektywnaReceptura, pole as polePo } from "../sim/budynki.ts";
import type { Budynek, StanGry, Surowiec, Teren } from "../sim/typy.ts";
import { zasobWZasiegu } from "../sim/swiat.ts";

const NAZWY_SUROWCOW: Record<Surowiec, string> = {
  drewno: "drewno",
  deska: "deski",
  glina: "glina",
  cegla: "cegły",
  zboze: "zboże",
  maka: "mąka",
  jagody: "jagody",
  ryba: "ryby",
  chleb: "chleb",
  opowiesc: "opowieści",
};

const NAZWY_TERENU: Record<Teren, string> = {
  las: "las",
  laka: "łąka",
  glina: "glina",
  woda: "woda",
  skala: "skała",
  ziemia: "ziemia",
};

export interface AkcjePanelu {
  wstrzymaj: (b: Budynek) => void;
  anuluj: (b: Budynek) => void;
  rozbierz: (b: Budynek) => void;
}

function receptura(dane: Dane, stan: StanGry, b: Budynek): string {
  const rec = efektywnaReceptura(dane, stan.ulepszenia, b.typ);
  if (!rec) return "";
  const strona = (k: Record<string, number | undefined>) =>
    Object.entries(k)
      .map(([s, ile]) => `${ile} ${NAZWY_SUROWCOW[s as Surowiec]}`)
      .join(" + ");
  const wejscie = strona(rec.wejscie) || "—";
  return `${wejscie} → ${strona(rec.wyjscie)} (co ${rec.dni === 1 ? "dzień" : `${rec.dni} dni`})`;
}

export function rysujPanel(
  el: HTMLElement,
  stan: StanGry,
  dane: Dane,
  budynek: Budynek | null,
  kafelek: { punkt: { x: number; y: number }; teren: Teren; zasob: number } | null,
  akcje: AkcjePanelu,
): void {
  el.innerHTML = "";

  if (!budynek) {
    el.innerHTML = kafelek
      ? `<h2>${NAZWY_TERENU[kafelek.teren]}</h2>` +
        `<p class="drobne">(${kafelek.punkt.x}, ${kafelek.punkt.y})` +
        (kafelek.zasob > 0 ? ` &middot; zostało ${Math.round(kafelek.zasob)}` : "") +
        `</p>`
      : `<h2>Osada</h2><p class="drobne">Kliknij w budynek, żeby zobaczyć, co się w nim dzieje.</p>`;
    return;
  }

  const def = dane.budynki[budynek.typ];
  const wiersze: string[] = [];

  if (!budynek.wybudowany) {
    wiersze.push(
      `<p>Plac budowy — <b>${Math.round(budynek.postep * 100)}%</b> ` +
        `(${def.dniBudowy} dniówek pracy)</p>`,
    );
    wiersze.push(
      budynek.pracownicy.length > 0
        ? `<p>Buduje <b>${budynek.pracownicy.length}</b> ${budynek.pracownicy.length === 1 ? "osoba" : "osoby"}.</p>`
        : `<p class="uwaga">Czeka w kolejce — najpierw skończy się poprzednia budowa.</p>`,
    );
  } else {
    if (def.miejscaPracy > 0) {
      const brakRak = budynek.pracownicy.length < def.miejscaPracy;
      wiersze.push(
        `<p>Pracuje <b>${budynek.pracownicy.length}</b> z ${def.miejscaPracy}` +
          (brakRak ? ' <span class="uwaga">— brakuje rąk</span>' : "") +
          `</p>`,
      );
      // Ludzie trafiają do budynków w kolejności stawiania. Budynek postawiony
      // późno potrafi nie dostać nikogo i to jest najczęstsze „dlaczego to nie
      // działa" w całej grze.
      if (brakRak) {
        wiersze.push(
          `<p class="drobne">Ludzi dostają najpierw budynki postawione wcześniej. ` +
            `Wstrzymaj któryś z nich, żeby zwolnić ręce.</p>`,
        );
      }
    }

    const rec = receptura(dane, stan, budynek);
    if (rec) wiersze.push(`<p class="drobne">${rec}</p>`);

    if (def.zbiera) {
      const zostalo = zasobWZasiegu(stan, dane, budynek.typ, budynek);
      wiersze.push(
        `<p>W zasięgu: <b>${Math.round(zostalo)}</b> ` +
          (def.wyczerpuje ? NAZWY_SUROWCOW[def.zbiera === "las" ? "drewno" : "glina"] : `kafelków lasu`) +
          `</p>`,
      );
      if (budynek.brakZasobu) {
        wiersze.push(`<p class="uwaga">Nie ma już czego brać w tym kręgu.</p>`);
      }
    }

    // Gajówka nie ma receptury ani zbioru, więc bez tej linijki panel milczy
    // o jedynej rzeczy, którą robi.
    if (budynek.typ === "gajowka") {
      const sadzi = polePo(dane, stan.ulepszenia, "gajowka", "sadziDrzew");
      const mod = dane.stale.moznikiPorRoku?.gajowka?.[stan.czas.pora] ?? 1;
      wiersze.push(
        `<p>Sadzi <b>${(sadzi * mod).toFixed(1)}</b> drzewa dziennie ` +
          `(wiosną podwójnie, zimą nic).</p>`,
      );
      wiersze.push(
        `<p class="drobne">Sadzi w swoim kręgu: najpierw odnawia pniaki, ` +
          `potem zalesia wolną łąkę.</p>`,
      );
    }

    if (budynek.zablokowanyPrzez === "leszy") {
      wiersze.push(`<p class="uwaga">Leszy wstrzymał wyrąb. Sadź drzewa.</p>`);
    }
    if (budynek.typ === "chata") {
      const mieszka = stan.mieszkancy.filter((m) => m.dom === budynek.id).length;
      const miejsc = polePo(dane, stan.ulepszenia, "chata", "mieszkancow");
      wiersze.push(`<p>Mieszka <b>${mieszka}</b> z ${miejsc}.</p>`);
      // Wolne łóżko to zaproszenie dla osadnika, nie pusta liczba — bez tego
      // zdania gracz nie ma skąd wiedzieć, po co stawiać chatę na zapas.
      if (mieszka < miejsc) {
        wiersze.push(
          `<p class="drobne">Wolne miejsce czeka na osadnika. ` +
            `Przyjdzie, gdy w spiżarni będzie dość jedzenia na drogę.</p>`,
        );
      }
    }
    if (budynek.typ === "magazyn") {
      wiersze.push(`<p>Dokłada ${def.pojemnosc} miejsca na każdy surowiec.</p>`);
    }
  }

  el.innerHTML = `<h2>${def.nazwa}</h2>${wiersze.join("")}`;

  const guziki = document.createElement("div");
  guziki.className = "guziki";

  if (budynek.wybudowany) {
    const wstrzymaj = document.createElement("button");
    wstrzymaj.textContent = budynek.wstrzymany ? "Wznów" : "Wstrzymaj";
    wstrzymaj.addEventListener("click", () => akcje.wstrzymaj(budynek));
    guziki.append(wstrzymaj);

    // Rozbiórka na dwa kliknięcia. Jedno wystarczyłoby, żeby dziecko rozebrało
    // młyn, w który włożyło pół roku, zanim zdąży zrozumieć, co nacisnęło.
    const rozbierz = document.createElement("button");
    rozbierz.textContent = "Rozbierz";
    rozbierz.addEventListener("click", () => {
      if (rozbierz.dataset.pewne === "tak") {
        akcje.rozbierz(budynek);
        return;
      }
      rozbierz.dataset.pewne = "tak";
      rozbierz.textContent = "Na pewno? Kliknij jeszcze raz";
      rozbierz.classList.add("ostrzega");
    });
    guziki.append(rozbierz);
  } else {
    const anuluj = document.createElement("button");
    anuluj.textContent = "Zwiń budowę (surowce wracają)";
    anuluj.addEventListener("click", () => akcje.anuluj(budynek));
    guziki.append(anuluj);
  }

  el.append(guziki);
}
