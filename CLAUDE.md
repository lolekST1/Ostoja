# Ostoja — zasady pracy nad projektem

Gra strategiczna o budowaniu słowiańskiej osady. Bez walki. Dla dzieci.
Pełny opis projektu: `OSTOJA.md`. Przeczytaj go, zanim cokolwiek napiszesz.

> **Trwa przepisywanie ekonomii. Zanim cokolwiek ruszysz, przeczytaj `PLAN.md`.**
> Etapy 1–4 są zrobione: **nic się nie zużywa samo z siebie**, jesień ma jedną
> decyzję (zapasy na zimę), po pięciu latach jest koniec i nazwane zakończenia,
> a bezczynnych można wysłać na wyprawę. Zasoby są ceną czynu, nie podatkiem od
> istnienia; jedzenie jest ceną nowego osadnika i niczym więcej; nikt nie
> odchodzi z osady poza starością.
>
> **Etap 5 jest zrobiony w połowie: stopnie osady bramkują budynki.** Trzynaście
> budynków rozkłada się na Polanę, Osadę i Gród, bramami są czyny (kapliczka
> i przeżyta zima z zapasami, potem przymierze i druga taka zima), a gracz, który
> zapasów nie robi, zostaje na Polanie na zawsze. Cały łańcuch chlebowy
> (pole → młyn → piekarnia) mieści się w Osadzie; Gród daje bajarza, czyli
> drogę do ulepszeń.
>
> **Etap 6 jest zrobiony: kraina to pięć miejsc jednej historii.** Wierzbnica,
> Borowa Głusza, Jezierzysko, Złote Łany i Kamieniec różnią się terenem, a przez
> teren — duchem, który da o sobie znać. Każde otwiera się ekranem wprowadzenia
> (teksty w `dane/kraina.json`, nigdy w kodzie), oddaje następnemu jedną
> umiejętność i żegna zdaniem zależnym od zdobytych zakończeń. Kampania żyje
> w osobnym kluczu `ostoja:kraina`, więc „Nowa osada" jej nie kasuje.
>
> Zostaje **wyprawianie osadników** — druga połowa etapu 5. Kraina już jest,
> więc jest dokąd ich wyprawić.

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
z `typy.ts` (`DNI_W_ROKU`, `ZADOWOLENIE_MAKS`), nie balansowe.

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
Kroku konsumpcji nie ma i nie będzie (etap 1 z `PLAN.md`).

**9. Bezczynność nie kosztuje nic. Bez wyjątków.**
Nie budujesz, nie ściągasz ludzi, nie kupujesz ulepszeń — nie tracisz nic.
Jedzenie schodzi wyłącznie na osadnika, drewno wyłącznie na budowę i na wsad
do receptur. Gdy kusi Cię „tylko troszkę na utrzymanie", przeczytaj sekcję 1
`PLAN.md` — tam jest opisane, co ta „troszkę" zrobiła z pierwszą wersją.

**10. Nikt nie odchodzi z osady poza starością.**
Ani z głodu, ani z zimna, ani z niezadowolenia. Awaria znaczy „osada stanęła",
nigdy „osady nie ma". Południca jest jedynym wyjątkiem i jest nim świadomie:
zabiera jedną osobę na rok i jest zapamiętywaną lekcją, nie awarią.

**8. Chodzenie ludzi nie wpływa na produkcję.**
`ruszLudzi()` woła `main.ts` po ticku, nigdy sam tick. Gdyby warsztat czekał na
dojście pracownika, `symuluj.ts` — który mapy nie ma — przestałby mówić prawdę
o bilansie. Ruch jest po to, żeby osada wyglądała na żywą.

**11. Nie projektuj pod rzadkie przypadki, o które nikt nie prosił.**
Kod obsługuje to, co gra robi dziś. Bez zabezpieczeń na „a gdyby kiedyś…”,
bez parametrów na zapas i bez obsługi stanów, do których symulacja nie
dochodzi. Prawdziwe błędy poprawiamy, a zgłoszenia reviewera z niskim
iloczynem częstości i wagi trafiają na listę odłożonych, nie do kodu.

