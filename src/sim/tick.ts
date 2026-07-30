/**
 * Ostoja — pętla symulacji.
 *
 * Jeden tick = jeden dzień w grze. Kolejność kroków ma znaczenie i nie należy
 * jej zmieniać bez powodu (patrz sekcja 4 dokumentu fundamentowego).
 *
 * Ten plik nie wie nic o Phaserze ani o mapie. Dostęp do zasobów na mapie idzie
 * przez interfejs Swiat, żeby to samo tick() dało się uruchomić zarówno w grze,
 * jak i w narzedzia/symuluj.ts, gdzie mapa jest zastąpiona licznikami.
 */

import type {
  Budynek,
  Koszt,
  Mieszkaniec,
  PoraRoku,
  StanGry,
  Surowiec,
} from "./typy.ts";
import {
  BEZ_LIMITU,
  JADALNE,
  DNI_W_PORZE,
  DNI_W_ROKU,
  DREWNA_Z_DRZEWA,
  PORY,
  PROG_LESZEGO,
  WIEK_STAROSCI,
} from "./typy.ts";
import type { Dane } from "./budynki.ts";
import { efektywnaReceptura, pole as polePo } from "./budynki.ts";
import { budujDzien } from "./budowa.ts";
import { zakwateruj } from "./ludzie.ts";
import {
  doKradzieniaWMagazynie,
  kosztOsadnika,
  kwotaDomowika,
  mnoznikZimowy,
  przesunZadowolenie,
  tempoWiesci,
  wolneMiejscaWChatach,
  zabierzZMagazynu,
  zapasJedzenia,
} from "./osada.ts";
import type { Los } from "./los.ts";

/** Dostęp do zasobów na mapie. Gra podaje mapę, narzędzie balansujące liczniki. */
export interface Swiat {
  /** Ile jednostek udało się pobrać z promienia budynku (może być mniej niż proszono). */
  pobierz(budynek: Budynek, ile: number): number;
  /**
   * Gajówka sadzi drzewa. Zwraca, ile faktycznie posadziła — leszy liczy tylko
   * to, co naprawdę wyrosło, więc gajówka bez wolnego miejsca w promieniu go
   * nie ucisza.
   */
  posadz(budynek: Budynek, ile: number): number;
  /**
   * Mnożnik tempa produkcji wynikający z położenia budynku — reguła wodnika.
   * Opcjonalny, bo narzędzie balansujące mapy nie ma i nie ma jak go policzyć;
   * brak metody znaczy „położenie nie ma tu znaczenia".
   */
  mnoznikMiejsca?(budynek: Budynek): number;
  /**
   * Ilu przydzielonych budowniczych stoi już na placu. Plac budowy oddalony
   * o pół mapy nie ma prawa rosnąć, zanim ktokolwiek do niego dojdzie — to
   * jedyne miejsce, w którym chodzenie wpływa na cokolwiek poza obrazkiem.
   *
   * Produkcji to nie dotyczy i dotyczyć nie może (zasada 8): warsztat czekający
   * na dojście pracownika odebrałby narzędziu balansującemu prawo do mówienia
   * o bilansie. Budowa jest inna — zdarza się raz na budynek, opóźnia go
   * o dzień lub dwa i nie rusza produkcji dobowej.
   *
   * Opcjonalne, bo świat bez mapy nie ma jak tego policzyć; brak metody znaczy
   * „wszyscy przydzieleni są na miejscu", czyli zachowanie sprzed tej zmiany.
   */
  obecniNaBudowie?(budynek: Budynek): number;
}

export interface Zdarzenia {
  /** Ze starości. Jedyny powód, dla którego ktoś ubywa sam z siebie. */
  zmarli: string[];
  /** Nowi osadnicy. Przybysze, nie narodziny — dziecko dorasta 16 lat, a sesja trwa 5. */
  przybysze: string[];
  /**
   * Ile jedzenia zabrał ze sobą osadnik, w rozbiciu na jagody i chleb.
   * Osobno od reszty, bo to skok, którego tabela „na dzień" świadomie nie
   * pokazuje — a narzedzia/bilans.ts musi wiedzieć, że ten ubytek jest znany
   * i zamierzony, zanim ogłosi, że panel kłamie.
   */
  zaOsadnika: Koszt;
  /** Minęła zima, na którą osada odłożyła zapasy. Warto o tym powiedzieć. */
  przezimowano: boolean;
  wybudowane: string[];
  leszySieOdezwal: boolean;
  /** Kogo zabrała południca. Imiona, bo to ma zaboleć, a nie być liczbą. */
  poludnicaZabrala: string[];
  wodnikSieOdezwal: boolean;
  przymierza: string[];
  /** Ile jednostek surowców zabrał dziś domowik. Interfejs ma to pokazać — duch,
   *  którego nie widać, musi być widoczny przez skutki. */
  ukradzione: number;
}

