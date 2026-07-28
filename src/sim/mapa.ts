/**
 * Ostoja — mapa i jej generator.
 *
 * Bez Phasera i bez Math.random(): mapa powstaje z ziarna, więc ten sam zapis
 * zawsze odtwarza ten sam teren. Docelowo mapa jest generowana raz i zapisana
 * na stałe (sekcja 10 dokumentu), ale generator zostaje, bo bez niego nie da
 * się sprawdzić, czy teren w ogóle nadaje się do gry.
 */

import type {
  Kafelek,
  KonfiguracjaMapy,
  Mapa,
  Punkt,
  Teren,
} from "./typy.ts";
import { DREWNA_Z_DRZEWA } from "./typy.ts";
import type { Los } from "./los.ts";
import { utworzLos } from "./los.ts";

// ---------------------------------------------------------------------------
// Dostęp do kafelków
// ---------------------------------------------------------------------------

export function wGranicach(mapa: Mapa, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < mapa.szerokosc && y < mapa.wysokosc;
}

export function indeks(mapa: Mapa, x: number, y: number): number {
  return y * mapa.szerokosc + x;
}

export function kafelekNa(mapa: Mapa, x: number, y: number): Kafelek | null {
  if (!wGranicach(mapa, x, y)) return null;
  return mapa.kafelki[indeks(mapa, x, y)];
}

const SASIEDZI: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const PROSTE: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Które kafelki da się osiągnąć pieszo z zadanego miejsca.
 *
 * Reguła przejścia musi być dokładnie ta sama co w szukanie.ts, łącznie z
 * zakazem ścinania rogów. Gdyby zalewanie było choć odrobinę łagodniejsze,
 * mapa przechodziłaby test spójności, a A* i tak nie umiałby przejść.
 */
export function osiagalneOd(mapa: Mapa, od: Punkt): Uint8Array {
  const widziane = new Uint8Array(mapa.kafelki.length);
  if (!wGranicach(mapa, od.x, od.y)) return widziane;

  const poczatek = indeks(mapa, od.x, od.y);
  const stos = [poczatek];
  widziane[poczatek] = 1;

  while (stos.length > 0) {
    const i = stos.pop()!;
    const x = i % mapa.szerokosc;
    const y = (i - x) / mapa.szerokosc;

    for (const [dx, dy] of SASIEDZI) {
      const nx = x + dx;
      const ny = y + dy;
      if (!wGranicach(mapa, nx, ny)) continue;

      const j = indeks(mapa, nx, ny);
      if (widziane[j] || !mapa.kafelki[j].przechodni) continue;
      if (dx !== 0 && dy !== 0) {
        if (!mapa.kafelki[indeks(mapa, x + dx, y)].przechodni) continue;
        if (!mapa.kafelki[indeks(mapa, x, y + dy)].przechodni) continue;
      }

      widziane[j] = 1;
      stos.push(j);
    }
  }

  return widziane;
}

export function policzTereny(mapa: Mapa): Record<Teren, number> {
  const licznik: Record<Teren, number> = {
    las: 0,
    laka: 0,
    glina: 0,
    woda: 0,
    skala: 0,
    ziemia: 0,
  };
  for (const k of mapa.kafelki) licznik[k.teren]++;
  return licznik;
}

/**
 * Czy na tym prostokącie da się postawić budynek: sucho, bez skał i bez
 * innego budynku.
 */
export function miejsceWolne(
  mapa: Mapa,
  rog: Punkt,
  szerokosc: number,
  wysokosc: number,
): boolean {
  for (let y = rog.y; y < rog.y + wysokosc; y++) {
    for (let x = rog.x; x < rog.x + szerokosc; x++) {
      const k = kafelekNa(mapa, x, y);
      if (!k || !k.przechodni || k.zajetyPrzez !== null) return false;
    }
  }
  return true;
}

/**
 * Najbliższe wolne miejsce na budynek, szukane pierścieniami od zadanego punktu.
 * Zwraca lewy górny róg albo null, gdy w promieniu nic nie ma.
 */
export function wolneMiejsce(
  mapa: Mapa,
  wokol: Punkt,
  szerokosc: number,
  wysokosc: number,
  maksPromien = 12,
): Punkt | null {
  for (let r = 0; r <= maksPromien; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Tylko obrzeże pierścienia — wnętrze sprawdziliśmy w poprzednich obrotach.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const rog = { x: wokol.x + dx, y: wokol.y + dy };
        if (miejsceWolne(mapa, rog, szerokosc, wysokosc)) return rog;
      }
    }
  }
  return null;
}

