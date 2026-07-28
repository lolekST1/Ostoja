/**
 * Ostoja — czy panel „gdzie się korkuje" mówi prawdę.
 *
 * Panel obiecuje graczowi „drewna ubywa 2.1 dziennie, starczy na 9 dni".
 * Jeśli te liczby rozjeżdżają się z tym, co naprawdę robi tick(), panel jest
 * gorszy niż jego brak — bo gracz mu wierzy. To narzędzie liczy bilans przed
 * każdym dniem, wykonuje dzień naprawdę i porównuje jedno z drugim.
 *
 * Uruchomienie:  node --experimental-strip-types narzedzia/bilans.ts [lata] [ziarno]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { KonfiguracjaMapy, StanGry, TypBudynku } from "../src/sim/typy.ts";
import { DNI_W_ROKU, SUROWCE } from "../src/sim/typy.ts";
import type { Dane } from "../src/sim/budynki.ts";
import { policzBilans } from "../src/sim/bilans.ts";
import { nowaGra } from "../src/sim/stan.ts";
import { przydzielPrace, tick } from "../src/sim/tick.ts";
import { mozliwaBudowa, rozpocznijBudowe, stacNa } from "../src/sim/budowa.ts";
import { swiatMapy, zasobWZasiegu } from "../src/sim/swiat.ts";
import { utworzLos } from "../src/sim/los.ts";

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), "..");
const wczytaj = (p: string) => JSON.parse(readFileSync(join(KORZEN, p), "utf8"));

const dane: Dane = {
  budynki: wczytaj("dane/budynki.json"),
  ulepszenia: wczytaj("dane/ulepszenia.json"),
  stale: wczytaj("dane/stale.json"),
};
const konfigMapy: KonfiguracjaMapy = wczytaj("dane/mapa.json");

const LATA = Number(process.argv[2] ?? 3);
const ZIARNO = Number(process.argv[3] ?? 1234);

const stan: StanGry = nowaGra(dane, konfigMapy, ZIARNO);
const los = utworzLos(stan.ziarno);
const swiat = swiatMapy(() => stan, dane);
const osada = stan.mapa.start!;

// ---------------------------------------------------------------------------
// Ten sam gracz co w naMapie.ts — chodzi o realistyczny przebieg, nie o wynik
// ---------------------------------------------------------------------------

const PLAN: TypBudynku[] = [
  "zbieracze", "lesniczowka", "zbieracze", "gajowka",
  "tartak", "kapliczka", "glinianka", "cegielnia", "lesniczowka",
  "chata", "pole", "pole", "mlyn", "piekarnia",
  "magazyn", "chata", "bajarz", "zbieracze",
];
let krok = 0;
let nr = 0;

function gdzie(typ: TypBudynku): { x: number; y: number } | null {
  const def = dane.budynki[typ];
  let najlepsze: { x: number; y: number } | null = null;
  let najwiecej = -1;

  for (let r = 0; r <= 14; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const rog = { x: osada.x + dx, y: osada.y + dy };
        if (!mozliwaBudowa(stan, dane, typ, rog).ok) continue;
        if (!def.zbiera) return rog;
        const ile = zasobWZasiegu(stan, dane, typ, rog);
        if (ile > najwiecej) {
          najwiecej = ile;
          najlepsze = rog;
        }
      }
    }
    if (najlepsze && r >= 8) break;
  }
  return najlepsze;
}

function buduj(): void {
  if (krok >= PLAN.length) return;
  const typ = PLAN[krok];
  if (!stacNa(stan, dane, typ)) return;
  if (stan.budynki.some((b) => !b.wybudowany)) return;
  const rog = gdzie(typ);
  if (!rog) return;
  rozpocznijBudowe(stan, dane, typ, rog, `b_${nr++}`);
  krok++;
}

// ---------------------------------------------------------------------------
// Porównanie
// ---------------------------------------------------------------------------

/**
 * Czego ten test NIE wymaga.
 *
 * Panel podaje tempo, a tick robi część rzeczy skokowo: bajarz zabiera trzy
 * chleby raz na trzy dni, domowik jeden raz w tygodniu, żniwa sypią zbożem
 * tylko jesienią. Wygładzone tempo rozjeżdża się z takim dniem i tak ma być —
 * gracz chce wiedzieć „ile dziennie", a nie „co dokładnie stanie się jutro".
 *
 * Kłamstwem jest dopiero **systematyczne** przekłamanie: kiedy suma
 * przewidywań po wielu dniach nie zgadza się z sumą tego, co naprawdę zaszło.
 * Dlatego progiem jest średni błąd na dzień, a nie błąd pojedynczego dnia.
 */
const DOPUSZCZALNE_ODCHYLENIE = 0.05;

const sumaPrzewidziana: Record<string, number> = {};
const sumaFaktyczna: Record<string, number> = {};
const najwiekszy: Record<string, number> = {};
const liczonych: Record<string, number> = {};
/** Surowce, przy których pula uderzyła w sufit magazynu albo w zero. */
const oSciane: Record<string, string> = {};
let sprawdzonych = 0;
let pominietych = 0;