// ---------------------------------------------------------------------------

export { WIEK_DOROSLOSCI } from "./osada.ts";
import { WIEK_DOROSLOSCI } from "./osada.ts";

function poraDnia(dzien: number): PoraRoku {
  return PORY[Math.floor(dzien / DNI_W_PORZE)];
}

function dorzuc(stan: StanGry, surowiec: Surowiec, ile: number): void {
  const limit = BEZ_LIMITU.includes(surowiec) ? Infinity : stan.pojemnosc;
  stan.pula[surowiec] = Math.min(limit, stan.pula[surowiec] + ile);
}

function modyfikatorPory(dane: Dane, typ: string, pora: PoraRoku): number {
  return dane.stale.moznikiPorRoku?.[typ]?.[pora] ?? 1;
}

// ---------------------------------------------------------------------------
// Przydział pracy
// ---------------------------------------------------------------------------

/**
 * Przeliczany codziennie. Dzięki temu rolnicy poza sezonem sami wracają do puli
 * wolnych robotników zamiast stać nieruchomo przez trzy czwarte roku.
 *
 * Budowy idą przed produkcją, ale tylko `budowyNaraz` placów po
 * `budowniczychNaBudowe` ludzi. Miejsc pracy jest w tej grze zawsze więcej niż
 * rąk, więc gdyby produkcja miała pierwszeństwo, nikt nigdy nie poszedłby
 * budować i postawiona chata stałaby jako rusztowanie do końca sesji.
 */
