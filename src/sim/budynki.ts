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

/** Stała globalna po ulepszeniach (na razie tylko chlebNaOsobe). */
export function globalna(
  dane: Dane,
  wykupione: IdUlepszenia[],
  nazwa: PoleGlobalne,
): number {
  let wartosc = dane.stale[nazwa];
  for (const e of aktywneEfekty(dane, wykupione)) {
    if (e.operacja === "ustawGlobalne" && e.pole === nazwa) {
      wartosc = e.wartosc;
    }
  }
  return wartosc;
}
