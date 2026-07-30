# Ostoja — zasady pracy nad projektem

Gra strategiczna o budowaniu słowiańskiej osady. Bez walki. Dla dzieci.
Pełny opis projektu: `OSTOJA.md`. Przeczytaj go, zanim cokolwiek napiszesz.

> **Trwa przepisywanie ekonomii. Zanim cokolwiek ruszysz, przeczytaj `PLAN.md`.**
> Etap 1 jest zrobiony: **nic się już nie zużywa samo z siebie**. Zasoby są ceną
> czynu, nie podatkiem od istnienia; jedzenie jest ceną nowego osadnika i niczym
> więcej; nikt nie odchodzi z osady poza starością. Dalej idą etapy 2–6:
> zapasy na zimę, nazwane zakończenia po pięciu latach, wyprawy, stopnie osady
> i kampania z duchami w osi.

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

---

## Pułapki, w które ten projekt już raz wpadł

Wszystkie znalezione symulacją, nie zgadywaniem. Nie przywracaj ich.

- **Przybysze, nie narodziny.** Dziecko dorasta 16 lat, sesja trwa 5. Przyrost
  naturalny dodaje gęby, nie ręce, i osada dusi się przy dziesięciu dorosłych.
- **Chata kosztuje same deski.** Gdy wymagała cegieł, powstawała blokada nie do
  rozplątania: brak miejsc → brak ludzi → nikt nie obsadzi cegielni → brak cegieł.
- **Jedzenie to jagody i chleb razem.** Każdy warunek dotyczący zapasu jedzenia
  musi liczyć `JADALNE`, nie sam chleb. Osada na zbieractwie też ma prawo rosnąć.
  Po etapie 1 dotyczy to ceny osadnika, nie konsumpcji — konsumpcji nie ma.
- **Domowik kradnie kwotę, ale z sufitem od dołu.** Procent liczony od
  nieopróżnianego magazynu rósł razem z nim i robił z domowika jedynego
  przeciwnika w grze. Sama kwota jest jednak łagodna dla bogatych i zabójcza dla
  biednych — dokładnie na odwrót, niż ma być: osada z dwudziestoma polanami
  traciła je w dwa dni i nie miała już jak uzbierać na kapliczkę, czyli na
  jedyne wyjście z tej pętli. Sześć ziaren z ośmiu zamierało na piątym budynku.
  Stąd `udzialMaks`: kwota, ale nigdy więcej niż ułamek magazynu.
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
- **Osada startuje z drewnem.** Nie jako opał — opału nie ma — tylko jako
  budulec na pierwsze cztery budynki. Sto dziesięć polan to dość, żeby zdążyć,
  za mało, żeby nie liczyć.
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
- **Piekarnia jest drewnożerna.** Zjada 2 drewna dziennie — jako wsad do
  receptury, nie na opał. Każda polityka „pilnuj drewna" musi obejmować ją,
  nie tylko tartak i cegielnię.
- **Rezerwa drewna liczona sztywną liczbą zatrzaskuje grę.** „Wstrzymaj
  drewnożerne, gdy drewna mniej niż czterdzieści" wygląda rozsądnie i wywraca
  przebieg na amen: następna w planie jest kapliczka za deski i cegły, desek nie
  ma, bo tartak stoi, a tartak stoi, bo pilnujemy drewna. Rezerwa musi iść
  z kosztu tego, po co gracz właśnie sięga — przy kapliczce wynosi zero.
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
- **Panel nie może obiecać tego samego lasu dwa razy.** Dwie leśniczówki
  postawione dwa kafelki od siebie mają kręgi nałożone niemal w całości.
  `zasobWZasiegu` mówi każdej z osobna „masz z czego brać", więc bilans
  przewidywał dziesięć drewna, a tick dowoził cztery: pierwsza zbierała
  najbliższe pniaki, druga trafiała na pustkę. W tabeli „drewna przybywa 3
  dziennie", w magazynie ubywa 2. Stąd `rozdzielZbiory` w `swiat.ts` — jedna
  funkcja rozdziela zasób po kolei, tak jak tick, i nie rusza mapy.
- **Bilans musi liczyć żniwa po warsztatach, a domowika na puli po produkcji.**
  W ticku żniwa są krokiem czwartym: młyn miele wczorajsze zboże, nie to
  zwiezione dziś po południu. Domowik chodzi po magazynie wieczorem, więc
  „najgrubsza kupka" to ta z dzisiejszymi deskami, nie z porannymi.
- **Numeruj place budowy od stu.** `nowaGra` rozdaje budynkom startowym `b_0`
  i dalej. Plac o tym samym identyfikatorze podszywa się pod chatę: budowniczy
  ma wpisane miejsce pracy `b_0`, stoi w drzwiach chaty `b_0`, a
  `obecniNaBudowie` liczy zero i plac nie rusza ani o procent. `narzedzia/
  bilans.ts` miał ten błąd od zawsze i przez to porównywał bilans martwej osady
  z tickiem martwej osady, po czym ogłaszał zgodność. `naMapie.ts` zaczyna od
  stu i dlatego działał.
