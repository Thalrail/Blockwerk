// Ebene 2 – Bauelemente: begehbare Teile (Gang, Raum, Treppe, Wendeltreppe, Tür, Fenster, Säule). Regeln: data/regeln/bauelemente.json.
// Menschenmaß bleibt fest: Stufenhöhe 1, Türhöhe 2, Ganghöhe mindestens 2. Größere Wendeltreppen haben mehr Stufen pro Umdrehung, nie höhere Stufen.
// Formgebundene Blöcke (Treppe, Tür, Scheibe) tragen `form` und `richtung`; das Material entscheidet Ebene 3 über die Rolle (siehe `platziere`).
// Koordinaten: x = Ost, z = Süd, y = oben. Gang, Treppe, Tür, Fenster: Blick nach Norden (der Weg läuft nach Norden, z wird kleiner). Nullpunkt = Mitte
// der Grundfläche (bei ungerader Breite ein Block, bei gerader floor(Breite / 2)), y = 0 ist die Gehhöhe (Füße) bzw. die unterste Schicht des Elements.
import { definiere, param } from './baustein.js';

const QUELLE = 'https://github.com/Thalrail/Blockwerk/blob/main/docs/ebenen.md (Ebene 2: Bauelemente, Menschenmaß bleibt fest)';
const QUELLE_RAUM = 'https://github.com/Thalrail/Blockwerk/blob/main/docs/haus-sonde.md (Haus-Sonde: ein geschlossener Raum mit Tür und Fenstern fehlte); Tür-Ausrichtung wie bau.tuer';
const VEKTOR4 = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };

/** Geschlossener, 4-zusammenhängender Ring um die Mitte aus dem Rand der Kreisscheibe mit Radius r (Mitte auf einem Block); im Uhrzeigersinn von oben. */
export function ring(r) {
  const d = 2 * r + 1;
  const innen = (x, z) => (x / (d / 2)) ** 2 + (z / (d / 2)) ** 2 <= 1;
  const rand = [];
  for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
    if (innen(x, z) && !(innen(x - 1, z) && innen(x + 1, z) && innen(x, z - 1) && innen(x, z + 1))) rand.push({ x, z });
  }
  const winkel = (c) => Math.atan2(c.z, c.x);
  rand.sort((a, b) => winkel(a) - winkel(b) || a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z);
  const pfad = [];
  for (let i = 0; i < rand.length; i++) {
    const a = rand[i], b = rand[(i + 1) % rand.length];
    pfad.push(a);
    if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 2) {
      // diagonaler Sprung: eine der beiden gemeinsamen Nachbarzellen einfügen, die näher an der Mitte liegt (bei Gleichstand die kleinere x, dann z)
      const k = [{ x: a.x, z: b.z }, { x: b.x, z: a.z }].sort((p, q) => p.x * p.x + p.z * p.z - q.x * q.x - q.z * q.z || p.x - q.x || p.z - q.z)[0];
      pfad.push(k);
    }
  }
  for (let i = 0; i < pfad.length; i++) {
    const a = pfad[i], b = pfad[(i + 1) % pfad.length];
    if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) !== 1) throw new Error(`Ring r=${r}: Zellen ${i} und ${i + 1} grenzen nicht aneinander`);
  }
  return pfad;
}

const richtungZu = (a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  return Object.keys(VEKTOR4).find((k) => VEKTOR4[k][0] === dx && VEKTOR4[k][1] === dz);
};

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk, formen: ReturnType<typeof import('./formen.js').erzeugeFormen>}} quellen
 */
