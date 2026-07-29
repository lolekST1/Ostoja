/**
 * Ostoja — scena Phasera.
 *
 * Rysuje wyłącznie świat: mapę, budynki i ludzi. Pasek surowców, menu budowy,
 * panele i Kodeks są w DOM (zasada 4), więc tu nie ma ani jednego napisu —
 * kliknięcie w kafelek leci na zewnątrz przez `naKlikniecieKafelka` i to
 * interfejs decyduje, co z nim zrobić.
 *
 * Scena nigdy nie zmienia stanu gry. Czyta go przez `wejscie.stan()` i rysuje.
 */

import Phaser from "phaser";

import type { Dane } from "../sim/budynki.ts";
import { pole as polePo } from "../sim/budynki.ts";
import type {
  Budynek,
  KonfiguracjaMapy,
  Mieszkaniec,
  PoraRoku,
  Punkt,
  StanGry,
  Teren,
  TypBudynku,
} from "../sim/typy.ts";
import { DREWNA_Z_DRZEWA } from "../sim/typy.ts";
import { indeks } from "../sim/mapa.ts";

/**
 * Kafelek ma 32 px, bo grafika Kenneya ma 64 i dzieli się przez dwa bez reszty.
 * Wcześniej było 16 przy przybliżeniu kamery ×2 — na ekranie wychodziło to samo,
 * ale rysunek 64 px zbity do 16 i rozciągnięty z powrotem gubi połowę kresek.
 */
export const ROZMIAR_KAFELKA = 32;

/** Arkusz Kenney Medieval RTS (CC0): 18×7 klatek po 64 px, margines i odstęp 32. */
const ARKUSZ = "kenney";
const KLATKA = 64;

/**
 * Numery klatek w arkuszu. Trzymamy je tutaj, a nie w `dane/`, bo to nie są
 * liczby balansowe (zasada 3) — to jest wybór obrazka, jak kolor kafelka
 * wcześniej.
 */
const KLATKI_TERENU: Record<Teren, number> = {
  laka: 0,
  ziemia: 18,
  woda: 36,
  skala: 20,
  las: 75,
  glina: 93,
};

/**
 * Las i glina mają cztery gęstości. Dzięki temu na mapie widać, ile jeszcze
 * zostało, bez klikania w budynek: krąg wyrobionej leśniczówki rzednie na oczach.
 * Indeks 0 to pustka — wycięty las jest łąką z pniakiem, wybrana glina ziemią.
 */
const GESTOSC_LASU = [72, 73, 74, 75];
const GESTOSC_GLINY = [90, 91, 92, 93];
/** Głaz dorzucany na kafelek skały, żeby czytała się jako przeszkoda, nie jako podłoga. */
const KLATKA_GLAZU = 79;
/** Pniak po wyciętym drzewie. */
const KLATKA_PNIAKA = 62;

const KLATKI_BUDYNKOW: Record<TypBudynku, number> = {
  chata: 113,
  magazyn: 51,
  kapliczka: 32,
  lesniczowka: 117,
  gajowka: 52,
  zbieracze: 118,
  tartak: 115,
  glinianka: 50,
  cegielnia: 116,
  pole: 111,
  mlyn: 53,
  piekarnia: 15,
  bajarz: 14,
};

/** Skrzydła doklejane nad młynem — w arkuszu są osobno od budynku. */
const KLATKA_SKRZYDEL = 71;

/** Ludzie: zielony idzie do roboty, czerwony na budowę, szary nie ma przydziału. */
const KLATKA_ROBOTNIK = 103;
const KLATKA_BUDOWNICZY = 85;
const KLATKA_BEZ_PRZYDZIALU = 120;

/**
 * Gdzie człowiek jest w ułamku `postep` dzisiejszego dnia.
 *
 * Idzie po zapisanej trasie ze stałą prędkością: kroki na ukos są dłuższe niż
 * proste, więc czas dzieli się po rzeczywistej długości odcinków, a nie po ich
 * liczbie. Inaczej chód gubiłby rytm na każdym zakręcie.
 */
