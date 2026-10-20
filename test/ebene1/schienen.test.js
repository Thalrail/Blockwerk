import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';
import { Regelwerk } from '../../src/ebene1/regelwerk.js';
import { erzeugeSchienen } from '../../src/ebene1/schienen.js';
import { ladeRegeldateien } from '../../src/ebene1/daten-node.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const S = e1.schienen;
const RAIL = 'minecraft:rail';
const GOLD = 'minecraft:golden_rail';

/** Ebene Welt mit Steinboden (y = 0) von −6…6; Schienen liegen auf y = 1. */
const boden = () => {
  const w = e0.neueWelt();
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) w.setzeBlock(x, 0, z, 'minecraft:stone');
  return w;
};
/** Legt Schienen nacheinander, wie ein Spieler. Eintrag: [x, z] oder [x, z, id] oder [x, y, z, id]. */
const lege = (w, liste, schienen = S) => {
  const ergebnisse = [];
  for (const e of liste) {
    const [x, y, z, id] = e.length === 2 ? [e[0], 1, e[1], RAIL] : e.length === 3 ? [e[0], 1, e[1], e[2]] : e;
    ergebnisse.push(schienen.platziere(w, { x, y, z }, id));
  }
  return ergebnisse;
};
const wert = (w, x, z, y = 1) => w.leseBlock(x, y, z).zustand.rail_direction;
const N_S = 0, O_W = 1;

test('Schiene: Enden aus rail_direction (Spieltest 4)', () => {
  const erwartet = {
    0: ['north', 'south'], 1: ['east', 'west'], 2: ['east', 'west'], 3: ['east', 'west'], 4: ['north', 'south'], 5: ['north', 'south'],
    6: ['east', 'south'], 7: ['south', 'west'], 8: ['north', 'west'], 9: ['east', 'north'],
  };
  for (let v = 0; v <= 9; v++) {
    const enden = S.enden({ rail_direction: v });
    assert.equal(enden.length, 2, `Wert ${v}`);
    assert.deepEqual(enden.map((e) => e.richtung).sort(), [...erwartet[v]].sort(), `Wert ${v}`);
    assert.equal(S.formAus(enden), v, `Rückweg ${v}`);
  }
  assert.deepEqual(S.enden({ rail_direction: 2 }).filter((e) => e.dy === 1).map((e) => e.richtung), ['east'], 'Steigung nach Ost: hohes Ende im Osten');
  assert.deepEqual(S.enden({ rail_direction: 5 }).filter((e) => e.dy === 1).map((e) => e.richtung), ['south']);
  assert.ok([6, 7, 8, 9].every((v) => S.enden({ rail_direction: v }).every((e) => e.dy === 0)), 'Kurven steigen nie');
  assert.equal(S.enden({}), null);
  assert.equal(S.formAus([{ richtung: 'north', dy: 1 }, { richtung: 'south', dy: 1 }]), null, 'zwei hohe Enden gibt es nicht');
  assert.equal(S.formAus(S.enden({ rail_direction: 6 }), { gerade: true }), null, 'Kurve nicht erlaubt');
  assert.equal(S.formAus(S.enden({ rail_direction: 3 }), { gerade: true }), 3, 'Steigung erlaubt');
});

test('Schiene: einzelne Schiene ist Nord-Süd', () => {
  const w = boden();
  const r = lege(w, [[0, 0]])[0];
  assert.equal(wert(w, 0, 0), N_S);
  assert.deepEqual(r.verbundenMit, []);
  assert.equal(r.geaendert.length, 1);
  assert.equal(r.geaendert[0].vorher, null);
  for (const id of ['minecraft:golden_rail', 'minecraft:detector_rail', 'minecraft:activator_rail']) {
    const w2 = boden();
    lege(w2, [[2, 2, id]]);
    assert.equal(wert(w2, 2, 2), N_S, id);
  }
});

