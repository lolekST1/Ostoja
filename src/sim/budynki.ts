/**
 * Ostoja — budynki.
 *
 * Zasada: definicje z dane/budynki.json nie są nigdy zmieniane. Ulepszenia
 * nakładają się dopiero w momencie liczenia. Dzięki temu interfejs może
 * pokazać "4 chleby zamiast 3", bo obie liczby wciąż istnieją, a cofnięcie
 * ulepszenia to usunięcie jednego wpisu z listy.
 */

import type {
  DefinicjaBudynku,
  DefinicjaUlepszenia,
  IdUlepszenia,
  Koszt,
  PoleBudynku,
  PoleGlobalne,
  Receptura,
  StaleGry,
  StartGry,
  Surowiec,
  TypBudynku,
} from "./typy.ts";

export interface Dane {
  budynki: Record<TypBudynku, DefinicjaBudynku>;
  ulepszenia: DefinicjaUlepszenia[];
  stale: StaleGry & {
    start: StartGry;
    moznikiPorRoku: Record<string, Record<string, number>>;
  };
}

/** Wszystkie efekty aktywnych ulepszeń, spłaszczone. */
function aktywneEfekty(dane: Dane, wykupione: IdUlepszenia[]) {
  return dane.ulepszenia
    .filter((u) => wykupione.includes(u.id))
    .flatMap((u) => u.efekty);
}

/**
 * Wartość pola budynku po ulepszeniach.
 * Kolejność: baza -> dodawanie -> mnożenie. Ustalona raz i nie do zmiany,
 * bo od niej zależy, czy "wóz i ścieżki" plus przyszły mnożnik promienia
 * dadzą przewidywalny wynik.
 */
export function pole(
  dane: Dane,
  wykupione: IdUlepszenia[],
  typ: TypBudynku,
  nazwaPola: PoleBudynku,
): number {
  const def = dane.budynki[typ];
  let wartosc: number;

  switch (nazwaPola) {
    case "szybkosc":
      wartosc = 1;
      break;
    case "promien":
      wartosc = def.promien;
      break;
    case "sadziDrzew":
      wartosc = def.sadziDrzew ?? 0;
      break;
    case "mieszkancow":
      wartosc = def.mieszkancow ?? 0;
      break;
    case "plon":
      wartosc = def.plon ?? 0;
      break;
  }

  const efekty = aktywneEfekty(dane, wykupione);

  for (const e of efekty) {
    if (e.operacja === "dodaj" && e.budynek === typ && e.pole === nazwaPola) {
      wartosc += e.wartosc;
    }
  }
  for (const e of efekty) {
    if (e.operacja === "mnoznik" && e.budynek === typ && e.pole === nazwaPola) {
      wartosc *= e.wartosc;
    }
  }

  return wartosc;
}

/** Receptura po ulepszeniach: podmienione wyjścia i skrócony czas cyklu. */
export function efektywnaReceptura(
  dane: Dane,
  wykupione: IdUlepszenia[],
  typ: TypBudynku,
): Receptura | null {
  const bazowa = dane.budynki[typ].receptura;
  if (!bazowa) return null;

  const wyjscie: Koszt = { ...bazowa.wyjscie };
  for (const e of aktywneEfekty(dane, wykupione)) {
    if (e.operacja === "ustawWyjscie" && e.budynek === typ) {
      wyjscie[e.surowiec as Surowiec] = e.wartosc;
    }
  }

  return {
    wejscie: { ...bazowa.wejscie },
    wyjscie,
    dni: bazowa.dni / pole(dane, wykupione, typ, "szybkosc"),
  };
}

/**
 * Liczba globalna po ulepszeniach. Kolejność jak przy polach budynku:
 * najpierw podmiana wartości, potem mnożniki.
 *
 * `baza` przychodzi z zewnątrz, a nie z `dane.stale[nazwa]`, bo jedyna taka
 * liczba — koszt osadnika — nie jest stałą, tylko krzywą zależną od ludności
 * (patrz `kosztOsadnika` w osada.ts).
 */
export function globalna(
  dane: Dane,
  wykupione: IdUlepszenia[],
  nazwa: PoleGlobalne,
  baza: number,
): number {
  let wartosc = baza;
  const efekty = aktywneEfekty(dane, wykupione);
  for (const e of efekty) {
    if (e.operacja === "ustawGlobalne" && e.pole === nazwa) wartosc = e.wartosc;
  }
  for (const e of efekty) {
    if (e.operacja === "mnoznikGlobalny" && e.pole === nazwa) wartosc *= e.wartosc;
  }
  return wartosc;
}

// ---------------------------------------------------------------------------
// Kupowanie
// ---------------------------------------------------------------------------

/**
 * Ulepszenia w kolejności, w jakiej mają stać na liście: od najtańszego.
 * Wykupione zostają widoczne — „co już umiem" jest częścią odpowiedzi na
 * pytanie „co dalej", a znikająca pozycja wygląda jak zgubiona.
 */
export function ulepszeniaPoKoszcie(dane: Dane): DefinicjaUlepszenia[] {
  return [...dane.ulepszenia].sort((a, b) => a.koszt - b.koszt);
}

export function ulepszenieDostepne(
  stan: { ulepszenia: IdUlepszenia[]; pula: { opowiesc: number } },
  dane: Dane,
  id: IdUlepszenia,
): boolean {
  if (stan.ulepszenia.includes(id)) return false;
  const def = dane.ulepszenia.find((u) => u.id === id);
  return def !== undefined && stan.pula.opowiesc >= def.koszt;
}

/**
 * Wykupienie ulepszenia. Jedna funkcja dla gry i dla narzędzi balansujących —
 * gdyby każde liczyło po swojemu, pomiar dotyczyłby innej gry niż ta, w którą
 * się gra. Zwraca false, gdy nie stać albo już jest.
 */
export function kupUlepszenie(
  stan: { ulepszenia: IdUlepszenia[]; pula: { opowiesc: number } },
  dane: Dane,
  id: IdUlepszenia,
): boolean {
  if (!ulepszenieDostepne(stan, dane, id)) return false;
  const def = dane.ulepszenia.find((u) => u.id === id)!;
  stan.pula.opowiesc -= def.koszt;
  stan.ulepszenia.push(id);
  return true;
}