export function erzeugeBauelemente({ regelwerk, formen }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  const stufenhoehe = P('bau.stufe', 'hoehe');
  const gangHoehe = P('bau.gang', 'mindesthoehe');
  const gangBreite = P('bau.gang', 'mindestbreite');
  const raumHoehe = P('bau.raum', 'mindesthoehe');
  const tuerHoehe = P('bau.tuer', 'hoehe');
  const mindeststufen = P('bau.wendeltreppe', 'mindeststufen');
  const sockelVerhaeltnis = P('bau.saeule', 'sockelverhaeltnis');
  const ueberstand = P('bau.saeule', 'ueberstand');

  const gang = definiere({
    id: 'bau.gang', titel: 'Gang (Tunnel mit Boden, Wänden und Decke, läuft nach Norden)', quelle: QUELLE,
    parameter: [
      param('laenge', 'geometrie', { min: 1, max: 512, standard: 9, beschreibung: 'Länge in Blöcken (Nord-Süd)' }),
      param('breite', 'menschenmass', { min: gangBreite, max: 32, standard: 3, beschreibung: 'Lichte Breite in Blöcken' }),
      param('hoehe', 'menschenmass', { min: gangHoehe, max: 32, standard: 3, beschreibung: 'Lichte Höhe in Blöcken; mindestens die Ganghöhe 2' }),
      param('wandstaerke', 'menschenmass', { min: 1, max: 8, standard: 1, beschreibung: 'Dicke von Wänden, Boden und Decke' }),
    ],
    testszenario: { start: 'leere Welt, Gang daraufgesetzt', erwartung: 'Spieler, Dorfbewohner und Baby gehen von Ende zu Ende; Prüfer meldet keinen Verstoß' },
    baue: ({ laenge: L, breite: w, hoehe: h, wandstaerke: t }) => {
      const B = w + 2 * t;
      const ox = Math.floor(B / 2), oz = Math.floor(L / 2);
      const bloecke = [];
      for (let k = 0; k < L; k++) for (let j = -t; j < h + t; j++) for (let i = 0; i < B; i++) {
        const innen = i >= t && i < t + w && j >= 0 && j < h;
        if (!innen) bloecke.push({ x: i - ox, y: j, z: k - oz, rolle: j < 0 ? 'boden' : 'wand' });
      }
      return { bloecke, anschluesse: ['nord', 'sued'].map((seite) => ({ art: 'durchgang', achse: 'z', seite, breite: w, hoehe: h })) };
    },
  });

  const RAUM_WAENDE = ['nord', 'ost', 'sued', 'west'];
  const raum = definiere({
    id: 'bau.raum', titel: 'Raum (geschlossener Hohlquader mit Boden, Decke, einer Tür und Fenstern)', quelle: QUELLE_RAUM,
    parameter: [
      param('breite', 'geometrie', { min: 1, max: 64, standard: 5, beschreibung: 'Lichte Breite in Blöcken (Ost-West)' }),
      param('tiefe', 'geometrie', { min: 1, max: 64, standard: 5, beschreibung: 'Lichte Tiefe in Blöcken (Nord-Süd)' }),
      param('hoehe', 'menschenmass', { min: raumHoehe, max: 32, standard: 3, beschreibung: 'Lichte Höhe in Blöcken; mindestens 2' }),
      param('wandstaerke', 'menschenmass', { min: 1, max: 4, standard: 1, beschreibung: 'Dicke von Wänden, Boden und Decke' }),
      param('boden', 'menschenmass', { min: 0, max: 1, standard: 1, beschreibung: '1 = mit Boden unter der Gehhöhe, 0 = ohne' }),
      param('decke', 'menschenmass', { min: 0, max: 1, standard: 1, beschreibung: '1 = mit Decke, 0 = ohne' }),
      param('tuer', 'menschenmass', { min: 0, max: 2, standard: 0, beschreibung: 'Flügel der Tür in der Mitte der Türwand: 0 = keine Tür, 1 = einfach, 2 = Doppeltür (2 Blöcke hoch)' }),
      param('tuerwand', 'menschenmass', { min: 1, max: 4, standard: 3, beschreibung: 'Wand der Tür: 1 Nord, 2 Ost, 3 Süd, 4 West' }),
      param('fenster', 'menschenmass', { min: 0, max: 8, standard: 0, beschreibung: 'Fenster je Wand (alle Wände außer der Türwand), gleichmäßig verteilt' }),
      param('fensterbreite', 'menschenmass', { min: 1, max: 8, standard: 2, beschreibung: 'Breite eines Fensters in Blöcken' }),
      param('fensterhoehe', 'menschenmass', { min: 1, max: 8, standard: 2, beschreibung: 'Höhe eines Fensters in Blöcken' }),
      param('bruestung', 'menschenmass', { min: 1, max: 8, standard: 1, beschreibung: 'Höhe der Fenster-Unterkante über dem Boden in Blöcken' }),
    ],
    testszenario: { start: 'leere Welt mit Boden, Raum daraufgesetzt', erwartung: 'Der Raum ist ringsum dicht (auch mit Fenstern und geschlossener Tür); Spieler, Dorfbewohner und Baby gehen durch die Tür hinein, ohne Tür hält die Wand' },
    baue: (p) => {
      const { breite: bw, tiefe: bt, hoehe: h, wandstaerke: t, tuer, tuerwand, fenster: nF, fensterbreite: fb, fensterhoehe: fh, bruestung } = p;
      const Bx = bw + 2 * t, Bz = bt + 2 * t;
      const ox = Math.floor(Bx / 2), oz = Math.floor(Bz / 2);
      const jMin = p.boden ? -t : 0, jMax = p.decke ? h + t - 1 : h - 1;
      const bloecke = new Map();
      const key = (i, j, k) => `${i},${j},${k}`;
      for (let j = jMin; j <= jMax; j++) for (let k = 0; k < Bz; k++) for (let i = 0; i < Bx; i++) {
        const innen = i >= t && i < t + bw && k >= t && k < t + bt && j >= 0 && j < h;
        if (!innen) bloecke.set(key(i, j, k), { x: i - ox, y: j, z: k - oz, rolle: j < 0 ? 'boden' : 'wand' });
      }
      // Wand w (0 Nord, 1 Ost, 2 Süd, 3 West): Länge innen, äußerste Schicht, Zelle entlang der Wand (a = 0 … Länge − 1) und Wandtiefe (d = 0 außen … t − 1 innen)
      const lang = (w) => (w % 2 === 0 ? bw : bt);
      const zelle = (w, a, d, j) => {
        if (w === 0) return [t + a, j, d];
        if (w === 2) return [t + a, j, Bz - 1 - d];
        if (w === 1) return [Bx - 1 - d, j, t + a];
        return [d, j, t + a];
      };
      const anschluesse = [];
      const oeffne = (w, a0, breiteA, j0, hoeheJ, setze) => {
        for (let a = a0; a < a0 + breiteA; a++) for (let j = j0; j < j0 + hoeheJ; j++) for (let d = 0; d < t; d++) bloecke.delete(key(...zelle(w, a, d, j)));
        for (let a = a0; a < a0 + breiteA; a++) for (let j = j0; j < j0 + hoeheJ; j++) {
          const [i, jj, k] = zelle(w, a, 0, j);
          bloecke.set(key(i, jj, k), { x: i - ox, y: jj, z: k - oz, ...setze(a - a0, j - j0) });
        }
      };
      const wandName = (w) => RAUM_WAENDE[w];
      const wTuer = tuerwand - 1;
      if (tuer > 0) {
        const L = lang(wTuer);
        if (tuer > L) throw new Error(`bau.raum: die Tür (${tuer} breit) passt nicht in die Wand (${L} breit)`);
        // mittig; bei ungerader Restbreite einen Block näher am Wandanfang (Mitte höchstens ½ Block versetzt, wie bei allen Formen)
        const a0 = Math.floor((L - tuer) / 2);
        // wie `bau.tuer` (Blick nach Norden, erster Flügel links bei kleinerem x) um 90° je Wand im Uhrzeigersinn gedreht: an Süd- und Westwand läuft `a` gegen diese Richtung
        const fluegel = (a) => (wTuer === 2 || wTuer === 3 ? tuer - 1 - a : a);
        oeffne(wTuer, a0, tuer, 0, tuerHoehe, (a, j) => ({ rolle: 'akzent', form: 'tuer', richtung: ['north', 'east', 'south', 'west'][wTuer], haelfte: j === 0 ? 'unten' : 'oben', scharnier: tuer === 1 || fluegel(a) === 0 ? 'links' : 'rechts' }));
        anschluesse.push({ art: 'durchgang', seite: wandName(wTuer), breite: tuer, hoehe: tuerHoehe });
      }
      if (nF > 0) {
        if (bruestung + fh > h) throw new Error(`bau.raum: das Fenster (Unterkante ${bruestung}, Höhe ${fh}) ragt über die lichte Höhe ${h}`);
        for (let w = 0; w < 4; w++) {
          if (tuer > 0 && w === wTuer) continue;
          const L = lang(w);
          const rest = L - nF * fb;
          // gleichmäßig verteilt: möglichst große Abstände zwischen den Fenstern, mindestens 1 Block Rand und Pfeiler
          const s = nF === 1 ? 0 : Math.floor((rest - 2) / (nF - 1));
          if (rest < 2 || (nF > 1 && s < 1)) throw new Error(`bau.raum: ${nF} Fenster à ${fb} Blöcke passen nicht in die ${wandName(w)}-Wand (${L} breit): zwischen den Fenstern und am Rand bleibt mindestens 1 Block Wand`);
          const rand = Math.floor((rest - (nF - 1) * s) / 2);
          for (let n = 0; n < nF; n++) {
            oeffne(w, rand + n * (fb + s), fb, bruestung, fh, () => ({ rolle: 'glas', form: 'scheibe' }));
            anschluesse.push({ art: 'oeffnung', seite: wandName(w), breite: fb, hoehe: fh, abstandUnten: bruestung });
          }
        }
      }
      return { bloecke: [...bloecke.values()], anschluesse };
    },
  });

  const treppe = definiere({
    id: 'bau.treppe', titel: 'Treppe (gerade, Aufstieg nach Norden)', quelle: QUELLE,
    parameter: [
      param('stufen', 'geometrie', { min: 1, max: 128, standard: 4, beschreibung: 'Zahl der Stufen; die Stufenhöhe bleibt 1 Block (Menschenmaß)' }),
      param('breite', 'menschenmass', { min: 1, max: 16, standard: 2, beschreibung: 'Breite in Blöcken' }),
    ],
    testszenario: { start: 'leere Welt mit Boden, Treppe mit Plattform oben', erwartung: 'Spieler, Dorfbewohner und Baby gehen ohne Sprung hinauf' },
    baue: ({ stufen, breite }) => {
      const ox = Math.floor(breite / 2);
      const bloecke = [];
      for (let s = 0; s < stufen; s++) for (let i = 0; i < breite; i++) bloecke.push({ x: i - ox, y: s * stufenhoehe, z: -s, rolle: 'boden', form: 'treppe', richtung: 'north' });
      return { bloecke, anschluesse: [{ art: 'durchgang', seite: 'unten', breite }, { art: 'durchgang', seite: 'oben', breite, hoehe: stufen * stufenhoehe }] };
    },
  });

  const wendeltreppe = definiere({
    id: 'bau.wendeltreppe', titel: 'Wendeltreppe (Stufen auf einem Ring um die Mitte)', quelle: QUELLE,
    parameter: [
      param('radius', 'geometrie', { min: 1, max: 24, standard: 2, beschreibung: 'Abstand des Rings von der Mitte in Blöcken; je größer, desto mehr Stufen pro Umdrehung' }),
      param('stufen', 'geometrie', { min: 1, max: 512, standard: 16, beschreibung: 'Zahl der Stufen insgesamt (Höhe = Stufen × Stufenhöhe 1)' }),
      param('drehsinn', 'menschenmass', { min: 0, max: 1, standard: 1, beschreibung: '1 = im Uhrzeigersinn aufwärts (von oben gesehen), 0 = gegen den Uhrzeigersinn' }),
    ],
    testszenario: { start: 'leere Welt mit Boden, Wendeltreppe mit Plattform oben', erwartung: 'Spieler, Dorfbewohner und Baby gehen ohne Sprung hinauf; über jeder Stufe sind 2 Blöcke frei' },
    baue: ({ radius, stufen, drehsinn }) => {
      const pfad = ring(radius);
      if (pfad.length < mindeststufen) throw new Error(`bau.wendeltreppe: nur ${pfad.length} Stufen pro Umdrehung (mindestens ${mindeststufen})`);
      const lauf = drehsinn === 1 ? pfad : pfad.slice().reverse();
      const bloecke = [];
      for (let s = 0; s < stufen; s++) {
        const a = lauf[s % lauf.length], b = lauf[(s + 1) % lauf.length];
        bloecke.push({ x: a.x, y: s * stufenhoehe, z: a.z, rolle: 'boden', form: 'treppe', richtung: richtungZu(a, b) });
      }
      return { bloecke, anschluesse: [{ art: 'durchgang', seite: 'unten', stufenProUmdrehung: lauf.length }, { art: 'durchgang', seite: 'oben', hoehe: stufen * stufenhoehe }] };
    },
  });

  const tuer = definiere({
    id: 'bau.tuer', titel: 'Tür (1 oder 2 Flügel, 2 Blöcke hoch, ohne Rahmen)', quelle: QUELLE,
    parameter: [param('fluegel', 'menschenmass', { min: 1, max: 2, standard: 1, beschreibung: '1 = einfache Tür, 2 = Doppeltür (Scharniere außen)' })],
    testszenario: { start: 'leere Welt mit Boden, Tür in eine Mauer gesetzt', erwartung: 'Spieler und Dorfbewohner gehen durch (Holztür); Eisentür bleibt für Dorfbewohner zu' },
    baue: ({ fluegel }) => {
      const bloecke = [];
      for (let i = 0; i < fluegel; i++) {
        const scharnier = fluegel === 1 || i === 0 ? 'links' : 'rechts';
        for (const [h, y] of [['unten', 0], ['oben', 1]]) if (y < tuerHoehe) bloecke.push({ x: i, y, z: 0, rolle: 'akzent', form: 'tuer', richtung: 'north', haelfte: h, scharnier });
      }
      return { bloecke, anschluesse: [{ art: 'durchgang', achse: 'z', breite: fluegel, hoehe: tuerHoehe }] };
    },
  });

  const fenster = definiere({
    id: 'bau.fenster', titel: 'Fenster (Scheiben im Rahmen, in einer Mauer nach Norden)', quelle: QUELLE,
    parameter: [
      param('breite', 'geometrie', { min: 1, max: 64, standard: 3, beschreibung: 'Breite der Glasfläche in Blöcken' }),
      param('hoehe', 'geometrie', { min: 1, max: 64, standard: 2, beschreibung: 'Höhe der Glasfläche in Blöcken' }),
      param('rahmen', 'menschenmass', { min: 0, max: 4, standard: 1, beschreibung: 'Rahmendicke in Blöcken (0 = ohne Rahmen)' }),
    ],
    testszenario: { start: 'leere Welt, Fenster in eine Mauer gesetzt', erwartung: 'Die Öffnung ist lückenlos mit Rahmen und Scheiben gefüllt' },
    baue: ({ breite, hoehe, rahmen }) => {
      const B = breite + 2 * rahmen;
      const ox = Math.floor(B / 2);
      const bloecke = [];
      for (let j = 0; j < hoehe + 2 * rahmen; j++) for (let i = 0; i < B; i++) {
        const glas = i >= rahmen && i < rahmen + breite && j >= rahmen && j < rahmen + hoehe;
        bloecke.push(glas ? { x: i - ox, y: j, z: 0, rolle: 'glas', form: 'scheibe' } : { x: i - ox, y: j, z: 0, rolle: 'akzent' });
      }
      return { bloecke, anschluesse: [{ art: 'oeffnung', achse: 'z', breite, hoehe }] };
    },
  });

  const saeule = definiere({
    id: 'bau.saeule', titel: 'Säule (Schaft mit Sockel und Kapitell)', quelle: QUELLE,
    parameter: [
      param('durchmesser', 'geometrie', { min: 1, max: 64, standard: 3, beschreibung: 'Durchmesser des Schafts in Blöcken' }),
      param('hoehe', 'geometrie', { min: 3, max: 256, standard: 10, beschreibung: 'Gesamthöhe in Blöcken' }),
    ],
    testszenario: { start: 'leere Welt mit Boden, Säule daraufgesetzt', erwartung: 'Säule ist symmetrisch; Sockel und Kapitell folgen der Proportion' },
    baue: ({ durchmesser: d, hoehe: H }) => {
      const s = Math.max(1, Math.round(H * sockelVerhaeltnis));
      const schaftHoehe = H - 2 * s;
      const rund = (breite, hoehe, versatzY, rolle) => formen.zylinder.erzeuge({ breite, tiefe: breite, hoehe, wandstaerke: 0 }).bloecke.map((b) => ({ ...b, y: b.y + versatzY, rolle }));
      return {
        bloecke: [...rund(d + 2 * ueberstand, s, 0, 'akzent'), ...rund(d, schaftHoehe, s, 'wand'), ...rund(d + 2 * ueberstand, s, s + schaftHoehe, 'akzent')],
        anschluesse: [{ art: 'auflage', seite: 'unten' }, { art: 'auflage', seite: 'oben' }],
      };
    },
  });

  return { gang, raum, treppe, wendeltreppe, tuer, fenster, saeule, alle: [gang, raum, treppe, wendeltreppe, tuer, fenster, saeule] };
}
