/**
 * Ostoja — narzędzie do balansowania.
 *
 * Puszcza symulację bez przeglądarki i wypisuje, co się działo. Mapa jest
 * zastąpiona licznikami drzew i gliny, bo do sprawdzenia bilansu ekonomii
 * położenie kafelków nie ma znaczenia.
 *
 * Uruchomienie:  node --experimental-strip-types narzedzia/symuluj.ts [lata] [ziarno]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Budynek, StanGry, Surowiec, TypBudynku } from "../src/sim/typy.ts";
import {
  DNI_W_ROKU,
  WERSJA_ZAPISU,
  ZADOWOLENIE_SREDNIE,
  pustaPula,
} from "../src/sim/typy.ts";
import type { Dane } from "../src/sim/budynki.ts";
import { nowyMieszkaniec, tick } from "../src/sim/tick.ts";
import type { Swiat } from "../src/sim/tick.ts";
import {
  kosztOsadnika,
  skladnikiZadowolenia,
  stanZapasow,
  wolneMiejscaWChatach,
  zapasJedzenia,
  zrobZapasy,
} from "../src/sim/osada.ts";
import { postawBudynek, rozpocznijBudowe, stacNa } from "../src/sim/budowa.ts";
import { kupUlepszenie, ulepszeniaPoKoszcie } from "../src/sim/budynki.ts";
import { utworzLos } from "../src/sim/los.ts";
import { budynekDostepny } from "../src/sim/stopnie.ts";
import { utworzMiary } from "./miary.ts";

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), "..");
const wczytaj = (p: string) => JSON.parse(readFileSync(join(KORZEN, p), "utf8"));

const dane: Dane = {
  budynki: wczytaj("dane/budynki.json"),
  ulepszenia: wczytaj("dane/ulepszenia.json"),
  stale: wczytaj("dane/stale.json"),
};

const LATA = Number(process.argv[2] ?? 5);
const ZIARNO = Number(process.argv[3] ?? 1234);

// ---------------------------------------------------------------------------
// Świat zastępczy: mapa jako dwa liczniki
// ---------------------------------------------------------------------------

const DRZEWA_START = 900;
const GLINA_START = 2000;

let drzewa = DRZEWA_START;
let glina = GLINA_START;

const swiat: Swiat = {
  pobierz(b: Budynek, ile: number): number {
    if (b.typ === "zbieracze") return ile; // las się nie zużywa
    if (b.typ === "lesniczowka") {
      const dostepne = drzewa * 10;
      const dostal = Math.min(ile, dostepne);
      drzewa -= dostal / 10;
      return dostal;
    }
    if (b.typ === "glinianka") {
      const dostal = Math.min(ile, glina);
      glina -= dostal;
      return dostal;
    }
    return ile;
  },
  posadz(_b: Budynek, ile: number): number {
    drzewa += ile;
    return ile;
  },
};

// ---------------------------------------------------------------------------
// Stan startowy
// ---------------------------------------------------------------------------

const los = utworzLos(ZIARNO);
let nr = 0;

/** Budynek startowy: stoi gotowy od pierwszego dnia i nic nie kosztuje. */
function postawGotowy(stan: StanGry, typ: TypBudynku): void {
  postawBudynek(stan, dane, typ, { x: 0, y: 0 }, `b_${nr++}`, true);
}

const stan: StanGry = {
  wersja: WERSJA_ZAPISU,
  czas: { dzien: 0, rok: 0, pora: "wiosna" },
  predkosc: 1,
  pula: pustaPula(),
  pojemnosc: 0,
  mapa: { szerokosc: 40, wysokosc: 40, kafelki: [] },
  budynki: [],
  mieszkancy: [],
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
  // Narzędzie gra jedną mapę bez kampanii, więc nic nie umie z góry.
  umiejetnosci: [],
  zadowolenie: ZADOWOLENIE_SREDNIE,
  wiesc: 0,
  zapasyNaZime: false,
  zimyZZapasami: 0,
  wyprawy: [],
  ziarno: ZIARNO,
};