test('Schiene: Linie wird verlängert', () => {
  const ow = boden();
  lege(ow, [[0, 0], [1, 0], [2, 0]]);
  assert.deepEqual([0, 1, 2].map((x) => wert(ow, x, 0)), [O_W, O_W, O_W]);
  const ns = boden();
  lege(ns, [[0, 0], [0, -1], [0, -2], [0, 1]]);
  assert.deepEqual([-2, -1, 0, 1].map((z) => wert(ns, 0, z)), [N_S, N_S, N_S, N_S]);
  const luecke = boden();
  lege(luecke, [[0, 0], [2, 0], [1, 0]]);
  assert.deepEqual([0, 1, 2].map((x) => wert(luecke, x, 0)), [O_W, O_W, O_W], 'Lücke schließen: alle drei Ost-West');
  const weit = boden();
  lege(weit, [[-2, 3], [0, 3], [-1, 3], [1, 3]]);
  assert.deepEqual([-2, -1, 0, 1].map((x) => wert(weit, x, 3)), [O_W, O_W, O_W, O_W]);
});

test('Schiene: zwei Nachbarn verbinden sich (gerade oder Kurve)', () => {
  // Ecken: Nachbarn auf zwei Seiten → Kurve; erwarteter Wert aus der Tabelle (6 Süd-Ost, 7 Süd-West, 8 Nord-West, 9 Nord-Ost)
  const ecken = [
    [[-1, 0], [0, -1], 8], // West + Nord
    [[1, 0], [0, -1], 9],  // Ost + Nord
    [[-1, 0], [0, 1], 7],  // West + Süd
    [[1, 0], [0, 1], 6],   // Ost + Süd
  ];
  for (const [a, b, kurve] of ecken) {
    for (const reihenfolge of [[a, b], [b, a]]) {
      const w = boden();
      lege(w, [...reihenfolge, [0, 0]]);
      assert.equal(wert(w, 0, 0), kurve, `Ecke ${JSON.stringify([a, b])}, Reihenfolge ${JSON.stringify(reihenfolge)}`);
      assert.equal(S.gegenstelle(w, { x: 0, y: 1, z: 0 }, S.enden(w.leseBlock(0, 1, 0).zustand)[0]).art, 'verbunden');
    }
  }
  // gegenüberliegende Nachbarn: gerade
  const ow = boden(); lege(ow, [[-1, 0], [1, 0], [0, 0]]);
  assert.equal(wert(ow, 0, 0), O_W);
  const ns = boden(); lege(ns, [[0, -1], [0, 1], [0, 0]]);
  assert.equal(wert(ns, 0, 0), N_S);
});

test('Schiene: Nachbar stellt sich auf neue Schiene ein', () => {
  const w = boden();
  lege(w, [[1, 0]]);
  assert.equal(wert(w, 1, 0), N_S);
  const r = lege(w, [[0, 0]])[0];
  assert.equal(wert(w, 0, 0), O_W);
  assert.equal(wert(w, 1, 0), O_W, 'Nord-Süd wird Ost-West');
  assert.deepEqual(r.geaendert.map((a) => [a.pos.x, a.vorher, a.rail_direction]), [[0, null, O_W], [1, N_S, O_W]]);
  assert.deepEqual(r.verbundenMit, [{ x: 1, y: 1, z: 0 }]);

  // Beide Enden besetzt: die Mittelschiene bleibt unverändert, die neue Schiene bleibt allein
  const voll = boden();
  lege(voll, [[-1, 0], [0, 0], [1, 0]]);
  const r2 = lege(voll, [[0, -1]])[0];
  assert.equal(wert(voll, 0, 0), O_W, 'Mittelschiene unverändert');
  assert.equal(wert(voll, 0, -1), N_S, 'neue Schiene bleibt Nord-Süd');
  assert.deepEqual(r2.verbundenMit, []);

  // Ein Ende besetzt: der Nachbar behält seine Verbindung und knickt zur neuen Schiene ab (Kurve)
  const knick = boden();
  lege(knick, [[0, 0], [0, 1]]); // Linie Nord-Süd (0,0)-(0,1)
  lege(knick, [[1, 0]]);         // Schiene östlich der oberen: Nachbar (0,0) hat Ende nach Süden besetzt
  assert.equal(wert(knick, 0, 0), 6, 'Nachbar (0,0): Süd (besetzt) + Ost (neu) = Kurve Süd-Ost');
  assert.equal(wert(knick, 1, 0), O_W);
});

