# Ostoja – wyniki pomiarów balansu

> Przeniesione z CLAUDE.md 5.11.2026, żeby nie ładowało się w każdej sesji. Treść bez zmian.

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
| Wierzbnica | 72–78 | 0.87–1.27 | 75 | 1.12 |
| Borowa Głusza | 53–68 | 0.83–0.89 | 63 | 0.864 |
| Jezierzysko | 67–78 | 1.43–2.35 | 74 | 2.1 |
| Złote Łany | 66–75 | 0.87–2.02 | 74 | 1.8 |
| Kamieniec | 58–73 | 1.04–1.85 | 71 | 1.5 |

Liczby są **po przeniesieniu piekarni na Osadę**: chleb wchodzi do gry o kilka
miesięcy wcześniej, więc ludność wszędzie skoczyła o kilka osób i wszystkie
progi trzeba było przestroić. Wcześniejsze wartości (67–72 na Wierzbnicy, próg
71) opisują grę, w której cały drugi stopień produkował mąkę bez odbiorcy.

Borowa Głusza jest najtrudniejsza ludnościowo (sam bór, łąki jak na lekarstwo),
Kamieniec drugi z kolei. Na każdym miejscu każde z czterech zakończeń pada
1–4 razy na 8 i żadne poza „zapobiegliwą" nie pada zawsze — a tej gracz
z `bezzapasow` nie dostaje ani razu. Komplet czterech: 3 przebiegi na 40.

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
