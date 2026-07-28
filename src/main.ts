/**
 * Ostoja — punkt wejścia warstwy przeglądarki.
 *
 * Skleja trzy rzeczy: symulację (src/sim), scenę Phasera (src/render) i
 * interfejs w DOM. Phaser rysuje wyłącznie świat, cała reszta to zwykły HTML
 * nałożony na canvas (zasada 4).
 *
 * Czas jeszcze nie płynie — pętla dzienna i sterowanie prędkością wchodzą
 * z kolejnymi krokami. Na razie widać osadę, mapę i drogi liczone przez A*.
 */

import Phaser from "phaser";

import type { Dane } from "./sim/budynki.ts";
import type { KonfiguracjaMapy, Punkt, StanGry, Teren } from "./sim/typy.ts";
import { SUROWCE } from "./sim/typy.ts";
import { indeks, policzTereny } from "./sim/mapa.ts";
import { nowaGra } from "./sim/stan.ts";
import { znajdzSciezke } from "./sim/szukanie.ts";
import { ScenaGry } from "./render/scenaGry.ts";
import { skasujZapis, wczytajGre, zapiszGre } from "./zapis.ts";

import budynki from "../dane/budynki.json";
import ulepszenia from "../dane/ulepszenia.json";
import stale from "../dane/stale.json";
import konfiguracjaMapy from "../dane/mapa.json";

const dane = { budynki, ulepszenia, stale } as unknown as Dane;
const konfigMapy = konfiguracjaMapy as KonfiguracjaMapy;

const NAZWY_TERENU: Record<Teren, string> = {
  las: "las",
  laka: "łąka",
  glina: "glina",
  woda: "woda",
  skala: "skała",
  ziemia: "ziemia",
};

const BARWY_LEGENDY: Record<Teren, string> = {
  las: "#2f5d3a",
  laka: "#7fa650",
  glina: "#b07a4a",
  woda: "#3b6ea5",
  skala: "#7d7d85",
  ziemia: "#8b6f47",
};

// ---------------------------------------------------------------------------
// Stan
// ---------------------------------------------------------------------------

const podpowiedz = document.querySelector<HTMLDivElement>("#podpowiedz")!;
function powiedz(tekst: string): void {
  podpowiedz.textContent = tekst;
}

function ziarnoZAdresu(): number {
  const podane = new URLSearchParams(location.search).get("ziarno");
  return podane === null ? Date.now() % 100000 : Number(podane);
}

function zacznij(): StanGry {
  const zapisany = wczytajGre();
  if (zapisany === null) return nowaGra(dane, konfigMapy, ziarnoZAdresu());
  if (zapisany.ok) return zapisany.stan;

  // Zapis jest, ale nie da się go odczytać. Gra ma ruszyć mimo to — z nową
  // osadą i wyjaśnieniem, a nie z białym ekranem.
  powiedz(`Nie udało się wczytać zapisu: ${zapisany.powod}. Zaczynam od nowa.`);
  return nowaGra(dane, konfigMapy, ziarnoZAdresu());
}

let stan: StanGry = zacznij();

// ---------------------------------------------------------------------------
// Scena
// ---------------------------------------------------------------------------

const scena = new ScenaGry({
  dane,
  stan: () => stan,
  gotowe: () => odswiezInterfejs(),
  naKlikniecieKafelka(kafelek, scena) {
    const mapa = stan.mapa;
    const pole = mapa.kafelki[indeks(mapa, kafelek.x, kafelek.y)];

    if (pole.zajetyPrzez !== null) {
      const budynek = stan.budynki.find((b) => b.id === pole.zajetyPrzez);
      if (budynek) {
        scena.podswietl(kafelek);
        scena.pokazSciezke(null, null);
        powiedz(`${dane.budynki[budynek.typ].nazwa} — (${budynek.x},${budynek.y})`);
        return;
      }
    }

    const osada = mapa.start;
    if (!osada) return;
    // obokCelu, bo w wodę i skałę nikt nie wejdzie, a podejść pod brzeg trzeba.
    const kroki = znajdzSciezke(mapa, osada, kafelek, { obokCelu: !pole.przechodni });
    scena.podswietl(kafelek, kroki !== null);
    scena.pokazSciezke(kroki, osada);

    powiedz(
      kroki
        ? `(${kafelek.x},${kafelek.y}) ${NAZWY_TERENU[pole.teren]} — ${kroki.length} kroków z osady` +
          (pole.przechodni ? "" : " (podejście pod brzeg)")
        : `(${kafelek.x},${kafelek.y}) ${NAZWY_TERENU[pole.teren]} — brak drogi`,
    );
  },
});

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "gra",
  width: 640,
  height: 560,
  backgroundColor: "#141a12",
  pixelArt: true,
  scene: scena,
});

// ---------------------------------------------------------------------------
// Interfejs w DOM (zasada 4)
// ---------------------------------------------------------------------------

function odswiezInterfejs(): void {
  const tereny = policzTereny(stan.mapa);
  const surowce = SUROWCE.filter((s) => stan.pula[s] > 0)
    .map((s) => `${s} ${Math.round(stan.pula[s])}`)
    .join(" &middot; ");

  document.querySelector("#pasek")!.innerHTML =
    `<h1>Ostoja</h1><span class="liczby">ziarno mapy ${stan.ziarnoMapy ?? "—"} &middot; ` +
    `rok ${stan.czas.rok}, ${stan.czas.pora}, dzień ${stan.czas.dzien} &middot; ` +
    `${stan.mieszkancy.length} mieszkańców &middot; ${stan.budynki.length} budynków</span>`;

  document.querySelector("#panele")!.innerHTML =
    `<span>${surowce || "pusta spiżarnia"}</span>` +
    (Object.keys(BARWY_LEGENDY) as Teren[])
      .map(
        (t) =>
          `<span><i class="znak" style="background:${BARWY_LEGENDY[t]}"></i>${NAZWY_TERENU[t]} ${tereny[t]}</span>`,
      )
      .join("");
}

function przycisk(napis: string, dziala: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = napis;
  b.addEventListener("click", dziala);
  return b;
}

document.querySelector("#sterowanie")!.append(
  przycisk("Zapisz", () => {
    const wynik = zapiszGre(stan);
    powiedz(wynik.ok ? "Zapisano w przeglądarce." : wynik.powod);
  }),
  przycisk("Wczytaj", () => {
    const wynik = wczytajGre();
    if (wynik === null) return powiedz("Nie ma jeszcze żadnego zapisu.");
    if (!wynik.ok) return powiedz(wynik.powod);
    stan = wynik.stan;
    scena.odswiez();
    odswiezInterfejs();
    powiedz("Wczytano zapis.");
  }),
  przycisk("Nowa osada", () => {
    skasujZapis();
    stan = nowaGra(dane, konfigMapy, Date.now() % 100000);
    scena.odswiez();
    odswiezInterfejs();
    powiedz("Nowa osada na nowej mapie. Zapisu nie ma, dopóki nie klikniesz „Zapisz”.");
  }),
);

powiedz("Kliknij w kafelek — pokażę drogę z osady. Przeciągnij, żeby przesunąć mapę, kółkiem przybliżysz.");

export type { Punkt };
