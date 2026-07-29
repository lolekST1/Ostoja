# Ostoja — fundament projektu

Gra o budowaniu słowiańskiej osady. Bez walki, z pełnymi łańcuchami produkcyjnymi i duchami lasu jako warunkami brzegowymi gospodarki.

Wersja 4. Liczby w tym dokumencie zostały sprawdzone symulacją (`narzedzia/`), nie wymyślone — na ośmiu ziarnach, dwoma niezależnymi narzędziami. Sekcja 12 opisuje, co pokazały, łącznie z tym, w czym wcześniejsze wersje tego dokumentu się myliły.

---

## 1. Czym to jest w jednym akapicie

Prowadzisz osadę przez kolejne lata. Ludzie potrzebują jedzenia i opału. Jedzenie zaczyna się od zbieractwa, które karmi słabo, ale od razu, i przechodzi w rolnictwo, które karmi mocno, ale raz w roku. Każdy człowiek jest przypisany do jednego budynku, a rąk jest zawsze mniej niż miejsc pracy. Nie ma wrogów. Napięcie robi zima, która nie wybacza złego planowania, i duchy, które nie atakują, tylko zmieniają zasady. Wygrywasz przez dotrwanie i rozrost, przegrywasz przez głód albo zimno.

Docelowa sesja: 20–30 minut, czyli około pięciu lat w grze.

---

## 2. Model surowców

Wspólna pula liczb, jak w Age of Empires. Nie ma transportu towarów między budynkami: budynek pobiera z puli i oddaje do puli.

| Surowiec | Skąd | Do czego |
|---|---|---|
| drewno | leśniczówka | opał, budowle z okrąglaków, deski, cegły, piekarnia |
| deska | tartak | budowle murowane i precyzyjne |
| glina | glinianka | cegły |
| cegła | cegielnia | młyn, piekarnia, kapliczka |
| jagody | chata zbieraczy | jedzenie, od pierwszego dnia |
| zboże | pole (żniwa jesienią) | mąka |
| mąka | młyn | chleb |
| chleb | piekarnia | jedzenie, bajarz |
| opowieść | bajarz | ulepszenia |

Jedzenia są dwa i zużywają się w kolejności: **najpierw jagody, potem chleb**. Jagody się psują i nie da się ich odłożyć na zimę, chleb owszem. To jest cała różnica między zbieractwem a rolnictwem sprowadzona do jednej reguły.

Pula ma limit pojemności: pierwszy magazyn 200 sztuk każdego surowca, każdy kolejny dokłada 200. Nadwyżka ponad limit przepada. Opowieści limitu nie mają.

**Świadoma decyzja:** jedna globalna pula zamiast magazynów lokalnych. To główny kompromis wobec Settlersów, bo odbiera znaczenie odległości między warsztatami. W zamian nie ma kodu logistycznego, który zwykle zabija takie projekty. Rozmieszczenie działa przez promienie zbioru i regułę wodnika.

---

## 3. Model danych

TypeScript. Pełne definicje w `src/sim/typy.ts`, tu tylko rzecz najważniejsza:

```ts
type Surowiec = "drewno" | "deska" | "glina" | "cegla"
              | "jagody" | "zboze" | "maka" | "chleb" | "opowiesc";
type Pula = Record<Surowiec, number>;
```

Nazwy surowców są typem, nie napisem, więc literówka w `"maka"` nie kompiluje się zamiast po cichu psuć bilans w trzecim roku.

Trzy główne obiekty: `Budynek`, `Mieszkaniec`, `Kafelek`. Ludzie chodzą naprawdę, z A* po siatce, ale tylko rano do pracy, wieczorem do domu i po surowce w budynkach zbierających. Warsztaty nie generują ruchu.

Jedno drzewo to **10 jednostek drewna**. Przy tej wartości jedna gajówka utrzymuje bilans dwóch leśniczówek. Przy pięciu trzeba było gajówki na każdą leśniczówkę i leszy blokował wyrąb bez przerwy.

