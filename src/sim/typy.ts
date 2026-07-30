/**
 * Ostoja — typy symulacji.
 *
 * Ten plik nie importuje niczego z Phasera i nigdy nie powinien.
 * Cały katalog sim/ musi dać się uruchomić w Node bez przeglądarki,
 * żeby narzedzia/symuluj.ts mogło przelecieć pięć lat gry w ćwierć sekundy.
 */

// ---------------------------------------------------------------------------
// Surowce
// ---------------------------------------------------------------------------

export const SUROWCE = [
  "drewno",
  "deska",
  "glina",
  "cegla",
  "zboze",
  "maka",
  "jagody",
  "chleb",
  "opowiesc",
] as const;

export type Surowiec = (typeof SUROWCE)[number];

/** Pełna pula. Każdy surowiec zawsze obecny, żeby nie sprawdzać undefined. */
export type Pula = Record<Surowiec, number>;

/** Częściowa pula — receptury, koszty budowy. */
export type Koszt = Partial<Record<Surowiec, number>>;

export function pustaPula(): Pula {
  return {
    drewno: 0,
    deska: 0,
    glina: 0,
    cegla: 0,
    zboze: 0,
    maka: 0,
    jagody: 0,
    chleb: 0,
    opowiesc: 0,
  };
}

/** Opowieści nie podlegają limitowi magazynu. */
export const BEZ_LIMITU: readonly Surowiec[] = ["opowiesc"];

/**
 * Co się liczy jako jedzenie, w kolejności wydawania. Jagody idą pierwsze, bo
 * się psują i bo tak wygląda przejście od zbieractwa do rolnictwa: najpierw las
 * karmi słabo i od razu, potem pole karmi mocno, ale raz w roku.
 *
 * Nikt tego już nie zjada codziennie (etap 1 z PLAN.md: zasoby są ceną czynu,
 * nie podatkiem od istnienia). Jedzenie jest ceną **nowego osadnika** — i tak
 * samo jak dawniej liczy się razem, nie sam chleb: osada na zbieractwie też ma
 * prawo rosnąć.
 */
export const JADALNE: readonly Surowiec[] = ["jagody", "chleb"];

// ---------------------------------------------------------------------------
// Czas
// ---------------------------------------------------------------------------

export const DNI_W_PORZE = 24;
export const DNI_W_ROKU = 96;

export const PORY = ["wiosna", "lato", "jesien", "zima"] as const;
export type PoraRoku = (typeof PORY)[number];

export interface Czas {
  /** 0..95 w obrębie roku */
  dzien: number;
  rok: number;
  pora: PoraRoku;
}

export type Predkosc = 0 | 1 | 2 | 4; // 0 = pauza

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

export type Teren = "las" | "laka" | "glina" | "woda" | "skala" | "ziemia";

/**
 * Ile drewna daje jedno drzewo. Przy 10 jedna gajówka utrzymuje bilans dwóch
 * leśniczówek, co jest regułą łatwą do zapamiętania. Przy 5 trzeba było gajówki
 * na każdą leśniczówkę i leszy blokował wyrąb bez przerwy.
 */
export const DREWNA_Z_DRZEWA = 10;

export interface Kafelek {
  teren: Teren;
  /** Ile jednostek zasobu zostało. Dla lasu: 0 lub DREWNA_Z_DRZEWA. */
  zasob: number;
  przechodni: boolean;
  zajetyPrzez: string | null;
}

export interface Punkt {
  x: number;
  y: number;
}

export interface Mapa {
  szerokosc: number;
  wysokosc: number;
  /** Indeksowanie: kafelki[y * szerokosc + x] */
  kafelki: Kafelek[];
  /**
   * Wykarczowana polana, na której staje pierwsza osada. Opcjonalna, bo mapa
   * w narzędziu balansującym jest atrapą (dwa liczniki zamiast kafelków)
   * i żadnego miejsca w terenie nie ma.
   */
  start?: Punkt;
}

/**
 * Parametry generatora mapy. Siedzą w dane/mapa.json, bo gęstość lasu i wielkość
 * złóż gliny to liczby balansowe — decydują, ile drewna i cegieł osada ma w ogóle
 * do wzięcia.
 */
export interface KonfiguracjaMapy {
  szerokosc: number;
  wysokosc: number;

  lasPlam: number;
  lasPromienMin: number;
  lasPromienMaks: number;

