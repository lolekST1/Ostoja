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

**8. Chodzenie ludzi nie wpływa na produkcję.**
`ruszLudzi()` woła `main.ts` po ticku, nigdy sam tick. Gdyby warsztat czekał na
dojście pracownika, `symuluj.ts` — który mapy nie ma — przestałby mówić prawdę
o bilansie. Ruch jest po to, żeby osada wyglądała na żywą.

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
- **Rzeka potrafi odciąć róg mapy.** Razem ze skałami zamykała nawet 15% lądu
  (las i glinę, po które nikt już nie przyszedł). Generator sprawdza spójność
  wprost i dokopuje korytarz. Nie usuwaj `zapewnijSpojnosc`, bo objaw wraca
  raz na kilka ziaren i wygląda wtedy na „dziwny błąd A*".
- **Zalewanie musi liczyć tak samo jak A*.** Bez zakazu ścinania rogów test
  spójności przechodzi, a ludzie i tak nie przejdą. Stąd wspólna funkcja
  `osiagalneOd` w `mapa.ts` — używa jej i generator, i narzędzie.
- **Osada startuje z drewnem.** Brak opału liczy się jak głód, a przy pustej
  drwalni cała osada odchodzi jedenastego dnia, zanim dziecko zdąży zrozumieć,
  co się stało. Narzędzie tego nie widziało, bo jego plan zawsze stawiał
  leśniczówkę jako drugą. Trzydzieści polan to wiosenny bufor, nie prezent.
- **Budowa w lesie karczuje las i oddaje drewno.** Zakaz stawiania na drzewach
  wyglądał porządnie, a w praktyce dawał „tu nie postawisz" przy co drugim
  kliknięciu: polana startowa ma promień 4 i mieści dokładnie jeden budynek
  ponad to, co już na niej stoi. Wycinka pod budowę liczy się leszemu.
- **Budowy mają pierwszeństwo przed produkcją, ale tylko jeden plac naraz.**
  Bez pierwszeństwa nikt nie idzie budować, bo miejsc pracy zawsze jest więcej
  niż rąk. Bez kolejki sześć budynków naraz zdejmuje z produkcji całą osadę.
- **Gajówka postawiona pod chatami nie robi nic.** Sadzi w swoim kręgu, więc
  musi stać tam, gdzie się wycina. Ustawiona przy osadzie zalesia łąkę w środku
  wsi, leśniczówki ogołacają swój krąg i osada pada w pierwszą zimę.
- **Piekarnia jest opałożerna.** Zjada 2 drewna dziennie. Każda polityka
  „pilnuj opału" musi obejmować ją, nie tylko tartak i cegielnię.
- **Bilans musi liczyć warsztaty po kolei, nie naraz.** Tick przerabia budynki
  w kolejności listy, więc piekarnia stojąca przed młynem używa wczorajszej
  mąki, nie dzisiejszej. Model „wszystko naraz" obiecywał chleb, którego nigdy
  nie było. Tak samo cykl jest niepodzielny: młyn przy 0.7 zboża nie mieli nic.
- **Panel, który zgaduje, jest gorszy niż brak panelu.** `narzedzia/bilans.ts`
  porównuje przewidywania z tym, co naprawdę robi tick. Nie zmieniaj
  `bilans.ts`, nie puszczając go na kilku ziarnach.
- **Południca liczy żniwa, nie lato.** Pola mają obsadę wyłącznie jesienią,
  więc kara „za pracę przez całe lato" nie miała czego dotknąć. I zabiera
  jedną osobę na rok, nie jedną z każdego pola: przy czterech polach robiło
  się z tego wykruszanie osady zamiast jednej zapamiętanej lekcji.
- **Reguły o położeniu liczy świat, nie tick.** Wodnik potrzebuje mapy, a tick
  jej nie zna — stąd opcjonalne `Swiat.mnoznikMiejsca()`. Narzędzie balansujące
  po prostu go nie ma i reguła go nie dotyczy.
- **Przymierze też otwiera wpis w Kodeksie.** W dobrze prowadzonej osadzie leszy
  nigdy się nie gniewa, więc gracz zawierał z nim przymierze, a Kodeks milczał
  o duchu, z którym się właśnie zaprzyjaźnił.
- **Żaden budynek nie może kosztować tego, co sam jako jedyny produkuje.** Cegielnia
  kosztowała 4 cegły przy 20 na starcie i wyglądało to bezpiecznie. Domowik zjada
  do 8% magazynu dziennie, więc zanim osada do niej dochodziła, zostawało 3,99 —
  i koniec, bo cegły robi tylko cegielnia. Sześć ziaren z ośmiu zamierało na
  siódmym budynku. Ta sama rodzina błędów co „chata za cegły".