---

## 4. Tick symulacji

Jeden tick = jeden dzień = **4 sekundy realne** przy prędkości 1×. Rok ma 96 dni (4 pory × 24), czyli 6 minut 24 sekundy. Gracz przełącza 1× / 2× / 4× i pauzę.

Osada **startuje na pauzie**. Pierwsze zetknięcie z grą polega na czytaniu opisów budynków, a przy płynącym czasie kosztowało to jedzenie i opał, zanim dziecko zdążyło się dowiedzieć, skąd je brać.

Tempo jest wyłącznie sprawą przeglądarki — `sekundNaDzien` nie wchodzi do symulacji, więc jego zmiana nie rusza balansu. Narzędzia z `narzedzia/` liczą dni, nie sekundy.

Kolejność kroków ma znaczenie i nie należy jej zmieniać bez powodu:

1. **Czas.**
2. **Przydział pracy.** Przeliczany codziennie, dzięki czemu rolnicy poza sezonem sami wracają do puli wolnych robotników. Zaraz po nim **dniówka na budowach**: zużywa wyłącznie ręce, bo surowce zeszły z puli już przy zakładaniu placu, więc nie rusza niczego w dalszej kolejności.
3. **Zbieranie z mapy.** Leśniczówka, glinianka, zbieracze, gajówka.
4. **Produkcja warsztatów** z rezerwacją wejść.
5. **Żniwa**, tylko jesienią.
6. **Konsumpcja.** Jedzenie (jagody przed chlebem), opał.
7. **Ludność.** Przybysze, starzenie, odejścia.
8. **Duchy.**
9. **Render.**

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

**Cegielnia nie kosztuje cegieł, i to nie jest kosmetyka.** Kosztowała cztery, na starcie leżało dwadzieścia i wyglądało to bezpiecznie. Domowik podbiera z magazynu do 8% dziennie, więc zanim osada dochodziła do cegielni, zostawało niecałe cztery — a wtedy nie ma już żadnego wyjścia, bo cegły robi wyłącznie cegielnia. Sześć ziaren z ośmiu stawało w miejscu na siódmym budynku. Ta sama pułapka co „chata za cegły", tylko o jeden budynek dalej: **żaden budynek nie ma prawa kosztować tego, co sam jako jedyny produkuje.**

Start: 10 dorosłych, 3 chaty, 1 magazyn, 110 drewna, 20 cegieł, 40 chleba, 30 jagód. Desek zero — pierwszy tartak trzeba postawić z okrąglaków.

**Drewno na starcie jest tam po coś.** Brak opału liczy się w ticku dokładnie tak samo jak głód, a osada zaczynała z pustą drwalnią — kto nie postawił leśniczówki w dziesięć dni, tracił wszystkich, nie widząc związku. Narzędzie balansujące tego nie pokazywało, bo jego plan budowy zawsze stawiał leśniczówkę jako drugą. Sto dziesięć polan to jednocześnie wiosenny opał i budulec na pierwsze cztery budynki: dość, żeby zdążyć, za mało, żeby o jednym albo drugim zapomnieć.

### Budowa

Budynek nie pojawia się gotowy. Gracz płaci surowce od razu, ale na placu budowy musi stanąć człowiek i przepracować swoje dniówki (`dniBudowy` w `dane/budynki.json`, od 3 dla chaty zbieraczy do 9 dla młyna i piekarni). Rozbudowa kosztuje więc to, czego w osadzie brakuje najbardziej — ręce — a nie tylko surowce leżące w magazynie.

