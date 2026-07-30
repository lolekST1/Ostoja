/**
 * Ostoja — punkt wejścia warstwy przeglądarki.
 *
 * Skleja trzy rzeczy: symulację (src/sim), scenę Phasera (src/render) i
 * interfejs w DOM (src/ui). Phaser rysuje wyłącznie świat, cała reszta to
 * zwykły HTML nałożony na canvas (zasada 4).
 *
 * Tu też płynie czas: pętla dzienna woła tick() i dopiero po nim rusza ludźmi.
 * Chodzenie jest warstwą widoku, więc siedzi poza tickiem — inaczej narzędzie
 * balansujące, które mapy nie ma, musiałoby udawać, że ją ma.
 */

import Phaser from "phaser";

import type { Dane } from "./sim/budynki.ts";
import type {
  Budynek,
  KonfiguracjaMapy,
  Punkt,
  StanGry,
  TypBudynku,
} from "./sim/typy.ts";
import type { Zdarzenia } from "./sim/tick.ts";
import { indeks } from "./sim/mapa.ts";
import { nowaGra } from "./sim/stan.ts";
import { tick } from "./sim/tick.ts";
import {
  anulujBudowe,
  drzewaPod,
  mozliwaBudowa,
  rozbierz,
  rozpocznijBudowe,
} from "./sim/budowa.ts";
import { policzBilans } from "./sim/bilans.ts";
import { ruszLudzi } from "./sim/ludzie.ts";
import { swiatMapy } from "./sim/swiat.ts";
import { zrobZapasy } from "./sim/osada.ts";
import {
  borTeraz,
  czyKoniecSprintu,
  drzewNaMapie,
  drzewNaStarcie,
  zdobyteZakonczenia,
} from "./sim/zakonczenia.ts";
import { znajdzSciezke } from "./sim/szukanie.ts";
import { utworzLos } from "./sim/los.ts";
import { ScenaGry } from "./render/scenaGry.ts";
import { rysujPasek } from "./ui/pasek.ts";
import { utworzMenuBudowy } from "./ui/menuBudowy.ts";
import { rysujPanel } from "./ui/panel.ts";
import { rysujKorki } from "./ui/korki.ts";
import { utworzKodeks } from "./ui/kodeks.ts";
import { utworzSamouczek } from "./ui/samouczek.ts";
import { utworzEkranKonca } from "./ui/koniec.ts";
import { opisWyprawy, utworzMenuWypraw } from "./ui/wyprawy.ts";
import type { KrokSamouczka } from "./ui/samouczek.ts";
import type { WpisKodeksu } from "./ui/kodeks.ts";
import type { DefinicjaZakonczenia } from "./sim/zakonczenia.ts";
import type { DefinicjaWyprawy } from "./sim/typy.ts";
import { bezczynneRece, mozliwaWyprawa, wyslijWyprawe } from "./sim/wyprawy.ts";
import {
  krokSamouczka,
  skasujZapis,
  wczytajGre,
  zapamietajKrokSamouczka,
  zapiszGre,
} from "./zapis.ts";

import budynki from "../dane/budynki.json";
import ulepszenia from "../dane/ulepszenia.json";
import stale from "../dane/stale.json";
import konfiguracjaMapy from "../dane/mapa.json";
import wpisyKodeksu from "../dane/kodeks.json";
import wpisyZakonczen from "../dane/zakonczenia.json";
import rodzajeWypraw from "../dane/wyprawy.json";
import krokiSamouczka from "../dane/samouczek.json";

const dane = {
  budynki,
  ulepszenia,
  stale,
  wyprawy: rodzajeWypraw as DefinicjaWyprawy[],
} as unknown as Dane & { wyprawy: DefinicjaWyprawy[] };
const konfigMapy = konfiguracjaMapy as KonfiguracjaMapy;

// ---------------------------------------------------------------------------
// Stan
// ---------------------------------------------------------------------------

const podpowiedz = document.querySelector<HTMLDivElement>("#podpowiedz")!;
function powiedz(tekst: string): void {
  podpowiedz.textContent = tekst;
}

