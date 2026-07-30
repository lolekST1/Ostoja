# Ostoja — fundament projektu

Gra o budowaniu słowiańskiej osady. Bez walki, z pełnymi łańcuchami produkcyjnymi i duchami lasu jako warunkami brzegowymi gospodarki.

Wersja 5, po etapach 1–4 z `PLAN.md` — **nic nie zużywa się samo z siebie**, a jesień ma jedną decyzję: zapasy na zimę. Liczby w tym dokumencie zostały sprawdzone symulacją (`narzedzia/`), nie wymyślone — na ośmiu ziarnach, dwoma niezależnymi narzędziami. Sekcja 12 opisuje, co pokazały, łącznie z tym, w czym wcześniejsze wersje tego dokumentu się myliły.

---

## 1. Czym to jest w jednym akapicie

Prowadzisz osadę przez kolejne lata. **Nic nie zużywa się samo z siebie** — zasoby są ceną czynu, nie podatkiem od istnienia (patrz `PLAN.md`, etap 1). Jedzenie jest ceną nowego osadnika i niczym więcej: zaczyna się od zbieractwa, które daje mało, ale od pierwszego dnia, i przechodzi w rolnictwo, które daje dużo, ale raz w roku. Każdy człowiek jest przypisany do jednego budynku, a rąk jest zawsze mniej niż miejsc pracy. Nie ma wrogów i **nikt nie odchodzi z osady poza starością**. Napięcie robi rosnący koszt kolejnego osadnika, pojemność spiżarni i duchy, które nie atakują, tylko zmieniają zasady. Wygrywasz przez rozrost i przez to, co zostawiasz po sobie na mapie.

Docelowa sesja: 20–30 minut, czyli **dokładnie pięć lat w grze** — po nich przychodzi ekran podsumowania z nazwanymi zakończeniami. To jest zegar całej gry: bez końca sprintu usunięcie zużycia surowców zamieniłoby Ostoję w piaskownicę, w której czekanie jest darmowe, a każda kara mierzona czasem przestaje być karą.

---

## 2. Model surowców

Wspólna pula liczb, jak w Age of Empires. Nie ma transportu towarów między budynkami: budynek pobiera z puli i oddaje do puli.

| Surowiec | Skąd | Do czego |
|---|---|---|
| drewno | leśniczówka | budowle z okrąglaków, deski, cegły, piekarnia |
| deska | tartak | budowle murowane i precyzyjne |
| glina | glinianka | cegły |
| cegła | cegielnia | młyn, piekarnia, kapliczka |
| jagody | chata zbieraczy | jedzenie, od pierwszego dnia |
| ryba | wyprawa nad wodę | jedzenie, równo przez cały rok |
| zboże | pole (żniwa jesienią) | mąka |
| mąka | młyn | chleb |
| chleb | piekarnia | jedzenie, bajarz |
| opowieść | bajarz | ulepszenia |

Jedzenia są trzy i wydają się w kolejności: **najpierw jagody, potem ryby, na końcu chleb**. Jagody się psują i nie da się ich odłożyć na zimę, chleb owszem — to jest cała różnica między zbieractwem a rolnictwem sprowadzona do jednej reguły. Ryba leży pośrodku: nie rośnie z niej żaden łańcuch, ale bierze równo przez cały rok, także wtedy, gdy pola stoją, a las jest pod śniegiem.

Pula ma limit pojemności: pierwszy magazyn 200 sztuk każdego surowca, każdy kolejny dokłada 200. Nadwyżka ponad limit przepada. Opowieści limitu nie mają.

**Świadoma decyzja:** jedna globalna pula zamiast magazynów lokalnych. To główny kompromis wobec Settlersów, bo odbiera znaczenie odległości między warsztatami. W zamian nie ma kodu logistycznego, który zwykle zabija takie projekty. Rozmieszczenie działa przez promienie zbioru i regułę wodnika.

---

## 3. Model danych

TypeScript. Pełne definicje w `src/sim/typy.ts`, tu tylko rzecz najważniejsza:

```ts
type Surowiec = "drewno" | "deska" | "glina" | "cegla"
              | "jagody" | "ryba" | "zboze" | "maka" | "chleb" | "opowiesc";
type Pula = Record<Surowiec, number>;
```

Nazwy surowców są typem, nie napisem, więc literówka w `"maka"` nie kompiluje się zamiast po cichu psuć bilans w trzecim roku.

Trzy główne obiekty: `Budynek`, `Mieszkaniec`, `Kafelek`. Ludzie chodzą naprawdę, z A* po siatce, ale tylko rano do pracy, wieczorem do domu i po surowce w budynkach zbierających. Warsztaty nie generują ruchu.

Jedno drzewo to **10 jednostek drewna**. Przy tej wartości jedna gajówka utrzymuje bilans dwóch leśniczówek. Przy pięciu trzeba było gajówki na każdą leśniczówkę i leszy blokował wyrąb bez przerwy.

---

## 4. Tick symulacji

Jeden tick = jeden dzień = **4 sekundy realne** przy prędkości 1×. Rok ma 96 dni (4 pory × 24), czyli 6 minut 24 sekundy. Gracz przełącza 1× / 2× / 4× i pauzę.

Osada **startuje na pauzie**. Pierwsze zetknięcie z grą polega na czytaniu opisów budynków, a przy płynącym czasie kosztowało to jedzenie i opał, zanim dziecko zdążyło się dowiedzieć, skąd je brać. Po etapie 1 czytanie nie kosztuje już nic — pauza na starcie zostaje, bo spokój na początku jest wart tyle samo.

Tempo jest wyłącznie sprawą przeglądarki — `sekundNaDzien` nie wchodzi do symulacji, więc jego zmiana nie rusza balansu. Narzędzia z `narzedzia/` liczą dni, nie sekundy.

Kolejność kroków ma znaczenie i nie należy jej zmieniać bez powodu:

1. **Czas.**
2. **Przydział pracy.** Przeliczany codziennie, dzięki czemu rolnicy poza sezonem sami wracają do puli wolnych robotników. Zaraz po nim **dniówka na budowach**: zużywa wyłącznie ręce, bo surowce zeszły z puli już przy zakładaniu placu, więc nie rusza niczego w dalszej kolejności.
3. **Zbieranie z mapy.** Leśniczówka, glinianka, zbieracze, gajówka.
4. **Produkcja warsztatów** z rezerwacją wejść.
5. **Żniwa**, tylko jesienią.
6. **Zadowolenie.** Liczone po produkcji, bo to, co osada dziś wyrobiła, ma się liczyć jeszcze dziś.
7. **Ludność.** Starzenie, śmierć ze starości, przybysze (wieść, dach, jedzenie na drogę).
8. **Duchy.**
9. **Render.**

Kroku konsumpcji **nie ma i nie będzie**. Stał tu kiedyś jako punkt szósty i był
źródłem trzech wad naraz: podatku od istnienia, rozwoju z minusem i śmierci
zsynchronizowanej co do dnia. Sekcja 1 `PLAN.md` opisuje, jak to wyglądało.

Rezerwacja wejść w kroku 4 jest ważna. Bez niej dwie piekarnie przy jednej porcji mąki obie ruszą cykl i pula zejdzie poniżej zera.

