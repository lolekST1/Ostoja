/**
 * Generator losowy z ziarna (mulberry32).
 *
 * WAŻNE: w całej symulacji nie wolno użyć Math.random(). Każde losowanie idzie
 * przez ten generator, bo inaczej ten sam zapis dawałby inny przebieg i
 * narzedzia/symuluj.ts nie miałoby sensu.
 */

export interface Los {
  /** 0..1 */
  nastepna(): number;
  /** true z podanym prawdopodobieństwem */
  szansa(p: number): boolean;
  /** liczba całkowita z przedziału [od, do) */
  calkowita(od: number, do_: number): number;
  /** aktualny stan, do zapisania w StanGry */
  ziarno(): number;
}

export function utworzLos(ziarnoStartowe: number): Los {
  let s = ziarnoStartowe >>> 0;

  const nastepna = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    nastepna,
    szansa: (p) => nastepna() < p,
    calkowita: (od, do_) => od + Math.floor(nastepna() * (do_ - od)),
    ziarno: () => s,
  };
}
