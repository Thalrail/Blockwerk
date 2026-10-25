// Ebene 5 – Textur-Atlas: legt alle Kacheln (32 × 32 Bildpunkte) in ein Raster aus Zweierpotenzen und sagt, wo jede liegt (UV-Rechteck für die 3D-Ansicht).
// Reine Rechnung; das Zusammensetzen der Bildpunkte (Canvas, Laden der PNGs) macht die Seite. Die erste Kachel ist immer eine weiße Fläche
// (für Blöcke ohne Textur: dort färbt die Tönung ein). Deterministisch: gleiche Kacheln = gleicher Atlas.

export const WEISS = '#weiss';
const naechsteZweierpotenz = (n) => { let p = 1; while (p < n) p *= 2; return p; };

/**
 * @param {string[]} kacheln  Namen der Texturen (Reihenfolge egal, sie wird sortiert)
 * @param {{kachel?: number}} [opt]  Kantenlänge einer Kachel in Bildpunkten
 */
export function erzeugeAtlas(kacheln, { kachel = 32 } = {}) {
  const namen = [WEISS, ...[...new Set(kacheln)].filter((n) => n !== WEISS).sort()];
  const spalten = naechsteZweierpotenz(Math.ceil(Math.sqrt(namen.length)));
  const zeilen = naechsteZweierpotenz(Math.ceil(namen.length / spalten));
  const breite = spalten * kachel, hoehe = zeilen * kachel;
  const halb = { u: 0.5 / breite, v: 0.5 / hoehe }; // einen halben Bildpunkt nach innen: kein Durchscheinen der Nachbarkachel
  const eintraege = new Map();
  namen.forEach((name, i) => {
    const x = (i % spalten) * kachel, y = Math.floor(i / spalten) * kachel;
    eintraege.set(name, { name, x, y, u0: x / breite + halb.u, v0: y / hoehe + halb.v, u1: (x + kachel) / breite - halb.u, v1: (y + kachel) / hoehe - halb.v });
  });
  /** UV-Rechteck einer Kachel; unbekannte Namen bekommen die weiße Kachel (nie ein stiller Fehler im Bild). */
  const rechteck = (name) => eintraege.get(name) ?? eintraege.get(WEISS);
  return { kachel, breite, hoehe, spalten, zeilen, namen, eintraege, rechteck };
}
