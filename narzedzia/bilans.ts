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
import { wolneMiejscaWChatach, zrobZapasy } from "../src/sim/osada.ts";
import { mozliwaBudowa, rozpocznijBudowe, stacNa } from "../src/sim/budowa.ts";
import { ruszLudzi } from "../src/sim/ludzie.ts";
import { swiatMapy, zasobWZasiegu } from "../src/sim/swiat.ts";
import { utworzLos } from "../src/sim/los.ts";
import { budynekDostepny } from "../src/sim/stopnie.ts";

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
/**
 * Pozycje planu już postawione. Zbiór, nie licznik — pozycję zamkniętą
 * stopniem osady gracz pomija i wraca do niej po awansie.
 */
const zamkniete = new Set<number>();
/**
 * Numeracja od stu, a nie od zera. `nowaGra` rozdaje budynkom startowym `b_0`
 * i dalej, więc plac o tym samym identyfikatorze podszywał się pod chatę:
 * budowniczy miał wpisane miejsce pracy `b_0`, stał w drzwiach chaty `b_0`
 * i `obecniNaBudowie` liczyło zero. Plac nie ruszał z miejsca ani o procent,
 * osada zamierała na piątym budynku, a narzędzie porównywało bilans martwej
 * osady z tickiem martwej osady i ogłaszało zgodność.
 */
let nr = 100;

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
  if (stan.budynki.some((b) => !b.wybudowany)) return;

  // Dach przed planem. Bez tego osada dobija do sufitu mieszkaniowego w drugim
  // roku i dalej stoi — a bilans sprawdzany na martwej osadzie sprawdza tylko,
  // czy zero równa się zeru.
  if (wolneMiejscaWChatach(stan, dane) <= 0 && stacNa(stan, dane, "chata")) {
    const rog = gdzie("chata");
    if (rog) {
      rozpocznijBudowe(stan, dane, "chata", rog, `b_${nr++}`);
      return;
    }
  }

  // Pozycję zamkniętą stopniem osady pomijamy, a nie czekamy na nią. Gracz
  // czekający na gliniankę do awansu nie stawia przez pół roku niczego,
  // a wtedy ten test porównuje bilans martwej osady z tickiem martwej osady
  // i ogłasza zgodność — dokładnie tak jak przy pułapce z numeracją placów.
  for (let i = 0; i < PLAN.length; i++) {
    if (zamkniete.has(i)) continue;
    const typ = PLAN[i];
    if (!budynekDostepny(stan, dane, typ)) continue;
    if (!stacNa(stan, dane, typ)) return;
    const rog = gdzie(typ);
    if (!rog) return;
    rozpocznijBudowe(stan, dane, typ, rog, `b_${nr++}`);
    zamkniete.add(i);
    return;
  }
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
/**
 * Od czego dany surowiec zależy w łańcuchu produkcyjnym — wejścia receptur,
 * które go wytwarzają, i tak dalej w głąb. Chleb zależy od mąki i drewna, mąka
 * od zboża, więc chleb zależy też od zboża.
 *
 * Potrzebne, bo pusta pula rozlewa się po łańcuchu. Gdy drewno oscyluje wokół
 * zera, bilans mówi „cegielnia nie ruszy" (w jego wirtualnej puli drewna nie
 * ma), a tick ją uruchamia z ułamka ściętego tego samego ranka — i rozjeżdża
 * się nie drewno, tylko cegła.
 */