- **Drewno buduje początek, deski resztę.** Gdy wszystko kosztowało deski, drewno
  było w grze wyłącznie opałem, a osada wychodziła z tego tylko dzięki sześćdziesięciu
  deskom w prezencie startowym. Okrąglaki na chatę, leśniczówkę, gajówkę, zbieraczy,
  gliniankę, pole i tartak; deski dopiero na to, co murowane. Start ma zero desek —
  pierwszy tartak stawia się z okrąglaków i to jest pierwsza prawdziwa decyzja w grze.
- **Postęp budowy liczą obecni, nie przydzieleni.** Plac na drugim końcu mapy bywał
  gotowy, zanim ktokolwiek do niego doszedł. Liczy to opcjonalne
  `Swiat.obecniNaBudowie()` — przez świat, nie przez tick, bo tick mapy nie zna.
  Produkcji to nie dotyczy i dotyczyć nie może (zasada 8). Gdy to zmieniasz,
  pamiętaj, że `naMapie.ts` i `bilans.ts` muszą wołać `ruszLudzi()` po ticku —
  bez tego nikt nigdy nie dochodzi na plac i narzędzie pokazuje osadę, która
  nie postawiła nic, co wygląda na załamanie ekonomii.
- **Ludzie chodzą po zapisanej trasie, nie po prostej do celu.** Symulacja przesuwa
  ich raz na dzień o osiem kafelków i zostawia drogę w `Mieszkaniec.trasa`; scena
  przeprowadza ich nią jednostajnie przez cały dzień. Dociąganie wykładnicze do
  punktu docelowego, które tu kiedyś było, hamuje przed celem i nigdy go nie dobija
  (stąd skok co tick), a do tego przecina rzeki i skały na wylot.
- **Kafelek ma 32 px, bo rysunek ma 64.** Było 16 przy przybliżeniu kamery ×2 —
  na ekranie to samo, ale grafika zbita do 16 i rozciągnięta z powrotem gubi
  połowę kresek. `pixelArt` jest wyłączony: arkusz Kenneya to rysunek
  wektorowy, nie pixel-art, i przy NEAREST wygląda gorzej, nie lepiej.
- **Teren rysuj wsadowo.** `RenderTexture.draw()` po jednym kafelku zamyka
  partię i czeka na kartę graficzną; przy 1600 kafelkach i przerysowaniu za
  każdym ściętym drzewem przeglądarka krztusi się ostrzeżeniami „GPU stall due
  to ReadPixels". `beginDraw()` / `batchDraw()` / `endDraw()` robi to jedną
  partią.
- **Drzwi budynku są u dołu bryły, nie w lewym górnym rogu.** Odkąd budynki są
  rysunkami, wejście jest na obrazku od frontu — ludzie zbierający się przy
  rogu stali dosłownie na dachu. Zmiana dotyka `stoiPrzy` i `obecniNaBudowie`,
  więc obie muszą liczyć ten sam kafelek co `cel()`.
- **Nie pisz graczowi, czego w grze nie ma.** Zasada 6 jest notatką projektową.
  Komunikat „nie ma tu żadnych pytań do odpowiedzenia" podpowiada dziecku, że
  gdzieś mogłyby być, i brzmi jak tłumaczenie się. Kodeks i samouczek mówią,
  co robić, nie czego zabrakło.
- **Dzień trwa 4 sekundy, a osada startuje na pauzie.** Przy dwóch sekundach
  i płynącym starcie surowce znikały, zanim gracz zdążył przeczytać, co robi
  który budynek — czytanie kosztowało jedzenie i opał, których jeszcze nie umiał
  zdobyć. Żadne narzędzie tego nie widziało i widzieć nie mogło: `sekundNaDzien`
  jest wyłącznie w pętli przeglądarki, symulacja liczy dni, nie sekundy. Zmiana
  tempa nie rusza balansu, więc nie trzeba jej przemierzać ośmioma ziarnami.

---

## Balansowanie

```
node --experimental-strip-types narzedzia/symuluj.ts [lata] [ziarno]   # ekonomia
node --experimental-strip-types narzedzia/naMapie.ts [lata] [ziarno]   # ekonomia na mapie
node --experimental-strip-types narzedzia/podglad.ts [ziarno]          # mapa
node --experimental-strip-types narzedzia/bilans.ts [lata] [ziarno]    # czy panel nie kłamie
```

`naMapie.ts` puszcza tę samą ekonomię po kafelkach i widzi to, czego liczniki
nie widzą: wyczerpany krąg leśniczówki, wybrane złoże gliny, las, który nie
puchnie do dwóch tysięcy drzew. Gdy oba narzędzia się rozjadą, prawdę mówi to.
Trzeci argument `dziennik` dopisuje wpis co osiem dni — do szukania dnia,
w którym coś się załamało.

