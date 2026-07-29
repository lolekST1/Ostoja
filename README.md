# Ostoja

Gra strategiczna o budowaniu słowiańskiej osady. Bez walki. Dla dzieci.

Pełny opis projektu: [`OSTOJA.md`](OSTOJA.md). Zasady pracy nad kodem:
[`CLAUDE.md`](CLAUDE.md).

## Struktura

```
src/
  main.ts       punkt wejscia warstwy przegladarki, petla dzienna
  zapis.ts      localStorage — jedyne miejsce, ktore wie o przegladarce
  sim/          czysty TypeScript symulacji, bez Phasera
                typy.ts tick.ts budynki.ts budowa.ts ludzie.ts swiat.ts
                los.ts mapa.ts szukanie.ts stan.ts
  render/       scenaGry.ts — mapa, budynki i ludzie na canvasie
  ui/           pasek.ts menuBudowy.ts panel.ts korki.ts kodeks.ts — interfejs w DOM
dane/           liczby balansowe: budynki.json ulepszenia.json stale.json mapa.json
                tresc: kodeks.json
narzedzia/      symuluj.ts — balans ekonomii, mapa zastapiona licznikami
                naMapie.ts — ten sam balans, ale na prawdziwej mapie
                podglad.ts — podglad i sprawdzenie mapy
                zapis.ts   — sprawdzenie zapisu i odczytu
                bilans.ts  — czy panel „gdzie sie korkuje” nie klamie
```

Symulacja (`src/sim`) nie importuje Phasera i musi dać się uruchomić w Node bez
przeglądarki. Dzięki temu to samo `tick()` napędza grę i narzędzie balansujące.

## Gdzie w to zagrac

Po kazdym scaleniu do `main` GitHub Actions buduje gre i wystawia ja na
GitHub Pages: **https://lolekst1.github.io/Ostoja/**

Przed wystawieniem workflow puszcza te same sprawdzenia co lokalnie (kontrola
typow, mapa, zapis, bilans) — gra nie wyjedzie do dziecka z niedzialajaca mapa
albo panelem, ktory klamie.

## Uruchamianie

```bash
npm install
npm run dev        # gra w przegladarce (Vite)
npm run build      # typecheck + build produkcyjny
npm run typecheck  # sama kontrola typow
```

W przegladarce: wybierz budynek z listy po prawej i kliknij na mapie, gdzie ma
stanac. Zolty podklad znaczy „postawisz, ale wytniesz las" — drewno wpada wtedy
do magazynu. Prawy przycisk albo Escape odklada budynek, spacja zatrzymuje czas,
przyciski 1×/2×/4× zmieniaja tempo. Klikniecie w budynek pokazuje, ilu ludzi
w nim pracuje i co go blokuje; klikniecie w pusty kafelek — droge z osady
liczona przez A*. Przeciagniecie przesuwa mape, kolko przybliza, strzalki tez
dzialaja. `?ziarno=42` w adresie zmienia mape.

## Balansowanie

Narzędzie liczy pięć lat gry w ułamku sekundy, z mapą zastąpioną licznikami:

```bash
npm run balans -- 5 1234        # [lata] [ziarno]
npm run balans-mapa -- 5 1234   # to samo, ale na prawdziwej mapie
npm run balans-mapa -- 5 1234 dziennik   # z wpisem co osiem dni
```

`balans` jest szybszy i mierzy samą ekonomię. `balans-mapa` puszcza tę samą
symulację po kafelkach, więc widzi to, czego liczniki nie widzą: wyczerpywanie
lasu wokół konkretnej leśniczówki, wybrane złoże gliny i to, że mapa ma 220–430
drzew, a nie 900. Wyniki obu powinny się zgadzać; gdy się rozjadą, prawdę mówi
ten drugi.

Liczby balansowe zmienia się wyłącznie w `dane/*.json`, nigdy w kodzie.

## Mapa

```bash
npm run mapa -- 1234          # [ziarno]
```

Rysuje mapę w konsoli i sprawdza trzy rzeczy, których po obrazku nie widać:
czy z osady da się dojść wszędzie, ile jest surowców i czy generator jest
deterministyczny. W przeglądarce (`npm run dev`) kliknięcie w kafelek pokazuje
drogę z osady liczoną przez A*; `?ziarno=42` w adresie zmienia mapę.

## Panel „gdzie sie korkuje”

```bash
npm run bilans -- 3 1234      # [lata] [ziarno]
```

Panel obiecuje graczowi „drewna ubywa 2.1 dziennie, starczy na 9 dni”. To
narzedzie liczy bilans przed kazdym dniem, wykonuje dzien naprawde i sprawdza,
czy suma przewidywan zgadza sie z tym, co zaszlo. Panel, ktory zgaduje, jest
gorszy niz brak panelu — bo gracz mu wierzy.

## Zapis

```bash
npm run zapis -- 1234         # [ziarno]
```

Sprawdza obieg zapis → odczyt i to, co najważniejsze: czy gra wczytana z zapisu
toczy się dalej dokładnie tak samo, jak gdyby jej nie przerywano. Sam zapis
trafia do localStorage przeglądarki (przyciski „Zapisz” i „Wczytaj”).
