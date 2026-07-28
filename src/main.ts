/**
 * Ostoja — punkt wejścia warstwy przeglądarki.
 *
 * Na tym etapie (krok 1 kolejności prac) to rusztowanie: rysuje wygenerowaną
 * mapę na zwykłym canvasie i pozwala kliknięciem sprawdzić, czy A* znajduje
 * drogę z osady w dowolne miejsce. W kroku 3 zastąpi je scena Phasera, a ten
 * plik zostanie tylko sklejeniem sceny z interfejsem.
 *
 * Symulacja (src/sim) nic o tym pliku nie wie i nie może wiedzieć.
 */

import type { KonfiguracjaMapy, Mapa, Punkt, Teren } from "./sim/typy.ts";
import { generujMape, indeks, policzTereny } from "./sim/mapa.ts";
import { znajdzSciezke } from "./sim/szukanie.ts";
import konfiguracja from "../dane/mapa.json";

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

const ziarno = Number(new URLSearchParams(location.search).get("ziarno") ?? 1234);
const mapa = generujMape(konfiguracja as KonfiguracjaMapy, ziarno);
const osada: Punkt = mapa.start ?? { x: 0, y: 0 };

// ---------------------------------------------------------------------------

const canvas = document.createElement("canvas");
canvas.width = mapa.szerokosc * KAFELEK;
canvas.height = mapa.wysokosc * KAFELEK;
document.querySelector("#gra")!.append(canvas);
const rysik = canvas.getContext("2d")!;

function rysuj(sciezka: Punkt[] | null, cel: Punkt | null): void {
  for (let y = 0; y < mapa.wysokosc; y++) {
    for (let x = 0; x < mapa.szerokosc; x++) {
      rysik.fillStyle = BARWY[mapa.kafelki[indeks(mapa, x, y)].teren];
      rysik.fillRect(x * KAFELEK, y * KAFELEK, KAFELEK, KAFELEK);
    }
  }

  if (sciezka) {
    rysik.strokeStyle = "#ffd34d";
    rysik.lineWidth = 3;
    rysik.lineJoin = "round";
    rysik.beginPath();
    rysik.moveTo((osada.x + 0.5) * KAFELEK, (osada.y + 0.5) * KAFELEK);
    for (const k of sciezka) {
      rysik.lineTo((k.x + 0.5) * KAFELEK, (k.y + 0.5) * KAFELEK);
    }
    rysik.stroke();
  }

  if (cel) {
    rysik.strokeStyle = sciezka ? "#ffffff" : "#e5484d";
    rysik.lineWidth = 2;
    rysik.strokeRect(cel.x * KAFELEK + 1, cel.y * KAFELEK + 1, KAFELEK - 2, KAFELEK - 2);
  }

  // Osada na wierzchu, żeby nie zniknęła pod ścieżką.
  rysik.fillStyle = "#ffffff";
  rysik.strokeStyle = "#1b1b1b";
  rysik.lineWidth = 2;
  rysik.beginPath();
  rysik.arc((osada.x + 0.5) * KAFELEK, (osada.y + 0.5) * KAFELEK, KAFELEK * 0.35, 0, Math.PI * 2);
  rysik.fill();
  rysik.stroke();
}

// ---------------------------------------------------------------------------

const podpowiedz = document.querySelector<HTMLDivElement>("#podpowiedz")!;

canvas.addEventListener("click", (zdarzenie) => {
  const ramka = canvas.getBoundingClientRect();
  const skala = canvas.width / ramka.width;
  const cel: Punkt = {
    x: Math.floor(((zdarzenie.clientX - ramka.left) * skala) / KAFELEK),
    y: Math.floor(((zdarzenie.clientY - ramka.top) * skala) / KAFELEK),
  };

  const kafelek = mapa.kafelki[indeks(mapa, cel.x, cel.y)];
  // obokCelu, bo w wodę i skałę nikt nie wejdzie, a podejść pod brzeg trzeba.
  const sciezka = znajdzSciezke(mapa, osada, cel, { obokCelu: !kafelek.przechodni });
  rysuj(sciezka, cel);

  podpowiedz.textContent = sciezka
    ? `(${cel.x},${cel.y}) ${NAZWY[kafelek.teren]} — ${sciezka.length} kroków z osady` +
      (kafelek.przechodni ? "" : " (podejście pod brzeg)")
    : `(${cel.x},${cel.y}) ${NAZWY[kafelek.teren]} — brak drogi`;
});

// ---------------------------------------------------------------------------

const tereny = policzTereny(mapa);
document.querySelector("#pasek")!.innerHTML =
  `<h1>Ostoja</h1><span class="liczby">mapa ${mapa.szerokosc}×${mapa.wysokosc}, ` +
  `ziarno ${ziarno} &middot; ${tereny.las} drzew &middot; ${tereny.glina} kafelków gliny</span>`;

document.querySelector("#panele")!.innerHTML = (Object.keys(BARWY) as Teren[])
  .map((t) => `<span><i class="znak" style="background:${BARWY[t]}"></i>${NAZWY[t]} ${tereny[t]}</span>`)
  .join("");

podpowiedz.textContent = "Kliknij w kafelek — pokażę drogę z osady (A*).";
rysuj(null, null);

// Typ Mapa jest tu tylko po to, żeby edytor podpowiadał przy dalszej pracy.
export type { Mapa };