function pozycjaNaTrasie(m: Mieszkaniec, postep: number): Punkt {
  const trasa = m.trasa;
  if (!trasa || trasa.length < 2) return { x: m.x, y: m.y };

  const dlugosci: number[] = [];
  let calosc = 0;
  for (let i = 1; i < trasa.length; i++) {
    const d = Math.hypot(trasa[i].x - trasa[i - 1].x, trasa[i].y - trasa[i - 1].y);
    dlugosci.push(d);
    calosc += d;
  }
  if (calosc === 0) return { x: m.x, y: m.y };

  let zostalo = Math.max(0, Math.min(1, postep)) * calosc;
  for (let i = 0; i < dlugosci.length; i++) {
    if (zostalo <= dlugosci[i]) {
      const t = dlugosci[i] === 0 ? 0 : zostalo / dlugosci[i];
      return {
        x: trasa[i].x + (trasa[i + 1].x - trasa[i].x) * t,
        y: trasa[i].y + (trasa[i + 1].y - trasa[i].y) * t,
      };
    }
    zostalo -= dlugosci[i];
  }
  return trasa[trasa.length - 1];
}

/**
 * Pory roku przez zabarwienie całej mapy, nie przez cztery komplety kafelków.
 * Wiosna czysta, lato lekko złote, jesień rdzawa, zima siwa i chłodna.
 */
const BARWY_POR: Record<PoraRoku, number> = {
  wiosna: 0xffffff,
  lato: 0xfff0c8,
  jesien: 0xf0c89a,
  zima: 0xcdd8e8,
};

/** Podgląd stawiania: wolno / wolno, ale pójdzie las pod topór / nie wolno. */
const BARWA_MOZNA = 0x5ad07a;
const BARWA_KARCZOWANIE = 0xe0a33a;
const BARWA_NIE_MOZNA = 0xe5484d;

export interface WejscieSceny {
  dane: Dane;
  /** Do gęstości rysowanego złoża — scena musi wiedzieć, ile znaczy „pełne". */
  konfigMapy: KonfiguracjaMapy;
  /** Getter, nie wartość — stan podmienia się przy wczytaniu zapisu. */
  stan: () => StanGry;
  naKlikniecieKafelka: (kafelek: Punkt, scena: ScenaGry) => void;
  naRuchWskaznika: (kafelek: Punkt, scena: ScenaGry) => void;
  /** Prawy przycisk to zawsze „odwołaj to, co robię". */
  naOdwolanie: (scena: ScenaGry) => void;
  gotowe: (scena: ScenaGry) => void;
  /**
   * Ile dnia już minęło, 0–1. Ludzie idą swoją dzienną trasą dokładnie w tym
   * tempie, więc na pauzie zatrzymują się w pół kroku, a przy 4× biegną.
   */
  postepDnia: () => number;
}

export class ScenaGry extends Phaser.Scene {
  private wejscie: WejscieSceny;

  private teren!: Phaser.GameObjects.RenderTexture;
  /** Bryły budynków. Obrazki, więc trzymamy je po identyfikatorze i dosztukowujemy. */
  private budynkiWarstwa!: Phaser.GameObjects.Container;
  private bryly = new Map<string, Phaser.GameObjects.Image[]>();
  private budynki!: Phaser.GameObjects.Graphics;
  /** Ludzie też są obrazkami — pula po identyfikatorze, bez tworzenia co klatkę. */
  private ludzieWarstwa!: Phaser.GameObjects.Container;
  private ludki = new Map<string, Phaser.GameObjects.Image>();
  private sciezka!: Phaser.GameObjects.Graphics;
  private zaznaczenie!: Phaser.GameObjects.Graphics;
  /** Poświata leszego nad lasem. Ducha nie rysujemy — rysujemy jego gniew. */
  private poswiata!: Phaser.GameObjects.Graphics;
  private leszyZly = false;
  private pulsLeszego?: Phaser.Tweens.Tween;
  private podklad!: Phaser.GameObjects.Graphics;

  /** Skąd zaczęło się wciśnięcie — do odróżnienia kliknięcia od przeciągania. */
  private wcisnietyW: Punkt | null = null;
  private przeciagano = false;


  constructor(wejscie: WejscieSceny) {
    super("gra");
    this.wejscie = wejscie;
  }

  preload(): void {
    this.load.spritesheet(ARKUSZ, "grafika/kenney-medieval-rts.png", {
      frameWidth: KLATKA,
      frameHeight: KLATKA,
      margin: 32,
      spacing: 32,
    });
  }

  create(): void {
    const mapa = this.wejscie.stan().mapa;
    this.teren = this.add
      .renderTexture(
        0,
        0,
        Math.max(1, mapa.szerokosc * ROZMIAR_KAFELKA),
        Math.max(1, mapa.wysokosc * ROZMIAR_KAFELKA),
      )
      .setOrigin(0, 0);
    this.budynkiWarstwa = this.add.container(0, 0);
    this.budynki = this.add.graphics();
    this.podklad = this.add.graphics();
    this.ludzieWarstwa = this.add.container(0, 0);
    this.sciezka = this.add.graphics();
    this.poswiata = this.add.graphics();
    this.zaznaczenie = this.add.graphics();

    this.ustawSterowanieKamera();
    this.odswiez();
    this.wejscie.gotowe(this);
  }

