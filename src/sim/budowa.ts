/**
 * Ostoja — stawianie budynków.
 *
 * Budynek nie pojawia się gotowy. Gracz płaci deski i cegły od razu, ale na
 * placu budowy musi stanąć człowiek i przepracować swoje dniówki. Dzięki temu
 * rozbudowa kosztuje to, czego w osadzie brakuje najbardziej — ręce — a nie
 * tylko surowce leżące w magazynie.
 *
 * **Kolejka zamiast wyścigu.** Naraz pracuje `budowyNaraz` placów (na dziś
 * jeden), po `budowniczychNaBudowe` ludzi. Bez tego ograniczenia dziecko, które
 * postawi sześć budynków naraz, zdejmuje z produkcji całą osadę i po dziesięciu
 * dniach zaczyna tracić ludzi z głodu, nie rozumiejąc dlaczego. Z kolejką koszt
 * rozbudowy jest zawsze taki sam i widoczny: dwie pary rąk.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type { Budynek, Punkt, StanGry, Surowiec, TypBudynku } from "./typy.ts";
import { NAZWY_STOPNI, budynekDostepny } from "./stopnie.ts";
import { BEZ_LIMITU, DREWNA_Z_DRZEWA, SUROWCE } from "./typy.ts";
import type { Dane } from "./budynki.ts";
import type { Swiat } from "./tick.ts";
import { kafelekNa } from "./mapa.ts";

export type WynikBudowy = { ok: true } | { ok: false; powod: string };

/** Czy w puli leży komplet surowców na ten budynek. */
export function stacNa(stan: StanGry, dane: Dane, typ: TypBudynku): boolean {
  return Object.entries(dane.budynki[typ].koszt).every(
    ([s, ile]) => stan.pula[s as Surowiec] >= ile,
  );
}

export function brakujeNa(stan: StanGry, dane: Dane, typ: TypBudynku): Surowiec[] {
  return (Object.entries(dane.budynki[typ].koszt) as [Surowiec, number][])
    .filter(([s, ile]) => stan.pula[s] < ile)
    .map(([s]) => s);
}

/**
 * Czy tu wolno postawić.
 *
 * Las wolno zabudować: drzewa idą pod topór i drewno wpada do puli (patrz
 * wykarczujPod). Polana startowa ma promień czterech kafelków i po odjęciu
 * trzech chat z magazynem zostaje na niej miejsce na jeden budynek — bez
 * karczowania dziecko dostawałoby „tu nie postawisz" przy co drugim kliknięciu.
 *
 * Złoże gliny to co innego: budynek postawiony na glinie kasuje ją bezpowrotnie
 * i nikt tego nie odzyska. Tu lepiej odmówić i powiedzieć dlaczego.
 */
export function mozliwaBudowa(
  stan: StanGry,
  dane: Dane,
  typ: TypBudynku,
  rog: Punkt,
): WynikBudowy {
  const def = dane.budynki[typ];

  // Stopień osady sprawdzamy pierwszy: „osada jeszcze tego nie umie" jest
  // ważniejszą odpowiedzią niż „tu stoi drzewo", i zupełnie inną.
  if (!budynekDostepny(stan, dane, typ)) {
    return {
      ok: false,
      powod: `osada jeszcze tego nie umie (${NAZWY_STOPNI[def.stopien]})`,
    };
  }

  for (let y = rog.y; y < rog.y + def.wysokosc; y++) {
    for (let x = rog.x; x < rog.x + def.szerokosc; x++) {
      const k = kafelekNa(stan.mapa, x, y);
      if (!k) return { ok: false, powod: "poza mapą" };
      if (!k.przechodni) {
        return { ok: false, powod: k.teren === "woda" ? "woda" : "skała" };
      }
      if (k.zajetyPrzez !== null) return { ok: false, powod: "tu już coś stoi" };
      if (k.teren === "glina" && k.zasob > 0) {
        return { ok: false, powod: "leży tu glina, szkoda ją zabudować" };
      }
    }
  }

  if (!stacNa(stan, dane, typ)) {
    const brak = brakujeNa(stan, dane, typ).join(" i ");
    return { ok: false, powod: `brakuje: ${brak}` };
  }

  return { ok: true };
}

/**
 * Zakłada plac budowy: pobiera koszt z puli i zajmuje kafelki.
 *
 * Nie sprawdza, czy wolno — to robi mozliwaBudowa po stronie interfejsu.
 * Narzędzie balansujące woła tę funkcję bez mapy i wtedy kafelków nie ma czym
 * zajmować.
 */
