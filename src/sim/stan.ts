/**
 * Ostoja — nowa gra, zapis i odczyt.
 *
 * Ten plik jest czysty: zamienia stan gry w tekst i z powrotem, ale sam niczego
 * nigdzie nie zapisuje. localStorage siedzi w src/zapis.ts, bo symulacja musi
 * dać się uruchomić w Node, gdzie żadnego localStorage nie ma.
 *
 * Zapis jest wersjonowany. Gdy zmieni się schemat, podbija się WERSJA_ZAPISU
 * w typy.ts i dopisuje migrację do tablicy MIGRACJE — stare zapisy mają wtedy
 * szansę przeżyć zamiast wysypać grę.
 */

import type {
  Dane,
} from "./budynki.ts";
import type {
  Kafelek,
  KonfiguracjaMapy,
  Mapa,
  Punkt,
  StanGry,
  Surowiec,
  Teren,
} from "./typy.ts";
import {
  DNI_W_ROKU,
  WERSJA_ZAPISU,
  ZADOWOLENIE_SREDNIE,
  pustaPula,
} from "./typy.ts";
import { generujMape, wolneMiejsce } from "./mapa.ts";
import { postawBudynek } from "./budowa.ts";
import { zakwateruj } from "./ludzie.ts";
import { skladnikiZadowolenia } from "./osada.ts";
import { spakujBor } from "./zakonczenia.ts";
import { utworzLos } from "./los.ts";
import { nowyMieszkaniec } from "./tick.ts";

// ---------------------------------------------------------------------------
// Nowa gra
// ---------------------------------------------------------------------------

/**
 * Buduje stan startowy: mapa z ziarna, budynki początkowe na polanie, ludzie
 * pod dachem i zapasy z dane/stale.json.
 *
 * Budynki zajmują kafelki (`zajetyPrzez`), ale ich nie zamykają. Gdyby budynek
 * czynił kafelek nieprzechodnim, ciasna zabudowa polany potrafiłaby odciąć
 * kawałek terenu — a spójność mapy jest sprawdzana tylko przy generowaniu.
 */
export function nowaGra(
  dane: Dane,
  konfigMapy: KonfiguracjaMapy,
  ziarno: number,
): StanGry {
  const los = utworzLos(ziarno);
  const mapa = generujMape(konfigMapy, ziarno);
  const srodek = mapa.start ?? {
    x: Math.floor(mapa.szerokosc / 2),
    y: Math.floor(mapa.wysokosc / 2),
  };

  const stan: StanGry = {
    wersja: WERSJA_ZAPISU,
    czas: { dzien: 0, rok: 0, pora: "wiosna" },
    // Osada zaczyna na pauzie. Dziecko ma zdążyć przeczytać, co robi który
    // budynek, zanim zacznie ubywać jedzenia i opału — a czytanie przy
    // płynącym czasie kosztowało surowce, których jeszcze nie umie zdobyć.
    predkosc: 0,
    pula: pustaPula(),
    pojemnosc: 0,
    mapa,
    budynki: [],
    mieszkancy: [],
    // Ustawiane na końcu, gdy stoją już chaty i leżą zapasy: zadowolenie
    // zaczyna od tego, na co osada zasługuje, a nie od okrągłej liczby.
    zadowolenie: ZADOWOLENIE_SREDNIE,
    wiesc: 0,
    zapasyNaZime: false,
    zimyZZapasami: 0,
    ulepszenia: [],
    duchy: {
      wycieteDrzewa: new Array(DNI_W_ROKU).fill(0),
      posadzoneDrzewa: new Array(DNI_W_ROKU).fill(0),
      leszyBlokuje: false,
      przymierzeLeszy: false,
      poludnicaDni: {},
      wodnikSieOdezwal: false,
      domowikMiska: false,
      domowikZaniedbanieTygodni: 0,
      dniBezKradziezy: 0,
      przymierzeDomowik: false,
    },
    kodeks: [],
    ziarno,
    ziarnoMapy: ziarno,
  };

  for (const [surowiec, ile] of Object.entries(dane.stale.start.pula)) {
    stan.pula[surowiec as Surowiec] = ile;
  }

  let nr = 0;
  for (const typ of dane.stale.start.budynki) {
    const def = dane.budynki[typ];
    const rog = wolneMiejsce(mapa, srodek, def.szerokosc, def.wysokosc);
    if (!rog) continue;
    // Osada początkowa stoi gotowa od pierwszego dnia — nikt nie budował jej
    // na oczach gracza.
    postawBudynek(stan, dane, typ, rog, `b_${nr++}`, true);
  }

  for (let i = 0; i < dane.stale.start.mieszkancy; i++) {
    const m = nowyMieszkaniec(`os_${i}`, los, 20 + los.calkowita(0, 15));
    zakwateruj(stan, dane, m, srodek);
    stan.mieszkancy.push(m);
  }

  stan.zadowolenie = skladnikiZadowolenia(stan, dane).cel;
  // Migawka boru z pierwszego dnia — po budynkach startowych, bo polana pod
  // nimi też jest częścią tego, co osada zastała. Ekran końcowy pokaże ją obok
  // boru z dnia ostatniego.
  stan.borNaStarcie = spakujBor(stan);

  stan.ziarno = los.ziarno();
  return stan;
}