**Zbieranie wyczerpujące a niewyczerpujące.** Leśniczówka wycina drzewo i to liczy się leszemu jako wycinka. Zbieracze tylko obchodzą las i niczego nie zużywają. Rozróżnia to pole `wyczerpuje` w definicji budynku.

---

## 5. Łańcuchy i liczby

Wszystkie liczby siedzą w `dane/budynki.json` i `dane/stale.json`, nie w kodzie.

| Budynek | Miejsca | Wejście | Wyjście | Dni na cykl |
|---|---|---|---|---|
| chata zbieraczy | 2 | las w promieniu 5 | 2 jagody | 1 |
| leśniczówka | 2 | drzewa w promieniu 6 | 4 drewno | 1 |
| gajówka | 1 | — | sadzi 1 drzewo | 1 |
| tartak | 1 | 2 drewno | 1 deska | 0.5 |
| glinianka | 2 | glina w promieniu 4 | 2 glina | 1 |
| cegielnia | 1 | 2 glina + 1 drewno | 1 cegła | 1 |
| pole (4×4) | 1 | — | 200 zboża w żniwa | tylko jesień |
| młyn | 1 | 2 zboże | 1 mąka | 0.5 |
| piekarnia | 1 | 1 mąka + 1 drewno | 3 chleb | 0.5 |
| bajarz | 1 | 3 chleb | 1 opowieść | 3 |

Koszty budowy: chata 20 drewna; tartak 24; leśniczówka, gajówka 12; zbieracze 8; glinianka 8; pole 6; magazyn 10 drewna + 12 desek; cegielnia 10 + 10; kapliczka 6 desek + 10 cegieł; bajarz 10 + 6; piekarnia 12 + 12; młyn 14 desek + 8 cegieł.

**Drewno buduje początek, deski budują resztę.** Wcześniej wszystko kosztowało deski i drewno wyglądało w grze na surowiec wyłącznie opałowy — leśniczówka dawała coś, czego nie dało się w nic zamienić bez tartaku, a tartak też kosztował deski. Osada wychodziła z tego tylko dlatego, że dostawała sześćdziesiąt desek na starcie. Teraz okrąglaki wystarczają na chałupę, szopę i płot, a tartak przeciera je na deski, bez których nie ruszy nic murowanego. Nazwa surowca mówi wreszcie to, co znaczy.

**Chata kosztuje same drewno.** Gdy wymagała cegieł, powstawała blokada nie do rozplątania: brak miejsc do mieszkania, więc brak ludzi, więc nikt nie obsadzi cegielni, więc nie ma cegieł na chatę. Cegły bramkują młyn i piekarnię, nie dach nad głową.

**Cegielnia nie kosztuje cegieł, i to nie jest kosmetyka.** Kosztowała cztery, na starcie leżało dwadzieścia i wyglądało to bezpiecznie. Domowik podbiera z magazynu codziennie, więc zanim osada dochodziła do cegielni, zostawało niecałe cztery — a wtedy nie ma już żadnego wyjścia, bo cegły robi wyłącznie cegielnia. Sześć ziaren z ośmiu stawało w miejscu na siódmym budynku. Ta sama pułapka co „chata za cegły", tylko o jeden budynek dalej: **żaden budynek nie ma prawa kosztować tego, co sam jako jedyny produkuje.**

Start: 10 dorosłych, 3 chaty, 1 magazyn, 110 drewna, 20 cegieł, 40 chleba, 30 jagód. Desek zero — pierwszy tartak trzeba postawić z okrąglaków.

**Drewno na starcie jest tam po coś.** Sto dziesięć polan to budulec na pierwsze cztery budynki: dość, żeby zdążyć, za mało, żeby nie liczyć. Opałem drewno było w pierwszej wersji ekonomii — wtedy pusta drwalnia znaczyła utratę całej osady jedenastego dnia. Dziś drewno nie znika samo, więc jego brak zatrzymuje budowę, a nie życie.

### Budowa

Budynek nie pojawia się gotowy. Gracz płaci surowce od razu, ale na placu budowy musi stanąć człowiek i przepracować swoje dniówki (`dniBudowy` w `dane/budynki.json`, od 3 dla chaty zbieraczy do 9 dla młyna i piekarni). Rozbudowa kosztuje więc to, czego w osadzie brakuje najbardziej — ręce — a nie tylko surowce leżące w magazynie.

**Postęp naliczają tylko ci, którzy doszli.** Plac budowy założony na drugim końcu mapy potrafił być gotowy, zanim ktokolwiek go zobaczył — budowa liczyła przydzielonych, nie obecnych. Teraz liczy obecnych, przez opcjonalne `Swiat.obecniNaBudowie()`. Idzie to przez świat, nie przez tick, z tego samego powodu co reguła wodnika: tick mapy nie zna. Produkcji to nie dotyczy i dotyczyć nie może (zasada 8) — warsztat czekający na dojście pracownika odebrałby narzędziu balansującemu prawo do mówienia o bilansie. Budowa jest inna: zdarza się raz na budynek, opóźnia go o dzień lub dwa i nie rusza produkcji dobowej. `naMapie.ts` i `bilans.ts` wołają teraz `ruszLudzi()` po ticku, tak samo jak przeglądarka — bez tego nikt nigdy nie dochodzi na plac i osada nie stawia nic.

**Kolejka zamiast wyścigu.** Naraz pracuje jeden plac budowy, po dwóch ludzi (`budowyNaraz`, `budowniczychNaBudowe` w `dane/stale.json`), i budowy mają pierwszeństwo przed produkcją. Bez pierwszeństwa nikt nigdy nie poszedłby budować, bo miejsc pracy jest w tej grze zawsze więcej niż rąk. Bez kolejki dziecko, które postawi sześć budynków naraz, zdejmuje z produkcji całą osadę i nie rozumie, dlaczego wszystko stanęło. Z kolejką koszt rozbudowy jest zawsze taki sam i widoczny: dwie pary rąk.

**Budowa w lesie karczuje las i oddaje drewno.** Polana startowa ma promień czterech kafelków i po odjęciu trzech chat z magazynem zostaje na niej miejsce na jeden budynek. Zakaz stawiania na drzewach oznaczał w praktyce „tu nie postawisz" przy co drugim kliknięciu. Teraz drzewa spod bryły idą pod topór, drewno wpada do puli, a leszy liczy to jako wycinkę — bo to jest wycinka. Złoża gliny to nadal wyjątek: zabudowane, przepadają bezpowrotnie i nikt tego nie odzyska.

**Zwinięcie placu budowy zwraca surowce w całości.** Dziesięciolatek postawi chatę w złym miejscu i ma to móc cofnąć bez kary.

**Ukończony budynek da się rozebrać za połowę kosztu** (`zwrotZRozbiorki`). Doszło to po kroku 7, bo pomiar pokazał martwą gliniankę stojącą nawet trzysta dni na wyczerpanym złożu — bez rozbiórki jedynym wyjściem było postawić drugą i zostawić pierwszą jako pomnik. Rozbiórka wymaga dwóch kliknięć, a magazyn zabiera ze sobą swoją pojemność: nadwyżka ponad nowy limit przepada, tak samo jak przepada nadwyżka produkcji.