export function rozpocznijBudowe(
  stan: StanGry,
  dane: Dane,
  typ: TypBudynku,
  rog: Punkt,
  id: string,
): { budynek: Budynek; wykarczowane: number } {
  for (const [s, ile] of Object.entries(dane.budynki[typ].koszt)) {
    stan.pula[s as Surowiec] -= ile as number;
  }
  const wykarczowane = wykarczujPod(stan, dane, typ, rog);
  return { budynek: postawBudynek(stan, dane, typ, rog, id, false), wykarczowane };
}

/** Ile drzew stoi pod bryłą budynku. Do podglądu przed kliknięciem. */
export function drzewaPod(
  stan: StanGry,
  dane: Dane,
  typ: TypBudynku,
  rog: Punkt,
): number {
  const def = dane.budynki[typ];
  let drzewa = 0;
  for (let y = rog.y; y < rog.y + def.wysokosc; y++) {
    for (let x = rog.x; x < rog.x + def.szerokosc; x++) {
      const k = kafelekNa(stan.mapa, x, y);
      if (k && k.teren === "las" && k.zasob > 0) drzewa += k.zasob / DREWNA_Z_DRZEWA;
    }
  }
  return drzewa;
}

/**
 * Ścina drzewa spod budowy i wrzuca drewno do puli. Zwraca liczbę drzew.
 *
 * Leszy liczy to jako wycinkę, bo to jest wycinka — inaczej dałoby się wyciąć
 * pół boru pod chaty i mieć u ducha czyste konto. Dziecko, które wybuduje osadę
 * w środku lasu, ma się dowiedzieć tego samego, czego dowiaduje się gracz
 * stawiający szóstą leśniczówkę.
 */
export function wykarczujPod(
  stan: StanGry,
  dane: Dane,
  typ: TypBudynku,
  rog: Punkt,
): number {
  const def = dane.budynki[typ];
  let drzewa = 0;

  for (let y = rog.y; y < rog.y + def.wysokosc; y++) {
    for (let x = rog.x; x < rog.x + def.szerokosc; x++) {
      const k = kafelekNa(stan.mapa, x, y);
      if (!k || k.teren !== "las" || k.zasob <= 0) continue;

      stan.pula.drewno = Math.min(stan.pojemnosc, stan.pula.drewno + k.zasob);
      drzewa += k.zasob / DREWNA_Z_DRZEWA;
      k.zasob = 0;
    }
  }

  if (drzewa > 0) stan.duchy.wycieteDrzewa[0] += drzewa;
  return drzewa;
}

/**
 * Wstawia budynek na mapę. `gotowy` odróżnia osadę początkową (stoi od pierwszego
 * dnia) od tego, co gracz dostawia później.
 */
export function postawBudynek(
  stan: StanGry,
  dane: Dane,
  typ: TypBudynku,
  rog: Punkt,
  id: string,
  gotowy: boolean,
): Budynek {
  const def = dane.budynki[typ];
  const budynek: Budynek = {
    id,
    typ,
    x: rog.x,
    y: rog.y,
    pracownicy: [],
    postep: 0,
    wybudowany: false,
    wstrzymany: false,
    zablokowanyPrzez: null,
    brakZasobu: false,
  };

  // Budynki zajmują kafelki, ale ich nie zamykają. Gdyby czyniły je
  // nieprzechodnimi, ciasna zabudowa polany potrafiłaby odciąć kawał terenu,
  // a spójność mapy jest sprawdzana tylko przy generowaniu.
  if (stan.mapa.kafelki.length > 0) {
    for (let y = rog.y; y < rog.y + def.wysokosc; y++) {
      for (let x = rog.x; x < rog.x + def.szerokosc; x++) {
        stan.mapa.kafelki[y * stan.mapa.szerokosc + x].zajetyPrzez = id;
      }
    }
  }

  stan.budynki.push(budynek);
  if (gotowy) zakonczBudowe(stan, dane, budynek);
  return budynek;
}

/** Zwija plac budowy i oddaje surowce. Ukończonego budynku to nie dotyczy. */
export function anulujBudowe(stan: StanGry, dane: Dane, budynek: Budynek): boolean {
  if (budynek.wybudowany) return false;

  const def = dane.budynki[budynek.typ];
  for (const [s, ile] of Object.entries(def.koszt)) {
    stan.pula[s as Surowiec] += ile as number;
  }

  if (stan.mapa.kafelki.length > 0) {
    for (let y = budynek.y; y < budynek.y + def.wysokosc; y++) {
      for (let x = budynek.x; x < budynek.x + def.szerokosc; x++) {
        const k = kafelekNa(stan.mapa, x, y);
        if (k && k.zajetyPrzez === budynek.id) k.zajetyPrzez = null;
      }
    }
  }

  const i = stan.budynki.indexOf(budynek);
  if (i >= 0) stan.budynki.splice(i, 1);
  for (const m of stan.mieszkancy) {
    if (m.miejscePracy === budynek.id) m.miejscePracy = null;
  }
  return true;
}