function ziarnoZAdresu(): number {
  const podane = new URLSearchParams(location.search).get("ziarno");
  return podane === null ? Date.now() % 100000 : Number(podane);
}

function zacznij(): StanGry {
  const zapisany = wczytajGre();
  if (zapisany === null) return nowaGra(dane, konfigMapy, ziarnoZAdresu());
  if (zapisany.ok) return zapisany.stan;

  // Zapis jest, ale nie da się go odczytać. Gra ma ruszyć mimo to — z nową
  // osadą i wyjaśnieniem, a nie z białym ekranem.
  powiedz(`Nie udało się wczytać zapisu: ${zapisany.powod}. Zaczynam od nowa.`);
  return nowaGra(dane, konfigMapy, ziarnoZAdresu());
}

let stan: StanGry = zacznij();
let los = utworzLos(stan.ziarno);
const swiat = swiatMapy(() => stan, dane);

/** Typ budynku trzymany „w ręce". null = zwykłe oglądanie osady. */
let trybBudowy: TypBudynku | null = null;
/** Rodzaj wyprawy czekający na wskazanie celu. Wyklucza się z trybem budowy. */
let trybWyprawy: string | null = null;
let nrWyprawy = 0;
/** Identyfikator, nie obiekt — po wczytaniu zapisu budynki są nowymi obiektami. */
let zaznaczony: string | null = null;
let zaznaczonyKafelek: Punkt | null = null;
let nrBudynku = 0;
/** Ile wpisów Kodeksu było ostatnio — żeby zauważyć nowy i o nim powiedzieć. */
let ostatnioWKodeksie = 0;
/** Czy ekran końcowy już się pokazał. Ma się pokazać raz, nie co dzień. */
let juzPodsumowane = false;

function budynekPo(id: string | null): Budynek | null {
  return stan.budynki.find((b) => b.id === id) ?? null;
}

/** Lewy górny róg tak, żeby bryła siedziała pod kursorem, a nie obok niego. */
function rogPodKursorem(kafelek: Punkt, typ: TypBudynku): Punkt {
  const def = dane.budynki[typ];
  return {
    x: kafelek.x - Math.floor((def.szerokosc - 1) / 2),
    y: kafelek.y - Math.floor((def.wysokosc - 1) / 2),
  };
}

// ---------------------------------------------------------------------------
// Scena
// ---------------------------------------------------------------------------

const scena = new ScenaGry({
  dane,
  konfigMapy,
  stan: () => stan,
  gotowe: () => odswiezInterfejs(),
  postepDnia: () => postepDnia(),

  naRuchWskaznika(kafelek, scena) {
    if (!trybBudowy) return;
    const rog = rogPodKursorem(kafelek, trybBudowy);
    const mozna = mozliwaBudowa(stan, dane, trybBudowy, rog).ok;
    // Żółty podkład zamiast zielonego mówi „postawisz, ale wytniesz las" —
    // zanim gracz kliknie, a nie po fakcie.
    const karczowanie = mozna && drzewaPod(stan, dane, trybBudowy, rog) > 0;
    scena.pokazPodklad(rog, trybBudowy, mozna, karczowanie);
  },

  naOdwolanie(scena) {
    if (trybWyprawy) {
      trybWyprawy = null;
      odswiezInterfejs();
      powiedz("Wyprawa odwołana.");
      return;
    }
    if (trybBudowy) {
      trybBudowy = null;
      scena.pokazPodklad(null, null, false);
      odswiezInterfejs();
      powiedz("Odłożone.");
    }
  },

  naKlikniecieKafelka(kafelek, scena) {
    if (trybWyprawy) {
      wyslij(kafelek);
      return;
    }
    if (trybBudowy) {
      postaw(kafelek, scena);
      return;
    }
    zaznacz(kafelek, scena);
  },
});

