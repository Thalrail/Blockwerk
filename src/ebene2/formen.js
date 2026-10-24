// Ebene 2 – Formen: reine Geometrie ohne Funktion (Scheibe/Ring, Zylinder, Kugel, Kuppel, Kegel), maßstabsfrei.
// Regeln: data/regeln/formen.json. Jede Form ist eine Abstandsbedingung auf dem Mittelpunkt jedes Blocks; erst beim Bauen wird gerastert.
// Rundung: ein Block gehört zur Form, wenn sein Mittelpunkt im Idealkörper liegt (Idealmaße + `aufschlag`, 0). Der Formmittelpunkt liegt bei ungerader
// Breite auf einem Block, bei gerader zwischen zwei Blöcken (`versatz` 0) → keine schiefe Seite. Gleiche Formel für jede Größe.
// Koordinaten: Nullpunkt ist der Block x = floor(breite / 2), z = floor(tiefe / 2) der Grundfläche (bei ungerader Breite die Mitte), y = 0 ist die unterste Schicht.
// Hohle Formen: Hülle der Dicke `wandstaerke` (Blöcke mit Nachbarn außerhalb, 6er-Nachbarschaft = wasserdicht). Zylinder und Kuppel sind unten offen,
// der Zylinder auch oben (Turmrohr); Deckel und Boden sind eigene Scheiben.
import { definiere, param } from './baustein.js';

const QUELLE = 'https://github.com/Thalrail/Blockwerk/blob/main/docs/ebenen.md (Ebene 2, Grundregel Maßstabsfreiheit)';
const MAX = 512;

/**
 * Rastert einen Körper. `innen(x, j, z)` bekommt die auf den Mittelpunkt bezogenen waagerechten Blockmitten und die Schicht j.
 * @returns {{x:number,y:number,z:number,rolle:string}[]}
 */
