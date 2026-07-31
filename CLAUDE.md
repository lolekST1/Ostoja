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
> zapasów nie robi, zostaje na Polanie na zawsze.
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
  Zanim doszły zapasy na zimę, warunki z etapu 5 („stoi kapliczka", „zawarte
  przymierze") kompetentny gracz spełniał tak wcześnie, że o awansie decydował
  kalendarz: na wszystkich ośmiu ziarnach stopień 2 w dniu 95, stopień 3 w dniu
  191, co do dnia. Dopiero „przeżyta zima **z zapasami**" to zmieniła — gracz,
  który zapasów nie robi, nie awansuje nigdy. Sprawdzaj to zawsze dwoma
  graczami, bo na jednym oba warunki wyglądają identycznie.
- **Tolerancja przy sprawdzaniu wsadu nie jest kosmetyką.** Glinianka daje
  dokładnie 2 gliny dziennie, cegielnia bierze dokładnie 2 — trafiają w siebie
  co dzień, a suma zmiennoprzecinkowa wypada raz 2.0000000001, raz
  1.9999999999. Bez `- 1e-9` cegielnia stawała w losowe dni, panel obiecywał
  cegłę i wychodziło z tego systematyczne kłamstwo na trzech surowcach naraz.
  Ta sama tolerancja jest przy progu `postep`, bo 1/3 + 1/3 + 1/3 to mniej
  niż jeden i bajarz miał cykl raz trzydniowy, raz czterodniowy.
- **Kara zimowa liczona samą produkcją jest za słaba.** Zimą i tak zbiera się
  mało (zbieracze ×0.2, leśniczówka ×0.5, pola stoją), więc ×0.3 na czymś
  małym daje w liczbach bezwzględnych prawie nic — 9% ludności na koniec.
  Kara musi trafić w to, na czym stoi ta gra, czyli w tempo wzrostu: zerowanie
  wieści i mocne cięcie zadowolenia rozciągają stratę na wiosnę.
- **Wyprawa jest zaworem, nie nawykiem.** Gracz w narzędziu wysyłał bezczynnych
  codziennie — ponad czterysta wypraw na przebieg — i kończył z 65 mieszkańcami
  zamiast 80. „Bezczynny" jesienią to rolnik czekający na żniwa: wysłany nad wodę
  nie wraca na czas i pole stoi puste. Wyprawy wolno wysyłać, gdy czegoś brakuje,
  i nigdy w żniwa. Ta sama pułapka czeka na dziecko, więc panel mówi wprost, ilu
  ludzi stoi bez roboty.
- **Miara „dni bez decyzji" musi znać wyprawy.** Wyprawa jest jedyną rzeczą, którą
  da się zrobić bez surowców na cokolwiek — pominięta w mierze, kazała narzędziu
  raportować „nie ma co robić" w dniu, w którym można wysłać czterech ludzi po
  chrust. Po dopisaniu jej dni bez decyzji spadły z 19% na 5%, i to nie była
  zmiana w grze, tylko w tym, co widzi narzędzie.
- **Brak `stopien` w `budynki.json` otwiera całą grę i nic o tym nie mówi.**
  `STOPNIE.indexOf(undefined)` to −1, czyli „poniżej Polany", więc każdy budynek
  robi się dostępny w dniu pierwszym. Pomiar wygląda wtedy na hojną ekonomię
  (ludność 71–84 zamiast 67–72) i nic nie krzyczy. Kosztowało to jeden pełny
  przebieg ośmiu ziaren, bo `git checkout dane/budynki.json` — cofnięcie próby
  z gajówką — zabrało przy okazji niezacommitowane pole `stopien`. Dlatego
  `budynekDostepny` rzuca wyjątkiem zamiast przepuszczać.
- **Krok planu w narzędziach musi być zbiorem, nie licznikiem.** Odkąd pozycję
  zamkniętą stopniem gracz **pomija**, `krokPlanu++` zamyka nie tę pozycję,
  którą właśnie postawiono, tylko następną w kolejce — plan zjada się od
  środka i narzędzie stawia coś innego, niż raportuje.
- **`przerwaWZniwa()` musi iść po `przestawLudzi()`.** `przestawLudzi` zdejmuje
  wstrzymanie ze wszystkiego, co nie ma nadmiaru, a pole nadmiaru nie ma nigdy.
  Postawiona przed nim przerwa obiadowa kasowała się co do dnia: narzędzie
  „robiło przerwę", a południca i tak zabierała kogoś w każde żniwa i przymierze
  z nią nie padało ani razu na osiem ziaren.
- **Reguła wodnika była graczowi całkiem niewidoczna.** Młyn nad wodą miele
  o połowę szybciej, cegielnia obok zamienia to w klątwę — i nigdzie nie było
  o tym ani słowa, więc przymierze z wodnikiem padało z losowania. Opis młyna
  w menu budowy mówi to teraz wprost, a gracz w `naMapie.ts` szuka wody i omija
  piec, bo inaczej narzędzie mierzy kogoś, kto o wodniku nie usłyszał.
- **Mapa bez drzew nie ma jagód i osada na niej głoduje.** Złote Łany miały
  z założenia być stepem „bez drzew" i na siedmiu ziarnach z ośmiu wyszły
  dobrze — a na ósmym osada skończyła z osiemnastoma ludźmi i czternastoma
  budynkami z dwudziestu ośmiu. Zbieracze biorą z lasu (`zbiera: "las"`), więc
  bez lasu jedynym jedzeniem jest chleb, a chleb wymaga pola, młyna i piekarni,
  czyli trzeciego stopnia. Step ma teraz szesnaście malutkich kęp zamiast
  czterech: z daleka wygląda tak samo, drewna nadal brak, ale jest z czego żyć.
- **Przymierza nie wolno przenosić między mapami krainy.** „Przymierze zawarte
  raz obowiązuje w całej krainie" brzmi niewinnie, dopóki nie sprawdzi się,
  czym przymierze jest w liczbach: leśniczówka daje o drewno więcej, domowik
  przestaje kraść. To trwała premia do produkcji, więc przeniesienie jej dalej
  jest przeniesieniem surowców pod inną nazwą. Do tego otwiera Gród w dniu
  pierwszym trzeciej mapy i zamienia „lubianą przez duchy" w zakończenie za
  samo wczytanie zapisu. Jedzie sama wiedza (`wiedzaDoOsady`), nie premia.
- **Polska odmiana nie da się sklejać w kodzie.** Wzór „Z {nazwa} przyszło
  {co}" dawał „Z Borowa Głusza przyszło starą kobietę" i „Z Złotych Łanów".
  Tabela dopełniaczy w TypeScripcie załatwiła połowę problemu i była smrodem —
  całe zdanie siedzi teraz w `kraina.json`, razem z resztą tekstów.
- **Jeden próg zakończenia na pięć map to pięć różnych gier.** „Bór nie
  mniejszy niż pierwszego dnia" przy trzydziestu drzewach na starcie wygrywa
  jedna gajówka (padało 4 razy na 4), a w borze z ośmiuset nie pada nigdy.
  Progi `ludna` i `borKrotnosc` są liczbami miejsca, nie stałymi gry, i każdy
  jest wzięty z pomiaru ośmiu ziaren na tej właśnie mapie.
- **Ulepszeń nie dało się kupić przez całą pierwszą wersję.** Dane, silnik
  efektów, scena rysująca powiększony krąg po „wozie i ścieżkach", bajarz
  produkujący opowieści — wszystko było, tylko **nie było gdzie kliknąć**.
  Opowieści rosły w spiżarni bez końca. Narzędzia balansujące miały własne
  `kupUlepszenia()`, więc mierzyły ekonomię z ulepszeniami i nic nie zgrzytało;
  gra bez nich chodziła po cichu wolniej i żaden pomiar nie mógł tego zobaczyć.
  Znalazło się dopiero po pytaniu „co to jest wóz i ścieżki, bo nie znalazłem".
  Stąd `kupUlepszenie` w `budynki.ts` — jedna funkcja dla gry i dla narzędzi.
  Gdy dokładasz mechanikę do `sim/`, sprawdź, czy da się do niej dojść myszką.
- **Rada w panelu musi być z rzeczy, po którą gracz może dziś sięgnąć.**
  „Weź «wóz i ścieżki»" przy pustym kręgu to ulepszenie za 32 opowieści, więc
  gracz bez bajarza czytał wskazówkę do czegoś, czego nie ma — a to zasada 10
  z `PLAN.md`. `radaNaPustyKrag` patrzy teraz, co gracz naprawdę ma.
- **Gajówka na dwie osoby: zmierzone i odrzucone.** Miała zetrzeć sprzeczność
  między „z lasem" a „ludną" (jedna osoba równoważy wyrąb czterech). Wyszło na
  odwrót: `nieobsadzoneMiejsca()` rośnie, gracz przestaje stawiać, dni bez
  żadnej sensownej decyzji skaczą z 1–4% na 13–15%, a ludność i las **rosną**
  oba. Nie próbuj tego drugi raz bez zmiany polityki budowania.
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
node --experimental-strip-types narzedzia/naMapie.ts [lata] [ziarno] bezzapasow  # to samo, ale gracz olewa zimę
node --experimental-strip-types narzedzia/podglad.ts [ziarno]          # mapa
node --experimental-strip-types narzedzia/bilans.ts [lata] [ziarno]    # czy panel nie kłamie
node --experimental-strip-types narzedzia/kraina.ts                    # kampania: co się przenosi
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

**Zima odzyskała zęby przez etap 2, ale inaczej niż w pierwszej wersji.** Nie
zabija — zabiera kwartał. Porównanie dwóch graczy na tych samych ośmiu ziarnach:
z zapasami 67–80 mieszkańców na koniec, bez zapasów 64–71. Sama kara ×0.3 na
pracy poza dachem okazała się za słaba (strata 9%), bo zimowa produkcja i tak
jest niska. Dołożone do niej **zerowanie wieści** i **−25 do zadowolenia** dają
stratę rozciągniętą na wiosnę i to dopiero widać.

**Zapasy trzeba mierzyć dwoma graczami, nie jednym.** `naMapie.ts … bezzapasow`
odgrywa gracza, który jedyną decyzję jesieni ignoruje. Bez tego porównania nie
da się odróżnić decyzji od formalności do odklikania — kompetentny gracz robi
zapasy 5 razy na 5 i wygląda to tak samo w obu przypadkach.

**Wyprawy zlikwidowały pat.** Dni bez żadnej sensownej decyzji spadły z 5–21%
na 0–6%, a najdłuższy zastój z 24 dni na 5. Ludność została w przedziale 70–80,
więc zawór nie zjadł gospodarki — a to jest cała zasada 6 z `PLAN.md`: wyprawa
nigdy nie może być lepsza od budynku na osobodzień (leśniczówka daje 2 drewna
na osobodzień, chrust 1.2; zbieracze 1 jagodę, wyprawa 0.7).

**Stopnie osady kosztują ludność, a płacą decyzją.** Osiem ziaren po pięć lat
na `naMapie.ts`: ludność **67–72** zamiast 70–80, plan budowy 28/28 na każdym
ziarnie, dni bez żadnej sensownej decyzji **1–4%** (było 0–6%), najdłuższy
zastój 1–4 dni. Bramy nic nie zamrażają — pozycję zamkniętą stopniem gracz
pomija i wraca do niej po awansie, więc kolejka budowy nigdy nie stoi.

**Awans jest czynem, nie kalendarzem — ale widać to dopiero na drugim graczu.**
Kompetentny gracz wchodzi na Osadę w dniu 95 i na Gród w dniu 191, co do dnia,
na wszystkich ośmiu ziarnach — bo kapliczka stoi na długo przed pierwszą zimą
i wiąże sama zima. Gracz z `bezzapasow` **nie awansuje ani razu przez pięć lat**:
kończy z 45–47 mieszkańcami zamiast 67–72, stawia 16 z 28 pozycji planu i zdobywa
0–1 zakończenia. Nie ginie i nie nudzi się (dni bez decyzji 0–3%) — po prostu
zostaje Polaną. Na jednym graczu obie te bramy wyglądają identycznie.

**Pięć miejsc krainy zmierzone osobno, po osiem ziaren każde.** Plan budowy
28/28 na wszystkich czterdziestu przebiegach, dni bez sensownej decyzji 0–8%,
nigdzie nie ma zastoju dłuższego niż kilka dni. Ludność i las różnią się
mocno i o to chodzi:

| miejsce | ludność | las (koniec z startu) | próg `ludna` | `borKrotnosc` |
|---|---|---|---|---|
| Wierzbnica | 67–72 | 0.89–1.20 | 71 | 1 |
| Borowa Głusza | 50–63 | 0.857–0.878 | 57 | 0.875 |
| Jezierzysko | 67–74 | 1.39–2.07 | 72 | 1.9 |
| Złote Łany | 62–69 | 1.40–2.01 | 68 | 1.75 |
| Kamieniec | 52–60 | 1.02–1.50 | 59 | 1.3 |

Borowa Głusza jest najtrudniejsza ludnościowo (sam bór, łąki jak na lekarstwo)
i tam „zapobiegliwa" pada 6 razy na 8, a nie 8 — na tej mapie na zapasy czasem
nie starcza. Kamieniec 7 na 8, z tego samego powodu plus krótkie lato. Na
każdym miejscu każde z czterech zakończeń pada przynajmniej raz i żadne poza
„zapobiegliwą" nie pada zawsze. Komplet czterech: 3 przebiegi na 40.

**Zakończenia sprintu: 2–3 z czterech, kompletu nie ma nigdzie.** Na ośmiu
ziarnach „z lasem" pada 6 razy, „lubiana przez duchy" 6, „zapobiegliwa" 8,
„ludna" 2 (próg 80 to najwyższy wynik, jaki narzędzie osiąga). Każde zakończenie
pada przynajmniej raz i żadne nie pada zawsze — poza „zapobiegliwą", która jest
nagrodą za konsekwencję i której gracz olewający zimę nie dostaje.

**Ale sprzeczność między zakończeniami jest progowa, nie strukturalna.**
Zakładaliśmy, że rosnąca osada z konieczności zjada las. Nieprawda: przy tej
samej ludności 80 las kończy raz na minusie (ziarno 1: 388 z 397), raz na sporym
plusie (ziarno 31337: 425 z 347). Decyduje rozmieszczenie gajówek, nie wielkość
osady, bo **gajówka jest za tania w ludziach** — jedna osoba równoważy wyrąb
czterech. Komplet nie pada tylko dlatego, że ziarnu z ludnością 80 zabrakło
trzeciego przymierza, a to zależy od mapy. Do rozstrzygnięcia przy etapie 4
albo 5, opisane w `PLAN.md`.

**Etap 5 tego nie rozstrzygnął i próba przez gajówkę wyszła gorzej** (patrz
pułapki). Zostały same progi: `ludna` 80 → **71** i `przymierza` 3 → **4**, bo
po bramach stopni ludność kończy niżej, a przymierza — odkąd przerwa obiadowa
naprawdę działa i młyn stoi nad wodą — są łatwiejsze. Rozkład na ośmiu
ziarnach: „z lasem" 6, „ludna" 3, „lubiana przez duchy" 1, „zapobiegliwa" 8.
Komplet pada na jednym ziarnie (5) i narzędzie samo to wypisuje. To ten sam
komplet co przed etapem 5 — nie regresja, ale i nie naprawa.

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

**`bilans.ts` zgadza się na czterech ziarnach z ośmiu — ale to już inne cztery
i inne surowce niż przed etapem 5.** Gracz w tym narzędziu nie robił zapasów
i nie omijał pozycji zamkniętych stopniem, więc po wprowadzeniu bram stawał na
gliniance i przez pięć lat porównywał martwą osadę z martwą osadą, ogłaszając
zgodność na trzech surowcach z dziesięciu. Po dołożeniu `zrobZapasy` i pomijania
bram sprawdza 10 z 10 na pięciu ziarnach i zgadza się na 1, 42, 777 i 2024.
Rozjazd rozlał się z chleba na drewno, glinę, cegłę i mąkę (0.06–0.16 na dzień
przy progu 0.05) i to jest **stan gorszy niż raportowany wcześniej** — bo
wcześniejszy pomiar dotyczył osady, która stała.

Klasa przyczyn jest ta sama co dla chleba: tick pobiera wsad w chwili, gdy
`postep` rusza z zera, więc warsztat z rozpoczętym cyklem kończy go **bez
wsadu**, a bilans w tym dniu mówi „stoi". Bajarz ma cykl trzydniowy i to on
zostaje. Próba zamodelowania tego wprost („cykl w toku jest opłacony")
rozjechała wszystkie osiem ziaren zamiast czterech, bo warsztat dostawał darmowy
cykl w każdym dniu, a nie raz na cykl — poprawka została cofnięta i jest opisana
w komentarzu w `bilans.ts`. Przed etapem 1 test przechodził na wszystkim, ale
mierzył martwą osadę (patrz pułapka o numeracji placów), więc nie znaczył nic.

Wcześniejsze ustalenia, nadal aktualne: koszt ulepszeń (99 → 178) rozłożył
rozwój na całą sesję. Leszy ma zęby dzięki profilowi sezonowemu gajówki:
chciwemu graczowi (sześć leśniczówek, jedna gajówka) blokuje wyrąb 88–132 dni
na przebieg.

Prawdziwa mapa ma 224–426 drzew, a `symuluj.ts` startuje z 900 — mimo to wynik
pięciu lat wychodzi ten sam. Las na mapie zostaje w okolicy liczby startowej,
bo gajówka sadzi w swoim kręgu, a nie w próżnię.

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