// Osada startowa prosto z dane/stale.json — inaczej narzędzie balansuje inną
// grę niż ta, w którą się gra.
for (const typ of dane.stale.start.budynki) postawGotowy(stan, typ);
for (const [surowiec, ile] of Object.entries(dane.stale.start.pula)) {
  stan.pula[surowiec as Surowiec] = ile as number;
}
for (let i = 0; i < dane.stale.start.mieszkancy; i++) {
  stan.mieszkancy.push(nowyMieszkaniec(`os_start_${i}`, los, 20 + los.calkowita(0, 15)));
}
stan.zadowolenie = skladnikiZadowolenia(stan, dane).cel;

// ---------------------------------------------------------------------------
// Polityka gracza: prosta, ale sensowna kolejność budowy
// ---------------------------------------------------------------------------

const PLAN: TypBudynku[] = [
  // Kolejność ustawiona pod dziesięciu ludzi: najpierw jedzenie i drewno,
  // potem glina, bo bez cegieł nie ma młyna, a bez młyna osada nigdy nie
  // wyjdzie ponad sufit zbieractwa.
  "zbieracze", "lesniczowka", "zbieracze", "gajowka",
  "tartak", "kapliczka", "glinianka", "cegielnia", "lesniczowka",
  "chata", "pole", "pole", "mlyn", "piekarnia",
  "magazyn", "chata", "bajarz", "zbieracze",
  "lesniczowka", "gajowka", "chata", "pole", "pole",
  "mlyn", "piekarnia", "chata", "magazyn", "bajarz",
];
/**
 * Pozycje planu już zamknięte — zbudowane albo porzucone. To zbiór indeksów,
 * a nie licznik, bo pozycję zamkniętą stopniem gracz pomija i wraca do niej
 * później; licznik zjadałby wtedy nie tę pozycję, którą właśnie postawiono.
 */
const zamknietePlanu = new Set<number>();
const planWykonany = (): boolean => zamknietePlanu.size >= PLAN.length;

/**
 * Po wyczerpaniu planu gracz nie odkłada myszki. Osada rośnie dalej, a wraz
 * z nią koszt osadnika, więc trzeba dokładać to, co ten koszt pokrywa: ręce do
 * jedzenia i miejsce w magazynie. Bez tej listy narzędzie mierzy gracza, który
 * po trzecim roku przestał grać — i wtedy „dni bez decyzji" mówią o narzędziu,
 * a nie o grze.
 */
const DALEJ: TypBudynku[] = [
  "zbieracze", "pole", "mlyn", "piekarnia", "lesniczowka", "gajowka",
];
let krokDalej = 0;

/**
 * Ilu ludzi brakuje na obsadzenie tego, co już stoi. Gracz nie stawia kolejnego
 * warsztatu, gdy poprzedni świeci pustkami — a plan budowy w narzędziu owszem,
 * i to on, a nie ekonomia, wywracał przebiegi w trzecią zimę: trzydzieści dwa
 * budynki na dziewiętnaście par rąk, przy czym ludzi dostają najpierw budynki
 * postawione wcześniej, więc leśniczówki zostawały puste w środku zimy.
 */
function nieobsadzoneMiejsca(): number {
  let brak = 0;
  for (const b of stan.budynki) {
    if (!b.wybudowany || b.wstrzymany) continue;
    const def = dane.budynki[b.typ];
    if (def.tylkoPora && def.tylkoPora !== stan.czas.pora) continue;
    brak += def.miejscaPracy - b.pracownicy.length;
  }
  return brak;
}

const LUZ_NA_MIEJSCA_PRACY = 4;

/**
 * Gracz zakłada plac budowy, gdy stać go na surowce — ale nie stawia dwóch
 * naraz, bo i tak budowałaby się tylko jedna (kolejka w przydzielPrace).
 * Bez tego warunku narzędzie zamrażałoby deski w rusztowaniach, których nikt
 * nie kończy, i myliłoby się co do tempa rozbudowy.
 *
 * Chata poza planem jest tu **rekrutacją**: osadnik nie przyjdzie, dopóki nie
 * ma gdzie zamieszkać, więc gracz, który nie dokłada dachów, sam sobie zatrzymuje
 * osadę. Narzędzie, które tego nie robi, mierzy grę, w którą nikt nie gra.
 */
