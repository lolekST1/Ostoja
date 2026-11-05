# Ostoja – pułapki, w które projekt już raz wpadł

> Przeniesione z CLAUDE.md 5.11.2026, żeby nie ładowało się w każdej sesji. Treść bez zmian.

Wszystkie znalezione symulacją, nie zgadywaniem. Nie przywracaj ich.

- **Przybysze, nie narodziny.** Dziecko dorasta 16 lat, sesja trwa 5. Przyrost
  naturalny dodaje gęby, nie ręce, i osada dusi się przy dziesięciu dorosłych.
- **Chata kosztuje same drewno.** Gdy wymagała cegieł, powstawała blokada nie do
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
  kosztowała 4 cegły przy 20 na starcie i wyglądało to bezpiecznie. Domowik zjadał
  wtedy do 8% magazynu dziennie (dziś sufit to 5%, `udzialMaks`), więc zanim osada do niej dochodziła, zostawało 3,99 —
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
- **Stopień nie może przeciąć łańcucha produkcyjnego w pół.** Piekarnia była
  budynkiem grodowym, a pole i młyn osadowym — więc przez cały drugi stopień
  gracz stawiał dwa budynki i dwie pary rąk po to, żeby mąka rosła w spiżarni
  i nie robiła nic. Mąka ma dokładnie jednego odbiorcę. Brama wolno przeciąć
  **między** łańcuchami, nigdy w środku jednego. Pilnuje tego teraz
  `narzedzia/kraina.ts` (sekcja „łańcuchy a stopnie"): dla każdego surowca
  liczy, na którym stopniu powstaje i na którym ma pierwszego odbiorcę.
  Ujścia spoza receptur — jedzenie na osadnika, opowieści na ulepszenia —
  są w tym teście wypisane ręcznie, bo graf receptur ich nie widzi.
- **Miska domowika nie może wymagać czegoś spoza stopnia.** Póki miska brała
  wyłącznie chleb, a chleb wychodził tylko z piekarni grodowej, osada na Polanie
  dostawała komunikat „domowik podebrał" codziennie przez pół gry i nie mogła
  z tym zrobić **nic**. Miska bierze teraz jedzenie, nie bochenek — jagody też
  są strawą, i tak było w wierzeniach. Duch nadal kradnie z pustej spiżarni.
- **„Postaw miskę w kapliczce" opisywało czynność, której nie ma.** Miski się
  nie stawia: jest wtedy, gdy stoi kapliczka i w spiżarni coś leży. Dziecko
  szukało guzika, którego nigdzie nie było — to ta sama rodzina błędów co
  „weź «wóz i ścieżki»" bez listy ulepszeń.
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
