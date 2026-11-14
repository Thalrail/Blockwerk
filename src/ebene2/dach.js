// Ebene 2 – Dachformen: Satteldach und Walmdach (auf quadratischem Grundriss ein Zeltdach), maßstabsfrei.
// Regeln: data/regeln/dach.json. Höhenfeld über dem Grundriss: Satteldach h = neigung × (Breite/2 − |x|), Walmdach h = neigung × min(Breite/2 − |x|, Tiefe/2 − |z|);
// `neigung` = Höhe ÷ halbe Breite (Proportion, Standard 1,0). Ein Block gehört zum Dach, wenn seine Blockmitte nicht über der Dachfläche liegt; hohl ist die Hülle der
// Dicke `dachstaerke` (Blöcke mit Nachbar außerhalb, wasserdicht). Unten offen (liegt auf den Wänden), beim Satteldach auch an den Giebeln. Aus Vollblöcken gestuft;
// Zwei Schalter für Wohnhäuser: `deckend` (jede Spalte der Grundfläche trägt mindestens einen Dachblock, auch wo das Ideal unter ½ Block liegt, damit das Dach das Haus bis zum Rand bedeckt)
// und `giebel` (Satteldach: Giebelwand aus der Rolle `wand`, 1 Block dick, an beiden Enden bündig). Standard bleibt Giebel offen und Randspalten nach der ½-Block-Regel.
// Treppen und Halbstufen zum Glätten wählt später der Designer (Ebene 3). Nullpunkt wie bei den Formen: x = floor(breite / 2), z = floor(tiefe / 2), y = 0 unten.
import { definiere, param } from './baustein.js';
import { raster } from './formen.js';

const QUELLE = 'https://github.com/Thalrail/Blockwerk/blob/main/docs/ebenen.md (Ebene 2: Dachformen, Proportionen statt fester Maße)';

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeDach({ regelwerk }) {
  const aufschlag = regelwerk.parameter('formen.rundung', 'aufschlag');
  const versatz = regelwerk.parameter('formen.rundung', 'versatz');
  const neigungStandard = regelwerk.parameter('dach.neigung', 'verhaeltnis');
  const breite = param('breite', 'geometrie', { min: 1, max: 256, standard: 9, beschreibung: 'Breite von Traufe zu Traufe (Ost-West) in Blöcken' });
  const neigung = param('neigung', 'geometrie', { min: 0.2, max: 4, standard: neigungStandard, ganzzahl: false, beschreibung: 'Dachhöhe geteilt durch die halbe Breite (1,0 = 45 Grad)' });
  const staerke = param('dachstaerke', 'menschenmass', { min: 1, max: 16, standard: 1, beschreibung: 'Dicke der Dachhaut in Blöcken' });
  const deckend = param('deckend', 'menschenmass', { min: 0, max: 1, standard: 0, beschreibung: '1 = jede Spalte der Grundfläche trägt mindestens einen Dachblock (das Dach bedeckt das Haus bis zum Rand), 0 = flache Randspalten entfallen' });
  const giebel = param('giebel', 'menschenmass', { min: 0, max: 1, standard: 0, beschreibung: '1 = geschlossener Giebel: Giebelwand (Rolle Wand, 1 Block dick) an beiden Enden, 0 = Giebel offen' });
  /** Höhe des Dachs über der Spalte in Blöcken; mit `deckend` mindestens 1. */
  const mindestens = (h, d) => (d ? Math.max(h, 1) : h);

  const satteldach = definiere({
    id: 'form.satteldach', titel: 'Satteldach (Giebel wählbar, unten offen)', quelle: QUELLE,
    parameter: [breite, param('laenge', 'geometrie', { min: 1, max: 256, standard: 9, beschreibung: 'Länge in Richtung des Firsts (Nord-Süd) in Blöcken' }), neigung, staerke, deckend, giebel],
    testszenario: { start: 'leere Welt, Dach auf einen Rahmen gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; Querschnitt ist symmetrisch und wasserdicht' },
    baue: ({ breite: B, laenge: T, neigung: n, dachstaerke, deckend: d, giebel: g }) => {
      const H = Math.max(Math.ceil(n * (B / 2 + aufschlag)) + 1, d ? 1 : 0);
      const innen = (x, j) => j + 0.5 <= mindestens(n * (B / 2 + aufschlag - Math.abs(x)), d);
      const bloecke = raster({ B, H, T, innen, versatz, dicke: dachstaerke, offenUnten: true, offenOben: false, offenZ: true, rolle: 'akzent' });
      if (g) {
        // Giebelwand: die Zellen unter der Dachfläche in der ersten und letzten Schicht, die nicht schon Dachhaut sind
        const ox = Math.floor(B / 2), oz = Math.floor(T / 2), belegt = new Set(bloecke.map((b) => `${b.x},${b.y},${b.z}`));
        for (const k of new Set([0, T - 1])) for (let j = 0; j < H; j++) for (let i = 0; i < B; i++) {
          if (innen(i - (B - 1) / 2 + versatz, j) && !belegt.has(`${i - ox},${j},${k - oz}`)) bloecke.push({ x: i - ox, y: j, z: k - oz, rolle: 'wand' });
        }
      }
      return { bloecke, anschluesse: [{ art: 'auflage', seite: 'unten' }] };
    },
  });

  const walmdach = definiere({
    id: 'form.walmdach', titel: 'Walmdach (Zeltdach bei quadratischem Grundriss, unten offen)', quelle: QUELLE,
    parameter: [breite, param('tiefe', 'geometrie', { min: 1, max: 256, standard: 9, beschreibung: 'Tiefe (Nord-Süd) in Blöcken' }), neigung, staerke, deckend],
    testszenario: { start: 'leere Welt, Dach auf einen Rahmen gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; Dach ist symmetrisch und wasserdicht' },
    baue: ({ breite: B, tiefe: T, neigung: n, dachstaerke, deckend: d }) => {
      const H = Math.max(Math.ceil(n * (Math.min(B, T) / 2 + aufschlag)) + 1, d ? 1 : 0);
      const bloecke = raster({ B, H, T, innen: (x, j, z) => j + 0.5 <= mindestens(n * Math.min(B / 2 + aufschlag - Math.abs(x), T / 2 + aufschlag - Math.abs(z)), d), versatz, dicke: dachstaerke, offenUnten: true, offenOben: false, rolle: 'akzent' });
      return { bloecke, anschluesse: [{ art: 'auflage', seite: 'unten' }] };
    },
  });

  return { satteldach, walmdach, alle: [satteldach, walmdach] };
}
