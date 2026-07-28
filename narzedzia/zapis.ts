/**
 * Ostoja — sprawdzenie zapisu i odczytu.
 *
 * Najważniejszy test jest ostatni: gra wczytana z zapisu musi toczyć się dalej
 * dokładnie tak samo, jak gdyby jej nie przerywano. Bez tego zapis po cichu
 * rozjeżdża przebieg i żadne balansowanie nie ma sensu.
 *
 * Uruchomienie:  node --experimental-strip-types narzedzia/zapis.ts [ziarno]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Budynek, KonfiguracjaMapy, StanGry } from "../src/sim/typy.ts";
import { WERSJA_ZAPISU } from "../src/sim/typy.ts";
import type { Dane } from "../src/sim/budynki.ts";
import { doTekstu, nowaGra, zTekstu } from "../src/sim/stan.ts";
import { tick } from "../src/sim/tick.ts";
import type { Swiat } from "../src/sim/tick.ts";
import { utworzLos } from "../src/sim/los.ts";

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), "..");
const wczytaj = (p: string) => JSON.parse(readFileSync(join(KORZEN, p), "utf8"));

const dane: Dane = {
  budynki: wczytaj("dane/budynki.json"),
  ulepszenia: wczytaj("dane/ulepszenia.json"),
  stale: wczytaj("dane/stale.json"),
};
const konfigMapy: KonfiguracjaMapy = wczytaj("dane/mapa.json");

const ZIARNO = Number(process.argv[2] ?? 1234);

// Świat zastępczy — do sprawdzenia zapisu wystarczą liczniki, bo testujemy
// wierność odtworzenia stanu, nie ekonomię.
const swiat: Swiat = {
  pobierz: (_b: Budynek, ile: number) => ile,
  posadz: () => {},
};

let bledy = 0;
function sprawdz(nazwa: string, warunek: boolean, szczegol = ""): void {
  console.log(`  ${warunek ? "OK  " : "BŁĄD"}  ${nazwa}${szczegol ? ` — ${szczegol}` : ""}`);
  if (!warunek) bledy++;
}

function odczytajAlboPadnij(tekst: string): StanGry {
  const wynik = zTekstu(tekst);
  if (!wynik.ok) throw new Error(wynik.powod);
  return wynik.stan;
}

// ---------------------------------------------------------------------------

console.log(`zapis, ziarno ${ZIARNO}, wersja schematu ${WERSJA_ZAPISU}\n`);

// --- 1. Nowa gra ------------------------------------------------------------

const swieza = nowaGra(dane, konfigMapy, ZIARNO);
console.log("--- nowa gra ---");
sprawdz("są mieszkańcy", swieza.mieszkancy.length === dane.stale.start.mieszkancy,
  `${swieza.mieszkancy.length}`);
sprawdz("stoją budynki startowe", swieza.budynki.length === dane.stale.start.budynki.length,
  swieza.budynki.map((b) => b.typ).join(", "));
sprawdz("magazyn dał pojemność", swieza.pojemnosc > 0, `${swieza.pojemnosc}`);
sprawdz("każdy ma dach nad głową", swieza.mieszkancy.every((m) => m.dom !== null));
sprawdz("budynki zajęły kafelki",
  swieza.mapa.kafelki.filter((k) => k.zajetyPrzez !== null).length > 0,
  `${swieza.mapa.kafelki.filter((k) => k.zajetyPrzez !== null).length} kafelków`);
sprawdz("budynki się nie nakładają",
  new Set(swieza.budynki.map((b) => `${b.x},${b.y}`)).size === swieza.budynki.length);

// --- 2. Obieg w obie strony -------------------------------------------------

console.log("\n--- zapis i odczyt ---");
const tekst = doTekstu(swieza);
const wczytana = odczytajAlboPadnij(tekst);
sprawdz("stan po odczycie jest identyczny", doTekstu(wczytana) === tekst);
sprawdz("mapa ma tyle samo kafelków",
  wczytana.mapa.kafelki.length === swieza.mapa.kafelki.length);
sprawdz("polana startowa przetrwała",
  wczytana.mapa.start?.x === swieza.mapa.start?.x &&
    wczytana.mapa.start?.y === swieza.mapa.start?.y);
console.log(`  (rozmiar zapisu: ${(tekst.length / 1024).toFixed(1)} kB)`);

// --- 3. Zmiany na mapie ------------------------------------------------------

console.log("\n--- zmiany terenu przeżywają zapis ---");
const zmieniona = nowaGra(dane, konfigMapy, ZIARNO);
const lasy = zmieniona.mapa.kafelki.filter((k) => k.teren === "las");
lasy[0].zasob = 0; // wycięte drzewo
lasy[1].zasob = 3; // napoczęte
zmieniona.mapa.kafelki[0].przechodni = false; // korytarz zasypany
zmieniona.pula.drewno = 123.5;
const poObiegu = odczytajAlboPadnij(doTekstu(zmieniona));
const lasyPo = poObiegu.mapa.kafelki.filter((k) => k.teren === "las");
sprawdz("wycięte drzewo zostało wycięte", lasyPo[0].zasob === 0);
sprawdz("napoczęte drzewo ma swój zasób", lasyPo[1].zasob === 3);
sprawdz("przechodniość zapisana wprost", poObiegu.mapa.kafelki[0].przechodni === false);
sprawdz("ułamki w puli przetrwały", poObiegu.pula.drewno === 123.5);

// --- 4. Zapsute i obce zapisy ------------------------------------------------

console.log("\n--- zapis, którego nie da się wczytać ---");
const smiec = zTekstu("{to nie jest json");
sprawdz("uszkodzony zapis nie wywraca gry", !smiec.ok,
  smiec.ok ? "" : smiec.powod);
const zNowszej = zTekstu(JSON.stringify({ ...JSON.parse(tekst), wersja: WERSJA_ZAPISU + 5 }));
sprawdz("zapis z nowszej wersji jest odrzucony", !zNowszej.ok,
  zNowszej.ok ? "" : zNowszej.powod);
const bezMapy = zTekstu(JSON.stringify({ ...JSON.parse(tekst), mapa: undefined }));
sprawdz("zapis bez mapy jest odrzucony", !bezMapy.ok,
  bezMapy.ok ? "" : bezMapy.powod);

// --- 5. Ten sam zapis daje ten sam przebieg ----------------------------------

console.log("\n--- przebieg po wczytaniu ---");

function przewin(stan: StanGry, dni: number): StanGry {
  const los = utworzLos(stan.ziarno);
  for (let i = 0; i < dni; i++) tick(stan, dane, swiat, los);
  return stan;
}

/**
 * Osada startowa nie produkuje niczego (to dopiero rola gracza), więc bez
 * pomocy wymiera i porównywanie dwóch pustych osad niczego nie dowodzi.
 *
 * Drewno jest tu ważniejsze od chleba: w tick.ts brak opału liczy się tak samo
 * jak głód, a startowa pula nie zawiera ani jednego polana. Bez tej linijki
 * wszyscy odchodzą jedenastego dnia, mimo pełnej spiżarni.
 */
