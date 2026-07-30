# Ostoja — plan drugiej wersji: ekonomia bez zużycia i kraina duchów

Dokument roboczy. `OSTOJA.md` opisuje grę, która stoi; ten plik opisuje grę,
którą budujemy. Czytaj po `CLAUDE.md` i `OSTOJA.md`.

Powstał po pierwszym prawdziwym zagraniu, w którym kilkunastoosobowa osada
zniknęła w kilkanaście sekund, i po decyzji, żeby nie łatać tego liczbami.

---

## 1. Dlaczego w ogóle

Trzy wady konstrukcyjne obecnej ekonomii. Żadnej nie da się naprawić
przekręceniem liczby w `dane/`.

**Podatek od istnienia.** 0.25 chleba i 0.1–0.4 drewna na osobę dziennie,
zawsze. Czytanie opisu budynku kosztuje jedzenie. Pauza chroni tylko dlatego,
że zatrzymuje wszystko.

**Rozwój jest karą.** Każdy nowy mieszkaniec dokłada koszt utrzymania na stałe.
Osada rośnie i przez to robi się trudniejsza. Pętla ma znak minus tam, gdzie
powinna mieć plus.

**Śmierć jest zsynchronizowana.** W `tick.ts` brak opału liczy się tym samym
licznikiem co głód, a dobrze prowadzona osada trzyma wszystkich na `glod = 0`.
Gdy drewno spada do zera, licznik rusza *wszystkim naraz od tej samej wartości*
i jedenastego dnia odchodzi cała osada co do jednego. Przy czterech sekundach
na dzień to kilkanaście sekund od „wszystko gra" do pustej mapy, bez żadnego
ostrzeżenia po drodze.

Do tego blokada leszego wyłącza się dopiero przy deficycie zero, a gajówka zimą
sadzi zero (`moznikiPorRoku.gajowka.zima`). Blokada zaczęta jesienią nie ma
prawa puścić przed wiosną — to jest pułapka bez wyjścia, nie trudność.

---

## 2. Zasada, z której wynika reszta

> **Zasoby są ceną czynu, nie podatkiem od istnienia.**
> Nie budujesz, nie ściągasz ludzi, nie kupujesz ulepszeń — nie tracisz nic.
> Nigdy.

---

## 3. Żelazne zasady nowej wersji

Każda z nich jest zapisaną pułapką, w którą już raz wdepnęliśmy albo o krok
od niej byliśmy. Dopisuj do listy, nie skracaj jej.

1. **Bezczynność nie kosztuje nic.** Bez wyjątków, bez „tylko troszkę".
2. **Nikt nie odchodzi z osady poza starością.** Ani z głodu, ani z zimna, ani
   z niezadowolenia. Awaria znaczy „osada stanęła", nigdy „osady nie ma".
3. **Żaden budynek nie kosztuje tego, co sam jako jedyny produkuje.** Cegielnia
   za cegły zamroziła sześć ziaren z ośmiu na siódmym budynku.
4. **Żadna brama nie zamyka narzędzia potrzebnego do jej otwarcia.** Sprawdzaj
   po grafie kosztów, nie na oko.
5. **Bramy stopni opierają się na czynach, nie na zapasach ani na ludności.**
   „Stoi kapliczka", „przeżyta zima z zapasami", „zawarte przymierze".
6. **Wyprawa nigdy nie jest lepsza od budynku** na osobodzień. Inaczej zawór
   bezpieczeństwa staje się strategią optymalną i łańcuch produkcyjny umiera.
7. **Rosnący koszt musi być widoczny, zanim zablokuje.** „Następny osadnik: 34
   jedzenia, uzbiera się za 6 dni" — zawsze, nie dopiero przy zerze.
8. **Zakończenie to nazwa, nie punkty.** Jedna liczba zamienia wszystko, czego
   nie liczy, w dekorację — zwłaszcza las.
9. **Kampania przenosi wiedzę i ludzi, nigdy surowce.**
10. **Nie pisz graczowi, czego w grze nie ma.** Zasada 6 z `CLAUDE.md` jest
    notatką projektową, nie wiadomością dla dziecka.

Zasady 1–8 z `CLAUDE.md` obowiązują bez zmian. Zwłaszcza 1 (`src/sim/` bez
Phasera), 2 (zero `Math.random()`), 3 (liczby w `dane/`) i 6 (nic nie
odblokowuje się przez odpowiedź na pytanie).

---