**Postęp naliczają tylko ci, którzy doszli.** Plac budowy założony na drugim końcu mapy potrafił być gotowy, zanim ktokolwiek go zobaczył — budowa liczyła przydzielonych, nie obecnych. Teraz liczy obecnych, przez opcjonalne `Swiat.obecniNaBudowie()`. Idzie to przez świat, nie przez tick, z tego samego powodu co reguła wodnika: tick mapy nie zna. Produkcji to nie dotyczy i dotyczyć nie może (zasada 8) — warsztat czekający na dojście pracownika odebrałby narzędziu balansującemu prawo do mówienia o bilansie. Budowa jest inna: zdarza się raz na budynek, opóźnia go o dzień lub dwa i nie rusza produkcji dobowej. `naMapie.ts` i `bilans.ts` wołają teraz `ruszLudzi()` po ticku, tak samo jak przeglądarka — bez tego nikt nigdy nie dochodzi na plac i osada nie stawia nic.

**Kolejka zamiast wyścigu.** Naraz pracuje jeden plac budowy, po dwóch ludzi (`budowyNaraz`, `budowniczychNaBudowe` w `dane/stale.json`), i budowy mają pierwszeństwo przed produkcją. Bez pierwszeństwa nikt nigdy nie poszedłby budować, bo miejsc pracy jest w tej grze zawsze więcej niż rąk. Bez kolejki dziecko, które postawi sześć budynków naraz, zdejmuje z produkcji całą osadę i po dziesięciu dniach zaczyna tracić ludzi z głodu, nie rozumiejąc dlaczego. Z kolejką koszt rozbudowy jest zawsze taki sam i widoczny: dwie pary rąk.

**Budowa w lesie karczuje las i oddaje drewno.** Polana startowa ma promień czterech kafelków i po odjęciu trzech chat z magazynem zostaje na niej miejsce na jeden budynek. Zakaz stawiania na drzewach oznaczał w praktyce „tu nie postawisz" przy co drugim kliknięciu. Teraz drzewa spod bryły idą pod topór, drewno wpada do puli, a leszy liczy to jako wycinkę — bo to jest wycinka. Złoża gliny to nadal wyjątek: zabudowane, przepadają bezpowrotnie i nikt tego nie odzyska.

**Zwinięcie placu budowy zwraca surowce w całości.** Dziesięciolatek postawi chatę w złym miejscu i ma to móc cofnąć bez kary.

**Ukończony budynek da się rozebrać za połowę kosztu** (`zwrotZRozbiorki`). Doszło to po kroku 7, bo pomiar pokazał martwą gliniankę stojącą nawet trzysta dni na wyczerpanym złożu — bez rozbiórki jedynym wyjściem było postawić drugą i zostawić pierwszą jako pomnik. Rozbiórka wymaga dwóch kliknięć, a magazyn zabiera ze sobą swoją pojemność: nadwyżka ponad nowy limit przepada, tak samo jak przepada nadwyżka produkcji.

### Moduł chlebowy

**Dwa pola, młyn, piekarnia. Cztery osoby. Dwadzieścia cztery gęby.**

Młyn robi 2 mąki dziennie, piekarnia zużywa dokładnie 2 i daje 6 chleba, a 6 chleba przy 0.25 na osobę karmi 24 osoby. Zboża idzie 4 dziennie, czyli 384 rocznie, a dwa pola dają 400. Zapas jest cienki, 4%, i płodozmian jest dlatego pierwszym ulepszeniem, które realnie ratuje skórę, a nie tylko przyspiesza.

Pola zajmują ludzi wyłącznie w żniwa, przez pozostałe trzy pory roku ci sami ludzie chodzą na budowy.

### Drewno

Dwie leśniczówki dają 8 drewna dziennie i zużywają 0.8 drzewa. Jedna gajówka sadzi jedno, więc bilans wychodzi na plus i leszy milczy. Zapotrzebowanie przy 24 osobach: piekarnia 2 dziennie, opał średnio 4.2, tartak w skokach po 4.

Zima zjada opału cztery razy więcej niż reszta roku i to ona jest zegarem całej gry. Kto wchodzi w nią z zapasem na 20 dni zamiast 24, traci ludzi i widzi dlaczego.

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

**Przybysze, nie narodziny.** Wolna chata plus zapas jedzenia na 30 dni ściągają dorosłego osadnika w wieku 18–30 lat. Przybysz od razu dostaje dach nad głową i wychodzi z tej chaty do pracy.

