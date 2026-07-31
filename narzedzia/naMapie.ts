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
import { DNI_W_PORZE, DNI_W_ROKU, DREWNA_Z_DRZEWA } from "../src/sim/typy.ts";
import type { Dane } from "../src/sim/budynki.ts";
import {
  kosztOsadnika,
  stanZapasow,
  wolneMiejscaWChatach,
  zapasJedzenia,
  zrobZapasy,
} from "../src/sim/osada.ts";
import { nowaGra } from "../src/sim/stan.ts";
import { tick } from "../src/sim/tick.ts";
import { mozliwaBudowa, rozpocznijBudowe, stacNa } from "../src/sim/budowa.ts";
import { kupUlepszenie, ulepszeniaPoKoszcie } from "../src/sim/budynki.ts";
import { ruszLudzi } from "../src/sim/ludzie.ts";
import { policzWPromieniu } from "../src/sim/mapa.ts";
import { srodekBudynku, swiatMapy, zasobWZasiegu } from "../src/sim/swiat.ts";
import { utworzLos } from "../src/sim/los.ts";
import { bezczynneRece, mozliwaWyprawa, wyslijWyprawe } from "../src/sim/wyprawy.ts";
import type { DefinicjaWyprawy } from "../src/sim/typy.ts";
import { kafelekNa } from "../src/sim/mapa.ts";
import { budynekDostepny } from "../src/sim/stopnie.ts";
import type { Kraina } from "../src/sim/kraina.ts";
import {
  mapaMiejsca,
  miejsceO,
  poryRokuMiejsca,
  umiejetnosciNa,
  zakonczeniaMiejsca,
} from "../src/sim/kraina.ts";
import { utworzMiary } from "./miary.ts";

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), "..");
const wczytaj = (p: string) => JSON.parse(readFileSync(join(KORZEN, p), "utf8"));

const dane: Dane & { wyprawy: DefinicjaWyprawy[] } = {
  budynki: wczytaj("dane/budynki.json"),
  ulepszenia: wczytaj("dane/ulepszenia.json"),
  stale: wczytaj("dane/stale.json"),
  wyprawy: wczytaj("dane/wyprawy.json"),
};
const kraina: Kraina = wczytaj("dane/kraina.json");

const LATA = Number(process.argv[2] ?? 5);
const ZIARNO = Number(process.argv[3] ?? 1234);
const DZIENNIK = process.argv.includes("dziennik");
/**
 * Gracz, który zapasów na zimę nie robi. Do zmierzenia, ile naprawdę kosztuje
 * zignorowanie jedynej decyzji jesieni — bez tego porównania nie wiadomo, czy
 * etap 2 dołożył decyzję, czy formalność do odklikania.
 */
const BEZ_ZAPASOW = process.argv.includes("bezzapasow");
/** Gracz, który nigdzie nikogo nie wysyła — do zmierzenia, ile dają wyprawy. */
const BEZ_WYPRAW = process.argv.includes("bezwypraw");

/**
 * Które miejsce krainy mierzymy. Pięć terenów to pięć różnych gospodarek —
 * Złote Łany prawie bez drzew i Borowa Głusza w samym borze nie mają prawa
 * wyjść tak samo, a bez tego argumentu narzędzie mierzyłoby wyłącznie
 * Wierzbnicę i ogłaszało, że kampania jest zbalansowana.
 */
const MIEJSCE =
  process.argv.find((a) => kraina.miejsca.some((m) => m.id === a)) ??
  kraina.miejsca[0].id;
const miejsce = miejsceO(kraina, MIEJSCE);
const konfigMapy: KonfiguracjaMapy = mapaMiejsca(
  wczytaj("dane/mapa.json"),
  miejsce,
);
dane.stale.moznikiPorRoku = poryRokuMiejsca(dane.stale.moznikiPorRoku, miejsce);
dane.stale.zakonczenia = zakonczeniaMiejsca(dane.stale.zakonczenia, miejsce);