function zakonczBudowe(stan: StanGry, dane: Dane, budynek: Budynek): void {
  budynek.wybudowany = true;
  budynek.postep = 0;
  budynek.pracownicy = [];
  if (budynek.typ === "magazyn") {
    stan.pojemnosc +=
      dane.budynki.magazyn.pojemnosc ?? dane.stale.pojemnoscBazowa;
  }
}

/** Place budowy w kolejności zakładania — pierwszy dostaje ludzi. */
export function placeBudowy(stan: StanGry): Budynek[] {
  return stan.budynki.filter((b) => !b.wybudowany && !b.wstrzymany);
}

/**
 * Dniówka na budowach. Wołane z ticka zaraz po przydziale pracy, bo budowa
 * zużywa wyłącznie ręce — surowce zeszły z puli już przy zakładaniu placu.
 * Zwraca identyfikatory tego, co dziś stanęło.
 *
 * Postęp naliczają wyłącznie ci budowniczy, którzy naprawdę stoją na placu
 * (`Swiat.obecniNaBudowie`). Bez tego budynek postawiony na drugim końcu mapy
 * bywał gotowy, zanim ktokolwiek do niego doszedł, i widać to było gołym okiem.
 * Świat bez mapy takiej metody nie ma i liczy jak dawniej — całą przydzieloną
 * obsadę.
 */
export function budujDzien(stan: StanGry, dane: Dane, swiat?: Swiat): string[] {
  const skonczone: string[] = [];

  for (const b of stan.budynki) {
    if (b.wybudowany || b.pracownicy.length === 0) continue;

    const rece = swiat?.obecniNaBudowie?.(b) ?? b.pracownicy.length;
    if (rece === 0) continue;

    b.postep += rece / dane.budynki[b.typ].dniBudowy;
    if (b.postep >= 1) {
      zakonczBudowe(stan, dane, b);
      skonczone.push(b.id);
    }
  }

  return skonczone;
}

/**
 * Rozbiórka gotowego budynku.
 *
 * Do kroku 7 nie było jej wcale i pomiar wskazał to jako jedyny realny brak:
 * gdy złoże pod glinianką się wyczerpie, budynek stoi na mapie jako pomnik,
 * a gracz może tylko postawić drugi. Zwracamy część kosztu (`zwrotZRozbiorki`
 * w dane/stale.json), bo dziesięciolatek ma móc naprawić swój błąd, ale nie
 * za darmo — inaczej stawianie w byle miejscu przestaje cokolwiek kosztować.
 */
export function rozbierz(stan: StanGry, dane: Dane, budynek: Budynek): boolean {
  if (!budynek.wybudowany) return false;

  const def = dane.budynki[budynek.typ];
  for (const [s, ile] of Object.entries(def.koszt)) {
    stan.pula[s as Surowiec] += Math.floor((ile as number) * dane.stale.zwrotZRozbiorki);
  }

  if (stan.mapa.kafelki.length > 0) {
    for (let y = budynek.y; y < budynek.y + def.wysokosc; y++) {
      for (let x = budynek.x; x < budynek.x + def.szerokosc; x++) {
        const k = kafelekNa(stan.mapa, x, y);
        if (k && k.zajetyPrzez === budynek.id) k.zajetyPrzez = null;
      }
    }
  }

  // Magazyn zabiera ze sobą swoją pojemność, a wszystko ponad nowy limit
  // przepada — tak samo, jak przepada nadwyżka produkcji.
  if (budynek.typ === "magazyn") {
    stan.pojemnosc = Math.max(0, stan.pojemnosc - (def.pojemnosc ?? dane.stale.pojemnoscBazowa));
    for (const s of SUROWCE) {
      if (BEZ_LIMITU.includes(s)) continue;
      stan.pula[s] = Math.min(stan.pula[s], stan.pojemnosc);
    }
  }

  const i = stan.budynki.indexOf(budynek);
  if (i >= 0) stan.budynki.splice(i, 1);

  for (const m of stan.mieszkancy) {
    if (m.miejscePracy === budynek.id) m.miejscePracy = null;
    // Rozebrana chata zostawia domowników bez dachu. Przydział mieszkań idzie
    // przez zakwateruj() w ticku, więc wystarczy zwolnić przypisanie.
    if (m.dom === budynek.id) m.dom = null;
  }
  return true;
}
