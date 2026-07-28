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
 * Co można zjeść, w kolejności zużycia. Jagody idą pierwsze, bo się psują
 * i bo tak wygląda przejście od zbieractwa do rolnictwa: najpierw las karmi
 * słabo i od razu, potem pole karmi mocno, ale raz w roku.
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
  /** 0..1 */
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
  /** Dni bez jedzenia. Powyżej PROG_ODEJSCIA mieszkaniec odchodzi z osady. */
  glod: number;
}

export const PROG_ODEJSCIA = 10;
export const WIEK_STAROSCI = 70;

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

export type PoleGlobalne = "chlebNaOsobe";

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
  | { operacja: "ustawGlobalne"; pole: PoleGlobalne; wartosc: number };

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

export interface StaleGry {
  chlebNaOsobe: number;
  opalNaOsobe: Record<PoraRoku, number>;
  pojemnoscBazowa: number;
  szansaNaDziecko: number;
  zapasNaDziecko: number;
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

  ulepszenia: IdUlepszenia[];
  duchy: StanDuchow;
  /** Odblokowane wpisy Kodeksu. */
  kodeks: string[];

  /**
   * Ziarno generatora losowego. Trzymane w stanie, żeby ten sam zapis dawał
   * ten sam przebieg. Bez tego balansowanie w narzedzia/symuluj.ts nie ma sensu,
   * bo każde uruchomienie dałoby inny wynik.
   */
  ziarno: number;
}

export const WERSJA_ZAPISU = 1;