  /** Obrazek z arkusza wpasowany w prostokąt o podanym rozmiarze w pikselach. */
  private obrazek(klatka: number, x: number, y: number, szer: number, wys: number) {
    const img = this.add.image(x, y, ARKUSZ, klatka).setOrigin(0, 0);
    img.setDisplaySize(szer, wys);
    return img;
  }

  // -------------------------------------------------------------------------
  // Rysowanie
  // -------------------------------------------------------------------------

  /** Przerysowuje wszystko od zera. Wołane po wczytaniu zapisu i nowej osadzie. */
  odswiez(): void {
    // Nowa osada albo wczytany zapis to inne budynki i inni ludzie pod tymi
    // samymi identyfikatorami — pule trzeba opróżnić, nie dosztukować.
    for (const obrazki of this.bryly.values()) for (const o of obrazki) o.destroy();
    this.bryly.clear();
    for (const ludek of this.ludki.values()) ludek.destroy();
    this.ludki.clear();

    this.przerysujTeren();
    this.przerysujBudynki();
    this.sciezka.clear();
    this.zaznaczenie.clear();
    this.podklad.clear();

    const mapa = this.wejscie.stan().mapa;
    const szer = mapa.szerokosc * ROZMIAR_KAFELKA;
    const wys = mapa.wysokosc * ROZMIAR_KAFELKA;

    // Widok zaczyna się przybliżony na osadzie, a nie na środku mapy: gracz ma
    // najpierw zobaczyć swoje chaty, a dopiero potem odkrywać okolicę kółkiem.
    const srodek = mapa.start ?? { x: mapa.szerokosc / 2, y: mapa.wysokosc / 2 };
    this.cameras.main.setBounds(0, 0, szer, wys);
    // Przybliżenie 1, bo kafelek urósł z 16 do 32 — na ekranie wychodzi
    // dokładnie tyle samo mapy, co przy dawnym ×2.
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(
      (srodek.x + 0.5) * ROZMIAR_KAFELKA,
      (srodek.y + 0.5) * ROZMIAR_KAFELKA,
    );
  }

  /**
   * Cała mapa idzie do jednej tekstury zamiast do 1600 osobnych obiektów.
   * Teren zmienia się rzadko (wycięte drzewo, wybrana glina), więc taniej jest
   * przerysować go raz na zmianę niż utrzymywać tysiące sprite'ów co klatkę.
   */
  przerysujTeren(): void {
    const mapa = this.wejscie.stan().mapa;
    const szer = Math.max(1, mapa.szerokosc * ROZMIAR_KAFELKA);
    const wys = Math.max(1, mapa.wysokosc * ROZMIAR_KAFELKA);

    if (this.teren.width !== szer || this.teren.height !== wys) {
      this.teren.setSize(szer, wys);
    }
    this.teren.clear();

    // Pędzel: jeden obrazek przestawiany po mapie i odbijany w teksturę.
    // Origin (0,0) i rozmiar kafelka ustawiamy raz, potem tylko przesuwamy.
    const pedzel = this.make
      .image({ key: ARKUSZ, frame: 0, add: false })
      .setOrigin(0, 0)
      .setDisplaySize(ROZMIAR_KAFELKA, ROZMIAR_KAFELKA);

    // Wsadowo, nie po jednym. Każde osobne draw() zamyka partię i czeka na
    // kartę graficzną; przy 1600 kafelkach i przerysowaniu za każdym ściętym
    // drzewem widać z tego zacinanie. beginDraw/endDraw robi to jedną partią.
    this.teren.beginDraw();
    const odbij = (klatka: number, x: number, y: number): void => {
      pedzel.setFrame(klatka);
      this.teren.batchDraw(pedzel, x * ROZMIAR_KAFELKA, y * ROZMIAR_KAFELKA);
    };

    for (let y = 0; y < mapa.wysokosc; y++) {
      for (let x = 0; x < mapa.szerokosc; x++) {
        const k = mapa.kafelki[indeks(mapa, x, y)];

        if (k.teren === "las") {
          // Gęstość drzew pokazuje, ile w kafelku zostało. Krąg wyrobionej
          // leśniczówki rzednie na oczach, bez zaglądania w panel.
          odbij(KLATKI_TERENU.laka, x, y);
          if (k.zasob <= 0) {
            odbij(KLATKA_PNIAKA, x, y); // wycięte: łąka z pniakiem
          } else {
            const ile = Math.min(
              GESTOSC_LASU.length - 1,
              Math.floor((k.zasob / DREWNA_Z_DRZEWA) * GESTOSC_LASU.length),
            );
            odbij(GESTOSC_LASU[Math.max(0, ile)], x, y);
          }
          continue;
        }

        if (k.teren === "glina") {
          // Pełne złoże bierzemy z konfiguracji mapy, a nie na oko: przy
          // wpisanej na sztywno setce świeża glinianka od pierwszego dnia
          // stała na kafelkach wyglądających na prawie wyczerpane.
          const pelne = this.wejscie.konfigMapy.glinaZasob;
          const ile = Math.min(
            GESTOSC_GLINY.length - 1,
            Math.max(0, Math.ceil((k.zasob / pelne) * GESTOSC_GLINY.length) - 1),
          );
          odbij(k.zasob > 0 ? GESTOSC_GLINY[ile] : KLATKI_TERENU.ziemia, x, y);
          continue;
        }

        odbij(KLATKI_TERENU[k.teren], x, y);
        // Skała to podłoga w arkuszu, a w grze przeszkoda — głaz na wierzchu
        // mówi „tędy nie przejdziesz" bez czytania czegokolwiek.
        if (k.teren === "skala") odbij(KLATKA_GLAZU, x, y);
      }
    }

    this.teren.endDraw();
    pedzel.destroy();
    this.pokazPore(this.wejscie.stan().czas.pora);

    // Poświata leży na kafelkach lasu, a las się zmienia — po przerysowaniu
    // terenu trzeba ją policzyć od nowa.
    if (this.leszyZly) this.rysujPoswiate();
  }