Powód jest twardy. Przy narodzinach dziecko dorasta 16 lat, a sesja trwa pięć, więc przyrost naturalny dodawał wyłącznie gęby do wykarmienia i ani jednej pary rąk. Symulacja pokazała osadę duszącą się przy dziesięciu dorosłych przez osiem lat, niezależnie od tego, jak dobrze szła gospodarka. Przy przybyszach nagroda za dobre gospodarowanie jest widoczna od razu, a to przy dwudziestominutowej sesji jest warunkiem, żeby cokolwiek miało sens.

Mieszkaniec bez jedzenia lub bez opału przez 10 dni odchodzi z osady. Po 70 roku życia rośnie szansa na śmierć.

---

## 8. Pory roku i duchy

Wiosna: pola zasiane, nic nie dają. Gajówka sadzi podwójnie. Zbieracze słabiej.
Lato: pełnia zbieractwa. Gajówka sadzi słabiej. Aktywna południca.
Jesień: żniwa, rozłożone na 24 dni. Gajówka sadzi słabiej.
Zima: pola martwe, leśniczówki −50%, gajówka nie sadzi (zmarznięta ziemia), zbieractwo prawie zerowe, opał ×4.

Modyfikatory sezonowe wszystkich budynków siedzą w `dane/stale.json`
(`moznikiPorRoku`), nie w kodzie — łącznie z profilem gajówki, którym stroi się
bilans leszego.

### Duchy

Cztery reguły, każda przewidywalna, każda wyjaśniona w Kodeksie po pierwszym spotkaniu. Duch nigdy nie atakuje, tylko zmienia zasady.

**Domowik.** Bez miski w kapliczce (1 chleb tygodniowo) z magazynu znika 1% zapasów dziennie, rosnąco o pół punktu za każdy tydzień zaniedbania, **z sufitem 8%**. Sufit jest konieczny: bez niego po dwóch latach domowik kradnie ponad 100% dziennie i osada nie ma prawa istnieć.

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

### Samouczek

Siedem kroków w `dane/samouczek.json`, renderowanych przez `src/ui/samouczek.ts`:
rozejrzenie się, jedzenie, opał, ruszenie czasu, panel, gajówka, pożegnanie.
Prowadzi dokładnie tam, gdzie osada pada bez prowadzenia — pierwsze trzy kroki to
te trzy rzeczy, których brak zabija ją w pierwszym roku.

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

Osiem ziaren po pięć lat, w dwóch narzędziach naraz — licznikowym (`symuluj.ts`) i mapowym (`naMapie.ts`). Oba mówią to samo: ludność rośnie z 10 do 32–49, dni głodu 0–1 z 480, zero odejść z osady, 6–8 ulepszeń z ośmiu. Zgodność obu narzędzi jest tu ważniejsza niż same liczby: znaczy, że ekonomia policzona na licznikach naprawdę działa też po kafelkach.

**Balans zamknięto bez zmiany choćby jednej liczby w `dane/`.** Krok 7 miał przekręcać wartości i nie przekręcił żadnej, bo pomiar nie wskazał niczego, co tego wymaga. To też jest wynik — i lepszy niż zmiany wprowadzone dla samego poczucia, że się coś zrobiło.

**Plateau ludności okazało się artefaktem narzędzia.** Przez trzy kroki w tym dokumencie stało, że osada wychodzi na plateau przy czterdziestu osobach i że to następny front balansowy. Nieprawda: narzędzie stawiało z góry ustaloną liczbę chat, więc osada dobijała do sufitu mieszkaniowego (siedem chat po sześć osób) i zatrzymywała się tam, co wyglądało jak granica gospodarki. Gdy „gracz" w narzędziu zaczął dokładać chatę, kiedy nie ma gdzie mieszkać, wzrost ruszył dalej — 46–53 osoby w ósmym roku. W pięcioletniej sesji ludność rośnie do ostatniego dnia i to jest właściwy kształt: gra kończy się, zanim skończy się rozwój.