function raster({ B, H, T, innen, versatz, dicke, offenUnten, offenOben, rolle }) {
  const idx = (i, j, k) => (j * T + k) * B + i;
  const f = new Uint8Array(B * H * T);
  for (let j = 0; j < H; j++) for (let k = 0; k < T; k++) {
    const z = k - (T - 1) / 2 + versatz;
    for (let i = 0; i < B; i++) if (innen(i - (B - 1) / 2 + versatz, j, z)) f[idx(i, j, k)] = 1;
  }
  let schale = f;
  if (dicke > 0) {
    schale = new Uint8Array(f.length);
    const rest = f.slice();
    const drin = (i, j, k) => {
      if (i < 0 || i >= B || k < 0 || k >= T) return false;
      if (j < 0) return offenUnten;
      if (j >= H) return offenOben;
      return rest[idx(i, j, k)] === 1;
    };
    for (let s = 0; s < dicke; s++) {
      const rand = [];
      for (let j = 0; j < H; j++) for (let k = 0; k < T; k++) for (let i = 0; i < B; i++) {
        if (rest[idx(i, j, k)] && !(drin(i - 1, j, k) && drin(i + 1, j, k) && drin(i, j - 1, k) && drin(i, j + 1, k) && drin(i, j, k - 1) && drin(i, j, k + 1))) rand.push(idx(i, j, k));
      }
      for (const n of rand) { schale[n] = 1; rest[n] = 0; }
    }
  }
  const bloecke = [];
  const ox = Math.floor(B / 2), oz = Math.floor(T / 2);
  for (let j = 0; j < H; j++) for (let k = 0; k < T; k++) for (let i = 0; i < B; i++) if (schale[idx(i, j, k)]) bloecke.push({ x: i - ox, y: j, z: k - oz, rolle });
  return bloecke;
}

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeFormen({ regelwerk }) {
  const aufschlag = regelwerk.parameter('formen.rundung', 'aufschlag');
  const versatz = regelwerk.parameter('formen.rundung', 'versatz');
  const kuppelHoehe = regelwerk.parameter('formen.proportion', 'kuppelhoehe');
  const breite = (standard = 9) => param('breite', 'geometrie', { min: 1, max: MAX, standard, beschreibung: 'Ausdehnung in Ost-West-Richtung in Blöcken (ungerade: Mitte auf einem Block, gerade: zwischen zwei Blöcken)' });
  const tiefe = (standard = 9) => param('tiefe', 'geometrie', { min: 1, max: MAX, standard, beschreibung: 'Ausdehnung in Nord-Süd-Richtung in Blöcken; gleich der Breite ergibt einen Kreis' });
  const wand = (standard) => param('wandstaerke', 'menschenmass', { min: 0, max: 32, standard, beschreibung: 'Dicke der Hülle in Blöcken; 0 = massiv' });
  const halbachsen = (w, t) => [w / 2 + aufschlag, t / 2 + aufschlag];
  const rund = (x, z, a, c) => (x / a) ** 2 + (z / c) ** 2;

  const scheibe = definiere({
    id: 'form.scheibe', titel: 'Scheibe oder Ring (Kreis/Ellipse, eine Schicht)', quelle: QUELLE,
    parameter: [breite(), tiefe(), wand(0)],
    testszenario: { start: 'leere Welt, Baustein darauf gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; Rand ist symmetrisch und lückenlos' },
    baue: ({ breite: B, tiefe: T, wandstaerke }) => {
      const [a, c] = halbachsen(B, T);
      return { bloecke: raster({ B, H: 1, T, innen: (x, j, z) => rund(x, z, a, c) <= 1, versatz, dicke: wandstaerke, offenUnten: true, offenOben: true, rolle: 'boden' }) };
    },
  });

  const zylinder = definiere({
    id: 'form.zylinder', titel: 'Zylinder (Turmrohr, oben und unten offen)', quelle: QUELLE,
    parameter: [breite(), tiefe(), param('hoehe', 'geometrie', { min: 1, max: MAX, standard: 8, beschreibung: 'Höhe in Schichten' }), wand(1)],
    testszenario: { start: 'leere Welt, Baustein darauf gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; jede Schicht ist gleich, Rohr ist wasserdicht' },
    baue: ({ breite: B, tiefe: T, hoehe: H, wandstaerke }) => {
      const [a, c] = halbachsen(B, T);
      const bloecke = raster({ B, H, T, innen: (x, j, z) => rund(x, z, a, c) <= 1, versatz, dicke: wandstaerke, offenUnten: true, offenOben: true, rolle: 'wand' });
      const anschluesse = wandstaerke > 0 ? [{ art: 'oeffnung', seite: 'unten' }, { art: 'oeffnung', seite: 'oben' }] : [];
      return { bloecke, anschluesse };
    },
  });

  const kugel = definiere({
    id: 'form.kugel', titel: 'Kugel oder Ellipsoid', quelle: QUELLE,
    parameter: [breite(), tiefe(), param('hoehe', 'geometrie', { min: 1, max: MAX, standard: 9, beschreibung: 'Höhe in Schichten (gleich Breite und Tiefe ergibt eine Kugel)' }), wand(1)],
    testszenario: { start: 'leere Welt, Baustein darauf gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; Hülle ist symmetrisch und wasserdicht' },
    baue: ({ breite: B, tiefe: T, hoehe: H, wandstaerke }) => {
      const [a, c] = halbachsen(B, T);
      const b = H / 2 + aufschlag;
      return { bloecke: raster({ B, H, T, innen: (x, j, z) => rund(x, z, a, c) + ((j - (H - 1) / 2 + versatz) / b) ** 2 <= 1, versatz, dicke: wandstaerke, offenUnten: false, offenOben: false, rolle: 'wand' }) };
    },
  });

  const kuppel = definiere({
    id: 'form.kuppel', titel: 'Kuppel (obere Hälfte eines Ellipsoids, unten offen)', quelle: QUELLE,
    parameter: [
      param('breite', 'geometrie', { min: 3, max: MAX, standard: 9, beschreibung: 'Ausdehnung Ost-West in Blöcken (mindestens 3, darunter bleibt die Kuppel leer)' }),
      param('tiefe', 'geometrie', { min: 3, max: MAX, standard: 9, beschreibung: 'Ausdehnung Nord-Süd in Blöcken' }),
      param('hoehenverhaeltnis', 'geometrie', { min: 0.1, max: 4, standard: kuppelHoehe, ganzzahl: false, beschreibung: 'Kuppelhöhe geteilt durch den halben Durchmesser in Ost-West (Proportion, kein festes Maß)' }),
      wand(1),
    ],
    testszenario: { start: 'leere Welt, Baustein darauf gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; Höhe folgt der Proportion für jede Größe' },
    baue: ({ breite: B, tiefe: T, hoehenverhaeltnis, wandstaerke }) => {
      const [a, c] = halbachsen(B, T);
      const b = hoehenverhaeltnis * (B / 2) + aufschlag;
      const H = Math.max(1, Math.floor(b + 0.5));
      return { bloecke: raster({ B, H, T, innen: (x, j, z) => rund(x, z, a, c) + ((j + 0.5) / b) ** 2 <= 1, versatz, dicke: wandstaerke, offenUnten: true, offenOben: false, rolle: 'wand' }), anschluesse: [{ art: 'oeffnung', seite: 'unten' }] };
    },
  });

  const kegel = definiere({
    id: 'form.kegel', titel: 'Kegel (Spitze oben, unten offen)', quelle: QUELLE,
    parameter: [breite(), tiefe(), param('hoehe', 'geometrie', { min: 1, max: MAX, standard: 9, beschreibung: 'Höhe in Schichten' }), wand(1)],
    testszenario: { start: 'leere Welt, Baustein darauf gesetzt', erwartung: 'Prüfer meldet keinen Verstoß; jede Schicht liegt in der darunter' },
    baue: ({ breite: B, tiefe: T, hoehe: H, wandstaerke }) => {
      const [a, c] = halbachsen(B, T);
      return {
        bloecke: raster({ B, H, T, innen: (x, j, z) => { const s = 1 - (j + 0.5) / H; return s > 0 && rund(x, z, a * s, c * s) <= 1; }, versatz, dicke: wandstaerke, offenUnten: true, offenOben: false, rolle: 'wand' }),
        anschluesse: [{ art: 'oeffnung', seite: 'unten' }],
      };
    },
  });

  return { scheibe, zylinder, kugel, kuppel, kegel, alle: [scheibe, zylinder, kugel, kuppel, kegel] };
}