test('Schiene: Rampe nach oben und unten', () => {
  // Oben liegt eine Schiene einen Block höher, unten wird gelegt
  const w = boden();
  w.setzeBlock(2, 1, 0, 'minecraft:stone');
  lege(w, [[2, 2, 0, RAIL]]); // obere Schiene (y = 2) auf dem Stein
  lege(w, [[0, 0], [1, 0]]);
  assert.equal(wert(w, 1, 0), 2, 'untere Schiene steigt nach Osten an');
  assert.equal(wert(w, 0, 0), O_W);
  assert.equal(wert(w, 2, 0, 2), O_W, 'obere Schiene liegt flach, zeigt zur Rampe');
  assert.equal(S.gegenstelle(w, { x: 1, y: 1, z: 0 }, { richtung: 'east', dy: 1 }).art, 'verbunden');

  // umgekehrte Reihenfolge: erst die untere Linie, dann die obere Schiene – die untere stellt sich zur Rampe um
  const v = boden();
  v.setzeBlock(2, 1, 0, 'minecraft:stone');
  lege(v, [[0, 0], [1, 0]]);
  lege(v, [[2, 2, 0, RAIL]]);
  assert.equal(wert(v, 1, 0), 2, 'tiefere Schiene steigt zur neuen an');
  assert.equal(wert(v, 0, 0), O_W);
  assert.equal(wert(v, 2, 0, 2), O_W);

  // alle vier Richtungen
  const hoch = { east: [1, 0, 2], west: [-1, 0, 3], south: [0, 1, 5], north: [0, -1, 4] };
  for (const [richtung, [dx, dz, erwartet]] of Object.entries(hoch)) {
    const x = boden();
    x.setzeBlock(dx, 1, dz, 'minecraft:stone');
    lege(x, [[dx, 2, dz, RAIL]]);
    lege(x, [[0, 0]]);
    assert.equal(wert(x, 0, 0), erwartet, `Steigung nach ${richtung}`);
  }

  // Kurven steigen nie: Nachbar in Kurve bleibt, wenn er zur Rampe nicht passt
  const k = boden();
  lege(k, [[0, 0], [0, 1], [1, 1]]); // (0,1) ist Kurve (Nord-Ost)
  assert.equal(wert(k, 0, 1), 9);
  k.setzeBlock(-1, 1, 1, 'minecraft:stone');
  lege(k, [[-1, 2, 1, RAIL]]); // obere Schiene links neben der Kurve
  assert.equal(wert(k, 0, 1), 9, 'Kurve bleibt Kurve');
});

test('Schiene: Antriebsschienen werden nie zur Kurve', () => {
  for (const id of [GOLD, 'minecraft:detector_rail', 'minecraft:activator_rail']) {
    const w = boden();
    lege(w, [[-1, 0], [0, -1], [0, 0, id]]);
    assert.ok(wert(w, 0, 0) <= 5, `${id} an der Ecke: gerade`);
    assert.deepEqual(S.nurGerade.has(id), true);
  }
  // Eine Antriebsschiene als Nachbar nimmt keine Kurve an: sie bleibt unverändert, die neue bleibt allein
  const w = boden();
  lege(w, [[-1, 0, GOLD], [0, 0, GOLD], [1, 0]]); // Linie Ost-West, Mitte hat beide Enden besetzt
  const vorher = wert(w, 0, 0);
  const r = lege(w, [[0, -1]])[0];
  assert.equal(wert(w, 0, 0), vorher);
  assert.ok(wert(w, 0, 0) <= 5);
  assert.deepEqual(r.verbundenMit, []);
  // Antriebsschiene mit freiem Ende wird zur Linie ausgerichtet (gerade), nicht zur Kurve
  const g = boden();
  lege(g, [[0, 0], [0, 1]]);               // Nord-Süd-Linie
  lege(g, [[2, 2, GOLD]]);                 // einzelne Antriebsschiene
  lege(g, [[1, 2]]);                       // normale Schiene links daneben: Antriebsschiene wird Ost-West
  assert.equal(wert(g, 2, 2), O_W);
  for (let v = 0; v <= 9; v++) assert.ok(S.formAus(S.enden({ rail_direction: v }), { gerade: true }) === (v <= 5 ? v : null));
});