### Moduł chlebowy

**Dwa pola, młyn, piekarnia. Cztery osoby.**

Młyn robi 2 mąki dziennie, piekarnia zużywa dokładnie 2 i daje 6 chleba. Zboża idzie 4 dziennie, czyli 384 rocznie, a dwa pola dają 400. Zapas jest cienki, 4%, i płodozmian jest dlatego pierwszym ulepszeniem, które realnie ratuje skórę, a nie tylko przyspiesza.

Sześć chleba dziennie to — przy dwudziestu mieszkańcach i koszcie osadnika rzędu czterdziestu — jeden nowy człowiek na tydzień. Cały łańcuch chlebowy służy wyłącznie temu: **jedzenie jest ceną wzrostu i niczym więcej**.

Pola zajmują ludzi wyłącznie w żniwa, przez pozostałe trzy pory roku ci sami ludzie chodzą na budowy.

### Drewno

Dwie leśniczówki dają 8 drewna dziennie i zużywają 0.8 drzewa. Jedna gajówka sadzi jedno, więc bilans wychodzi na plus i leszy milczy. Zapotrzebowanie: piekarnia 2 dziennie, cegielnia 1, tartak w skokach po 4 — wszystko jako **wsad do receptury**, nie jako opał. Reszta drewna idzie na budowę.

Nikt nie pali w piecu za samo istnienie. Zima sama z siebie jest łagodna — martwe pola, leśniczówki −50%, gajówka nie sadzi, zbieractwo prawie zerowe — a zęby wracają jej przez **zapasy na zimę**: patrz niżej.

### Zapasy na zimę

Jedyna decyzja jesieni i jedyne miejsce w grze, gdzie okno się zamyka. Przez całą jesień (24 dni) można odłożyć **1 drewno i 1 jedzenie na mieszkańca**. Panel odlicza dni i pokazuje guzik.

- **Odłożone:** zima mija normalnie. Produkcja bez kary, osadnicy przychodzą dalej.
- **Nieodłożone:** praca **poza dachem** idzie ×0.3 (las, jagody, glina — warsztaty pod dachem pracują normalnie), wieść o osadzie cichnie do zera i nikt nie przychodzi do wiosny, a zadowolenie leci o 25 punktów. **Nikt nie umiera i nic się nie zabiera.** Tracisz kwartał rozwoju.

To jest inwestycja, nie podatek — i dlatego mieści się w zasadzie „bezczynność nie kosztuje nic". Płacisz, bo chcesz rosnąć zimą, a nie dlatego, że istniejesz.

Zmierzone przez porównanie dwóch graczy na tych samych ośmiu ziarnach: kto odkłada zapasy, kończy z 67–80 mieszkańcami, kto nie — z 64–71. Sama kara produkcyjna dawała stratę 9%, bo zimowa produkcja i tak jest niska; dopiero zerowanie wieści i cięcie zadowolenia rozciągają stratę na wiosnę i robią z tego lekcję.

### Wyprawy

Klikasz rodzaj wyprawy, klikasz kafelek na mapie i ludzie idą. Bez budynku, bez kosztu, bez obsady na stałe — wracają po kilku dniach z ładunkiem, który panel obiecuje z góry.

| wyprawa | dokąd | co przynosi |
|---|---|---|
| po chrust | las | drewno — **suche gałęzie z ziemi, żadne drzewo nie ginie** |
| na jagody | las albo łąka | jagody, latem półtora raza więcej, zimą prawie nic |
| na ryby | woda | ryby, równo przez cały rok, także spod lodu |

Trzy zabezpieczenia, wszystkie z tej samej zasady — **wyprawa nigdy nie jest lepsza od budynku na osobodzień**, bo inaczej zawór bezpieczeństwa staje się strategią optymalną i cały łańcuch produkcyjny umiera:

1. **Tylko bezczynne ręce.** Wyprawa nie zdejmuje nikogo z warsztatu. Gdy wszyscy pracują, panel mówi wprost: wstrzymaj coś, żeby zwolnić ludzi.
2. **Czas idzie z odległości.** Daleki cel to tydzień bez tych ludzi.
3. **Wynik niższy niż w budynku.** Leśniczówka daje 2 drewna na osobodzień, chrust 1.2. Zbieracze 1 jagodę, wyprawa 0.7.

**Po co to jest.** Blokada leszego przestała być wyrokiem: zaczęta jesienią nie miała prawa puścić przed wiosną, bo gajówka zimą sadzi zero — a teraz zamiast czekać zbiera się gałęzie. To jest zarazem lekcja, i to dokładnie ta, o którą chodzi: gdy las się gniewa, bierze się to, co leży, a nie to, co rośnie.

Zmierzone: dni bez żadnej sensownej decyzji spadły z 5–21% na **0–6%**, a najdłuższy zastój z 24 dni na **5**. Ludność została w przedziale 70–80, więc zawór nie zjadł gospodarki.

**Wyprawa jest zaworem, nie nawykiem** — i to też jest wynik pomiaru, nie przeczucie. Gracz, który wysyłał bezczynnych codziennie, kończył z 65 mieszkańcami zamiast 80: „bezczynny" jesienią to rolnik czekający na żniwa, a wysłany nad wodę nie wraca na czas i pole stoi puste.

### Koniec sprintu i nazwane zakończenia

Po pięciu latach czas staje i przychodzi ekran podsumowania. Cztery **nazwane zakończenia**, nie punkty (zasada 8 z `PLAN.md`): jedna liczba zamienia wszystko, czego nie liczy, w dekorację — zwłaszcza las.

| zakończenie | warunek |
|---|---|
| Osada, która żyła z lasem | bór na koniec nie mniejszy niż pierwszego dnia |
| Osada ludna | 80 mieszkańców |
| Osada, którą duchy lubiły | trzy przymierza |
| Osada zapobiegliwa | pięć zim z zapasami |

Obok listy **bór z pierwszego dnia i bór z ostatniego, jeden przy drugim**. Dwie miniatury mapy, na których pniaki są jaśniejsze od drzew. Pod nimi po jednej liczbie i ani jednego zdania morału — jedno spojrzenie wystarczy.

Zmierzone na ośmiu ziarnach: kompetentny gracz zdobywa 2–3 zakończenia, **kompletu nie ma nigdzie**, a każde pada przynajmniej raz. Progi siedzą w `dane/stale.json`, bo mają być strojone pomiarem: warunek, który spełnia się zawsze, nie jest zakończeniem, tylko dekoracją.

**Sprzeczność między zakończeniami jest jednak dziś progowa, nie strukturalna, i to jest znany dług.** Zakładaliśmy, że rosnąca osada z konieczności zjada las. Pomiar mówi co innego: przy tej samej ludności 80 bór kończy raz na minusie, raz na sporym plusie — decyduje rozmieszczenie gajówek, nie wielkość osady. Gajówka jest za tania w ludziach: jedna osoba równoważy wyrąb czterech, więc dbanie o las nie jest wyborem, tylko odruchem. Do rozstrzygnięcia przy kolejnych etapach.

