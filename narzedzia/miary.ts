/**
 * Ostoja — miary wspólne dla narzędzi balansujących.
 *
 * Po usunięciu zużycia surowców (etap 1 z PLAN.md) stare miary przestają
 * cokolwiek mówić: dni głodu i odejścia są zerowe **z definicji**, więc
 * narzędzie chwaliłoby każdą konfigurację, w tym nudną. Te miary pytają o coś
 * innego — czy gracz ma co robić i czy osada rośnie przez całą sesję:
 *
 * - ile dni nie było **żadnej sensownej decyzji** (nie stać na nic),
 * - ile razy osada **stanęła** (nie stać na nic i nic się nie buduje),
 * - w którym dniu weszła na **drugi i trzeci stopień**,
 * - **ludność i zapasy w funkcji czasu**, nie tylko na koniec.
 *
 * Zbierane raz na dzień, po ticku. Ten plik nie zna mapy — obie wersje
 * narzędzia (licznikowa i mapowa) wołają go tak samo.
 */

import type { StanGry } from "../src/sim/typy.ts";
import { DNI_W_ROKU, JADALNE } from "../src/sim/typy.ts";
import type { Dane } from "../src/sim/budynki.ts";
import { NAZWY_STOPNI, STOPNIE, numerStopnia } from "../src/sim/stopnie.ts";
import {
  drzewNaMapie,
  drzewNaStarcie,
  ilePrzymierzy,
  zdobyteZakonczenia,
} from "../src/sim/zakonczenia.ts";

export interface Miary {
  /** Woływać raz na dzień, po ticku. */
  zapisz(dzien: number): void;
  podsumowanie(): string[];
  /** Surowe przebiegi do wykresu. */
  historia: Historia;
}

export interface Historia {
  ludnosc: number[];
  jedzenie: number[];
  drewno: number[];
  zadowolenie: number[];
  budynki: number[];
}

/**
 * Czy gracz ma dziś co zrobić. Podaje to narzędzie, bo tylko ono zna swój plan:
 * „stać mnie na cokolwiek z listy budynków" nie jest tym samym pytaniem co
 * „stać mnie na to, po co właśnie sięgam". Pierwsze jest prawdą prawie zawsze
 * (chata za dwadzieścia okrąglaków) i nie mierzy niczego.
 */
export type MaDecyzje = () => boolean;