// Umiejętności przyniesione z poprzednich miejsc omijają bramę stopni, więc
// bez nich narzędzie mierzy Kamieniec tak, jakby gracz przyszedł tam prosto
// z lasu i nie umiał nic — czyli inną grę niż ta, w którą się gra.
const stan = nowaGra(dane, konfigMapy, ZIARNO, {
  miejsce: MIEJSCE,
  umiejetnosci: umiejetnosciNa(kraina, MIEJSCE),
});
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
      } else if (typ === "mlyn") {
        // Gracz, który przeczytał w menu budowy „nad rzeką miele szybciej —
        // ale nie znosi cegielni w sąsiedztwie", szuka wody i omija piec.
        // Bez tego narzędzie mierzy gracza, który o wodniku nigdy nie
        // usłyszał, i przymierze z nim wychodzi z losowania.
        const w = dane.stale.wodnik;
        const srodek = srodekBudynku(rog, def.szerokosc, def.wysokosc);
        const przyWodzie =
          policzWPromieniu(stan.mapa, srodek, w.promienRzeki, "woda") > 0;
        const przyCegielni = stan.budynki.some((inny) => {
          if (inny.typ !== "cegielnia") return false;
          const d = dane.budynki.cegielnia;
          const s2 = srodekBudynku(inny, d.szerokosc, d.wysokosc);
          return Math.hypot(s2.x - srodek.x, s2.y - srodek.y) <= w.promienCegielni;
        });
        // Młyn nad wodą obok cegielni jest gorszy niż młyn na suchym: dostaje
        // klątwę, a nie błogosławieństwo.
        ocena = (przyWodzie ? (przyCegielni ? -200 : 100) : 0) - odleglosc;
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

/**
 * Pozycje planu już zamknięte — zbudowane albo porzucone (brak miejsca). To
 * zbiór indeksów, a nie licznik, bo pozycję zamkniętą stopniem gracz pomija
 * i wraca do niej później; licznik zjadałby wtedy nie tę pozycję, którą
 * właśnie postawiono.
 */
const zamknietePlanu = new Set<number>();
const planWykonany = (): boolean => zamknietePlanu.size >= PLAN.length;

let nr = 100;
let odrzucone = 0;
let przeniesione = 0;

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
 * Gracz czytający panel „gdzie się korkuje" widzi wiersz „w kręgu nie ma już
 * nic" i stawia nowy budynek tam, gdzie surowiec jeszcze jest. Narzędzie tego
 * nie robiło i dlatego glinianka stała po dwa lata jako martwy budynek —
 * co wyglądało na wadę ekonomii, a było brakiem reakcji.
 *
 * Zastępujemy dopiero wtedy, gdy WSZYSTKIE budynki danego rodzaju są suche:
 * inaczej osada stawiałaby glinianki w nieskończoność.
 */
function odtworzWyczerpany(): boolean {
  for (const typ of ["glinianka", "lesniczowka", "zbieracze"] as TypBudynku[]) {
    const maja = stan.budynki.filter((b) => b.typ === typ && b.wybudowany);
    if (maja.length === 0) continue;
    if (maja.some((b) => zasobWZasiegu(stan, dane, typ, b) > 0)) continue;
    if (!stacNa(stan, dane, typ)) continue;

    // Po surowiec chodzi się dalej niż przy pierwszej budowie: pula jest
    // wspólna i nic się nie transportuje, więc glinianka na drugim końcu mapy
    // działa tak samo jak ta pod chatami.
    const rog = znajdzMiejsce(typ, 20);
    // Nowe miejsce ma sens tylko wtedy, gdy naprawdę coś tam leży.
    if (!rog || zasobWZasiegu(stan, dane, typ, rog) < 40) continue;
    rozpocznijBudowe(stan, dane, typ, rog, `b_${nr++}`);
    przeniesione++;
    return true;
  }
  return false;
}

/**
 * Po wyczerpaniu planu gracz nie odkłada myszki. Osada rośnie dalej, a wraz
 * z nią koszt osadnika, więc trzeba dokładać to, co ten koszt pokrywa.
 */
const DALEJ: TypBudynku[] = [
  "zbieracze", "pole", "mlyn", "piekarnia", "lesniczowka", "gajowka",
];
let krokDalej = 0;

/** Czy którykolwiek surowiec stoi na suficie magazynu i nadwyżka przepada. */
function cosNaSuficie(): boolean {
  return (["drewno", "deska", "cegla", "chleb", "jagody", "maka", "zboze"] as const).some(
    (s) => stan.pula[s] >= stan.pojemnosc - 1e-9,
  );
}

type Wybor = { typ: TypBudynku; indeks?: number } | null;

/**
 * Po co gracz sięga dzisiaj. Dach przed wszystkim — osadnik nie przyjdzie,
 * dopóki nie ma gdzie zamieszkać, więc chata jest tu rekrutacją, nie dekoracją.
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

  // Martwy budynek zbierający idzie przed kolejną pozycją planu. Gracz, który
  // widzi w panelu „w kręgu nie ma już nic", nie czeka z tym do końca listy.
  if (odtworzWyczerpany()) return;

  const chce = czegoChce();
  if (!chce || !stacNa(stan, dane, chce.typ)) return;

  const rog = znajdzMiejsce(chce.typ);
  if (!rog) {
    // Brak miejsca to też wynik: na ciasnej mapie plan może się nie zmieścić.
    if (chce.indeks !== undefined) {
      odrzucone++;
      zamknietePlanu.add(chce.indeks);
    }
    return;
  }
  rozpocznijBudowe(stan, dane, chce.typ, rog, `b_${nr++}`);
  if (chce.indeks !== undefined) zamknietePlanu.add(chce.indeks);
  else if (planWykonany() && chce.typ !== "chata" && chce.typ !== "magazyn") {
    krokDalej++;
  }
}

const NADMIAR: Record<string, number> = { deska: 0.9, maka: 0.25, cegla: 0.25, glina: 0.25 };

function przestawLudzi(): void {
  // Jedzenia nigdy nie jest „dość" — schodzi na osadników, a koszt rośnie
  // z ludnością. Zbieraczy wstrzymujemy dopiero przy pełnym magazynie.
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
      wyjscie.every(
        (s) => NADMIAR[s] !== undefined && stan.pula[s as never] >= stan.pojemnosc * NADMIAR[s],
      );
    const chronione = DREWNOZERNE.includes(b.typ) || b.typ === "bajarz";
    b.wstrzymany = b.wstrzymany || nadmiar;
    if (!nadmiar && !chronione) b.wstrzymany = false;
  }
}

/**
 * Co bierze drewno na wsad do receptury. Nikt już nie pali w piecu za samo
 * istnienie, ale te trzy potrafią przerobić budulec, z którego miała stanąć
 * następna chata.
 */
const DREWNOZERNE: TypBudynku[] = ["tartak", "cegielnia", "piekarnia"];

/**
 * Przerwa obiadowa w żniwa. Panel „gdzie się korkuje" wypisuje graczowi wprost
 * „wstrzymaj pole na jeden dzień, zanim żniwa się skończą", więc narzędzie też
 * ma to umieć — inaczej mierzyłoby gracza, który ostrzeżenia nie czyta.
 */
function przerwaWZniwa(): void {
  const wZniwa = stan.czas.pora === "jesien";
  // Dokładnie jeden dzień w środku żniw. Południca liczy przerwy, nie długość.
  const dzienPrzerwy = DNI_W_PORZE * 2 + 12;
  for (const b of stan.budynki) {
    if (b.typ !== "pole") continue;
    b.wstrzymany = wZniwa && stan.czas.dzien === dzienPrzerwy;
  }
}

/**
 * Zapas budulca: nie przerabiaj okrąglaków, których potrzebujesz na to, po co
 * właśnie sięgasz. Rezerwa z kosztu, nie ze sztywnej liczby — sztywna
 * zatrzaskuje grę, gdy następna w kolejce jest kapliczka (deski i cegły, zero
 * drewna), a tartak stoi i desek nie będzie nigdy.
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
 * Rekrutacja: osadnik przed opowieścią. Bajarz bierze trzy chleby, a te same
 * trzy chleby są częścią ceny nowego człowieka — przytomny gracz wstrzymuje
 * bajarza, dopóki spiżarnia nie uzbiera na osadnika.
 */
function pilnujJedzenia(): void {
  const koszt = kosztOsadnika(dane, stan.ulepszenia, stan.mieszkancy.length);
  const chudo = zapasJedzenia(stan) < koszt && wolneMiejscaWChatach(stan, dane) > 0;
  for (const b of stan.budynki) {
    if (b.typ === "bajarz") b.wstrzymany = chudo;
  }
}

/**
 * Zapasy na zimę — jedyna decyzja jesieni. Gracz robi je, gdy tylko go na nie
 * stać: kwartał rozwoju jest wart więcej niż jednorazowy koszt.
 */
function odlozZapasy(): void {
  if (BEZ_ZAPASOW) return;
  zrobZapasy(stan, dane);
}

let nrWyprawy = 0;
let wyslanychWypraw = 0;

/**
 * Najbliższy kafelek danego terenu. Gracz nie chodzi na drugi koniec mapy po to,
 * po co może pójść za miedzę — a czas wyprawy idzie z odległości.
 */
function najblizszy(teren: string, maks = 18): Punkt | null {
  for (let r = 1; r <= maks; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const k = kafelekNa(stan.mapa, osada.x + dx, osada.y + dy);
        if (k && k.teren === teren) return { x: osada.x + dx, y: osada.y + dy };
      }
    }
  }
  return null;
}

