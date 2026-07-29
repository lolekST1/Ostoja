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

### Etap 0 — ratunek (opcjonalny)

Do zrobienia **tylko wtedy, gdy etap 1 nie zmieści się w jednej sesji** — inaczej
to praca do wyrzucenia. Trzy zmiany w `tick.ts`, pół dnia:

- opał przestaje naliczać ten sam licznik co głód,
- progi odejścia rozjeżdżają się między ludźmi zamiast wypadać tego samego dnia,
- pasek ostrzega z wyprzedzeniem, nie w dniu jedenastym.

Etap 1 kasuje to wszystko.

### Etap 1 — koniec zużycia

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

### Etap 2 — zapasy na zimę

Jesienią pojawia się jedna decyzja: **Zapasy na zimę**, koszt zależny od
ludności (rząd wielkości: 1 drewno + 1 jedzenie na osobę), okno przez całą
jesień, panel odlicza dni.

- **Zrobione:** zima normalna, produkcja bez kary, przybysze przychodzą dalej.
- **Nie zrobione:** produkcja z zewnątrz ×0.3, przybysze nie przychodzą.
  **Nikt nie umiera, nic się nie zabiera.** Tracisz kwartał rozwoju.

Zamienia najbardziej frustrującą mechanikę w grze w jej najlepszą lekcję,
i robi to zgodnie z zasadą 1: to inwestycja, nie podatek.

### Etap 3 — zakończenia sprintu

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

### Etap 4 — wyprawy

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

### Etap 5 — stopnie osady i wyprawianie osadników

| stopień | warunek (czyn, nie liczba) | odblokowuje |
|---|---|---|
| **Polana** | start | chata, magazyn, zbieracze, leśniczówka, gajówka, tartak |
| **Osada** | stoi kapliczka + przeżyta zima z zapasami | glinianka, cegielnia, pole, młyn |
| **Gród** | zawarte przymierze + drugi rok z zapasami | piekarnia, bajarz, ulepszenia |

Awans to wydarzenie: wpis w Kodeksie, nowe kafelki w liście budowy. Dziś
wszystkie trzynaście budynków jest dostępnych w dniu pierwszym — dla dziecka
to ściana, a po godzinie nie ma już nic nowego do odkrycia.

**Gród zmienia cel z rośnięcia na wyprawianie osadników.** Wóz, zapasy, kilkoro
ludzi. To rozwiązuje problem piątego roku: bez ubytków późna gra jest samym
dokładaniem trzydziestego pierwszego budynku. I jest dosłownie przejściem do
następnego węzła kampanii.

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

1. Etap 1 (z 1a przed 1b) — koniec zużycia
2. Etap 2 — zapasy na zimę
3. Etap 3 — zakończenia sprintu
4. Etap 4 — wyprawy
5. Etap 5 — stopnie i wyprawianie osadników
6. Etap 6 — kraina

Etapy 1–3 to minimum, które trzyma się kupy samo: bez zakończeń usunięcie
zużycia daje piaskownicę. Od 4 w górę to rozwijanie, nie naprawianie.

Etap 0 tylko wtedy, gdy etap 1 nie zmieści się w jednej sesji.
