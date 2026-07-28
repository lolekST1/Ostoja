# Ostoja — fundament projektu

Gra o budowaniu słowiańskiej osady. Bez walki, z pełnymi łańcuchami produkcyjnymi i duchami lasu jako warunkami brzegowymi gospodarki.

Wersja 3. Liczby w tym dokumencie zostały sprawdzone symulacją (`narzedzia/symuluj.ts`), nie wymyślone. Sekcja 12 opisuje, co ta symulacja pokazała.

---

## 1. Czym to jest w jednym akapicie

Prowadzisz osadę przez kolejne lata. Ludzie potrzebują jedzenia i opału. Jedzenie zaczyna się od zbieractwa, które karmi słabo, ale od razu, i przechodzi w rolnictwo, które karmi mocno, ale raz w roku. Każdy człowiek jest przypisany do jednego budynku, a rąk jest zawsze mniej niż miejsc pracy. Nie ma wrogów. Napięcie robi zima, która nie wybacza złego planowania, i duchy, które nie atakują, tylko zmieniają zasady. Wygrywasz przez dotrwanie i rozrost, przegrywasz przez głód albo zimno.

Docelowa sesja: 20–30 minut, czyli około pięciu lat w grze.

---

## 2. Model surowców

Wspólna pula liczb, jak w Age of Empires. Nie ma transportu towarów między budynkami: budynek pobiera z puli i oddaje do puli.

| Surowiec | Skąd | Do czego |
|---|---|---|
| drewno | leśniczówka | opał, deski, cegły, piekarnia |
| deska | tartak | budowa wszystkiego |
| glina | glinianka | cegły |
| cegła | cegielnia | młyn, piekarnia, cegielnia, kapliczka |
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

Jeden tick = jeden dzień = 2 sekundy realne przy prędkości 1×. Rok ma 96 dni (4 pory × 24), czyli 3 minuty 12 sekund. Gracz przełącza 1× / 2× / 4× i pauzę.

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

Koszty budowy: chata 14 desek; leśniczówka, gajówka 8; zbieracze 6; glinianka 6; pole 5; tartak 15; cegielnia 12 desek + 4 cegły; magazyn 20; kapliczka 10 + 10; bajarz 14 + 6; młyn 20 + 8; piekarnia 16 + 12.

**Chata kosztuje same deski.** Gdy wymagała cegieł, powstawała blokada nie do rozplątania: brak miejsc do mieszkania, więc brak ludzi, więc nikt nie obsadzi cegielni, więc nie ma cegieł na chatę. Cegły bramkują młyn i piekarnię, nie dach nad głową.

Start: 10 dorosłych, 3 chaty, 1 magazyn, 30 drewna, 60 desek, 20 cegieł, 40 chleba, 30 jagód.

**Drewno na starcie jest tam po coś.** Brak opału liczy się w ticku dokładnie tak samo jak głód, a osada zaczynała z pustą drwalnią — kto nie postawił leśniczówki w dziesięć dni, tracił wszystkich, nie widząc związku. Narzędzie balansujące tego nie pokazywało, bo jego plan budowy zawsze stawiał leśniczówkę jako drugą. Trzydzieści polan to trzydzieści dni wiosennego ogrzewania: dość, żeby zdążyć, za mało, żeby o opale zapomnieć (zima zjada tyle w cztery dni).

### Budowa

Budynek nie pojawia się gotowy. Gracz płaci surowce od razu, ale na placu budowy musi stanąć człowiek i przepracować swoje dniówki (`dniBudowy` w `dane/budynki.json`, od 3 dla chaty zbieraczy do 9 dla młyna i piekarni). Rozbudowa kosztuje więc to, czego w osadzie brakuje najbardziej — ręce — a nie tylko surowce leżące w magazynie.

**Kolejka zamiast wyścigu.** Naraz pracuje jeden plac budowy, po dwóch ludzi (`budowyNaraz`, `budowniczychNaBudowe` w `dane/stale.json`), i budowy mają pierwszeństwo przed produkcją. Bez pierwszeństwa nikt nigdy nie poszedłby budować, bo miejsc pracy jest w tej grze zawsze więcej niż rąk. Bez kolejki dziecko, które postawi sześć budynków naraz, zdejmuje z produkcji całą osadę i po dziesięciu dniach zaczyna tracić ludzi z głodu, nie rozumiejąc dlaczego. Z kolejką koszt rozbudowy jest zawsze taki sam i widoczny: dwie pary rąk.

