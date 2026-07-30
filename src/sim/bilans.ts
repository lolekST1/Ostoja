/**
 * Ostoja — „gdzie się korkuje": bilans dzienny i lista wąskich gardeł.
 *
 * Panel budynku mówi o jednym budynku naraz, a osada korkuje się na całości:
 * gdzieś brakuje rąk, gdzieś krąg jest wybrany do zera, a mąki ubywa szybciej,
 * niż przybywa. Ten plik liczy to raz dla całej osady.
 *
 * Czysty TypeScript, bez Phasera — dzięki temu narzedzia/bilans.ts może
 * porównać przewidywania z tym, co naprawdę robi tick(). Panel, który zgaduje,
 * jest gorszy niż brak panelu.
 *
 * Liczby są tempem na dzień „przy obecnej obsadzie i porze roku", a nie
 * średnią z przeszłości. Gracz pyta „co się stanie, jeśli zostawię to tak",
 * i to jest odpowiedź na to pytanie.
 */

import type { Budynek, PoraRoku, StanGry, Surowiec } from "./typy.ts";
import { DNI_W_PORZE, SUROWCE } from "./typy.ts";
import type { Dane } from "./budynki.ts";
import { efektywnaReceptura, pole as polePo } from "./budynki.ts";
import type { SkladnikZadowolenia, StanOsadnika, StanZapasow } from "./osada.ts";
import {
  KRADZIONE,
  WIEK_DOROSLOSCI,
  doKradzieniaWMagazynie,
  kwotaDomowika,
  mnoznikZimowy,
  skladnikiZadowolenia,
  stanOsadnika,
  stanZapasow,
} from "./osada.ts";
import { rozdzielZbiory, zasobWZasiegu } from "./swiat.ts";

// ---------------------------------------------------------------------------

export interface PozycjaSurowca {
  surowiec: Surowiec;
  zapas: number;
  przychod: number;
  rozchod: number;
  netto: number;
  /** Za ile dni zapas zejdzie do zera. null, gdy nie ubywa. */
  dniDoZera: number | null;
  /** Za ile dni magazyn się przepełni i nadwyżka zacznie przepadać. */
  dniDoPelna: number | null;
}

export type RodzajKorka =
  | "surowiec-znika"
  | "brak-rak"
  | "pusty-krag"
  | "brak-wejscia"
  | "leszy"
  | "poludnica"
  | "wstrzymany"
  | "kolejka-budowy"
  | "magazyn-pelny"
  | "brak-dachu"
  | "zadowolenie"
  | "zapasy";

export interface Korek {
  rodzaj: RodzajKorka;
  /** Im wyżej, tym pilniej. Do sortowania listy. */
  waga: number;
  opis: string;
  /** Do podświetlenia budynku na mapie po kliknięciu w wiersz. */
  budynekId?: string;
}

export interface Bilans {
  surowce: PozycjaSurowca[];
  korki: Korek[];
  /** Dorośli bez przydziału. W tej grze zwykle zero — miejsc pracy jest więcej niż rąk. */
  wolneRece: number;
  nieobsadzoneMiejsca: number;
  /** Ile kosztuje następny osadnik i co go zatrzymuje (zasada 7 z PLAN.md). */
  osadnik: StanOsadnika;
  /** Jedyna decyzja jesieni: co kosztuje przezimowanie i ile zostało dni. */
  zapasy: StanZapasow;
  zadowolenie: {
    teraz: number;
    cel: number;
    skladniki: SkladnikZadowolenia[];
  };
}

// ---------------------------------------------------------------------------

/** Poniżej tylu dni zapasu robi się z tego ostrzeżenie, a nie ciekawostka. */
const DNI_ALARMU = 12;

function modyfikatorPory(dane: Dane, typ: string, pora: PoraRoku): number {
  return dane.stale.moznikiPorRoku?.[typ]?.[pora] ?? 1;
}

function pustyLicznik(): Record<Surowiec, number> {
  const l = {} as Record<Surowiec, number>;
  for (const s of SUROWCE) l[s] = 0;
  return l;
}

