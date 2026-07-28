# Ostoja

Gra strategiczna o budowaniu słowiańskiej osady. Bez walki. Dla dzieci.

Pełny opis projektu: [`OSTOJA.md`](OSTOJA.md). Zasady pracy nad kodem:
[`CLAUDE.md`](CLAUDE.md).

## Struktura

```
src/
  main.ts       punkt wejscia warstwy przegladarki
  zapis.ts      localStorage — jedyne miejsce, ktore wie o przegladarce
  sim/          czysty TypeScript symulacji, bez Phasera
                typy.ts tick.ts budynki.ts los.ts mapa.ts szukanie.ts stan.ts
dane/           liczby balansowe: budynki.json ulepszenia.json stale.json mapa.json
narzedzia/      symuluj.ts — balans ekonomii bez przegladarki
                podglad.ts — podglad i sprawdzenie mapy
                zapis.ts   — sprawdzenie zapisu i odczytu
```

Symulacja (`src/sim`) nie importuje Phasera i musi dać się uruchomić w Node bez
przeglądarki. Dzięki temu to samo `tick()` napędza grę i narzędzie balansujące.

## Uruchamianie

```bash
npm install
npm run dev        # gra w przegladarce (Vite)
npm run build      # typecheck + build produkcyjny
npm run typecheck  # sama kontrola typow
```

## Balansowanie

Narzędzie liczy pięć lat gry w ułamku sekundy, z mapą zastąpioną licznikami:

```bash
npm run balans -- 5 1234      # [lata] [ziarno]
# albo bezposrednio:
node --experimental-strip-types narzedzia/symuluj.ts 5 1234
```

Liczby balansowe zmienia się wyłącznie w `dane/*.json`, nigdy w kodzie.

## Mapa

```bash
npm run mapa -- 1234          # [ziarno]
```

Rysuje mapę w konsoli i sprawdza trzy rzeczy, których po obrazku nie widać:
czy z osady da się dojść wszędzie, ile jest surowców i czy generator jest
deterministyczny. W przeglądarce (`npm run dev`) kliknięcie w kafelek pokazuje
drogę z osady liczoną przez A*; `?ziarno=42` w adresie zmienia mapę.

## Zapis

```bash
npm run zapis -- 1234         # [ziarno]
```

Sprawdza obieg zapis → odczyt i to, co najważniejsze: czy gra wczytana z zapisu
toczy się dalej dokładnie tak samo, jak gdyby jej nie przerywano. Sam zapis
trafia do localStorage przeglądarki (przyciski „Zapisz” i „Wczytaj”).
