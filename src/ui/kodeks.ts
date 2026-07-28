/**
 * Ostoja — Kodeks.
 *
 * Osobny ekran nałożony na grę. Wpis otwiera się sam po pierwszym spotkaniu
 * z duchem i rozszerza, gdy z duchem stanie przymierze.
 *
 * Zasada 6: nic się tu nie odblokowuje przez odpowiedź na pytanie. Kodeks nie
 * pyta i nie sprawdza — czyta go ten, kto chce, a odblokowuje go to, co gracz
 * przeżył w grze. W chwili, gdy pojawiłoby się okienko „ile mąki na chleb",
 * gra przestałaby uczyć i zaczęła odpytywać.
 */

export interface Przymierze {
  id: string;
  tekst: string;
}

export interface WpisKodeksu {
  id: string;
  nazwa: string;
  takze: string;
  wGrze: string;
  wierzenie: string;
  gdzie: string;
  przymierze: Przymierze;
}

export interface Kodeks {
  otworz: () => void;
  zamknij: () => void;
  czyOtwarty: () => boolean;
  /** Przerysowuje treść, gdy doszedł nowy wpis. */
  odswiez: (odblokowane: string[]) => void;
}

export function utworzKodeks(
  el: HTMLElement,
  wpisy: WpisKodeksu[],
  naZamkniecie: () => void,
): Kodeks {
  let otwarty = false;
  let narysowano = -1;

  function rysuj(odblokowane: string[]): void {
    const srodek = document.createElement("div");
    srodek.className = "kodeks-srodek";

    const naglowek = document.createElement("div");
    naglowek.className = "kodeks-naglowek";
    naglowek.innerHTML = "<h2>Kodeks</h2>";
    const zamknij = document.createElement("button");
    zamknij.textContent = "Zamknij";
    zamknij.addEventListener("click", () => naZamkniecie());
    naglowek.append(zamknij);
    srodek.append(naglowek);

    // Przymierze samo w sobie jest spotkaniem: kto nigdy nie rozgniewał leszego,
    // a doczekał się jego przychylności, też ma prawo przeczytać, kim ten duch był.
    const znane = wpisy.filter(
      (w) => odblokowane.includes(w.id) || odblokowane.includes(w.przymierze.id),
    );
    if (znane.length === 0) {
      const pusto = document.createElement("p");
      pusto.className = "drobne";
      pusto.textContent =
        "Jeszcze pusto. Wpisy otwierają się same, gdy spotkasz ducha w grze — " +
        "nie ma tu żadnych pytań do odpowiedzenia.";
      srodek.append(pusto);
    }

    for (const w of znane) {
      const kafel = document.createElement("article");
      kafel.className = "kodeks-wpis";
      const maPrzymierze = odblokowane.includes(w.przymierze.id);

      kafel.innerHTML =
        `<h3>${w.nazwa}</h3>` +
        `<p class="takze">nazywany też: ${w.takze}</p>` +
        `<p class="w-grze"><b>W grze:</b> ${w.wGrze}</p>` +
        `<p>${w.wierzenie}</p>` +
        `<p class="gdzie">${w.gdzie}</p>` +
        (maPrzymierze
          ? `<p class="przymierze"><b>Przymierze:</b> ${w.przymierze.tekst}</p>`
          : `<p class="drobne">Ten duch może jeszcze zmienić zdanie o twojej osadzie.</p>`);
      srodek.append(kafel);
    }

    // Zamknięte wpisy widać jako sylwetki — dziecko ma wiedzieć, że coś tam
    // jeszcze jest, ale nie ma się z czego uczyć na zapas.
    const nieznane = wpisy.length - znane.length;
    if (nieznane > 0) {
      const cien = document.createElement("p");
      cien.className = "drobne";
      cien.textContent = `Nierozpoznanych duchów: ${nieznane}.`;
      srodek.append(cien);
    }

    el.innerHTML = "";
    el.append(srodek);
  }

  // Kliknięcie w tło zamyka — tak samo jak Escape, obsługiwane w main.ts.
  el.addEventListener("click", (zdarzenie) => {
    if (zdarzenie.target === el) naZamkniecie();
  });

  return {
    otworz() {
      otwarty = true;
      el.classList.add("widoczny");
    },
    zamknij() {
      otwarty = false;
      el.classList.remove("widoczny");
    },
    czyOtwarty: () => otwarty,
    odswiez(odblokowane) {
      // Przerysowujemy tylko przy zmianie: inaczej lista przeskakiwałaby pod
      // palcem przy każdym dniu gry. Licznik zaczyna od -1, żeby pierwsze
      // wywołanie narysowało także pusty Kodeks.
      if (odblokowane.length === narysowano) return;
      narysowano = odblokowane.length;
      rysuj(odblokowane);
    },
  };
}
