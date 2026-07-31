/**
 * Ostoja — kraina, czyli pięć miejsc jednej historii.
 *
 * Cztery duchy już są w grze i każdy koduje prawdziwą wiedzę, ale w jednej
 * osadzie gracz spotyka je przypadkiem i o dwóch może się nie dowiedzieć.
 * Kampania jest najtańszym sposobem, żeby każdy dostał własną lekcję: nie
 * trzeba nowej mechaniki, tylko rozłożyć istniejącą na mapy różniące się
 * terenem — bo teren decyduje o tym, który duch w ogóle da o sobie znać.
 *
 * **Co się przenosi** (zasada 9 z `PLAN.md`): Kodeks rośnie przez całą krainę,
 * przymierze zawarte raz obowiązuje wszędzie, a każde miejsce oddaje dalej
 * jedną umiejętność — ludzi, którzy potrafią coś, czego następna osada musiałaby
 * się dopiero dosłużyć stopniem.
 *
 * **Co się nie przenosi: ani jedno polano.** Sto desek w prezencie zamienia
 * trzecią mapę w spacer i cała krzywa się kładzie.
 *
 * Bez Phasera i bez localStorage, jak cały katalog sim/ — zapisem krainy
 * zajmuje się `src/zapis.ts`.
 */

import type { KonfiguracjaMapy, TypBudynku } from "./typy.ts";
import type { IdZakonczenia } from "./zakonczenia.ts";

/** Kolejność, w jakiej pożegnanie sięga po zdobyte zakończenie. */
const WAGA_ZAKONCZEN: IdZakonczenia[] = [
  "lubiana-przez-duchy",
  "z-lasem",
  "zapobiegliwa",
  "ludna",
];

export interface DefinicjaMiejsca {
  id: string;
  nazwa: string;
  teren: string;
  /** Id ducha z `dane/kodeks.json` albo „wszyscy" na ostatniej mapie. */
  duch: string;
  wprowadzenie: string[];
  duchMowi: string;
  /** Co to miejsce oddaje następnemu — budynki dostępne od pierwszego dnia. */
  przynosi: TypBudynku[];
  /**
   * Całe zdanie o tym, kto stąd przyszedł i co umie. Całe, bo polska odmiana
   * nie da się złożyć z kawałków w kodzie: „Z Borowa Głusza przyszło starą
   * kobietę" wychodziło z każdej próby sklejania nazwy z opisem.
   */
  przyprowadza: string;
  pozegnanie: Record<string, string>;
  /** Nadpisania konfiguracji mapy. Reszta idzie z `dane/mapa.json`. */
  mapa: Partial<KonfiguracjaMapy>;
  /** Nadpisania profilu sezonowego — krótkie lato w górach i nic poza tym. */
  poryRoku?: Record<string, Record<string, number>>;
  /** Nadpisania progów zakończeń. Patrz `zakonczeniaMiejsca`. */
  zakonczenia?: Record<string, number>;
}

export interface Kraina {
  nazwa: string;
  miejsca: DefinicjaMiejsca[];
}

/** Ile miejsc gracz przeszedł i co z nich wyniósł. Osobno od `StanGry`. */
export interface StanKrainy {
  wersja: number;
  /** Miejsce, w którym stoi dzisiejsza osada. */
  biezace: string;
  /** Przejdzione miejsca w kolejności, razem z tym, jak się skończyły. */
  przebyte: { miejsce: string; zakonczenia: IdZakonczenia[] }[];
  /** Kodeks rośnie przez całą krainę i nigdy się nie kasuje. */
  kodeks: string[];
}

export const WERSJA_KRAINY = 1;

export function nowaKraina(kraina: Kraina): StanKrainy {
  return {
    wersja: WERSJA_KRAINY,
    biezace: kraina.miejsca[0].id,
    przebyte: [],
    kodeks: [],
  };
}

export function miejsceO(kraina: Kraina, id: string): DefinicjaMiejsca {
  const znalezione = kraina.miejsca.find((m) => m.id === id);
  // Zapis krainy przeżywa podmianę danych, więc id z localStorage może już nie
  // istnieć. Cicha podmiana na pierwsze miejsce wyglądałaby jak skasowana
  // kampania; wyjątek mówi wprost, że dane się rozjechały.
  if (!znalezione) throw new Error(`kraina nie zna miejsca „${id}"`);
  return znalezione;
}

export function numerMiejsca(kraina: Kraina, id: string): number {
  return kraina.miejsca.findIndex((m) => m.id === id);
}

/** Miejsce po tym — albo null, gdy to było ostatnie. */
export function nastepneMiejsce(
  kraina: Kraina,
  id: string,
): DefinicjaMiejsca | null {
  const i = numerMiejsca(kraina, id);
  return i >= 0 && i + 1 < kraina.miejsca.length ? kraina.miejsca[i + 1] : null;
}

export function czyPrzebyte(stan: StanKrainy, id: string): boolean {
  return stan.przebyte.some((p) => p.miejsce === id);
}

/**
 * Czy miejsce jest już otwarte. Odsłaniamy po kolei, bo historia idzie po
 * kolei — mapa krainy z pięcioma miejscami naraz zamienia opowieść w wybór
 * poziomu z menu.
 */
export function czyOtwarte(kraina: Kraina, stan: StanKrainy, id: string): boolean {
  const i = numerMiejsca(kraina, id);
  return i === 0 || i <= numerMiejsca(kraina, stan.biezace) || czyPrzebyte(stan, id);
}

/**
 * Co osada na tym miejscu umie od pierwszego dnia. Suma tego, co oddały
 * miejsca **przed nim** — nie to, co oddaje ono samo, bo umiejętność wychodzi
 * z osady dopiero razem z ludźmi, którzy stąd ruszają dalej.
 */