  glinaPlam: number;
  glinaPromienMin: number;
  glinaPromienMaks: number;
  /** Ile jednostek gliny leży na jednym kafelku złoża. */
  glinaZasob: number;

  skalaPlam: number;
  skalaPromienMin: number;
  skalaPromienMaks: number;

  ziemiaPlam: number;
  ziemiaPromienMin: number;
  ziemiaPromienMaks: number;

  /** Jaki ułamek wysokości mapy przepływa rzeka, zanim wpadnie w jezioro. */
  rzekaDlugosc: number;
  jezioroPromien: number;

  /** Promień polany wykarczowanej pod pierwszą osadę. */
  polanaPromien: number;
}

// ---------------------------------------------------------------------------
// Budynki
// ---------------------------------------------------------------------------

export const TYPY_BUDYNKOW = [
  "chata",
  "magazyn",
  "kapliczka",
  "lesniczowka",
  "gajowka",
  "zbieracze",
  "tartak",
  "glinianka",
  "cegielnia",
  "pole",
  "mlyn",
  "piekarnia",
  "bajarz",
] as const;

export type TypBudynku = (typeof TYPY_BUDYNKOW)[number];

export interface Receptura {
  wejscie: Koszt;
  wyjscie: Koszt;
  /** Ile dni symulacji na jeden pełny cykl przy pełnej obsadzie. */
  dni: number;
}

/**
 * Definicja typu budynku — wczytywana z dane/budynki.json, nigdy nie zmieniana
 * w trakcie gry. Ulepszenia nie modyfikują definicji, tylko nakładają się na
 * nią przy liczeniu (patrz efektywnaReceptura w budynki.ts).
 */
export interface DefinicjaBudynku {
  nazwa: string;
  szerokosc: number;
  wysokosc: number;
  miejscaPracy: number;
  koszt: Koszt;
  /** Ile dniówek pracy trzeba włożyć w budowę. Dwóch budowniczych skraca o połowę. */
  dniBudowy: number;
  receptura: Receptura | null;

  /** Zbiera z mapy w tym promieniu. 0 = warsztat, bierze z puli. */
  promien: number;
  /** Który teren zbiera. null dla warsztatów. */
  zbiera: Teren | null;
  /**
   * Czy zbieranie zużywa zasób. Leśniczówka wycina drzewo, zbieracze tylko
   * obchodzą las. Od tego zależy, czy leszy liczy to jako wycinkę.
   */
  wyczerpuje?: boolean;

  /** chata */
  mieszkancow?: number;
  /** magazyn */
  pojemnosc?: number;
  /** gajówka */
  sadziDrzew?: number;
  /** pole */
  plon?: number;
  tylkoPora?: PoraRoku;
}

export interface Budynek {
  id: string;
  typ: TypBudynku;
  /** Lewy górny róg na siatce. */
  x: number;
  y: number;
  pracownicy: string[];
  /** 0..1. Przed ukończeniem budowy: postęp budowy, potem: postęp cyklu produkcji. */
  postep: number;
  wybudowany: boolean;
  /** Gracz wyłączył ręcznie. Jednodniowe wstrzymanie latem chroni przed południcą. */
  wstrzymany: boolean;
  zablokowanyPrzez: "leszy" | null;
  /** Zbiera z mapy, ale w promieniu nic nie zostało. Sygnał dla interfejsu. */
  brakZasobu: boolean;
}

// ---------------------------------------------------------------------------
// Ludzie
// ---------------------------------------------------------------------------

export type StanCzlowieka =
  | "BEZCZYNNY"
  | "IDZIE_DO_PRACY"
  | "PRACUJE"
  | "IDZIE_PO_SUROWIEC"
  | "WRACA_DO_MAGAZYNU"
  | "IDZIE_DO_DOMU"
  | "SPI";

export interface Mieszkaniec {
  id: string;
  imie: string;
  wiek: number;
  /** null = bezdomny, nie zakłada rodziny */
  dom: string | null;
  /** null = wolny robotnik, chodzi na budowy */
  miejscePracy: string | null;
  stan: StanCzlowieka;
  /** Pozycja płynna, interpolowana między tickami. */
  x: number;
  y: number;
  sciezka: Punkt[];
  /**
   * Kafelki przejdziane w ciągu bieżącego dnia, od pozycji porannej do obecnej.
   * Wyłącznie dla warstwy rysującej: symulacja przesuwa człowieka raz na dzień
   * o kilka kafelków, a scena musi wiedzieć, którędy szedł, żeby przeprowadzić
   * go tą samą drogą jednostajnym krokiem, a nie po skosie przez skały.
   */
  trasa: Punkt[];
}

