/**
 * Ostoja — osada jako całość: skąd biorą się ludzie i co znaczy zadowolenie.
 *
 * Powstało z etapu 1 z PLAN.md. Zasada, z której wynika reszta:
 *
 * > **Zasoby są ceną czynu, nie podatkiem od istnienia.**
 *
 * Nikt nie zjada nic codziennie. Jedzenie ma sens, bo jest ceną nowego osadnika,
 * i to jedyna rzecz, na którą schodzi. Bezczynność nie kosztuje nic — nigdy.
 *
 * Ten plik jest jednym źródłem prawdy dla trzech miejsc naraz: ticku, panelu
 * „gdzie się korkuje" i narzędzi balansujących. Gdyby panel liczył koszt
 * osadnika po swojemu, obiecywałby liczby, których tick nie dowozi — a panel,
 * który zgaduje, jest gorszy niż brak panelu.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type { IdUlepszenia, StanGry, Surowiec } from "./typy.ts";
import {
  DNI_W_PORZE,
  JADALNE,
  ZADOWOLENIE_MAKS,
  ZADOWOLENIE_SREDNIE,
} from "./typy.ts";
import type { Dane } from "./budynki.ts";
import { globalna, pole } from "./budynki.ts";

export const WIEK_DOROSLOSCI = 16;

// ---------------------------------------------------------------------------
// Osadnicy
// ---------------------------------------------------------------------------

/** Ile jedzenia (jagody i chleb razem) leży w spiżarni. */
export function zapasJedzenia(stan: StanGry): number {
  return JADALNE.reduce((suma, j) => suma + stan.pula[j], 0);
}

/**
 * Ile jedzenia trzeba mieć, żeby przyszedł następny osadnik.
 *
 * Rośnie z ludnością: dziesiąty tanio, trzydziesty wyraźnie drożej. Bez tego
 * trzydziesta chata jest równie tania jak druga i późna gra przestaje być
 * decyzją — zostaje dokładaniem trzydziestego pierwszego budynku.
 */
export function kosztOsadnika(
  dane: Dane,
  ulepszenia: IdUlepszenia[],
  ludnosc: number,
): number {
  const s = dane.stale.osadnik;
  const skala = Math.max(1, ludnosc) / s.bazaLudnosci;
  const bazowy = s.bazowy * Math.pow(skala, s.wykladnik);
  return globalna(dane, ulepszenia, "kosztOsadnika", bazowy);
}

/** Ile miejsc w chatach zostało wolnych. Ujemne nie ma sensu, więc zero. */
export function wolneMiejscaWChatach(stan: StanGry, dane: Dane): number {
  const naChate = pole(dane, stan.ulepszenia, "chata", "mieszkancow");
  const chat = stan.budynki.filter((b) => b.typ === "chata" && b.wybudowany).length;
  return Math.max(0, chat * naChate - stan.mieszkancy.length);
}

/** Dlaczego osadnik jeszcze nie przyszedł. null = przyjdzie, tylko wieść jeszcze idzie. */
export type BlokadaOsadnika = "dach" | "jedzenie" | "zadowolenie" | null;

export interface StanOsadnika {
  koszt: number;
  zapas: number;
  wolneMiejsca: number;
  /** 0..1 — jak daleko rozeszła się wieść. */
  wiesc: number;
  /** Ile wieść rośnie dziennie przy obecnym zadowoleniu. */
  tempo: number;
  /** Za ile dni przyjdzie. null, gdy coś stoi na drodze. */
  dniDoPrzybycia: number | null;
  blokada: BlokadaOsadnika;
}

/**
 * Wszystko, co gracz ma wiedzieć o następnym osadniku — jedną funkcją, bo pasek,
 * panel i tick pytają o to samo. Zasada 7 z PLAN.md: rosnący koszt musi być
 * widoczny, **zanim** zablokuje.
 */
export function stanOsadnika(stan: StanGry, dane: Dane): StanOsadnika {
  const koszt = kosztOsadnika(dane, stan.ulepszenia, stan.mieszkancy.length);
  const zapas = zapasJedzenia(stan);
  const wolneMiejsca = wolneMiejscaWChatach(stan, dane);
  const tempo = tempoWiesci(stan, dane);

  let blokada: BlokadaOsadnika = null;
  if (wolneMiejsca <= 0) blokada = "dach";
  else if (zapas < koszt) blokada = "jedzenie";
  else if (tempo <= 1e-9) blokada = "zadowolenie";

  const doPelna = Math.max(0, 1 - stan.wiesc);
  return {
    koszt,
    zapas,
    wolneMiejsca,
    wiesc: stan.wiesc,
    tempo,
    dniDoPrzybycia:
      blokada === null ? (tempo > 0 ? Math.ceil(doPelna / tempo) : null) : null,
    blokada,
  };
}

/** O ile wieść o osadzie rośnie dziennie. Zero przy zerowym zadowoleniu. */
export function tempoWiesci(stan: StanGry, dane: Dane): number {
  const s = dane.stale.osadnik;
  if (s.dniNaPrzybysza <= 0) return 1;
  return (1 / s.dniNaPrzybysza) * (stan.zadowolenie / ZADOWOLENIE_SREDNIE);
}