export function umiejetnosciNa(kraina: Kraina, id: string): TypBudynku[] {
  const doKtorego = numerMiejsca(kraina, id);
  const zebrane: TypBudynku[] = [];
  for (let i = 0; i < doKtorego; i++) {
    for (const typ of kraina.miejsca[i].przynosi) {
      if (!zebrane.includes(typ)) zebrane.push(typ);
    }
  }
  return zebrane;
}

/** Kto przyszedł z poprzednich miejsc — gotowe zdania, w kolejności drogi. */
export function skadPrzyszli(kraina: Kraina, id: string): string[] {
  const doKtorego = numerMiejsca(kraina, id);
  const zdania: string[] = [];
  for (let i = 0; i < doKtorego; i++) {
    const m = kraina.miejsca[i];
    if (m.przynosi.length === 0 || m.przyprowadza === "") continue;
    zdania.push(m.przyprowadza);
  }
  return zdania;
}

/**
 * Zdanie na wyjście, zależne od tego, jak poszło. Osada, która żyła z lasem,
 * rusza dalej inaczej niż ta, która go wycięła — i to jest najtańszy sposób,
 * żeby wybór z pierwszej planszy był widoczny na trzeciej. Następnej mapy to
 * nie zmienia, tylko to, co się o niej mówi.
 */
export function pozegnanie(
  miejsce: DefinicjaMiejsca,
  zdobyte: IdZakonczenia[],
): string {
  for (const id of WAGA_ZAKONCZEN) {
    if (zdobyte.includes(id) && miejsce.pozegnanie[id]) {
      return miejsce.pozegnanie[id];
    }
  }
  return miejsce.pozegnanie.domyslne;
}

/**
 * Zamknięcie miejsca: dopisujemy je do przebytych, dokładamy Kodeks i
 * przesuwamy się na następne. Kodeks jest sumą — wpis zdobyty raz zostaje
 * w krainie na zawsze, także wtedy, gdy gracz zaczyna to samo miejsce od nowa.
 */
export function zamknijMiejsce(
  kraina: Kraina,
  stan: StanKrainy,
  zakonczenia: IdZakonczenia[],
  kodeksOsady: string[],
): StanKrainy {
  const id = stan.biezace;
  const przebyte = stan.przebyte.filter((p) => p.miejsce !== id);
  przebyte.push({ miejsce: id, zakonczenia });

  const kodeks = [...stan.kodeks];
  for (const wpis of kodeksOsady) if (!kodeks.includes(wpis)) kodeks.push(wpis);

  const dalej = nastepneMiejsce(kraina, id);
  return {
    wersja: WERSJA_KRAINY,
    biezace: dalej ? dalej.id : id,
    przebyte,
    kodeks,
  };
}

/**
 * Co z Kodeksu krainy dostaje nowa osada: **wiedza o duchach, ale nie
 * przymierza z nimi**.
 *
 * Plan mówi „przymierze zawarte raz obowiązuje w całej krainie" i to brzmi
 * niewinnie, dopóki nie sprawdzi się, czym przymierze jest w liczbach: każda
 * leśniczówka daje o jedno drewno więcej, domowik przestaje kraść. To jest
 * trwała premia do produkcji, więc przeniesienie jej dalej to przeniesienie
 * surowców pod inną nazwą — a tego zabrania zasada 9. Przymierze z południcą
 * bramkowałoby przy okazji Gród od pierwszego dnia trzeciej mapy.
 *
 * Zostaje więc to, co jest naprawdę wiedzą: wpisy o duchach. Dziecko, które
 * poznało leszego w Borowej Głuszy, czyta o nim dalej w Kamieńcu i nie musi
 * go poznawać drugi raz — ale dogadać się z nim musi na każdej mapie osobno.
 */
export function wiedzaDoOsady(stan: StanKrainy): string[] {
  return stan.kodeks.filter((wpis) => !wpis.startsWith("przymierze-"));
}

/** Konfiguracja mapy dla miejsca: baza z `dane/mapa.json` plus nadpisania. */
export function mapaMiejsca(
  baza: KonfiguracjaMapy,
  miejsce: DefinicjaMiejsca,
): KonfiguracjaMapy {
  return { ...baza, ...miejsce.mapa };
}

/**
 * Profil sezonowy miejsca. Kamieniec ma krótkie lato i to jedyna rzecz
 * w krainie, która rusza liczby balansowe — reszta różnic siedzi w terenie.
 */
export function poryRokuMiejsca(
  baza: Record<string, Record<string, number>>,
  miejsce: DefinicjaMiejsca,
): Record<string, Record<string, number>> {
  if (!miejsce.poryRoku) return baza;
  const wynik: Record<string, Record<string, number>> = { ...baza };
  for (const [typ, pory] of Object.entries(miejsce.poryRoku)) {
    wynik[typ] = { ...(baza[typ] ?? {}), ...pory };
  }
  return wynik;
}

/**
 * Progi zakończeń miejsca. Pięć terenów to pięć różnych gospodarek, więc jedna
 * liczba znaczy na nich co innego: „osada ludna" przy siedemdziesięciu jeden
 * mieszkańcach jest w Borowej Głuszy nieosiągalna, a nad jeziorem pada sama.
 * Zakończenie, które spełnia się zawsze albo nigdy, nie jest zakończeniem.
 */
export function zakonczeniaMiejsca<T extends object>(
  baza: T,
  miejsce: DefinicjaMiejsca,
): T {
  return { ...baza, ...(miejsce.zakonczenia ?? {}) } as T;
}