function postaw(kafelek: Punkt, scena: ScenaGry): void {
  const typ = trybBudowy!;
  const rog = rogPodKursorem(kafelek, typ);
  const wynik = mozliwaBudowa(stan, dane, typ, rog);
  if (!wynik.ok) {
    powiedz(`Tu nie postawisz — ${wynik.powod}.`);
    return;
  }

  const { budynek, wykarczowane } = rozpocznijBudowe(
    stan,
    dane,
    typ,
    rog,
    `b_${stan.czas.rok}_${stan.czas.dzien}_${nrBudynku++}`,
  );
  // Jeden budynek na kliknięcie. Trzymanie typu w ręce po postawieniu kusi do
  // zastawienia całej polany naraz, a wtedy kolejka budowy stoi przez pół roku.
  trybBudowy = null;
  zaznaczony = budynek.id;
  zaznaczonyKafelek = null;

  scena.pokazPodklad(null, null, false);
  if (wykarczowane > 0) scena.przerysujTeren();
  scena.przerysujBudynki();
  scena.zaznaczBudynek(budynek);
  odswiezInterfejs();
  powiedz(
    `${dane.budynki[typ].nazwa}: plac budowy stanął. ` +
      (wykarczowane > 0
        ? `Wycięto ${Math.round(wykarczowane)} drzew — drewno poszło do magazynu. `
        : "") +
      `Budowa ruszy, gdy budowniczowie tam dojdą — a idą dopiero po skończeniu ` +
        `wcześniejszych placów.`,
  );
}

/**
 * Wysłanie wyprawy. Cel wskazuje się kliknięciem w mapę — dlatego zła okolica
 * musi dać zrozumiałą odpowiedź, a nie ciche nic: dziecko klika w las, żeby
 * łowić ryby, i ma się dowiedzieć dlaczego to nie zadziałało.
 */
function wyslij(kafelek: Punkt): void {
  const rodzaj = trybWyprawy!;
  const def = dane.wyprawy.find((w) => w.id === rodzaj)!;
  const mozna = mozliwaWyprawa(stan, dane, rodzaj, kafelek);

  if (!mozna.ok) {
    const gdzie = Array.isArray(def.teren) ? def.teren.join(" albo ") : def.teren;
    powiedz(
      mozna.powod === "zly-teren"
        ? `${def.nazwa}: trzeba kliknąć tam, gdzie jest ${gdzie}.`
        : mozna.powod === "nie-dojda"
          ? "Tam nie ma jak dojść — droga jest odcięta."
          : mozna.powod === "brak-rak"
            ? "Nikt nie stoi bez roboty. Wstrzymaj jakiś budynek, żeby zwolnić ręce."
            : "Nie da się teraz wysłać wyprawy.",
    );
    return;
  }

  const wyprawa = wyslijWyprawe(stan, dane, rodzaj, kafelek, `w_${nrWyprawy++}`);
  trybWyprawy = null;
  odswiezInterfejs();
  if (wyprawa) powiedz(opisWyprawy(def, wyprawa.ludzie.length, wyprawa.dniRazem, wyprawa.ladunek));
}

function zaznacz(kafelek: Punkt, scena: ScenaGry): void {
  const mapa = stan.mapa;
  const pole = mapa.kafelki[indeks(mapa, kafelek.x, kafelek.y)];
  const budynek = budynekPo(pole.zajetyPrzez);

  if (budynek) {
    zaznaczony = budynek.id;
    zaznaczonyKafelek = null;
    scena.zaznaczBudynek(budynek);
    scena.pokazSciezke(null, null);
    odswiezInterfejs();
    return;
  }

  zaznaczony = null;
  zaznaczonyKafelek = kafelek;

  // Droga z osady zostaje z kroku 3: to najprostszy sposób, żeby zobaczyć,
  // że A* na prawdziwej mapie naprawdę dochodzi tam, gdzie ma dojść.
  const osada = mapa.start;
  const kroki = osada
    ? znajdzSciezke(mapa, osada, kafelek, { obokCelu: !pole.przechodni })
    : null;
  scena.podswietl(kafelek, kroki !== null);
  scena.pokazSciezke(kroki, osada ?? null);
  odswiezInterfejs();
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "gra",
  width: 640,
  height: 560,
  backgroundColor: "#141a12",
  // Grafika Kenneya jest rysunkiem wektorowym, nie pixel-artem: zbita z 64 px
  // do 32 wygląda dobrze dopiero z wygładzaniem. Przy NEAREST gubiła kreski.
  pixelArt: false,
  roundPixels: true,
  scene: scena,
});

