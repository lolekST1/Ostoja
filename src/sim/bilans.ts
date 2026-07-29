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
import {
  DNI_W_PORZE,
  JADALNE,
  PROG_ODEJSCIA,
  SUROWCE,
} from "./typy.ts";
import type { Dane } from "./budynki.ts";
import { efektywnaReceptura, globalna, pole as polePo } from "./budynki.ts";
import { zasobWZasiegu } from "./swiat.ts";

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
  | "glod"
  | "surowiec-znika"
  | "brak-rak"
  | "pusty-krag"
  | "brak-wejscia"
  | "leszy"
  | "poludnica"
  | "wstrzymany"
  | "kolejka-budowy"
  | "magazyn-pelny";

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
}

// ---------------------------------------------------------------------------

const WIEK_DOROSLOSCI = 16;
const MAKS_KRADZIEZ = 0.08;

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

/** Ile dany budynek zbiera dziennie — z sufitem tego, co jeszcze leży w kręgu. */
function zbioryBudynku(
  stan: StanGry,
  dane: Dane,
  b: Budynek,
): { surowiec: Surowiec; ile: number; wKregu: number } | null {
  const def = dane.budynki[b.typ];
  if (!def.zbiera || !def.receptura) return null;

  const wpis = Object.entries(def.receptura.wyjscie)[0];
  if (!wpis) return null;
  const [surowiec, ile] = wpis as [Surowiec, number];

  const obsada = b.pracownicy.length / def.miejscaPracy;
  const przymierze = b.typ === "lesniczowka" && stan.duchy.przymierzeLeszy ? 1 : 0;
  const chce =
    (ile + przymierze) * obsada * modyfikatorPory(dane, b.typ, stan.czas.pora);

  // Krąg wyczerpany to nie „mniej", tylko „nic". Bez tego sufitu panel
  // obiecywałby drewno z lasu, którego już nie ma.
  const wKregu = zasobWZasiegu(stan, dane, b.typ, b);
  return { surowiec, ile: Math.min(chce, wKregu), wKregu };
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
  const ludnosc = stan.mieszkancy.length;
  const czynne = stan.budynki.filter(
    (b) => b.wybudowany && !b.wstrzymany && !b.zablokowanyPrzez,
  );

  // --- Zbieranie z mapy ----------------------------------------------------
  for (const b of czynne) {
    if (b.pracownicy.length === 0) continue;
    const zbior = zbioryBudynku(stan, dane, b);
    if (!zbior) continue;
    przychod[zbior.surowiec] += zbior.ile;
  }

  // --- Żniwa ---------------------------------------------------------------
  if (pora === "jesien") {
    for (const b of czynne) {
      if (b.typ !== "pole" || b.pracownicy.length === 0) continue;
      const obsada = b.pracownicy.length / dane.budynki.pole.miejscaPracy;
      przychod.zboze += (polePo(dane, stan.ulepszenia, "pole", "plon") / DNI_W_PORZE) * obsada;
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

  // --- Jedzenie i opał -----------------------------------------------------
  const chlebNaOsobe = globalna(dane, stan.ulepszenia, "chlebNaOsobe");
  const potrzebaJedzenia = ludnosc * chlebNaOsobe;

  // Jagody idą pierwsze, bo się psują — tak samo jak w ticku. Gdyby panel
  // zapisywał całe jedzenie na chleb, pokazywałby ubytek chleba w osadzie,
  // która żyje ze zbieractwa.
  let doZjedzenia = potrzebaJedzenia;
  for (const jedzenie of JADALNE) {
    const dostepne = stan.pula[jedzenie] + przychod[jedzenie];
    const zjedzone = Math.min(dostepne, doZjedzenia);
    rozchod[jedzenie] += zjedzone;
    doZjedzenia -= zjedzone;
    if (doZjedzenia <= 1e-9) break;
  }

  rozchod.drewno += ludnosc * dane.stale.opalNaOsobe[pora];

  // --- Domowik -------------------------------------------------------------
  const maKapliczke = stan.budynki.some((b) => b.typ === "kapliczka" && b.wybudowany);
  const miska = maKapliczke && stan.pula.chleb > 0;
  if (miska) {
    rozchod.chleb += 1 / 7;
  } else if (!stan.duchy.przymierzeDomowik) {
    const procent = Math.min(
      MAKS_KRADZIEZ,
      0.01 + 0.005 * Math.floor(stan.duchy.domowikZaniedbanieTygodni),
    );
    for (const s of ["drewno", "deska", "glina", "cegla", "zboze", "maka", "chleb"] as Surowiec[]) {
      rozchod[s] += stan.pula[s] * procent;
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
  zbierzKorki(stan, dane, surowce, czynne, brakuje, korki);

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
  return { surowce, korki, wolneRece, nieobsadzoneMiejsca: nieobsadzone };
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
  korki: Korek[],
): void {
  // Ludzie odchodzą — wszystko inne może poczekać.
  const wPotrzebie = stan.mieszkancy.filter((m) => m.glod > 0);
  if (wPotrzebie.length > 0) {
    const najgorszy = wPotrzebie.reduce((n, m) => Math.max(n, m.glod), 0);
    korki.push({
      rodzaj: "glod",
      waga: 100,
      opis:
        `${wPotrzebie.length} ${wPotrzebie.length === 1 ? "osoba jest" : "osób jest"} ` +
        `bez jedzenia lub opału — ${wPotrzebie.length === 1 ? "odejdzie" : "odejdą"} za ` +
        `${dni(PROG_ODEJSCIA - najgorszy + 1)}.`,
    });
  }

  // Jedzenie liczy się razem, tak jak w ticku: JADALNE, nie sam chleb. Osobne
  // ostrzeżenia o jagodach i chlebie kłamałyby w obie strony — o kończących się
  // jagodach przy pełnej spiżarni chleba i odwrotnie.
  const jedzenia = JADALNE.reduce((suma, j) => suma + stan.pula[j], 0);
  const ubywaJedzenia = JADALNE.reduce((suma, j) => {
    const p = surowce.find((x) => x.surowiec === j)!;
    return suma + (p.rozchod - p.przychod);
  }, 0);
  if (ubywaJedzenia > 1e-6) {
    if (jedzenia <= 0.5) {
      korki.push({
        rodzaj: "surowiec-znika",
        waga: 96,
        opis: `Nie ma już nic do jedzenia, a osada zjada ${ubywaJedzenia.toFixed(1)} dziennie.`,
      });
    } else {
      const naIleDni = jedzenia / ubywaJedzenia;
      if (naIleDni <= DNI_ALARMU) {
        korki.push({
          rodzaj: "surowiec-znika",
          waga: 95 - Math.min(60, naIleDni * 4),
          opis: `Jedzenia (jagody i chleb razem) starczy na ${dni(naIleDni)}.`,
        });
      }
    }
  }

  for (const p of surowce) {
    // Jedzenie ma własne, wspólne ostrzeżenie wyżej.
    if ((JADALNE as readonly Surowiec[]).includes(p.surowiec)) continue;

    // Surowiec, którego już nie ma, a wciąż jest potrzebny. To najpilniejszy
    // przypadek, a wypada z „starczy na X dni", bo dzielenie zaczyna się od
    // zera — i właśnie wtedy gracz najbardziej potrzebuje wyjaśnienia,
    // dlaczego ludzie zaczęli odchodzić.
    if (p.zapas <= 0.5 && p.rozchod > p.przychod + 1e-6) {
      const brakuje = p.rozchod - p.przychod;
      korki.push({
        rodzaj: "surowiec-znika",
        waga: p.surowiec === "drewno" ? 94 : 88,
        opis:
          `Nie ma ${NAZWY_CZEGO[p.surowiec]}, a potrzeba ${brakuje.toFixed(1)} dziennie` +
          (p.surowiec === "drewno" ? " — bez opału ludzie marzną jak przy głodzie." : "."),
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
      opis: "Leszy wstrzymał wyrąb. Postaw gajówkę tam, gdzie się wycina, i poczekaj na bilans drzew.",
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

  for (const p of surowce) {
    if (p.dniDoPelna !== null && p.dniDoPelna <= DNI_ALARMU) {
      korki.push({
        rodzaj: "magazyn-pelny",
        waga: 15,
        opis: `${NAZWY[p.surowiec]}: magazyn zapełni się za ${dni(p.dniDoPelna)}, nadwyżka przepadnie.`,
      });
    }
  }
}