for (let d = 0; d < LATA * DNI_W_ROKU; d++) {
  buduj();

  // Tick zaczyna od rozdania pracy, więc bilans liczony na wczorajszej obsadzie
  // mierzyłby inną osadę niż ta, która za chwilę przeżyje dzień. Postawienie
  // placu budowy przesuwa ludzi natychmiast — stąd to wywołanie tutaj.
  przydzielPrace(stan, dane);

  const bilans = policzBilans(stan, dane);
  const przed = { ...stan.pula };
  const poraPrzed = stan.czas.pora;
  const pojemnoscPrzed = stan.pojemnosc;
  const ludnoscPrzed = stan.mieszkancy.length;

  const zdarzenia = tick(stan, dane, swiat, los);

  // Dni, w których zmienia się sama osada, odpadają: skończona budowa, zmiana
  // pory roku, przybysz albo odejście. Bilans opisuje osadę sprzed ticku i nie
  // ma jak tego przewidzieć.
  // Jedyny dzień nie do porównania: ten, w którym tick przekręcił porę roku.
  // Bilans policzył tempo dla pory sprzed ticku i nie miał jak tego wiedzieć.
  // Reszta zmian (skończona budowa, przybysz, odejście) jest w porządku —
  // każdy dzień był przewidziany na podstawie osady, która ten dzień przeżyła.
  if (stan.czas.pora !== poraPrzed) {
    pominietych++;
    continue;
  }
  sprawdzonych++;
  void pojemnoscPrzed;
  void ludnoscPrzed;
  void zdarzenia;

  for (const p of bilans.surowce) {
    const s = p.surowiec;

    // Pula ma ściany, których tempo nie opisuje: dorzuc() obcina nadwyżkę o
    // sufit magazynu, a konsumpcja nie zejdzie poniżej zera. Surowiec, który
    // choć raz o taką ścianę zahaczył, wypada z porównania na cały przebieg —
    // od tego miejsca jego suma i tak nie ma prawa się zgadzać.
    if (przed[s] + Math.max(0, p.przychod) >= stan.pojemnosc - 1e-9) {
      oSciane[s] ??= "sufit magazynu";
    }
    if (przed[s] + p.przychod < p.rozchod - 1e-9) {
      oSciane[s] ??= "pusta pula";
    }

    // Dni nie wyrzucamy — bajarz bierze trzy chleby raz na trzy dni, a domowik
    // jeden raz w tygodniu. Wygładzone tempo zgadza się z takim cyklem dopiero
    // w sumie, więc dziura w środku cyklu psułaby porównanie bardziej niż skok.
    const faktyczne = stan.pula[s] - przed[s];
    sumaPrzewidziana[s] = (sumaPrzewidziana[s] ?? 0) + p.netto;
    sumaFaktyczna[s] = (sumaFaktyczna[s] ?? 0) + faktyczne;
    liczonych[s] = (liczonych[s] ?? 0) + 1;
    najwiekszy[s] = Math.max(najwiekszy[s] ?? 0, Math.abs(faktyczne - p.netto));
  }
}

// ---------------------------------------------------------------------------

console.log(`bilans kontra rzeczywistość — ${LATA} lat, ziarno ${ZIARNO}\n`);
console.log(`  dni sprawdzonych: ${sprawdzonych}, pominiętych: ${pominietych}\n`);

console.log(
  `  ${"surowiec".padEnd(9)} ${"przewidziano".padStart(13)} ${"naprawdę".padStart(11)}` +
    ` ${"odchył/dzień".padStart(13)} ${"skok".padStart(7)}`,
);

let zle = 0;
let sprawdzalnych = 0;
for (const s of SUROWCE) {
  const ile = liczonych[s] ?? 0;
  if (ile === 0) continue;
  const przew = sumaPrzewidziana[s] ?? 0;
  const fakt = sumaFaktyczna[s] ?? 0;
  const odchyl = (fakt - przew) / ile;
  const sciana = oSciane[s];
  let uwaga = "";
  if (sciana) {
    uwaga = `   (nie sprawdzam — ${sciana})`;
  } else {
    sprawdzalnych++;
    if (Math.abs(odchyl) > DOPUSZCZALNE_ODCHYLENIE) {
      zle++;
      uwaga = "   <-- SYSTEMATYCZNY BŁĄD";
    }
  }
  console.log(
    `  ${s.padEnd(9)} ${przew.toFixed(1).padStart(13)} ${fakt.toFixed(1).padStart(11)}` +
      ` ${odchyl.toFixed(3).padStart(13)} ${(najwiekszy[s] ?? 0).toFixed(2).padStart(7)}` +
      uwaga,
  );
}
console.log(`\n  surowców sprawdzalnych: ${sprawdzalnych} z ${SUROWCE.length}`);

// Panel ma też wskazywać wąskie gardła — sprawdzamy, czy w ogóle je znajduje.
const koncowy = policzBilans(stan, dane);
console.log(`\n  korki na koniec (${koncowy.korki.length}):`);
for (const k of koncowy.korki.slice(0, 8)) {
  console.log(`    [${String(k.waga).padStart(3)}] ${k.opis}`);
}

const ok = zle === 0;
console.log(`\n${ok ? "BILANS ZGADZA SIĘ Z TICKIEM" : "BILANS KŁAMIE"}`);
if (!ok) process.exitCode = 1;
