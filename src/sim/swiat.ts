/**
 * Ostoja — świat oparty na prawdziwej mapie.
 *
 * Implementacja interfejsu `Swiat` z tick.ts. To jedyne miejsce, w którym
 * symulacja dotyka kafelków: leśniczówka wycina konkretne drzewa, glinianka
 * wybiera konkretne złoże, gajówka sadzi tam, gdzie jest miejsce.
 *
 * Narzędzie balansujące podstawia w to miejsce dwa liczniki i dlatego nie widzi
 * wyczerpywania się okolicy — różnica między jednym a drugim światem to właśnie
 * ta rzecz, o której mówi sekcja 12 dokumentu.
 *
 * Bez Phasera, jak cały katalog sim/.
 */

import type { Budynek, Mapa, Punkt, StanGry, Teren } from "./typy.ts";
import { DREWNA_Z_DRZEWA } from "./typy.ts";
import type { Dane } from "./budynki.ts";
import { pole as polePo } from "./budynki.ts";
import { stoiPrzy } from "./ludzie.ts";
import { indeks, kafelekNa, wGranicach } from "./mapa.ts";
import type { Swiat } from "./tick.ts";

export interface SwiatMapy extends Swiat {
  /** Zawsze obecny w świecie po kafelkach — reguła wodnika potrzebuje mapy. */
  mnoznikMiejsca(budynek: Budynek): number;
  /** Zawsze obecny — pytanie „kto już doszedł" ma sens tylko z mapą. */
  obecniNaBudowie(budynek: Budynek): number;
  /**
   * Czy od ostatniego pytania zmienił się teren. Scena trzyma mapę w jednej
   * teksturze, więc przerysowuje ją tylko wtedy, gdy naprawdę coś ubyło.
   */
  odbierzZmianeTerenu(): boolean;
}

/** Środek budynku — od niego liczy się promień zbioru. */
export function srodekBudynku(rog: Punkt, szerokosc: number, wysokosc: number): Punkt {
  return { x: rog.x + (szerokosc - 1) / 2, y: rog.y + (wysokosc - 1) / 2 };
}

/**
 * Kafelki w promieniu, od najbliższego. Kolejność ma znaczenie: leśniczówka
 * ogołaca okolicę pierścieniami od siebie, a nie losowe drzewa w całym zasięgu.
 */
function wPromieniu(mapa: Mapa, srodek: Punkt, promien: number): number[] {
  const znalezione: { i: number; d2: number }[] = [];
  const r = Math.ceil(promien);
  const x0 = Math.round(srodek.x);
  const y0 = Math.round(srodek.y);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (!wGranicach(mapa, x, y)) continue;
      const d2 = (x - srodek.x) ** 2 + (y - srodek.y) ** 2;
      if (d2 > promien * promien) continue;
      znalezione.push({ i: indeks(mapa, x, y), d2 });
    }
  }

  znalezione.sort((a, b) => a.d2 - b.d2);
  return znalezione.map((z) => z.i);
}

