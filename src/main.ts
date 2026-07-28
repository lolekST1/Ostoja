/**
 * Ostoja — punkt wejścia warstwy przeglądarki.
 *
 * Stan na dziś (kroki 1–2 kolejności prac): rusztowanie. Pokazuje wygenerowaną
 * mapę, pozwala kliknięciem sprawdzić drogę liczoną przez A* i zapisuje stan gry
 * w przeglądarce. W kroku 3 canvas przejmie scena Phasera, a ten plik zostanie
 * sklejeniem sceny z interfejsem.
 *
 * Symulacja (src/sim) nic o tym pliku nie wie i nie może wiedzieć.
 */

import type { Dane } from "./sim/budynki.ts";
import type { KonfiguracjaMapy, Punkt, StanGry, Teren } from "./sim/typy.ts";
import { SUROWCE } from "./sim/typy.ts";
import { indeks, policzTereny } from "./sim/mapa.ts";
import { nowaGra } from "./sim/stan.ts";
import { znajdzSciezke } from "./sim/szukanie.ts";
import { czyJestZapis, skasujZapis, wczytajGre, zapiszGre } from "./zapis.ts";

import budynki from "../dane/budynki.json";
import ulepszenia from "../dane/ulepszenia.json";
import stale from "../dane/stale.json";
import konfiguracjaMapy from "../dane/mapa.json";

const dane = { budynki, ulepszenia, stale } as unknown as Dane;
const konfigMapy = konfiguracjaMapy as KonfiguracjaMapy;

const KAFELEK = 16;

const BARWY: Record<Teren, string> = {
  las: "#2f5d3a",
  laka: "#7fa650",
  glina: "#b07a4a",
  woda: "#3b6ea5",
  skala: "#7d7d85",
  ziemia: "#8b6f47",
};

const NAZWY: Record<Teren, string> = {
  las: "las",
  laka: "łąka",
  glina: "glina",
  woda: "woda",
  skala: "skała",
  ziemia: "ziemia",
};

// ---------------------------------------------------------------------------
// Stan
// ---------------------------------------------------------------------------

function ziarnoZAdresu(): number {
  const podane = new URLSearchParams(location.search).get("ziarno");
  return podane === null ? Date.now() % 100000 : Number(podane);
}

let stan: StanGry = zacznij();

function zacznij(): StanGry {
  const zapisany = wczytajGre();
  if (zapisany === null) return nowaGra(dane, konfigMapy, ziarnoZAdresu());
  if (zapisany.ok) return zapisany.stan;

  // Zapis jest, ale nie da się go odczytać. Gra ma ruszyć mimo to — z nową
  // osadą i wyjaśnieniem, a nie z białym ekranem.
  powiedz(`Nie udało się wczytać zapisu: ${zapisany.powod}. Zaczynam od nowa.`);
  return nowaGra(dane, konfigMapy, ziarnoZAdresu());
}

// ---------------------------------------------------------------------------
// Rysowanie
// ---------------------------------------------------------------------------

const canvas = document.createElement("canvas");
document.querySelector("#gra")!.append(canvas);
const rysik = canvas.getContext("2d")!;