**Panel „gdzie się korkuje" daje się zmierzyć.** Gracz, który reaguje na wiersz „w kręgu nie ma już nic" i stawia budynek na innym złożu, skraca czas martwego budynku z 202 do 80 dni (ziarno 1234) i z 311 do 296 (ziarno 8). Panel nie jest ozdobą — zmienia liczby.

**Czego nie da się naprawić liczbami.** Na części ziaren glinianka stoi z pustym kręgiem od kilkudziesięciu do trzystu dni, mimo że gliny na mapie leży 2000+ jednostek przy zapotrzebowaniu rzędu 150. Problemem nie jest ilość surowca, tylko to, że **ukończonego budynku nie da się rozebrać**: jedyne wyjście to postawić drugą gliniankę i zostawić pierwszą jako pomnik. To brak mechaniki, nie zły balans, i tak został zapisany.

Wcześniejsze ustalenia, nadal aktualne:

- **Pojemność magazynu i opał zimą nie ruszają gry kompetentnego gracza.** Zero odejść nawet przy opale ×6 i magazynie 120. Bronią wyłącznie przed graczem nieostrożnym, a tego symulacja nie umie odegrać.
- **Próg przybyszów to urwisko, nie pokrętło.** `zapasNaDziecko` powyżej 30 wywraca połowę ziaren w zamarcie albo w głodowe odejścia. Układ jest bistabilny.
- **Koszt ulepszeń (99 → 178) i wolniejszy napływ przybyszów** rozłożyły rozwój na całą sesję: komplet ulepszeń wpada dopiero w piątym roku, a na części przebiegów gracz kończy z siedmioma z ośmiu.
- **Leszy ma zęby** dzięki profilowi sezonowemu gajówki: chciwemu graczowi (sześć leśniczówek, jedna gajówka) blokuje wyrąb 88–132 dni na przebieg.
- **Prawdziwa mapa ma 224–426 drzew**, a `symuluj.ts` startuje z 900 — mimo to wynik pięciu lat wychodzi ten sam. Las na mapie zostaje w okolicy liczby startowej, bo gajówka sadzi w swoim kręgu, a nie w próżnię.

**Czego symulacja nadal nie sprawdza:** reguły wodnika — potrzebuje odległości od rzeki, więc dotyka jej wyłącznie `naMapie.ts` przez `Swiat.mnoznikMiejsca()`, a `symuluj.ts` mapy nie ma i reguła go nie obowiązuje. Nie sprawdza też **tempa gry ani samouczka**: obie rzeczy dotyczą sekund realnych i czytania, a narzędzia liczą dni. To wyszło dopiero z rąk gracza. I nie sprawdza jedynej rzeczy, która naprawdę rozstrzyga o projekcie — czy dziecko po dwudziestu minutach powie „jeszcze raz".

---

## 13. Co zostało

Zakres pierwszej wersji z sekcji 10 jest zamknięty: mapa, trzy łańcuchy produkcyjne, budowa, pory roku, **cztery** duchy z przymierzami, Kodeks, panel „gdzie się korkuje", zapis, balans, rozbiórka gotowego budynku i samouczek. Reszta to rzeczy świadomie odłożone.

**Grafika Kenneya.** Teren, budynki i ludzie to na dziś prostokąty i kółka. Kolory trzymają się docelowego podziału, więc podmiana to wymiana tekstur w `src/render/scenaGry.ts`, nie przepisywanie sceny.

**Czy dzieci mają swoje gospodarstwa z imionami** — i czy to zmienia cokolwiek mechanicznie, czy jest tylko nazwą i osobnym panelem. Tanie jest to drugie i prawdopodobnie wystarczy.

**Kryterium, którego nie zmierzy żadne narzędzie.** Dziecko siada, gra dwadzieścia minut i samo z siebie mówi „jeszcze raz". Do tego momentu wszystkie liczby w tym dokumencie są tylko dobrze uzasadnionymi hipotezami.