/**
 * Wyprawy jako **zawór, nie nawyk** — i to jest cała nauka z pierwszego
 * pomiaru. Gracz, który wysyłał bezczynnych codziennie (ponad czterysta wypraw
 * na przebieg), kończył z 65 mieszkańcami zamiast 80: ludzie „bezczynni" jesienią
 * to rolnicy czekający na żniwa, a wysłani nad wodę nie wracają na czas i pola
 * stoją puste. Wyprawa ma ratować z zacięcia, nie chodzić w kółko.
 *
 * Wysyłamy więc tylko wtedy, gdy czegoś naprawdę brakuje, i nigdy w porze,
 * w której te same ręce będą zaraz potrzebne w polu.
 */
function wyslijWyprawy(): void {
  if (BEZ_WYPRAW) return;
  if (bezczynneRece(stan).length === 0) return;
  // Jesień to żniwa. Ci sami ludzie są za chwilę potrzebni na polu i wyprawa
  // w tym momencie kosztuje więcej, niż przynosi.
  if (stan.czas.pora === "jesien") return;

  const rezerwaDrewna = dane.budynki.chata.koszt.drewno ?? 20;
  const brakDrewna = stan.duchy.leszyBlokuje || stan.pula.drewno < rezerwaDrewna;
  const brakJedzenia =
    wolneMiejscaWChatach(stan, dane) > 0 &&
    zapasJedzenia(stan) <
      kosztOsadnika(dane, stan.ulepszenia, stan.mieszkancy.length);

  const kolejnosc = brakDrewna
    ? ["po-chrust"]
    : brakJedzenia
      ? ["na-ryby", "na-jagody"]
      : [];

  for (const rodzaj of kolejnosc) {
    const def = dane.wyprawy.find((w) => w.id === rodzaj)!;
    const tereny = Array.isArray(def.teren) ? def.teren : [def.teren];
    for (const teren of tereny) {
      const cel = najblizszy(teren);
      if (!cel) continue;
      if (!mozliwaWyprawa(stan, dane, rodzaj, cel).ok) continue;
      if (wyslijWyprawe(stan, dane, rodzaj, cel, `w_${nrWyprawy++}`)) {
        wyslanychWypraw++;
        return;
      }
    }
  }
}

