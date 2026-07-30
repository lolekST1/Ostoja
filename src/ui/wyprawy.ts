/**
 * Ostoja — lista wypraw i wyprawy w drodze.
 *
 * Wyprawa to jedyna rzecz w tej grze, którą można zrobić, **nie mając na nic
 * surowców**. Dlatego lista stoi pod menu budowy: gdy wszystko jest za drogie
 * i gracz nie wie, co dalej, to jest miejsce, w które ma spojrzeć.
 *
 * Zwykły HTML (zasada 4). Niczego nie liczy — liczby przychodzą gotowe
 * z `src/sim/wyprawy.ts`.
 */

import type { DefinicjaWyprawy, StanGry, Surowiec, Wyprawa } from "../sim/typy.ts";

const NAZWY_SUROWCOW: Record<Surowiec, string> = {
  drewno: "drewna",
  deska: "desek",
  glina: "gliny",
  cegla: "cegieł",
  zboze: "zboża",
  maka: "mąki",
  jagody: "jagód",
  ryba: "ryb",
  chleb: "chleba",
  opowiesc: "opowieści",
};

export interface MenuWypraw {
  odswiez: (stan: StanGry, wolneRece: number, wybrana: string | null) => void;
}

function opisLadunku(ladunek: Partial<Record<Surowiec, number>>): string {
  const wpisy = Object.entries(ladunek).filter(([, ile]) => (ile ?? 0) > 0);
  if (wpisy.length === 0) return "nic";
  return wpisy
    .map(([s, ile]) => `${Math.floor(ile as number)} ${NAZWY_SUROWCOW[s as Surowiec]}`)
    .join(", ");
}

export function utworzMenuWypraw(
  el: HTMLElement,
  wyprawy: DefinicjaWyprawy[],
  naWybor: (rodzaj: string | null) => void,
): MenuWypraw {
  el.innerHTML = "<h2>Wyprawy</h2>";

  const wstep = document.createElement("p");
  wstep.className = "drobne";
  el.append(wstep);

  const lista = document.createElement("div");
  lista.className = "lista-budowy";
  const guziki = new Map<string, HTMLButtonElement>();

  for (const def of wyprawy) {
    const guzik = document.createElement("button");
    guzik.className = "budynek";
    guzik.title = def.opis;
    guzik.innerHTML =
      `<span class="naglowek"><span class="nazwa">${def.nazwa}</span></span>` +
      `<span class="po-co">${def.opis}</span>`;
    guzik.addEventListener("click", () => {
      naWybor(guzik.classList.contains("wybrany") ? null : def.id);
    });
    guziki.set(def.id, guzik);
    lista.append(guzik);
  }
  el.append(lista);

  const wDrodze = document.createElement("div");
  wDrodze.className = "w-drodze";
  el.append(wDrodze);

  return {
    odswiez(stan: StanGry, wolneRece: number, wybrana) {
      // Bez wolnych rąk nie ma kogo wysłać — i to jest cała prawda o wyprawach:
      // biorą wyłącznie tych, którzy i tak stoją bezczynnie.
      wstep.textContent =
        wolneRece > 0
          ? `Bez roboty stoi ${wolneRece} ${wolneRece === 1 ? "osoba" : "osób"}. ` +
            `Wybierz wyprawę i kliknij, dokąd mają iść.`
          : "Nikt nie stoi bez roboty. Wstrzymaj jakiś budynek, żeby zwolnić ręce.";

      for (const [id, guzik] of guziki) {
        guzik.disabled = wolneRece === 0;
        guzik.classList.toggle("wybrany", wybrana === id);
      }

      wDrodze.innerHTML = "";
      if (stan.wyprawy.length === 0) return;

      const naglowek = document.createElement("h3");
      naglowek.textContent = "W drodze";
      wDrodze.append(naglowek);

      for (const w of stan.wyprawy) {
        const def = wyprawy.find((d) => d.id === w.rodzaj);
        const wiersz = document.createElement("p");
        wiersz.className = "wyprawa";
        wiersz.textContent =
          `${def?.nazwa ?? w.rodzaj}: ${w.ludzie.length} ` +
          `${w.ludzie.length === 1 ? "osoba" : "osób"}, wróci za ` +
          `${w.dniDoPowrotu} ${w.dniDoPowrotu === 1 ? "dzień" : "dni"} ` +
          `z ${opisLadunku(w.ladunek)}.`;
        wDrodze.append(wiersz);
      }
    },
  };
}

/** Krótki opis tego, co przyniesie wyprawa — do podpowiedzi pod mapą. */
export function opisWyprawy(
  def: DefinicjaWyprawy,
  ludzi: number,
  dni: number,
  ladunek: Partial<Record<Surowiec, number>>,
): string {
  return (
    `${def.nazwa}: pójdzie ${ludzi} ${ludzi === 1 ? "osoba" : "osób"}, ` +
    `wróci za ${dni} dni z ${opisLadunku(ladunek)}.`
  );
}

export type { Wyprawa };