---

## Pułapki, w które ten projekt już raz wpadł

Wszystkie znalezione symulacją, nie zgadywaniem. Nie przywracaj ich.
Pełne opisy z liczbami i powodami: `docs/PULAPKI.md`. Zanim zmienisz coś, czego dotyczy któraś pozycja, przeczytaj jej opis.

- Przybysze, nie narodziny.
- Chata kosztuje same drewno.
- Jedzenie to jagody i chleb razem.
- Domowik kradnie kwotę, ale z sufitem od dołu.
- Drzewo daje 10 drewna.
- Gajówka sadzi ~72 drzewa rocznie, nie 112.
- Pole obsługuje jedna osoba.
- Rzeka potrafi odciąć róg mapy.
- Zalewanie musi liczyć tak samo jak A*.
- Osada startuje z drewnem.
- Budowa w lesie karczuje las i oddaje drewno.
- Budowy mają pierwszeństwo przed produkcją, ale tylko jeden plac naraz.
- Gajówka postawiona pod chatami nie robi nic.
- Piekarnia jest drewnożerna.
- Rezerwa drewna liczona sztywną liczbą zatrzaskuje grę.
- Bilans musi liczyć warsztaty po kolei, nie naraz.
- Panel, który zgaduje, jest gorszy niż brak panelu.
- Południca liczy żniwa, nie lato.
- Reguły o położeniu liczy świat, nie tick.
- Przymierze też otwiera wpis w Kodeksie.
- Żaden budynek nie może kosztować tego, co sam jako jedyny produkuje.
- Drewno buduje początek, deski resztę.
- Postęp budowy liczą obecni, nie przydzieleni.
- Ludzie chodzą po zapisanej trasie, nie po prostej do celu.
- Kafelek ma 32 px, bo rysunek ma 64.
- Teren rysuj wsadowo.
- Drzwi budynku są u dołu bryły, nie w lewym górnym rogu.
- Nie pisz graczowi, czego w grze nie ma.
- Panel nie może obiecać tego samego lasu dwa razy.
- Bilans musi liczyć żniwa po warsztatach, a domowika na puli po produkcji.
- Numeruj place budowy od stu.
- Osadnik przychodzi bez losowania.
- Kosztu osadnika nie wolno rozsmarować po dniach.
- Bramy stopni oparte na „czynie" trzeba sprawdzić, czy czyn jest trudny.
- Tolerancja przy sprawdzaniu wsadu nie jest kosmetyką.
- Kara zimowa liczona samą produkcją jest za słaba.
- Wyprawa jest zaworem, nie nawykiem.
- Miara „dni bez decyzji" musi znać wyprawy.
- Brak `stopien` w `budynki.json` otwiera całą grę i nic o tym nie mówi.
- Krok planu w narzędziach musi być zbiorem, nie licznikiem.
- `przerwaWZniwa()` musi iść po `przestawLudzi()`.
- Reguła wodnika była graczowi całkiem niewidoczna.
- Stopień nie może przeciąć łańcucha produkcyjnego w pół.
- Miska domowika nie może wymagać czegoś spoza stopnia.
- „Postaw miskę w kapliczce" opisywało czynność, której nie ma.
- Mapa bez drzew nie ma jagód i osada na niej głoduje.
- Przymierza nie wolno przenosić między mapami krainy.
- Polska odmiana nie da się sklejać w kodzie.
- Jeden próg zakończenia na pięć map to pięć różnych gier.
- Ulepszeń nie dało się kupić przez całą pierwszą wersję.
- Rada w panelu musi być z rzeczy, po którą gracz może dziś sięgnąć.
- Gajówka na dwie osoby: zmierzone i odrzucone.
- Dzień trwa 4 sekundy, a osada startuje na pauzie.


## Wystawianie do testów

`.github/workflows/pages.yml` buduje i wystawia grę na GitHub Pages przy każdym
wejściu na `main`, pod stałym adresem. Nic nie trzeba klikać.