- **Osadnik przychodzi bez losowania.** Wieść o osadzie rośnie codziennie tym
  szybciej, im wyżej zadowolenie, i przy jedynce przychodzi człowiek. Dzięki
  temu panel może obiecać „osadnik za trzy dni" i tego dowieźć. Wieść ma sufit
  na jedynce: bez niego osada z pustą spiżarnią odrabiałaby zaległości czwórką
  ludzi w dniu, w którym wreszcie stanie ją na jednego.
- **Kosztu osadnika nie wolno rozsmarować po dniach.** Jedzenie schodzi skokiem:
  przez siedem dni z ośmiu przybywa, a ósmego znika sto sztuk naraz.
  Amortyzacja dawała graczowi „chleb −40 dziennie" w dniu, w którym chleba
  przybywało — liczbę kłamiącą siedem razy na osiem. Tempo osobno, zdarzenie
  osobno: osadnik ma własny wiersz w panelu.
- **Bramy stopni oparte na „czynie" trzeba sprawdzić, czy czyn jest trudny.**
  Warunki z etapu 5 („stoi kapliczka", „zawarte przymierze") są spełniane przez
  kompetentnego gracza tak wcześnie, że o awansie decyduje kalendarz: na
  wszystkich ośmiu ziarnach stopień 2 wypada w dniu 95, a stopień 3 w dniu 191,
  co do dnia. Zanim stopnie zaczną cokolwiek blokować, muszą dostać warunek,
  którego nie da się minąć mimochodem.
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

Zmieniasz liczby w `dane/`, puszczasz na kilku ziarnach, patrzysz na krzywą
ludności, zadowolenie i dni bez decyzji. Nigdy nie balansuj przez granie
w przeglądarce, bo rok trwa tam trzy minuty.

**Miary są nowe, bo stare przestały cokolwiek znaczyć.** Dni głodu i odejścia
są po etapie 1 zerowe *z definicji* i narzędzie chwaliłoby każdą konfigurację,
w tym nudną. `narzedzia/miary.ts` liczy zamiast tego: ile dni gracz nie miał
żadnej sensownej decyzji, ile razy osada stanęła (nie stać na nic i nic się nie
buduje), w którym dniu weszła na drugi i trzeci stopień, oraz ludność
i zadowolenie **w funkcji czasu**, nie tylko na koniec.

„Sensowna decyzja" jest definiowana przez narzędzie, nie przez `miary.ts` —
„stać mnie na cokolwiek z listy" jest prawdą prawie zawsze (chata za dwadzieścia
okrąglaków) i nie mierzy niczego. Liczy się „stać mnie na to, po co właśnie
sięgam", czyli `czegoChce()` w obu narzędziach.

**Stan na dziś: etap 1 zmierzony.** Osiem ziaren po pięć lat na `naMapie.ts`:
ludność 10 → 62–80, zadowolenie na koniec 45–90, dni bez decyzji 3–18%,
zastoje 2–12 na przebieg, najdłuższy 4–21 dni, plan budowy 28/28 na każdym
ziarnie, zero dni z pełnym magazynem powyżej 8%. Krzywa ludności rośnie do
ostatniego roku na wszystkich ziarnach (typowo 23 → 36 → 51 → 65 → 78).
`symuluj.ts` daje 87 przy nieskończonym lesie i to jest znana różnica — prawdę
mówi `naMapie.ts`.

Dla porównania, przed etapem 1: ludność 31–46, zero dni głodu, zero odejść.
Podwojenie ludności jest skutkiem usunięcia konsumpcji, nie przekręcenia liczb —
jedzenie, które dawniej znikało na utrzymanie, jest teraz w całości ceną wzrostu.