/** O ile dany budynek dziś prosi — bez oglądania się na to, czy ma z czego. */
function zamowienieBudynku(
  stan: StanGry,
  dane: Dane,
  b: Budynek,
): { surowiec: Surowiec; ile: number } | null {
  const def = dane.budynki[b.typ];
  if (!def.zbiera || !def.receptura) return null;

  const wpis = Object.entries(def.receptura.wyjscie)[0];
  if (!wpis) return null;
  const [surowiec, ile] = wpis as [Surowiec, number];

  const obsada = b.pracownicy.length / def.miejscaPracy;
  const przymierze = b.typ === "lesniczowka" && stan.duchy.przymierzeLeszy ? 1 : 0;
  return {
    surowiec,
    ile:
      (ile + przymierze) *
      obsada *
      modyfikatorPory(dane, b.typ, stan.czas.pora) *
      mnoznikZimowy(stan, dane),
  };
}

// ---------------------------------------------------------------------------

/**
 * `mnoznikMiejsca` przekazuje regułę wodnika — bilans nie zna mapy, a młyn przy
 * rzece miele o połowę szybciej. Bez tego panel kłamałby o mące i chlebie
 * dokładnie w tej osadzie, w której gracz dobrze postawił młyn.
 */
export function policzBilans(
  stan: StanGry,
  dane: Dane,
  mnoznikMiejsca?: (b: Budynek) => number,
): Bilans {
  const przychod = pustyLicznik();
  const rozchod = pustyLicznik();
  const korki: Korek[] = [];

  const pora = stan.czas.pora;
  const czynne = stan.budynki.filter(
    (b) => b.wybudowany && !b.wstrzymany && !b.zablokowanyPrzez,
  );

  // --- Zbieranie z mapy ----------------------------------------------------
  //
  // Rozdzielone przez świat, nie po jednym budynku: dwie leśniczówki na wspólnym
  // kręgu nie zbiorą tego samego lasu dwa razy, a wcześniej panel obiecywał
  // dokładnie to.
  const zamowienia: Array<{ budynek: Budynek; ile: number; surowiec: Surowiec }> = [];
  for (const b of czynne) {
    if (b.pracownicy.length === 0) continue;
    const zam = zamowienieBudynku(stan, dane, b);
    if (!zam) continue;
    zamowienia.push({ budynek: b, ile: zam.ile, surowiec: zam.surowiec });
  }
  const rozdzielone = rozdzielZbiory(stan, dane, zamowienia);
  for (const z of zamowienia) {
    przychod[z.surowiec] += rozdzielone.get(z.budynek.id) ?? 0;
  }

  // --- Żniwa ---------------------------------------------------------------
  //
  // Doliczone do przychodu, ale **nie** do puli, z której korzystają warsztaty:
  // w ticku żniwa są krokiem czwartym, po warsztatach. Młyn miele wczorajsze
  // zboże, nie to zwiezione dziś po południu — a bilans, który wsypywał je
  // młynowi od razu, obiecywał mąkę o jeden dzień za wcześnie.
  let zeZniw = 0;
  if (pora === "jesien") {
    for (const b of czynne) {
      if (b.typ !== "pole" || b.pracownicy.length === 0) continue;
      const obsada = b.pracownicy.length / dane.budynki.pole.miejscaPracy;
      zeZniw += (polePo(dane, stan.ulepszenia, "pole", "plon") / DNI_W_PORZE) * obsada;
    }
  }

  // --- Warsztaty -----------------------------------------------------------
  const warsztaty = czynne.filter((b) => {
    const def = dane.budynki[b.typ];
    return !def.zbiera && def.receptura !== null && b.pracownicy.length > 0;
  });
  // Ile z pełnego tempa warsztat realnie wyrabia (0..1) i czego mu brakuje.
  const wydajnosc = new Map<string, number>();
  const brakuje = new Map<string, Surowiec>();
  for (const b of warsztaty) wydajnosc.set(b.id, 1);

  /** Wejścia warsztatu: ile na dzień przy pełnym tempie i ile na jeden cykl. */
  const wejscia = (
    b: Budynek,
  ): Array<{ surowiec: Surowiec; naDzien: number; naCykl: number }> => {
    const def = dane.budynki[b.typ];
    const rec = efektywnaReceptura(dane, stan.ulepszenia, b.typ)!;
    const obsada = b.pracownicy.length / def.miejscaPracy;
    return Object.entries(rec.wejscie).map(([s, ile]) => ({
      surowiec: s as Surowiec,
      naDzien: (ile / rec.dni) * obsada * (mnoznikMiejsca?.(b) ?? 1),
      naCykl: ile,
    }));
  };

  // Warsztaty idą po kolei, tak jak w ticku, po wirtualnej puli.
  //
  // Kolejność ma znaczenie i nie wolno jej tu wygładzić: tick przerabia budynki
  // w kolejności listy, więc piekarnia stojąca przed młynem nie użyje mąki
  // zmielonej tego samego dnia — użyje wczorajszej. Model liczący „wszystko
  // naraz" obiecywał chleb, którego nie było.
  //
  // Zbiory dopisujemy przed warsztatami, bo w ticku krok zbierania jest wcześniej:
  // tartak może przerobić drewno ścięte tego samego ranka.
  const wirtualna = { ...stan.pula };
  for (const s of SUROWCE) wirtualna[s] += przychod[s];

  for (const b of warsztaty) {
    const def = dane.budynki[b.typ];
    const rec = efektywnaReceptura(dane, stan.ulepszenia, b.typ)!;
    const obsada = b.pracownicy.length / def.miejscaPracy;

    let cykli = (1 / rec.dni) * obsada * (mnoznikMiejsca?.(b) ?? 1);
    let waskie: Surowiec | null = null;

    for (const w of wejscia(b)) {
      // Cykl jest niepodzielny: młyn przy 0.7 zboża nie zemle siedmiu
      // dziesiątych mąki, tylko nie ruszy wcale. Tick sprawdza dokładnie to
      // samo przed rozpoczęciem cyklu.
      //
      // Rozpoczętego cyklu tu nie odliczamy, choć tick pobiera wsad tylko przy
      // starcie. Próba („cykl w toku jest opłacony, więc nie wymagaj wsadu")
      // rozjechała wszystkie osiem ziaren zamiast trzech: warsztat z `postep`
      // w przedziale (0,1) dostawał cały darmowy cykl w każdym dniu, a nie raz
      // na cykl. Zostaje różnica na warsztatach wolniejszych niż dzień — patrz
      // „Co zostało" w CLAUDE.md.
      if (wirtualna[w.surowiec] < w.naCykl - 1e-9) {
        cykli = 0;
        waskie = w.surowiec;
        break;
      }
      const zCzegoStac = wirtualna[w.surowiec] / w.naCykl;
      if (zCzegoStac < cykli) {
        cykli = zCzegoStac;
        waskie = w.surowiec;
      }
    }

    for (const [s, ile] of Object.entries(rec.wejscie)) {
      const zuzyte = (ile as number) * cykli;
      rozchod[s as Surowiec] += zuzyte;
      wirtualna[s as Surowiec] -= zuzyte;
    }
    for (const [s, ile] of Object.entries(rec.wyjscie)) {
      const zrobione = (ile as number) * cykli;
      przychod[s as Surowiec] += zrobione;
      wirtualna[s as Surowiec] += zrobione;
    }

    wydajnosc.set(b.id, cykli / ((1 / rec.dni) * obsada));
    if (waskie !== null && cykli < 1e-9) brakuje.set(b.id, waskie);
  }

  // Żniwa dopiero teraz — po warsztatach, jak w ticku.
  przychod.zboze += zeZniw;
  wirtualna.zboze += zeZniw;

  // --- Osadnicy ------------------------------------------------------------
  //
  // Kosztu osadnika **nie ma** w tabeli „na dzień" i to jest decyzja, nie
  // przeoczenie. Jedzenie schodzi skokiem: przez siedem dni z ośmiu przybywa,
  // a ósmego znika sto sztuk naraz. Rozsmarowane po dniach dałoby graczowi
  // „chleb −40 dziennie" w dniu, w którym chleba przybywa — czyli liczbę, która
  // kłamie siedem razy na osiem.
  //
  // Zamiast tego osadnik ma własny wiersz w panelu: ile kosztuje, ile brakuje
  // i za ile dni przyjdzie. Tempo osobno, zdarzenie osobno.
  const osadnik = stanOsadnika(stan, dane);

  // --- Domowik -------------------------------------------------------------
  // Kwota, nie procent — tak samo jak w ticku, i z tej samej kupki: najgrubszej.
  const maKapliczke = stan.budynki.some((b) => b.typ === "kapliczka" && b.wybudowany);
  const miska = maKapliczke && stan.pula.chleb > 0;
  if (miska) {
    rozchod.chleb += dane.stale.domowik.miskaChlebNaTydzien / 7;
  } else if (!stan.duchy.przymierzeDomowik) {
    // Na puli po produkcji, nie przed nią: domowik chodzi po magazynie
    // wieczorem, kiedy leżą w nim dzisiejsze deski. Liczony od porannego stanu
    // wskazywał inną „najgrubszą kupkę" niż tick i okradał nie ten surowiec.
    const kwota = kwotaDomowika(
      dane,
      stan.duchy.domowikZaniedbanieTygodni,
      doKradzieniaWMagazynie(wirtualna),
    );
    let zostalo = kwota;
    const kupki = { ...wirtualna };
    while (zostalo > 1e-9) {
      let najgrubsza: Surowiec | null = null;
      for (const s of KRADZIONE) {
        if (kupki[s] <= 1e-9) continue;
        if (najgrubsza === null || kupki[s] > kupki[najgrubsza]) najgrubsza = s;
      }
      if (najgrubsza === null) break;
      const bierz = Math.min(kupki[najgrubsza], zostalo);
      kupki[najgrubsza] -= bierz;
      rozchod[najgrubsza] += bierz;
      zostalo -= bierz;
    }
  }

  // --- Pozycje surowców ----------------------------------------------------
  const surowce: PozycjaSurowca[] = SUROWCE.map((s) => {
    const netto = przychod[s] - rozchod[s];
    const zapas = stan.pula[s];
    const bezLimitu = s === "opowiesc";
    return {
      surowiec: s,
      zapas,
      przychod: przychod[s],
      rozchod: rozchod[s],
      netto,
      dniDoZera: netto < -1e-6 && zapas > 0 ? zapas / -netto : null,
      dniDoPelna:
        !bezLimitu && netto > 1e-6 && zapas < stan.pojemnosc
          ? (stan.pojemnosc - zapas) / netto
          : null,
    };
  });

  // --- Korki ---------------------------------------------------------------
  const zadowolenie = skladnikiZadowolenia(stan, dane);
  const zapasy = stanZapasow(stan, dane);
  zbierzKorki(stan, dane, surowce, czynne, brakuje, osadnik, zapasy, korki);

  const nieobsadzone = czynne.reduce((suma, b) => {
    const def = dane.budynki[b.typ];
    if (def.miejscaPracy === 0) return suma;
    if (def.tylkoPora && def.tylkoPora !== pora) return suma;
    return suma + Math.max(0, def.miejscaPracy - b.pracownicy.length);
  }, 0);

  const wolneRece = stan.mieszkancy.filter(
    (m) => m.wiek >= WIEK_DOROSLOSCI && m.miejscePracy === null,
  ).length;

  korki.sort((a, b) => b.waga - a.waga);
  return {
    surowce,
    korki,
    wolneRece,
    nieobsadzoneMiejsca: nieobsadzone,
    osadnik,
    zapasy,
    zadowolenie: {
      teraz: stan.zadowolenie,
      cel: zadowolenie.cel,
      skladniki: zadowolenie.skladniki,
    },
  };
}