// ---------------------------------------------------------------------------
// Zapasy na zimę
// ---------------------------------------------------------------------------

export interface StanZapasow {
  /** Ile drewna i jedzenia trzeba odłożyć. */
  drewno: number;
  jedzenie: number;
  /** Czy jesteśmy w oknie decyzji (cała jesień). */
  otwarte: boolean;
  /** Ile dni zostało do zamknięcia okna. 0, gdy zamknięte. */
  dniDoKonca: number;
  zrobione: boolean;
  /** Czy stać osadę teraz. */
  stac: boolean;
  /** Czy właśnie trwa zima bez zapasów, czyli kara. */
  karaTrwa: boolean;
}

/**
 * Ile kosztuje przezimowanie. Rośnie wprost z ludnością, bo to zapas dla ludzi
 * — i dzięki temu duża osada musi się do zimy przygotować wcześniej niż mała.
 */
export function kosztZapasow(
  dane: Dane,
  ludnosc: number,
): { drewno: number; jedzenie: number } {
  const s = dane.stale.zapasy;
  return {
    drewno: Math.ceil(ludnosc * s.drewnoNaOsobe),
    jedzenie: Math.ceil(ludnosc * s.jedzenieNaOsobe),
  };
}

export function stanZapasow(stan: StanGry, dane: Dane): StanZapasow {
  const koszt = kosztZapasow(dane, stan.mieszkancy.length);
  const otwarte = stan.czas.pora === "jesien";
  // Okno to cała jesień. Ostatni jej dzień jest ostatnią chwilą na decyzję.
  const dniDoKonca = otwarte ? DNI_W_PORZE * 3 - stan.czas.dzien : 0;

  return {
    drewno: koszt.drewno,
    jedzenie: koszt.jedzenie,
    otwarte,
    dniDoKonca,
    zrobione: stan.zapasyNaZime,
    stac: stan.pula.drewno >= koszt.drewno && zapasJedzenia(stan) >= koszt.jedzenie,
    karaTrwa: stan.czas.pora === "zima" && !stan.zapasyNaZime,
  };
}

/**
 * Odkłada zapasy. Zwraca `false`, gdy nie ma na to warunków — okno zamknięte,
 * już zrobione albo nie stać. Wołane z interfejsu i z narzędzi balansujących,
 * nigdy z ticku: to jest **decyzja gracza**, a nie coś, co dzieje się samo.
 */
export function zrobZapasy(stan: StanGry, dane: Dane): boolean {
  const z = stanZapasow(stan, dane);
  if (!z.otwarte || z.zrobione || !z.stac) return false;

  stan.pula.drewno -= z.drewno;

  // Jagody idą pierwsze, bo się psują — tak samo jak przy osadniku.
  let doOdlozenia = z.jedzenie;
  for (const jedzenie of JADALNE) {
    const jest = Math.min(stan.pula[jedzenie], doOdlozenia);
    stan.pula[jedzenie] -= jest;
    doOdlozenia -= jest;
    if (doOdlozenia <= 1e-9) break;
  }

  stan.zapasyNaZime = true;
  return true;
}

/**
 * Mnożnik pracy poza dachem. Zima bez zapasów zostawia z niej ułamek —
 * ale wyłącznie tam, gdzie wychodzi się na mróz. Warsztaty pracują pod dachem
 * i idą normalnie, bo inaczej kara zatrzymywałaby cały łańcuch produkcyjny,
 * a ma zabrać kwartał rozwoju, nie unieruchomić osadę.
 */
export function mnoznikZimowy(stan: StanGry, dane: Dane): number {
  if (stan.czas.pora !== "zima" || stan.zapasyNaZime) return 1;
  return dane.stale.zapasy.mnoznikBezZapasow;
}

// ---------------------------------------------------------------------------
// Zadowolenie
// ---------------------------------------------------------------------------

export interface SkladnikZadowolenia {
  powod: string;
  ile: number;
}

/**
 * Z czego składa się zadowolenie **dziś**. Zwraca powody, nie samą liczbę:
 * pasek pokazujący „zadowolenie 41" bez wyjaśnienia jest zagadką, a nie
 * informacją, a zagadek ta gra nie zadaje (zasada 6 z CLAUDE.md).
 */
