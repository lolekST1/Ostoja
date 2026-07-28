# Ostoja — zasady pracy nad projektem

Gra strategiczna o budowaniu słowiańskiej osady. Bez walki. Dla dzieci.
Pełny opis projektu: `OSTOJA.md`. Przeczytaj go, zanim cokolwiek napiszesz.

Autor nie jest programistą. Wyjaśniaj decyzje po polsku, zwięźle, i nie zostawiaj
rzeczy do dokończenia „przez użytkownika".

---

## Zasady nienegocjowalne

**1. `src/sim/` nie importuje Phasera. Nigdy.**
Cały katalog musi dać się uruchomić w Node bez przeglądarki. Dostęp do mapy idzie
przez interfejs `Swiat` z `tick.ts`. Jeśli kusi Cię import z `phaser` w pliku
symulacji, to znaczy, że logika trafiła w złe miejsce.

**2. Zero `Math.random()` w symulacji.**
Każde losowanie przez generator z `src/sim/los.ts`, zasilany ziarnem ze
`StanGry.ziarno`. Bez tego ten sam zapis daje inny przebieg i narzędzie
balansujące przestaje mieć sens.

**3. Liczby balansowe tylko w `dane/*.json`.**
Żadnych stałych liczbowych rozsianych po kodzie. Wyjątki to stałe strukturalne
z `typy.ts` (`DNI_W_ROKU`, `PROG_ODEJSCIA`), nie balansowe.

**4. Interfejs w DOM, nie na canvasie.**
Pasek surowców, panele budynków, lista ulepszeń, Kodeks: zwykły HTML i CSS
nałożony na canvas. Phaser rysuje wyłącznie mapę, budynki i ludzi.

**5. Ulepszenia nie modyfikują definicji budynków.**
Definicje z `budynki.json` zostają nietknięte przez całą grę. Efekty nakładają
się przy liczeniu, w `src/sim/budynki.ts`. Dzięki temu interfejs może pokazać
„4 chleby zamiast 3", bo obie liczby wciąż istnieją.

**6. Nic w grze nie odblokowuje się przez odpowiedź na pytanie.**
Bez quizów, bez pytań kontrolnych, bez okienek sprawdzających wiedzę. Gra uczy
przez mechanikę i konsekwencje. W chwili, gdy zacznie odpytywać, przestaje uczyć.

**7. Kolejność kroków w ticku jest ustalona.**
Sekcja 4 dokumentu. Zwłaszcza rezerwacja wejść przed naliczeniem postępu: bez
niej dwie piekarnie przy jednej porcji mąki zejdą z pulą poniżej zera.

---

## Pułapki, w które ten projekt już raz wpadł

Wszystkie znalezione symulacją, nie zgadywaniem. Nie przywracaj ich.

- **Przybysze, nie narodziny.** Dziecko dorasta 16 lat, sesja trwa 5. Przyrost
  naturalny dodaje gęby, nie ręce, i osada dusi się przy dziesięciu dorosłych.
- **Chata kosztuje same deski.** Gdy wymagała cegieł, powstawała blokada nie do
  rozplątania: brak miejsc → brak ludzi → nikt nie obsadzi cegielni → brak cegieł.
- **Jedzenie to jagody i chleb razem.** Każdy warunek dotyczący zapasu jedzenia
  musi liczyć `JADALNE`, nie sam chleb. Osada na zbieractwie też ma prawo rosnąć.
- **Domowik ma sufit kradzieży 8%.** Bez sufitu po dwóch latach kradnie ponad
  100% zapasów dziennie.
- **Drzewo daje 10 drewna.** Przy 5 leszy blokuje wyrąb bez przerwy.
- **Gajówka sadzi ~72 drzewa rocznie, nie 112.** Przy silniejszej gajówce jedna
  równoważyła pięć leśniczówek, las rósł w nieskończoność i leszy nie groził
  nikomu. Profil sezonowy (podwójnie wiosną, zero zimą) trzyma bilans jedna
  gajówka = dwie leśniczówki. Modyfikatory pór roku są w `dane/stale.json`.
- **Pole obsługuje jedna osoba.** Przy dwóch żniwa tworzą szczyt zapotrzebowania
  na ręce, którego mała osada nie jest w stanie obsadzić.

---

## Balansowanie

```
node --experimental-strip-types narzedzia/symuluj.ts [lata] [ziarno]
```

Zmieniasz liczby w `dane/`, puszczasz na kilku ziarnach, patrzysz na ludność,
dni głodu i liczbę wykupionych ulepszeń. Nigdy nie balansuj przez granie
w przeglądarce, bo rok trwa tam trzy minuty.

**Stan na dziś: po pierwszym przykręceniu.** Ludność 10 → 39–42, zero dni
głodu, komplet ulepszeń dopiero w piątym roku (na części ziaren siedem z
ośmiu). Podniesiony koszt ulepszeń (99 → 178) i wolniejszy napływ przybyszów
(`szansaNaDziecko` 0.02 → 0.015) rozłożyły rozwój na całą sesję.

Symulacja pokazała, że pojemność magazynu i opał zimą nie ruszają gry
kompetentnego gracza (zero odejść nawet przy opale ×6), a próg przybyszów
`zapasNaDziecko` jest urwiskiem — powyżej 30 połowa ziaren zamiera. Szczegóły
w sekcji 12 OSTOJA.md.

Leszy dostał zęby: gajówka była ~2,5× za silna, las puchł do 2000+ drzew i
duch nie groził nikomu. Profil sezonowy gajówki (w `dane/stale.json`) sprowadził
las zrównoważonego gracza do ~1300, a chciwemu (sześć leśniczówek, jedna
gajówka) leszy blokuje wyrąb 88–132 dni na przebieg. Następny front to plateau
ludności — artefakt planu budowy w narzędziu, nie ekonomii.

---

## Stos i konwencje

Phaser 3, TypeScript, Vite, deploy na Vercela, zapis w localStorage.
Grafika: Kenney Medieval RTS (CC0). Pory roku przez `setTint`, nie przez cztery
komplety kafelków. Duchów nie rysujemy, są efektem świetlnym i ikoną w Kodeksie.

Nazwy w kodzie po polsku, bez polskich znaków (`lesniczowka`, `maka`, `zboze`).
Komentarze po polsku, tylko tam gdzie wyjaśniają **dlaczego**, nie **co**.

---

## Kolejność prac

1. `mapa.ts` i generator mapy 40×40, plus `szukanie.ts` (A*)
2. `stan.ts`: zapis i odczyt, wersjonowanie
3. Scena Phasera: rysowanie mapy, kamera, klikanie w kafelki
4. Stawianie budynków i przydział ludzi
5. Panel „gdzie się korkuje"
6. Kodeks i duchy
7. Balans, dopiero na końcu

Po każdym kroku ma się dać uruchomić `npm run dev` i zobaczyć działający efekt.
Nie buduj trzech warstw naraz.
