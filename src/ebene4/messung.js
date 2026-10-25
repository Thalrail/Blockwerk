// Ebene 4 – Bildmessung (ohne KI, deterministisch): Farbpalette, Proportion aus dem Aufriss, Form, Seitenverhältnis, Kreise und Linien im Grundriss.
// Die Schwellen stehen als Daten in der Regel leser.messung. Eingabe sind Pixelbilder {breite, hoehe, daten} (RGBA).
import { vordergrund, huelle, komponenten, aussen, umrandung, pruefeBild } from './bild.js';

const runden = (x, stellen = 4) => Math.round(x * 10 ** stellen) / 10 ** stellen;

/**
 * @param {{regelwerk: object}} quellen
 */
export function erzeugeMessung({ regelwerk }) {
  const P = (name) => regelwerk.parameter('leser.messung', name);
  const abstand = P('hintergrundAbstand'), minGroesse = P('minGroesse'), rund = P('runde'), ecke = P('ecke'), linie = P('linie');
  const komp = P('komponente'), farbe = P('farbe'), unbunt = P('unbunt'), braun = P('braun'), toene = P('farbtoene');

  /** Farbklasse eines Pixels (HSV nach Datentabelle). */
  function farbklasse(r, g, b) {
    const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
    const v = max, s = max === 0 ? 0 : d / max;
    if (v < unbunt.schwarzV) return 'schwarz';
    if (s < unbunt.sMax) return v > unbunt.weissV ? 'weiß' : 'grau';
    let h;
    if (d === 0) h = 0;
    else if (max === r / 255) h = 60 * (((g - b) / 255 / d + 6) % 6);
    else if (max === g / 255) h = 60 * ((b - r) / 255 / d + 2);
    else h = 60 * ((r - g) / 255 / d + 4);
    if (h >= braun.tonVon && h < braun.tonBis && v < braun.vMax && s >= braun.sMin) return 'braun';
    for (const t of toene) {
      const drin = t.von <= t.bis ? h >= t.von && h < t.bis : h >= t.von || h < t.bis;
      if (drin) return t.farbe;
    }
    return 'rot';
  }

  /**
   * Farbpalette des Vordergrunds: [{farbe, anteil, rgb}], nach Anteil absteigend, Klassen unter dem Mindestanteil fallen weg.
   * Mit `mitHintergrund` zählt das ganze Bild (für Bilder ohne freien Hintergrund, etwa randlose Fotos: sonst gälte die häufigste Randfarbe als Hintergrund).
   */
  function farben(bild, { mitHintergrund = false } = {}) {
    const { vorder, anzahl } = mitHintergrund ? (pruefeBild(bild), { vorder: new Uint8Array(bild.breite * bild.hoehe).fill(1), anzahl: bild.breite * bild.hoehe }) : vordergrund(bild, abstand);
    const summe = new Map();
    for (let p = 0; p < vorder.length; p++) {
      if (!vorder[p]) continue;
      const i = p * 4, d = bild.daten;
      const k = farbklasse(d[i], d[i + 1], d[i + 2]);
      const e = summe.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2];
      summe.set(k, e);
    }
    return [...summe.entries()]
      .map(([f, e]) => ({ farbe: f, anteil: runden(e.n / anzahl), rgb: [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)] }))
      .filter((x) => x.anteil >= farbe.mindestAnteil)
      .sort((a, b) => b.anteil - a.anteil || (a.farbe < b.farbe ? -1 : 1));
  }

  /** Hüllrechteck des Vordergrunds mit Verhältnis Höhe : Breite (Aufriss oder Ansicht). */
  function umriss(bild) {
    const { vorder } = vordergrund(bild, abstand);
    const h = huelle(vorder, bild.breite, bild.hoehe);
    return { breite: h.breite, hoehe: h.hoehe, verhaeltnis: runden(h.hoehe / h.breite) };
  }

  /** Form einer Maske (rund, eckig, unbestimmt) über den normierten Randradius ihres äußeren Umrisses. */
  function formVon(maske, B, H) {
    const h = huelle(maske, B, H);
    if (Math.min(h.breite, h.hoehe) < minGroesse) return { form: 'unbestimmt', huelle: h };
    const rand = umrandung(maske, aussen(maske, B, H), B, H);
    const cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2;
    const a = Math.max((h.breite - 1) / 2, 0.5), b = Math.max((h.hoehe - 1) / 2, 0.5);
    const r = rand.map((p) => { const x = p % B, y = (p - x) / B; return Math.sqrt(((x - cx) / a) ** 2 + ((y - cy) / b) ** 2); });
    const mittel = r.reduce((s, x) => s + x, 0) / r.length;
    const streuung = Math.sqrt(r.reduce((s, x) => s + (x - mittel) ** 2, 0) / r.length);
    const eckig = r.filter((x) => x > ecke.radius).length / r.length;
    let form = 'unbestimmt';
    if (mittel >= rund.mittelMin && mittel <= rund.mittelMax && streuung <= rund.streuungMax && eckig < ecke.anteil) form = 'rund';
    else if (eckig >= ecke.anteil) form = 'eckig';
    return { form, huelle: h, mittel: runden(mittel), streuung: runden(streuung) };
  }

  /** Gerade Linien: Zeilen (Spalten) mit einem zusammenhängenden Lauf von mindestens 60 % der Breite (Höhe), höchstens 3 Pixel oder 10 % des Teils dick und mindestens fünfmal so lang wie dick. */
  function linien(maske, B, H, h) {
    const ergebnis = [];
    const gruppen = (laengen, gesamt, andere, ausrichtung) => {
      let start = null;
      const fertig = (ende) => {
        const dicke = ende - start + 1, zeilen = laengen.slice(start, ende + 1);
        if (dicke <= Math.max(linie.maxPixel, Math.ceil(andere * linie.maxDicke)) && Math.max(...zeilen) >= linie.schlankheit * dicke) ergebnis.push({ ausrichtung, lage: runden((start + ende) / 2 / Math.max(1, laengen.length - 1)), dicke, laenge: Math.max(...zeilen) });
      };
      laengen.forEach((l, i) => {
        const istLinie = l >= Math.max(linie.mindestPixel, linie.mindestLaenge * gesamt);
        if (istLinie && start === null) start = i;
        if (!istLinie && start !== null) { fertig(i - 1); start = null; }
      });
      if (start !== null) fertig(laengen.length - 1);
    };
    const lauf = (n, wert) => { let best = 0, jetzt = 0; for (let i = 0; i < n; i++) { if (wert(i)) { jetzt++; if (jetzt > best) best = jetzt; } else jetzt = 0; } return best; };
    const zeilen = [], spalten = [];
    for (let y = h.y0; y <= h.y1; y++) zeilen.push(lauf(h.breite, (i) => maske[y * B + h.x0 + i]));
    for (let x = h.x0; x <= h.x1; x++) spalten.push(lauf(h.hoehe, (i) => maske[(h.y0 + i) * B + x]));
    gruppen(zeilen, h.breite, h.hoehe, 'waagerecht');
    gruppen(spalten, h.hoehe, h.breite, 'senkrecht');
    return ergebnis;
  }

  /**
   * Grundriss: Form des Gesamtumrisses, Seitenverhältnis Breite : Tiefe, Komponenten (mit Form) und gerade Linien.
   * @returns {{form: string, breite: number, tiefe: number, seitenverhaeltnis: number, kreise: number, komponenten: object[], linien: object[]}}
   */
  function grundriss(bild) {
    const { vorder, anzahl } = vordergrund(bild, abstand);
    const { breite: B, hoehe: H } = bild;
    const gesamt = formVon(vorder, B, H);
    const teile = komponenten(vorder, B, H)
      .filter((k) => k.pixel.length / anzahl >= komp.mindestAnteil)
      .map((k) => {
        const m = new Uint8Array(B * H);
        for (const p of k.pixel) m[p] = 1;
        const f = formVon(m, B, H);
        return { form: f.form, x: f.huelle.x0, y: f.huelle.y0, breite: f.huelle.breite, tiefe: f.huelle.hoehe, flaeche: k.pixel.length };
      });
    const h = gesamt.huelle;
    return {
      form: gesamt.form, breite: h.breite, tiefe: h.hoehe, seitenverhaeltnis: runden(h.breite / h.hoehe),
      kreise: teile.filter((k) => k.form === 'rund').length, komponenten: teile, linien: linien(vorder, B, H, h),
    };
  }

  return { farben, umriss, grundriss, farbklasse, pruefeBild };
}