## 4. Etapy

Po każdym `npm run dev` pokazuje działającą grę. Jeden PR na etap.

### Etap 0 — ratunek (opcjonalny) — ❌ NIEPOTRZEBNY

Miał być robiony tylko wtedy, gdyby etap 1 nie zmieścił się w jednej sesji.
Zmieścił się, więc etap 0 nie powstał i już nie powstanie.

### Etap 1 — koniec zużycia ✅ ZROBIONE

Zmierzone na ośmiu ziarnach: ludność 10 → 62–80 (przedtem 31–46), krzywa rośnie
do ostatniego roku na każdym ziarnie, dni bez decyzji 3–18%, najdłuższy zastój
21 dni. Etap 0 okazał się niepotrzebny — etap 1 zmieścił się w jednej sesji.

Trzy rzeczy wyszły przy okazji i zostały naprawione: domowik na płaskiej kwocie
wymiatał biedną osadę do zera (stąd `udzialMaks`), panel obiecywał ten sam las
dwóm leśniczówkom na wspólnym kręgu (stąd `rozdzielZbiory`), a `narzedzia/
bilans.ts` od zawsze mierzył martwą osadę, bo place budowy dostawały te same
identyfikatory co budynki startowe. Szczegóły w `CLAUDE.md`.

Do domknięcia zostaje jedno: `bilans.ts` zgadza się na czterech ziarnach z ośmiu.
Przyczyna jest ustalona, lekarstwo nie — patrz „Co zostało" w `CLAUDE.md`.

Poniżej zakres, dla porządku.

**1a. Najpierw przezbrój narzędzia.** Bez tego pomiar traci sens: dni głodu
i odejścia będą zerowe *z definicji* i `symuluj.ts` zacznie chwalić każdą
konfigurację, w tym nudną. Nowe miary:

- ile dni gracz nie miał żadnej sensownej decyzji,
- w którym dniu wpadł na drugi i trzeci stopień osady,
- ile razy stanął bez możliwości działania (nie stać na nic, nie ma czego
  postawić, nie ma kogo wysłać),
- ludność w funkcji czasu, nie tylko końcowa.

„Gracz" w `symuluj.ts` i `naMapie.ts` musi umieć rekrutować i robić zapasy na
zimę, inaczej mierzy grę, w którą nikt nie gra.

**1b. Ekonomia.**

- Znika `chlebNaOsobe`, znika `opalNaOsobe`, znika krok konsumpcji z `tick.ts`.
- Znika `glod` i `PROG_ODEJSCIA`. `WIEK_STAROSCI` zostaje.
- **Osadnik kosztuje jedzenie** (`JADALNE` razem, jak zawsze) i wymaga wolnego
  miejsca w chacie. Koszt rośnie z ludnością — dziesiąty tanio, trzydziesty
  wyraźnie drożej. Krzywa w `dane/stale.json`.
- **`zadowolenie`** 0–100, jedno na osadę, widoczne w pasku od pierwszej
  sekundy. Wpływa **wyłącznie na tempo napływu przybyszów** i wchodzi do
  zakończenia. Nikt przez nie nie odchodzi (zasada 2). Spada od pustej
  spiżarni, chudej zimy, gniewu ducha i ludzi bez pracy; rośnie od jedzenia
  w zapasie, kapliczki i bajarza.
- Pojemność magazynu staje się prawdziwym hamulcem: zapas dobija do sufitu
  i wtedy gra mówi „wydaj to".
- `WERSJA_ZAPISU` 2 → 3, migracja kasuje `glod`, dokłada `zadowolenie`.
- Panel: „następny osadnik: N jedzenia, za M dni" (zasada 7).
- Domowik do przeliczenia **na kwotę, nie na procent**: 8% z pełnego,
  nieopróżnianego magazynu robi z niego jedynego przeciwnika w grze.
- Samouczek: kroki o głodzie i opale przestają być prawdą.

### Etap 2 — zapasy na zimę ✅ ZROBIONE

Zmierzone przez porównanie dwóch graczy na tych samych ziarnach
(`naMapie.ts … bezzapasow`): kto odkłada zapasy, kończy z 67–80 mieszkańcami,
kto nie — z 64–71. Zima bez zapasów kosztuje kwartał rozwoju i nic poza tym:
nikt nie umiera, nic się nie zabiera.