// Prawy przycisk odwołuje budowę, więc menu przeglądarki musi zniknąć.
document
  .querySelector("#gra")!
  .addEventListener("contextmenu", (zdarzenie) => zdarzenie.preventDefault());

// ---------------------------------------------------------------------------
// Pętla dzienna
// ---------------------------------------------------------------------------

const MS_NA_DZIEN = dane.stale.sekundNaDzien * 1000;
/** Ile dni wolno nadgonić w jednej klatce, gdy karta była w tle. */
const MAKS_DNI_NARAZ = 4;

let nazbierane = 0;
let ostatniCzas = performance.now();

/**
 * Ułamek dnia, który już minął. Scena prowadzi po nim ludzi, więc musi rosnąć
 * płynnie — pętla dzienna tyka co 50 ms, a klatek jest trzy razy więcej, stąd
 * doliczenie czasu, który upłynął od ostatniego jej przebiegu.
 */
function postepDnia(): number {
  const doliczone =
    stan.predkosc === 0
      ? nazbierane
      : nazbierane + (performance.now() - ostatniCzas) * stan.predkosc;
  return Math.max(0, Math.min(1, doliczone / MS_NA_DZIEN));
}

function dzien(): void {
  const z = tick(stan, dane, swiat, los);
  ruszLudzi(stan, dane);

  if (swiat.odbierzZmianeTerenu()) scena.przerysujTeren();
  scena.pokazPore(stan.czas.pora);
  scena.przerysujBudynki();
  // Duchów nie rysujemy — rysujemy ich skutki (sekcja 9 dokumentu).
  scena.pokazLeszego(stan.duchy.leszyBlokuje);
  if (z.ukradzione > 0.5) scena.mrugnijMagazynem();
  const wybrany = budynekPo(zaznaczony);
  if (zaznaczony && !wybrany) zaznaczony = null; // zwinięty plac budowy
  scena.zaznaczBudynek(wybrany);

  odswiezInterfejs();
  opowiedz(z);
  sprawdzKoniec();
}

/**
 * Pięć lat i koniec — zegar całej gry (etap 3 z PLAN.md). Bez niego usunięcie
 * zużycia zamienia Ostoję w piaskownicę, w której czekanie jest darmowe.
 * Czas staje sam: ekran podsumowania nad płynącą grą byłby nie do przeczytania.
 */
function sprawdzKoniec(): void {
  if (!czyKoniecSprintu(stan, dane) || ekranKonca.czyWidoczny() || juzPodsumowane) {
    return;
  }
  juzPodsumowane = true;
  ustawPredkosc(0);
  ekranKonca.pokaz({
    lat: dane.stale.sprint.lat,
    ludnosc: stan.mieszkancy.length,
    zdobyte: zdobyteZakonczenia(stan, dane),
    borPrzed: stan.borNaStarcie ?? borTeraz(stan),
    borPo: borTeraz(stan),
    szerokoscMapy: stan.mapa.szerokosc,
    drzewPrzed: drzewNaStarcie(stan),
    drzewPo: drzewNaMapie(stan),
  });
}