/** Czy którykolwiek surowiec stoi na suficie magazynu i nadwyżka przepada. */
function cosNaSuficie(): boolean {
  return (["drewno", "deska", "cegla", "chleb", "jagody", "maka", "zboze"] as const).some(
    (s) => stan.pula[s] >= stan.pojemnosc - 1e-9,
  );
}

type Wybor = { typ: TypBudynku; indeks?: number } | null;

/**
 * Po co gracz sięga dzisiaj. Kolejność jest tu całą polityką:
 * dach przed wszystkim (bez niego osadnik nie przyjdzie), potem plan, a gdy
 * plan się skończy — magazyn dla tego, co przepada, i dalszy ciąg listy.
 */
function czegoChce(): Wybor {
  if (wolneMiejscaWChatach(stan, dane) <= 0) return { typ: "chata" };

  // Pozycję planu zamkniętą stopniem gracz **pomija**, a nie czeka na nią.
  // Czekanie na cegielnię do pierwszej zimy zamrażałoby osadę na pół roku,
  // a przytomny gracz w tym czasie po prostu buduje to, co już umie.
  if (!planWykonany()) {
    if (nieobsadzoneMiejsca() > LUZ_NA_MIEJSCA_PRACY) return null;
    for (let i = 0; i < PLAN.length; i++) {
      if (zamknietePlanu.has(i)) continue;
      if (budynekDostepny(stan, dane, PLAN[i])) {
        return { typ: PLAN[i], indeks: i };
      }
    }
    return null;
  }
  if (cosNaSuficie()) return { typ: "magazyn" };
  if (nieobsadzoneMiejsca() > LUZ_NA_MIEJSCA_PRACY) return null;
  for (let i = 0; i < DALEJ.length; i++) {
    const typ = DALEJ[(krokDalej + i) % DALEJ.length];
    if (budynekDostepny(stan, dane, typ)) return { typ };
  }
  return null;
}

function buduj(): void {
  if (stan.budynki.some((b) => !b.wybudowany)) return;
  const chce = czegoChce();
  if (!chce || !stacNa(stan, dane, chce.typ)) return;

  rozpocznijBudowe(stan, dane, chce.typ, { x: 0, y: 0 }, `b_${nr++}`);
  if (chce.indeks !== undefined) zamknietePlanu.add(chce.indeks);
  else if (planWykonany() && chce.typ !== "chata" && chce.typ !== "magazyn") {
    krokDalej++;
  }
}

/**
 * Zapasy na zimę — jedyna decyzja jesieni. Gracz robi je, gdy tylko go na nie
 * stać, bo kwartał rozwoju jest wart więcej niż jednorazowy koszt. Narzędzie
 * musi to umieć, inaczej mierzy gracza, który ostrzeżenia w panelu nie czyta.
 */
function odlozZapasy(): void {
  zrobZapasy(stan, dane);
}

/** Czy gracz ma dziś w co włożyć surowce. Do miary „dni bez decyzji". */
function maDecyzje(): boolean {
  const z = stanZapasow(stan, dane);
  if (z.otwarte && !z.zrobione && z.stac) return true;
  const chce = czegoChce();
  if (chce && stacNa(stan, dane, chce.typ)) return true;
  return dane.ulepszenia.some(
    (u) => !stan.ulepszenia.includes(u.id) && stan.pula.opowiesc >= u.koszt,
  );
}

/**
 * Co zjada drewno w recepturze. Nikt już nie pali w piecu za samo istnienie,
 * ale tartak, cegielnia i piekarnia biorą okrąglaki na wsad — i potrafią zjeść
 * budulec, którym gracz miał postawić następną chatę.
 */
const DREWNOZERNE: TypBudynku[] = ["tartak", "cegielnia", "piekarnia"];

/**
 * Zapas na budowę: nie przerabiaj okrąglaków, których potrzebujesz na to, po co
 * właśnie sięgasz. Rezerwa idzie z kosztu tego budynku, a nie ze sztywnej
 * liczby — sztywna zatrzaskiwała grę na amen. Gdy następna w kolejce jest
 * kapliczka (deski i cegły, zero drewna), rezerwa wynosi zero i tartak musi
 * ruszyć, bo inaczej desek nie będzie nigdy.
 */