function rysuj(sciezka: Punkt[] | null = null, cel: Punkt | null = null): void {
  const mapa = stan.mapa;
  canvas.width = mapa.szerokosc * KAFELEK;
  canvas.height = mapa.wysokosc * KAFELEK;

  for (let y = 0; y < mapa.wysokosc; y++) {
    for (let x = 0; x < mapa.szerokosc; x++) {
      const kafelek = mapa.kafelki[indeks(mapa, x, y)];
      rysik.fillStyle = BARWY[kafelek.teren];
      rysik.fillRect(x * KAFELEK, y * KAFELEK, KAFELEK, KAFELEK);
    }
  }

  if (sciezka) {
    const skad = stan.mapa.start ?? { x: 0, y: 0 };
    rysik.strokeStyle = "#ffd34d";
    rysik.lineWidth = 3;
    rysik.lineJoin = "round";
    rysik.beginPath();
    rysik.moveTo((skad.x + 0.5) * KAFELEK, (skad.y + 0.5) * KAFELEK);
    for (const krok of sciezka) {
      rysik.lineTo((krok.x + 0.5) * KAFELEK, (krok.y + 0.5) * KAFELEK);
    }
    rysik.stroke();
  }

  if (cel) {
    rysik.strokeStyle = sciezka ? "#ffffff" : "#e5484d";
    rysik.lineWidth = 2;
    rysik.strokeRect(cel.x * KAFELEK + 1, cel.y * KAFELEK + 1, KAFELEK - 2, KAFELEK - 2);
  }

  // Budynki na wierzchu terenu, żeby było widać, że osada naprawdę stoi.
  for (const b of stan.budynki) {
    const def = dane.budynki[b.typ];
    rysik.fillStyle = b.typ === "magazyn" ? "#e8d8a0" : "#c98b52";
    rysik.strokeStyle = "#3a2a18";
    rysik.lineWidth = 1.5;
    rysik.fillRect(b.x * KAFELEK + 1, b.y * KAFELEK + 1, def.szerokosc * KAFELEK - 2, def.wysokosc * KAFELEK - 2);
    rysik.strokeRect(b.x * KAFELEK + 1, b.y * KAFELEK + 1, def.szerokosc * KAFELEK - 2, def.wysokosc * KAFELEK - 2);
  }
}

// ---------------------------------------------------------------------------
// Interfejs w DOM (zasada 4)
// ---------------------------------------------------------------------------

const podpowiedz = document.querySelector<HTMLDivElement>("#podpowiedz")!;
function powiedz(tekst: string): void {
  podpowiedz.textContent = tekst;
}

function odswiez(): void {
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
    (Object.keys(BARWY) as Teren[])
      .map((t) => `<span><i class="znak" style="background:${BARWY[t]}"></i>${NAZWY[t]} ${tereny[t]}</span>`)
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
    rysuj();
    odswiez();
    powiedz("Wczytano zapis.");
  }),
  przycisk("Nowa osada", () => {
    skasujZapis();
    stan = nowaGra(dane, konfigMapy, Date.now() % 100000);
    rysuj();
    odswiez();
    powiedz("Nowa osada na nowej mapie. Zapisu nie ma, dopóki nie klikniesz „Zapisz”.");
  }),
);

canvas.addEventListener("click", (zdarzenie) => {
  const ramka = canvas.getBoundingClientRect();
  const skala = canvas.width / ramka.width;
  const cel: Punkt = {
    x: Math.floor(((zdarzenie.clientX - ramka.left) * skala) / KAFELEK),
    y: Math.floor(((zdarzenie.clientY - ramka.top) * skala) / KAFELEK),
  };

  const osada = stan.mapa.start;
  if (!osada) return;
  const kafelek = stan.mapa.kafelki[indeks(stan.mapa, cel.x, cel.y)];
  // obokCelu, bo w wodę i skałę nikt nie wejdzie, a podejść pod brzeg trzeba.
  const sciezka = znajdzSciezke(stan.mapa, osada, cel, { obokCelu: !kafelek.przechodni });
  rysuj(sciezka, cel);

  powiedz(
    sciezka
      ? `(${cel.x},${cel.y}) ${NAZWY[kafelek.teren]} — ${sciezka.length} kroków z osady` +
        (kafelek.przechodni ? "" : " (podejście pod brzeg)")
      : `(${cel.x},${cel.y}) ${NAZWY[kafelek.teren]} — brak drogi`,
  );
});

rysuj();
odswiez();
if (!podpowiedz.textContent) {
  powiedz(
    czyJestZapis()
      ? "Wczytano zapisaną osadę. Kliknij w kafelek — pokażę drogę z osady (A*)."
      : "Kliknij w kafelek — pokażę drogę z osady (A*).",
  );
}
