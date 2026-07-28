/**
 * Ostoja — bilans na prawdziwej mapie.
 *
 * symuluj.ts zastępuje mapę dwoma licznikami i dlatego nie widzi dwóch rzeczy:
 * że wygenerowany teren ma 280–430 drzew zamiast 900, i że las kończy się
 * najpierw wokół konkretnej leśniczówki, a nie „w ogóle". To narzędzie puszcza
 * tę samą symulację, ale przez swiat.ts, czyli po kafelkach.
 *
 * Uruchomienie:  node --experimental-strip-types narzedzia/naMapie.ts [lata] [ziarno]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { KonfiguracjaMapy, Punkt, TypBudynku } from "../src/sim/typy.ts";
import { DNI_W_ROKU, DREWNA_Z_DRZEWA } from "../src/sim/typy.ts";
import type { Dane } from "../src/sim/budynki.ts";
import { nowaGra } from "../src/sim/stan.ts";
import { tick } from "../src/sim/tick.ts";
import { mozliwaBudowa, rozpocznijBudowe, stacNa } from "../src/sim/budowa.ts";
import { policzWPromieniu } from "../src/sim/mapa.ts";
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

const LATA = Number(process.argv[2] ?? 5);
const ZIARNO = Number(process.argv[3] ?? 1234);
const DZIENNIK = process.argv[4] === "dziennik";

const stan = nowaGra(dane, konfigMapy, ZIARNO);
const los = utworzLos(stan.ziarno);
const swiat = swiatMapy(() => stan, dane);
const osada = stan.mapa.start!;

// ---------------------------------------------------------------------------
// Gracz: ta sama kolejność budowy co w symuluj.ts, ale z wyborem miejsca
// ---------------------------------------------------------------------------

const PLAN: TypBudynku[] = [
  "zbieracze", "lesniczowka", "zbieracze", "gajowka",
  "tartak", "kapliczka", "glinianka", "cegielnia", "lesniczowka",
  "chata", "pole", "pole", "mlyn", "piekarnia",
  "magazyn", "chata", "bajarz", "zbieracze",
  "lesniczowka", "gajowka", "chata", "pole", "pole",
  "mlyn", "piekarnia", "chata", "magazyn", "bajarz",
];

/**
 * Gdzie postawić. Budynek zbierający idzie tam, gdzie w kręgu jest najwięcej
 * tego, po co przyszedł — tak, jak zrobiłby to gracz patrzący na mapę.
 * Reszta staje możliwie blisko osady, żeby ludzie nie chodzili przez pół mapy.
 *
 * Gajówka jest wyjątkiem, i to wyjątkiem, który przez chwilę wywracał całe
 * przebiegi. Nic nie zbiera (`zbiera: null`), więc jako „zwykły budynek"
 * stawała pod chatami i zalesiała łąkę w środku osady, podczas gdy leśniczówki
 * po drugiej stronie mapy ogołacały swój krąg do zera. Sadzenie ma sens tylko
 * tam, gdzie się wycina.
 */
function znajdzMiejsce(typ: TypBudynku, maksPromien = 14): Punkt | null {
  const def = dane.budynki[typ];
  let najlepsze: Punkt | null = null;
  let najlepszaOcena = -Infinity;

  for (let dy = -maksPromien; dy <= maksPromien; dy++) {
    for (let dx = -maksPromien; dx <= maksPromien; dx++) {
      const rog = { x: osada.x + dx, y: osada.y + dy };
      if (!mozliwaBudowa(stan, dane, typ, rog).ok) continue;

      const odleglosc = Math.hypot(dx, dy);
      let ocena: number;
      if (typ === "gajowka") {
        ocena = policzWPromieniu(stan.mapa, rog, def.promien, "las") * 10 - odleglosc * 2;
      } else if (def.zbiera) {
        ocena = zasobWZasiegu(stan, dane, typ, rog) - odleglosc * 2;
      } else {
        ocena = -odleglosc;
      }

      if (ocena > najlepszaOcena) {
        najlepszaOcena = ocena;
        najlepsze = rog;
      }
    }
  }
  return najlepsze;
}

let krokPlanu = 0;
let nr = 100;
let odrzucone = 0;

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

function buduj(): void {
  if (krokPlanu >= PLAN.length) return;
  if (stan.budynki.some((b) => !b.wybudowany)) return;
  if (nieobsadzoneMiejsca() > LUZ_NA_MIEJSCA_PRACY) return;
  const typ = PLAN[krokPlanu];
  if (!stacNa(stan, dane, typ)) return;

  const rog = znajdzMiejsce(typ);
  if (!rog) {
    // Brak miejsca to też wynik: na ciasnej mapie plan może się nie zmieścić.
    odrzucone++;
    krokPlanu++;
    return;
  }
  rozpocznijBudowe(stan, dane, typ, rog, `b_${nr++}`);
  krokPlanu++;
}

const NADMIAR: Record<string, number> = { deska: 0.9, maka: 0.25, cegla: 0.25, glina: 0.25 };

function przestawLudzi(): void {
  const jedzenieZapas =
    stan.pula.jagody + stan.pula.chleb >= stan.mieszkancy.length * 0.25 * 40;
  const zbieraczy = stan.budynki.filter((b) => b.typ === "zbieracze").length;
  let zbieraczyStop = jedzenieZapas && zbieraczy > 1 ? 1 : 0;

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
      wyjscie.every(
        (s) => NADMIAR[s] !== undefined && stan.pula[s as never] >= stan.pojemnosc * NADMIAR[s],
      );
    b.wstrzymany = b.wstrzymany || nadmiar;
    if (!nadmiar && !OPALOZERNE.includes(b.typ)) b.wstrzymany = false;
  }
}