**Przeżyta zima z zapasami jest czynem, który liczą stopnie osady.** Gracz, który zapasów nie robi, nie awansuje z Polany nigdy — i to jest pierwszy warunek w tej grze, którego nie da się minąć mimochodem samym upływem kalendarza.

---

## 6. Rozwój: opowieści

Nie ma drzewka technologicznego, bo nie pasuje do świata, w którym wiedza pochodzi od duchów i starych ludzi.

Bajarz to zwykły budynek produkcyjny: bierze 3 chleby, po trzech dniach wypuszcza 1 opowieść. Opowieści nie da się zjeść ani zbudować z nich chaty, i w tym rzecz. Żeby się rozwijać, musisz oddać człowieka i jedzenie na coś, co dziś nie daje nic. Kto nie postawi bajarza, przetrwa, ale za pięć lat będzie miał gospodarkę z pierwszego roku.

Jeden bajarz daje 32 opowieści rocznie, pełna lista kosztuje 178. Ceny są
tak dobrane, żeby komplet ulepszeń był osiągnięciem piątego roku, a nie
trzeciego (patrz sekcja 12): przy jednym–dwóch bajarzach opowieści starcza na
wszystko dopiero pod koniec sesji, a na trudniejszych przebiegach na jedno
ulepszenie zabraknie. To zamienia ostatnie dwa lata z pustego plateau w wyścig
o to, co jeszcze zdążysz wykupić.

| # | Ulepszenie | Koszt | Efekt |
|---|---|---|---|
| 1 | Piła traczna | 9 | tartak dwa razy szybciej |
| 2 | Szkółka leśna | 11 | gajówka sadzi 2 drzewa zamiast 1 |
| 3 | Płodozmian | 18 | pole +25% plonu (200 → 250) |
| 4 | Piec chlebowy | 18 | piekarnia daje 4 chleby zamiast 3 |
| 5 | Zapiecek | 22 | chata mieści 6 osób zamiast 4 |
| 6 | Wypał w kręgu | 25 | cegielnia daje 2 cegły zamiast 1 |
| 7 | Wóz i ścieżki | 32 | leśniczówka i glinianka +2 do promienia |
| 8 | Chleb na zakwasie | 43 | mieszkaniec zjada 0.2 chleba zamiast 0.25 |

Lista jest płaska, bez wymagań wstępnych i bez gałęzi, kolejność ustawia się przez cenę. Wszystko działa globalnie i na stałe.

Ósemka jest najdroższa celowo: wszystkie pozostałe zwiększają produkcję, a zakwas zmniejsza zapotrzebowanie, przy tym samym wyniku. To jedna z niewielu rzeczy z ekonomii przydatna dosłownie wszędzie później. Siódemka jako jedyna odpowiada na sytuację (wyczerpany las wokół leśniczówki), a nie podkręca wskaźnik. Piątka i ósemka to jedyny prawdziwy wybór, rozrost kontra wydajność, i tak ma być, bo osiem pozycji z ośmioma dylematami to nie gra dla dziesięciolatka, tylko arkusz kalkulacyjny.

**Odrzucone świadomie:** skracanie czasu budowy (budowa nie jest wąskim gardłem) i podnoszenie limitu magazynu (limit jest sygnałem ostrzegawczym, a wyciszanie własnych alarmów za punkty to zła nauka).

---

## 7. Ludność

**Przybysze, nie narodziny.** Osadnik w wieku 18–30 lat przychodzi z zewnątrz i **zabiera ze sobą jedzenie na drogę**. Potrzebuje trzech rzeczy naraz: wolnego miejsca w chacie, zapasu jedzenia równego jego cenie i zadowolenia, które decyduje o tempie. Przybysz od razu dostaje dach nad głową i wychodzi z tej chaty do pracy.

**Koszt rośnie z ludnością**: 15 jedzenia przy dziesięciu mieszkańcach, 87 przy trzydziestu, 435 przy osiemdziesięciu (`osadnik` w `dane/stale.json`). Bez tego trzydziesta chata jest równie tania jak druga i późna gra przestaje być decyzją. Koszt widać w pasku, zanim zablokuje: „następny osadnik: 34 jedzenia, za 6 dni".

**Bez losowania.** Wieść o osadzie rośnie codziennie tym szybciej, im wyżej zadowolenie, i przy jedynce przychodzi człowiek. Dzięki temu panel może obiecać konkretny dzień i tego dowieźć. Gdy brakuje dachu albo jedzenia, wieść czeka na jedynce, a panel mówi wprost, na co.

**Zadowolenie** to jedna liczba 0–100 na całą osadę, widoczna w pasku od pierwszej sekundy. Wpływa **wyłącznie** na tempo napływu przybyszów. Podnosi je pełna spiżarnia, kapliczka i bajarz; obniża pusta spiżarnia, chuda zima, gniew ducha i ludzie bez roboty. Składowe siedzą w `dane/stale.json`, a panel wypisuje je z nazwami — liczba bez powodu jest zagadką, nie informacją.

Powód jest twardy. Przy narodzinach dziecko dorasta 16 lat, a sesja trwa pięć, więc przyrost naturalny dodawał wyłącznie gęby do wykarmienia i ani jednej pary rąk. Symulacja pokazała osadę duszącą się przy dziesięciu dorosłych przez osiem lat, niezależnie od tego, jak dobrze szła gospodarka. Przy przybyszach nagroda za dobre gospodarowanie jest widoczna od razu, a to przy dwudziestominutowej sesji jest warunkiem, żeby cokolwiek miało sens.

**Nikt nie odchodzi z osady poza starością.** Ani z głodu, ani z zimna, ani z niezadowolenia. Po 70 roku życia rośnie szansa na śmierć i to jedyny powód, dla którego kogoś ubywa samo z siebie. Południca jest świadomym wyjątkiem: zabiera jedną osobę na rok i jest zapamiętywaną lekcją, nie awarią. Awaria znaczy „osada stanęła", nigdy „osady nie ma".

---

## 8. Pory roku i duchy

Wiosna: pola zasiane, nic nie dają. Gajówka sadzi podwójnie. Zbieracze słabiej.
Lato: pełnia zbieractwa. Gajówka sadzi słabiej. Aktywna południca.
Jesień: żniwa, rozłożone na 24 dni. Gajówka sadzi słabiej.
Zima: pola martwe, leśniczówki −50%, gajówka nie sadzi (zmarznięta ziemia), zbieractwo prawie zerowe.

Modyfikatory sezonowe wszystkich budynków siedzą w `dane/stale.json`
(`moznikiPorRoku`), nie w kodzie — łącznie z profilem gajówki, którym stroi się
bilans leszego.

### Duchy

Cztery reguły, każda przewidywalna, każda wyjaśniona w Kodeksie po pierwszym spotkaniu. Duch nigdy nie atakuje, tylko zmienia zasady.

**Domowik.** Bez miski w kapliczce (1 chleb tygodniowo) z magazynu znikają dwie jednostki dziennie, rosnąco o jedną za każdy tydzień zaniedbania, **z sufitem dwunastu i z drugim sufitem: nigdy więcej niż 5% magazynu**. Bierze zawsze z najgrubszej kupki.

