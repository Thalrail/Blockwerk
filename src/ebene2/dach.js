// Ebene 2 – Dachformen: Satteldach und Walmdach (auf quadratischem Grundriss ein Zeltdach), maßstabsfrei.
// Regeln: data/regeln/dach.json. Höhenfeld über dem Grundriss: Satteldach h = neigung × (Breite/2 − |x|), Walmdach h = neigung × min(Breite/2 − |x|, Tiefe/2 − |z|);
// `neigung` = Höhe ÷ halbe Breite (Proportion, Standard 1,0). Ein Block gehört zum Dach, wenn seine Blockmitte nicht über der Dachfläche liegt; hohl ist die Hülle der
// Dicke `dachstaerke` (Blöcke mit Nachbar außerhalb, wasserdicht). Unten offen (liegt auf den Wänden), beim Satteldach auch an den Giebeln. Aus Vollblöcken gestuft;
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

  const satteldach = definiere({
    id: 'form.satteldach', titel: 'Satteldach (Giebel offen, unten offen)', quelle: QUELLE,
    parameter: [breite, param('laenge', 'geometrie', { min: 1, max: 256, standard: 9, beschreibung: 'Länge in Richtung des Firsts (Nord-Süd) in Blöcken' }), neigung, staerke],
    testszenario: { start: 'leere Welt, Dach auf einen Rahmen gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; Querschnitt ist symmetrisch und wasserdicht' },
    baue: ({ breite: B, laenge: T, neigung: n, dachstaerke }) => {
      const H = Math.ceil(n * (B / 2 + aufschlag)) + 1;
      const bloecke = raster({ B, H, T, innen: (x, j) => j + 0.5 <= n * (B / 2 + aufschlag - Math.abs(x)), versatz, dicke: dachstaerke, offenUnten: true, offenOben: false, offenZ: true, rolle: 'akzent' });
      return { bloecke, anschluesse: [{ art: 'auflage', seite: 'unten' }] };
    },
  });

  const walmdach = definiere({
    id: 'form.walmdach', titel: 'Walmdach (Zeltdach bei quadratischem Grundriss, unten offen)', quelle: QUELLE,
    parameter: [breite, param('tiefe', 'geometrie', { min: 1, max: 256, standard: 9, beschreibung: 'Tiefe (Nord-Süd) in Blöcken' }), neigung, staerke],
    testszenario: { start: 'leere Welt, Dach auf einen Rahmen gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; Dach ist symmetrisch und wasserdicht' },
    baue: ({ breite: B, tiefe: T, neigung: n, dachstaerke }) => {
      const H = Math.ceil(n * (Math.min(B, T) / 2 + aufschlag)) + 1;
      const bloecke = raster({ B, H, T, innen: (x, j, z) => j + 0.5 <= n * Math.min(B / 2 + aufschlag - Math.abs(x), T / 2 + aufschlag - Math.abs(z)), versatz, dicke: dachstaerke, offenUnten: true, offenOben: false, rolle: 'akzent' });
      return { bloecke, anschluesse: [{ art: 'auflage', seite: 'unten' }] };
    },
  });

  return { satteldach, walmdach, alle: [satteldach, walmdach] };
}