/**
 * Starość jest jedynym powodem, dla którego ktoś ubywa z osady sam z siebie
 * (zasada 2 z PLAN.md: nikt nie odchodzi ani z głodu, ani z zimna, ani
 * z niezadowolenia — awaria znaczy „osada stanęła", nigdy „osady nie ma").
 * Południca zostaje wyjątkiem, bo jest zapamiętywaną lekcją, nie awarią.
 */
export const WIEK_STAROSCI = 70;

/**
 * Skala zadowolenia. Stałe strukturalne, nie balansowe: pasek rysuje 0..100,
 * a środek skali jest punktem odniesienia dla tempa napływu przybyszów
 * i wartością, od której startuje zapis przeniesiony ze starszej wersji.
 */
export const ZADOWOLENIE_MAKS = 100;
export const ZADOWOLENIE_SREDNIE = 50;

// ---------------------------------------------------------------------------
// Ulepszenia
// ---------------------------------------------------------------------------

export const ULEPSZENIA = [
  "pila-traczna",
  "szkolka-lesna",
  "plodozmian",
  "piec-chlebowy",
  "zapiecek",
  "wypal-w-kregu",
  "woz-i-sciezki",
  "chleb-na-zakwasie",
] as const;

export type IdUlepszenia = (typeof ULEPSZENIA)[number];

export type PoleBudynku =
  | "szybkosc"
  | "promien"
  | "sadziDrzew"
  | "mieszkancow"
  | "plon";

export type PoleGlobalne = "kosztOsadnika";

/**
 * Efekt zapisany deklaratywnie, żeby dało się go zastosować jedną funkcją
 * zamiast pisać osiem wyjątków rozsianych po kodzie.
 */
export type EfektUlepszenia =
  | {
      operacja: "mnoznik";
      budynek: TypBudynku;
      pole: PoleBudynku;
      wartosc: number;
    }
  | {
      operacja: "dodaj";
      budynek: TypBudynku;
      pole: PoleBudynku;
      wartosc: number;
    }
  | {
      operacja: "ustawWyjscie";
      budynek: TypBudynku;
      surowiec: Surowiec;
      wartosc: number;
    }
  | { operacja: "ustawGlobalne"; pole: PoleGlobalne; wartosc: number }
  | { operacja: "mnoznikGlobalny"; pole: PoleGlobalne; wartosc: number };

export interface DefinicjaUlepszenia {
  id: IdUlepszenia;
  nazwa: string;
  koszt: number; // w opowieściach
  opis: string;
  efekty: EfektUlepszenia[];
}

// ---------------------------------------------------------------------------
// Duchy
// ---------------------------------------------------------------------------

export interface StanDuchow {
  /** Okno ostatnich DNI_W_ROKU dni. Indeks 0 = dziś. */
  wycieteDrzewa: number[];
  posadzoneDrzewa: number[];
  leszyBlokuje: boolean;
  przymierzeLeszy: boolean;

  /**
   * Ile dni z rzędu każde pole pracowało bez wstrzymania w tegorocznych żniwach.
   * Klucz to id budynku. Południca liczy tylko to.
   */
  poludnicaDni: Record<string, number>;
  /** Czy wodnik już się kiedykolwiek odezwał — do wpisu w Kodeksie. */
  wodnikSieOdezwal: boolean;

  domowikMiska: boolean;
  domowikZaniedbanieTygodni: number;
  dniBezKradziezy: number;
  przymierzeDomowik: boolean;
}

export const PROG_LESZEGO = 30;
export const OBRZED_LESZEGO_KOSZT: Koszt = { chleb: 20 };

// ---------------------------------------------------------------------------
// Stan globalny
// ---------------------------------------------------------------------------

/**
 * Skąd biorą się nowi osadnicy.
 *
 * Osadnik jest jedyną rzeczą, na którą schodzi jedzenie — i jedyną, przez którą
 * jedzenie ma w tej grze sens. Koszt rośnie z ludnością, bo inaczej dwudziesta
 * chata jest równie tania jak druga i późna gra przestaje być decyzją.
 */