/**
 * Czy gracz ma dziś co zrobić. Do miary „dni bez decyzji".
 *
 * Wyprawa liczy się tak samo jak budowa i to jest sedno etapu 4: jest jedyną
 * rzeczą, którą da się zrobić **nie mając surowców na nic**. Gdyby miara jej nie
 * widziała, mówiłaby „nie ma co robić" w dniu, w którym gracz może wysłać
 * czterech ludzi po chrust.
 */
function maDecyzje(): boolean {
  if (bezczynneRece(stan).length > 0) {
    for (const def of dane.wyprawy) {
      const tereny = Array.isArray(def.teren) ? def.teren : [def.teren];
      for (const teren of tereny) {
        const cel = najblizszy(teren);
        if (cel && mozliwaWyprawa(stan, dane, def.id, cel).ok) return true;
      }
    }
  }
  const z = stanZapasow(stan, dane);
  if (z.otwarte && !z.zrobione && z.stac) return true;
  const chce = czegoChce();
  if (chce && stacNa(stan, dane, chce.typ)) return true;
  return dane.ulepszenia.some(
    (u) => !stan.ulepszenia.includes(u.id) && stan.pula.opowiesc >= u.koszt,
  );
}

function kupUlepszenia(): void {
  // Ta sama funkcja co w grze (`kupUlepszenie`), bo inaczej narzędzie mierzy
  // inną ekonomię niż ta, w którą się gra. Najtańsze pierwsze i jedno naraz.
  for (const u of ulepszeniaPoKoszcie(dane)) {
    if (stan.ulepszenia.includes(u.id)) continue;
    kupUlepszenie(stan, dane, u.id);
    break;
  }
}