**Budowa w lesie karczuje las i oddaje drewno.** Polana startowa ma promień czterech kafelków i po odjęciu trzech chat z magazynem zostaje na niej miejsce na jeden budynek. Zakaz stawiania na drzewach oznaczał w praktyce „tu nie postawisz" przy co drugim kliknięciu. Teraz drzewa spod bryły idą pod topór, drewno wpada do puli, a leszy liczy to jako wycinkę — bo to jest wycinka. Złoża gliny to nadal wyjątek: zabudowane, przepadają bezpowrotnie i nikt tego nie odzyska.

**Zwinięcie placu budowy zwraca surowce w całości.** Dziesięciolatek postawi chatę w złym miejscu i ma to móc cofnąć bez kary. Ukończonego budynku rozebrać się nie da.

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

**Południca.** Latem, jeśli pole pracuje przez cały sezon bez ani jednego dnia wstrzymania, na koniec lata ginie pracownik pola. Wystarczy wstrzymać budynek na jeden dzień. Dosłowna przerwa obiadowa jako mechanika.

**Wodnik.** Młyn przy rzece +50%. Cegielnia w promieniu 5 kafelków zamienia to na −50%.

### Przymierza

Druga oś rozwoju, obok opowieści. Nic nie kosztuje, jest nagrodą za nawyk.

Rok z dodatnim bilansem drzew i leszy zostaje na stałe: każda leśniczówka daje +1 drewna, a osada staje się ostoją także w tym drugim, przyrodniczym znaczeniu słowa. Rok bez kradzieży i domowik zaczyna pilnować magazynu zamiast go okradać. Wpis w Kodeksie rozszerza się właśnie w tym momencie.

### Kodeks

Osobny ekran. Wpis odblokowuje się po pierwszym spotkaniu z duchem i zawiera prawdziwy opis wierzenia plus informację, gdzie było żywe.

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

Nie wchodzi, świadomie: generowanie map, handel, drogi, zwierzęta, choroby, południca i wodnik, obrzędy, dźwięk.

Południca i wodnik są ciekawsi niż domowik, ale wymagają rzeczy, których na starcie nie ma: pierwsza wstrzymywania budynków, drugi rzeki i liczenia odległości.

Kryterium przejścia dalej: dziecko siada, gra dwadzieścia minut i samo z siebie mówi „jeszcze raz".

---

## 11. Techniczne

Phaser 3, TypeScript, Vite. Repo na GitHubie, deploy na Vercela, zapis w localStorage.

**Symulacja nie wie, że Phaser istnieje.** Cały `src/sim/` to czysty TypeScript bez importów z Phasera. Dostęp do mapy idzie przez interfejs `Swiat`, więc to samo `tick()` działa w grze i w narzędziu balansującym, gdzie mapa jest zastąpiona licznikami. Dzięki temu pięć lat gry przelatuje w ćwierć sekundy zamiast w szesnaście minut. Wersja po kafelkach (`src/sim/swiat.ts`) jest tym samym interfejsem, tylko prawdziwym: wycina konkretne drzewa od najbliższego, zamienia wybrane złoże gliny w ziemię i sadzi tam, gdzie jest miejsce.

**Chodzenie jest warstwą widoku, nie ekonomii.** Produkcja liczy się z przydziału pracy, a nie z tego, czy człowiek zdążył dojść do warsztatu. Gdyby zależała od dojścia, narzędzie balansujące — które mapy nie ma — przestałoby mówić prawdę o bilansie, a to ono, nie granie w przeglądarce, ustawia liczby w tej grze. Dlatego `ruszLudzi()` woła warstwa przeglądarki po ticku, a nie sam tick.

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

Sześć ziaren po pięć lat, stan po pierwszym przykręceniu balansu: ludność rośnie z 10 do 39–42, zero dni głodu, a komplet ośmiu ulepszeń wpada dopiero w piątym roku — na dwóch z sześciu przebiegów gracz kończy sesję z siedmioma z ośmiu. Ostatnie dwa lata przestały być puste: wypełnia je wyścig o opowieści.

**Co realnie zmieniło grę.** Jedyną dźwignią, która przesuwa przeżycie pięciu lat kompetentnego gracza, okazał się koszt ulepszeń (podniesiony o 80%, z 99 do 178) i, w mniejszym stopniu, tempo napływu przybyszów (`szansaNaDziecko` z 0.02 na 0.015, dla łagodniejszej krzywej wzrostu).

**Czego przykręcić się nie dało.** Pojemność magazynu i zużycie opału zimą nie mają w symulacji żadnego mierzalnego wpływu: przytomny gracz (a takiego gra `pilnujOpalu` w narzędziu) przechodzi zimę nawet przy opale ×6 i magazynie 120, z zerem odejść. Te dwie liczby bronią się tylko przed graczem nieostrożnym, a tego symulacja nie umie odegrać. Zostawione bez zmian, żeby nie karać dziecka, które gra dobrze. Plateau ludności około 40 to z kolei artefakt planu budowy w narzędziu (siedem chat po sześć osób), nie własność ekonomii — w grze o liczbie chat decyduje gracz.

