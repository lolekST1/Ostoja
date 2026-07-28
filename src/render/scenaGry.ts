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
import type { Budynek, Punkt, StanGry, Teren, TypBudynku } from "../sim/typy.ts";
import { DREWNA_Z_DRZEWA } from "../sim/typy.ts";
import { indeks } from "../sim/mapa.ts";

export const ROZMIAR_KAFELKA = 16;

const BARWY_TERENU: Record<Teren, number> = {
  las: 0x2f5d3a,
  laka: 0x7fa650,
  glina: 0xb07a4a,
  woda: 0x3b6ea5,
  skala: 0x7d7d85,
  ziemia: 0x8b6f47,
};

/** Drobne przyciemnienie części kafelków, żeby duże połacie nie były płaskie. */
const CIEN = 0x000000;

const BARWY_BUDYNKOW: Record<string, number> = {
  magazyn: 0xe8d8a0,
  kapliczka: 0xd9d2c5,
  chata: 0xc98b52,
  pole: 0xc8b05a,
};
const BARWA_BUDYNKU = 0xb07f4f;

/** Podgląd stawiania: wolno / wolno, ale pójdzie las pod topór / nie wolno. */
const BARWA_MOZNA = 0x5ad07a;
const BARWA_KARCZOWANIE = 0xe0a33a;
const BARWA_NIE_MOZNA = 0xe5484d;

export interface WejscieSceny {
  dane: Dane;
  /** Getter, nie wartość — stan podmienia się przy wczytaniu zapisu. */
  stan: () => StanGry;
  naKlikniecieKafelka: (kafelek: Punkt, scena: ScenaGry) => void;
  naRuchWskaznika: (kafelek: Punkt, scena: ScenaGry) => void;
  /** Prawy przycisk to zawsze „odwołaj to, co robię". */
  naOdwolanie: (scena: ScenaGry) => void;
  gotowe: (scena: ScenaGry) => void;
}

export class ScenaGry extends Phaser.Scene {
  private wejscie: WejscieSceny;

  private teren!: Phaser.GameObjects.Image;
  private budynki!: Phaser.GameObjects.Graphics;
  private ludzie!: Phaser.GameObjects.Graphics;
  private sciezka!: Phaser.GameObjects.Graphics;
  private zaznaczenie!: Phaser.GameObjects.Graphics;
  private podklad!: Phaser.GameObjects.Graphics;

  /** Skąd zaczęło się wciśnięcie — do odróżnienia kliknięcia od przeciągania. */
  private wcisnietyW: Punkt | null = null;
  private przeciagano = false;

  /**
   * Gdzie ludzie są narysowani w tej chwili. Symulacja przesuwa ich raz na dzień
   * o kilka kafelków naraz, więc bez dogadywania ruchu między dniami osada
   * wyglądałaby jak seria teleportacji. To wyłącznie stan rysowania — kopia,
   * nie źródło prawdy.
   */
  private pozycje = new Map<string, { x: number; y: number }>();

  constructor(wejscie: WejscieSceny) {
    super("gra");
    this.wejscie = wejscie;
  }

  create(): void {
    this.teren = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0);
    this.budynki = this.add.graphics();
    this.podklad = this.add.graphics();
    this.ludzie = this.add.graphics();
    this.sciezka = this.add.graphics();
    this.zaznaczenie = this.add.graphics();