/** Ile kafelków danego terenu leży w promieniu (metryka kołowa). */
export function policzWPromieniu(
  mapa: Mapa,
  srodek: Punkt,
  promien: number,
  teren: Teren,
): number {
  let ile = 0;
  for (let dy = -promien; dy <= promien; dy++) {
    for (let dx = -promien; dx <= promien; dx++) {
      if (dx * dx + dy * dy > promien * promien) continue;
      const k = kafelekNa(mapa, srodek.x + dx, srodek.y + dy);
      if (k && k.teren === teren) ile++;
    }
  }
  return ile;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Woda i skała są nieprzechodnie. Las owszem — leśniczówka musi dojść do drzewa,
 * a ludzie chodzący dookoła całego boru wyglądaliby absurdalnie.
 */
function przechodniTeren(teren: Teren): boolean {
  return teren !== "woda" && teren !== "skala";
}

function zasobTerenu(teren: Teren, konfig: KonfiguracjaMapy): number {
  if (teren === "las") return DREWNA_Z_DRZEWA;
  if (teren === "glina") return konfig.glinaZasob;
  return 0;
}

function ustaw(
  mapa: Mapa,
  x: number,
  y: number,
  teren: Teren,
  konfig: KonfiguracjaMapy,
): void {
  if (!wGranicach(mapa, x, y)) return;
  const k = mapa.kafelki[indeks(mapa, x, y)];
  k.teren = teren;
  k.zasob = zasobTerenu(teren, konfig);
  k.przechodni = przechodniTeren(teren);
}

/**
 * Plama o poszarpanym brzegu: rdzeń zawsze, obrzeże z przeskokami. Idealne koła
 * na mapie widać na pierwszy rzut oka i psują wrażenie lasu.
 */
function plama(
  mapa: Mapa,
  los: Los,
  teren: Teren,
  srodek: Punkt,
  promien: number,
  konfig: KonfiguracjaMapy,
): void {
  const r2 = promien * promien;
  for (let dy = -promien; dy <= promien; dy++) {
    for (let dx = -promien; dx <= promien; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (d2 > r2 * 0.36 && los.nastepna() < 0.35) continue;
      ustaw(mapa, srodek.x + dx, srodek.y + dy, teren, konfig);
    }
  }
}

function rozsypPlamy(
  mapa: Mapa,
  los: Los,
  teren: Teren,
  ile: number,
  promienMin: number,
  promienMaks: number,
  konfig: KonfiguracjaMapy,
): void {
  for (let i = 0; i < ile; i++) {
    const srodek = {
      x: los.calkowita(1, mapa.szerokosc - 1),
      y: los.calkowita(1, mapa.wysokosc - 1),
    };
    const promien = los.calkowita(promienMin, promienMaks + 1);
    plama(mapa, los, teren, srodek, promien, konfig);
  }
}

/**
 * Rzeka płynie z północnej krawędzi i kończy się jeziorem mniej więcej w dwóch
 * trzecich mapy. Gdyby przecinała mapę na wylot, dzieliłaby ląd na dwie części
 * bez przeprawy i połowa terenu byłaby nieosiągalna dla A*. Jezioro zamiast
 * ujścia rozwiązuje to bez mostów, których na razie nie ma.
 */
function poprowadzRzeke(mapa: Mapa, los: Los, konfig: KonfiguracjaMapy): void {
  let x = los.calkowita(
    Math.floor(mapa.szerokosc * 0.3),
    Math.floor(mapa.szerokosc * 0.7),
  );
  const dlugosc = Math.floor(mapa.wysokosc * konfig.rzekaDlugosc);

  for (let y = 0; y < dlugosc; y++) {
    ustaw(mapa, x, y, "woda", konfig);
    ustaw(mapa, x + 1, y, "woda", konfig);
    x += los.calkowita(-1, 2);
    // Z dala od krawędzi: rzeka dobita do brzegu mapy odcina od osady wszystko,
    // co zostało po drugiej stronie.
    x = Math.max(4, Math.min(mapa.szerokosc - 6, x));
  }

  plama(mapa, los, "woda", { x, y: dlugosc }, konfig.jezioroPromien, konfig);
}

/**
 * Czy w tym miejscu da się postawić osadę: sucho, bez skał, z lasem i gliną
 * w zasięgu. Bez tego warunku start potrafi wypaść na cyplu przy jeziorze,
 * gdzie leśniczówka nie ma czego ciąć.
 */
function dobreMiejsceNaOsade(mapa: Mapa, p: Punkt, promien: number): boolean {
  if (policzWPromieniu(mapa, p, promien, "woda") > 0) return false;
  if (policzWPromieniu(mapa, p, promien, "skala") > 0) return false;
  if (policzWPromieniu(mapa, p, promien + 5, "las") < 15) return false;
  if (policzWPromieniu(mapa, p, promien + 8, "glina") < 3) return false;
  return true;
}

/** Karczuje polanę pod pierwszą osadę i zwraca jej środek. */
function wykarczujPolane(
  mapa: Mapa,
  los: Los,
  konfig: KonfiguracjaMapy,
): Punkt {
  const r = konfig.polanaPromien;
  let start: Punkt | null = null;

  for (let proba = 0; proba < 400 && !start; proba++) {
    const p = {
      x: los.calkowita(r + 2, mapa.szerokosc - r - 2),
      y: los.calkowita(r + 2, mapa.wysokosc - r - 2),
    };
    if (dobreMiejsceNaOsade(mapa, p, r)) start = p;
  }
  start ??= {
    x: Math.floor(mapa.szerokosc / 2),
    y: Math.floor(mapa.wysokosc / 2),
  };

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const k = kafelekNa(mapa, start.x + dx, start.y + dy);
      if (!k || k.teren === "woda") continue;
      ustaw(mapa, start.x + dx, start.y + dy, "laka", konfig);
    }
  }

  return start;
}