export function utworzMiary(
  stan: () => StanGry,
  dane: Dane,
  maDecyzje: MaDecyzje,
): Miary {
  const historia: Historia = {
    ludnosc: [],
    jedzenie: [],
    drewno: [],
    zadowolenie: [],
    budynki: [],
  };

  const dzienStopnia: Record<number, number | null> = { 2: null, 3: null };
  let ostatniStopien = 1;

  let dniBezDecyzji = 0;
  let zastoje = 0;
  let wZastoju = false;
  let najdluzszyZastoj = 0;
  let biezacyZastoj = 0;
  let dniZPelnymMagazynem = 0;
  /** Ile dni osada przestała w zimie, na którą nie odłożyła zapasów. */
  let dniZimyBezZapasow = 0;

  return {
    historia,

    zapisz(dzien: number): void {
      const s = stan();

      historia.ludnosc.push(s.mieszkancy.length);
      historia.jedzenie.push(
        Math.round(JADALNE.reduce((suma, j) => suma + s.pula[j], 0)),
      );
      historia.drewno.push(Math.round(s.pula.drewno));
      historia.zadowolenie.push(Math.round(s.zadowolenie));
      historia.budynki.push(s.budynki.length);


      const stopien = numerStopnia(s);
      if (stopien > ostatniStopien) {
        for (let n = ostatniStopien + 1; n <= stopien; n++) {
          dzienStopnia[n] ??= dzien;
        }
        ostatniStopien = stopien;
      }

      // „Sensowna decyzja" to taka, po której coś w osadzie ruszy: postawienie
      // budynku, po który gracz właśnie sięga, albo kupienie ulepszenia.
      // Wstrzymanie warsztatu się nie liczy — można to zrobić zawsze i nic
      // z tego nie wynika.
      const bezDecyzji = !maDecyzje();
      if (bezDecyzji) dniBezDecyzji++;

      // Zastój to coś więcej: nie stać na nic **i** nic się nie buduje, więc
      // osada nie tylko czeka na surowiec, ale w ogóle nie ma dokąd iść.
      const stoi = bezDecyzji && !s.budynki.some((b) => !b.wybudowany);
      if (stoi) {
        biezacyZastoj++;
        najdluzszyZastoj = Math.max(najdluzszyZastoj, biezacyZastoj);
        if (!wZastoju) {
          zastoje++;
          wZastoju = true;
        }
      } else {
        wZastoju = false;
        biezacyZastoj = 0;
      }

      // Pełny magazyn to sygnał „wydaj to", a nie awaria — ale gdy trwa
      // tygodniami, znaczy, że gracz nie ma na co wydawać.
      const pelny = (["drewno", "deska", "cegla", "chleb", "jagody"] as const).some(
        (surowiec) => s.pula[surowiec] >= s.pojemnosc - 1e-9,
      );
      if (pelny) dniZPelnymMagazynem++;

      if (s.czas.pora === "zima" && !s.zapasyNaZime) dniZimyBezZapasow++;
    },

    podsumowanie(): string[] {
      const dni = historia.ludnosc.length;
      const linie: string[] = [];

      linie.push(
        `dni bez żadnej sensownej decyzji: ${dniBezDecyzji} z ${dni}` +
          ` (${procent(dniBezDecyzji, dni)})`,
      );
      linie.push(
        `zastoje (nie stać na nic i nic się nie buduje): ${zastoje}` +
          `, najdłuższy ${najdluzszyZastoj} dni`,
      );
      linie.push(
        `dni z pełnym magazynem: ${dniZPelnymMagazynem} (${procent(dniZPelnymMagazynem, dni)})`,
      );
      linie.push(
        `zimy przezimowane z zapasami: ${stan().zimyZZapasami}` +
          `, dni zimy bez zapasów: ${dniZimyBezZapasow}`,
      );

      // Zakończenia to główna miara etapu 3: sprawdzamy nie tylko, które padły,
      // ale czy **komplet** się nie zdarza. Komplet znaczy, że lista przestała
      // być decyzją i zrobiła się listą do odhaczenia.
      const s = stan();
      const zdobyte = zdobyteZakonczenia(s, dane);
      // Świat licznikowy (symuluj.ts) mapy nie ma, więc o lesie nie wie nic
      // i „z-lasem" dostawałby z urzędu. Prawdę o borze mówi tylko naMapie.ts.
      const bezMapy = s.mapa.kafelki.length === 0;
      linie.push(
        `zakończenia (${zdobyte.length} z 4): ${zdobyte.join(", ") || "żadne"}` +
          (bezMapy ? "   (bez mapy — o lesie nic tu nie wiadomo)" : "") +
          (!bezMapy && zdobyte.length === 4 ? "   <-- KOMPLET, próg za niski" : ""),
      );
      linie.push(
        `  ludność ${s.mieszkancy.length} (próg ${dane.stale.zakonczenia.ludna}), ` +
          `przymierza ${ilePrzymierzy(s)} (próg ${dane.stale.zakonczenia.przymierza}), ` +
          `las ${Math.round(drzewNaMapie(s))} z ${Math.round(drzewNaStarcie(s))} drzew`,
      );

      for (const n of [2, 3]) {
        const d = dzienStopnia[n];
        const nazwa = NAZWY_STOPNI[STOPNIE[n - 1]];
        linie.push(
          d === null
            ? `stopień ${n} (${nazwa}): nie osiągnięty`
            : `stopień ${n} (${nazwa}): dzień ${d} (rok ${Math.floor(d / DNI_W_ROKU) + 1})`,
        );
      }

      linie.push(`ludność po latach: ${poLatach(historia.ludnosc).join(" → ")}`);
      // Zadowolenia nie ma w grze przed etapem 1b, a miary powstają przed nim
      // (1a). Wtedy ten wiersz po prostu nie ma czego pokazać.
      if (historia.zadowolenie.every((z) => Number.isFinite(z))) {
        linie.push(`zadowolenie po latach: ${poLatach(historia.zadowolenie).join(" → ")}`);
      }

      return linie;
    },
  };
}

function procent(ile: number, z: number): string {
  return z === 0 ? "—" : `${Math.round((ile / z) * 100)}%`;
}

/** Wartość na koniec każdego roku. Krzywa, nie jedna liczba na końcu. */
function poLatach(przebieg: number[]): number[] {
  const wynik: number[] = [];
  for (let d = DNI_W_ROKU - 1; d < przebieg.length; d += DNI_W_ROKU) {
    wynik.push(przebieg[d]);
  }
  const ostatni = przebieg.length - 1;
  if (ostatni >= 0 && (przebieg.length % DNI_W_ROKU !== 0)) wynik.push(przebieg[ostatni]);
  return wynik;
}
