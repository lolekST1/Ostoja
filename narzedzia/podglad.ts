/**
 * Ostoja — podgląd i sprawdzenie mapy bez przeglądarki.
 *
 * Odpowiada na trzy pytania, których po obrazku nie da się rozstrzygnąć:
 * czy mapa jest spójna (A* dojdzie wszędzie), czy zasobów starcza na grę
 * i czy generator jest deterministyczny.
 *
 * Uruchomienie:  node --experimental-strip-types narzedzia/podglad.ts [ziarno]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { KonfiguracjaMapy, Teren } from "../src/sim/typy.ts";
import { DREWNA_Z_DRZEWA } from "../src/sim/typy.ts";
import { generujMape, indeks, osiagalneOd, policzTereny } from "../src/sim/mapa.ts";
import { znajdzSciezke } from "../src/sim/szukanie.ts";

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), "..");
const konfig: KonfiguracjaMapy = JSON.parse(
  readFileSync(join(KORZEN, "dane/mapa.json"), "utf8"),
);

const ZIARNO = Number(process.argv[2] ?? 1234);

const ZNAKI: Record<Teren, string> = {
  las: "♣",
  laka: "·",
  glina: "▒",
  woda: "~",
  skala: "▲",
  ziemia: ",",
};

// ---------------------------------------------------------------------------

const mapa = generujMape(konfig, ZIARNO);
const start = mapa.start!;

// --- obrazek -----------------------------------------------------------------

const wiersze: string[] = [];
for (let y = 0; y < mapa.wysokosc; y++) {
  let linia = "";
  for (let x = 0; x < mapa.szerokosc; x++) {
    linia +=
      x === start.x && y === start.y
        ? "@"
        : ZNAKI[mapa.kafelki[indeks(mapa, x, y)].teren];
  }
  wiersze.push(linia);
}
console.log(`mapa ${mapa.szerokosc}×${mapa.wysokosc}, ziarno ${ZIARNO}  (@ = osada)\n`);
console.log(wiersze.join("\n"));

// --- zasoby ------------------------------------------------------------------

const tereny = policzTereny(mapa);
const drzewa = tereny.las;
const glinaJednostki = tereny.glina * konfig.glinaZasob;
console.log("\n--- teren ---");
for (const [teren, ile] of Object.entries(tereny)) {
  const procent = ((ile / mapa.kafelki.length) * 100).toFixed(1);
  console.log(`  ${teren.padEnd(7)} ${String(ile).padStart(4)}  (${procent}%)`);
}
console.log(
  `  drewno w lesie: ${drzewa * DREWNA_Z_DRZEWA} jednostek (${drzewa} drzew)`,
);
console.log(`  glina w złożach: ${glinaJednostki} jednostek`);

// --- spójność ----------------------------------------------------------------

// Ta sama funkcja, z której korzysta generator przy naprawie spójności — więc
// test sprawdza dokładnie tę regułę przejścia, którą stosuje A*.
const osiagalne = osiagalneOd(mapa, start);
let przechodnie = 0;
let odciete = 0;
for (let i = 0; i < mapa.kafelki.length; i++) {
  if (!mapa.kafelki[i].przechodni) continue;
  przechodnie++;
  if (!osiagalne[i]) odciete++;
}
const procentOdcietych = (odciete / przechodnie) * 100;
console.log("\n--- spójność ---");
console.log(
  `  przechodnich ${przechodnie}, odciętych od osady ${odciete} (${procentOdcietych.toFixed(1)}%)`,
);

// --- A* ----------------------------------------------------------------------

/** Najdalszy osiągalny kafelek — najtrudniejszy uczciwy test dla A*. */
let najdalszy = start;
let najdalejKwadrat = -1;
for (let i = 0; i < mapa.kafelki.length; i++) {
  if (!osiagalne[i]) continue;
  const x = i % mapa.szerokosc;
  const y = (i - x) / mapa.szerokosc;
  const d = (x - start.x) ** 2 + (y - start.y) ** 2;
  if (d > najdalejKwadrat) {
    najdalejKwadrat = d;
    najdalszy = { x, y };
  }
}

const zegar = process.hrtime.bigint();
const sciezka = znajdzSciezke(mapa, start, najdalszy);
const mikro = Number(process.hrtime.bigint() - zegar) / 1000;

console.log("\n--- A* ---");
console.log(
  `  osada (${start.x},${start.y}) -> najdalszy kąt (${najdalszy.x},${najdalszy.y}): ` +
    (sciezka ? `${sciezka.length} kroków w ${mikro.toFixed(0)} µs` : "BRAK DROGI"),
);

// Ścieżka musi być ciągła i omijać przeszkody — inaczej ludzie będą przenikać.
let bledy = 0;
if (sciezka) {
  let poprzedni = start;
  for (const krok of sciezka) {
    const dx = Math.abs(krok.x - poprzedni.x);
    const dy = Math.abs(krok.y - poprzedni.y);
    if (dx > 1 || dy > 1 || dx + dy === 0) bledy++;
    if (!mapa.kafelki[indeks(mapa, krok.x, krok.y)].przechodni) bledy++;
    poprzedni = krok;
  }
}
console.log(`  ciągłość ścieżki: ${bledy === 0 ? "OK" : `${bledy} BŁĘDÓW`}`);

// Dojście "obok celu": do wnętrza jeziora nie ma wejścia, ale na brzeg owszem.
const wodaGdzies = mapa.kafelki.findIndex((k) => k.teren === "woda");
if (wodaGdzies >= 0) {
  const wx = wodaGdzies % mapa.szerokosc;
  const wy = (wodaGdzies - wx) / mapa.szerokosc;
  const doWody = znajdzSciezke(mapa, start, { x: wx, y: wy }, { obokCelu: true });
  const wprost = znajdzSciezke(mapa, start, { x: wx, y: wy });
  console.log(
    `  do wody (${wx},${wy}): wprost ${wprost ? "jest droga (ŹLE)" : "brak drogi (OK)"}, ` +
      `obokCelu ${doWody ? `${doWody.length} kroków (OK)` : "brak drogi"}`,
  );
}

// --- determinizm -------------------------------------------------------------

const znowu = generujMape(konfig, ZIARNO);
const inne = generujMape(konfig, ZIARNO + 1);
const takaSama = JSON.stringify(znowu) === JSON.stringify(mapa);
const rozna = JSON.stringify(inne) !== JSON.stringify(mapa);
console.log("\n--- determinizm ---");
console.log(`  to samo ziarno daje tę samą mapę: ${takaSama ? "OK" : "BŁĄD"}`);
console.log(`  inne ziarno daje inną mapę: ${rozna ? "OK" : "BŁĄD"}`);

const wszystkoOk =
  takaSama && rozna && bledy === 0 && sciezka !== null && procentOdcietych < 1;
console.log(`\n${wszystkoOk ? "WSZYSTKO OK" : "SĄ PROBLEMY"}`);
if (!wszystkoOk) process.exitCode = 1;