function pilnujDrewna(): void {
  const chce = czegoChce();
  const rezerwa = chce ? (dane.budynki[chce.typ].koszt.drewno ?? 0) : 0;
  const wstrzymaj = stan.pula.drewno < rezerwa;
  for (const b of stan.budynki) {
    if (DREWNOZERNE.includes(b.typ)) b.wstrzymany = wstrzymaj;
  }
}

/**
 * Rekrutacja: osadnik przed opowieścią.
 *
 * Bajarz bierze trzy chleby na opowieść, a te same trzy chleby są częścią ceny
 * nowego człowieka. Gracz, który tego nie widzi, kupuje ulepszenia i stoi
 * w miejscu; gracz przytomny wstrzymuje bajarza, dopóki spiżarnia nie uzbiera
 * na osadnika. To jest ta decyzja, którą narzędzie musi umieć odegrać.
 */
function pilnujJedzenia(): void {
  const koszt = kosztOsadnika(dane, stan.ulepszenia, stan.mieszkancy.length);
  const chudo = zapasJedzenia(stan) < koszt && wolneMiejscaWChatach(stan, dane) > 0;
  for (const b of stan.budynki) {
    if (b.typ === "bajarz") b.wstrzymany = chudo;
  }
}

/**
 * Przestawianie ludzi. Gracz robi to odruchowo: jak magazyn desek pęka w
 * szwach, zabiera człowieka z tartaku i wsadza go tam, gdzie brakuje.
 * Bez tej reguły cegielnia nigdy nie dostaje rąk i rolnictwo nie rusza.
 *
 * Wstrzymywanie półproduktów jest tu ważniejsze, niż wygląda. Ludzi trafiają do
 * budynków w kolejności stawiania, a miejsc pracy jest więcej niż rąk, więc
 * budynek postawiony późno (piekarnia!) potrafi nie dostać ani jednego
 * człowieka. Objaw: mąka rośnie do kilkuset, chleba zero, ludność stoi.
 * Odpowiedź przytomnego gracza to wstrzymanie młyna, a nie stawianie kolejnego
 * budynku — i taką odpowiedź odgrywa poniższa reguła.
 */
const NADMIAR: Partial<Record<keyof typeof stan.pula, number>> = {
  deska: 0.9,
  maka: 0.25,
  cegla: 0.25,
  glina: 0.25,
};

function zaDuzo(surowiec: keyof typeof stan.pula): boolean {
  const prog = NADMIAR[surowiec];
  return prog !== undefined && stan.pula[surowiec] >= stan.pojemnosc * prog;
}

function przestawLudzi(): void {
  // Jedzenia nigdy nie jest „dość": schodzi na osadników, a koszt rośnie
  // z ludnością. Zbieraczy wstrzymujemy dopiero, gdy spiżarnia dobiła do
  // sufitu magazynu i kolejna jagoda i tak by przepadła.
  const spizarniaPelna = stan.pula.jagody >= stan.pojemnosc - 1e-9;
  const zbieraczy = stan.budynki.filter((b) => b.typ === "zbieracze").length;
  let zbieraczyStop = spizarniaPelna && zbieraczy > 1 ? 1 : 0;

  for (const b of stan.budynki) {
    if (!b.wybudowany) continue;

    if (b.typ === "zbieracze") {
      b.wstrzymany = zbieraczyStop > 0;
      if (zbieraczyStop > 0) zbieraczyStop--;
      continue;
    }

    const wyjscie = Object.keys(dane.budynki[b.typ].receptura?.wyjscie ?? {});
    const nadmiar =
      wyjscie.length > 0 &&
      wyjscie.every((s) => zaDuzo(s as keyof typeof stan.pula));
    // Polityki zapasu (pilnujDrewna, pilnujJedzenia) mają pierwszeństwo —
    // ich wstrzymań tu nie zdejmujemy.
    const chronione = DREWNOZERNE.includes(b.typ) || b.typ === "bajarz";
    b.wstrzymany = b.wstrzymany || nadmiar;
    if (!nadmiar && !chronione) b.wstrzymany = false;
  }
}

