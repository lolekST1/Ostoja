/**
 * Ostoja — sprawdzenie krainy bez przeglądarki.
 *
 * Kampania jest jedyną rzeczą w grze, której nie widać w jednym przebiegu:
 * co się przenosi między mapami, co nie, i czy droga po pięciu miejscach
 * kończy się tam, gdzie powinna. Symulacja tego nie złapie, bo dotyczy
 * pojedynczej osady — stąd osobne narzędzie.
 *
 * Uruchomienie:  node --experimental-strip-types narzedzia/kraina.ts
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Kraina } from "../src/sim/kraina.ts";
import {
  mapaMiejsca,
  miejsceO,
  nastepneMiejsce,
  nowaKraina,
  poryRokuMiejsca,
  pozegnanie,
  skadPrzyszli,
  umiejetnosciNa,
  wiedzaDoOsady,
  zakonczeniaMiejsca,
  zamknijMiejsce,
} from "../src/sim/kraina.ts";
import type { KonfiguracjaMapy } from "../src/sim/typy.ts";
import { TYPY_BUDYNKOW } from "../src/sim/typy.ts";

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), "..");
const wczytaj = (p: string) => JSON.parse(readFileSync(join(KORZEN, p), "utf8"));

const kraina: Kraina = wczytaj("dane/kraina.json");
const konfigBaza: KonfiguracjaMapy = wczytaj("dane/mapa.json");
const stale = wczytaj("dane/stale.json");
const budynki = wczytaj("dane/budynki.json");

let bledy = 0;
function sprawdz(warunek: boolean, opis: string): void {
  console.log(`  ${warunek ? "OK  " : "ŹLE "}  ${opis}`);
  if (!warunek) bledy++;
}

// ---------------------------------------------------------------------------
console.log("\ndane miejsc");

for (const m of kraina.miejsca) {
  sprawdz(
    m.wprowadzenie.length >= 3 && m.wprowadzenie.length <= 4,
    `${m.nazwa}: wprowadzenie ma 3–4 akapity (ma ${m.wprowadzenie.length})`,
  );
  // Dłuższe wprowadzenie dziecko przeklika bez czytania i cała robota idzie
  // w las — stąd twardy limit, a nie dobre chęci.
  const zaDlugie = m.wprowadzenie.filter((a) => a.length > 260);
  sprawdz(zaDlugie.length === 0, `${m.nazwa}: żaden akapit nie jest za długi`);
  sprawdz(m.duchMowi.length > 0, `${m.nazwa}: duch prowadzący się odzywa`);
  sprawdz(
    typeof m.pozegnanie.domyslne === "string" && m.pozegnanie.domyslne.length > 0,
    `${m.nazwa}: ma pożegnanie domyślne`,
  );
  sprawdz(
    m.przynosi.every((t) => (TYPY_BUDYNKOW as readonly string[]).includes(t)),
    `${m.nazwa}: przynosi tylko istniejące budynki`,
  );
  sprawdz(
    (m.przynosi.length > 0) === (m.przyprowadza.length > 0),
    `${m.nazwa}: umiejętność i zdanie o ludziach idą w parze`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nco się przenosi, a co nie");

const pierwsze = kraina.miejsca[0].id;
sprawdz(
  umiejetnosciNa(kraina, pierwsze).length === 0,
  "pierwsze miejsce nie umie nic z góry",
);
sprawdz(
  skadPrzyszli(kraina, pierwsze).length === 0,
  "na pierwsze miejsce nikt skądś nie przyszedł",
);

const ostatnie = kraina.miejsca[kraina.miejsca.length - 1];
const umieOstatni = umiejetnosciNa(kraina, ostatnie.id);
sprawdz(
  umieOstatni.length === kraina.miejsca.slice(0, -1).flatMap((m) => m.przynosi).length,
  `ostatnie miejsce umie wszystko z drogi (${umieOstatni.join(", ")})`,
);
// Coś musi zostać do dosłużenia się na każdej mapie, także na ostatniej —
// inaczej Kamieniec otwiera się cały w dniu pierwszym i stopnie przestają
// tam cokolwiek znaczyć.
const zamknieteNaKoncu = TYPY_BUDYNKOW.filter(
  (t) => budynki[t].stopien !== "polana" && !umieOstatni.includes(t),
);
sprawdz(
  zamknieteNaKoncu.length > 0,
  `na ostatniej mapie zostaje coś do zdobycia (${zamknieteNaKoncu.join(", ")})`,
);

// ---------------------------------------------------------------------------
console.log("\ndroga przez krainę");

let stan = nowaKraina(kraina);
sprawdz(stan.biezace === pierwsze, "kampania zaczyna się na pierwszym miejscu");

for (let i = 0; i < kraina.miejsca.length; i++) {
  const tu = miejsceO(kraina, stan.biezace);
  const zakonczenia = i % 2 === 0 ? (["z-lasem"] as const) : ([] as const);
  const zdanie = pozegnanie(tu, [...zakonczenia]);
  sprawdz(zdanie.length > 0, `${tu.nazwa}: pożegnanie ma treść`);

  stan = zamknijMiejsce(kraina, stan, [...zakonczenia], [
    "leszy",
    "przymierze-leszy",
  ]);
  const dalej = nastepneMiejsce(kraina, tu.id);
  sprawdz(
    stan.biezace === (dalej ? dalej.id : tu.id),
    `${tu.nazwa}: droga prowadzi ${dalej ? `do ${dalej.nazwa}` : "donikąd, i to jest koniec"}`,
  );
}
sprawdz(
  stan.przebyte.length === kraina.miejsca.length,
  "po przejściu wszystkich miejsc każde jest odnotowane",
);

// Przymierze to trwała premia do produkcji, więc przeniesienie go dalej jest
// przeniesieniem surowców pod inną nazwą (zasada 9).
sprawdz(
  stan.kodeks.includes("przymierze-leszy"),
  "kraina pamięta przymierze na ekranie końcowym",
);
sprawdz(
  !wiedzaDoOsady(stan).includes("przymierze-leszy"),
  "ale nowa osada dostaje wiedzę o leszym bez przymierza z nim",
);
sprawdz(wiedzaDoOsady(stan).includes("leszy"), "sama wiedza o duchu jedzie dalej");

// ---------------------------------------------------------------------------
console.log("\nteren i progi");

for (const m of kraina.miejsca) {
  const mapa = mapaMiejsca(konfigBaza, m);
  sprawdz(mapa.szerokosc === konfigBaza.szerokosc, `${m.nazwa}: mapa ma rozmiar bazowy`);
  // Mapa bez ani jednego drzewa nie ma jagód, bo zbieracze zbierają z lasu —
  // i osada głoduje przez cały pierwszy rok. Zmierzone na Złotych Łanach.
  sprawdz(mapa.lasPlam >= 4, `${m.nazwa}: jest z czego zbierać jagody`);

  const progi = zakonczeniaMiejsca(stale.zakonczenia, m);
  sprawdz(progi.ludna > 0, `${m.nazwa}: próg „osada ludna" ustawiony (${progi.ludna})`);
  sprawdz(
    (progi.borKrotnosc ?? 1) > 0,
    `${m.nazwa}: krotność boru ustawiona (${progi.borKrotnosc ?? 1})`,
  );

  const pory = poryRokuMiejsca(stale.moznikiPorRoku, m);
  sprawdz(pory.gajowka?.zima === 0, `${m.nazwa}: gajówka zimą nie sadzi`);
}

console.log(bledy === 0 ? "\nWSZYSTKO OK" : `\nBŁĘDÓW: ${bledy}`);
process.exit(bledy === 0 ? 0 : 1);