Zmieniasz liczby w `dane/`, puszczasz na kilku ziarnach, patrzysz na ludność,
dni głodu i liczbę wykupionych ulepszeń. Nigdy nie balansuj przez granie
w przeglądarce, bo rok trwa tam trzy minuty.

**Stan na dziś: balans domknięty, po rozdzieleniu drewna i desek.** Osiem
ziaren po pięć lat na `naMapie.ts`: ludność 10 → 31–46, zero dni głodu, zero
dni bez opału, zero odejść, 6–8 ulepszeń z ośmiu, plan budowy 28/28 na każdym
ziarnie. `symuluj.ts` daje 33–40, `bilans.ts` zgadza się z tickiem. Przejście
kosztów na okrąglaki i czekanie na budowniczych nie ruszyło wyniku — wcześniej
było 29–45, dni głodu 0–10. Południca kosztuje jeden dzień żniw rocznie (przerwa
obiadowa), stąd ludność niżej niż przed jej dołożeniem (32–49) — to cena
mechaniki, nie regres.

Gracz, który przerwy nie robi, traci jedną osobę na rok: ludność spada wtedy
do 25–36. Panel ostrzega w połowie żniw, więc jest to kara za zignorowanie
ostrzeżenia, nie za niewiedzę.

**Krok 7 nie zmienił ani jednej liczby w `dane/` — i to jest wynik, nie
zaniechanie.** Pomiar nie wskazał niczego, co wymagałoby przekręcenia. Zmieniło
się natomiast narzędzie: jego „gracz" umie teraz to, co potrafi człowiek
czytający panel z kroku 5.

**Plateau ludności nie istnieje.** To był artefakt planu budowy: narzędzie
stawiało cztery chaty i ani jednej więcej, więc osada dobijała do sufitu
mieszkaniowego (7 chat × 6 osób = 42) i wyglądało to na granicę ekonomii. Gracz,
który dokłada chatę, gdy nie ma gdzie mieszkać, rośnie dalej: 46–53 osób w ósmym
roku. W pięcioletniej sesji ludność **rośnie do samego końca** i tak ma być —
gra kończy się, zanim skończy się rozwój.

**Panel „gdzie się korkuje" daje się zmierzyć.** Gracz reagujący na wiersz
„w kręgu nie ma już nic" (nowy budynek na innym złożu) skraca czas martwego
budynku z 202 do 80 dni na ziarnie 1234 i z 311 do 296 na ziarnie 8.

**Martwa glinianka to brak mechaniki, nie zły balans.** Gliny na mapie jest
2000+ jednostek przy zapotrzebowaniu rzędu 150, a mimo to na części ziaren
glinianka stoi z pustym kręgiem kilkadziesiąt do trzystu dni. Postawionego
budynku nie da się rozebrać, więc jedyne, co zostaje, to postawić drugi.
Liczbami się tego nie naprawi — patrz „Co zostało".

Wcześniejsze ustalenia, nadal aktualne: pojemność magazynu i opał zimą nie
ruszają gry kompetentnego gracza (zero odejść nawet przy opale ×6), a próg
przybyszów `zapasNaDziecko` jest urwiskiem — powyżej 30 połowa ziaren zamiera.
Koszt ulepszeń (99 → 178) i wolniejszy napływ przybyszów (`szansaNaDziecko`
0.02 → 0.015) rozłożyły rozwój na całą sesję. Leszy ma zęby dzięki profilowi
sezonowemu gajówki: chciwemu graczowi (sześć leśniczówek, jedna gajówka)
blokuje wyrąb 88–132 dni na przebieg.

Prawdziwa mapa ma 224–426 drzew, a `symuluj.ts` startuje z 900 — mimo to wynik
pięciu lat wychodzi ten sam. Las na mapie zostaje w okolicy liczby startowej,
bo gajówka sadzi w swoim kręgu, a nie w próżnię.

---

## Co zostało

Pierwsza wersja z sekcji 10 OSTOJA.md jest kompletna. Rzeczy świadomie
niezrobione:

1. **Zderzenie z dzieckiem.** Kryterium z sekcji 10: dziecko siada, gra
   dwadzieścia minut i samo mówi „jeszcze raz". Tego nie zmierzy żadne
   narzędzie i żadna symulacja.

Zrobione po kroku 7: rozbiórka budynku, południca i wodnik, a po pierwszym
prawdziwym zagraniu — wolniejsze tempo, start na pauzie i samouczek.

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

Zrobione: 1, 2, 3, 4, 5, 6, 7. Pierwsza wersja gotowa — dalsze prace
patrz „Co zostało" na końcu tego pliku.

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