export interface StaleOsadnika {
  /** Ile jedzenia kosztuje osadnik przy ludności `bazaLudnosci`. */
  bazowy: number;
  bazaLudnosci: number;
  /** Jak ostro koszt rośnie z ludnością. 1 = liniowo, więcej = coraz drożej. */
  wykladnik: number;
  /**
   * Ile dni zajmuje ściągnięcie osadnika przy zadowoleniu w środku skali.
   * Przy pełnym zadowoleniu dwa razy szybciej, przy zerowym nigdy.
   */
  dniNaPrzybysza: number;
}

/**
 * Zadowolenie: jedna liczba 0..100 na całą osadę. Wpływa **wyłącznie** na tempo
 * napływu przybyszów (i wchodzi do zakończenia sprintu). Nikt przez nie nie
 * odchodzi — zasada 2 z PLAN.md nie zna wyjątków.
 *
 * Każda składowa to punkty dokładane do `podstawa`. Suma jest celem, do którego
 * zadowolenie dochodzi po `tempo` punktów na dzień — bez tego pasek skakałby
 * o dwadzieścia punktów w dniu, w którym skończy się ostatnia jagoda.
 */
export interface StaleZadowolenia {
  podstawa: number;
  tempo: number;
  /** Jedzenia starczy na dwóch osadników. */
  spizarniaPelna: number;
  /** Jedzenia starczy na jednego. */
  spizarniaStarczy: number;
  /** Spiżarnia świeci pustkami. */
  spizarniaPusta: number;
  kapliczka: number;
  bajarz: number;
  /** Duch się gniewa (dziś: leszy wstrzymał wyrąb). */
  gniewDucha: number;
  /** Za każdą parę rąk bez przydziału. */
  bezRoboty: number;
  bezRobotyMaks: number;
  /** Zima bez jedzenia w zapasie. Etap 2 zamieni to na „zima bez zapasów". */
  chudaZima: number;
}

/**
 * Domowik kradnie **kwotę, nie procent**. Procent liczony od nieopróżnianego
 * magazynu rósł razem z nim i zamieniał domowika w jedynego przeciwnika w grze:
 * osiem procent z pełnej spiżarni to więcej, niż osada wyrabia dziennie.
 */
export interface StaleDomowika {
  miskaChlebNaTydzien: number;
  kwotaBazowa: number;
  przyrostNaTydzien: number;
  kwotaMaks: number;
  /**
   * Nigdy więcej niż tyle całego magazynu naraz. Kwota bez tego hamulca jest
   * łagodna dla bogatych i zabójcza dla biednych — dokładnie na odwrót, niż ma
   * być. Osada z dwudziestoma polanami traciła je co dwa dni i nie miała jak
   * uzbierać na kapliczkę, czyli na jedyne wyjście z tej pętli.
   */
  udzialMaks: number;
}

/**
 * Zapasy na zimę: jedyna decyzja jesieni.
 *
 * To **inwestycja, nie podatek** — i na tym stoi cały etap 2 z PLAN.md.
 * Zapłacone raz na jesieni, z własnej woli, przez okno widoczne w panelu.
 * Kto nie zapłaci, traci kwartał rozwoju: praca w polu i w lesie idzie
 * jak po grudzie, a osadnicy nie ruszają w drogę. **Nikt nie umiera i nic
 * się nie zabiera** — zima zabiera czas, nie ludzi (zasada 2 z PLAN.md).
 */
export interface StaleZapasow {
  drewnoNaOsobe: number;
  jedzenieNaOsobe: number;
  /** Ile zostaje z pracy poza dachem przez zimę bez zapasów. */
  mnoznikBezZapasow: number;
}

/**
 * Progi nazwanych zakończeń. Siedzą w danych, bo mają być strojone pomiarem:
 * warunek, który kompetentny gracz spełnia zawsze, nie jest zakończeniem, tylko
 * dekoracją, a komplet zdobyty w jednym przebiegu zamienia listę zakończeń
 * w listę do odhaczenia (zasada 8 z PLAN.md).
 */
export interface StaleZakonczen {
  /** Ilu mieszkańców na koniec to „osada ludna". */
  ludna: number;
  /** Ile przymierzy z duchami. */
  przymierza: number;
  /** Ile zim przeżytych z zapasami. */
  zimyZZapasami: number;
}