export function skladnikiZadowolenia(
  stan: StanGry,
  dane: Dane,
): { cel: number; skladniki: SkladnikZadowolenia[] } {
  const s = dane.stale.zadowolenie;
  const skladniki: SkladnikZadowolenia[] = [];

  const koszt = kosztOsadnika(dane, stan.ulepszenia, stan.mieszkancy.length);
  const zapas = zapasJedzenia(stan);

  if (zapas <= 0.5) {
    skladniki.push({ powod: "spiżarnia świeci pustkami", ile: s.spizarniaPusta });
  } else if (zapas >= koszt * 2) {
    skladniki.push({ powod: "spiżarnia pełna", ile: s.spizarniaPelna });
  } else if (zapas >= koszt) {
    skladniki.push({ powod: "jedzenia starczy dla osadnika", ile: s.spizarniaStarczy });
  }

  if (stan.budynki.some((b) => b.typ === "kapliczka" && b.wybudowany)) {
    skladniki.push({ powod: "kapliczka", ile: s.kapliczka });
  }
  if (stan.budynki.some((b) => b.typ === "bajarz" && b.wybudowany)) {
    skladniki.push({ powod: "bajarz opowiada", ile: s.bajarz });
  }
  if (stan.duchy.leszyBlokuje) {
    skladniki.push({ powod: "leszy się gniewa", ile: s.gniewDucha });
  }

  const bezRoboty = stan.mieszkancy.filter(
    (m) => m.wiek >= WIEK_DOROSLOSCI && m.miejscePracy === null,
  ).length;
  if (bezRoboty > 0) {
    skladniki.push({
      powod: `${bezRoboty} bez roboty`,
      ile: Math.max(s.bezRobotyMaks, s.bezRoboty * bezRoboty),
    });
  }

  // Chuda zima to teraz zima bez zapasów, a nie sama pusta spiżarnia. Kara jest
  // za niezrobioną robotę jesienią, nie za to, że akurat jest zimno.
  if (stan.czas.pora === "zima" && !stan.zapasyNaZime) {
    skladniki.push({ powod: "zima bez zapasów", ile: s.chudaZima });
  }

  const suma = skladniki.reduce((c, k) => c + k.ile, s.podstawa);
  return { cel: ograniczenie(suma), skladniki };
}

/** Zadowolenie idzie do celu po `tempo` punktów na dzień, nie skacze. */
export function przesunZadowolenie(stan: StanGry, dane: Dane): number {
  const { cel } = skladnikiZadowolenia(stan, dane);
  const tempo = dane.stale.zadowolenie.tempo;
  const roznica = cel - stan.zadowolenie;
  const krok = Math.max(-tempo, Math.min(tempo, roznica));
  stan.zadowolenie = ograniczenie(stan.zadowolenie + krok);
  return stan.zadowolenie;
}

function ograniczenie(x: number): number {
  return Math.max(0, Math.min(ZADOWOLENIE_MAKS, x));
}

// ---------------------------------------------------------------------------
// Domowik
// ---------------------------------------------------------------------------

/** Co domowik podbiera. Jagód nie rusza — psują się szybciej, niż zdąży. */
export const KRADZIONE: readonly Surowiec[] = [
  "drewno",
  "deska",
  "glina",
  "cegla",
  "zboze",
  "maka",
  "chleb",
];

/**
 * Ile domowik zabiera dziennie po tygodniach zaniedbania. **Kwota, nie procent.**
 *
 * Procent liczony od magazynu, którego nikt już nie opróżnia, rósł razem z nim:
 * osiem procent pełnej spiżarni to więcej, niż osada wyrabia przez cały dzień,
 * i domowik zostawał jedynym przeciwnikiem w grze. Kwota rośnie z zaniedbaniem,
 * a nie z zamożnością — karze za to, o co chodzi.
 *
 * Udział jest hamulcem od dołu, nie regułą. Sama kwota jest łagodna dla
 * bogatych i zabójcza dla biednych: osada z dwudziestoma polanami traciła je
 * w dwa dni, a kapliczka — jedyne wyjście z tej pętli — kosztuje desek i cegieł,
 * czyli tartaku, czyli drewna. Klasyczna pułapka bez wyjścia.
 */
export function kwotaDomowika(
  dane: Dane,
  tygodnieZaniedbania: number,
  wMagazynie: number,
): number {
  const s = dane.stale.domowik;
  const zZaniedbania =
    s.kwotaBazowa + s.przyrostNaTydzien * Math.floor(tygodnieZaniedbania);
  return Math.min(s.kwotaMaks, zZaniedbania, wMagazynie * s.udzialMaks);
}

/** Ile w ogóle leży tego, co domowik rusza. */
export function doKradzieniaWMagazynie(pula: Record<Surowiec, number>): number {
  return KRADZIONE.reduce((suma, s) => suma + pula[s], 0);
}

/**
 * Zabiera `kwota` jednostek, zaczynając od najgrubszej kupki. Zwraca, ile
 * naprawdę wziął. Od największej, żeby strata była widoczna, ale nie wymiotła
 * jedynego surowca, na który osada właśnie zbierała.
 */
export function zabierzZMagazynu(
  pula: Record<Surowiec, number>,
  kwota: number,
): number {
  let zostalo = kwota;
  let wziete = 0;

  while (zostalo > 1e-9) {
    let najgrubsza: Surowiec | null = null;
    for (const s of KRADZIONE) {
      if (pula[s] <= 1e-9) continue;
      if (najgrubsza === null || pula[s] > pula[najgrubsza]) najgrubsza = s;
    }
    if (najgrubsza === null) break;

    const bierz = Math.min(pula[najgrubsza], zostalo);
    pula[najgrubsza] -= bierz;
    zostalo -= bierz;
    wziete += bierz;
  }

  return wziete;
}
