// Ebene 2 – Technikmodule: Bahn (Antriebsstrecke, Steigungsstück, Kurve). Regeln: data/regeln/technik.json; Messwerte aus data/regeln/lore.json (von Jonah geprüft).
// Technik skaliert über Anzahl, nie über Größe: Strecken werden verlängert (mehr Abschnitte), nicht gestreckt. Technikblöcke (Schiene, Antriebsschiene,
// Redstone-Block) sind fest (`technik: true`, Block-ID und Zustand); nur das Fundament unter normalen Schienen ist verkleidbar (Rolle `boden`).
// Alle Module laufen nach Norden (die Lore fährt Richtung z−), die Schiene liegt auf y = 0 (Rampe: steigt von y = 0), das Fundament auf y − 1.
// Die Zustandswerte der Schienenformen kommen aus `schienen.formAus` (Ebene 1), nicht aus Zahlen im Code. Drehen übernimmt der Vermesser (Ebene 0).
import { definiere, param } from './baustein.js';

const QUELLE = 'https://github.com/Thalrail/Blockwerk/blob/main/docs/messungen-lore.md (Ebene 2: Technikmodule, Messwerte von Jonah)';
const SCHIENE = 'minecraft:rail';
const ANTRIEB = 'minecraft:golden_rail';
const STROM = 'minecraft:redstone_block';
const QUELLE_NISCHE = 'https://minecraft.wiki/w/Villager (Berufsblöcke, Betten) und docs/ebenen.md (Ebene 2: Technikmodule)';

/**
 * @param {{regelwerk: import('../ebene1/regelwerk.js').Regelwerk, schienen: ReturnType<typeof import('../ebene1/schienen.js').erzeugeSchienen>, ebene0: ReturnType<typeof import('../ebene0/index.js').erzeugeEbene0>}} quellen
 */
