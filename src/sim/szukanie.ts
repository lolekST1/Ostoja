/**
 * Ostoja — szukanie drogi (A*) po siatce kafelków.
 *
 * Ludzie chodzą naprawdę: rano do pracy, wieczorem do domu, a w budynkach
 * zbierających po surowiec. Ścieżka liczy się tylko w tych momentach, nie co
 * klatkę, więc zwykłe A* z kopcem binarnym wystarcza z zapasem.
 *
 * Bez Phasera — to nadal warstwa symulacji.
 */

import type { Mapa, Punkt } from "./typy.ts";
import { indeks, wGranicach } from "./mapa.ts";

const PROSTO = 1;
const NA_UKOS = Math.SQRT2;

/** Ósemka kierunków: dx, dy, koszt. */
const KIERUNKI: readonly (readonly [number, number, number])[] = [
  [1, 0, PROSTO],
  [-1, 0, PROSTO],
  [0, 1, PROSTO],
  [0, -1, PROSTO],
  [1, 1, NA_UKOS],
  [1, -1, NA_UKOS],
  [-1, 1, NA_UKOS],
  [-1, -1, NA_UKOS],
];

export interface OpcjeSzukania {
  /**
   * Zatrzymaj się na kafelku sąsiadującym z celem. Potrzebne, bo najczęstszy cel
   * — drzewo, złoże gliny, budynek — jest nieprzechodni albo zajęty, a mimo to
   * trzeba do niego dojść.
   */
  obokCelu?: boolean;
}

// ---------------------------------------------------------------------------
// Kopiec binarny na otwartą listę
// ---------------------------------------------------------------------------

class Kopiec {
  private pola: number[] = [];
  private wagi: number[] = [];

  get pusty(): boolean {
    return this.pola.length === 0;
  }

  dodaj(pole: number, waga: number): void {
    this.pola.push(pole);
    this.wagi.push(waga);
    let i = this.pola.length - 1;
    while (i > 0) {
      const rodzic = (i - 1) >> 1;
      if (this.wagi[rodzic] <= this.wagi[i]) break;
      this.zamien(i, rodzic);
      i = rodzic;
    }
  }

  zdejmij(): number {
    const szczyt = this.pola[0];
    const ostatniePole = this.pola.pop()!;
    const ostatniaWaga = this.wagi.pop()!;
    if (this.pola.length > 0) {
      this.pola[0] = ostatniePole;
      this.wagi[0] = ostatniaWaga;
      let i = 0;
      for (;;) {
        const lewy = 2 * i + 1;
        const prawy = lewy + 1;
        let naj = i;
        if (lewy < this.wagi.length && this.wagi[lewy] < this.wagi[naj]) naj = lewy;
        if (prawy < this.wagi.length && this.wagi[prawy] < this.wagi[naj]) naj = prawy;
        if (naj === i) break;
        this.zamien(i, naj);
        i = naj;
      }
    }
    return szczyt;
  }

  private zamien(a: number, b: number): void {
    [this.pola[a], this.pola[b]] = [this.pola[b], this.pola[a]];
    [this.wagi[a], this.wagi[b]] = [this.wagi[b], this.wagi[a]];
  }
}

// ---------------------------------------------------------------------------

/** Octile: dokładna długość drogi po ósemce kierunków bez przeszkód. */
function heurystyka(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return PROSTO * (dx + dy) + (NA_UKOS - 2 * PROSTO) * Math.min(dx, dy);
}

function sasiaduje(ax: number, ay: number, bx: number, by: number): boolean {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}

/**
 * Zwraca kolejne kroki od startu do celu, bez kafelka startowego. null oznacza,
 * że drogi nie ma. Pusta tablica oznacza, że już stoimy na miejscu.
 *
 * Start może być nieprzechodni: człowiek stojący w drzwiach budynku musi mieć
 * jak wyjść.
 */
export function znajdzSciezke(
  mapa: Mapa,
  start: Punkt,
  cel: Punkt,
  opcje: OpcjeSzukania = {},
): Punkt[] | null {
  if (!wGranicach(mapa, start.x, start.y)) return null;
  if (!wGranicach(mapa, cel.x, cel.y)) return null;

  const obokCelu = opcje.obokCelu ?? false;
  const startI = indeks(mapa, start.x, start.y);
  const celI = indeks(mapa, cel.x, cel.y);

  if (startI === celI) return [];
  if (!obokCelu && !mapa.kafelki[celI].przechodni) return null;
  if (obokCelu && sasiaduje(start.x, start.y, cel.x, cel.y)) return [];

  const ile = mapa.szerokosc * mapa.wysokosc;
  const dotad = new Float64Array(ile).fill(Infinity);
  const skad = new Int32Array(ile).fill(-1);
  const zamkniete = new Uint8Array(ile);

  dotad[startI] = 0;
  const otwarte = new Kopiec();
  otwarte.dodaj(startI, heurystyka(start.x, start.y, cel.x, cel.y));

  while (!otwarte.pusty) {
    const biezacy = otwarte.zdejmij();
    if (zamkniete[biezacy]) continue;
    zamkniete[biezacy] = 1;

    const bx = biezacy % mapa.szerokosc;
    const by = (biezacy - bx) / mapa.szerokosc;

    const uCelu = obokCelu
      ? sasiaduje(bx, by, cel.x, cel.y)
      : biezacy === celI;
    if (uCelu) return odtworz(mapa, skad, startI, biezacy);

    for (const [dx, dy, koszt] of KIERUNKI) {
      const nx = bx + dx;
      const ny = by + dy;
      if (!wGranicach(mapa, nx, ny)) continue;

      const sasiadI = indeks(mapa, nx, ny);
      if (zamkniete[sasiadI]) continue;
      if (!mapa.kafelki[sasiadI].przechodni) continue;

      // Bez ścinania rogów: na ukos tylko wtedy, gdy oba sąsiednie kafelki
      // proste są wolne. Inaczej ludzie przenikaliby przez styk dwóch skał.
      if (dx !== 0 && dy !== 0) {
        if (!mapa.kafelki[indeks(mapa, bx + dx, by)].przechodni) continue;
        if (!mapa.kafelki[indeks(mapa, bx, by + dy)].przechodni) continue;
      }

      const nowyKoszt = dotad[biezacy] + koszt;
      if (nowyKoszt >= dotad[sasiadI]) continue;

      dotad[sasiadI] = nowyKoszt;
      skad[sasiadI] = biezacy;
      otwarte.dodaj(sasiadI, nowyKoszt + heurystyka(nx, ny, cel.x, cel.y));
    }
  }

  return null;
}

function odtworz(
  mapa: Mapa,
  skad: Int32Array,
  startI: number,
  koniecI: number,
): Punkt[] {
  const sciezka: Punkt[] = [];
  let i = koniecI;
  while (i !== startI && i !== -1) {
    const x = i % mapa.szerokosc;
    sciezka.push({ x, y: (i - x) / mapa.szerokosc });
    i = skad[i];
  }
  sciezka.reverse();
  return sciezka;
}