const zaleznosci: Record<string, Set<string>> = (() => {
  const wprost: Record<string, Set<string>> = {};
  for (const typ of Object.keys(dane.budynki) as TypBudynku[]) {
    const rec = dane.budynki[typ].receptura;
    if (!rec) continue;
    const wejscia = Object.keys(rec.wejscie);

    for (const wy of Object.keys(rec.wyjscie)) {
      wprost[wy] ??= new Set();
      for (const we of wejscia) wprost[wy].add(we);
    }

    // Wsady tej samej receptury zależą też od siebie nawzajem. Glina sama
    // z siebie nie zależy od niczego — wychodzi wprost z ziemi — ale zużywa ją
    // cegielnia, która bierze też drewno. W dniu, w którym drewna brakuje,
    // bilans zostawia glinę w spiżarni, a tick przerabia ją na cegłę z ułamka
    // ściętego rano. Niepewność jednego wsadu jest niepewnością wszystkich.
    for (const we of wejscia) {
      wprost[we] ??= new Set();
      for (const inne of wejscia) if (inne !== we) wprost[we].add(inne);
    }
  }

  const domkniete: Record<string, Set<string>> = {};
  for (const s of SUROWCE) {
    const zebrane = new Set<string>();
    const doObejscia = [...(wprost[s] ?? [])];
    while (doObejscia.length > 0) {
      const x = doObejscia.pop()!;
      if (zebrane.has(x)) continue;
      zebrane.add(x);
      for (const dalej of wprost[x] ?? []) doObejscia.push(dalej);
    }
    domkniete[s] = zebrane;
  }
  return domkniete;
})();

/** Ile dni wypadło z porównania danego surowca i dlaczego. */
const pominieteDni: Record<string, number> = {};
const powodPominiecia: Record<string, string> = {};
let sprawdzonych = 0;
let pominietych = 0;

