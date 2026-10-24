import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { TESTPALETTE } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const key = (p) => `${p.x},${p.y},${p.z}`;
const ANTRIEB = 'minecraft:golden_rail';
const SCHIENE = 'minecraft:rail';

function weltMit(p) {
  const w = e0.neueWelt();
  e2.platziere(w, p, TESTPALETTE);
  return w;
}
/** Dreht die Welt um k Vierteldrehungen über den Vermesser (Technikblöcke und Fundament). */
function gedreht(w, k) {
  const b = e0.vermesser.drehe(w.ausschnitt({ x: -60, y: -5, z: -60 }, { x: 60, y: 20, z: 60 }), k);
  const n = e0.neueWelt();
  n.fuegeBauteilEin(b);
  return n;
}
const startVon = (p) => p.bloecke.find((b) => b.technik && b.id.endsWith('rail') && b.y === 0 && b.z === 0);
const schienenVon = (p) => p.bloecke.filter((b) => b.technik && (b.id === ANTRIEB || b.id === SCHIENE));
/** Läuft die Bahn ab und urteilt; liefert { bahn, befunde }. */
function pruefeBahn(w, start, richtung) {
  const bahn = e1.lore.bahn(w, start, richtung);
  return { bahn, befunde: e1.lore.analysiere(bahn) };
}
const verstoesse = (w, start, richtung) => e1.pruefe(w, { schienen: e1.schienen, lore: e1.lore, loreStart: { pos: start, richtung }, stromQuellen: [] }).filter((x) => x.schwere === 'verstoss');

test('Technik: Antriebsstrecke', () => {
  // gemessen: jede 8. Schiene angetrieben ist sicher, das sind höchstens 7 normale Schienen zwischen den Antriebsschienen (hart gesetzt)
  assert.equal(e1.regelwerk.parameter('lore.abstand-eben', 'sicherJaBisK'), 8);
  for (let abstand = 0; abstand <= 7; abstand++) for (const abschnitte of [1, 2, 5, 20]) {
    const p = e2.baue('tech.antriebsstrecke', { abschnitte, abstand });
    const schienen = schienenVon(p);
    assert.equal(schienen.length, abschnitte * (abstand + 1), `a=${abschnitte} k=${abstand}`);
    assert.equal(schienen.filter((s) => s.id === ANTRIEB).length, abschnitte);
    assert.equal(p.bloecke.filter((b) => b.id === 'minecraft:redstone_block').length, abschnitte);
    // jede normale Schiene hat Fundament (Rolle boden), jede Antriebsschiene einen Redstone-Block darunter
    for (const s of schienen) {
      const darunter = p.bloecke.find((b) => b.x === s.x && b.y === s.y - 1 && b.z === s.z);
      assert.ok(darunter, `Fundament unter ${key(s)}`);
      assert.equal(s.id === ANTRIEB ? darunter.id : darunter.rolle, s.id === ANTRIEB ? 'minecraft:redstone_block' : 'boden');
    }
    const w = weltMit(p);
    const start = { x: 0, y: 0, z: 0 };
    const { bahn, befunde } = pruefeBahn(w, start, 'north');
    assert.equal(bahn.schienen.length, schienen.length, `Bahn lückenlos a=${abschnitte} k=${abstand}`);
    assert.deepEqual(befunde, [], `Analyse a=${abschnitte} k=${abstand}`);
    // alle Antriebsschienen sind bestromt; der Zustand im Paket entspricht dem, was die Mechanik berechnet
    assert.equal(e1.antrieb.aktive(w).size, abschnitte);
    assert.deepEqual(e1.antrieb.aktiviere(w), [], 'rail_data_bit stimmt schon');
    assert.deepEqual(verstoesse(w, start, 'north'), []);
  }
  // Menschenmaß der Technik: mehr als der gemessene sichere Abstand wird abgelehnt
  assert.throws(() => e2.baue('tech.antriebsstrecke', { abstand: 8 }), /außerhalb/);
  assert.throws(() => e2.baue('tech.antriebsstrecke', { abstand: 10 }), /außerhalb/);
  assert.throws(() => e2.baue('tech.antriebsstrecke', { abschnitte: 0 }), /außerhalb/);
  // Technik skaliert über Anzahl: doppelt so viele Abschnitte = doppelt so viele Schienen derselben Art
  const a = e2.baue('tech.antriebsstrecke', { abschnitte: 3 }), b = e2.baue('tech.antriebsstrecke', { abschnitte: 6 });
  assert.equal(schienenVon(b).length, 2 * schienenVon(a).length);
  // Fehlt in der Mitte eine Antriebsschiene, meldet die Analyse „nein“ (15 Schienen ohne Antrieb)
  const kaputt = weltMit(e2.baue('tech.antriebsstrecke', { abschnitte: 3, abstand: 7 }));
  kaputt.setzeBlock(0, 0, -8, SCHIENE, { rail_direction: 0 });
  assert.ok(e1.lore.analysiere(e1.lore.bahn(kaputt, { x: 0, y: 0, z: 0 }, 'north')).some((x) => x.urteil === 'nein'));
  // Anschlüsse und Technikblöcke ohne Rolle
  const p = e2.baue('tech.antriebsstrecke');
  assert.deepEqual(p.anschluesse.map((x) => x.seite), ['sued', 'nord']);
  assert.ok(p.bloecke.every((x) => x.technik === true ? !('rolle' in x) : x.rolle === 'boden'));
});

