/**
 * Ostoja — ekran po pięciu latach.
 *
 * Nazwane zakończenia, nie punkty (zasada 8 z PLAN.md), i **bór z pierwszego
 * dnia obok boru z ostatniego**. Jedno spojrzenie na te dwa obrazki mówi
 * dziecku, co zrobiło z lasem — bez ani jednego zdania morału. Dlatego pod
 * obrazkami nie ma komentarza, tylko dwie liczby drzew.
 *
 * Zwykły HTML nałożony na canvas (zasada 4). Bór rysujemy na własnym, małym
 * `<canvas>` 2D — to nie jest Phaser i nie jest to plansza gry, tylko dwie
 * miniatury wielkości znaczka pocztowego.
 */

import type { DefinicjaZakonczenia, IdZakonczenia } from "../sim/zakonczenia.ts";

export interface EkranKonca {
  pokaz: (wynik: WynikSprintu) => void;
  ukryj: () => void;
  czyWidoczny: () => boolean;
}

export interface WynikSprintu {
  lat: number;
  /** Nazwa miejsca krainy, na którym stała ta osada. */
  miejsce: string;
  /**
   * Zdanie na wyjście, zależne od zdobytych zakończeń — osada, która żyła
   * z lasem, rusza dalej inaczej niż ta, która go wycięła. Następnej mapy to
   * nie zmienia, tylko to, co się o niej mówi.
   */
  pozegnanie: string;
  /** Nazwa następnego miejsca albo null, gdy to było ostatnie. */
  nastepne: string | null;
  ludnosc: number;
  zdobyte: IdZakonczenia[];
  /** Bór spakowany po jednym znaku na kafelek — patrz `spakujBor`. */
  borPrzed: string;
  borPo: string;
  szerokoscMapy: number;
  drzewPrzed: number;
  drzewPo: number;
}

/** Ile pikseli na kafelek w miniaturze. Cztery mieszczą mapę 40×40 w 160 px. */
const PIKSELI_NA_KAFELEK = 4;

function rysujBor(bor: string, szerokosc: number): HTMLCanvasElement {
  const wysokosc = Math.ceil(bor.length / szerokosc);
  const plotno = document.createElement("canvas");
  plotno.width = szerokosc * PIKSELI_NA_KAFELEK;
  plotno.height = wysokosc * PIKSELI_NA_KAFELEK;

  const ctx = plotno.getContext("2d");
  if (!ctx) return plotno;

  ctx.fillStyle = "#d8d3c0";
  ctx.fillRect(0, 0, plotno.width, plotno.height);

  for (let i = 0; i < bor.length; i++) {
    const znak = bor[i];
    if (znak === ".") continue;
    // Pniak jest jaśniejszy od drzewa, więc przerzedzony las widać jako
    // wyblakłą plamę, a nie jako dziurę. Tak wygląda w rzeczywistości.
    const poziom = Number(znak) / 9;
    const zielen = Math.round(90 + (1 - poziom) * 110);
    ctx.fillStyle = `rgb(${Math.round(60 + (1 - poziom) * 120)}, ${zielen}, ${Math.round(50 + (1 - poziom) * 90)})`;
    const x = (i % szerokosc) * PIKSELI_NA_KAFELEK;
    const y = Math.floor(i / szerokosc) * PIKSELI_NA_KAFELEK;
    ctx.fillRect(x, y, PIKSELI_NA_KAFELEK, PIKSELI_NA_KAFELEK);
  }

  return plotno;
}