// ---------------------------------------------------------------------------

const NAZWY: Record<Surowiec, string> = {
  drewno: "drewno",
  deska: "deski",
  glina: "glina",
  cegla: "cegły",
  zboze: "zboże",
  maka: "mąka",
  jagody: "jagody",
  ryba: "ryby",
  chleb: "chleb",
  opowiesc: "opowieści",
};

/** Dopełniacz — do zdań „nie ma czego". Gra dla dzieci ma mówić po polsku. */
const NAZWY_CZEGO: Record<Surowiec, string> = {
  drewno: "drewna",
  deska: "desek",
  glina: "gliny",
  cegla: "cegieł",
  zboze: "zboża",
  maka: "mąki",
  jagody: "jagód",
  ryba: "ryb",
  chleb: "chleba",
  opowiesc: "opowieści",
};

function dni(ile: number): string {
  const zaokraglone = Math.max(1, Math.round(ile));
  return `${zaokraglone} ${zaokraglone === 1 ? "dzień" : "dni"}`;
}

function zbierzKorki(
  stan: StanGry,
  dane: Dane,
  surowce: PozycjaSurowca[],
  czynne: Budynek[],
  brakuje: Map<string, Surowiec>,
  osadnik: StanOsadnika,
  zapasy: StanZapasow,
  korki: Korek[],
): void {
  // Zapasy na zimę idą na sam wierzch pod koniec jesieni. Okno zamyka się raz
  // w roku i nie da się go odzyskać, więc ostrzeżenie musi rosnąć z każdym
  // dniem — a nie wisieć na tej samej wadze przez cały kwartał.
  if (zapasy.otwarte && !zapasy.zrobione) {
    korki.push({
      rodzaj: "zapasy",
      waga: 55 + Math.round(((DNI_W_PORZE - zapasy.dniDoKonca) / DNI_W_PORZE) * 44),
      opis:
        `Zapasy na zimę: ${zapasy.drewno} drewna i ${zapasy.jedzenie} jedzenia. ` +
        `Zostało ${dni(zapasy.dniDoKonca)}` +
        (zapasy.stac ? "." : " — na razie nie starcza."),
    });
  }
  if (zapasy.karaTrwa) {
    korki.push({
      rodzaj: "zapasy",
      waga: 85,
      opis:
        "Zima bez zapasów: w lesie i w polu praca ledwie idzie, a osadnicy " +
        "czekają do wiosny. Na jesień odłóż zapasy wcześniej.",
    });
  }
  // Wzrost osady jest teraz najważniejszą rzeczą na tej liście. Nikt nie
  // odchodzi z głodu ani z zimna (zasada 2 z PLAN.md), więc jedyne „coś stoi",
  // które naprawdę boli, to osada, która przestała rosnąć.
  if (osadnik.blokada === "dach") {
    korki.push({
      rodzaj: "brak-dachu",
      waga: 92,
      opis:
        "Nie ma wolnego miejsca w chacie — osadnik czeka pod lasem. " +
        "Postaw chatę, a przyjdzie od razu.",
    });
  } else if (osadnik.blokada === "jedzenie") {
    korki.push({
      rodzaj: "surowiec-znika",
      waga: 90,
      opis:
        `Następny osadnik potrzebuje ${Math.ceil(osadnik.koszt)} jedzenia na drogę, ` +
        `a w spiżarni jest ${Math.floor(osadnik.zapas)}. Brakuje ` +
        `${Math.ceil(osadnik.koszt - osadnik.zapas)}.`,
    });
  } else if (osadnik.blokada === "zadowolenie") {
    korki.push({
      rodzaj: "zadowolenie",
      waga: 91,
      opis: "Nikt nie chce tu przyjść. Zadowolenie spadło do zera.",
    });
  }

  // Zadowolenie nisko, ale nie na dnie: napływ jeszcze idzie, tylko wolno.
  // Wypisujemy powód, nie samą liczbę — pasek z zagadką nie jest informacją.
  if (osadnik.blokada !== "zadowolenie" && stan.zadowolenie < 35) {
    const { skladniki } = skladnikiZadowolenia(stan, dane);
    const najgorszy = skladniki
      .filter((s) => s.ile < 0)
      .sort((a, b) => a.ile - b.ile)[0];
    korki.push({
      rodzaj: "zadowolenie",
      waga: 72,
      opis:
        `Zadowolenie ${Math.round(stan.zadowolenie)} — osadnicy schodzą się powoli` +
        (najgorszy ? ` (${najgorszy.powod}).` : "."),
    });
  }

  for (const p of surowce) {
    // Surowiec, którego już nie ma, a wciąż jest potrzebny. To najpilniejszy
    // przypadek, a wypada z „starczy na X dni", bo dzielenie zaczyna się od
    // zera — i właśnie wtedy gracz najbardziej potrzebuje wyjaśnienia,
    // dlaczego łańcuch produkcyjny stanął.
    // Próg, nie zero: domowik podbiera ułamki i bez niego panel wypisywałby
    // „nie ma cegieł, a potrzeba 0.0 dziennie", co jest szumem, nie korkiem.
    if (p.zapas <= 0.5 && p.rozchod > p.przychod + 0.05) {
      const brakuje = p.rozchod - p.przychod;
      korki.push({
        rodzaj: "surowiec-znika",
        waga: 88,
        opis: `Nie ma ${NAZWY_CZEGO[p.surowiec]}, a potrzeba ${brakuje.toFixed(1)} dziennie.`,
      });
      continue;
    }

    if (p.dniDoZera === null || p.dniDoZera > DNI_ALARMU) continue;
    korki.push({
      rodzaj: "surowiec-znika",
      waga: 90 - Math.min(60, p.dniDoZera * 4),
      opis: `${NAZWY[p.surowiec]}: ubywa ${(-p.netto).toFixed(1)} dziennie — starczy na ${dni(p.dniDoZera)}.`,
    });
  }

  for (const b of czynne) {
    const def = dane.budynki[b.typ];

    if (def.zbiera && b.pracownicy.length > 0) {
      const wKregu = zasobWZasiegu(stan, dane, b.typ, b);
      if (wKregu <= 0) {
        korki.push({
          rodzaj: "pusty-krag",
          waga: 70,
          budynekId: b.id,
          opis: `${def.nazwa} (${b.x}, ${b.y}): w kręgu nie ma już nic. Przenieś ją albo weź „wóz i ścieżki”.`,
        });
      }
    }

    const brakSurowca = brakuje.get(b.id);
    if (brakSurowca !== undefined) {
      korki.push({
        rodzaj: "brak-wejscia",
        waga: 60,
        budynekId: b.id,
        opis: `${def.nazwa} (${b.x}, ${b.y}): stoi, bo nie ma ${NAZWY_CZEGO[brakSurowca]}.`,
      });
    }

    if (def.miejscaPracy > 0 && (!def.tylkoPora || def.tylkoPora === stan.czas.pora)) {
      const brak = def.miejscaPracy - b.pracownicy.length;
      if (brak > 0) {
        korki.push({
          rodzaj: "brak-rak",
          waga: b.pracownicy.length === 0 ? 50 : 30,
          budynekId: b.id,
          opis:
            b.pracownicy.length === 0
              ? `${def.nazwa} (${b.x}, ${b.y}): nie pracuje nikt.`
              : `${def.nazwa} (${b.x}, ${b.y}): brakuje ${brak} z ${def.miejscaPracy} par rąk.`,
        });
      }
    }
  }

  // Południca zabiera dopiero na koniec żniw, więc ostrzeżenie musi przyjść
  // wcześniej — inaczej gracz dowiaduje się o regule przez czyjąś śmierć.
  if (stan.czas.pora === "jesien") {
    for (const b of czynne) {
      if (b.typ !== "pole") continue;
      const dniPracy = stan.duchy.poludnicaDni?.[b.id] ?? 0;
      if (dniPracy < DNI_W_PORZE / 2) continue;
      korki.push({
        rodzaj: "poludnica",
        waga: 75,
        budynekId: b.id,
        opis:
          `Pole (${b.x}, ${b.y}) żnie bez przerwy od ${dniPracy} dni. ` +
          `Wstrzymaj je na jeden dzień, zanim żniwa się skończą — inaczej południca zabierze żniwiarza.`,
      });
    }
  }

  if (stan.duchy.leszyBlokuje) {
    korki.push({
      rodzaj: "leszy",
      waga: 80,
      opis:
        "Leszy wstrzymał wyrąb. Wyślij ludzi po chrust — gałęzi z ziemi nie " +
        "liczy — a gajówkę postaw tam, gdzie się wycina.",
    });
  }

  const wstrzymane = stan.budynki.filter((b) => b.wybudowany && b.wstrzymany);
  for (const b of wstrzymane) {
    korki.push({
      rodzaj: "wstrzymany",
      waga: 20,
      budynekId: b.id,
      opis: `${dane.budynki[b.typ].nazwa} (${b.x}, ${b.y}): wstrzymana ręcznie.`,
    });
  }

  const place = stan.budynki.filter((b) => !b.wybudowany);
  const czekajace = place.filter((b) => b.pracownicy.length === 0).length;
  if (czekajace > 0) {
    korki.push({
      rodzaj: "kolejka-budowy",
      waga: 25,
      opis:
        `${czekajace} ${czekajace === 1 ? "plac budowy czeka" : "place budowy czekają"} w kolejce — ` +
        `naraz buduje się ${dane.stale.budowyNaraz}.`,
    });
  }

  // Pełny magazyn jest teraz prawdziwym hamulcem, nie ciekawostką: skoro nic
  // się samo nie zużywa, zapas dobija do sufitu i od tej chwili każda kolejna
  // sztuka przepada. Gra ma wtedy powiedzieć „wydaj to", a nie szeptać.
  for (const p of surowce) {
    if (p.zapas >= stan.pojemnosc - 1e-9 && p.surowiec !== "opowiesc") {
      korki.push({
        rodzaj: "magazyn-pelny",
        waga: 45,
        opis:
          `${NAZWY[p.surowiec]}: magazyn pełny, nadwyżka przepada. ` +
          `Wydaj to na budowę albo postaw magazyn.`,
      });
      continue;
    }
    if (p.dniDoPelna !== null && p.dniDoPelna <= DNI_ALARMU) {
      korki.push({
        rodzaj: "magazyn-pelny",
        waga: 15,
        opis: `${NAZWY[p.surowiec]}: magazyn zapełni się za ${dni(p.dniDoPelna)}, nadwyżka przepadnie.`,
      });
    }
  }
}
