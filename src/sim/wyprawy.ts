/**
 * Ostoja — wyprawy.
 *
 * Klikasz w kafelek i wysyłasz ludzi. Bez budynku, bez kosztu, bez obsady na
 * stałe. Wracają po kilku dniach z ładunkiem.
 *
 * Po co to jest (etap 4 z PLAN.md):
 *
 * - **Nigdy nie ma patu.** Zabrakło drewna → idziesz po chrust. Blokada leszego
 *   przestaje być wyrokiem: zaczęta jesienią nie miała prawa puścić przed
 *   wiosną, bo gajówka zimą sadzi zero, a teraz zamiast czekać zbiera się
 *   gałęzie z ziemi. To jest zarazem lekcja: gdy las się gniewa, bierze się to,
 *   co leży, a nie to, co rośnie.
 * - **Gracz ma co robić co minutę**, nawet gdy nie stać go na kolejny budynek.
 *
 * Trzy zabezpieczenia, wszystkie z zasady 6 z PLAN.md — **wyprawa nigdy nie
 * jest lepsza od budynku na osobodzień**, bo inaczej zawór bezpieczeństwa staje
 * się strategią optymalną i łańcuch produkcyjny umiera:
 *
 * 1. **Tylko bezczynne ręce.** Wyprawa nie zdejmuje nikogo z warsztatu.
 * 2. **Czas idzie z odległości.** Daleki cel to tydzień bez tych ludzi.
 * 3. **Wynik na osobodzień niższy niż w budynku tego samego rodzaju.**
 *    Leśniczówka daje 2 drewna na osobodzień, chrust 1.2. Zbieracze 1 jagodę,
 *    wyprawa 0.7.
 *
 * Żadna wyprawa **nie rusza mapy**: chrust to gałęzie z ziemi, jagody się
 * odnawiają, ryby też. Dzięki temu leszy nie ma czego liczyć i nie ma tu
 * furtki do ogołocenia lasu bez konsekwencji.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type {
  DefinicjaWyprawy,
  Koszt,
  Punkt,
  StanGry,
  Surowiec,
  Teren,
  Wyprawa,
} from "./typy.ts";
import type { Dane } from "./budynki.ts";
import { WIEK_DOROSLOSCI } from "./osada.ts";
import { indeks, wGranicach } from "./mapa.ts";
import { znajdzSciezke } from "./szukanie.ts";

export interface DaneWypraw {
  wyprawy: DefinicjaWyprawy[];
}

function terenyWyprawy(def: DefinicjaWyprawy): Teren[] {
  return Array.isArray(def.teren) ? def.teren : [def.teren];
}

/** Ludzie, których wolno wysłać: dorośli bez przydziału i nie na wyprawie. */
export function bezczynneRece(stan: StanGry): string[] {
  return stan.mieszkancy
    .filter(
      (m) =>
        m.wiek >= WIEK_DOROSLOSCI && m.miejscePracy === null && !m.naWyprawie,
    )
    .map((m) => m.id);
}

export type PowodOdmowy =
  | "zly-teren"
  | "nie-dojda"
  | "brak-rak"
  | "nie-ma-osady";

export type MoznaWyslac =
  | { ok: true; ludzi: number; dni: number; ladunek: Koszt }
  | { ok: false; powod: PowodOdmowy };

/**
 * Czy da się tam kogoś wysłać i co z tego będzie. Liczone **przed** kliknięciem,
 * żeby panel mógł obiecać ładunek i czas — a nie kazać graczowi zgadywać, czy
 * warto było kogokolwiek odrywać od roboty.
 */