Obu sufitów trzeba, i to z przeciwnych powodów. Bez górnego — gdy była to prosta stawka procentowa — po dwóch latach domowik zabierał ponad 100% zapasów dziennie i osada nie miała prawa istnieć. Bez dolnego — gdy została sama kwota — płaska stawka wymiatała biedną osadę do zera i odbierała jej jedyne wyjście z pętli, bo kapliczka kosztuje desek i cegieł, czyli tartaku, czyli drewna. Sześć ziaren z ośmiu zamierało na piątym budynku.

**Leszy.** Liczy wycięte minus posadzone drzewa w oknie 96 dni. Przy deficycie powyżej 30 blokuje leśniczówki, aż bilans wróci do zera. Odblokowanie awaryjne przez obrzęd, kosztem 20 chleba.

Kluczowa jest tu proporcja sadzenia do wyrębu. Gajówka sadzi około 72 drzewa rocznie (podwójnie na wiosnę, połowicznie latem i jesienią, zero zimą), a dwie leśniczówki wycinają około 67 — jedna gajówka realnie równoważy dwie leśniczówki i las zostaje mniej więcej stabilny. Kto stawia leśniczówki bez gajówek, schodzi na minus i leszy blokuje mu wyrąb przez kilkadziesiąt dni w roku (symulacja: sześć leśniczówek przy jednej gajówce to 88–132 dni blokady na przebieg). Ponieważ zimą gajówka nie sadzi, deficyt narasta najszybciej właśnie zimą i schodzi dopiero po wiosennym sadzeniu.

**Południca.** Pole, które przepracuje wszystkie dwadzieścia cztery dni żniw bez ani jednego dnia wstrzymania, traci na koniec jesieni pracownika. Wystarczy wstrzymać je na jeden dzień. Dosłowna przerwa obiadowa jako mechanika.

Dwie rzeczy zmieniły się względem pierwotnego zamysłu, obie po zderzeniu z kodem. Po pierwsze **żniwa, nie lato**: pola mają obsadę wyłącznie jesienią, więc latem nie było czego karać — a folklor i tak wiąże południcę ze żniwami. Po drugie **jedna ofiara na rok, nie jedna z każdego pola**: przy czterech polach wychodziły cztery pogrzeby rocznie i zapamiętywana lekcja zamieniała się w wykruszanie osady. Panel „gdzie się korkuje" ostrzega w połowie żniw, więc śmierć nigdy nie przychodzi bez zapowiedzi.

**Wodnik.** Młyn w promieniu 3 kafelków od wody miele o 50% szybciej. Cegielnia w promieniu 5 kafelków od tego młyna zamienia przychylność w klątwę: −50%. Liczby w `dane/stale.json`.

Reguła dotyczy położenia na mapie, a `tick.ts` mapy nie zna — dlatego liczy ją świat, przez `Swiat.mnoznikMiejsca()`. Metoda jest opcjonalna: narzędzie balansujące, które ma zamiast mapy dwa liczniki, po prostu jej nie ma i wodnik go nie dotyczy.

### Przymierza

Druga oś rozwoju, obok opowieści. Nic nie kosztuje, jest nagrodą za nawyk.

Rok z dodatnim bilansem drzew i leszy zostaje na stałe: każda leśniczówka daje +1 drewna, a osada staje się ostoją także w tym drugim, przyrodniczym znaczeniu słowa. Rok bez kradzieży i domowik zaczyna pilnować magazynu zamiast go okradać. Wpis w Kodeksie rozszerza się właśnie w tym momencie.

### Kodeks

Osobny ekran nałożony na grę (`src/ui/kodeks.ts`, treść w `dane/kodeks.json`). Wpis odblokowuje się po pierwszym spotkaniu z duchem — a spotkaniem jest tak samo jego gniew, jak i przymierze z nim. Bez tego drugiego warunku gracz prowadzący osadę dobrze nigdy nie rozgniewałby leszego i Kodeks milczałby o duchu, z którym właśnie stanął w zgodzie.

Każdy wpis mówi trzy rzeczy osobno: **co ten duch robi w grze** (reguła, wprost), **w co naprawdę wierzono** i **gdzie to wierzenie było żywe**, z regionalnymi imionami — borowy, boruta, skrzat, kłobuk, iskrzycki. Przymierze dopisuje akapit do wpisu, który gracz już zna.

Pusty Kodeks też coś mówi: „wpisy otwierają się same, gdy spotkasz ducha w grze — nie ma tu żadnych pytań do odpowiedzenia". To jedyne miejsce, w którym gra wypowiada zasadę 6 na głos.

**Żadne odblokowanie w grze nie może zależeć od odpowiedzi na pytanie.** W momencie gdy pojawi się okienko „ile mąki potrzeba na chleb", gra przestaje uczyć i zaczyna odpytywać, a dzieci wyczuwają to natychmiast. Dziecko zapamięta południcę, bo raz mu zabiła kobietę na polu.

Kalendarz obrzędowy dorzuca cztery daty: gaik na wiosnę, Kupała w środku lata, dożynki po żniwach, Dziady zimą. Obrzęd kosztuje surowce i daje bonus na sezon. Można pominąć, ale sezon będzie trudniejszy.

---

## 9. Grafika

**Kenney Medieval RTS**, kenney.nl/assets/medieval-rts. CC0, 120 elementów, rzut ortogonalny, wektory. Ikony surowców i ulepszeń: Kenney Game Icons.

**Pory roku przez zabarwienie**, `setTint` plus filtr na scenie. Cztery zestawy kafelków to czterokrotnie więcej rysowania i pierwsza rzecz, która zatrzymałaby projekt.

**Duchów nie rysujemy.** Leszy to zielona poświata rozlewająca się po lesie, gdy jest zły. Domowik to znikające liczby i drobny ruch w magazynie. Duch, którego nie widać, jest straszniejszy i tańszy. Potrzebne są tylko cztery ikony do Kodeksu.

**Na dziś grafiki jeszcze nie ma.** Teren, budynki i ludzie to jednolite prostokąty i kółka rysowane w `src/render/scenaGry.ts`. Kolory trzymają się jednak docelowego podziału (kafelek terenu, bryła budynku, znacznik człowieka), więc wejście kafelków Kenneya sprowadzi się do podmiany tekstur w jednym pliku, a nie do przepisywania sceny.

Plac budowy to rusztowanie z paskiem postępu, wycięty las to pniak, młodnik po gajówce jaśnieje, aż odrośnie. Podkład pod kursorem przy stawianiu ma trzy kolory: zielony (można), żółty (można, ale pójdzie las pod topór) i czerwony (nie tutaj). Krąg zbioru rysuje się z promienia **po ulepszeniach**, żeby „wóz i ścieżki" był widoczny, a nie tylko zapisany w Kodeksie.

---

## 10. Zakres pierwszej wersji

Wchodzi: mapa 40×40, jedna, generowana raz i zapisana na stałe; zbieractwo, łańcuch drzewny, gliniany i chlebowy; bajarz i osiem ulepszeń; cztery pory roku; domowik i leszy z przymierzami; Kodeks z dwoma wpisami; sterowanie prędkością; panel „gdzie się korkuje" z produkcją i zużyciem dziennym każdego surowca; zapis stanu.

