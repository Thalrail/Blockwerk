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
const QUELLE_LORENNISCHE = 'https://minecraft.wiki/w/Minecart (Aktivierungsschiene wirft Passagiere aus) und https://minecraft.wiki/w/Water (Strömung); Entwurf nach Bild 07 der Zitadelle (docs/zitadelle)';
const QUELLE_NISCHE ='https://minecraft.wiki/w/Villager (Berufsblöcke, Betten) und docs/ebenen.md (Ebene 2: Technikmodule)';

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

  // ---------- Handelsnischen an der Lorenbahn (Bild 07) ----------
  // Eigenes Koordinatensystem: Front (Laufgang) nach Süden (z+), Reihe entlang x, Nische i steht bei x = 2i, Gehhöhe y = 0.
  //   z = 0 Front (Scheibe; die Hebel hängen davor bei z = 1), z = −1 Stehzelle, z = −2 Berufsblock, z = −3 Rückwand, z = −4 Zufuhrbahn (y = 3).
  //   y = 3: Decke mit Deckenklappe über der Stehzelle; der Stich (x = 2i + 1, z = −3…−1) fährt nach Süden, „rechts“ der letzten Schiene liegt die Stehzelle.
  //   Unter dem Boden (y = −1…) liegt der Wasserkanal mit Gefälle: Quelle bei x = −2, nach je `kanalstufe` Zellen fällt das Wasser einen Block tiefer.
  const falltuer = 'minecraft:trapdoor';
  const hebel = 'minecraft:lever';
  const aktivierungsschiene = 'minecraft:activator_rail';
  const wasserQuelle = { id: 'minecraft:water', zustand: { liquid_depth: 0 } };
  const lorenNische = definiere({
    id: 'tech.handelsnischen-lore', titel: 'Handelsnischen an der Lorenbahn (Dorfbewohner kommen per Lore von oben, Rückführung per Wasserkanal)', quelle: QUELLE_LORENNISCHE,
    parameter: [
      param('anzahl', 'technik', { min: 1, max: 256, standard: 4, beschreibung: 'Zahl der Nischen in der Reihe (Technik skaliert über Anzahl, nie über Größe)' }),
      param('beruf', 'technik', { min: 0, max: berufe.length - 1, standard: standardBeruf, beschreibung: `Nummer des Berufsblocks in der Liste ${berufe.map((id, i) => `${i} = ${bloecke.block(id).eigenschaften.beruf}`).join(', ')}` }),
      param('kanalstufe', 'technik', { min: 2, max: 6, standard: 6, beschreibung: 'Zellen des Wasserkanals je Gefällestufe (gerade Zahl, höchstens 6: das Wasser fließt 7 Zellen weit, das Loch des Wasserfalls muss unter einer Nische liegen)' }),
    ],
    testszenario: { start: 'leere Welt, Reihe daraufgesetzt, Wasser simuliert; Lore mit Dorfbewohner am Stichanfang', erwartung: 'Auswurf auf die Deckenklappe, Hebel öffnet sie, Dorfbewohner fällt in die Stehzelle (Fall höchstens 3), zweiter Hebel öffnet die Bodenfalltür, die Strömung trägt ihn bis zum Kanalende; Prüfer meldet keinen Verstoß' },
    baue: ({ anzahl, beruf, kanalstufe }) => {
      if (kanalstufe % 2 !== 0) throw new Error(`tech.handelsnischen-lore: kanalstufe ${kanalstufe} muss gerade sein (das Loch des Wasserfalls liegt sonst nicht unter einer Nische)`);
      const K = kanalstufe;
      const xMax = 2 * anzahl - 1;
      const kanal = kanalGeometrie(anzahl, K);
      const karte = new Map();
      const setze = (x, y, z, b) => karte.set(`${x},${y},${z}`, { x, y, z, ...b });
      const wand = (x, y, z) => setze(x, y, z, { rolle: 'wand' });
      const fest = (x, y, z, id, zustand) => setze(x, y, z, { technik: true, id, ...(zustand ? { zustand } : {}) });
      const nordSued = form(ende('north'), ende('south'));
      const ostWest = form(ende('east'), ende('west'));
      const nischeX = (x) => x >= 0 && x % 2 === 0 && x / 2 < anzahl;

      // Kanal: Boden, Seitenwände, Füllung über dem Wasser (nur unter den Nischen bleibt ein Schacht)
      for (let s = 0; s < kanal.segmente; s++) {
        const ys = kanal.y(s);
        for (let x = kanal.x0(s); x <= kanal.xh(s) - (s === kanal.segmente - 1 ? 0 : 1); x++) setze(x, ys - 1, -1, { rolle: 'boden' });
        wand(kanal.xh(s) + 1, ys, -1);
      }
      wand(kanal.xEnde + 1, kanal.y(kanal.segmente - 1) - 1, -1);
      wand(-3, -1, -1); wand(-3, -2, -1);
      for (let x = -3; x <= kanal.xEnde + 1; x++) {
        for (let y = kanal.untenWand(x); y <= -1; y++) { wand(x, y, 0); wand(x, y, -2); }
        if (x < -1) continue;
        const ys = kanal.y(kanal.segmentOben(x));
        if (!nischeX(x)) for (let y = ys + 1; y <= -1; y++) wand(x, y, -1);
      }
      fest(-2, -1, -1, wasserQuelle.id, wasserQuelle.zustand);

      // Boden der Zufuhr- und Rückwandzeile, Zufuhrbahn
      for (let x = -1; x <= xMax; x++) {
        setze(x, -1, -3, { rolle: 'boden' }); setze(x, -1, -4, { rolle: 'boden' });
        for (let y = 0; y <= 2; y++) wand(x, y, -4);
        const angetrieben = (x + 1) % (maxAbstandEben + 1) === 0;
        fest(x, 3, -4, angetrieben ? ANTRIEB : SCHIENE, { rail_direction: ostWest, ...(angetrieben ? { rail_data_bit: true } : {}) });
        if (angetrieben) fest(x, 2, -4, STROM);
      }
      // Wandsäulen (ungerade x) zwischen den Nischen
      for (let x = -1; x <= xMax; x += 2) for (let z = -3; z <= 0; z++) for (let y = 0; y <= 2; y++) wand(x, y, z);
      for (let i = 0; i < anzahl; i++) {
        const x = 2 * i, xs = x + 1;
        // Stehzelle: Bodenfalltür (zu), Deckenklappe (zu), Hebel an der Front, Berufsblock dahinter
        fest(x, 0, -1, falltuer, { open_bit: false, upside_down_bit: false, direction: 0 });
        fest(x, 3, -1, falltuer, { open_bit: false, upside_down_bit: false, direction: 0 });
        fest(x, 0, -2, berufe[beruf], richtungsZustand(berufe[beruf], 'south'));
        for (const y of [1, 2]) wand(x, y, -2);
        for (let y = 0; y <= 2; y++) wand(x, y, -3);
        wand(x, 0, 0);
        fest(x, 0, 1, hebel, { lever_direction: 'south', open_bit: false });
        setze(x, 1, 0, { rolle: 'glas', form: 'scheibe' });
        wand(x, 2, 0); wand(x, 3, 0); wand(x, 3, -2); wand(x, 3, -3);
        fest(x, 3, 1, hebel, { lever_direction: 'south', open_bit: false });
        // Stich: Antriebsschienen bis zur Aktivierungsschiene am Ende (rechts davon liegt die Deckenklappe), Prellbock davor
        for (const z of [-3, -2]) { fest(xs, 3, z, ANTRIEB, { rail_direction: nordSued, rail_data_bit: true }); }
        fest(xs, 3, -1, aktivierungsschiene, { rail_direction: nordSued, rail_data_bit: true });
        fest(xs, 2, -3, STROM); fest(xs, 2, -1, STROM);
        wand(xs, 3, 0);
      }
      return {
        bloecke: [...karte.values()],
        wesen: [],
        anschluesse: [
          { art: 'front', seite: 'sued', laenge: xMax + 2, nischen: anzahl },
          { art: 'zufuhr', seite: 'west', x: -1, y: 3, z: -4, laenge: xMax + 2 },
          { art: 'rueckfuehrung', seite: 'ost', x: kanal.xEnde, y: kanal.y(kanal.segmente - 1), z: -1, gefaelle: kanal.segmente - 1 },
          { art: 'weichen', stellen: Array.from({ length: anzahl }, (_, i) => ({ x: 2 * i + 1, y: 3, z: -4 })) },
        ],
        sperrzonen: [],
      };
    },
  });

  /** Geometrie des Wasserkanals: Segment s deckt x0(s) … xh(s) ab (xh = Loch des Wasserfalls, zugleich Anfang von s + 1), Wasserhöhe y(s) = −1 − s. */
  function kanalGeometrie(anzahl, K) {
    const xMax = 2 * anzahl - 1;
    const segmente = Math.max(1, Math.ceil((xMax + 2) / K));
    const x0 = (s) => -2 + K * s;
    const xh = (s) => -2 + K * (s + 1);
    const y = (s) => -1 - s;
    return {
      segmente, x0, xh, y, xEnde: xh(segmente - 1),
      /** Segment, dessen Wasser in Spalte x (x ≥ −1) liegt; die Lochspalte gehört zum oberen Segment. */
      segmentOben: (x) => Math.min(segmente - 1, Math.floor((x + 1) / K)),
      /** Tiefster Block der Seitenwand in Spalte x (Boden des unteren Segments, wenn dort zwei Segmente aneinanderstoßen). */
      untenWand: (x) => y(Math.min(segmente - 1, Math.max(0, Math.floor((x + 2) / K)))) - 1,
    };
  }

  return { antriebsstrecke, steigung, kurve, nischen, lorenNische, berufe, alle: [antriebsstrecke, steigung, kurve, nischen, lorenNische] };
}