test('Technik: Steigung', () => {
  const immer = 2; // gemessen (lore.abstand-steigung): Antriebsschienen höchstens jede zweite Schiene auf der Rampe
  assert.equal(e1.regelwerk.parameter('lore.abstand-steigung', 'immer'), immer);
  assert.equal(e1.regelwerk.parameter('lore.abstand-steigung', 'getestetBisHoehe'), 5);
  for (let hoehe = 1; hoehe <= 5; hoehe++) {
    const p = e2.baue('tech.steigung', { hoehe });
    const schienen = schienenVon(p).sort((a, b) => b.z - a.z);
    assert.equal(schienen.length, hoehe + 1);
    assert.equal(schienen[schienen.length - 1].y - schienen[0].y, hoehe, `Höhe ${hoehe}`);
    // erste Schiene und Ausgang angetrieben, Abstand der Antriebsschienen höchstens 2 (hart gesetzt, unabhängig von der Regeldatei)
    const nr = schienen.map((s, i) => (s.id === ANTRIEB ? i : -1)).filter((i) => i >= 0);
    assert.equal(nr[0], 0);
    assert.equal(nr[nr.length - 1], schienen.length - 1);
    for (let i = 0; i + 1 < nr.length; i++) assert.ok(nr[i + 1] - nr[i] <= 2, `Höhe ${hoehe}: Antriebsschienen im Abstand ${nr[i + 1] - nr[i]}`);
    const w = weltMit(p);
    const start = { x: 0, y: 0, z: 0 };
    const { bahn, befunde } = pruefeBahn(w, start, 'north');
    assert.equal(bahn.schienen.length, hoehe + 1);
    assert.equal(bahn.schienen.filter((s) => s.hoch > 0).length, hoehe, 'jede Rampenschiene steigt');
    assert.deepEqual(befunde, [], `Rampe ${hoehe}`);
    assert.equal(e1.antrieb.aktive(w).size, nr.length);
    assert.deepEqual(e1.antrieb.aktiviere(w), []);
    assert.deepEqual(verstoesse(w, start, 'north'), []);
    // gedreht um 90°, 180°, 270° bleibt alles gültig
    const richtungen = ['east', 'south', 'west'];
    for (let k = 1; k <= 3; k++) {
      const g = gedreht(w, k);
      const sg = g.alleBloecke().filter((b) => b.id === ANTRIEB || b.id === SCHIENE).find((b) => b.y === 0 && e1.schienen.enden(b.zustand) && g.alleBloecke().filter((x) => x.id === ANTRIEB || x.id === SCHIENE).length === hoehe + 1);
      const pos = { x: sg.x, y: 0, z: sg.z };
      const r = pruefeBahn(g, pos, richtungen[k - 1]);
      assert.equal(r.bahn.schienen.length, hoehe + 1, `Höhe ${hoehe} gedreht ${k * 90}°`);
      assert.deepEqual(r.befunde, [], `Höhe ${hoehe} gedreht ${k * 90}°`);
    }
  }
  assert.throws(() => e2.baue('tech.steigung', { hoehe: 6 }), /außerhalb/);
  assert.throws(() => e2.baue('tech.steigung', { hoehe: 0 }), /außerhalb/);
  // Rampe ohne Antrieb wäre ein Befund: dieselbe Rampe ohne Antriebsschienen
  const kalt = weltMit(e2.baue('tech.steigung', { hoehe: 3 }));
  for (const b of kalt.alleBloecke()) if (b.id === ANTRIEB) kalt.setzeBlock(b.x, b.y, b.z, SCHIENE, { rail_direction: b.zustand.rail_direction });
  assert.ok(e1.lore.analysiere(e1.lore.bahn(kalt, { x: 0, y: 0, z: 0 }, 'north')).length > 0, 'ohne Antrieb meldet die Analyse etwas');
});

