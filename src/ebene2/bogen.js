// Ebene 2 – Bogen und Tonnengewölbe (Segmentbogen), maßstabsfrei.
// Regeln: data/regeln/bogen.json. Bogen in einer Mauer (Ebene x–y, Dicke in z): lichte Weite `spannweite`, Stich = `stichverhaeltnis` × Spannweite (Standard 0,3),
// Pfeiler bis zum Bogenansatz (`pfeilerhoehe`, mindestens 2 = Menschenmaß), Bogenstärke radial. Segmentbogen durch die Ansatzpunkte:
// Radius R = (s² + (w/2)²) / (2s), Mittelpunkt s − R über dem Ansatz. Ein Block gehört zum Körper, wenn seine Blockmitte in der Außenform (Radius R + Stärke,
// mindestens Pfeilerhöhe) und nicht in der Öffnung liegt. Gerade Weite: Mitte zwischen zwei Blöcken, ungerade: auf einem Block.
// Nullpunkt: x = floor(Gesamtbreite / 2) (Mitte), y = 0 Boden, z = floor(Tiefe / 2). Das Tonnengewölbe ist derselbe Querschnitt über `laenge`.
import { definiere, param } from './baustein.js';
import { raster } from './formen.js';

const QUELLE = 'https://github.com/Thalrail/Blockwerk/blob/main/docs/ebenen.md (Ebene 2: Bogenstich 0,3 × Spannweite, Türhöhe 2)';

/** Querschnitt eines Bogens als Funktionen der Blockmitte. */
function querschnitt({ w, stich, pf, t, aufschlag }) {
  const s = stich * w;
  const R = (s * s + (w / 2) ** 2) / (2 * s);
  const c = s - R; // Mittelpunkt des Kreises relativ zum Ansatz
  const wh = w / 2 + aufschlag;
  const innenHoehe = (x) => pf + c + Math.sqrt(Math.max(0, R * R - x * x));
  const aussenHoehe = (x) => Math.max(pf, pf + c + Math.sqrt(Math.max(0, (R + t) ** 2 - x * x)));
  const offen = (x, yc) => Math.abs(x) <= wh && (yc < pf || yc <= innenHoehe(x));
  const koerper = (x, yc) => Math.abs(x) <= wh + t && yc <= aussenHoehe(x) && !offen(x, yc);
  return { s, R, c, offen, koerper, hoehe: pf + s + t };
}

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk}} quellen
 */
export function erzeugeBogen({ regelwerk }) {
  const aufschlag = regelwerk.parameter('formen.rundung', 'aufschlag');
  const versatz = regelwerk.parameter('formen.rundung', 'versatz');
  const stichStandard = regelwerk.parameter('bogen.stich', 'verhaeltnis');
  const minHoehe = regelwerk.parameter('bogen.durchgang', 'mindesthoehe');
  const spannweite = param('spannweite', 'geometrie', { min: 1, max: 256, standard: 5, beschreibung: 'Lichte Weite des Durchgangs in Blöcken (ungerade: Mitte auf einem Block, gerade: zwischen zwei Blöcken)' });
  const stich = param('stichverhaeltnis', 'geometrie', { min: 0.05, max: 0.5, standard: stichStandard, ganzzahl: false, beschreibung: 'Stich (Höhe des Bogens über dem Ansatz) geteilt durch die Spannweite; 0,5 ist ein Halbkreis' });
  const pfeiler = param('pfeilerhoehe', 'menschenmass', { min: minHoehe, max: 64, standard: minHoehe, beschreibung: 'Höhe der geraden Pfeiler bis zum Bogenansatz; mindestens die Türhöhe (Menschenmaß bleibt fest)' });
  const staerke = param('bogenstaerke', 'menschenmass', { min: 1, max: 16, standard: 1, beschreibung: 'Dicke des Bogens und der Pfeiler in Blöcken' });

  function koerper({ spannweite: w, stichverhaeltnis, pfeilerhoehe: pf, bogenstaerke: t }, T) {
    const q = querschnitt({ w, stich: stichverhaeltnis, pf, t, aufschlag });
    const B = w + 2 * t;
    const H = Math.ceil(q.hoehe) + 1;
    const bloecke = raster({ B, H, T, innen: (x, j) => q.koerper(x, j + 0.5), versatz, dicke: 0, offenUnten: false, offenOben: false, rolle: 'wand' });
    // lichte Höhe in der mittleren Spalte (ungerade Weite: x = 0, gerade: x = 0,5)
    const xm = w % 2 === 1 ? 0 : 0.5;
    let frei = 0;
    while (q.offen(xm, frei + 0.5)) frei++;
    return { bloecke, frei, q };
  }

  const bogen = definiere({
    id: 'form.bogen', titel: 'Bogen (Segmentbogen in einer Mauer)', quelle: QUELLE,
    parameter: [spannweite, stich, pfeiler, staerke, param('tiefe', 'menschenmass', { min: 1, max: 64, standard: 1, beschreibung: 'Mauerdicke in Nord-Süd-Richtung in Blöcken' })],
    testszenario: { start: 'leere Welt mit Boden, Bogen in eine Mauer gesetzt', erwartung: 'Spieler und Dorfbewohner gehen hindurch; Bogen ist symmetrisch und lückenlos' },
    baue: (p) => {
      const { bloecke, frei } = koerper(p, p.tiefe);
      return { bloecke, anschluesse: [{ art: 'durchgang', achse: 'z', breite: p.spannweite, hoehe: frei }] };
    },
  });

  const tonne = definiere({
    id: 'form.tonnengewoelbe', titel: 'Tonnengewölbe (Tunnel mit Bogen)', quelle: QUELLE,
    parameter: [spannweite, stich, pfeiler, staerke, param('laenge', 'geometrie', { min: 1, max: 512, standard: 9, beschreibung: 'Länge des Tunnels in Nord-Süd-Richtung in Blöcken' })],
    testszenario: { start: 'leere Welt mit Boden, Tunnel daraufgesetzt', erwartung: 'Spieler und Dorfbewohner gehen von Ende zu Ende hindurch; jede Schicht gleicht dem Bogenquerschnitt' },
    baue: (p) => {
      const { bloecke, frei } = koerper(p, p.laenge);
      return { bloecke, anschluesse: ['nord', 'sued'].map((seite) => ({ art: 'durchgang', achse: 'z', seite, breite: p.spannweite, hoehe: frei })) };
    },
  });

  return { bogen, tonne, alle: [bogen, tonne] };
}
