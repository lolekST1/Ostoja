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

/** Drzwi budynku: lewy górny kafelek. Zawsze przechodni, bo budynki nie zamykają terenu. */
function drzwi(b: Budynek): Punkt {
  return { x: b.x, y: b.y };
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
    m.x = b.x;
    m.y = b.y;
    return;
  }

  m.dom = null;
  m.x = zapasowo.x;
  m.y = zapasowo.y;
}

/** Dokąd człowiekowi dziś po drodze: do pracy, a jak pracy nie ma — do domu. */
function cel(stan: StanGry, m: Mieszkaniec): Punkt | null {
  const praca = budynekPo(stan, m.miejscePracy);
  if (praca) return drzwi(praca);
  const dom = budynekPo(stan, m.dom);
  if (dom) return drzwi(dom);
  return stan.mapa.start ?? null;
}

/**
 * Przesuwa wszystkich o dzień drogi. Scena dopowiada ruch między dniami
 * płynnie, tu chodzi tylko o to, gdzie człowiek stoi na koniec dnia.
 */
export function ruszLudzi(stan: StanGry, _dane: Dane): void {
  if (stan.mapa.kafelki.length === 0) return; // narzędzie balansujące nie ma mapy

  for (const m of stan.mieszkancy) {
    const doKad = cel(stan, m);
    if (!doKad) {
      m.stan = "BEZCZYNNY";
      m.sciezka = [];
      continue;
    }

    const tu = { x: Math.round(m.x), y: Math.round(m.y) };
    if (tu.x === doKad.x && tu.y === doKad.y) {
      m.sciezka = [];
      m.stan = m.miejscePracy ? "PRACUJE" : "SPI";
      continue;
    }

    const ostatni = m.sciezka[m.sciezka.length - 1];
    if (!ostatni || ostatni.x !== doKad.x || ostatni.y !== doKad.y) {
      m.sciezka = znajdzSciezke(stan.mapa, tu, doKad) ?? [];
    }

    const kroki = Math.min(KAFELKOW_NA_DZIEN, m.sciezka.length);
    if (kroki > 0) {
      const przystanek = m.sciezka[kroki - 1];
      m.x = przystanek.x;
      m.y = przystanek.y;
      m.sciezka.splice(0, kroki);
    }
    m.stan = m.miejscePracy ? "IDZIE_DO_PRACY" : "IDZIE_DO_DOMU";
  }
}

/** Ilu dorosłych nie ma dziś żadnego przydziału. Do paska i do podpowiedzi. */
export function bezczynni(stan: StanGry, wiekDoroslosci: number): number {
  return stan.mieszkancy.filter(
    (m) => m.wiek >= wiekDoroslosci && m.miejscePracy === null,
  ).length;
}