/** Krótka wiadomość o tym, co się dziś wydarzyło. Cisza, gdy nic. */
function opowiedz(z: Zdarzenia): void {
  const slowa: string[] = [];
  for (const id of z.wybudowane) {
    const b = budynekPo(id);
    if (b) slowa.push(`${dane.budynki[b.typ].nazwa} gotowa.`);
  }
  if (z.przybysze.length > 0) {
    slowa.push(
      z.przybysze.length === 1
        ? "Przyszedł nowy osadnik."
        : `Przyszło ${z.przybysze.length} nowych osadników.`,
    );
  }
  if (z.zmarli.length > 0) slowa.push(`Pożegnaliśmy ${z.zmarli.length} osób.`);
  if (z.przezimowano) slowa.push("Zima minęła spokojnie — zapasy się przydały.");
  for (const w of z.wyprawyWrocily) {
    const def = dane.wyprawy.find((d) => d.id === w.rodzaj);
    slowa.push(`Wróciła wyprawa: ${def?.nazwa ?? w.rodzaj}.`);
  }
  if (z.leszySieOdezwal) slowa.push("Leszy wstrzymał wyrąb — sadź drzewa.");
  // Domowik jest niewidzialny, więc jedyne, co po nim zostaje, to znikające
  // liczby. Bez tej wiadomości magazyn chudnie bez wyjaśnienia.
  if (z.ukradzione > 0.5) {
    slowa.push(`Domowik podebrał ${Math.round(z.ukradzione)} z magazynu — postaw miskę w kapliczce.`);
  }
  // Południca zabiera na koniec żniw i to musi wybrzmieć imieniem, nie liczbą.
  for (const imie of z.poludnicaZabrala) {
    slowa.push(`Południca zabrała ${imie} z pola. Żniwa bez jednego dnia przerwy.`);
  }
  if (z.wodnikSieOdezwal) slowa.push("Wodnik zauważył młyn nad wodą.");
  const NAZWY_DUCHOW: Record<string, string> = {
    leszy: "leszym",
    domowik: "domowikiem",
    poludnica: "południcą",
    wodnik: "wodnikiem",
  };
  for (const p of z.przymierza) {
    slowa.push(`Przymierze z ${NAZWY_DUCHOW[p] ?? p}!`);
  }
  // Nowy wpis w Kodeksie to nagroda za przeżycie czegoś, nie za odpowiedź.
  if (stan.kodeks.length > ostatnioWKodeksie) {
    ostatnioWKodeksie = stan.kodeks.length;
    slowa.push("Nowy wpis w Kodeksie.");
  }
  if (slowa.length > 0) powiedz(slowa.join(" "));
}

setInterval(() => {
  const teraz = performance.now();
  const minelo = teraz - ostatniCzas;
  ostatniCzas = teraz;
  if (stan.predkosc === 0) return;
  if (czyKoniecSprintu(stan, dane)) return;

  nazbierane += minelo * stan.predkosc;
  let dni = 0;
  while (nazbierane >= MS_NA_DZIEN && dni < MAKS_DNI_NARAZ) {
    nazbierane -= MS_NA_DZIEN;
    dzien();
    dni++;
  }
  if (dni === MAKS_DNI_NARAZ) nazbierane = 0;
}, 50);

// ---------------------------------------------------------------------------
// Interfejs w DOM (zasada 4)
// ---------------------------------------------------------------------------

const elPasek = document.querySelector<HTMLElement>("#pasek")!;
const elMenu = document.querySelector<HTMLElement>("#budowa")!;
const elPanel = document.querySelector<HTMLElement>("#panel")!;
const elSterowanie = document.querySelector<HTMLElement>("#sterowanie")!;
const elKorki = document.querySelector<HTMLElement>("#korki")!;
const elKodeks = document.querySelector<HTMLElement>("#kodeks")!;
const elSamouczek = document.querySelector<HTMLElement>("#samouczek")!;
const elKoniec = document.querySelector<HTMLElement>("#koniec")!;
const elWyprawy = document.querySelector<HTMLElement>("#wyprawy")!;

const menu = utworzMenuBudowy(elMenu, dane, (typ) => {
  trybBudowy = typ;
  if (typ) trybWyprawy = null;
  scena.pokazPodklad(null, null, false);
  odswiezInterfejs();
  powiedz(
    typ
      ? `${dane.budynki[typ].nazwa} — kliknij na mapie, gdzie ma stanąć. Prawy przycisk odkłada.`
      : "Odłożone.",
  );
});

