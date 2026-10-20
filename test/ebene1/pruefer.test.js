import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';
import { Tickbereich } from '../../src/ebene1/tickbereich.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const welt = () => e0.neueWelt();
const FRONT = { west: [-1, 0, 0], east: [1, 0, 0], north: [0, 0, -1], south: [0, 0, 1], top: [0, -1, 0] };
const nur = (meldungen, regel) => meldungen.filter((m) => m.regel === regel);

test('Fackel braucht Halt auf der genannten Seite', () => {
  for (const [seite, [dx, dy, dz]] of Object.entries(FRONT)) {
    const w = welt();
    w.setzeBlock(10, 5, 10, 'minecraft:torch', { torch_facing_direction: seite });
    const ohne = e1.pruefe(w);
    assert.deepEqual(ohne.map((m) => [m.regel, m.schwere, m.ort]), [['pruefer.braucht-halt-fackel', 'verstoss', { x: 10, y: 5, z: 10 }]], seite);
    w.setzeBlock(10 + dx, 5 + dy, 10 + dz, 'minecraft:stone');
    assert.deepEqual(e1.pruefe(w), [], `${seite}: mit Haltblock in Ordnung`);
    // Halt auf der falschen Seite zählt nicht
    const falsch = welt();
    falsch.setzeBlock(10, 5, 10, 'minecraft:torch', { torch_facing_direction: seite });
    falsch.setzeBlock(10 - dx, 5 - dy, 10 - dz, 'minecraft:stone');
    assert.equal(e1.pruefe(falsch).filter((m) => m.schwere === 'verstoss').length, 1, `${seite}: Block auf der Gegenseite hält nicht`);
  }
});

test('Fackel: Jonahs Beispiel aus Spieltest 7 (west = Nachbar liegt im Westen)', () => {
  const w = welt();
  w.setzeBlock(-16, -60, 3, 'minecraft:torch', { torch_facing_direction: 'west' });
  w.setzeBlock(-17, -60, 3, 'minecraft:stone');
  assert.deepEqual(e1.pruefe(w), []);
});

test('Fackel: alle Fackelarten werden erkannt, unklarer Halt und fehlender Zustand geben Hinweise', () => {
  const arten = e0.register.bloecke.ids().filter((id) => Object.hasOwn(e0.register.bloecke.block(id).zustaende, 'torch_facing_direction'));
  assert.ok(arten.length >= 5 && arten.includes('minecraft:torch') && arten.includes('minecraft:redstone_torch') && arten.includes('minecraft:soul_torch'));
  for (const id of arten) {
    const w = welt();
    w.setzeBlock(0, 0, 0, id, { torch_facing_direction: 'top' });
    assert.equal(e1.pruefe(w).length, 1, id);
  }
  const unklar = welt();
  unklar.setzeBlock(0, 0, 0, 'minecraft:torch', { torch_facing_direction: 'top' });
  unklar.setzeBlock(0, -1, 0, 'minecraft:oak_stairs', { weirdo_direction: 0 });
  assert.deepEqual(e1.pruefe(unklar).map((m) => m.schwere), ['hinweis']);
  const ohneZustand = welt();
  ohneZustand.setzeBlock(0, 0, 0, 'minecraft:torch');
  assert.deepEqual(e1.pruefe(ohneZustand).map((m) => m.schwere), ['hinweis']);
  const unbekanntesMass = welt();
  unbekanntesMass.setzeBlock(0, 0, 0, 'minecraft:torch', { torch_facing_direction: 'unknown' });
  assert.deepEqual(e1.pruefe(unbekanntesMass).map((m) => m.schwere), ['hinweis']);
});

test('Fackel bleibt nach Drehen und Spiegeln mit dem Vermesser korrekt befestigt', () => {
  const original = welt();
  original.setzeBlock(0, 0, 0, 'minecraft:torch', { torch_facing_direction: 'west' });
  original.setzeBlock(-1, 0, 0, 'minecraft:stone');
  original.setzeBlock(4, 0, 4, 'minecraft:torch', { torch_facing_direction: 'top' });
  original.setzeBlock(0, 0, 3, 'minecraft:torch', { torch_facing_direction: 'north' });
  original.setzeBlock(0, 0, 2, 'minecraft:stone');
  const teil = original.ausschnitt({ x: -5, y: -5, z: -5 }, { x: 5, y: 5, z: 5 });
  assert.deepEqual(e1.pruefe(original).filter((m) => m.schwere === 'verstoss').map((m) => m.ort), [{ x: 4, y: 0, z: 4 }], 'Fackel mit top steht ohne Boden – schon im Original');
  for (const op of [(t) => e0.vermesser.drehe(t, 1), (t) => e0.vermesser.drehe(t, 2), (t) => e0.vermesser.drehe(t, 3), (t) => e0.vermesser.spiegle(t, 'x'), (t) => e0.vermesser.spiegle(t, 'z')]) {
    const ziel = welt();
    ziel.fuegeBauteilEin(op(teil), { x: 20, y: 0, z: 20 });
    assert.equal(e1.pruefe(ziel).filter((m) => m.schwere === 'verstoss').length, 1, 'genau derselbe eine Verstoß, die anderen Fackeln halten weiter');
  }
});