for (let d = 0; d < LATA * DNI_W_ROKU; d++) {
  // Zapasy na zimę są bramą do drugiego stopnia, a bez drugiego stopnia nie ma
  // gliny, cegły, zboża, mąki ani chleba — czyli siedmiu z dziesięciu surowców
  // do porównania. Gracz, który ich nie robi, mierzy tu sam las i jagody.
  zrobZapasy(stan, dane);
  buduj();

  // Tick zaczyna od rozdania pracy, więc bilans liczony na wczorajszej obsadzie
  // mierzyłby inną osadę niż ta, która za chwilę przeżyje dzień. Postawienie
  // placu budowy przesuwa ludzi natychmiast — stąd to wywołanie tutaj.
  przydzielPrace(stan, dane);

  const bilans = policzBilans(stan, dane, (b) => swiat.mnoznikMiejsca(b));
  const przed = { ...stan.pula };
  const poraPrzed = stan.czas.pora;
  const pojemnoscPrzed = stan.pojemnosc;
  const ludnoscPrzed = stan.mieszkancy.length;

  const zdarzenia = tick(stan, dane, swiat, los);
  ruszLudzi(stan, dane); // jak w przeglądarce — inaczej budowy nigdy nie ruszą


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

  // Ile którego surowca było dziś pod ręką, zanim ruszyły warsztaty. Po tym
  // poznajemy dzień, w którym łańcuch pracował na styk i tempo przestaje go
  // opisywać.
  const podRekaDzis: Record<string, number> = {};
  for (const p of bilans.surowce) podRekaDzis[p.surowiec] = przed[p.surowiec] + p.przychod;

  for (const p of bilans.surowce) {
    const s = p.surowiec;

    // Pula ma ściany, których tempo nie opisuje: dorzuc() obcina nadwyżkę
    // o sufit magazynu, a warsztat przy pustym wsadzie nie rusza wcale, bo cykl
    // jest niepodzielny. Wyrzucamy **ten dzień dla tego surowca**, nie surowiec
    // na cały przebieg: pojedyncza ściana w piątym roku nie ma prawa unieważnić
    // czterystu dni, w których panel mówił prawdę.
    let sciana: string | null = null;
    if (przed[s] + Math.max(0, p.przychod) >= stan.pojemnosc - 1e-9) {
      sciana = "sufit magazynu";
    } else if (przed[s] + p.przychod < p.rozchod - 1e-9) {
      sciana = "pusta pula";
    } else {
      for (const zrodlo of zaleznosci[s]) {
        if ((podRekaDzis[zrodlo] ?? 0) < 1e-9) {
          sciana = `pusty wsad (${zrodlo})`;
          break;
        }
      }
    }

    if (sciana !== null) {
      pominieteDni[s] = (pominieteDni[s] ?? 0) + 1;
      powodPominiecia[s] ??= sciana;
      continue;
    }

    // Dni nie wyrzucamy — bajarz bierze trzy chleby raz na trzy dni, a domowik
    // jeden raz w tygodniu. Wygładzone tempo zgadza się z takim cyklem dopiero
    // w sumie, więc dziura w środku cyklu psułaby porównanie bardziej niż skok.
    //
    // Jedzenie zabrane przez osadnika doliczamy z powrotem. Panel świadomie nie
    // rozsmarowuje tego kosztu po dniach — pokazuje go w osobnym wierszu, jako
    // zdarzenie („następny osadnik: 173 jedzenia, za 4 dni"). Gdybyśmy nie
    // oddali tych stu sztuk, test karałby panel za to, że mówi prawdę.
    const faktyczne =
      stan.pula[s] - przed[s] + (zdarzenia.zaOsadnika[s] ?? 0);
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
  `  ${"surowiec".padEnd(9)} ${"dni".padStart(5)} ${"przewidziano".padStart(13)}` +
    ` ${"naprawdę".padStart(11)} ${"odchył/dzień".padStart(13)} ${"skok".padStart(7)}`,
);

/**
 * Ile dni musi zostać, żeby wynik dla surowca cokolwiek znaczył. Bez tego progu
 * narzędzie ogłaszałoby zgodność, sprawdziwszy siedem dni z czterystu — a to
 * dokładnie ta wada, przed którą ma bronić: test, który nic nie mierzy, jest
 * gorszy niż jego brak, bo daje spokój sumienia.
 */
const MINIMUM_DNI = 40;

let zle = 0;
let sprawdzalnych = 0;
let slabych = 0;
for (const s of SUROWCE) {
  const ile = liczonych[s] ?? 0;
  const pominiete = pominieteDni[s] ?? 0;
  if (ile === 0 && pominiete === 0) continue;

  const przew = sumaPrzewidziana[s] ?? 0;
  const fakt = sumaFaktyczna[s] ?? 0;
  const odchyl = ile > 0 ? (fakt - przew) / ile : 0;

  let uwaga = "";
  if (ile < MINIMUM_DNI) {
    slabych++;
    uwaga = `   (za mało dni — ${pominiete} odpadło: ${powodPominiecia[s] ?? "?"})`;
  } else {
    sprawdzalnych++;
    if (pominiete > 0) uwaga = `   (${pominiete} dni odpadło: ${powodPominiecia[s]})`;
    if (Math.abs(odchyl) > DOPUSZCZALNE_ODCHYLENIE) {
      zle++;
      uwaga += "   <-- SYSTEMATYCZNY BŁĄD";
    }
  }
  console.log(
    `  ${s.padEnd(9)} ${String(ile).padStart(5)} ${przew.toFixed(1).padStart(13)}` +
      ` ${fakt.toFixed(1).padStart(11)} ${odchyl.toFixed(3).padStart(13)}` +
      ` ${(najwiekszy[s] ?? 0).toFixed(2).padStart(7)}${uwaga}`,
  );
}
console.log(
  `\n  surowców sprawdzonych: ${sprawdzalnych} z ${SUROWCE.length}` +
    (slabych > 0 ? ` (${slabych} z za małą liczbą dni)` : ""),
);

// Panel ma też wskazywać wąskie gardła — sprawdzamy, czy w ogóle je znajduje.
const koncowy = policzBilans(stan, dane, (b) => swiat.mnoznikMiejsca(b));
console.log(`\n  korki na koniec (${koncowy.korki.length}):`);
for (const k of koncowy.korki.slice(0, 8)) {
  console.log(`    [${String(k.waga).padStart(3)}] ${k.opis}`);
}

const ok = zle === 0;
console.log(`\n${ok ? "BILANS ZGADZA SIĘ Z TICKIEM" : "BILANS KŁAMIE"}`);
if (!ok) process.exitCode = 1;