Przed budową idą te same sprawdzenia co lokalnie: kontrola typów, generator
mapy, zapis i odczyt, spójność krainy. **`bilans.ts` jest wyjątkiem i nie
blokuje wystawienia** — to narzędzie balansujące, nie test poprawności, a jego
rozjazd jest znanym długiem („Co zostało", punkt 2). Wynik zostaje w logu,
krok świeci na żółto. Gdy dług się domknie, wystarczy skasować z workflow
jedną linię `continue-on-error`.

Ta różnica jest istotna: przez dwa scalenia nic nie wyjechało do testów,
bo tabelka w panelu myliła się o dziewięć setnych drewna na dzień.

---

## Balansowanie

```
node --experimental-strip-types narzedzia/symuluj.ts [lata] [ziarno]   # ekonomia
node --experimental-strip-types narzedzia/naMapie.ts [lata] [ziarno]   # ekonomia na mapie
node --experimental-strip-types narzedzia/naMapie.ts [lata] [ziarno] bezzapasow  # to samo, ale gracz olewa zimę
node --experimental-strip-types narzedzia/podglad.ts [ziarno]          # mapa
node --experimental-strip-types narzedzia/bilans.ts [lata] [ziarno]    # czy panel nie kłamie
node --experimental-strip-types narzedzia/kraina.ts                    # kampania: co się przenosi
# to samo krócej: npm run mapa / zapis / bilans / kraina
```

Czwarty argument `naMapie.ts` to **id miejsca krainy** (`borowa-glusza`,
`jezierzysko`, `zlote-lany`, `kamieniec`; bez niego Wierzbnica). Pięć terenów
to pięć różnych gospodarek i bez tego argumentu narzędzie mierzy wyłącznie
pierwszą mapę, po czym ogłasza, że kampania jest zbalansowana.

`naMapie.ts` puszcza tę samą ekonomię po kafelkach i widzi to, czego liczniki
nie widzą: wyczerpany krąg leśniczówki, wybrane złoże gliny, las, który nie
puchnie do dwóch tysięcy drzew. Gdy oba narzędzia się rozjadą, prawdę mówi to.
Trzeci argument `dziennik` dopisuje wpis co osiem dni — do szukania dnia,
w którym coś się załamało.

Zmieniasz liczby w `dane/`, puszczasz na kilku ziarnach, patrzysz na krzywą
ludności, zadowolenie i dni bez decyzji. Nigdy nie balansuj przez granie
w przeglądarce, bo rok trwa tam trzy minuty.

Wyniki pomiarów po kolejnych etapach (ludność, zakończenia, stan `bilans.ts`, tabela pięciu miejsc krainy): `docs/POMIARY.md`. Przeczytaj, zanim zmienisz liczby w `dane/` albo progi zakończeń.

---

## Co zostało

Dalsze prace prowadzi **`PLAN.md`** — została druga połowa etapu 5,
wyprawianie osadników. Poza nim zostaje:

1. **Zderzenie z dzieckiem.** Kryterium z sekcji 10: dziecko siada, gra
   dwadzieścia minut i samo mówi „jeszcze raz". Tego nie zmierzy żadne
   narzędzie i żadna symulacja.
2. **Domknąć `bilans.ts`.** Cztery ziarna z ośmiu (1, 42, 777, 2024) zgadzają
   się, na pozostałych odchył 0.06–0.16 przy progu 0.05 — na drewnie, glinie,
   cegle, mące i chlebie, o różnych znakach. Przyczyna jest ustalona (warsztat
   z rozpoczętym cyklem kończy go bez wsadu, a bilans w tym dniu mówi „stoi"),
   lekarstwo nie. Dopóki to stoi, każdą zmianę w `src/sim/bilans.ts` trzeba
   mierzyć na wszystkich ośmiu ziarnach, a nie na jednym. I sprawdzać
   `surowców sprawdzonych: N z 10` — poniżej dziesięciu test mierzy osadę,
   która stoi, a nie panel.
3. **Martwa glinianka.** Gliny na mapie jest 2000+ jednostek przy
   zapotrzebowaniu rzędu 150, a mimo to na części ziaren glinianka stoi
   z pustym kręgiem kilkadziesiąt do trzystu dni. Liczbami się tego nie naprawi:
   to brak mechaniki, nie zły balans.
4. **Łowy i wyprawa po kamień.** Etap 4 dowiózł trzy wyprawy z pięciu. Łowy
   potrzebują zwierzyny chodzącej po mapie (nowa encja w symulacji i w scenie),
   a kamień ma sens dopiero z budynkiem grodowym, który go zjada — dziś Gród
   odblokowuje piekarnię i bajarza, a te biorą mąkę i chleb. Kamieniec czeka
   na jedno i drugie: to mapa z górami, na której kamienia nie ma po co kopać.
5. **Kampanii nie da się zmierzyć przebiegiem.** `narzedzia/kraina.ts` sprawdza,
   co się przenosi między mapami i czy droga kończy się tam, gdzie powinna, ale
   nie odpowie na pytanie, czy pięć map pod rząd to nie jest o trzy za dużo dla
   dziecka. To samo kryterium co punkt 1 i tak samo niemierzalne.
5. **Samouczek kończy się wiosną, a zapasy przychodzą jesienią.** Pierwsze okno
   decyzji otwiera się długo po ostatnim okienku samouczka, więc uczy o nim
   wyłącznie panel. Kodeks nie pomoże bez przebudowy — jego wpisy mają sztywny
   kształt „duch + przymierze". Do sprawdzenia z dzieckiem, czy sam panel
   wystarcza.

Zrobione po kroku 7: rozbiórka budynku, południca i wodnik, po pierwszym
prawdziwym zagraniu — wolniejsze tempo, start na pauzie i samouczek, a po nim
etapy 1 i 2 z `PLAN.md`: koniec zużycia, zadowolenie, osadnik za jedzenie
i zapasy na zimę.

**Samouczek trzyma się zasady 6 tak samo jak Kodeks.** Kroki zamykają się
guzikiem „dalej" albo czynem — `SPELNIONE` w `src/ui/samouczek.ts` czyta stan
gry i sprawdza, czy budynek naprawdę stoi. Żadnego kroku nie wolno otwierać
pytaniem, bo w tej samej chwili gra przestaje uczyć, a zaczyna odpytywać.
Postęp siedzi w localStorage osobno od zapisu (`ostoja:samouczek`), żeby
„Nowa osada" nie kazała dziecku przeklikiwać siedmiu okienek od nowa.


## Stos i konwencje

Phaser 3, TypeScript, Vite, deploy na Vercela, zapis w localStorage.
Grafika: Kenney Medieval RTS (CC0). Pory roku przez `setTint`, nie przez cztery
komplety kafelków. Duchów nie rysujemy, są efektem świetlnym i ikoną w Kodeksie.

Nazwy w kodzie po polsku, bez polskich znaków (`lesniczowka`, `maka`, `zboze`).
Komentarze po polsku, tylko tam gdzie wyjaśniają **dlaczego**, nie **co**.

---

## Kolejność prac

Zrobione: 1, 2, 3, 4, 5, 6, 7 — pierwsza wersja — etapy 1–4 z `PLAN.md`,
pierwsza połowa etapu 5 (stopnie osady bramkują budynki) i etap 6 (kraina
z pięciu miejsc). Zostaje wyprawianie osadników i „Co zostało" wyżej.

1. ~~`mapa.ts` i generator mapy 40×40, plus `szukanie.ts` (A*)~~
2. ~~`stan.ts`: zapis i odczyt, wersjonowanie~~
3. ~~Scena Phasera: rysowanie mapy, kamera, klikanie w kafelki~~
4. ~~Stawianie budynków i przydział ludzi (plus pętla dzienna i prędkość czasu,
   bez nich kroku 4 nie da się zobaczyć w działaniu)~~
5. ~~Panel „gdzie się korkuje": nieobsadzone miejsca pracy, wyczerpane kręgi,
   bilans dzienny każdego surowca~~
6. ~~Kodeks i duchy~~
7. ~~Balans, dopiero na końcu~~

Po każdym kroku ma się dać uruchomić `npm run dev` i zobaczyć działający efekt.
Nie buduj trzech warstw naraz.
