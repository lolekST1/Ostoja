/**
 * Ostoja — lista ulepszeń.
 *
 * Bajarz zamienia chleb w opowieści, a opowieści w ulepszenia — i przez długi
 * czas to zdanie było w grze nieprawdą. Dane, silnik efektów i scena
 * rysująca powiększony krąg istniały od początku, ale **nie było gdzie kliknąć**:
 * opowieści rosły w spiżarni bez końca, a panel „gdzie się korkuje" odsyłał
 * gracza po „wóz i ścieżki", których nie dało się wziąć. Ta lista to domyka.
 *
 * Zwykły HTML (zasada 4). Niczego nie liczy — kupno idzie przez
 * `kupUlepszenie` z `sim/budynki.ts`, tę samą funkcję co w narzędziach.
 */

import type { Dane } from "../sim/budynki.ts";
import { ulepszeniaPoKoszcie } from "../sim/budynki.ts";
import type { IdUlepszenia, StanGry } from "../sim/typy.ts";

export interface MenuUlepszen {
  odswiez: (stan: StanGry) => void;
}

export function utworzMenuUlepszen(
  el: HTMLElement,
  dane: Dane,
  naKupno: (id: IdUlepszenia) => void,
): MenuUlepszen {
  el.innerHTML = "<h2>Ulepszenia</h2>";

  const wstep = document.createElement("p");
  wstep.className = "drobne";
  el.append(wstep);

  const lista = document.createElement("div");
  lista.className = "lista-budowy";
  const guziki = new Map<
    IdUlepszenia,
    { guzik: HTMLButtonElement; stanik: HTMLElement }
  >();

  for (const def of ulepszeniaPoKoszcie(dane)) {
    const guzik = document.createElement("button");
    guzik.className = "budynek";
    guzik.title = def.opis;
    guzik.innerHTML =
      `<span class="naglowek">` +
      `<span class="nazwa">${def.nazwa}</span>` +
      `<span class="ile"></span>` +
      `</span>` +
      `<span class="koszt">${def.koszt} opowieści</span>` +
      `<span class="po-co">${def.opis}</span>` +
      `<span class="brak"></span>`;
    guzik.addEventListener("click", () => naKupno(def.id));

    guziki.set(def.id, { guzik, stanik: guzik.querySelector(".brak")! });
    lista.append(guzik);
  }
  el.append(lista);

  return {
    odswiez(stan) {
      const maBajarza = stan.budynki.some((b) => b.typ === "bajarz" && b.wybudowany);
      const opowiesci = Math.floor(stan.pula.opowiesc);

      // Bez bajarza opowieści nie ma skąd wziąć i cała lista jest zagadką.
      // Mówimy więc, czego brakuje, a nie „nie stać cię".
      wstep.textContent = maBajarza
        ? `Opowieści w zapasie: ${opowiesci}.`
        : "Opowieści robi bajarz. Bez jego chaty ta lista zostaje na papierze.";

      for (const [id, { guzik, stanik }] of guziki) {
        const def = dane.ulepszenia.find((u) => u.id === id)!;
        const juz = stan.ulepszenia.includes(id);
        const stac = opowiesci >= def.koszt;

        guzik.disabled = juz || !stac;
        guzik.classList.toggle("wykupione", juz);
        stanik.textContent = juz
          ? ""
          : stac
            ? ""
            : `brakuje ${def.koszt - opowiesci} opowieści`;

        const znacznik = guzik.querySelector(".ile")!;
        znacznik.textContent = juz ? "✓" : "";
        znacznik.classList.toggle("zero", !juz);
      }
    },
  };
}