    this.ustawSterowanieKamera();
    this.odswiez();
    this.wejscie.gotowe(this);
  }

  // -------------------------------------------------------------------------
  // Rysowanie
  // -------------------------------------------------------------------------

  /** Przerysowuje wszystko od zera. Wołane po wczytaniu zapisu i nowej osadzie. */
  odswiez(): void {
    this.pozycje.clear();
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
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(
      (srodek.x + 0.5) * ROZMIAR_KAFELKA,
      (srodek.y + 0.5) * ROZMIAR_KAFELKA,
    );
  }

  /**
   * Cała mapa idzie do jednej tekstury zamiast do 1600 osobnych obrazków.
   * Teren zmienia się rzadko (wycięte drzewo, wybrana glina), więc taniej jest
   * przerysować go raz na zmianę niż utrzymywać tysiące obiektów co klatkę.
   */
  przerysujTeren(): void {
    const mapa = this.wejscie.stan().mapa;
    const szer = mapa.szerokosc * ROZMIAR_KAFELKA;
    const wys = mapa.wysokosc * ROZMIAR_KAFELKA;

    const rysik = this.make.graphics({ x: 0, y: 0 }, false);
    for (let y = 0; y < mapa.wysokosc; y++) {
      for (let x = 0; x < mapa.szerokosc; x++) {
        const kafelek = mapa.kafelki[indeks(mapa, x, y)];
        rysik.fillStyle(BARWY_TERENU[kafelek.teren], 1);
        rysik.fillRect(x * ROZMIAR_KAFELKA, y * ROZMIAR_KAFELKA, ROZMIAR_KAFELKA, ROZMIAR_KAFELKA);

        // Szachownica ledwie widocznego cienia — bez niej łąka wygląda jak
        // zielona płachta i nie widać, gdzie kończy się kafelek.
        if ((x + y) % 2 === 0) {
          rysik.fillStyle(CIEN, 0.045);
          rysik.fillRect(x * ROZMIAR_KAFELKA, y * ROZMIAR_KAFELKA, ROZMIAR_KAFELKA, ROZMIAR_KAFELKA);
        }

        // Wycięty las zostaje łąką w kolorze, ale z pniakiem — gracz ma widzieć,
        // że tu już był i nic nie zostało. Młodnik posadzony przez gajówkę
        // odrasta stopniowo, więc rysujemy go po prostu ciemniejszym zielonym.
        if (kafelek.teren === "las" && kafelek.zasob === 0) {
          rysik.fillStyle(BARWY_TERENU.laka, 1);
          rysik.fillRect(x * ROZMIAR_KAFELKA, y * ROZMIAR_KAFELKA, ROZMIAR_KAFELKA, ROZMIAR_KAFELKA);
          rysik.fillStyle(0x6b4f2a, 1);
          rysik.fillRect(
            x * ROZMIAR_KAFELKA + ROZMIAR_KAFELKA / 2 - 2,
            y * ROZMIAR_KAFELKA + ROZMIAR_KAFELKA / 2 - 2,
            4,
            4,
          );
        } else if (kafelek.teren === "las" && kafelek.zasob < DREWNA_Z_DRZEWA) {
          rysik.fillStyle(BARWY_TERENU.laka, 0.45);
          rysik.fillRect(x * ROZMIAR_KAFELKA, y * ROZMIAR_KAFELKA, ROZMIAR_KAFELKA, ROZMIAR_KAFELKA);
        }
      }
    }

    if (this.textures.exists("teren")) this.textures.remove("teren");
    rysik.generateTexture("teren", szer, wys);
    rysik.destroy();
    this.teren.setTexture("teren");
  }

  przerysujBudynki(): void {
    const stan = this.wejscie.stan();
    this.budynki.clear();

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

      this.budynki.fillStyle(BARWY_BUDYNKOW[b.typ] ?? BARWA_BUDYNKU, 1);
      this.budynki.fillRect(x + 1, y + 1, szer - 2, wys - 2);
      this.budynki.lineStyle(1.5, 0x3a2a18, 1);
      this.budynki.strokeRect(x + 1, y + 1, szer - 2, wys - 2);

      // Dach: pas przy górnej krawędzi, żeby budynek nie był samym prostokątem.
      this.budynki.fillStyle(0x8c5a2f, 1);
      this.budynki.fillRect(x + 1, y + 1, szer - 2, Math.max(3, wys / 4));

      // Budynek wstrzymany albo zablokowany przez leszego ma być widoczny
      // z lotu ptaka, bez klikania w niego.
      if (b.wstrzymany || b.zablokowanyPrzez) {
        this.budynki.fillStyle(b.zablokowanyPrzez ? 0x2f5d3a : 0x000000, 0.4);
        this.budynki.fillRect(x + 1, y + 1, szer - 2, wys - 2);
      } else if (b.brakZasobu) {
        this.budynki.lineStyle(1.5, BARWA_NIE_MOZNA, 0.9);
        this.budynki.strokeRect(x, y, szer, wys);
      }
    }
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
   * dzień. Pozycja dociąga do tej z symulacji, zamiast na nią skakać.
   */
  private przerysujLudzi(delta: number): void {
    const stan = this.wejscie.stan();
    this.ludzie.clear();

    // 0.006 na milisekundę to około jednego kafelka na ćwierć sekundy — dość,
    // by nadążyć za dniem trwającym dwie sekundy, i za mało, by migać.
    const dociagniecie = Math.min(1, delta * 0.006);

    // Rozsunięcie wachlarzem: pod jednym dachem mieszka do sześciu osób,
    // a bez tego widać jedną kropkę i osada wygląda na wymarłą. Numerujemy po
    // pozycji z symulacji (całe kafelki), nie po tej rysowanej, żeby kropki nie
    // przeskakiwały miejscami w trakcie dochodzenia.
    const naKafelku = new Map<string, number>();

    for (const m of stan.mieszkancy) {
      let p = this.pozycje.get(m.id);
      if (!p) {
        p = { x: m.x, y: m.y };
        this.pozycje.set(m.id, p);
      }
      p.x += (m.x - p.x) * dociagniecie;
      p.y += (m.y - p.y) * dociagniecie;

      const klucz = `${m.x},${m.y}`;
      const ktory = naKafelku.get(klucz) ?? 0;
      naKafelku.set(klucz, ktory + 1);

      const kat = (ktory / 6) * Math.PI * 2;
      const odsuniecie = ktory === 0 ? 0 : ROZMIAR_KAFELKA * 0.32;
      const x = (p.x + 0.5) * ROZMIAR_KAFELKA + Math.cos(kat) * odsuniecie;
      const y = (p.y + 0.5) * ROZMIAR_KAFELKA + Math.sin(kat) * odsuniecie;

      this.ludzie.fillStyle(m.miejscePracy ? 0xf2e8d5 : 0x9a9384, 1);
      this.ludzie.lineStyle(1, 0x2b2118, 1);
      this.ludzie.fillCircle(x, y, 3);
      this.ludzie.strokeCircle(x, y, 3);
    }

    if (this.pozycje.size > stan.mieszkancy.length) {
      for (const id of [...this.pozycje.keys()]) {
        if (!stan.mieszkancy.some((m) => m.id === id)) this.pozycje.delete(id);
      }
    }
  }

  update(_czas: number, delta: number): void {
    this.przerysujLudzi(delta);
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
