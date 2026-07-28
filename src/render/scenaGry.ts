/**
 * Ostoja — scena Phasera.
 *
 * Rysuje wyłącznie świat: mapę, budynki i ludzi. Pasek surowców, panele i
 * Kodeks są w DOM (zasada 4), więc tu nie ma ani jednego napisu — kliknięcie
 * w kafelek leci na zewnątrz przez `naKlikniecieKafelka` i to interfejs
 * decyduje, co z nim zrobić.
 *
 * Scena nigdy nie zmienia stanu gry. Czyta go przez `wejscie.stan()` i rysuje.
 */

import Phaser from "phaser";

import type { Dane } from "../sim/budynki.ts";
import type { Punkt, StanGry, Teren } from "../sim/typy.ts";
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
};
const BARWA_BUDYNKU = 0xb07f4f;

export interface WejscieSceny {
  dane: Dane;
  /** Getter, nie wartość — stan podmienia się przy wczytaniu zapisu. */
  stan: () => StanGry;
  naKlikniecieKafelka: (kafelek: Punkt, scena: ScenaGry) => void;
  gotowe: (scena: ScenaGry) => void;
}

export class ScenaGry extends Phaser.Scene {
  private wejscie: WejscieSceny;

  private teren!: Phaser.GameObjects.Image;
  private budynki!: Phaser.GameObjects.Graphics;
  private ludzie!: Phaser.GameObjects.Graphics;
  private sciezka!: Phaser.GameObjects.Graphics;
  private zaznaczenie!: Phaser.GameObjects.Graphics;

  /** Skąd zaczęło się wciśnięcie — do odróżnienia kliknięcia od przeciągania. */
  private wcisnietyW: Punkt | null = null;
  private przeciagano = false;

  constructor(wejscie: WejscieSceny) {
    super("gra");
    this.wejscie = wejscie;
  }

  create(): void {
    this.teren = this.add.image(0, 0, "__DEFAULT").setOrigin(0, 0);
    this.budynki = this.add.graphics();
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
    this.przerysujTeren();
    this.przerysujBudynki();
    this.przerysujLudzi();
    this.sciezka.clear();
    this.zaznaczenie.clear();

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
  private przerysujTeren(): void {
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
        // że tu już był i nic nie zostało.
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
        }
      }
    }

    if (this.textures.exists("teren")) this.textures.remove("teren");
    rysik.generateTexture("teren", szer, wys);
    rysik.destroy();
    this.teren.setTexture("teren");
  }

  private przerysujBudynki(): void {
    const stan = this.wejscie.stan();
    this.budynki.clear();

    for (const b of stan.budynki) {
      const def = this.wejscie.dane.budynki[b.typ];
      const x = b.x * ROZMIAR_KAFELKA;
      const y = b.y * ROZMIAR_KAFELKA;
      const szer = def.szerokosc * ROZMIAR_KAFELKA;
      const wys = def.wysokosc * ROZMIAR_KAFELKA;

      this.budynki.fillStyle(BARWY_BUDYNKOW[b.typ] ?? BARWA_BUDYNKU, 1);
      this.budynki.fillRect(x + 1, y + 1, szer - 2, wys - 2);
      this.budynki.lineStyle(1.5, 0x3a2a18, 1);
      this.budynki.strokeRect(x + 1, y + 1, szer - 2, wys - 2);

      // Dach: pas przy górnej krawędzi, żeby budynek nie był samym prostokątem.
      this.budynki.fillStyle(0x8c5a2f, 1);
      this.budynki.fillRect(x + 1, y + 1, szer - 2, Math.max(3, wys / 4));

      if (!b.wybudowany) {
        this.budynki.fillStyle(0xffffff, 0.35);
        this.budynki.fillRect(x + 1, y + 1, szer - 2, wys - 2);
      }
    }
  }

  private przerysujLudzi(): void {
    const stan = this.wejscie.stan();
    this.ludzie.clear();
    this.ludzie.fillStyle(0xf2e8d5, 1);
    this.ludzie.lineStyle(1, 0x2b2118, 1);

    // Dopóki ludzie nie chodzą, wszyscy domownicy stoją w jednym punkcie i
    // dziesięć osób wygląda jak trzy. Rozsuwamy ich wachlarzem wokół domu —
    // to wyłącznie sprawa rysowania, stan gry pozostaje nietknięty.
    const naKafelku = new Map<string, number>();

    for (const m of stan.mieszkancy) {
      const klucz = `${m.x},${m.y}`;
      const ktory = naKafelku.get(klucz) ?? 0;
      naKafelku.set(klucz, ktory + 1);

      const kat = (ktory / 6) * Math.PI * 2;
      const promien = ktory === 0 ? 0 : ROZMIAR_KAFELKA * 0.45;
      const x = (m.x + 0.5) * ROZMIAR_KAFELKA + Math.cos(kat) * promien;
      const y = (m.y + 0.5) * ROZMIAR_KAFELKA + Math.sin(kat) * promien;

      this.ludzie.fillCircle(x, y, 3);
      this.ludzie.strokeCircle(x, y, 3);
    }
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
    this.zaznaczenie.lineStyle(2, udane ? 0xffffff : 0xe5484d, 1);
    this.zaznaczenie.strokeRect(
      kafelek.x * ROZMIAR_KAFELKA + 1,
      kafelek.y * ROZMIAR_KAFELKA + 1,
      ROZMIAR_KAFELKA - 2,
      ROZMIAR_KAFELKA - 2,
    );
  }

  // -------------------------------------------------------------------------
  // Kamera i klikanie
  // -------------------------------------------------------------------------

  private ustawSterowanieKamera(): void {
    const kamera = this.cameras.main;

    this.input.on("pointerdown", (wskaznik: Phaser.Input.Pointer) => {
      this.wcisnietyW = { x: wskaznik.x, y: wskaznik.y };
      this.przeciagano = false;
    });

    this.input.on("pointermove", (wskaznik: Phaser.Input.Pointer) => {
      if (!wskaznik.isDown || !this.wcisnietyW) return;
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
      if (!this.przeciagano) this.klikniecie(wskaznik);
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

  private klikniecie(wskaznik: Phaser.Input.Pointer): void {
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
      return;
    }
    this.wejscie.naKlikniecieKafelka(kafelek, this);
  }
}