Nie wchodzi, świadomie: generowanie map, handel, drogi, zwierzęta, choroby, obrzędy, dźwięk.

**Południca i wodnik weszli po fakcie.** Na starcie byli odłożeni, bo wymagali rzeczy, których nie było: pierwsza wstrzymywania budynków, drugi rzeki i liczenia odległości. Gdy po kroku 7 obie te rzeczy już istniały, dołożenie obu duchów kosztowało jeden wieczór — i to jest argument za kolejnością prac z CLAUDE.md, a nie przeciw niej.

**Rozbiórka ukończonego budynku** też doszła po kroku 7: pomiar wskazał ją jako jedyny realny brak, gdy martwej glinianki nie dało się usunąć. Wraca połowa kosztu (`zwrotZRozbiorki`), a rozbiórka wymaga dwóch kliknięć — jedno wystarczyłoby, żeby dziecko rozebrało młyn, w który włożyło pół roku.

Kryterium przejścia dalej: dziecko siada, gra dwadzieścia minut i samo z siebie mówi „jeszcze raz".

---

## 11. Techniczne

Phaser 3, TypeScript, Vite. Repo na GitHubie, deploy na Vercela, zapis w localStorage.

**Symulacja nie wie, że Phaser istnieje.** Cały `src/sim/` to czysty TypeScript bez importów z Phasera. Dostęp do mapy idzie przez interfejs `Swiat`, więc to samo `tick()` działa w grze i w narzędziu balansującym, gdzie mapa jest zastąpiona licznikami. Dzięki temu pięć lat gry przelatuje w ćwierć sekundy zamiast w szesnaście minut. Wersja po kafelkach (`src/sim/swiat.ts`) jest tym samym interfejsem, tylko prawdziwym: wycina konkretne drzewa od najbliższego, zamienia wybrane złoże gliny w ziemię i sadzi tam, gdzie jest miejsce.

**Chodzenie jest warstwą widoku, nie ekonomii.** Produkcja liczy się z przydziału pracy, a nie z tego, czy człowiek zdążył dojść do warsztatu. Gdyby zależała od dojścia, narzędzie balansujące — które mapy nie ma — przestałoby mówić prawdę o bilansie, a to ono, nie granie w przeglądarce, ustawia liczby w tej grze. Dlatego `ruszLudzi()` woła warstwa przeglądarki po ticku, a nie sam tick. Jedyny wyjątek to postęp budowy (sekcja 5) i jest wyjątkiem właśnie dlatego, że nie dotyka produkcji dobowej.

**Grafika: Kenney Medieval RTS (CC0).** Jeden arkusz `public/grafika/kenney-medieval-rts.png`, 18×7 klatek po 64 px, margines i odstęp po 32. Numery klatek siedzą w `scenaGry.ts`, nie w `dane/` — to nie są liczby balansowe (zasada 3), tylko wybór obrazka, dokładnie tak jak wcześniej kolor prostokąta.

Kafelek urósł z 16 px do 32, a przybliżenie kamery spadło z ×2 na ×1: na ekranie wychodzi tyle samo mapy, ale rysunek 64 px dzieli się przez dwa bez reszty, zamiast być zbijanym do 16 i rozciąganym z powrotem. `pixelArt` jest wyłączony — arkusz jest rysunkiem wektorowym i przy NEAREST traci kreski.

Las i glina mają po cztery gęstości, dobierane po `zasob` kafelka. Dzięki temu po mapie widać, ile jeszcze zostało: krąg wyrobionej leśniczówki rzednie na oczach, a wycięty kafelek zostaje łąką z pniakiem. To ta sama informacja, którą panel podaje liczbą, tylko czytelna bez klikania.

Teren idzie do jednej `RenderTexture` rysowanej wsadowo (`beginDraw` / `batchDraw` / `endDraw`). Po jednym kafelku każde `draw()` zamyka partię i czeka na kartę graficzną — przy 1600 kafelkach i przerysowaniu za każdym ściętym drzewem przeglądarka sypie ostrzeżeniami o wstrzymaniu GPU.

**Pory roku przez `setTint` całego terenu**, nie przez cztery komplety kafelków: lato lekko złote, jesień rdzawa, zima siwa. Budynków i ludzi nie barwimy — chata ma wyglądać tak samo w lipcu i w styczniu, bo po jej wyglądzie gracz ją rozpoznaje.

**Drzwi budynku są pośrodku dolnej krawędzi.** Dopóki budynki były prostokątami, lewy górny róg nikomu nie przeszkadzał. Odkąd są rysunkami, wejście widać na obrazku od frontu, a ludzie zbierający się przy rogu stali dosłownie na dachu. Liczy to `drzwiBudynku()` w `ludzie.ts` i muszą go używać wszyscy: `cel()`, `zakwateruj()` i `stoiPrzy()`, bo inaczej budowniczy „dochodzi" gdzie indziej, niż stoi.

**Chód jest jednostajny, bo trasa dnia jest zapisana.** Symulacja przestawia człowieka raz na dzień o osiem kafelków i zostawia w `Mieszkaniec.trasa` drogę, którą przy tym przeszedł. Scena prowadzi go tą samą drogą, kafelek po kafelku, w tempie mijającego dnia (`postepDnia()` w `main.ts`, liczone z `performance.now()`, żeby nie skakać w rytm pętli dziennej). Wcześniej scena dociągała pozycję wykładniczo do punktu docelowego i dawało to dwa widoczne błędy naraz: wykładnicze dociąganie hamuje przed celem i nigdy go nie dobija, więc każdy tick wyglądał na skok, a prosta między punktem porannym a wieczornym potrafiła przeciąć rzekę albo skałę na wylot. Na pauzie człowiek zatrzymuje się w pół kroku, przy 4× biegnie — bo tempo bierze się z tego samego zegara co reszta gry.

**Interfejs w DOM, nie na canvasie.** Pasek surowców, panele, lista ulepszeń, Kodeks. Przewijane listy w Phaserze to droga przez mękę. Canvas rysuje tylko mapę, budynki i ludzi.

```
src/
  main.ts       sklejenie warstw, pętla dzienna, sterowanie prędkością
  zapis.ts      localStorage — jedyne miejsce, które wie o przeglądarce
  sim/          typy.ts stan.ts tick.ts budynki.ts budowa.ts ludzie.ts
                swiat.ts duchy.ts ulepszenia.ts mapa.ts szukanie.ts los.ts
  render/       scenaGry.ts pory.ts
  ui/           pasek.ts menuBudowy.ts panel.ts, dalej kodeks
dane/           budynki.json ulepszenia.json stale.json kodeks.json mapa.json
narzedzia/      symuluj.ts naMapie.ts podglad.ts zapis.ts
```

Uruchomienie balansu: `node --experimental-strip-types narzedzia/symuluj.ts 5 42`
To samo na prawdziwej mapie: `node --experimental-strip-types narzedzia/naMapie.ts 5 42`
Podgląd i sprawdzenie mapy: `node --experimental-strip-types narzedzia/podglad.ts 42`