Warunek stopni z etapu 5 przestał być kalendarzem. Gracz z zapasami awansuje
w dniu 95 i 191, gracz bez zapasów **nie awansuje nigdy** — „przeżyta zima
z zapasami" jest wreszcie czynem, którego nie da się minąć mimochodem.

Przy okazji znalazł się błąd starszy niż oba etapy: tick sprawdzał wsad przez
`>=` bez tolerancji, a panel z tolerancją. Glinianka daje dokładnie 2 gliny
dziennie, cegielnia bierze dokładnie 2 — trafiały w siebie co dzień, a suma
zmiennoprzecinkowa wypadała raz nad, raz pod progiem. To domknęło rozjazdy na
glinie, cegle i zbożu w `bilans.ts`.

Poniżej zakres, dla porządku.

Jesienią pojawia się jedna decyzja: **Zapasy na zimę**, koszt zależny od
ludności (rząd wielkości: 1 drewno + 1 jedzenie na osobę), okno przez całą
jesień, panel odlicza dni.

- **Zrobione:** zima normalna, produkcja bez kary, przybysze przychodzą dalej.
- **Nie zrobione:** produkcja z zewnątrz ×0.3, przybysze nie przychodzą.
  **Nikt nie umiera, nic się nie zabiera.** Tracisz kwartał rozwoju.

Zamienia najbardziej frustrującą mechanikę w grze w jej najlepszą lekcję,
i robi to zgodnie z zasadą 1: to inwestycja, nie podatek.

### Etap 3 — zakończenia sprintu ✅ ZROBIONE

Pięć lat, ekran podsumowania, cztery nazwane zakończenia i bór z pierwszego dnia
obok boru z ostatniego. Czas po piątym roku staje sam.

Zmierzone na ośmiu ziarnach: kompetentny gracz zdobywa 2–3 zakończenia z czterech,
**kompletu nie ma nigdzie**, a każde zakończenie pada przynajmniej raz —
„z lasem" 6/8, „ludna" 2/8, „lubiana przez duchy" 6/8, „zapobiegliwa" 8/8.

**Ale sprzeczność jest dziś progowa, nie strukturalna, i to trzeba naprawić.**
Zakładaliśmy, że rosnąca osada z konieczności zjada las. Pomiar mówi co innego:
przy tej samej ludności 80 las potrafi skończyć na minusie (ziarno 1: 388 z 397)
albo na sporym plusie (ziarno 31337: 425 z 347). Decyduje rozmieszczenie
gajówek, nie wielkość osady. Powód jest policzalny: **gajówka jest za tania
w ludziach** — jedna osoba równoważy wyrąb dwóch leśniczówek, czyli czterech.
Dbanie o las kosztuje piątą część rąk pracujących w lesie, więc nie jest wyborem.
Komplet nie pada tylko dlatego, że na ziarnie z ludnością 80 zabrakło trzeciego
przymierza — a to zależy od mapy, nie od decyzji gracza.

Do rozstrzygnięcia przy etapie 4 albo 5: albo gajówka ma kosztować więcej rąk,
albo „osada ludna" ma wymagać czegoś, czego nie da się mieć razem z pełnym
borem. Nie ruszałem tego w etapie 3, bo bilans gajówki i leszego był strojony
osobno i ma własny zestaw pułapek (patrz `CLAUDE.md`).

Poniżej zakres, dla porządku.

Pięć lat i koniec. Ekran podsumowania z **nazwanymi zakończeniami**, nie punktami:

- „Osada, która żyła z lasem" — bór na koniec nie mniejszy niż na starcie
- „Osada ludna" — ponad czterdziestu mieszkańców
- „Osada, którą duchy lubiły" — trzy przymierza
- „Osada zapobiegliwa" — pięć zim z zapasami

Można zdobyć kilka naraz i **nie da się zdobyć wszystkich w jednym przebiegu**.
Ta sprzeczność jest celowa — bez niej to lista do odhaczenia, a nie decyzja.