function zSpizarnia(stan: StanGry): StanGry {
  stan.pula.chleb = 1500;
  stan.pula.jagody = 300;
  stan.pula.drewno = 3000;
  return stan;
}

// Gra bez przerwy: 40 dni, zapis, kolejne 40 dni.
const bezPrzerwy = przewin(zSpizarnia(nowaGra(dane, konfigMapy, ZIARNO)), 40);
const wPolowie = doTekstu(bezPrzerwy);
przewin(bezPrzerwy, 40);

// Gra przerwana: te same 40 dni, zapis, wczytanie, kolejne 40 dni.
const przerwana = przewin(odczytajAlboPadnij(wPolowie), 40);

sprawdz("po wczytaniu przebieg jest identyczny", doTekstu(przerwana) === doTekstu(bezPrzerwy));
sprawdz("czas się zgadza",
  przerwana.czas.dzien === bezPrzerwy.czas.dzien && przerwana.czas.rok === bezPrzerwy.czas.rok,
  `dzień ${przerwana.czas.dzien}, rok ${przerwana.czas.rok}`);
sprawdz("ludność się zgadza",
  przerwana.mieszkancy.length === bezPrzerwy.mieszkancy.length,
  `${przerwana.mieszkancy.length}`);
// Jeśli nikt nie przybył, losowanie w ogóle nie zadziałało i test nic nie wart.
sprawdz("przez te 80 dni faktycznie coś się losowało",
  przerwana.mieszkancy.length > dane.stale.start.mieszkancy,
  `${dane.stale.start.mieszkancy} -> ${przerwana.mieszkancy.length}`);
sprawdz("ziarno po wczytaniu jest to samo", przerwana.ziarno === bezPrzerwy.ziarno);

// ---------------------------------------------------------------------------

console.log(`\n${bledy === 0 ? "WSZYSTKO OK" : `${bledy} BŁĘDÓW`}`);
if (bledy > 0) process.exitCode = 1;