export function utworzEkranKonca(
  el: HTMLElement,
  wpisy: DefinicjaZakonczenia[],
  naNowaOsade: () => void,
  naDalej: () => void,
): EkranKonca {
  let widoczny = false;

  function rysuj(w: WynikSprintu): void {
    el.innerHTML = "";

    const srodek = document.createElement("div");
    srodek.className = "koniec-srodek";

    const naglowek = document.createElement("div");
    naglowek.className = "koniec-naglowek";
    naglowek.innerHTML =
      `<h2>${w.miejsce}: minęło ${w.lat} lat</h2>` +
      `<p class="drobne">Osada liczy ${w.ludnosc} mieszkańców.</p>`;
    srodek.append(naglowek);

    // --- Bór wtedy i dziś ---------------------------------------------------
    const bory = document.createElement("div");
    bory.className = "bory";
    for (const [podpis, bor, drzew] of [
      ["Bór pierwszego dnia", w.borPrzed, w.drzewPrzed],
      ["Bór dzisiaj", w.borPo, w.drzewPo],
    ] as const) {
      const kolumna = document.createElement("figure");
      kolumna.append(rysujBor(bor, w.szerokoscMapy));
      const opis = document.createElement("figcaption");
      opis.innerHTML = `${podpis}<br><b>${Math.round(drzew)}</b> drzew`;
      kolumna.append(opis);
      bory.append(kolumna);
    }
    srodek.append(bory);

    // --- Zakończenia --------------------------------------------------------
    const lista = document.createElement("ul");
    lista.className = "zakonczenia";
    for (const wpis of wpisy) {
      const zdobyte = w.zdobyte.includes(wpis.id);
      const wiersz = document.createElement("li");
      wiersz.className = zdobyte ? "zdobyte" : "niezdobyte";
      wiersz.innerHTML =
        `<h3>${zdobyte ? "★" : "☆"} ${wpis.nazwa}</h3>` +
        `<p>${zdobyte ? wpis.opis : wpis.gdyBrak}</p>`;
      lista.append(wiersz);
    }
    srodek.append(lista);

    // Zdanie na wyjście jest częścią tej samej historii co wprowadzenie
    // i zależy od tego, jak poszło — to najtańszy sposób, żeby wybór
    // z pierwszej planszy był widoczny na trzeciej.
    const dalej = document.createElement("p");
    dalej.className = "pozegnanie";
    dalej.textContent = w.pozegnanie;
    srodek.append(dalej);

    // Bez „zdobyłeś 3 z 4" — to byłaby punktacja tylnymi drzwiami, a jedna
    // liczba zamienia wszystko, czego nie liczy, w dekorację.
    const stopka = document.createElement("p");
    stopka.className = "drobne";
    stopka.textContent =
      "Wszystkich naraz zdobyć się nie da — osada, która rośnie najszybciej, " +
      "bierze z lasu więcej, niż on zdąży odrosnąć. Następnym razem możesz " +
      "poprowadzić ją inaczej.";
    srodek.append(stopka);

    const guziki = document.createElement("div");
    guziki.className = "koniec-guziki";

    // Droga dalej idzie pierwsza, bo to jest to, po co dziecko tu siedzi:
    // chce wiedzieć, co dalej z ludźmi, których prowadzi.
    if (w.nastepne) {
      const ruszaj = document.createElement("button");
      ruszaj.className = "glowny";
      ruszaj.textContent = `Ruszamy do ${w.nastepne}`;
      ruszaj.addEventListener("click", naDalej);
      guziki.append(ruszaj);
    }

    const nowa = document.createElement("button");
    nowa.textContent = w.nastepne ? "Jeszcze raz to samo miejsce" : "Jeszcze raz";
    nowa.addEventListener("click", naNowaOsade);
    guziki.append(nowa);

    // Zamknięcie zostawia gracza przy jego mapie. Po pięciu latach nic już się
    // nie liczy do wyniku, ale dziecko ma prawo pooglądać to, co zbudowało.
    const zamknij = document.createElement("button");
    zamknij.textContent = "Popatrz jeszcze na osadę";
    zamknij.addEventListener("click", () => ukryj());
    guziki.append(zamknij);

    srodek.append(guziki);
    el.append(srodek);
  }

  function ukryj(): void {
    widoczny = false;
    el.classList.remove("widoczny");
  }

  return {
    pokaz(wynik) {
      rysuj(wynik);
      widoczny = true;
      el.classList.add("widoczny");
    },
    ukryj,
    czyWidoczny: () => widoczny,
  };
}