// ---------------------------------------------------------------------------

function drzewaNaMapie(): number {
  let suma = 0;
  for (const k of stan.mapa.kafelki) if (k.teren === "las") suma += k.zasob;
  return suma / DREWNA_Z_DRZEWA;
}

const miary = utworzMiary(() => stan, dane, maDecyzje);

const drzewaStart = drzewaNaMapie();
let dniBezZasobu = 0;
let przybylo = 0;
let zimZZapasami = 0;
const bezZasobuWg: Partial<Record<TypBudynku, number>> = {};

console.log(
  `${miejsce.nazwa} (${miejsce.teren}), ziarno ${ZIARNO}: ` +
    `${Math.round(drzewaStart)} drzew, ` +
    `osada na (${osada.x}, ${osada.y})\n`,
);

for (let dzien = 0; dzien < LATA * DNI_W_ROKU; dzien++) {
  odlozZapasy();
  wyslijWyprawy();
  buduj();
  kupUlepszenia();
  pilnujDrewna();
  pilnujJedzenia();
  przestawLudzi();
  // Przerwa obiadowa idzie na samym końcu, bo przestawLudzi() zdejmuje
  // wstrzymanie ze wszystkiego, co nie ma nadmiaru — a pole nadmiaru nie ma
  // nigdy. Postawiona wcześniej, kasowała się co do dnia i południca zabierała
  // kogoś w każde żniwa, choć narzędzie „robiło przerwę".
  przerwaWZniwa();
  const z = tick(stan, dane, swiat, los);
  // Tak samo jak w przeglądarce: ludzie chodzą po ticku, nie w nim (zasada 8).
  // Bez tego nikt nigdy nie dochodzi na plac budowy i osada nie stawia nic.
  ruszLudzi(stan, dane);

  miary.zapisz(dzien);

  przybylo += z.przybysze.length;
  if (z.przezimowano) zimZZapasami++;
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
        `zadowolenie ${Math.round(stan.zadowolenie)}, ` +
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
console.log(`przyszło osadników: ${przybylo}`);
console.log(`zadowolenie na koniec: ${Math.round(stan.zadowolenie)}`);
console.log(`zim przezimowanych z zapasami: ${zimZZapasami} z ${LATA}`);
console.log(`wypraw wysłanych: ${wyslanychWypraw}`);
console.log(
  `dni z budynkiem bez zasobu w kręgu: ${dniBezZasobu}` +
    (Object.keys(bezZasobuWg).length > 0
      ? ` (${Object.entries(bezZasobuWg)
          .map(([typ, ile]) => `${typ} ${ile}`)
          .join(", ")})`
      : ""),
);
console.log(`las: ${Math.round(drzewaNaMapie())} z ${Math.round(drzewaStart)} drzew`);
console.log(
  `plan budowy: ${zamknietePlanu.size} z ${PLAN.length} (bez miejsca: ${odrzucone}, ` +
    `budynków postawionych na nowym złożu: ${przeniesione})`,
);
console.log(`ulepszenia: ${stan.ulepszenia.join(", ") || "brak"}`);
console.log(`przymierza: ${stan.kodeks.filter((w) => w.startsWith("przymierze-")).length} (${stan.kodeks.join(", ")})`);
for (const wiersz of miary.podsumowanie()) console.log(wiersz);