test('Schiene braucht Boden', () => {
  for (const id of ['minecraft:rail', 'minecraft:golden_rail', 'minecraft:detector_rail', 'minecraft:activator_rail']) {
    const w = welt();
    w.setzeBlock(3, 70, 3, id, { rail_direction: 0 });
    assert.deepEqual(e1.pruefe(w).map((m) => [m.regel, m.schwere]), [['pruefer.braucht-halt-schiene', 'verstoss']], id);
    w.setzeBlock(3, 69, 3, 'minecraft:stone');
    assert.deepEqual(e1.pruefe(w), [], `${id} mit Boden`);
  }
  const auf_stufe = welt();
  auf_stufe.setzeBlock(0, 1, 0, 'minecraft:rail', { rail_direction: 1 });
  auf_stufe.setzeBlock(0, 0, 0, 'minecraft:oak_slab', {});
  assert.ok(auf_stufe.alleBloecke().length === 2);
  assert.deepEqual(e1.pruefe(auf_stufe).map((m) => m.schwere), ['hinweis'], 'Halbstufe als Boden: im Spiel prüfen');
});

test('Prüfer: sortierte, maschinenlesbare Meldungen; die Welt bleibt unverändert', () => {
  const w = welt();
  w.setzeBlock(5, 9, 5, 'minecraft:rail', { rail_direction: 0 });
  w.setzeBlock(1, 2, 3, 'minecraft:rail', { rail_direction: 0 });
  w.setzeBlock(0, 2, 3, 'minecraft:torch', { torch_facing_direction: 'top' });
  const vorher = e0.speichereWelt(w);
  const m = e1.pruefe(w);
  assert.equal(e0.speichereWelt(w), vorher);
  assert.deepEqual(m.map((x) => [x.ort.y, x.ort.z, x.ort.x]), [[2, 3, 0], [2, 3, 1], [9, 5, 5]], 'nach y, z, x');
  for (const x of m) {
    assert.deepEqual(Object.keys(x).sort(), ['meldung', 'ort', 'regel', 'schwere']);
    assert.ok(e1.regelwerk.hat(x.regel), `Regel ${x.regel} existiert im Regelwerk`);
    assert.ok(['verstoss', 'hinweis'].includes(x.schwere));
    assert.ok(Number.isInteger(x.ort.x) && Number.isInteger(x.ort.y) && Number.isInteger(x.ort.z));
  }
  assert.deepEqual(e1.pruefe(welt()), [], 'leere Welt: nichts zu melden');
});

test('Tickbereich-Prüfung meldet Chunks außerhalb', () => {
  const w = welt();
  w.setzeBlock(3, 0, 3, 'minecraft:stone');
  w.setzeBlock(90, 4, 7, 'minecraft:stone');
  w.setzeBlock(91, 4, 7, 'minecraft:stone');
  w.setzeBlock(0, 0, 200, 'minecraft:stone');
  w.fuegeWesenHinzu({ id: 'minecraft:villager_v2', x: 0.5, y: 0, z: 400.5 });
  const bereich = new Tickbereich({ spieler: [{ x: 0, z: 0 }], distanz: 1 });
  const m = nur(e1.pruefe(w, { tickbereich: bereich }), 'pruefer.tickbereich');
  assert.equal(m.length, 3, 'Chunk (5,0) mit 2 Blöcken, Chunk (0,12) mit 1 Block, Chunk (0,25) mit dem Dorfbewohner');
  assert.deepEqual(m.map((x) => x.ort), [{ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: 400 }, { x: 90, y: 4, z: 7 }]);
  assert.ok(m.every((x) => x.schwere === 'verstoss'));
  assert.match(m[2].meldung, /2 Einträge/);
  assert.match(m[0].meldung, /1 Einträge/);
  const alles = new Tickbereich({ spieler: [{ x: 0, z: 0 }], distanz: 30 });
  assert.deepEqual(nur(e1.pruefe(w, { tickbereich: alles }), 'pruefer.tickbereich'), []);
  assert.deepEqual(nur(e1.pruefe(w), 'pruefer.tickbereich'), [], 'ohne Tickbereich wird nicht geprüft');
});