Obok: **bór z pierwszego i z ostatniego dnia**, jeden obok drugiego. Od zmiany
w gęstościach kafelków (PR #10) mapa pokazuje zasób wprost, więc jedno
spojrzenie mówi dziecku, co zrobiło, bez ani jednego zdania morału.

To jest zegar całej gry. Bez zegara usunięcie zużycia zamienia Ostoję
w piaskownicę, w której czekanie jest darmowe, a każda kara mierzona czasem
przestaje być karą.

### Etap 4 — wyprawy ✅ ZROBIONE (trzy z pięciu)

Trzy wyprawy oparte na terenie: **po chrust** (las → drewno), **na jagody**
(las i łąka, mocniej latem) i **na ryby** (woda, równo cały rok, także zimą
spod lodu — doszedł surowiec `ryba`). Klikasz rodzaj, klikasz kafelek, ludzie
idą i wracają po kilku dniach z ładunkiem obiecanym z góry.

**Nie zrobione: łowy i po kamień** — i to jest decyzja, nie zapomnienie. Łowy
wymagają zwierzyny chodzącej po mapie, czyli nowej encji w symulacji i w scenie;
kamień jest „pod przyszły gród", więc do etapu 5 byłby surowcem, którego nie ma
na co wydać, a to jest dokładnie ta wada, o której mówi zasada 10 („nie pisz
graczowi, czego w grze nie ma"). Obie dołożyć razem z grodem.

**Zmierzone: pat zniknął.** To był główny cel etapu i widać go w liczbach —
dni bez żadnej sensownej decyzji spadły z 5–21% na **0–6%**, a najdłuższy zastój
z 24 dni na **5**. Ludność bez zmian (70–80), więc zawór nie zastąpił gospodarki.

**Wyprawa musi być zaworem, nie nawykiem — i to trzeba było zmierzyć.** Pierwsza
wersja „gracza" w narzędziu wysyłała bezczynnych codziennie, ponad czterysta razy
na przebieg, i kończyła z 65 mieszkańcami zamiast 80. Powód: „bezczynny" jesienią
to rolnik czekający na żniwa, a wysłany nad wodę nie wraca na czas i pole stoi
puste. Gracz wysyłający wyprawy tylko wtedy, gdy czegoś brakuje — i nigdy
w żniwa — nie traci nic.

Poniżej zakres, dla porządku.

Klikasz w kafelek mapy i wysyłasz ludzi. Bez budynku, bez kosztu, bez obsady
na stałe. Wracają po kilku dniach z ładunkiem.

| wyprawa | gdzie | uwagi |
|---|---|---|
| po chrust | las | **nie ścina drzew — leszy tego nie liczy** |
| na jagody | las, łąka | mocniej latem |
| na ryby | rzeka | równo cały rok, zimą przez lód |
| łowy | zwierzyna chodząca po mapie | rzadkie, widoczne, ekscytujące |
| po kamień | skały | pod przyszły gród |

Guardrail (zasada 6): **wyłącznie bezczynne ręce**, czas idzie z odległości,
wynik na osobodzień **niższy niż w budynku tego samego rodzaju**.

Co to załatwia: nigdy nie ma patu (zabrakło drewna → idziesz po chrust),
blokada leszego przestaje być wyrokiem i uczy, że gdy las się gniewa, zbiera
się chrust zamiast ścinać, a gracz ma co robić co minutę.

Później, jeśli się sprawdzi: wyprawy coś **znajdują** — złoże za rzeką, kamienną
babę (wpis w Kodeksie), wędrowca, który dołącza. Najtańszy sposób na to, żeby
mapa była warta oglądania.

### Etap 5 — stopnie osady ✅ ZROBIONE, wyprawianie osadników ⏳ z etapem 6

| stopień | warunek (czyn, nie liczba) | odblokowuje |
|---|---|---|
| **Polana** | start | chata, magazyn, kapliczka, zbieracze, leśniczówka, gajówka, tartak |
| **Osada** | stoi kapliczka + przeżyta zima z zapasami | glinianka, cegielnia, pole, młyn |
| **Gród** | zawarte przymierze + druga zima z zapasami | piekarnia, bajarz |

Awans to wydarzenie: kronika mówi „Osada awansowała", a w liście budowy
przybywa kafelków. Wcześniej wszystkie trzynaście budynków było dostępnych
w dniu pierwszym — dla dziecka ściana, a po godzinie nie ma już nic nowego
do odkrycia.

**Kapliczka jest na Polanie i kosztuje deski z drewnem, nie cegły.** To wyszło
z grafu kosztów (zasada 4): kapliczka jest warunkiem awansu na Osadę, a cegielnia
stoi dopiero za tą bramą — cegły w jej koszcie zamykały drzwi, które sama miała
otwierać. Ulepszeń nie trzeba bramkować osobno: idą za opowieści, a opowieści
robi wyłącznie bajarz, czyli budynek grodowy.

**Zmierzone na ośmiu ziarnach, dwoma graczami.** Kompetentny: ludność 67–72
(było 70–80), plan 28/28, dni bez sensownej decyzji 1–4%, Osada w dniu 95, Gród
w dniu 191. Gracz, który nie robi zapasów: **nie awansuje ani razu**, kończy
z 45–47 mieszkańcami i 16 pozycjami planu z 28. Bramy nie zamrażają nikogo —
pozycję zamkniętą stopniem gracz pomija i wraca po awansie.

**Gród zmienia cel z rośnięcia na wyprawianie osadników.** Wóz, zapasy, kilkoro
ludzi. To rozwiązuje problem piątego roku: bez ubytków późna gra jest samym
dokładaniem trzydziestego pierwszego budynku. I jest dosłownie przejściem do
następnego węzła kampanii — **dlatego robimy to razem z etapem 6**. Bez krainy
wyprawienie osadników jest oddaniem ludzi za nic i żaden gracz tego nie
kliknie, więc nie da się tego ani zbalansować, ani zmierzyć.

### Etap 6 — kraina

Ekran między sprintami: mapa okolicy z miejscami odsłanianymi po kolei.
**Osią jest duch, nie teren** — mapy różnią się tym, z kim się dogadujesz.

| miejsce | teren | duch prowadzący | czego uczy |
|---|---|---|---|
| Wierzbnica | polana, wszystkiego po trochu | domowik | porządek i utrzymanie |
| Borowa Głusza | bór, mało łąki | **leszy** | las się nie odnawia sam |
| Jezierzysko | rzeka, ryby, mało lasu | **wodnik** | czysta woda a przemysł |
| Złote Łany | step, świetne pola, zero drzew | **południca** | upał, żniwa, przerwa |
| Kamieniec | góry, kamień, krótkie lato | wszyscy naraz | zima i zapasy |

Cztery duchy już są w grze i każdy koduje prawdziwą wiedzę. Dziś gracz spotyka
je przypadkiem, w jednej osadzie, i o dwóch może się nie dowiedzieć. Kampania
jest najtańszym sposobem, żeby każdy dostał własną lekcję — nie trzeba nowej
mechaniki, tylko rozłożyć istniejącą na mapy.

**Co się przenosi** (zasada 9): Kodeks rośnie przez całą kampanię; umiejętność
(„z Wierzbnicy przyszło dwoje, którzy umieją wypalać cegłę" → cegielnia
dostępna od pierwszego dnia); przymierze zawarte raz obowiązuje w całej krainie.

**Co się nie przenosi:** ani jedno polano. Sto desek w prezencie zamienia
trzecią mapę w spacer i cała krzywa się kładzie.

Nazewnictwo idzie za historią: w sprincie Polana → Osada → Gród, w krainie
Opole → Plemię.

**Stan krainy żyje w osobnym kluczu localStorage**, tak jak dziś
`ostoja:samouczek` żyje osobno od `ostoja:zapis`. Inaczej „Nowa osada" skasuje
całą kampanię — a tego się potem nie odkręci.

#### Ekran wprowadzenia — jedna historia, nie pięć brief­ingów

Każda misja otwiera się **ekranem wprowadzenia**: rysunek okolicy, kilka zdań
i guzik „Zaczynamy". Wzór to Settlers II, i to nie z sentymentu — ta gra robi
jedną rzecz, której nie robi żadna lista celów. **Opowiada dalej.** Kolejna
mapa nie jest kolejnym poziomem, jest następnym miejscem w tej samej podróży,
a gracz siada do niej, bo chce wiedzieć, co dalej z ludźmi, których prowadzi.

Zasady, bez których to się rozpadnie na pięć osobnych planszy:

1. **Jedna historia przez całą krainę, nie pięć osobnych.** Wprowadzenie do
   Borowej Głuszy mówi wprost, dlaczego opole rusza z Wierzbnicy dalej i kto
   idzie z nim. Ostatnia plansza domyka to, co zaczęła pierwsza.
2. **Wprowadzenie mówi o ludziach i o miejscu, nigdy o liczbach.** „Za rzeką
   stoi bór, jakiego nikt z was nie widział — ciemny i cichy" zamiast „zbuduj
   trzy leśniczówki". Cel misji i tak stoi obok, w wykazie zakończeń z etapu 3.
3. **To ekran do przeczytania, nie do przeklikania.** Bez pytań, bez wyboru
   ścieżki, bez „czy zrozumiałeś" (zasada 6 z `CLAUDE.md` i zasada 10 stąd).
   Jeden guzik dalej i jeden „przeczytaj jeszcze raz" dostępny potem z Kodeksu —
   dziecko, które zapomniało, po co tu przyszło, ma gdzie sprawdzić.
4. **Krótko: trzy, cztery akapity po dwa zdania.** Dłuższe wprowadzenie dziecko
   przeklika bez czytania i cała robota idzie w las.
5. **Ekran wyjścia jest częścią tej samej historii.** Po pięciu latach
   podsumowanie z etapu 3 (nazwane zakończenia, bór z pierwszego i ostatniego
   dnia) kończy się zdaniem, które prowadzi do następnego miejsca — i to zdanie
   **zależy od zdobytych zakończeń**. Osada, która żyła z lasem, rusza dalej
   inaczej niż ta, która go wycięła. Nie zmienia to następnej mapy, tylko to,
   co się o niej mówi: najtańszy sposób, żeby wybór z pierwszej planszy był
   widoczny na trzeciej.
6. **Duch prowadzący misję odzywa się we wprowadzeniu**, jednym zdaniem, i to
   on jest łącznikiem między historią a mechaniką. Leszy witający gracza
   w Borowej Głuszy uczy tej mapy skuteczniej niż akapit o gospodarce leśnej.

Teksty siedzą w `dane/kraina.json` razem z definicjami miejsc — tak jak dziś
`dane/samouczek.json` i `dane/kodeks.json`. Żadnego tekstu w kodzie.

---

## 5. Co przestaje być prawdą

Do wykreślenia z `CLAUDE.md` i `OSTOJA.md` dopiero **po** etapie 1, nie wcześniej:

- „Jedzenie to jagody i chleb razem" — zostaje, ale dotyczy kosztu osadnika,
  nie konsumpcji.
- „Osada startuje z drewnem, bo brak opału liczy się jak głód" — druga połowa
  znika. Drewno na starcie zostaje jako budulec.
- „Piekarnia jest opałożerna" — zostaje (to wejście receptury, nie utrzymanie).
- Wszystko o `PROG_ODEJSCIA`, dniach głodu i `zapasNaDziecko`.

Zostaje bez zmian i nadal obowiązuje: przybysze zamiast narodzin, chata za samo
drewno, sufit kradzieży domowika, drzewo daje 10 drewna, profil sezonowy
gajówki, pole na jedną osobę, spójność mapy i `zapewnijSpojnosc`, kolejność
warsztatów w bilansie, południca liczy żniwa, reguły o położeniu liczy świat,
budowniczy musi dojść, drzwi u dołu bryły.

---

## 6. Jak mierzyć

Nie zmieniaj liczb, zanim narzędzia nie umieją nowej gry (etap 1a).

```
node --experimental-strip-types narzedzia/symuluj.ts [lata] [ziarno]
node --experimental-strip-types narzedzia/naMapie.ts [lata] [ziarno]
node --experimental-strip-types narzedzia/bilans.ts  [lata] [ziarno]
```

Osiem ziaren po pięć lat, jak dotąd: 1, 5, 8, 42, 777, 1234, 2024, 31337.
Gdy `symuluj.ts` i `naMapie.ts` się rozjadą, prawdę mówi ten drugi.

Stan przed rozpoczęciem tego planu, do porównania: ludność 31–46, zero dni
głodu, zero odejść, 6–8 ulepszeń z ośmiu, plan budowy 28/28 na każdym ziarnie.
Po etapie 1 ludność będzie znaczyć co innego, a dni głodu i odejścia znikną —
dlatego nowe miary muszą powstać wcześniej.

---

## 7. Kolejność

1. ~~Etap 1 (z 1a przed 1b) — koniec zużycia~~ **zrobione**
2. ~~Etap 2 — zapasy na zimę~~ **zrobione**
3. ~~Etap 3 — zakończenia sprintu~~ **zrobione**
4. ~~Etap 4 — wyprawy~~ **zrobione (bez łowów i kamienia — patrz wyżej)**
5. ~~Etap 5 — stopnie osady~~ **zrobione**; wyprawianie osadników razem z etapem 6
6. Etap 6 — kraina

Etapy 1–3 to minimum, które trzyma się kupy samo: bez zakończeń usunięcie
zużycia daje piaskownicę. Od 4 w górę to rozwijanie, nie naprawianie.

Etap 0 tylko wtedy, gdy etap 1 nie zmieści się w jednej sesji.