// ---------------------------------------------------------------------------
// Pakowanie mapy
// ---------------------------------------------------------------------------

/**
 * Mapa w zapisie idzie ciasno: teren i przechodniość jako łańcuchy znaków,
 * zasoby jako tablica liczb, zajętość tylko dla kafelków faktycznie zajętych.
 * Zapisana wprost, jako 1600 obiektów, ważyłaby kilkanaście razy tyle.
 *
 * Przechodniości nie odtwarzamy z terenu, tylko zapisujemy wprost — generator
 * przekopuje korytarze, a przyszłe mechaniki mogą zmieniać ją niezależnie.
 */
const LITERY: Record<Teren, string> = {
  las: "L",
  laka: "K",
  glina: "G",
  woda: "W",
  skala: "S",
  ziemia: "Z",
};

const TERENY: Record<string, Teren> = Object.fromEntries(
  Object.entries(LITERY).map(([teren, litera]) => [litera, teren as Teren]),
) as Record<string, Teren>;

interface MapaSpakowana {
  szerokosc: number;
  wysokosc: number;
  teren: string;
  przechodni: string;
  zasob: number[];
  zajete: Record<string, string>;
  start?: Punkt;
}

function spakujMape(mapa: Mapa): MapaSpakowana {
  let teren = "";
  let przechodni = "";
  const zasob: number[] = [];
  const zajete: Record<string, string> = {};

  for (let i = 0; i < mapa.kafelki.length; i++) {
    const k = mapa.kafelki[i];
    teren += LITERY[k.teren];
    przechodni += k.przechodni ? "1" : "0";
    zasob.push(k.zasob);
    if (k.zajetyPrzez !== null) zajete[i] = k.zajetyPrzez;
  }

  return {
    szerokosc: mapa.szerokosc,
    wysokosc: mapa.wysokosc,
    teren,
    przechodni,
    zasob,
    zajete,
    ...(mapa.start ? { start: mapa.start } : {}),
  };
}

function rozpakujMape(spakowana: MapaSpakowana): Mapa {
  const ile = spakowana.szerokosc * spakowana.wysokosc;
  if (
    spakowana.teren.length !== ile ||
    spakowana.przechodni.length !== ile ||
    spakowana.zasob.length !== ile
  ) {
    throw new Error("zapis mapy ma niewłaściwą długość");
  }

  const kafelki: Kafelek[] = new Array(ile);
  for (let i = 0; i < ile; i++) {
    const teren = TERENY[spakowana.teren[i]];
    if (!teren) throw new Error(`nieznany teren w zapisie: ${spakowana.teren[i]}`);
    kafelki[i] = {
      teren,
      zasob: spakowana.zasob[i],
      przechodni: spakowana.przechodni[i] === "1",
      zajetyPrzez: spakowana.zajete[i] ?? null,
    };
  }

  return {
    szerokosc: spakowana.szerokosc,
    wysokosc: spakowana.wysokosc,
    kafelki,
    ...(spakowana.start ? { start: spakowana.start } : {}),
  };
}

// ---------------------------------------------------------------------------
// Zapis i odczyt
// ---------------------------------------------------------------------------

export function doTekstu(stan: StanGry): string {
  return JSON.stringify({ ...stan, mapa: spakujMape(stan.mapa) });
}

export type WynikOdczytu =
  | { ok: true; stan: StanGry }
  | { ok: false; powod: string };

/**
 * Migracje starych zapisów. Klucz to wersja, z której migrujemy; funkcja ma
 * zwrócić dane w wersji o jeden wyższej.
 */