function kupUlepszenia(): void {
  // Ta sama funkcja co w grze (`kupUlepszenie`), bo inaczej narzędzie mierzy
  // inną ekonomię niż ta, w którą się gra. Najtańsze pierwsze i jedno naraz.
  for (const u of ulepszeniaPoKoszcie(dane)) {
    if (stan.ulepszenia.includes(u.id)) continue;
    if (kupUlepszenie(stan, dane, u.id)) log(`  ulepszenie: ${u.nazwa}`);
    break;
  }
}

// ---------------------------------------------------------------------------
// Bieg
// ---------------------------------------------------------------------------

const linie: string[] = [];
const log = (s: string) => linie.push(s);

const miary = utworzMiary(() => stan, dane, maDecyzje);
const drzewaWCzasie: number[] = [];

let przybylo = 0;
let zimZZapasami = 0;

for (let dzien = 0; dzien < LATA * DNI_W_ROKU; dzien++) {
  odlozZapasy();
  buduj();
  kupUlepszenia();
  pilnujDrewna();
  pilnujJedzenia();
  przestawLudzi();
  const z = tick(stan, dane, swiat, los);

  przybylo += z.przybysze.length;
  if (z.przezimowano) zimZZapasami++;
  if (z.leszySieOdezwal) log(`  rok ${stan.czas.rok}, dzień ${stan.czas.dzien}: leszy zablokował leśniczówki`);
  for (const p of z.przymierza) log(`  rok ${stan.czas.rok}: przymierze z duchem (${p})`);

  miary.zapisz(dzien);
  drzewaWCzasie.push(Math.round(drzewa));

  if (stan.czas.dzien === DNI_W_ROKU - 1) {
    log(
      `rok ${stan.czas.rok}: ludność ${stan.mieszkancy.length}, ` +
        `chleb ${Math.round(stan.pula.chleb)}, jagody ${Math.round(stan.pula.jagody)}, drewno ${Math.round(stan.pula.drewno)}, ` +
        `zboze ${Math.round(stan.pula.zboze)}, maka ${Math.round(stan.pula.maka)}, ` +
        `pola ${stan.budynki.filter((b) => b.typ === "pole").length}, ` +
        `mlyny ${stan.budynki.filter((b) => b.typ === "mlyn").length}, ` +
        `piek ${stan.budynki.filter((b) => b.typ === "piekarnia").length}, ` +
        `dorosli ${stan.mieszkancy.filter((m) => m.wiek >= 16).length}, ` +
        `deski ${Math.round(stan.pula.deska)}, drzewa ${Math.round(drzewa)}, ` +
        `budynków ${stan.budynki.length}, ulepszeń ${stan.ulepszenia.length}`,
    );
  }
  if (stan.mieszkancy.length === 0) {
    log(`OSADA WYMARŁA w roku ${stan.czas.rok}`);
    break;
  }
}

console.log(linie.join("\n"));
console.log("\n--- podsumowanie ---");
console.log(`ziarno: ${ZIARNO}`);
console.log(`ludność końcowa: ${stan.mieszkancy.length}`);
console.log(`przyszło osadników: ${przybylo}`);
console.log(`zadowolenie na koniec: ${Math.round(stan.zadowolenie)}`);
console.log(`zim przezimowanych z zapasami: ${zimZZapasami} z ${LATA}`);
console.log(`ulepszenia: ${stan.ulepszenia.join(", ") || "brak"}`);
console.log(`kodeks: ${stan.kodeks.join(", ") || "pusty"}`);
console.log(`las: ${Math.round(drzewa)} z ${DRZEWA_START} drzew`);
console.log(`plan budowy: ${zamknietePlanu.size} z ${PLAN.length} pozycji`);
for (const wiersz of miary.podsumowanie()) console.log(wiersz);

// dane do wykresów
console.log("\nWYKRES " + JSON.stringify({ ...miary.historia, drzewa: drzewaWCzasie }));