test('Technik: Kurve', () => {
  for (let schenkel = 1; schenkel <= 12; schenkel++) for (const drehsinn of [1, 0]) for (const abstand of [1, 4, 7]) {
    const p = e2.baue('tech.kurve', { schenkel, drehsinn, abstand });
    const schienen = schienenVon(p);
    assert.equal(schienen.length, 2 * schenkel + 1, `s=${schenkel}`);
    const w = weltMit(p);
    const start = { x: 0, y: 0, z: 0 };
    const { bahn, befunde } = pruefeBahn(w, start, 'north');
    assert.equal(bahn.schienen.length, schienen.length, `Bahn lückenlos s=${schenkel} d=${drehsinn} k=${abstand}`);
    assert.deepEqual(befunde, [], `Analyse s=${schenkel} d=${drehsinn} k=${abstand}`);
    // Verbindungen beidseitig: jede Schiene hat an beiden Enden eine verbundene Gegenstelle (außer Anfang und Ende)
    for (const s of bahn.schienen.slice(1, -1)) {
      const sb = e1.schienen.schieneBei(w, s.pos);
      for (const e of e1.schienen.enden(sb.zustand)) assert.equal(e1.schienen.gegenstelle(w, s.pos, e).art, 'verbunden', `${key(s.pos)} ${JSON.stringify(e)}`);
    }
    // Kurve läuft nach Osten (Rechtskurve) bzw. Westen: Endschiene liegt bei x = ±schenkel
    const letzte = bahn.schienen[bahn.schienen.length - 1].pos;
    assert.deepEqual([letzte.x, letzte.z], [(drehsinn === 1 ? 1 : -1) * schenkel, -schenkel]);
    assert.equal(e1.antrieb.aktive(w).size, schienen.filter((x) => x.id === ANTRIEB).length);
    assert.deepEqual(e1.antrieb.aktiviere(w), []);
    assert.deepEqual(verstoesse(w, start, 'north'), []);
    // höchstens `abstand` normale Schienen am Stück
    let lauf = 0;
    for (const s of schienen.sort((a, b) => (a.z !== b.z ? b.z - a.z : Math.abs(a.x) - Math.abs(b.x)))) { lauf = s.id === ANTRIEB ? 0 : lauf + 1; assert.ok(lauf <= abstand, `s=${schenkel} k=${abstand}`); }
  }
  assert.throws(() => e2.baue('tech.kurve', { schenkel: 0 }), /außerhalb/);
  assert.throws(() => e2.baue('tech.kurve', { abstand: 8 }), /außerhalb/);
  assert.throws(() => e2.baue('tech.kurve', { abstand: 0 }), /außerhalb/);
  // Paket: Anschlüsse
  assert.deepEqual(e2.baue('tech.kurve', { drehsinn: 1 }).anschluesse.map((x) => x.seite), ['sued', 'ost']);
  assert.deepEqual(e2.baue('tech.kurve', { drehsinn: 0 }).anschluesse.map((x) => x.seite), ['sued', 'west']);
});