test('Schiene: T-Stelle und Kreuzung (Annahme)', () => {
  const t = boden();
  lege(t, [[-1, 0], [1, 0], [0, 1]]);
  lege(t, [[0, 0]]);
  assert.equal(wert(t, 0, 0), O_W, 'T: gegenüberliegendes Paar (West, Ost) geht vor');
  const kreuz = boden();
  lege(kreuz, [[-1, 0], [1, 0], [0, 1], [0, -1]]);
  lege(kreuz, [[0, 0]]);
  assert.equal(wert(kreuz, 0, 0), O_W, 'Kreuzung: erstes gegenüberliegendes Paar in der Reihenfolge der Bevorzugung (West/Ost)');
  const nord = boden();
  lege(nord, [[0, -1], [0, 1], [1, 0]]);
  lege(nord, [[0, 0]]);
  assert.equal(wert(nord, 0, 0), N_S, 'T mit Nord, Süd, Ost: Nord-Süd');
});

test('Schiene: Rampen-Bevorzugung folgt den Daten (Annahme)', () => {
  const aufbauen = (schienen) => {
    const w = boden();
    for (const x of [-1, 1]) { w.setzeBlock(x, 1, 0, 'minecraft:stone'); }
    lege(w, [[-1, 2, 0, RAIL], [1, 2, 0, RAIL]], schienen);
    lege(w, [[0, 0]], schienen);
    return wert(w, 0, 0);
  };
  assert.equal(aufbauen(S), 3, 'Standard: West zuerst → Steigung nach Westen');
  const dateien = ladeRegeldateien();
  const ost = JSON.parse(JSON.stringify(dateien));
  ost.find((d) => d.bereich === 'schiene').regeln.find((r) => r.id === 'schiene.bevorzugung').parameter.bevorzugung = ['east', 'west', 'south', 'north'];
  const anders = erzeugeSchienen({ regelwerk: new Regelwerk(ost), register: e0.register });
  assert.equal(aufbauen(anders), 2, 'Ost zuerst → Steigung nach Osten');
});

test('Schiene: alle Reihenfolgen in der Nachbarschaft ergeben gültige, gegenseitige Verbindungen', () => {
  const seiten = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const permutationen = (liste) => (liste.length <= 1 ? [liste] : liste.flatMap((x, i) => permutationen([...liste.slice(0, i), ...liste.slice(i + 1)]).map((r) => [x, ...r])));
  let faelle = 0;
  for (let maske = 0; maske < 16; maske++) {
    const nachbarn = seiten.filter((_, i) => maske & (1 << i));
    for (const id of [RAIL, GOLD]) {
      for (const reihe of permutationen([...nachbarn, [0, 0]])) {
        const w = boden();
        for (const [x, z] of reihe) {
          const r = S.platziere(w, { x, y: 1, z }, x === 0 && z === 0 ? id : RAIL);
          // Ergebnis gültig
          for (const a of r.geaendert) assert.ok(a.rail_direction >= 0 && a.rail_direction <= 9);
          // jede gewählte Verbindung ist danach gegenseitig
          const eigene = S.enden(w.leseBlock(x, 1, z).zustand);
          for (const partner of r.verbundenMit) {
            const treffer = eigene.some((e) => { const g = S.gegenstelle(w, { x, y: 1, z }, e); return g.art === 'verbunden' && g.partner.pos.x === partner.x && g.partner.pos.z === partner.z; });
            assert.ok(treffer, `Verbindung zu ${JSON.stringify(partner)} nicht gegenseitig (Maske ${maske}, Reihenfolge ${JSON.stringify(reihe)})`);
          }
        }
        if (id === GOLD) assert.ok(wert(w, 0, 0) <= 5, 'Antriebsschiene nie Kurve');
        faelle += 1;
      }
    }
  }
  assert.equal(faelle, 522, "alle Teilmengen × alle Reihenfolgen × 2 Schienenarten");
});