**Koszt osadnika to główne pokrętło.** `osadnik.wykladnik` 1.6 daje 15 jedzenia
przy dziesięciu mieszkańcach, 87 przy trzydziestu i 435 przy osiemdziesięciu.
Powyżej pewnego progu hamulcem robi się pojemność magazynu — i tak ma być, bo
magazyn jest wtedy tanim, czytelnym zaworem („chcesz więcej ludzi, potrzebujesz
większej spiżarni"). Wykładnika nie ruszałem, bo pomiar nie wskazał potrzeby:
krzywa nie ma plateau, a zastoje są krótkie.

**Zima straciła zęby i to jest oczekiwane.** Bez konsumpcji zima to tylko
martwe pola, słabsze zbieractwo i gajówka, która nie sadzi. Zwraca jej znaczenie
etap 2 (zapasy na zimę) — do tego czasu jedyną karą jest „chuda zima" w
zadowoleniu.

**Plateau ludności nie istnieje.** To był artefakt planu budowy: narzędzie
stawiało cztery chaty i ani jednej więcej, więc osada dobijała do sufitu
mieszkaniowego i wyglądało to na granicę ekonomii. Gracz, który dokłada chatę,
gdy nie ma gdzie mieszkać, rośnie dalej. W pięcioletniej sesji ludność **rośnie
do samego końca** i tak ma być — gra kończy się, zanim skończy się rozwój.

**Panel „gdzie się korkuje" daje się zmierzyć.** Gracz reagujący na wiersz
„w kręgu nie ma już nic" (nowy budynek na innym złożu) skraca czas martwego
budynku z 202 do 80 dni na ziarnie 1234 i z 311 do 296 na ziarnie 8.

**Martwa glinianka to brak mechaniki, nie zły balans.** Gliny na mapie jest
2000+ jednostek przy zapotrzebowaniu rzędu 150, a mimo to na części ziaren
glinianka stoi z pustym kręgiem kilkadziesiąt do trzystu dni. Postawionego
budynku nie da się rozebrać, więc jedyne, co zostaje, to postawić drugi.
Liczbami się tego nie naprawi — patrz „Co zostało".

**`bilans.ts` zgadza się na czterech ziarnach z ośmiu i to jest stan do
poprawienia, nie do przemilczenia.** Zostaje systematyczny odchył 0.07–0.28 na
dzień (przy progu 0.05) na ziarnach 1, 777, 2024 i 31337 — na chlebie, glinie,
cegle i zbożu. Klasa przyczyn jest ustalona: tick pobiera wsad w chwili, gdy
`postep` rusza z zera, więc warsztat z rozpoczętym cyklem kończy go **bez
wsadu**, a bilans w tym dniu mówi „stoi". Próba zamodelowania tego wprost
(„cykl w toku jest opłacony") rozjechała wszystkie osiem ziaren zamiast czterech,
bo warsztat dostawał darmowy cykl w każdym dniu, a nie raz na cykl — poprawka
została cofnięta i jest opisana w komentarzu w `bilans.ts`. Przed tą sesją test
przechodził na wszystkim, ale mierzył martwą osadę (patrz pułapka o numeracji
placów), więc nie znaczył nic.

Wcześniejsze ustalenia, nadal aktualne: koszt ulepszeń (99 → 178) rozłożył
rozwój na całą sesję. Leszy ma zęby dzięki profilowi sezonowemu gajówki:
chciwemu graczowi (sześć leśniczówek, jedna gajówka) blokuje wyrąb 88–132 dni
na przebieg.

Prawdziwa mapa ma 224–426 drzew, a `symuluj.ts` startuje z 900 — mimo to wynik
pięciu lat wychodzi ten sam. Las na mapie zostaje w okolicy liczby startowej,
bo gajówka sadzi w swoim kręgu, a nie w próżnię.

---

## Co zostało

Dalsze prace prowadzi **`PLAN.md`** — etapy 2–6. Poza nim zostaje:

1. **Zderzenie z dzieckiem.** Kryterium z sekcji 10: dziecko siada, gra
   dwadzieścia minut i samo mówi „jeszcze raz". Tego nie zmierzy żadne
   narzędzie i żadna symulacja.
2. **Domknąć `bilans.ts`.** Cztery ziarna z ośmiu wciąż pokazują systematyczny
   odchył — przyczyna jest ustalona (warsztat kończący opłacony cykl), lekarstwo
   nie. Dopóki to stoi, każdą zmianę w `src/sim/bilans.ts` trzeba mierzyć na
   wszystkich ośmiu ziarnach, a nie na jednym.
3. **Martwa glinianka.** Gliny na mapie jest 2000+ jednostek przy
   zapotrzebowaniu rzędu 150, a mimo to na części ziaren glinianka stoi
   z pustym kręgiem kilkadziesiąt do trzystu dni. Liczbami się tego nie naprawi:
   to brak mechaniki, nie zły balans.
4. **Blokada leszego zaczęta jesienią nie ma prawa puścić przed wiosną**, bo
   gajówka zimą sadzi zero. Po etapie 1 nie jest to już wyrok (osada nie umiera,
   tylko stoi), ale wciąż jest pułapką bez wyjścia. Rozwiązuje ją etap 4:
   wyprawa po chrust, która nie ścina drzew.

Zrobione po kroku 7: rozbiórka budynku, południca i wodnik, po pierwszym
prawdziwym zagraniu — wolniejsze tempo, start na pauzie i samouczek, a po nim
etap 1 z `PLAN.md`: koniec zużycia, zadowolenie, osadnik za jedzenie.

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

Zrobione: 1, 2, 3, 4, 5, 6, 7 — pierwsza wersja — oraz etap 1 z `PLAN.md`.
Dalsze prace: etapy 2–6 z `PLAN.md` i „Co zostało" wyżej.

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