export function erzeugeTechnik({ regelwerk, schienen, ebene0 }) {
  const P = (id, name) => regelwerk.parameter(id, name);
  // Jonah misst „jede k-te Schiene angetrieben, sicher bis k = 8“: das sind höchstens k − 1 = 7 normale Schienen zwischen zwei Antriebsschienen
  const maxAbstandEben = P('lore.abstand-eben', 'sicherJaBisK') - 1;
  const rampeImmer = P('lore.abstand-steigung', 'immer');
  const maxRampe = P('lore.abstand-steigung', 'getestetBisHoehe');
  const standardAbstand = P('tech.bahn', 'standardabstand');

  const form = (a, b, opt) => {
    const w = schienen.formAus([a, b], opt);
    if (w === null) throw new Error(`Keine Schienenform für ${JSON.stringify([a, b])}`);
    return w;
  };
  const ende = (richtung, dy = 0) => ({ richtung, dy });

  /** Baut aus einer Zellenliste (Reihenfolge = Fahrtrichtung) Schienen, Strom und Fundament. */
  function bahnBloecke(zellen) {
    const bloecke = [];
    for (const z of zellen) {
      const id = z.antrieb ? ANTRIEB : SCHIENE;
      bloecke.push({ x: z.x, y: z.y, z: z.z, technik: true, id, zustand: { rail_direction: z.form, ...(z.antrieb ? { rail_data_bit: true } : {}) } });
      bloecke.push(z.antrieb ? { x: z.x, y: z.y - 1, z: z.z, technik: true, id: STROM } : { x: z.x, y: z.y - 1, z: z.z, rolle: 'boden' });
    }
    return bloecke;
  }

  const abstandParam = (min) => param('abstand', 'technik', { min, max: maxAbstandEben, standard: Math.min(standardAbstand, maxAbstandEben), beschreibung: 'Normale Schienen zwischen zwei Antriebsschienen (höchstens der gemessene sichere Abstand von 8 Schienen, also 7 normale)' });

  const antriebsstrecke = definiere({
    id: 'tech.antriebsstrecke', titel: 'Antriebsstrecke (gerade, ebene Lorenbahn nach Norden)', quelle: QUELLE,
    parameter: [param('abschnitte', 'technik', { min: 1, max: 64, standard: 4, beschreibung: 'Zahl der Abschnitte aus 1 Antriebsschiene und `abstand` normalen Schienen (Technik skaliert über Anzahl)' }), abstandParam(0)],
    testszenario: { start: 'leere Welt, Strecke daraufgesetzt, Lore am Anfang', erwartung: 'Alle Antriebsschienen sind bestromt, die Analyse der Lorenbahn meldet kein „nein“ und kein „unklar“' },
    baue: ({ abschnitte, abstand }) => {
      const n = abschnitte * (abstand + 1);
      const zellen = Array.from({ length: n }, (_, i) => ({ x: 0, y: 0, z: -i, form: form(ende('north'), ende('south')), antrieb: i % (abstand + 1) === 0 }));
      return {
        bloecke: bahnBloecke(zellen),
        anschluesse: [{ art: 'schiene', seite: 'sued', hoehe: 0 }, { art: 'schiene', seite: 'nord', hoehe: 0, laenge: n }],
      };
    },
  });

  const steigung = definiere({
    id: 'tech.steigung', titel: 'Steigungsstück (Rampe nach Norden mit Antriebsschienen)', quelle: QUELLE,
    parameter: [param('hoehe', 'technik', { min: 1, max: maxRampe, standard: Math.min(3, maxRampe), beschreibung: 'Höhe der Rampe in Blöcken (nur bis zur gemessenen Höhe)' })],
    testszenario: { start: 'leere Welt, Rampe daraufgesetzt, Lore am Anfang', erwartung: 'Alle Antriebsschienen sind bestromt, die Lore bleibt auf der Rampe nicht stehen (Analyse ohne „nein“/„unklar“)' },
    baue: ({ hoehe }) => {
      const steigend = form(ende('south', 0), ende('north', 1), { gerade: true });
      const eben = form(ende('north'), ende('south'));
      // erste Schiene angetrieben, danach höchstens jede `immer`-te; oben eine Antriebsschiene als Ausgang
      const zellen = Array.from({ length: hoehe }, (_, i) => ({ x: 0, y: i, z: -i, form: steigend, antrieb: i % rampeImmer === 0 }));
      zellen.push({ x: 0, y: hoehe, z: -hoehe, form: eben, antrieb: true });
      return {
        bloecke: bahnBloecke(zellen),
        anschluesse: [{ art: 'schiene', seite: 'sued', hoehe: 0 }, { art: 'schiene', seite: 'nord', hoehe }],
      };
    },
  });

  const kurve = definiere({
    id: 'tech.kurve', titel: 'Kurve (90 Grad, zwei Schenkel mit Antriebsschienen)', quelle: QUELLE,
    parameter: [
      param('schenkel', 'technik', { min: 1, max: 16, standard: 3, beschreibung: 'Zahl der Schienen je Schenkel vor und nach der Kurvenschiene' }),
      param('drehsinn', 'menschenmass', { min: 0, max: 1, standard: 1, beschreibung: '1 = Rechtskurve (nach Osten), 0 = Linkskurve (nach Westen)' }),
      abstandParam(1), // die Kurvenschiene selbst ist normal und kann nicht angetrieben werden
    ],
    testszenario: { start: 'leere Welt, Kurve daraufgesetzt, Lore am Anfang', erwartung: 'Alle Schienen sind verbunden, die Antriebsschienen bestromt, die Analyse ohne „nein“/„unklar“' },
    baue: ({ schenkel: s, drehsinn, abstand }) => {
      const aus = drehsinn === 1 ? 'east' : 'west';
      const dx = drehsinn === 1 ? 1 : -1;
      const zellen = [];
      for (let i = 0; i < s; i++) zellen.push({ x: 0, y: 0, z: -i, form: form(ende('north'), ende('south')) });
      zellen.push({ x: 0, y: 0, z: -s, form: form(ende('south'), ende(aus)) });
      for (let i = 1; i <= s; i++) zellen.push({ x: dx * i, y: 0, z: -s, form: form(ende('east'), ende('west')) });
      const L = zellen.length, c = s;
      const antrieb = new Set([0, L - 1, c - 1, c + 1].filter((i) => i >= 0 && i < L && i !== c));
      for (let i = 0; i < L; i += abstand + 1) if (i !== c) antrieb.add(i);
      // Kontrolle der Regel: nie mehr als `abstand` normale Schienen zwischen zwei Antriebsschienen
      let lauf = 0;
      zellen.forEach((z, i) => { z.antrieb = antrieb.has(i); lauf = z.antrieb ? 0 : lauf + 1; if (lauf > abstand) throw new Error(`tech.kurve: ${lauf} normale Schienen am Stück bei Abstand ${abstand}`); });
      return {
        bloecke: bahnBloecke(zellen),
        anschluesse: [{ art: 'schiene', seite: 'sued', hoehe: 0 }, { art: 'schiene', seite: aus === 'east' ? 'ost' : 'west', hoehe: 0 }],
      };
    },
  });

  // ---------- Handelsnischen ----------
  const bloecke = ebene0.register.bloecke;
  const richtungVon = ebene0.vermesser.richtungVon;
  const innenHoehe = P('tech.nische', 'innenhoehe');
  const rastermass = P('tech.nische', 'rastermass');
  const dorfbewohnerId = P('tech.nische', 'dorfbewohner');
  const bettId = P('tech.nische', 'bett');
  /** Die 13 Berufsblöcke (ohne die brennende Form), nach Beruf sortiert; der Parameter `beruf` ist die Nummer in dieser Liste. */
  const berufe = bloecke.ids().filter((id) => bloecke.block(id).eigenschaften.beruf && !/^minecraft:lit_/.test(id))
    .sort((a, b) => (bloecke.block(a).eigenschaften.beruf < bloecke.block(b).eigenschaften.beruf ? -1 : 1));
  const standardBeruf = berufe.findIndex((id) => bloecke.block(id).eigenschaften.beruf === P('tech.nische', 'standardberuf'));
  if (standardBeruf < 0) throw new Error('tech.nische: Standardberuf unbekannt');

  /** Zustand eines Blocks mit allen Richtungszuständen nach `richtung` (so lassen sich Berufsblöcke später drehen); unbehandelte Zustände bleiben weg. */
  function richtungsZustand(id, richtung) {
    const z = {};
    for (const [name, art] of Object.entries(bloecke.block(id).zustaende)) {
      if (ebene0.drehregeln.zustaende[name]?.art !== 'richtung') continue;
      const w = bloecke.zustandsart(name).werte.find((v) => richtungVon(name, v) === richtung);
      if (w !== undefined) z[name] = w;
    }
    return z;
  }
  const kopfWert = bloecke.zustandsart('direction').werte.find((v) => richtungVon('direction', v, bettId) === 'south');
  if (kopfWert === undefined) throw new Error('tech.nische: Bett-Richtung south unbekannt');

  const nischen = definiere({
    id: 'tech.handelsnischen', titel: 'Handelsnischen (Reihe geschlossener Zellen für je einen Dorfbewohner)', quelle: QUELLE_NISCHE,
    parameter: [
      param('anzahl', 'technik', { min: 1, max: 256, standard: 4, beschreibung: 'Zahl der Nischen in der Reihe (Technik skaliert über Anzahl, nie über Größe)' }),
      param('beruf', 'technik', { min: 0, max: berufe.length - 1, standard: standardBeruf, beschreibung: `Nummer des Berufsblocks in der Liste ${berufe.map((id, i) => `${i} = ${bloecke.block(id).eigenschaften.beruf}`).join(', ')}` }),
    ],
    testszenario: { start: 'leere Welt, Reihe daraufgesetzt; die Dorfbewohner stehen in den Zellen', erwartung: 'Jeder Dorfbewohner bekommt ein Bett und seinen Beruf, bleibt in seiner Zelle, der Spieler kommt nicht hinein; Prüfer meldet keinen Verstoß' },
    baue: ({ anzahl, beruf }) => {
      const h = innenHoehe;
      const xMax = (anzahl - 1) * rastermass + 1;
      const bloeckeNische = [];
      const wesen = [];
      const feste = (x, y, z, id, zustand) => bloeckeNische.push({ x, y, z, technik: true, id, zustand });
      for (let x = -1; x <= xMax; x++) for (let z = -4; z <= 0; z++) {
        bloeckeNische.push({ x, y: -1, z, rolle: 'boden' });
        bloeckeNische.push({ x, y: h, z, rolle: 'wand' });
      }
      for (let x = -1; x <= xMax; x++) for (let y = 0; y < h; y++) bloeckeNische.push({ x, y, z: -4, rolle: 'wand' });
      for (let i = 0; i <= anzahl; i++) for (const z of [-3, -2, -1, 0]) for (let y = 0; y < h; y++) bloeckeNische.push({ x: i * rastermass - 1, y, z, rolle: 'wand' });
      for (let i = 0; i < anzahl; i++) {
        const x = i * rastermass;
        feste(x, 0, 0, berufe[beruf], richtungsZustand(berufe[beruf], 'south'));
        for (let y = 1; y < h; y++) bloeckeNische.push({ x, y, z: 0, rolle: 'glas', form: 'scheibe' });
        feste(x, 0, -2, bettId, { head_piece_bit: true, direction: kopfWert });
        feste(x, 0, -3, bettId, { head_piece_bit: false, direction: kopfWert });
        wesen.push({ id: dorfbewohnerId, x: x + 0.5, y: 0, z: -0.5 });
      }
      return { bloecke: bloeckeNische, wesen, anschluesse: [{ art: 'front', seite: 'sued', laenge: xMax + 2, nischen: anzahl }] };
    },
  });

  return { antriebsstrecke, steigung, kurve, nischen, berufe, alle: [antriebsstrecke, steigung, kurve, nischen] };
}