export function swiatMapy(pobierzStan: () => StanGry, dane: Dane): SwiatMapy {
  let zmiana = false;

  function promienBudynku(stan: StanGry, b: Budynek): number {
    return polePo(dane, stan.ulepszenia, b.typ, "promien");
  }

  function kafelkiBudynku(stan: StanGry, b: Budynek): number[] {
    const def = dane.budynki[b.typ];
    const srodek = srodekBudynku(b, def.szerokosc, def.wysokosc);
    return wPromieniu(stan.mapa, srodek, promienBudynku(stan, b));
  }

  return {
    pobierz(b: Budynek, ile: number): number {
      const stan = pobierzStan();
      const def = dane.budynki[b.typ];
      if (!def.zbiera) return ile;

      const kafelki = kafelkiBudynku(stan, b);

      // Zbieranie niewyczerpujące (jagody): wystarczy, że w promieniu w ogóle
      // stoi las. Zbieracze go obchodzą, niczego nie zabierają, więc ilość
      // drzew nie zmienia wydajności — zmienia ją tylko pora roku.
      if (!def.wyczerpuje) {
        const jest = kafelki.some((i) => stan.mapa.kafelki[i].teren === def.zbiera);
        return jest ? ile : 0;
      }

      let zostalo = ile;
      let wziete = 0;
      for (const i of kafelki) {
        const k = stan.mapa.kafelki[i];
        if (k.teren !== def.zbiera || k.zasob <= 0) continue;

        const bierz = Math.min(k.zasob, zostalo);
        k.zasob -= bierz;
        zostalo -= bierz;
        wziete += bierz;

        if (k.zasob <= 1e-9) {
          k.zasob = 0;
          // Wycięty las zostaje lasem z pniakiem — gajówka ma co odnawiać.
          // Wybrane złoże gliny zamienia się w ziemię i już nie wróci; glina
          // jest zasobem jednorazowym i to jest w grze sygnał, że trzeba
          // przenieść glinankę.
          if (k.teren === "glina") k.teren = "ziemia";
          zmiana = true;
        }
        if (zostalo <= 1e-9) break;
      }

      return wziete;
    },

    /**
     * Gajówka sadzi. Zwraca, ile faktycznie posadziła — leszy liczy tylko to,
     * co naprawdę wyrosło. Bez tego gajówka postawiona na środku zabudowanej
     * polany uciszałaby ducha, nie sadząc ani jednego drzewa.
     *
     * Sadzenie jest ułamkowe (zimą zero, wiosną podwójnie), więc drzewo rośnie
     * po trochu: najpierw wracają pniaki w promieniu, a dopiero gdy las jest
     * pełny, młodnik wychodzi na wolną łąkę.
     */
    /**
     * Reguła wodnika. Młyn postawiony przy wodzie miele o połowę szybciej,
     * ale cegielnia w pobliżu zamienia przychylność w złość — duch wody nie
     * znosi sąsiedztwa pieca, który brudzi rzekę.
     *
     * Liczy to świat, nie tick: to reguła o położeniu na mapie, a tick mapy
     * nie zna i znać nie może.
     */
    mnoznikMiejsca(b: Budynek): number {
      if (b.typ !== "mlyn") return 1;
      const stan = pobierzStan();
      const w = dane.stale.wodnik;
      const def = dane.budynki.mlyn;
      const srodek = srodekBudynku(b, def.szerokosc, def.wysokosc);

      const przyWodzie = wPromieniu(stan.mapa, srodek, w.promienRzeki).some(
        (i) => stan.mapa.kafelki[i].teren === "woda",
      );
      if (!przyWodzie) return 1;

      const cegielniaBlisko = stan.budynki.some((inny) => {
        if (inny.typ !== "cegielnia" || !inny.wybudowany) return false;
        const d = dane.budynki.cegielnia;
        const s2 = srodekBudynku(inny, d.szerokosc, d.wysokosc);
        return Math.hypot(s2.x - srodek.x, s2.y - srodek.y) <= w.promienCegielni;
      });

      return cegielniaBlisko ? w.klatwa : w.blogoslawienstwo;
    },

    /**
     * Ilu przydzielonych budowniczych stoi już w drzwiach placu. Człowiek
     * przechodzi kilka kafelków dziennie, więc daleki plac rusza z miejsca
     * dzień lub dwa po założeniu — i dokładnie tak to teraz wygląda na mapie.
     */
    obecniNaBudowie(b: Budynek): number {
      const stan = pobierzStan();
      let ilu = 0;
      for (const m of stan.mieszkancy) {
        if (m.miejscePracy === b.id && stoiPrzy(m, b)) ilu++;
      }
      return ilu;
    },

    posadz(b: Budynek, ile: number): number {
      const stan = pobierzStan();
      let zostalo = ile * DREWNA_Z_DRZEWA;
      let posadzone = 0;

      const kafelki = kafelkiBudynku(stan, b);
      const pniaki = kafelki.filter((i) => {
        const k = stan.mapa.kafelki[i];
        return k.teren === "las" && k.zasob < DREWNA_Z_DRZEWA;
      });
      const laki = kafelki.filter((i) => {
        const k = stan.mapa.kafelki[i];
        return k.teren === "laka" && k.zasob === 0 && k.zajetyPrzez === null;
      });

      for (const i of [...pniaki, ...laki]) {
        if (zostalo <= 1e-9) break;
        const k = stan.mapa.kafelki[i];
        if (k.teren === "laka") {
          k.teren = "las";
          k.zasob = 0;
          zmiana = true;
        }
        const dosadz = Math.min(DREWNA_Z_DRZEWA - k.zasob, zostalo);
        const przed = k.zasob;
        k.zasob += dosadz;
        zostalo -= dosadz;
        posadzone += dosadz / DREWNA_Z_DRZEWA;
        // Pniak, który znów jest drzewem, zmienia obrazek.
        if (przed === 0 || k.zasob === DREWNA_Z_DRZEWA) zmiana = true;
      }

      return posadzone;
    },

    odbierzZmianeTerenu(): boolean {
      const byla = zmiana;
      zmiana = false;
      return byla;
    },
  };
}

/**
 * Ile zasobu zostało w zasięgu budynku. Do panelu „gdzie się korkuje" i do
 * podpowiedzi przy stawianiu: gracz ma widzieć, że leśniczówka trafi na pustkę,
 * zanim wyda deski.
 */
export function zasobWZasiegu(
  stan: StanGry,
  dane: Dane,
  typ: Budynek["typ"],
  rog: Punkt,
): number {
  const def = dane.budynki[typ];
  if (!def.zbiera) return 0;

  const srodek = srodekBudynku(rog, def.szerokosc, def.wysokosc);
  const promien = polePo(dane, stan.ulepszenia, typ, "promien");
  const teren: Teren = def.zbiera;

  let suma = 0;
  for (const i of wPromieniu(stan.mapa, srodek, promien)) {
    const k = stan.mapa.kafelki[i];
    if (k.teren !== teren) continue;
    suma += def.wyczerpuje ? k.zasob : 1;
  }
  return suma;
}

/** Czy kafelek w ogóle istnieje i jest sucho. Skrót dla interfejsu. */
export function kafelekWolny(mapa: Mapa, x: number, y: number): boolean {
  const k = kafelekNa(mapa, x, y);
  return k !== null && k.przechodni && k.zajetyPrzez === null && k.zasob === 0;
}