**Próg przybyszów to urwisko, nie pokrętło.** `zapasNaDziecko` podniesiony z 30 na 38 wywraca połowę ziaren w zamarcie na 14 osobach albo wręcz w głodowe odejścia, podczas gdy druga połowa rośnie normalnie. Układ jest tu bistabilny i do delikatnego strojenia się nie nadaje — dlatego został na 30.

**Leszy dostał zęby.** Wcześniej las rósł bez opamiętania do 2000+ drzew i drzewny duch nie groził nikomu, bo gajówka była około dwuipółkrotnie za silna: jedna sadziła 112 drzew rocznie, gdy dwie leśniczówki wycinały 44. Po skorygowaniu profilu sezonowego gajówki (podwójnie na wiosnę, połowicznie latem i jesienią, zero zimą — łącznie około 72 drzewa rocznie) bilans jednej gajówki realnie równoważy dwie leśniczówki. Las zrównoważonego gracza zostaje w okolicy 1300 zamiast puchnąć do 2000, a gracz chciwy — sześć leśniczówek przy jednej gajówce — dostaje blokadę leszego przez 88–132 dni na pięcioletni przebieg. Przy okazji twardy `×2` na wiosnę wyniósł się z kodu do `dane/stale.json`, gdzie jest reszta modyfikatorów pór roku.

**Czego symulacja nie sprawdza:** reguły wodnika i południcy.

### Co pokazała symulacja na prawdziwej mapie (krok 4)

`narzedzia/naMapie.ts` puszcza tę samą ekonomię po kafelkach: teren z generatora, budynki stawiane tam, gdzie jest co zbierać, las wycinany drzewo po drzewie. Sześć ziaren po pięć lat kończy na 38–41 mieszkańcach, z zerem dni głodu i zerem dni bez opału, przy 7–8 wykupionych ulepszeniach — czyli tam, gdzie kończy wersja z licznikami. **Ekonomia przeżyła zderzenie z mapą**, ale po drodze wyszły cztery rzeczy, których liczniki nie mogły pokazać.

**Las na mapie nie puchnie.** Wersja licznikowa kończy z 1200–1300 drzewami przy 900 na starcie, bo gajówka sadzi w próżnię. Na mapie sadzi w swoim kręgu i las kończy na 255–466 drzewach przy 224–426 na starcie — rośnie, ale w granicach rozsądku. To jest właściwa liczba do patrzenia przy strojeniu leszego.

**Gajówka postawiona pod chatami nic nie robi.** Nie zbiera (`zbiera: null`), więc automat stawiał ją najbliżej osady i zalesiała łąkę w środku wsi, podczas gdy leśniczówki po drugiej stronie mapy ogołacały swój krąg do zera. Osada padała w pierwszą zimę. Sadzenie ma sens tylko tam, gdzie się wycina — i to jest rzecz, której gracz musi się domyślić z kręgu rysowanego przy stawianiu.

**Glinianka wysycha, leśniczówka bywa, że też.** Na czterech z sześciu ziaren jakiś budynek stoi przez 110–210 dni w kręgu, w którym nic już nie ma; prawie zawsze jest to glinianka (glina jest jednorazowa), rzadziej leśniczówka. Liczniki tego nie widzą w ogóle. To jest dokładnie sytuacja, na którą odpowiada „wóz i ścieżki", i pierwszy powód, dla którego panel „gdzie się korkuje" (krok 5) jest potrzebny.

**Piekarnia pali opał.** Polityka opałowa w narzędziu wstrzymywała tartak i cegielnię, ale nie piekarnię, która zjada 2 drewna dziennie i potrafi wypalić zapas na zimę, gdy w spiżarni leży już dwieście chlebów. Po dopisaniu jej do listy „opałożernych" jedno ziarno przestało wymierać.

**Plan budowy oderwany od liczby rąk zabija osadę.** Automat stawiał trzydzieści dwa budynki na dziewiętnaście osób; ludzi dostają najpierw budynki postawione wcześniej, więc leśniczówki zostawały puste w środku zimy. Jedna reguła („nie stawiaj, gdy ponad cztery miejsca pracy świecą pustkami") naprawiła to w obu narzędziach. W grze decyduje o tym gracz, ale to znaczy, że interfejs **musi** pokazywać nieobsadzone miejsca pracy — panel budynku robi to od kroku 4, całościowy widok wchodzi w kroku 5.

---

## 13. Zostało do ustalenia

Czy dzieci mają swoje gospodarstwa z imionami, i czy to zmienia cokolwiek mechanicznie, czy jest tylko nazwą i osobnym panelem. Tanie jest to drugie i prawdopodobnie wystarczy.
