/**
 * Ostoja — ludzie: dach nad głową i chodzenie po mapie.
 *
 * **Chodzenie jest warstwą widoku, nie ekonomii.** Produkcja liczy się z
 * przydziału pracy (kto gdzie jest zapisany), a nie z tego, czy człowiek zdążył
 * dojść. Gdyby zależała od dojścia, narzedzia/symuluj.ts — które mapy nie ma —
 * przestałoby mówić prawdę o bilansie, a to ono, nie granie w przeglądarce,
 * ustawia liczby w tej grze. Dlatego ruszLudzi() woła warstwa przeglądarki po
 * ticku, a nie sam tick.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type { Budynek, Mieszkaniec, Punkt, StanGry } from "./typy.ts";
import type { Dane } from "./budynki.ts";
import { pole as polePo } from "./budynki.ts";
import { znajdzSciezke } from "./szukanie.ts";

/**
 * Ile kafelków człowiek przechodzi w ciągu dnia. Osada mieści się w kilkunastu
 * kafelkach, więc przy tej wartości droga do pracy zajmuje najwyżej dzień lub
 * dwa i widać ruch, a nie teleportację.
 */
const KAFELKOW_NA_DZIEN = 8;

/**
 * Drzwi budynku: kafelek pośrodku dolnej krawędzi. Zawsze przechodni, bo
 * budynki nie zamykają terenu.
 *
 * Dolnej, a nie górnej, odkąd budynki są rysunkami: wejście jest na obrazku od
 * frontu, więc ludzie zbierający się przy lewym górnym rogu stali dosłownie
 * na dachu.
 */
export function drzwiBudynku(b: Budynek, dane: Dane): Punkt {
  const def = dane.budynki[b.typ];
  return {
    x: b.x + Math.floor((def.szerokosc - 1) / 2),
    y: b.y + def.wysokosc - 1,
  };
}

function budynekPo(stan: StanGry, id: string | null): Budynek | undefined {
  if (id === null) return undefined;
  return stan.budynki.find((b) => b.id === id);
}

/**
 * Wsadza człowieka do chaty, w której jest jeszcze miejsce. Wołane i przy
 * zakładaniu osady, i przy każdym przybyszu — bezdomny przybysz stałby w rogu
 * mapy i wyglądałby jak błąd.
 */
export function zakwateruj(
  stan: StanGry,
  dane: Dane,
  m: Mieszkaniec,
  zapasowo: Punkt,
): void {
  const mieszkancowWChacie = polePo(dane, stan.ulepszenia, "chata", "mieszkancow");

  for (const b of stan.budynki) {
    if (b.typ !== "chata" || !b.wybudowany) continue;
    const zajete = stan.mieszkancy.filter((inny) => inny.dom === b.id).length;
    if (zajete >= mieszkancowWChacie) continue;
    m.dom = b.id;
    const d = drzwiBudynku(b, dane);
    m.x = d.x;
    m.y = d.y;
    m.trasa = [];
    return;
  }

  m.dom = null;
  m.x = zapasowo.x;
  m.y = zapasowo.y;
  m.trasa = [];
}

/** Dokąd człowiekowi dziś po drodze: do pracy, a jak pracy nie ma — do domu. */
function cel(stan: StanGry, dane: Dane, m: Mieszkaniec): Punkt | null {
  const praca = budynekPo(stan, m.miejscePracy);
  if (praca) return drzwiBudynku(praca, dane);
  const dom = budynekPo(stan, m.dom);
  if (dom) return drzwiBudynku(dom, dane);
  return stan.mapa.start ?? null;
}

/**
 * Przesuwa wszystkich o dzień drogi.
 *
 * Zostawia po sobie `m.trasa`: kafelki, przez które człowiek dziś przeszedł,
 * licząc od miejsca porannego. Scena przeprowadza go tą drogą jednostajnie
 * przez cały dzień. Bez zapisanej trasy scena zna tylko punkt początkowy
 * i końcowy, a prosta między nimi potrafi przeciąć rzekę albo skałę — stąd
 * wrażenie skakania zamiast chodzenia.
 */
export function ruszLudzi(stan: StanGry, dane: Dane): void {
  if (stan.mapa.kafelki.length === 0) return; // narzędzie balansujące nie ma mapy

  for (const m of stan.mieszkancy) {
    const doKad = cel(stan, dane, m);
    if (!doKad) {
      m.stan = "BEZCZYNNY";
      m.sciezka = [];
      m.trasa = [];
      continue;
    }

    const tu = { x: Math.round(m.x), y: Math.round(m.y) };
    if (tu.x === doKad.x && tu.y === doKad.y) {
      m.sciezka = [];
      m.trasa = [];
      m.stan = m.miejscePracy ? "PRACUJE" : "SPI";
      continue;
    }

    const ostatni = m.sciezka[m.sciezka.length - 1];
    if (!ostatni || ostatni.x !== doKad.x || ostatni.y !== doKad.y) {
      m.sciezka = znajdzSciezke(stan.mapa, tu, doKad) ?? [];
    }

    const kroki = Math.min(KAFELKOW_NA_DZIEN, m.sciezka.length);
    if (kroki > 0) {
      m.trasa = [tu, ...m.sciezka.slice(0, kroki)];
      const przystanek = m.sciezka[kroki - 1];
      m.x = przystanek.x;
      m.y = przystanek.y;
      m.sciezka.splice(0, kroki);
    } else {
      m.trasa = [];
    }
    m.stan = m.miejscePracy ? "IDZIE_DO_PRACY" : "IDZIE_DO_DOMU";
  }
}

/**
 * Czy człowiek stoi już w drzwiach swojego miejsca pracy. Używa tego wyłącznie
 * budowa (patrz `Swiat.obecniNaBudowie`) — produkcja liczy się z przydziału,
 * nigdy z dojścia (zasada 8).
 */
export function stoiPrzy(m: Mieszkaniec, b: Budynek, dane: Dane): boolean {
  const d = drzwiBudynku(b, dane);
  return Math.round(m.x) === d.x && Math.round(m.y) === d.y;
}

/** Ilu dorosłych nie ma dziś żadnego przydziału. Do paska i do podpowiedzi. */
export function bezczynni(stan: StanGry, wiekDoroslosci: number): number {
  return stan.mieszkancy.filter(
    (m) => m.wiek >= wiekDoroslosci && m.miejscePracy === null,
  ).length;
}
