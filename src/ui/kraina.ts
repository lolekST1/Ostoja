/**
 * Ostoja — ekran wprowadzenia do miejsca w krainie.
 *
 * Wzór to Settlers II i nie z sentymentu: ta gra robi jedną rzecz, której nie
 * robi żadna lista celów — **opowiada dalej**. Kolejna mapa nie jest kolejnym
 * poziomem, jest następnym miejscem w tej samej podróży, a dziecko siada do
 * niej, bo chce wiedzieć, co dalej z ludźmi, których prowadzi.
 *
 * Cztery zasady widać w kodzie:
 * - droga przez krainę stoi u góry, na tym samym ekranie. Osobny „wybór
 *   poziomu" zamieniłby opowieść w menu, a odsłonięte po kolei miejsca mówią
 *   „jesteś tutaj" bez ani jednego zdania;
 * - **jeden guzik dalej i ani jednego pytania** (zasada 6 z `CLAUDE.md`).
 *   To ekran do przeczytania, nie do przeklikania;
 * - tekst mówi o ludziach i o miejscu, nigdy o liczbach — cele i tak stoją
 *   w wykazie zakończeń;
 * - wszystkie zdania siedzą w `dane/kraina.json`, żadnego w kodzie.
 *
 * Zwykły HTML nałożony na canvas (zasada 4).
 */

import type { DefinicjaMiejsca, Kraina, StanKrainy } from "../sim/kraina.ts";
import { czyOtwarte, czyPrzebyte, numerMiejsca, skadPrzyszli } from "../sim/kraina.ts";

export interface EkranKrainy {
  pokaz: (miejsce: DefinicjaMiejsca, stanKrainy: StanKrainy) => void;
  ukryj: () => void;
  czyWidoczny: () => boolean;
}

/**
 * Pasek drogi: pięć miejsc w kolejności, odsłanianych po kolei. Przebyte mają
 * nazwę, bieżące jest podświetlone, dalszych nie nazywamy — miejsce, o którym
 * gracz nie ma jeszcze prawa wiedzieć, jest kreską, a nie nazwą pod kłódką.
 */
function rysujDroge(kraina: Kraina, stanKrainy: StanKrainy): HTMLElement {
  const pasek = document.createElement("ol");
  pasek.className = "droga";

  for (const m of kraina.miejsca) {
    const punkt = document.createElement("li");
    const otwarte = czyOtwarte(kraina, stanKrainy, m.id);
    const teraz = m.id === stanKrainy.biezace;

    punkt.className = teraz ? "teraz" : czyPrzebyte(stanKrainy, m.id) ? "przebyte" : "dalej";
    punkt.textContent = otwarte ? m.nazwa : "•••";
    if (otwarte && !teraz) punkt.title = m.teren;
    pasek.append(punkt);
  }
  return pasek;
}

export function utworzEkranKrainy(
  el: HTMLElement,
  kraina: Kraina,
  naStart: () => void,
): EkranKrainy {
  let widoczny = false;

  function rysuj(miejsce: DefinicjaMiejsca, stanKrainy: StanKrainy): void {
    el.innerHTML = "";

    const srodek = document.createElement("div");
    srodek.className = "koniec-srodek kraina-srodek";

    srodek.append(rysujDroge(kraina, stanKrainy));

    const naglowek = document.createElement("div");
    naglowek.className = "koniec-naglowek";
    const numer = numerMiejsca(kraina, miejsce.id) + 1;
    naglowek.innerHTML =
      `<h2>${miejsce.nazwa}</h2>` +
      `<p class="drobne">Miejsce ${numer} z ${kraina.miejsca.length} — ${miejsce.teren}.</p>`;
    srodek.append(naglowek);

    for (const akapit of miejsce.wprowadzenie) {
      const p = document.createElement("p");
      p.className = "wprowadzenie";
      p.textContent = akapit;
      srodek.append(p);
    }

    // Duch prowadzący odzywa się jednym zdaniem i to on jest łącznikiem między
    // historią a mechaniką. Leszy witający gracza uczy tej mapy skuteczniej
    // niż akapit o gospodarce leśnej.
    const duch = document.createElement("blockquote");
    duch.className = "duch-mowi";
    duch.textContent = miejsce.duchMowi;
    srodek.append(duch);

    // Kto przyszedł z poprzednich miejsc i co umie. Na pierwszej mapie pusto,
    // i tak ma być — nikt jeszcze nigdzie nie był.
    const bagaz = skadPrzyszli(kraina, miejsce.id);
    if (bagaz.length > 0) {
      const lista = document.createElement("ul");
      lista.className = "bagaz";
      for (const zdanie of bagaz) {
        const wiersz = document.createElement("li");
        wiersz.textContent = zdanie;
        lista.append(wiersz);
      }
      srodek.append(lista);
    }

    const guziki = document.createElement("div");
    guziki.className = "koniec-guziki";
    const dalej = document.createElement("button");
    dalej.textContent = "Zaczynamy";
    dalej.addEventListener("click", naStart);
    guziki.append(dalej);
    srodek.append(guziki);

    el.append(srodek);
    dalej.focus();
  }

  function ukryj(): void {
    widoczny = false;
    el.classList.remove("widoczny");
  }

  return {
    pokaz(miejsce, stanKrainy) {
      rysuj(miejsce, stanKrainy);
      widoczny = true;
      el.classList.add("widoczny");
    },
    ukryj,
    czyWidoczny: () => widoczny,
  };
}