/**
 * Co pali drewnem na cele inne niż ogrzewanie. Piekarnia jest tu równie ważna
 * jak tartak: zjada 2 drewna dziennie i potrafi wypalić zapas opałowy w środku
 * zimy, gdy w spiżarni leży już dwieście chlebów.
 */
const OPALOZERNE: TypBudynku[] = ["tartak", "cegielnia", "piekarnia"];

function pilnujOpalu(): void {
  const doZimy = Math.max(0, 72 - stan.czas.dzien);
  const naZime = stan.mieszkancy.length * 0.4 * 24;
  const zapasBezpieczny = stan.pula.drewno > naZime * (doZimy < 20 ? 1 : 0.35);
  for (const b of stan.budynki) {
    if (OPALOZERNE.includes(b.typ)) b.wstrzymany = !zapasBezpieczny;
  }
}

function kupUlepszenia(): void {
  for (const u of [...dane.ulepszenia].sort((a, b) => a.koszt - b.koszt)) {
    if (stan.ulepszenia.includes(u.id)) continue;
    if (stan.pula.opowiesc >= u.koszt) {
      stan.pula.opowiesc -= u.koszt;
      stan.ulepszenia.push(u.id);
    }
    break;
  }
}

// ---------------------------------------------------------------------------

function drzewaNaMapie(): number {
  let suma = 0;
  for (const k of stan.mapa.kafelki) if (k.teren === "las") suma += k.zasob;
  return suma / DREWNA_Z_DRZEWA;
}

const drzewaStart = drzewaNaMapie();
let dniGlodu = 0;
let dniZimna = 0;
let dniBezZasobu = 0;
let odeszliRazem = 0;
const bezZasobuWg: Partial<Record<TypBudynku, number>> = {};

console.log(
  `mapa z ziarna ${ZIARNO}: ${Math.round(drzewaStart)} drzew, ` +
    `osada na (${osada.x}, ${osada.y})\n`,
);

for (let dzien = 0; dzien < LATA * DNI_W_ROKU; dzien++) {
  buduj();
  kupUlepszenia();
  pilnujOpalu();
  przestawLudzi();
  const z = tick(stan, dane, swiat, los);

  odeszliRazem += z.odeszli.length;
  if (z.glodowka) dniGlodu++;
  if (z.zimno) dniZimna++;
  // Licznik, którego symuluj.ts nie ma z czego wziąć: budynek stoi w kręgu,
  // w którym nic już nie zostało.
  const puste = stan.budynki.filter((b) => b.wybudowany && b.brakZasobu && !b.wstrzymany);
  if (puste.length > 0) dniBezZasobu++;
  for (const b of puste) {
    bezZasobuWg[b.typ] = (bezZasobuWg[b.typ] ?? 0) + 1;
  }

  // Dziennik co osiem dni — do szukania dnia, w którym coś się załamało.
  if (DZIENNIK && dzien % 8 === 0) {
    console.log(
      `  r${stan.czas.rok} d${stan.czas.dzien} ${stan.czas.pora}: ` +
        `ludzi ${stan.mieszkancy.length}, drewno ${Math.round(stan.pula.drewno)}, ` +
        `jedzenie ${Math.round(stan.pula.jagody + stan.pula.chleb)}, ` +
        `głodnych ${stan.mieszkancy.filter((m) => m.glod > 0).length}, ` +
        `budowa ${stan.budynki.filter((b) => !b.wybudowany).length}, ` +
        `lesn. ${stan.budynki.filter((b) => b.typ === "lesniczowka" && b.wybudowany).length}`,
    );
  }

  if (stan.czas.dzien === DNI_W_ROKU - 1) {
    const puste = stan.budynki.filter((b) => b.wybudowany && b.brakZasobu).length;
    console.log(
      `rok ${stan.czas.rok}: ludność ${stan.mieszkancy.length}, ` +
        `chleb ${Math.round(stan.pula.chleb)}, jagody ${Math.round(stan.pula.jagody)}, ` +
        `drewno ${Math.round(stan.pula.drewno)}, deski ${Math.round(stan.pula.deska)}, ` +
        `drzewa ${Math.round(drzewaNaMapie())}, budynków ${stan.budynki.length}` +
        (puste > 0 ? `, bez zasobu: ${puste}` : "") +
        `, ulepszeń ${stan.ulepszenia.length}`,
    );
  }
  if (stan.mieszkancy.length === 0) {
    console.log(`OSADA WYMARŁA w roku ${stan.czas.rok}`);
    break;
  }
}

console.log("\n--- podsumowanie ---");
console.log(`ludność końcowa: ${stan.mieszkancy.length}`);
console.log(`dni z niedoborem chleba: ${dniGlodu} z ${LATA * DNI_W_ROKU}`);
console.log(`dni bez opału: ${dniZimna} z ${LATA * DNI_W_ROKU}`);
console.log(
  `dni z budynkiem bez zasobu w kręgu: ${dniBezZasobu}` +
    (Object.keys(bezZasobuWg).length > 0
      ? ` (${Object.entries(bezZasobuWg)
          .map(([typ, ile]) => `${typ} ${ile}`)
          .join(", ")})`
      : ""),
);
console.log(`odeszło z osady: ${odeszliRazem}`);
console.log(`las: ${Math.round(drzewaNaMapie())} z ${Math.round(drzewaStart)} drzew`);
console.log(`plan budowy: ${krokPlanu} z ${PLAN.length} (bez miejsca: ${odrzucone})`);
console.log(`ulepszenia: ${stan.ulepszenia.join(", ") || "brak"}`);
