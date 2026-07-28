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

import type { Budynek, StanGry, TypBudynku } from "../src/sim/typy.ts";
import { DNI_W_ROKU, pustaPula, WERSJA_ZAPISU } from "../src/sim/typy.ts";
import type { Dane } from "../src/sim/budynki.ts";
import { pole as polePo } from "../src/sim/budynki.ts";
import { nowyMieszkaniec, tick } from "../src/sim/tick.ts";
import type { Swiat } from "../src/sim/tick.ts";
import { utworzLos } from "../src/sim/los.ts";

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
  posadz(ile: number): void {
    drzewa += ile;
  },
};

// ---------------------------------------------------------------------------
// Stan startowy
// ---------------------------------------------------------------------------

const los = utworzLos(ZIARNO);
let nr = 0;

function postaw(stan: StanGry, typ: TypBudynku): void {
  stan.budynki.push({
    id: `b_${nr++}`,
    typ,
    x: 0,
    y: 0,
    pracownicy: [],
    postep: 0,
    wybudowany: true,
    wstrzymany: false,
    zablokowanyPrzez: null,
    brakZasobu: false,
  });
  if (typ === "magazyn") stan.pojemnosc += dane.budynki.magazyn.pojemnosc ?? 200;
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
    domowikMiska: false,
    domowikZaniedbanieTygodni: 0,
    dniBezKradziezy: 0,
    przymierzeDomowik: false,
  },
  kodeks: [],
  ziarno: ZIARNO,
};

postaw(stan, "chata");
postaw(stan, "chata");
postaw(stan, "chata");
postaw(stan, "magazyn");
stan.pula.deska = 60;
stan.pula.cegla = 20;
stan.pula.chleb = 40;
stan.pula.jagody = 30;
for (let i = 0; i < 10; i++) {
  stan.mieszkancy.push(nowyMieszkaniec(`os_start_${i}`, los, 20 + los.calkowita(0, 15)));
}

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
let krokPlanu = 0;

function stacNa(typ: TypBudynku): boolean {
  const koszt = dane.budynki[typ].koszt;
  return Object.entries(koszt).every(([s, ile]) => stan.pula[s as never] >= ile);
}

function buduj(): void {
  if (krokPlanu >= PLAN.length) return;
  const typ = PLAN[krokPlanu];
  if (!stacNa(typ)) return;
  for (const [s, ile] of Object.entries(dane.budynki[typ].koszt)) {
    stan.pula[s as never] -= ile as never;
  }
  postaw(stan, typ);
  krokPlanu++;
}

/**
 * Polityka opałowa: to, co zrobiłby przytomny gracz. Jeśli zapas drewna nie
 * pokrywa zimy, wstrzymaj wszystko, co drewno zżera na inne cele.
 * Jeśli gra jest przechodzalna tylko z tą polityką, interfejs MUSI ostrzegać.
 */
function pilnujOpalu(): void {
  const doZimy = Math.max(0, 72 - stan.czas.dzien);
  const naZime = stan.mieszkancy.length * 0.4 * 24;
  const zapasBezpieczny = stan.pula.drewno > naZime * (doZimy < 20 ? 1 : 0.35);
  for (const b of stan.budynki) {
    if (b.typ === "tartak" || b.typ === "cegielnia") {
      b.wstrzymany = !zapasBezpieczny;
    }
  }
}

/**
 * Przestawianie ludzi. Gracz robi to odruchowo: jak magazyn desek pęka w
 * szwach, zabiera człowieka z tartaku i wsadza go tam, gdzie brakuje.
 * Bez tej reguły cegielnia nigdy nie dostaje rąk i rolnictwo nie rusza.
 */
function przestawLudzi(): void {
  const pelno = (s: keyof typeof stan.pula) => stan.pula[s] >= stan.pojemnosc * 0.9;
  const jedzenieZapas =
    stan.pula.jagody + stan.pula.chleb >= stan.mieszkancy.length * 0.25 * 40;

  // Nigdy nie wyłączaj ostatniej czynnej chaty zbieraczy.
  const zbieraczy = stan.budynki.filter((b) => b.typ === "zbieracze").length;
  let zbieraczyStop = jedzenieZapas && zbieraczy > 1 ? 1 : 0;
  for (const b of stan.budynki) {
    if (b.typ === "tartak") b.wstrzymany = b.wstrzymany || pelno("deska");
    if (b.typ === "zbieracze" && zbieraczyStop > 0) {
      b.wstrzymany = true;
      zbieraczyStop--;
    } else if (b.typ === "zbieracze") {
      b.wstrzymany = false;
    }
  }
}

function kupUlepszenia(): void {
  for (const u of [...dane.ulepszenia].sort((a, b) => a.koszt - b.koszt)) {
    if (stan.ulepszenia.includes(u.id)) continue;
    if (stan.pula.opowiesc >= u.koszt) {
      stan.pula.opowiesc -= u.koszt;
      stan.ulepszenia.push(u.id);
      log(`  ulepszenie: ${u.nazwa}`);
    }
    break;
  }
}

// ---------------------------------------------------------------------------
// Bieg
// ---------------------------------------------------------------------------

const linie: string[] = [];
const log = (s: string) => linie.push(s);

const historia = {
  ludnosc: [] as number[],
  chleb: [] as number[],
  jagody: [] as number[],
  drewno: [] as number[],
  drzewa: [] as number[],
};

let odeszliRazem = 0;
let dniGlodu = 0;

for (let dzien = 0; dzien < LATA * DNI_W_ROKU; dzien++) {
  buduj();
  kupUlepszenia();
  pilnujOpalu();
  przestawLudzi();
  const z = tick(stan, dane, swiat, los);

  odeszliRazem += z.odeszli.length;
  if (z.glodowka) dniGlodu++;
  if (z.leszySieOdezwal) log(`  rok ${stan.czas.rok}, dzień ${stan.czas.dzien}: leszy zablokował leśniczówki`);
  for (const p of z.przymierza) log(`  rok ${stan.czas.rok}: przymierze z duchem (${p})`);

  historia.ludnosc.push(stan.mieszkancy.length);
  historia.chleb.push(Math.round(stan.pula.chleb));
  historia.jagody.push(Math.round(stan.pula.jagody));
  historia.drewno.push(Math.round(stan.pula.drewno));
  historia.drzewa.push(Math.round(drzewa));

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
console.log(`dni z niedoborem chleba: ${dniGlodu} z ${LATA * DNI_W_ROKU}`);
console.log(`odeszło z głodu: ${odeszliRazem}`);
console.log(`ulepszenia: ${stan.ulepszenia.join(", ") || "brak"}`);
console.log(`kodeks: ${stan.kodeks.join(", ") || "pusty"}`);
console.log(`las: ${Math.round(drzewa)} z ${DRZEWA_START} drzew`);
console.log(`plan budowy: ${krokPlanu} z ${PLAN.length} pozycji`);

// dane do wykresów
console.log("\nWYKRES " + JSON.stringify(historia));
