/**
 * Ostoja — samouczek.
 *
 * Prowadzi przez pierwsze kilka minut: jedzenie, opał, ruszenie czasu, panel
 * i gajówka. Potem znika i nie wraca.
 *
 * Zasada 6 obowiązuje tak samo tu, jak w Kodeksie: samouczek **niczego nie
 * pyta**. Krok zamyka się albo zwykłym „dalej", albo tym, że gracz naprawdę
 * zrobił rzecz, o której mowa — sprawdzamy stan gry, nie odpowiedź.
 *
 * Zwykły HTML (zasada 4). Nie zmienia stanu gry, tylko go czyta.
 */

import type { StanGry } from "../sim/typy.ts";

export interface KrokSamouczka {
  id: string;
  tytul: string;
  tekst: string;
  wskazowka?: string;
  /** Napis na guziku, gdy krok zamyka się ręcznie. Brak = czekamy na czyn. */
  dalej?: string;
}

export interface Samouczek {
  /** Woływane po każdej zmianie stanu — sprawdza, czy krok się domknął. */
  odswiez: (stan: StanGry) => void;
  czyTrwa: () => boolean;
  odNowa: () => void;
}

/**
 * Czy krok jest już zrobiony. Klucz to id kroku z dane/samouczek.json.
 * Kroki bez wpisu zamykają się guzikiem, nie czynem.
 *
 * Plac budowy liczy się tak samo jak gotowy budynek: dziecko zrobiło swoje
 * w chwili, gdy kliknęło w mapę, a nie po ośmiu dniówkach pracy.
 */
const SPELNIONE: Record<string, (stan: StanGry) => boolean> = {
  jedzenie: (stan) => stan.budynki.some((b) => b.typ === "zbieracze"),
  opal: (stan) => stan.budynki.some((b) => b.typ === "lesniczowka"),
  czas: (stan) => stan.predkosc > 0,
  gajowka: (stan) => stan.budynki.some((b) => b.typ === "gajowka"),
};

export function utworzSamouczek(
  el: HTMLElement,
  kroki: KrokSamouczka[],
  zapamietaj: (krok: number) => void,
  odKroku: number,
): Samouczek {
  let biezacy = odKroku;

  function rysuj(): void {
    if (biezacy >= kroki.length) {
      el.classList.remove("widoczny");
      el.innerHTML = "";
      return;
    }

    const krok = kroki[biezacy];
    el.classList.add("widoczny");
    el.innerHTML = "";

    const naglowek = document.createElement("div");
    naglowek.className = "samouczek-naglowek";
    naglowek.innerHTML =
      `<h3>${krok.tytul}</h3>` +
      `<span class="licznik">${biezacy + 1} z ${kroki.length}</span>`;

    const tresc = document.createElement("p");
    tresc.textContent = krok.tekst;

    el.append(naglowek, tresc);

    if (krok.wskazowka) {
      const w = document.createElement("p");
      w.className = "wskazowka";
      w.textContent = krok.wskazowka;
      el.append(w);
    }

    const guziki = document.createElement("div");
    guziki.className = "samouczek-guziki";

    if (krok.dalej) {
      const dalej = document.createElement("button");
      dalej.textContent = krok.dalej;
      dalej.addEventListener("click", () => nastepny());
      guziki.append(dalej);
    } else {
      const czekam = document.createElement("span");
      czekam.className = "czekam";
      czekam.textContent = "↑ zrób to na mapie, a pójdę dalej sam";
      guziki.append(czekam);
    }

    // Pominięcie jest zawsze pod ręką. Dziecko, które już wie, jak grać,
    // nie ma się przeklikiwać przez siedem okienek.
    const pomin = document.createElement("button");
    pomin.className = "pomin";
    pomin.textContent = "Pomiń samouczek";
    pomin.addEventListener("click", () => {
      biezacy = kroki.length;
      zapamietaj(biezacy);
      rysuj();
    });
    guziki.append(pomin);

    el.append(guziki);
  }

  function nastepny(): void {
    biezacy++;
    zapamietaj(biezacy);
    rysuj();
  }

  rysuj();

  return {
    odswiez(stan) {
      if (biezacy >= kroki.length) return;
      const warunek = SPELNIONE[kroki[biezacy].id];
      if (warunek && warunek(stan)) nastepny();
    },
    czyTrwa: () => biezacy < kroki.length,
    odNowa() {
      biezacy = 0;
      zapamietaj(biezacy);
      rysuj();
    },
  };
}