export function mozliwaWyprawa(
  stan: StanGry,
  dane: Dane & DaneWypraw,
  rodzaj: string,
  cel: Punkt,
): MoznaWyslac {
  const def = dane.wyprawy.find((w) => w.id === rodzaj);
  if (!def) return { ok: false, powod: "zly-teren" };

  const osada = stan.mapa.start;
  if (!osada) return { ok: false, powod: "nie-ma-osady" };

  if (!wGranicach(stan.mapa, cel.x, cel.y)) return { ok: false, powod: "zly-teren" };
  const kafelek = stan.mapa.kafelki[indeks(stan.mapa, cel.x, cel.y)];
  if (!terenyWyprawy(def).includes(kafelek.teren)) {
    return { ok: false, powod: "zly-teren" };
  }

  const wolni = bezczynneRece(stan);
  if (wolni.length === 0) return { ok: false, powod: "brak-rak" };

  // Woda i skała są nieprzechodnie, więc do rybaków idzie się **obok** celu.
  const droga = znajdzSciezke(stan.mapa, osada, cel, {
    obokCelu: !kafelek.przechodni,
  });
  if (droga === null) return { ok: false, powod: "nie-dojda" };

  const ludzi = Math.min(wolni.length, def.ludziMaks);
  const naDzien = Math.max(1, dane.stale.wyprawaKafelkowNaDzien);
  const wDrodze = Math.max(1, Math.ceil(droga.length / naDzien));
  const dni = wDrodze * 2 + def.dniZbierania;

  const mnoznik = def.poryRoku?.[stan.czas.pora] ?? 1;
  const ile = def.naOsobodzien * ludzi * def.dniZbierania * mnoznik;

  return {
    ok: true,
    ludzi,
    dni,
    ladunek: ile > 0 ? { [def.surowiec]: ile } : {},
  };
}

/**
 * Wysyła wyprawę. Zwraca ją albo null, gdy się nie da — a „nie da się" panel
 * powinien był pokazać wcześniej przez `mozliwaWyprawa`.
 */
export function wyslijWyprawe(
  stan: StanGry,
  dane: Dane & DaneWypraw,
  rodzaj: string,
  cel: Punkt,
  id: string,
): Wyprawa | null {
  const wynik = mozliwaWyprawa(stan, dane, rodzaj, cel);
  if (!wynik.ok) return null;

  const ludzie = bezczynneRece(stan).slice(0, wynik.ludzi);
  for (const idOsoby of ludzie) {
    const m = stan.mieszkancy.find((x) => x.id === idOsoby);
    if (m) m.naWyprawie = id;
  }

  const wyprawa: Wyprawa = {
    id,
    rodzaj,
    cel,
    ludzie,
    dniDoPowrotu: wynik.dni,
    dniRazem: wynik.dni,
    ladunek: wynik.ladunek,
  };
  stan.wyprawy.push(wyprawa);
  return wyprawa;
}

/**
 * Posuwa wyprawy o dzień. Zwraca te, które właśnie wróciły — tick dorzuca
 * ich ładunek do puli sam, bo tylko on wie o suficie magazynu.
 */
export function ruszWyprawy(stan: StanGry): Wyprawa[] {
  const wrocily: Wyprawa[] = [];

  for (const w of stan.wyprawy) {
    w.dniDoPowrotu--;
    if (w.dniDoPowrotu > 0) continue;

    wrocily.push(w);
    for (const idOsoby of w.ludzie) {
      const m = stan.mieszkancy.find((x) => x.id === idOsoby);
      // Człowiek mógł w międzyczasie umrzeć ze starości — wtedy po prostu
      // nie wraca, a ładunek przynoszą pozostali.
      if (m) m.naWyprawie = null;
    }
  }

  stan.wyprawy = stan.wyprawy.filter((w) => !wrocily.includes(w));
  return wrocily;
}

/** Ilu ludzi jest teraz poza osadą. Do paska i do panelu. */
export function ludziNaWyprawach(stan: StanGry): number {
  return stan.wyprawy.reduce((suma, w) => suma + w.ludzie.length, 0);
}

/** Nazwa surowca, po który poszła wyprawa — do opisu w panelu. */
export function surowiecWyprawy(
  dane: DaneWypraw,
  rodzaj: string,
): Surowiec | null {
  return dane.wyprawy.find((w) => w.id === rodzaj)?.surowiec ?? null;
}