test('Schiene: Platzieren ist deterministisch und verträgt Drehen mit dem Vermesser (eindeutige Fälle)', () => {
  const szenarien = [
    [[0, 0], [1, 0], [1, 1]],                 // L-Stück
    [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]], // U-Form
    [[0, 0], [2, 0], [1, 0]],                 // Lücke schließen
    [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]], // Linie mit Knick
  ];
  const drehe = ([x, z], k) => { let a = x, b = z; for (let i = 0; i < k; i++) [a, b] = [-b, a]; return [a, b]; };
  for (const szenario of szenarien) {
    for (let k = 1; k <= 3; k++) {
      const normal = boden();
      lege(normal, szenario);
      const gedrehtGelegt = boden();
      lege(gedrehtGelegt, szenario.map((p) => drehe(p, k)));
      const teil = normal.ausschnitt({ x: -6, y: 0, z: -6 }, { x: 6, y: 1, z: 6 });
      const gedrehtesTeil = e0.vermesser.drehe(teil, k);
      const vergleich = e0.neueWelt();
      vergleich.fuegeBauteilEin(gedrehtesTeil);
      const schienen = (w) => w.alleBloecke().filter((b) => b.id === RAIL);
      assert.deepEqual(schienen(gedrehtGelegt), schienen(vergleich), `Szenario ${JSON.stringify(szenario)} um ${k} gedreht`);
    }
  }
  const a = boden(), b = boden();
  lege(a, szenarien[1]); lege(b, szenarien[1]);
  assert.equal(e0.speichereWelt(a), e0.speichereWelt(b));
});

test('Schiene: platziere lehnt Nicht-Schienen ab und behält andere Zustände', () => {
  const w = boden();
  assert.throws(() => S.platziere(w, { x: 0, y: 1, z: 0 }, 'minecraft:stone'), /keine Schiene/);
  lege(w, [[0, 0, GOLD]]);
  assert.equal(w.leseBlock(0, 1, 0).zustand.rail_data_bit, false, 'Antriebsschiene startet unbestromt');
  w.setzeBlock(1, 1, 0, GOLD, { rail_direction: 0, rail_data_bit: true });
  lege(w, [[2, 0]]); // Nachbar der gestromten Antriebsschiene wird nicht verändert, wenn er nicht passt – hier passt er
  assert.equal(w.leseBlock(1, 1, 0).zustand.rail_data_bit, true, 'rail_data_bit bleibt erhalten');
});

test('Prüfer: Schienenverbindungen', () => {
  const sauber = boden();
  lege(sauber, [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]]);
  const m = e1.pruefe(sauber);
  const verb = m.filter((x) => x.regel === 'pruefer.schiene-verbindung');
  assert.ok(verb.every((x) => x.schwere === 'hinweis'), 'konsistente Bahn: nur Sackgassen-Hinweise');
  assert.equal(verb.length, 2, 'zwei Enden der Bahn');
  assert.deepEqual(m.filter((x) => x.schwere === 'verstoss'), []);

  const einseitig = boden();
  einseitig.setzeBlock(0, 1, 0, RAIL, { rail_direction: O_W });   // zeigt nach Osten auf (1,1,0)
  einseitig.setzeBlock(1, 1, 0, RAIL, { rail_direction: N_S });   // zeigt nicht zurück
  const v = e1.pruefe(einseitig).filter((x) => x.schwere === 'verstoss');
  assert.ok(v.length >= 1);
  assert.ok(v.some((x) => x.regel === 'pruefer.schiene-verbindung' && x.ort.x === 0 && /nicht zurückzeigt/.test(x.meldung)));

  const rampe = boden();
  rampe.setzeBlock(2, 1, 0, 'minecraft:stone');
  lege(rampe, [[2, 2, 0, RAIL], [0, 0], [1, 0]]);
  assert.deepEqual(e1.pruefe(rampe).filter((x) => x.schwere === 'verstoss'), [], 'Rampe ist beidseitig verbunden');

  const ohneForm = boden();
  ohneForm.setzeBlock(0, 1, 0, RAIL);
  assert.deepEqual(e1.pruefe(ohneForm).map((x) => x.schwere), ['hinweis']);
  assert.deepEqual(e1.pruefe(boden()), [], 'leere Welt: nichts');
});

test('Prüfer: Antriebsschiene als Kurve', () => {
  const w = boden();
  w.setzeBlock(0, 1, 0, GOLD, { rail_direction: 6 });
  w.setzeBlock(3, 1, 0, 'minecraft:detector_rail', { rail_direction: 7 });
  w.setzeBlock(6, 1, 0, GOLD, { rail_direction: 2 });
  const m = e1.pruefe(w).filter((x) => x.regel === 'pruefer.antriebsschiene-kurve');
  assert.deepEqual(m.map((x) => [x.ort.x, x.schwere]), [[0, 'verstoss'], [3, 'hinweis']], 'Steigung ist erlaubt');
});