const MIGRACJE: Record<number, (surowy: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 -> 2: doszła południca i wodnik, więc stan duchów ma dwa nowe pola.
  // Zapis z pierwszej wersji nic o nich nie wie i bez tego wysypywałby grę.
  1(surowy) {
    const duchy = (surowy.duchy ?? {}) as Record<string, unknown>;
    duchy.poludnicaDni ??= {};
    duchy.wodnikSieOdezwal ??= false;
    return { ...surowy, duchy, wersja: 2 };
  },

  // 2 -> 3: koniec zużycia surowców (etap 1 z PLAN.md). Znika `glod` — nikt
  // już nie odchodzi z osady z głodu ani z zimna — a dochodzi zadowolenie
  // i wieść, po której przychodzą osadnicy. Wczytana osada startuje ze środka
  // skali i w kilka dni dojdzie tam, gdzie ją stawiają jej własne warunki.
  2(surowy) {
    const mieszkancy = Array.isArray(surowy.mieszkancy) ? surowy.mieszkancy : [];
    for (const m of mieszkancy as Record<string, unknown>[]) delete m.glod;
    return {
      ...surowy,
      mieszkancy,
      zadowolenie: typeof surowy.zadowolenie === "number"
        ? surowy.zadowolenie
        : ZADOWOLENIE_SREDNIE,
      wiesc: typeof surowy.wiesc === "number" ? surowy.wiesc : 0,
      wersja: 3,
    };
  },

  // 3 -> 4: zapasy na zimę (etap 2 z PLAN.md). Wczytana osada wchodzi w zimę
  // bez zapasów — nie ma jak zgadnąć, czy je robiła, a udawanie, że robiła,
  // dałoby jej za darmo kwartał, o który reszta gra.
  3(surowy) {
    return {
      ...surowy,
      zapasyNaZime:
        typeof surowy.zapasyNaZime === "boolean" ? surowy.zapasyNaZime : false,
      zimyZZapasami:
        typeof surowy.zimyZZapasami === "number" ? surowy.zimyZZapasami : 0,
      wersja: 4,
    };
  },

  // 4 -> 5: ekran końcowy porównuje bór z pierwszego dnia z borem z ostatniego
  // (etap 3 z PLAN.md). Zapis sprzed tej zmiany migawki nie ma i mieć nie
  // może — dla takiej osady „las jak na starcie" znaczy „las jak dziś",
  // czyli zakończenie „żyła z lasem" dostaje z urzędu. Lepsze to niż
  // ogłoszenie jej, że wycięła bór, o którym nic nie wiemy.
  4(surowy) {
    return { ...surowy, wersja: 5 };
  },
};

export function zTekstu(tekst: string): WynikOdczytu {
  let surowy: Record<string, unknown>;
  try {
    surowy = JSON.parse(tekst);
  } catch {
    return { ok: false, powod: "zapis jest uszkodzony (nie da się go odczytać)" };
  }

  if (typeof surowy !== "object" || surowy === null) {
    return { ok: false, powod: "zapis jest pusty" };
  }

  let wersja = typeof surowy.wersja === "number" ? surowy.wersja : 0;
  if (wersja > WERSJA_ZAPISU) {
    return {
      ok: false,
      powod: `zapis pochodzi z nowszej wersji gry (${wersja} > ${WERSJA_ZAPISU})`,
    };
  }

  while (wersja < WERSJA_ZAPISU) {
    const migracja = MIGRACJE[wersja];
    if (!migracja) {
      return { ok: false, powod: `nie umiem odczytać zapisu w wersji ${wersja}` };
    }
    surowy = migracja(surowy);
    wersja = typeof surowy.wersja === "number" ? surowy.wersja : wersja + 1;
  }

  if (typeof surowy.mapa !== "object" || surowy.mapa === null) {
    return { ok: false, powod: "zapis jest niekompletny: brakuje mapy" };
  }

  try {
    const stan = {
      ...surowy,
      mapa: rozpakujMape(surowy.mapa as MapaSpakowana),
    } as unknown as StanGry;
    const brak = czegoBrakuje(stan);
    if (brak) return { ok: false, powod: `zapis jest niekompletny: brakuje ${brak}` };
    return { ok: true, stan };
  } catch (blad) {
    return { ok: false, powod: `zapis jest uszkodzony (${(blad as Error).message})` };
  }
}

/** Zgrubne sprawdzenie, czy w odczytanym stanie jest wszystko, czego gra dotknie. */
function czegoBrakuje(stan: StanGry): string | null {
  if (!stan.czas || typeof stan.czas.dzien !== "number") return "czasu";
  if (!stan.pula || typeof stan.pula.drewno !== "number") return "puli surowców";
  if (!Array.isArray(stan.budynki)) return "budynków";
  if (!Array.isArray(stan.mieszkancy)) return "mieszkańców";
  if (!Array.isArray(stan.ulepszenia)) return "ulepszeń";
  if (!stan.duchy || !Array.isArray(stan.duchy.wycieteDrzewa)) return "stanu duchów";
  if (typeof stan.zadowolenie !== "number") return "zadowolenia osady";
  if (typeof stan.ziarno !== "number") return "ziarna losowania";
  if (!stan.mapa || stan.mapa.kafelki.length === 0) return "mapy";
  return null;
}