/**
 * Przekopuje najkrótszy korytarz od odciętego kawałka lądu do części osiągalnej
 * z osady. Szuka wszerz przez teren dowolny, więc trafia na najbliższe przejście,
 * i zamienia napotkane przeszkody w łąkę.
 *
 * Korytarz idzie wyłącznie prosto, nigdy na ukos: przejście po przekątnej byłoby
 * nieprzechodnie dla A*, który nie ścina rogów, i naprawa okazałaby się pozorna.
 */
function przekopKorytarz(
  mapa: Mapa,
  od: number,
  glowny: Uint8Array,
  konfig: KonfiguracjaMapy,
): void {
  const skad = new Int32Array(mapa.kafelki.length).fill(-1);
  const widziane = new Uint8Array(mapa.kafelki.length);
  const kolejka = [od];
  widziane[od] = 1;

  for (let g = 0; g < kolejka.length; g++) {
    const i = kolejka[g];

    if (glowny[i]) {
      let j = i;
      while (j !== -1 && j !== od) {
        const x = j % mapa.szerokosc;
        const y = (j - x) / mapa.szerokosc;
        if (!mapa.kafelki[j].przechodni) ustaw(mapa, x, y, "laka", konfig);
        j = skad[j];
      }
      return;
    }

    const x = i % mapa.szerokosc;
    const y = (i - x) / mapa.szerokosc;
    for (const [dx, dy] of PROSTE) {
      const nx = x + dx;
      const ny = y + dy;
      if (!wGranicach(mapa, nx, ny)) continue;
      const j = indeks(mapa, nx, ny);
      if (widziane[j]) continue;
      widziane[j] = 1;
      skad[j] = i;
      kolejka.push(j);
    }
  }
}

/**
 * Gwarantuje, że z osady da się dojść na każdy przechodni kafelek.
 *
 * Rzeka z jeziorem potrafi razem ze skałami zamknąć róg mapy — na jednym
 * ziarnie na kilka odcinało to nawet 15% lądu, czyli las i glinę, po które nikt
 * już nigdy nie przyszedł. Odsunięcie rzeki od krawędzi samo tego nie załatwia,
 * bo ścianę dopełniają skały, więc generator sprawdza spójność wprost i dokopuje
 * przejście tam, gdzie go brakuje.
 */
function zapewnijSpojnosc(
  mapa: Mapa,
  start: Punkt,
  konfig: KonfiguracjaMapy,
): void {
  let glowny = osiagalneOd(mapa, start);

  for (let i = 0; i < mapa.kafelki.length; i++) {
    if (!mapa.kafelki[i].przechodni || glowny[i]) continue;
    przekopKorytarz(mapa, i, glowny, konfig);
    glowny = osiagalneOd(mapa, start);
  }
}

export function generujMape(konfig: KonfiguracjaMapy, ziarno: number): Mapa {
  const los = utworzLos(ziarno);
  const kafelki: Kafelek[] = new Array(konfig.szerokosc * konfig.wysokosc);
  for (let i = 0; i < kafelki.length; i++) {
    kafelki[i] = { teren: "laka", zasob: 0, przechodni: true, zajetyPrzez: null };
  }

  const mapa: Mapa = {
    szerokosc: konfig.szerokosc,
    wysokosc: konfig.wysokosc,
    kafelki,
  };

  // Kolejność ma znaczenie: ziemia jest tłem, las i złoża kładą się na nią,
  // rzeka przecina wszystko, a polana karczuje to, co zostało pod osadą.
  rozsypPlamy(mapa, los, "ziemia", konfig.ziemiaPlam, konfig.ziemiaPromienMin, konfig.ziemiaPromienMaks, konfig);
  rozsypPlamy(mapa, los, "las", konfig.lasPlam, konfig.lasPromienMin, konfig.lasPromienMaks, konfig);
  rozsypPlamy(mapa, los, "glina", konfig.glinaPlam, konfig.glinaPromienMin, konfig.glinaPromienMaks, konfig);
  rozsypPlamy(mapa, los, "skala", konfig.skalaPlam, konfig.skalaPromienMin, konfig.skalaPromienMaks, konfig);
  poprowadzRzeke(mapa, los, konfig);
  mapa.start = wykarczujPolane(mapa, los, konfig);
  zapewnijSpojnosc(mapa, mapa.start, konfig);

  return mapa;
}