**Mapa musi być spójna.** Z osady da się dojść na każdy przechodni kafelek —
generator sprawdza to sam i dokopuje korytarz tam, gdzie rzeka ze skałami
zamknęła kawał lądu. Osiągalność liczy ta sama funkcja (`osiagalneOd`), której
regułę przejścia stosuje A*, łącznie z zakazem ścinania rogów; inaczej mapa
zdawałaby test, po którym ludzie i tak nie przejdą.

Ruch jest po ósemce kierunków, ale nigdy przez styk dwóch przeszkód. Szukanie
drogi przez pół mapy zajmuje pojedyncze milisekundy, a liczy się je tylko przy
zmianie celu, nie co klatkę.

### Scena

`src/render/scenaGry.ts` rysuje wyłącznie świat i nigdy nie zmienia stanu gry —
czyta go przez getter i odkłada na ekran. Kliknięcie w kafelek leci na zewnątrz,
a co z nim zrobić, decyduje interfejs w DOM.

Cała mapa idzie do **jednej tekstury**, nie do 1600 osobnych obrazków: teren
zmienia się rzadko (wycięte drzewo, wybrana glina), więc taniej przerysować go
raz na zmianę niż utrzymywać tysiące obiektów co klatkę. Budynki i ludzie to
osobne warstwy `Graphics`, bo ruszają się częściej.

Kamera: przeciąganie myszą, kółko przybliża do kursora, strzałki przesuwają.
Widok startuje przybliżony na osadzie. Przeciągnięcie dłuższe niż kilka pikseli
przestaje być kliknięciem — bez tego drgnięcie ręki przy przesuwaniu mapy
wybierałoby przypadkowy kafelek.

### Panel „gdzie się korkuje"

`src/sim/bilans.ts` liczy raz dla całej osady dwie rzeczy: tempo każdego surowca
na dzień (ile przybywa, ile ubywa, na ile dni starczy zapasu) i listę wąskich
gardeł — nieobsadzone miejsca pracy, wyczerpane kręgi, warsztaty stojące bez
wejścia, blokadę leszego, kolejkę budowy, pełny magazyn. Wiersz z budynkiem jest
klikalny i przewija kamerę na winowajcę.

Plik jest czysty, bez Phasera, i to jest tu istotne: `narzedzia/bilans.ts` liczy
bilans przed każdym dniem, wykonuje dzień naprawdę i porównuje sumy. **Panel,
który zgaduje, jest gorszy niż brak panelu**, bo gracz mu wierzy.

Model musi naśladować tick dokładniej, niż się wydaje. Warsztaty liczy się
**po kolei**, po wirtualnej puli, bo tick przerabia budynki w kolejności listy —
piekarnia stojąca przed młynem używa wczorajszej mąki. Cykl jest niepodzielny:
młyn przy 0.7 zboża nie miele siedmiu dziesiątych mąki, tylko nie rusza wcale.
Oba uproszczenia najpierw wymyśliły chleb, którego nigdy nie było.

Rzeczy z natury skokowych — bajarz bierze trzy chleby raz na trzy dni, domowik
jeden raz w tygodniu — panel nie udaje: pokazuje uśrednione tempo, a narzędzie
sprawdza sumy na długim odcinku, nie pojedynczy dzień.

Jednej rzeczy panel **świadomie nie uśrednia**: kosztu osadnika. Jedzenie schodzi
skokiem — przez siedem dni z ośmiu przybywa, a ósmego znika sto sztuk naraz —
więc rozsmarowane po dniach dałoby „chleb −40 dziennie" w dniu, w którym chleba
przybywa. Osadnik ma zamiast tego własny wiersz: ile kosztuje, ile brakuje i za
ile dni przyjdzie. Tempo osobno, zdarzenie osobno.

**Stan na dziś: narzędzie zgadza się z tickiem na czterech ziarnach z ośmiu,
a rozjazd zawęził się do jednego surowca.** Zostaje odchył 0.063–0.095 na dzień
przy progu 0.05, wyłącznie na **chlebie** i o różnych znakach. Glina, cegła
i zboże rozjeżdżały się z innego powodu — tick sprawdzał wsad przez `>=` bez
tolerancji, a panel z tolerancją, więc cegielnia przy glinie równej dokładnie
dwa stawała w losowe dni. To jest naprawione.

Dla chleba przyczyna jest ustalona: tick pobiera wsad w chwili, gdy `postep`
rusza z zera, więc bajarz z cyklem trzydniowym kończy opłacony cykl bez wsadu,
a bilans w tym dniu mówi, że stoi. Wcześniej test przechodził na wszystkich
ziarnach, ale mierzył martwą osadę — place budowy dostawały te same
identyfikatory co budynki startowe, więc żaden budowniczy nigdy do nich nie
docierał.

### Samouczek

Osiem kroków w `dane/samouczek.json`, renderowanych przez `src/ui/samouczek.ts`:
rozejrzenie się, jedzenie, drewno, ruszenie czasu, skąd biorą się osadnicy,
panel, gajówka, pożegnanie. Prowadzi dokładnie tam, gdzie osada staje bez
prowadzenia — pierwsze trzy kroki to trzy rzeczy, bez których nie ruszy z miejsca
w pierwszym roku, a piąty tłumaczy jedyną pętlę, na której stoi cała gra.

**Samouczek niczego nie pyta** (zasada 6). Krok zamyka się albo zwykłym „dalej",
albo tym, że gracz naprawdę zrobił rzecz, o której mowa — `SPELNIONE` czyta stan
gry i sprawdza, czy w osadzie stoi już chata zbieraczy, leśniczówka, gajówka,
czy czas ruszył. Plac budowy liczy się jak gotowy budynek: dziecko zrobiło swoje
w chwili kliknięcia w mapę, a nie po ośmiu dniówkach pracy.

Postęp leży w localStorage **osobno od zapisu gry** (`ostoja:samouczek`). To nie
jest stan osady, tylko to, ile gracz już wie, więc ma przeżyć „Nową osadę" —
inaczej dziecko zaczynające od nowa przeklikiwałoby te same siedem okienek.
„Pomiń samouczek" jest widoczne przy każdym kroku i też jest trwałe.

### Zapis

`src/sim/stan.ts` zamienia stan gry w tekst i z powrotem, ale sam niczego nie
zapisuje — localStorage siedzi w `src/zapis.ts`, żeby symulacja dała się dalej
uruchamiać w Node. Mapa idzie w zapisie ciasno: teren i przechodniość jako
łańcuchy znaków, zasoby jako tablica liczb, zajętość tylko dla kafelków
faktycznie zajętych. Cały zapis waży wtedy około 10 kB zamiast kilkuset.

Zapis jest wersjonowany (`WERSJA_ZAPISU`). Zapis z nowszej wersji gry jest
odrzucany z wyjaśnieniem, a nie wczytywany po kawałku; uszkodzony też nie
wywraca gry, tylko wraca komunikatem, po którym da się zacząć od nowa.
Przy zmianie schematu podbija się wersję i dopisuje migrację do `MIGRACJE`.