const menuWypraw = utworzMenuWypraw(
  elWyprawy,
  dane.wyprawy,
  (rodzaj) => {
    trybWyprawy = rodzaj;
    // Wyprawa i budowa wykluczają się — obie chcą następnego kliknięcia w mapę.
    if (rodzaj) trybBudowy = null;
    scena.pokazPodklad(null, null, false);
    odswiezInterfejs();
    const def = dane.wyprawy.find((w) => w.id === rodzaj);
    powiedz(
      def
        ? `${def.nazwa} — kliknij na mapie, dokąd mają iść. Prawy przycisk odwołuje.`
        : "Wyprawa odwołana.",
    );
  },
);

const kodeks = utworzKodeks(elKodeks, wpisyKodeksu as WpisKodeksu[], () => {
  kodeks.zamknij();
});

const ekranKonca = utworzEkranKonca(
  elKoniec,
  wpisyZakonczen as DefinicjaZakonczenia[],
  () => {
    ekranKonca.ukryj();
    skasujZapis();
    wczytajStan(nowaGra(dane, konfigMapy, Date.now() % 100000));
    powiedz("Nowa osada na nowej mapie.");
  },
);

const samouczek = utworzSamouczek(
  elSamouczek,
  krokiSamouczka as KrokSamouczka[],
  zapamietajKrokSamouczka,
  krokSamouczka(),
);

// Escape zamyka Kodeks. Prawy przycisk zostaje odwoływaniem budowy.
document.addEventListener("keydown", (zdarzenie) => {
  if (zdarzenie.key === "Escape" && kodeks.czyOtwarty()) kodeks.zamknij();
});

function odswiezInterfejs(): void {
  rysujPasek(elPasek, stan, dane);
  menu.odswiez(stan, trybBudowy);

  const budynek = budynekPo(zaznaczony);
  const kafelek =
    !budynek && zaznaczonyKafelek
      ? {
          punkt: zaznaczonyKafelek,
          ...stan.mapa.kafelki[indeks(stan.mapa, zaznaczonyKafelek.x, zaznaczonyKafelek.y)],
        }
      : null;

  rysujPanel(elPanel, stan, dane, budynek, kafelek, {
    wstrzymaj(b) {
      b.wstrzymany = !b.wstrzymany;
      scena.przerysujBudynki();
      odswiezInterfejs();
      powiedz(b.wstrzymany ? "Wstrzymane — ludzie idą gdzie indziej." : "Znowu pracuje.");
    },
    rozbierz(b) {
      const nazwa = dane.budynki[b.typ].nazwa;
      if (!rozbierz(stan, dane, b)) return;
      zaznaczony = null;
      scena.przerysujBudynki();
      scena.zaznaczBudynek(null);
      odswiezInterfejs();
      powiedz(`${nazwa} rozebrana — połowa budulca wróciła do magazynu.`);
    },
    anuluj(b) {
      if (!anulujBudowe(stan, dane, b)) return;
      zaznaczony = null;
      scena.przerysujBudynki();
      scena.zaznaczBudynek(null);
      odswiezInterfejs();
      powiedz("Budowa zwinięta, surowce wróciły do magazynu.");
    },
  });

  // Panel całej osady. Liczony przy każdym odświeżeniu, bo obsada i zapasy
  // zmieniają się co dzień, a nieaktualne wąskie gardło myli bardziej niż jego brak.
  rysujKorki(
    elKorki,
    policzBilans(stan, dane, (b) => swiat.mnoznikMiejsca(b)),
    (id) => {
      const b = budynekPo(id);
      if (!b) return;
      zaznaczony = id;
      zaznaczonyKafelek = null;
      scena.zaznaczBudynek(b);
      scena.pokazSciezke(null, null);
      scena.pokazBudynek(b);
      odswiezInterfejs();
    },
    () => {
      if (!zrobZapasy(stan, dane)) return;
      odswiezInterfejs();
      powiedz(
        "Zapasy odłożone. Zima minie normalnie: las i pole dadzą tyle co zwykle, " +
          "a osadnicy będą przychodzić dalej.",
      );
    },
  );

  menuWypraw.odswiez(stan, bezczynneRece(stan).length, trybWyprawy);
  samouczek.odswiez(stan);
  kodeks.odswiez(stan.kodeks);
  guzikKodeksu.textContent =
    stan.kodeks.length > 0 ? `Kodeks (${stan.kodeks.length})` : "Kodeks";

  for (const [p, guzik] of guzikiPredkosci) {
    guzik.classList.toggle("wlaczony", stan.predkosc === p);
  }
}