  /**
   * Pora roku jako zabarwienie mapy. Jedno wywołanie na cały teren zamiast
   * czterech kompletów kafelków — tak to było zaplanowane od początku, a stało
   * się wykonalne dopiero teraz, gdy teren jest jedną teksturą.
   *
   * Budynków i ludzi nie barwimy: chata ma wyglądać tak samo w lipcu i w styczniu,
   * bo po jej kolorze gracz ją rozpoznaje.
   */
  pokazPore(pora: PoraRoku): void {
    this.teren.setTint(BARWY_POR[pora]);
  }

  /**
   * Gniew leszego: zielona poświata rozlewająca się po lesie.
   *
   * Ducha nie rysujemy (sekcja 9 dokumentu) — rysujemy skutek. Puls jest wolny
   * i miękki, bo to ma niepokoić, a nie migać dziecku przed oczami.
   */
  pokazLeszego(zly: boolean): void {
    if (zly === this.leszyZly) return;
    this.leszyZly = zly;

    this.pulsLeszego?.stop();
    this.pulsLeszego = undefined;
    this.poswiata.clear();
    this.poswiata.setAlpha(1);

    if (!zly) return;

    this.rysujPoswiate();
    this.pulsLeszego = this.tweens.add({
      targets: this.poswiata,
      alpha: { from: 0.45, to: 1 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private rysujPoswiate(): void {
    const mapa = this.wejscie.stan().mapa;
    this.poswiata.clear();
    this.poswiata.fillStyle(0x7fe6a0, 0.3);
    for (let y = 0; y < mapa.wysokosc; y++) {
      for (let x = 0; x < mapa.szerokosc; x++) {
        const k = mapa.kafelki[indeks(mapa, x, y)];
        if (k.teren !== "las" || k.zasob <= 0) continue;
        this.poswiata.fillRect(
          x * ROZMIAR_KAFELKA,
          y * ROZMIAR_KAFELKA,
          ROZMIAR_KAFELKA,
          ROZMIAR_KAFELKA,
        );
      }
    }
  }

  /**
   * Domowik podebrał z magazynu. Duch niewidzialny, więc widać tylko drgnienie
   * budynku — reszta idzie w interfejs, gdzie znikają liczby.
   */
  mrugnijMagazynem(): void {
    const stan = this.wejscie.stan();
    for (const b of stan.budynki) {
      if ((b.typ !== "magazyn" && b.typ !== "kapliczka") || !b.wybudowany) continue;
      const def = this.wejscie.dane.budynki[b.typ];
      const blysk = this.add.graphics();
      blysk.fillStyle(0x2b2118, 0.45);
      blysk.fillRect(
        b.x * ROZMIAR_KAFELKA,
        b.y * ROZMIAR_KAFELKA,
        def.szerokosc * ROZMIAR_KAFELKA,
        def.wysokosc * ROZMIAR_KAFELKA,
      );
      this.tweens.add({
        targets: blysk,
        alpha: 0,
        duration: 700,
        ease: "Quad.easeOut",
        onComplete: () => blysk.destroy(),
      });
    }
  }

  przerysujBudynki(): void {
    const stan = this.wejscie.stan();
    this.budynki.clear();

    // Bryły to obrazki i zostają między klatkami; kasujemy tylko te, których
    // budynek zniknął (rozbiórka albo zwinięty plac budowy).
    const zyje = new Set(stan.budynki.filter((b) => b.wybudowany).map((b) => b.id));
    for (const [id, obrazki] of this.bryly) {
      if (zyje.has(id)) continue;
      for (const o of obrazki) o.destroy();
      this.bryly.delete(id);
    }

    for (const b of stan.budynki) {
      const def = this.wejscie.dane.budynki[b.typ];
      const x = b.x * ROZMIAR_KAFELKA;
      const y = b.y * ROZMIAR_KAFELKA;
      const szer = def.szerokosc * ROZMIAR_KAFELKA;
      const wys = def.wysokosc * ROZMIAR_KAFELKA;

      if (!b.wybudowany) {
        this.rysujPlacBudowy(b, x, y, szer, wys);
        continue;
      }

      let obrazki = this.bryly.get(b.id);
      if (!obrazki) {
        obrazki = this.zbudujBryle(b.typ, x, y, def.szerokosc, def.wysokosc);
        this.budynkiWarstwa.add(obrazki);
        this.bryly.set(b.id, obrazki);
      }

      // Budynek wstrzymany albo zablokowany przez leszego ma być widoczny
      // z lotu ptaka, bez klikania w niego. Przyciemniamy samą bryłę, żeby
      // nie zamalowywać rysunku prostokątem.
      const przygaszony = b.wstrzymany || b.zablokowanyPrzez !== null;
      for (const o of obrazki) {
        o.setTint(b.zablokowanyPrzez ? 0x6f9f7a : przygaszony ? 0x8a8a8a : 0xffffff);
      }

      if (!przygaszony && b.brakZasobu) {
        this.budynki.lineStyle(2, BARWA_NIE_MOZNA, 0.9);
        this.budynki.strokeRect(x, y, szer, wys);
      }
    }
  }

  /**
   * Obrazki składające się na budynek. Zwykle jeden, ale pole to zagon kafelków
   * 4×4 (jeden rozciągnięty rysunek wygląda jak rozmazana plama), a młyn
   * potrzebuje skrzydeł, bo w arkuszu leżą osobno od budynku.
   */
  private zbudujBryle(
    typ: TypBudynku,
    x: number,
    y: number,
    kafelkowSzer: number,
    kafelkowWys: number,
  ): Phaser.GameObjects.Image[] {
    const klatka = KLATKI_BUDYNKOW[typ];

    if (typ === "pole") {
      const zagon: Phaser.GameObjects.Image[] = [];
      for (let ky = 0; ky < kafelkowWys; ky++) {
        for (let kx = 0; kx < kafelkowSzer; kx++) {
          zagon.push(
            this.obrazek(
              klatka,
              x + kx * ROZMIAR_KAFELKA,
              y + ky * ROZMIAR_KAFELKA,
              ROZMIAR_KAFELKA,
              ROZMIAR_KAFELKA,
            ),
          );
        }
      }
      return zagon;
    }

    const szer = kafelkowSzer * ROZMIAR_KAFELKA;
    const wys = kafelkowWys * ROZMIAR_KAFELKA;
    const bryla = this.obrazek(klatka, x, y, szer, wys);
    if (typ !== "mlyn") return [bryla];

    // Skrzydła na wierzchu i w ruchu — młyn ma się kręcić, bo to jedyny
    // budynek, po którym z daleka widać, że osada pracuje.
    const skrzydla = this.add
      .image(x + szer / 2, y + wys / 2, ARKUSZ, KLATKA_SKRZYDEL)
      .setOrigin(0.5, 0.5);
    skrzydla.setDisplaySize(szer * 0.9, wys * 0.9);
    this.tweens.add({
      targets: skrzydla,
      angle: 360,
      duration: 9000,
      repeat: -1,
      ease: "Linear",
    });
    return [bryla, skrzydla];
  }

  /** Rusztowanie z paskiem postępu — widać, że coś powstaje i jak daleko zaszło. */
  private rysujPlacBudowy(
    b: Budynek,
    x: number,
    y: number,
    szer: number,
    wys: number,
  ): void {
    this.budynki.fillStyle(0x000000, 0.18);
    this.budynki.fillRect(x + 1, y + 1, szer - 2, wys - 2);
    this.budynki.lineStyle(1.5, 0xd9c48a, 0.9);
    this.budynki.strokeRect(x + 1, y + 1, szer - 2, wys - 2);

    // Dwie belki na krzyż: rusztowanie, a nie gotowy dom.
    this.budynki.beginPath();
    this.budynki.moveTo(x + 1, y + 1);
    this.budynki.lineTo(x + szer - 1, y + wys - 1);
    this.budynki.moveTo(x + szer - 1, y + 1);
    this.budynki.lineTo(x + 1, y + wys - 1);
    this.budynki.strokePath();

    const pasek = Math.max(2, wys * 0.16);
    this.budynki.fillStyle(0x000000, 0.45);
    this.budynki.fillRect(x + 2, y + wys - pasek - 2, szer - 4, pasek);
    this.budynki.fillStyle(0xffd34d, 1);
    this.budynki.fillRect(
      x + 2,
      y + wys - pasek - 2,
      (szer - 4) * Math.min(1, b.postep),
      pasek,
    );
  }

  /**
   * Ludzie rysują się co klatkę, bo tylko oni ruszają się częściej niż raz na
   * dzień.
   *
   * Symulacja przestawia człowieka raz na dzień o kilka kafelków i zostawia
   * w `m.trasa` drogę, którą przy tym przeszedł. Scena prowadzi go tą samą
   * drogą, kafelek po kafelku, w tempie mijającego dnia. Wcześniejsze
   * dociąganie po prostej dawało dwa widoczne błędy: skok przy każdym ticku
   * (bo wykładnicze dociąganie hamuje przed celem i nigdy go nie dobija)
   * i przecinanie rzek oraz skał na wylot.
   */
  private przerysujLudzi(): void {
    const stan = this.wejscie.stan();
    const postep = this.wejscie.postepDnia();
    const zyje = new Set<string>();

    // Rozsunięcie wachlarzem: pod jednym dachem mieszka do sześciu osób,
    // a bez tego widać jedną kropkę i osada wygląda na wymarłą. Numerujemy po
    // pozycji z symulacji (całe kafelki), nie po rysowanej, żeby kropki nie
    // przeskakiwały miejscami w trakcie marszu.
    const naKafelku = new Map<string, number>();

    const budynkiPo = new Map(stan.budynki.map((b) => [b.id, b]));

    for (const m of stan.mieszkancy) {
      const p = pozycjaNaTrasie(m, postep);
      zyje.add(m.id);

      const klucz = `${m.x},${m.y}`;
      const ktory = naKafelku.get(klucz) ?? 0;
      naKafelku.set(klucz, ktory + 1);

      const kat = (ktory / 6) * Math.PI * 2;
      const odsuniecie = ktory === 0 ? 0 : ROZMIAR_KAFELKA * 0.32;
      const x = (p.x + 0.5) * ROZMIAR_KAFELKA + Math.cos(kat) * odsuniecie;
      const y = (p.y + 0.5) * ROZMIAR_KAFELKA + Math.sin(kat) * odsuniecie;

      let ludek = this.ludki.get(m.id);
      if (!ludek) {
        // Ludek jest mały wewnątrz swojej klatki, więc rysujemy go większym niż
        // kafelek — inaczej dziecko nie widzi, że osada w ogóle żyje.
        ludek = this.add.image(x, y, ARKUSZ, KLATKA_BEZ_PRZYDZIALU).setOrigin(0.5, 0.62);
        ludek.setDisplaySize(ROZMIAR_KAFELKA * 1.5, ROZMIAR_KAFELKA * 1.5);
        this.ludzieWarstwa.add(ludek);
        this.ludki.set(m.id, ludek);
      }
      ludek.setPosition(x, y);

      // Po kolorze widać, czym się ktoś zajmuje: zielony robi swoje, czerwony
      // jest na budowie, szary nie ma przydziału i czeka na miejsce pracy.
      const praca = m.miejscePracy ? budynkiPo.get(m.miejscePracy) : undefined;
      ludek.setFrame(
        praca === undefined
          ? KLATKA_BEZ_PRZYDZIALU
          : praca.wybudowany
            ? KLATKA_ROBOTNIK
            : KLATKA_BUDOWNICZY,
      );
      // Idący w lewo ma być odwrócony — inaczej cała osada maszeruje w bok.
      const nastepny = pozycjaNaTrasie(m, Math.min(1, postep + 0.02));
      if (Math.abs(nastepny.x - p.x) > 1e-6) ludek.setFlipX(nastepny.x < p.x);
    }

    for (const [id, ludek] of this.ludki) {
      if (zyje.has(id)) continue;
      ludek.destroy();
      this.ludki.delete(id);
    }
  }

  update(): void {
    this.przerysujLudzi();
  }

  /** Rysuje drogę policzoną przez A*. null kasuje poprzednią. */
  pokazSciezke(kroki: Punkt[] | null, skad: Punkt | null): void {
    this.sciezka.clear();
    if (!kroki || !skad || kroki.length === 0) return;

    this.sciezka.lineStyle(3, 0xffd34d, 0.95);
    this.sciezka.beginPath();
    this.sciezka.moveTo((skad.x + 0.5) * ROZMIAR_KAFELKA, (skad.y + 0.5) * ROZMIAR_KAFELKA);
    for (const krok of kroki) {
      this.sciezka.lineTo((krok.x + 0.5) * ROZMIAR_KAFELKA, (krok.y + 0.5) * ROZMIAR_KAFELKA);
    }
    this.sciezka.strokePath();
  }

  podswietl(kafelek: Punkt | null, udane = true): void {
    this.zaznaczenie.clear();
    if (!kafelek) return;
    this.zaznaczenie.lineStyle(2, udane ? 0xffffff : BARWA_NIE_MOZNA, 1);
    this.zaznaczenie.strokeRect(
      kafelek.x * ROZMIAR_KAFELKA + 1,
      kafelek.y * ROZMIAR_KAFELKA + 1,
      ROZMIAR_KAFELKA - 2,
      ROZMIAR_KAFELKA - 2,
    );
  }

  /** Obrys budynku plus jego promień zbioru. Do zaznaczania i do podglądu budowy. */
  zaznaczBudynek(b: Budynek | null): void {
    this.zaznaczenie.clear();
    if (!b) return;
    const def = this.wejscie.dane.budynki[b.typ];
    this.zaznaczenie.lineStyle(2, 0xffffff, 1);
    this.zaznaczenie.strokeRect(
      b.x * ROZMIAR_KAFELKA,
      b.y * ROZMIAR_KAFELKA,
      def.szerokosc * ROZMIAR_KAFELKA,
      def.wysokosc * ROZMIAR_KAFELKA,
    );
    this.rysujPromien(this.zaznaczenie, b, b.typ, 0xffffff);
  }

  /**
   * Przewija kamerę na budynek. Panel „gdzie się korkuje" wypisuje winowajcę
   * ze współrzędnymi, a bez tego gracz musiałby szukać go wzrokiem po całej
   * planszy — zwykle gdzieś za lasem, poza kadrem.
   */
  pokazBudynek(b: Budynek): void {
    const def = this.wejscie.dane.budynki[b.typ];
    this.cameras.main.pan(
      (b.x + def.szerokosc / 2) * ROZMIAR_KAFELKA,
      (b.y + def.wysokosc / 2) * ROZMIAR_KAFELKA,
      350,
      "Sine.easeInOut",
    );
  }

  /**
   * Podkład pod kursorem w trybie budowy: bryła budynku i — dla zbierających —
   * krąg, z którego będą brać. Bez tego kręgu gracz stawia leśniczówkę „gdzieś
   * przy lesie" i dopiero po tygodniu widzi, że nie sięga do drzew.
   */
  pokazPodklad(
    rog: Punkt | null,
    typ: TypBudynku | null,
    mozna: boolean,
    karczowanie = false,
  ): void {
    this.podklad.clear();
    if (!rog || !typ) return;

    const def = this.wejscie.dane.budynki[typ];
    const barwa = !mozna
      ? BARWA_NIE_MOZNA
      : karczowanie
        ? BARWA_KARCZOWANIE
        : BARWA_MOZNA;

    this.podklad.fillStyle(barwa, 0.35);
    this.podklad.fillRect(
      rog.x * ROZMIAR_KAFELKA,
      rog.y * ROZMIAR_KAFELKA,
      def.szerokosc * ROZMIAR_KAFELKA,
      def.wysokosc * ROZMIAR_KAFELKA,
    );
    this.podklad.lineStyle(2, barwa, 1);
    this.podklad.strokeRect(
      rog.x * ROZMIAR_KAFELKA,
      rog.y * ROZMIAR_KAFELKA,
      def.szerokosc * ROZMIAR_KAFELKA,
      def.wysokosc * ROZMIAR_KAFELKA,
    );

    this.rysujPromien(this.podklad, rog, typ, barwa);
  }

  private rysujPromien(
    rysik: Phaser.GameObjects.Graphics,
    rog: Punkt,
    typ: TypBudynku,
    barwa: number,
  ): void {
    const def = this.wejscie.dane.budynki[typ];
    if (def.promien <= 0) return;

    // Promień po ulepszeniach, nie z definicji — po „wozie i ścieżkach" krąg
    // ma urosnąć na oczach gracza, inaczej ulepszenie wygląda na nic.
    const promien = polePo(
      this.wejscie.dane,
      this.wejscie.stan().ulepszenia,
      typ,
      "promien",
    );

    rysik.lineStyle(1.5, barwa, 0.55);
    rysik.strokeCircle(
      (rog.x + def.szerokosc / 2) * ROZMIAR_KAFELKA,
      (rog.y + def.wysokosc / 2) * ROZMIAR_KAFELKA,
      promien * ROZMIAR_KAFELKA,
    );
  }

  // -------------------------------------------------------------------------
  // Kamera i klikanie
  // -------------------------------------------------------------------------

  private ustawSterowanieKamera(): void {
    const kamera = this.cameras.main;

    this.input.on("pointerdown", (wskaznik: Phaser.Input.Pointer) => {
      if (wskaznik.rightButtonDown()) {
        this.wejscie.naOdwolanie(this);
        return;
      }
      this.wcisnietyW = { x: wskaznik.x, y: wskaznik.y };
      this.przeciagano = false;
    });

    this.input.on("pointermove", (wskaznik: Phaser.Input.Pointer) => {
      if (!wskaznik.isDown || !this.wcisnietyW) {
        const kafelek = this.kafelekPod(wskaznik);
        if (kafelek) this.wejscie.naRuchWskaznika(kafelek, this);
        return;
      }
      const odleglosc =
        Math.abs(wskaznik.x - this.wcisnietyW.x) + Math.abs(wskaznik.y - this.wcisnietyW.y);
      // Kilka pikseli luzu, żeby drgnięcie ręki nie zamieniało kliknięcia
      // w przeciąganie mapy.
      if (odleglosc > 6) this.przeciagano = true;
      if (!this.przeciagano) return;

      kamera.scrollX -= (wskaznik.x - wskaznik.prevPosition.x) / kamera.zoom;
      kamera.scrollY -= (wskaznik.y - wskaznik.prevPosition.y) / kamera.zoom;
    });

    this.input.on("pointerup", (wskaznik: Phaser.Input.Pointer) => {
      if (!this.przeciagano && !wskaznik.rightButtonReleased()) {
        const kafelek = this.kafelekPod(wskaznik);
        if (kafelek) this.wejscie.naKlikniecieKafelka(kafelek, this);
      }
      this.wcisnietyW = null;
      this.przeciagano = false;
    });

    this.input.on(
      "wheel",
      (wskaznik: Phaser.Input.Pointer, _obiekty: unknown, _dx: number, dy: number) => {
        const przed = kamera.getWorldPoint(wskaznik.x, wskaznik.y);
        kamera.setZoom(Phaser.Math.Clamp(kamera.zoom * (1 - dy * 0.0015), 0.5, 4));
        // Przybliżamy do kursora, nie do środka ekranu: inaczej przy każdym
        // ruchu kółka trzeba by ręcznie doganiać to, co się oglądało.
        const po = kamera.getWorldPoint(wskaznik.x, wskaznik.y);
        kamera.scrollX += przed.x - po.x;
        kamera.scrollY += przed.y - po.y;
      },
    );

    const klawisze = this.input.keyboard?.createCursorKeys();
    if (klawisze) {
      this.events.on("update", () => {
        const krok = 6 / kamera.zoom;
        if (klawisze.left.isDown) kamera.scrollX -= krok;
        if (klawisze.right.isDown) kamera.scrollX += krok;
        if (klawisze.up.isDown) kamera.scrollY -= krok;
        if (klawisze.down.isDown) kamera.scrollY += krok;
      });
    }
  }

  private kafelekPod(wskaznik: Phaser.Input.Pointer): Punkt | null {
    const mapa = this.wejscie.stan().mapa;
    const swiat = this.cameras.main.getWorldPoint(wskaznik.x, wskaznik.y);
    const kafelek = {
      x: Math.floor(swiat.x / ROZMIAR_KAFELKA),
      y: Math.floor(swiat.y / ROZMIAR_KAFELKA),
    };
    if (
      kafelek.x < 0 ||
      kafelek.y < 0 ||
      kafelek.x >= mapa.szerokosc ||
      kafelek.y >= mapa.wysokosc
    ) {
      return null;
    }
    return kafelek;
  }
}