**Wznowiona gra musi toczyć się identycznie.** W stanie leży bieżący stan
generatora losowego (`ziarno`), więc wczytana osada losuje dalej dokładnie tak
samo, jakby jej nie przerywano — sprawdza to `narzedzia/zapis.ts`. Ziarno mapy
jest osobno (`ziarnoMapy`), bo `ziarno` zmienia się z każdym losowaniem i po
pierwszym dniu nie da się z niego odtworzyć terenu.

---

## 12. Co pokazała symulacja

Osiem ziaren po pięć lat, w dwóch narzędziach naraz — licznikowym (`symuluj.ts`) i mapowym (`naMapie.ts`).

**Po etapie 1** (`naMapie.ts`): ludność rośnie z 10 do 62–80, zadowolenie na koniec 45–90, dni bez sensownej decyzji 3–18%, najdłuższy zastój 21 dni, plan budowy 28/28 na każdym ziarnie. Krzywa ludności rośnie do ostatniego roku wszędzie, typowo 23 → 36 → 51 → 65 → 78. `symuluj.ts` pokazuje 87, bo nie widzi kończącego się lasu — gdy oba narzędzia się rozjadą, prawdę mówi mapowe.

**Przed etapem 1**, dla porównania: 31–46 osób, zero dni głodu, zero odejść. Podwojenie ludności to skutek usunięcia konsumpcji, nie przekręcenia liczb: jedzenie, które dawniej znikało na utrzymanie, jest teraz w całości ceną wzrostu.

**Stare miary przestały cokolwiek znaczyć i trzeba było zbudować nowe.** Dni głodu i odejścia są teraz zerowe *z definicji*, więc narzędzie chwaliłoby każdą konfigurację, także nudną. `narzedzia/miary.ts` liczy zamiast tego dni bez sensownej decyzji, zastoje, dzień awansu na drugi i trzeci stopień oraz ludność i zadowolenie w funkcji czasu. Miary powstały **przed** zmianą ekonomii — inaczej nie byłoby z czym porównać.

**Plateau ludności okazało się artefaktem narzędzia.** Przez trzy kroki w tym dokumencie stało, że osada wychodzi na plateau przy czterdziestu osobach i że to następny front balansowy. Nieprawda: narzędzie stawiało z góry ustaloną liczbę chat, więc osada dobijała do sufitu mieszkaniowego (siedem chat po sześć osób) i zatrzymywała się tam, co wyglądało jak granica gospodarki. Gdy „gracz" w narzędziu zaczął dokładać chatę, kiedy nie ma gdzie mieszkać, wzrost ruszył dalej — 46–53 osoby w ósmym roku. W pięcioletniej sesji ludność rośnie do ostatniego dnia i to jest właściwy kształt: gra kończy się, zanim skończy się rozwój.

**Panel „gdzie się korkuje" daje się zmierzyć.** Gracz, który reaguje na wiersz „w kręgu nie ma już nic" i stawia budynek na innym złożu, skraca czas martwego budynku z 202 do 80 dni (ziarno 1234) i z 311 do 296 (ziarno 8). Panel nie jest ozdobą — zmienia liczby.

**Czego nie da się naprawić liczbami.** Na części ziaren glinianka stoi z pustym kręgiem od kilkudziesięciu do trzystu dni, mimo że gliny na mapie leży 2000+ jednostek przy zapotrzebowaniu rzędu 150. Problemem nie jest ilość surowca, tylko to, że **ukończonego budynku nie da się rozebrać**: jedyne wyjście to postawić drugą gliniankę i zostawić pierwszą jako pomnik. To brak mechaniki, nie zły balans, i tak został zapisany.

Wcześniejsze ustalenia, nadal aktualne:

- **Pojemność magazynu zrobiła się prawdziwym hamulcem.** Dopóki jedzenie znikało na utrzymanie, sufit spiżarni był ozdobą. Teraz zapas rośnie, aż uderzy w limit, i od tej chwili każda kolejna sztuka przepada — a koszt osadnika rośnie tak, że po którymś progu to magazyn, a nie produkcja, wyznacza tempo wzrostu. Magazyn jest tanim i czytelnym zaworem: chcesz więcej ludzi, potrzebujesz większej spiżarni.
- **Koszt ulepszeń (99 → 178)** rozłożył rozwój na całą sesję: komplet ulepszeń wpada dopiero w piątym roku, a na części przebiegów gracz kończy z siedmioma z ośmiu.
- **Bramy stopni oparte na czynie trzeba sprawdzić, czy czyn jest trudny.** Warunki planowane na etap 5 („stoi kapliczka", „zawarte przymierze") kompetentny gracz spełnia tak wcześnie, że o awansie decyduje kalendarz: na wszystkich ośmiu ziarnach stopień drugi wypada w dniu 95, a trzeci w 191, co do dnia. Zanim stopnie zaczną cokolwiek blokować, muszą dostać warunek, którego nie da się minąć mimochodem.
- **Leszy ma zęby** dzięki profilowi sezonowemu gajówki: chciwemu graczowi (sześć leśniczówek, jedna gajówka) blokuje wyrąb 88–132 dni na przebieg.
- **Prawdziwa mapa ma 224–426 drzew**, a `symuluj.ts` startuje z 900 — mimo to wynik pięciu lat wychodzi ten sam. Las na mapie zostaje w okolicy liczby startowej, bo gajówka sadzi w swoim kręgu, a nie w próżnię.

**Czego symulacja nadal nie sprawdza:** reguły wodnika — potrzebuje odległości od rzeki, więc dotyka jej wyłącznie `naMapie.ts` przez `Swiat.mnoznikMiejsca()`, a `symuluj.ts` mapy nie ma i reguła go nie obowiązuje. Nie sprawdza też **tempa gry ani samouczka**: obie rzeczy dotyczą sekund realnych i czytania, a narzędzia liczą dni. To wyszło dopiero z rąk gracza. I nie sprawdza jedynej rzeczy, która naprawdę rozstrzyga o projekcie — czy dziecko po dwudziestu minutach powie „jeszcze raz".

---

## 13. Co zostało

Zakres pierwszej wersji z sekcji 10 jest zamknięty: mapa, trzy łańcuchy produkcyjne, budowa, pory roku, **cztery** duchy z przymierzami, Kodeks, panel „gdzie się korkuje", zapis, balans, rozbiórka gotowego budynku i samouczek. Reszta to rzeczy świadomie odłożone.

**Grafika Kenneya.** Teren, budynki i ludzie to na dziś prostokąty i kółka. Kolory trzymają się docelowego podziału, więc podmiana to wymiana tekstur w `src/render/scenaGry.ts`, nie przepisywanie sceny.

**Czy dzieci mają swoje gospodarstwa z imionami** — i czy to zmienia cokolwiek mechanicznie, czy jest tylko nazwą i osobnym panelem. Tanie jest to drugie i prawdopodobnie wystarczy.

**Kryterium, którego nie zmierzy żadne narzędzie.** Dziecko siada, gra dwadzieścia minut i samo z siebie mówi „jeszcze raz". Do tego momentu wszystkie liczby w tym dokumencie są tylko dobrze uzasadnionymi hipotezami.