function przycisk(napis: string, dziala: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = napis;
  b.addEventListener("click", dziala);
  return b;
}

function ustawPredkosc(predkosc: StanGry["predkosc"]): void {
  stan.predkosc = predkosc;
  odswiezInterfejs();
}

const guzikiPredkosci = new Map<StanGry["predkosc"], HTMLButtonElement>();
for (const p of [0, 1, 2, 4] as StanGry["predkosc"][]) {
  const guzik = przycisk(p === 0 ? "Pauza" : `${p}×`, () => ustawPredkosc(p));
  guzikiPredkosci.set(p, guzik);
  elSterowanie.append(guzik);
}

const guzikKodeksu = przycisk("Kodeks", () => {
  menuWypraw.odswiez(stan, bezczynneRece(stan).length, trybWyprawy);
  samouczek.odswiez(stan);
  kodeks.odswiez(stan.kodeks);
  kodeks.otworz();
});

elSterowanie.append(
  guzikKodeksu,
  przycisk("Zapisz", () => {
    const wynik = zapiszGre(stan);
    powiedz(wynik.ok ? "Zapisano w przeglądarce." : wynik.powod);
  }),
  przycisk("Wczytaj", () => {
    const wynik = wczytajGre();
    if (wynik === null) return powiedz("Nie ma jeszcze żadnego zapisu.");
    if (!wynik.ok) return powiedz(wynik.powod);
    wczytajStan(wynik.stan);
    powiedz("Wczytano zapis.");
  }),
  przycisk("Nowa osada", () => {
    skasujZapis();
    wczytajStan(nowaGra(dane, konfigMapy, Date.now() % 100000));
    powiedz("Nowa osada na nowej mapie. Zapisu nie ma, dopóki nie klikniesz „Zapisz”.");
  }),
);

function wczytajStan(nowy: StanGry): void {
  stan = nowy;
  los = utworzLos(stan.ziarno);
  // Wczytana osada ma własny Kodeks i własny stan duchów — inaczej po wczytaniu
  // gra ogłaszałaby „nowy wpis" za każdy wpis z zapisu, a las świeciłby dalej.
  ostatnioWKodeksie = stan.kodeks.length;
  scena.pokazLeszego(stan.duchy.leszyBlokuje);
  trybBudowy = null;
  trybWyprawy = null;
  zaznaczony = null;
  zaznaczonyKafelek = null;
  nazbierane = 0;
  // Wczytana osada po pięciu latach od razu pokazuje podsumowanie — czas
  // po końcu sprintu nie płynie, więc nie ma ticku, który by je wywołał.
  juzPodsumowane = false;
  ekranKonca.ukryj();
  scena.odswiez();
  odswiezInterfejs();
  sprawdzKoniec();
}

window.addEventListener("keydown", (zdarzenie) => {
  if (zdarzenie.key === "Escape" && trybWyprawy) {
    trybWyprawy = null;
    odswiezInterfejs();
    powiedz("Wyprawa odwołana.");
  }
  if (zdarzenie.key === "Escape" && trybBudowy) {
    trybBudowy = null;
    scena.pokazPodklad(null, null, false);
    odswiezInterfejs();
    powiedz("Odłożone.");
  }
  if (zdarzenie.key === " ") {
    zdarzenie.preventDefault();
    ustawPredkosc(stan.predkosc === 0 ? 1 : 0);
  }
});

powiedz(
  "Wybierz budynek z listy po prawej i kliknij na mapie, gdzie ma stanąć. " +
    "Spacja zatrzymuje czas.",
);

// Zapis wczytany po pięciu latach ma zobaczyć podsumowanie od razu.
sprawdzKoniec();

export type { Punkt };