export interface StaleGry {
  pojemnoscBazowa: number;
  osadnik: StaleOsadnika;
  zapasy: StaleZapasow;
  /** Ile lat trwa jeden przebieg. To jest zegar całej gry. */
  sprint: { lat: number };
  zakonczenia: StaleZakonczen;
  zadowolenie: StaleZadowolenia;
  domowik: StaleDomowika;
  /** Ilu ludzi schodzi z produkcji na jeden plac budowy. */
  budowniczychNaBudowe: number;
  /** Jaka część kosztu wraca przy rozbiórce gotowego budynku. */
  zwrotZRozbiorki: number;
  wodnik: {
    /** Jak blisko wody musi stać młyn, żeby wodnik go zauważył. */
    promienRzeki: number;
    /** Jak blisko cegielnia zamienia błogosławieństwo w klątwę. */
    promienCegielni: number;
    blogoslawienstwo: number;
    klatwa: number;
  };
  /** Ile placów budowy pracuje jednocześnie. Reszta czeka w kolejce. */
  budowyNaraz: number;
  /** Ile sekund realnych trwa dzień przy prędkości 1×. */
  sekundNaDzien: number;
}

/** Z czym osada zaczyna grę. Opis w dane/stale.json. */
export interface StartGry {
  mieszkancy: number;
  pula: Koszt;
  budynki: TypBudynku[];
}

export interface StanGry {
  /** Numer schematu zapisu. Podbić przy każdej zmianie łamiącej wstecz. */
  wersja: number;
  czas: Czas;
  predkosc: Predkosc;

  pula: Pula;
  /** Suma pojemności magazynów. Liczona przy budowie, nie co tick. */
  pojemnosc: number;

  mapa: Mapa;
  budynki: Budynek[];
  mieszkancy: Mieszkaniec[];

  /** 0..100, jedno na całą osadę. Patrz StaleZadowolenia. */
  zadowolenie: number;
  /**
   * Czy zapasy na nadchodzącą zimę są już zrobione. Ustawiane jesienią,
   * kasowane z początkiem wiosny — jedna decyzja na rok.
   */
  zapasyNaZime: boolean;
  /**
   * Ile zim osada przeżyła z zapasami. Liczone na koniec zimy, nie na jesieni:
   * czynem jest przezimowanie, nie sam zakup. Tego pilnują stopnie osady
   * (`stopnie.ts`) i zakończenie „osada zapobiegliwa" z etapu 3.
   */
  zimyZZapasami: number;
  /**
   * Bór z pierwszego dnia, po jednym znaku na kafelek (patrz `spakujBor`).
   * Ekran końcowy pokazuje go obok boru z dnia ostatniego. Opcjonalny, bo
   * narzędzie balansujące mapy nie ma, a starsze zapisy go nie mają.
   */
  borNaStarcie?: string;
  /**
   * Jak daleko rozeszła się wieść o osadzie, 0..1. Rośnie codziennie tym
   * szybciej, im wyżej zadowolenie; przy 1 przychodzi osadnik — jeśli jest dla
   * niego dach i jedzenie na drogę. Gdy czegoś brakuje, wieść czeka na jedynce,
   * a panel mówi wprost, na co.
   *
   * Deterministycznie, bez losowania: dzięki temu panel może obiecać „osadnik
   * za trzy dni" i nie skłamać, a to jest cała zasada 7 z PLAN.md.
   */
  wiesc: number;

  ulepszenia: IdUlepszenia[];
  duchy: StanDuchow;
  /** Odblokowane wpisy Kodeksu. */
  kodeks: string[];

  /**
   * Bieżący stan generatora losowego, nie liczba podana przy zakładaniu osady.
   * Trzymany w stanie, żeby ten sam zapis dawał ten sam przebieg. Bez tego
   * balansowanie w narzedzia/symuluj.ts nie ma sensu, bo każde uruchomienie
   * dałoby inny wynik.
   */
  ziarno: number;

  /**
   * Ziarno, z którego powstała mapa. Osobne pole, bo `ziarno` zmienia się z
   * każdym losowaniem i po pierwszym dniu nie da się już z niego odtworzyć
   * terenu. Opcjonalne, bo mapa w narzędziu balansującym jest atrapą.
   */
  ziarnoMapy?: number;
}

export const WERSJA_ZAPISU = 5;