export function przydzielPrace(stan: StanGry, dane: Dane): void {
  const pora = stan.czas.pora;
  const dostepni = stan.mieszkancy.filter((m) => m.wiek >= WIEK_DOROSLOSCI);
  for (const m of dostepni) m.miejscePracy = null;
  for (const b of stan.budynki) b.pracownicy = [];

  let i = 0;
  const zatrudnij = (b: Budynek, ile: number): void => {
    for (let s = 0; s < ile && i < dostepni.length; s++, i++) {
      b.pracownicy.push(dostepni[i].id);
      dostepni[i].miejscePracy = b.id;
    }
  };

  let placow = 0;
  for (const b of stan.budynki) {
    if (b.wybudowany || b.wstrzymany) continue;
    if (placow >= dane.stale.budowyNaraz) break;
    zatrudnij(b, dane.stale.budowniczychNaBudowe);
    placow++;
  }

  for (const b of stan.budynki) {
    if (!b.wybudowany || b.wstrzymany || b.zablokowanyPrzez) continue;

    const def = dane.budynki[b.typ];
    if (def.miejscaPracy === 0) continue;
    if (def.tylkoPora && def.tylkoPora !== pora) continue;

    zatrudnij(b, def.miejscaPracy);
  }
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

export function tick(
  stan: StanGry,
  dane: Dane,
  swiat: Swiat,
  los: Los,
): Zdarzenia {
  const z: Zdarzenia = {
    zmarli: [],
    przybysze: [],
    zaOsadnika: {},
    przezimowano: false,
    wybudowane: [],
    leszySieOdezwal: false,
    poludnicaZabrala: [],
    wodnikSieOdezwal: false,
    przymierza: [],
    ukradzione: 0,
  };

  // --- 1. Czas ------------------------------------------------------------
  stan.czas.dzien++;
  if (stan.czas.dzien >= DNI_W_ROKU) {
    stan.czas.dzien = 0;
    stan.czas.rok++;
    // Rok kończy się zimą, więc tutaj właśnie osada ją przezimowała. Liczymy
    // czyn, nie zakup: „przeżyta zima z zapasami", nie „kupione zapasy".
    if (stan.zapasyNaZime) {
      stan.zimyZZapasami++;
      z.przezimowano = true;
    }
    stan.zapasyNaZime = false;
  }
  stan.czas.pora = poraDnia(stan.czas.dzien);
  const pora = stan.czas.pora;

  // Zima bez zapasów: praca poza dachem idzie jak po grudzie. Nikt nie umiera
  // i nic się nie zabiera — tracisz kwartał rozwoju (etap 2 z PLAN.md).
  const mrozNaZewnatrz = mnoznikZimowy(stan, dane);

  przydzielPrace(stan, dane);

  // Budowa siedzi tuż przy przydziale pracy, bo zużywa wyłącznie ręce —
  // surowce zeszły z puli już w chwili zakładania placu. Kolejność pozostałych
  // kroków zostaje przez to nietknięta.
  z.wybudowane = budujDzien(stan, dane, swiat);

  // --- 2. Zbieranie z mapy ------------------------------------------------
  for (const b of stan.budynki) {
    const def = dane.budynki[b.typ];
    if (!b.wybudowany || !def.zbiera || !def.receptura) continue;
    if (b.pracownicy.length === 0) continue;

    const obsada = b.pracownicy.length / def.miejscaPracy;
    const mod = modyfikatorPory(dane, b.typ, pora);
    const przymierze =
      b.typ === "lesniczowka" && stan.duchy.przymierzeLeszy ? 1 : 0;

    for (const [sur, ile] of Object.entries(def.receptura.wyjscie)) {
      const chce = (ile + przymierze) * obsada * mod * mrozNaZewnatrz;
      const dostal = swiat.pobierz(b, chce);
      b.brakZasobu = dostal < chce - 1e-9;
      dorzuc(stan, sur as Surowiec, dostal);

      if (sur === "drewno" && def.wyczerpuje && dostal > 0) {
        stan.duchy.wycieteDrzewa[0] += dostal / DREWNA_Z_DRZEWA;
      }
    }
  }

  // Gajówka. Ile sadzi, zależy od pory (dane/stale.json): podwójnie na wiosnę,
  // połowicznie latem i jesienią, zero zimą — zmarznięta ziemia. Modyfikator
  // siedzi w danych, nie w kodzie, żeby dało się nim balansować bilans leszego.
  for (const b of stan.budynki) {
    if (b.typ !== "gajowka" || !b.wybudowany || b.pracownicy.length === 0) continue;
    const ile =
      polePo(dane, stan.ulepszenia, "gajowka", "sadziDrzew") *
      modyfikatorPory(dane, "gajowka", pora);
    stan.duchy.posadzoneDrzewa[0] += swiat.posadz(b, ile);
  }

  // --- 3. Produkcja warsztatów -------------------------------------------
  for (const b of stan.budynki) {
    const def = dane.budynki[b.typ];
    if (!b.wybudowany || def.zbiera || !def.receptura) continue;
    if (b.pracownicy.length === 0 || b.wstrzymany) continue;

    const rec = efektywnaReceptura(dane, stan.ulepszenia, b.typ)!;

    // Rezerwacja. Bez niej dwie piekarnie przy jednej porcji mąki obie ruszą
    // cykl i pula zejdzie poniżej zera.
    // Tolerancja jest tu konieczna, nie kosmetyczna. Glinianka daje dokładnie
    // 2 gliny dziennie, cegielnia bierze dokładnie 2 — trafiają w siebie co
    // dzień, a suma zmiennoprzecinkowa wypada raz 2.0000000001, raz
    // 1.9999999999. Bez tolerancji cegielnia stawała w losowe dni, panel
    // (który tolerancję ma) obiecywał cegłę i wychodziło z tego kłamstwo
    // widoczne w narzedzia/bilans.ts jako systematyczny odchył na glinie.
    if (b.postep === 0) {
      const stac = Object.entries(rec.wejscie).every(
        ([s, ile]) => stan.pula[s as Surowiec] >= ile - 1e-9,
      );
      if (!stac) continue;
      for (const [s, ile] of Object.entries(rec.wejscie)) {
        stan.pula[s as Surowiec] -= ile;
      }
    }

    // Reguła wodnika: młyn przy rzece miele szybciej, ale cegielnia obok
    // zamienia przychylność w złość. Liczy to świat, bo tick nie zna mapy.
    const mnoznik = swiat.mnoznikMiejsca?.(b) ?? 1;
    if (mnoznik !== 1 && !stan.duchy.wodnikSieOdezwal) {
      stan.duchy.wodnikSieOdezwal = true;
      z.wodnikSieOdezwal = true;
      odblokujKodeks(stan, "wodnik");
      // Przychylność to przymierze, złość nie. Klątwa daje sam wpis.
      if (mnoznik > 1) {
        odblokujKodeks(stan, "przymierze-wodnik");
        z.przymierza.push("wodnik");
      }
    }
    b.postep += (1 / rec.dni) * (b.pracownicy.length / def.miejscaPracy) * mnoznik;

    // Ta sama tolerancja co przy wsadzie, z tego samego powodu: bajarz ma cykl
    // trzydniowy, a 1/3 + 1/3 + 1/3 to w liczbach maszynowych nieco mniej niż
    // jeden. Bez tolerancji jego cykl trwa raz trzy dni, raz cztery.
    while (b.postep >= 1 - 1e-9) {
      b.postep = Math.max(0, b.postep - 1);
      for (const [s, ile] of Object.entries(rec.wyjscie)) {
        dorzuc(stan, s as Surowiec, ile);
      }
      if (b.postep > 0) {
        const stac = Object.entries(rec.wejscie).every(
          ([s, ile]) => stan.pula[s as Surowiec] >= ile - 1e-9,
        );
        if (!stac) {
          b.postep = 0;
          break;
        }
        for (const [s, ile] of Object.entries(rec.wejscie)) {
          stan.pula[s as Surowiec] -= ile;
        }
      }
    }
  }

  // --- 4. Żniwa -----------------------------------------------------------
  if (pora === "jesien") {
    for (const b of stan.budynki) {
      if (b.typ !== "pole" || !b.wybudowany || b.pracownicy.length === 0) continue;
      const plon = polePo(dane, stan.ulepszenia, "pole", "plon");
      const obsada = b.pracownicy.length / dane.budynki.pole.miejscaPracy;
      dorzuc(stan, "zboze", (plon / DNI_W_PORZE) * obsada);
    }
  }

  // --- 5. Zadowolenie -----------------------------------------------------
  //
  // Kroku konsumpcji tu nie ma i nie będzie. Nikt nie zjada nic codziennie,
  // nikt nie pali opału za samo istnienie — zasoby są ceną czynu (etap 1
  // z PLAN.md). Bezczynność nie kosztuje nic, bez wyjątków.
  //
  // Zadowolenie liczymy po produkcji, a przed przybyszami: to, co osada dziś
  // wyrobiła, ma się liczyć jeszcze dziś, a od zadowolenia zależy tempo,
  // w jakim rozchodzi się wieść.
  przesunZadowolenie(stan, dane);

  // --- 6. Ludność ---------------------------------------------------------
  for (const m of [...stan.mieszkancy]) {
    m.wiek += 1 / DNI_W_ROKU;

    if (m.wiek > WIEK_STAROSCI) {
      const szansa = (m.wiek - WIEK_STAROSCI) * 0.0008;
      if (los.szansa(szansa)) {
        z.zmarli.push(m.id);
        usun(stan, m);
      }
    }
  }

  /**
   * Przybysze zamiast narodzin, i przybysz jako **koszt**.
   *
   * Dziecko dorasta 16 lat, a sesja trwa pięć, więc przyrost naturalny dodawał
   * wyłącznie gęby i ani jednej pary rąk. Dorosły osadnik przychodzi z zewnątrz
   * i zabiera ze sobą jedzenie na drogę — to jedyna rzecz, na którą jedzenie
   * w tej grze schodzi, i cała nagroda za dobre gospodarowanie.
   *
   * Bez losowania: wieść rośnie codziennie tym szybciej, im wyżej zadowolenie,
   * i przy jedynce przychodzi człowiek. Dzięki temu panel może obiecać
   * „osadnik za trzy dni" i tego dowieźć (zasada 7 z PLAN.md). Gdy brakuje
   * dachu albo jedzenia, wieść czeka na jedynce — nic nie przepada.
   */
  // Sufit na jedynce, więc najwyżej jeden osadnik na dzień. Gdyby wieść mogła
  // narosnąć ponad jedynkę, osada z pustą spiżarnią odrabiałaby zaległości
  // czwórką ludzi w dniu, w którym wreszcie stanie ją na jednego.
  // Zimą bez zapasów wieść o osadzie **cichnie**, a nie czeka. Nikt nie wybiera
  // się w drogę tam, gdzie ludzie sami ledwie zipią, a po takiej zimie trzeba
  // od nowa zapracować na dobre słowo. To razem z karą w zadowoleniu sprawia,
  // że zaniedbana jesień kosztuje kwartał rozwoju, a nie dwa tygodnie.
  if (mrozNaZewnatrz === 1) {
    stan.wiesc = Math.min(1, stan.wiesc + tempoWiesci(stan, dane));
  } else {
    stan.wiesc = 0;
  }
  const koszt = kosztOsadnika(dane, stan.ulepszenia, stan.mieszkancy.length);
  if (
    stan.wiesc >= 1 &&
    mrozNaZewnatrz === 1 &&
    wolneMiejscaWChatach(stan, dane) > 0 &&
    zapasJedzenia(stan) >= koszt
  ) {
    // Jagody idą pierwsze, bo się psują. Chleb zostaje na to, co dalej.
    let doZaplaty = koszt;
    for (const jedzenie of JADALNE) {
      const jest = Math.min(stan.pula[jedzenie], doZaplaty);
      stan.pula[jedzenie] -= jest;
      z.zaOsadnika[jedzenie] = (z.zaOsadnika[jedzenie] ?? 0) + jest;
      doZaplaty -= jest;
      if (doZaplaty <= 1e-9) break;
    }

    const id = `os_${stan.czas.rok}_${stan.czas.dzien}_0`;
    const przybysz = nowyMieszkaniec(id, los, 18 + los.calkowita(0, 12));
    // Przybysz dostaje dach od razu. Bezdomny stałby w rogu mapy i wyglądałby
    // jak błąd rysowania, a nie jak nowy sąsiad.
    zakwateruj(stan, dane, przybysz, stan.mapa.start ?? { x: 0, y: 0 });
    stan.mieszkancy.push(przybysz);
    z.przybysze.push(id);
    stan.wiesc = 0;
  }

  // --- 7. Duchy -----------------------------------------------------------
  //
  // Południca. W dokumencie fundamentowym pilnowała pól latem, ale pola pracują
  // wyłącznie w żniwa — poza nimi nie mają obsady, więc karać było za co.
  // Liczy więc żniwa: pole, które przepracowało wszystkie dwadzieścia cztery
  // dni bez jednego dnia przerwy, traci na koniec jesieni pracownika.
  // Wystarczy wstrzymać je na jeden dzień. Dosłowna przerwa obiadowa.
  if (pora === "jesien") {
    for (const b of stan.budynki) {
      if (b.typ !== "pole" || !b.wybudowany) continue;
      const pracowalo = b.pracownicy.length > 0 && !b.wstrzymany;
      stan.duchy.poludnicaDni[b.id] = pracowalo
        ? (stan.duchy.poludnicaDni[b.id] ?? 0) + 1
        : 0;
    }

    const ostatniDzienZniw = DNI_W_PORZE * 3 - 1;
    if (stan.czas.dzien === ostatniDzienZniw) {
      // Jedna ofiara na żniwa, nie jedna z każdego pola. Przy czterech polach
      // wychodziły cztery pogrzeby rocznie i z zapamiętywanej lekcji robiło się
      // wykruszanie osady. Dziecko ma zapamiętać południcę, bo raz zabrała
      // kogoś z pola — nie dlatego, że zabiera co roku garść ludzi.
      const zapracowane = stan.budynki.filter(
        (b) =>
          b.typ === "pole" && (stan.duchy.poludnicaDni[b.id] ?? 0) >= DNI_W_PORZE,
      );
      for (const b of zapracowane) {
        const ofiara = stan.mieszkancy.find((m) => m.id === b.pracownicy[0]);
        if (!ofiara) continue;
        z.poludnicaZabrala.push(ofiara.imie);
        usun(stan, ofiara);
        odblokujKodeks(stan, "poludnica");
        break;
      }
      // Żniwa przepracowane z przerwą i bez ofiar to przymierze z południcą.
      const bylyPola = stan.budynki.some((b) => b.typ === "pole" && b.wybudowany);
      if (bylyPola && z.poludnicaZabrala.length === 0) {
        odblokujKodeks(stan, "poludnica");
        if (!stan.kodeks.includes("przymierze-poludnica")) {
          odblokujKodeks(stan, "przymierze-poludnica");
          z.przymierza.push("poludnica");
        }
      }
      stan.duchy.poludnicaDni = {};
    }
  } else if (Object.keys(stan.duchy.poludnicaDni).length > 0) {
    stan.duchy.poludnicaDni = {};
  }

  // Okno kroczące: dziś na początku, najstarszy dzień wypada.
  stan.duchy.wycieteDrzewa.unshift(0);
  stan.duchy.posadzoneDrzewa.unshift(0);
  stan.duchy.wycieteDrzewa.length = DNI_W_ROKU;
  stan.duchy.posadzoneDrzewa.length = DNI_W_ROKU;

  const wyciete = suma(stan.duchy.wycieteDrzewa);
  const posadzone = suma(stan.duchy.posadzoneDrzewa);
  const deficyt = wyciete - posadzone;

  if (!stan.duchy.leszyBlokuje && deficyt > PROG_LESZEGO) {
    stan.duchy.leszyBlokuje = true;
    z.leszySieOdezwal = true;
    odblokujKodeks(stan, "leszy");
  } else if (stan.duchy.leszyBlokuje && deficyt <= 0) {
    stan.duchy.leszyBlokuje = false;
  }
  for (const b of stan.budynki) {
    if (b.typ === "lesniczowka") {
      b.zablokowanyPrzez = stan.duchy.leszyBlokuje ? "leszy" : null;
    }
  }
  if (
    !stan.duchy.przymierzeLeszy &&
    stan.czas.rok >= 1 &&
    deficyt <= 0 &&
    !stan.duchy.leszyBlokuje
  ) {
    stan.duchy.przymierzeLeszy = true;
    z.przymierza.push("leszy");
    // Także wpis podstawowy: w dobrze prowadzonej osadzie leszy nigdy się nie
    // gniewa, więc bez tego gracz zawierałby przymierze z duchem, o którym
    // Kodeks milczy.
    odblokujKodeks(stan, "leszy");
    odblokujKodeks(stan, "przymierze-leszy");
  }

  // Domowik. Kradnie kwotę, nie procent: procent liczony od magazynu, którego
  // nikt już nie opróżnia, rósł razem z nim i robił z domowika jedynego
  // przeciwnika w grze. Kwota rośnie z zaniedbaniem, a nie z zamożnością.
  const maKapliczke = stan.budynki.some((b) => b.typ === "kapliczka" && b.wybudowany);
  stan.duchy.domowikMiska = maKapliczke && stan.pula.chleb > 0;
  if (stan.duchy.domowikMiska) {
    if (stan.czas.dzien % 7 === 0) {
      stan.pula.chleb = Math.max(
        0,
        stan.pula.chleb - dane.stale.domowik.miskaChlebNaTydzien,
      );
    }
    stan.duchy.dniBezKradziezy++;
    stan.duchy.domowikZaniedbanieTygodni = 0;
  } else if (!stan.duchy.przymierzeDomowik) {
    stan.duchy.domowikZaniedbanieTygodni += 1 / 7;
    const kwota = kwotaDomowika(
      dane,
      stan.duchy.domowikZaniedbanieTygodni,
      doKradzieniaWMagazynie(stan.pula),
    );
    const wziete = zabierzZMagazynu(stan.pula, kwota);
    z.ukradzione += wziete;
    if (wziete > 0) {
      stan.duchy.dniBezKradziezy = 0;
      odblokujKodeks(stan, "domowik");
    }
  }
  if (!stan.duchy.przymierzeDomowik && stan.duchy.dniBezKradziezy >= DNI_W_ROKU) {
    stan.duchy.przymierzeDomowik = true;
    z.przymierza.push("domowik");
    odblokujKodeks(stan, "domowik");
    odblokujKodeks(stan, "przymierze-domowik");
  }

  stan.ziarno = los.ziarno();
  return z;
}

// ---------------------------------------------------------------------------

function suma(t: number[]): number {
  let s = 0;
  for (const x of t) s += x || 0;
  return s;
}

function usun(stan: StanGry, m: Mieszkaniec): void {
  const i = stan.mieszkancy.indexOf(m);
  if (i >= 0) stan.mieszkancy.splice(i, 1);
}

function odblokujKodeks(stan: StanGry, wpis: string): void {
  if (!stan.kodeks.includes(wpis)) stan.kodeks.push(wpis);
}

const IMIONA = [
  "Jagna", "Dobiesław", "Miłosz", "Wierzchosława", "Sędziwoj", "Bogna",
  "Racibor", "Świętosława", "Ziemowit", "Dobrawa", "Jarogniew", "Ludmiła",
];

export function nowyMieszkaniec(id: string, los: Los, wiek = 0): Mieszkaniec {
  return {
    id,
    imie: IMIONA[los.calkowita(0, IMIONA.length)],
    wiek,
    dom: null,
    miejscePracy: null,
    stan: "BEZCZYNNY",
    x: 0,
    y: 0,
    sciezka: [],
    trasa: [],
  };
}
