import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';
import { Tickbereich } from '../../src/ebene1/tickbereich.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const welt = () => e0.neueWelt();
const FRONT = { west: [-1, 0, 0], east: [1, 0, 0], north: [0, 0, -1], south: [0, 0, 1], top: [0, -1, 0] };
/** Halt- und Tickbereich-Prüfungen ohne die Schienen-Verbindungsprüfung (die hat eigene Tests in schienen.test.js). */
const halt = (w, optionen = {}) => e1.pruefe(w, { schienen: null, ...optionen });
const nur = (meldungen, regel) => meldungen.filter((m) => m.regel === regel);

test('Fackel braucht Halt auf der genannten Seite', () => {
  for (const [seite, [dx, dy, dz]] of Object.entries(FRONT)) {
    const w = welt();
    w.setzeBlock(10, 5, 10, 'minecraft:torch', { torch_facing_direction: seite });
    const ohne = halt(w);
    assert.deepEqual(ohne.map((m) => [m.regel, m.schwere, m.ort]), [['pruefer.braucht-halt-fackel', 'verstoss', { x: 10, y: 5, z: 10 }]], seite);
    w.setzeBlock(10 + dx, 5 + dy, 10 + dz, 'minecraft:stone');
    assert.deepEqual(halt(w), [], `${seite}: mit Haltblock in Ordnung`);
    // Halt auf der falschen Seite zählt nicht
    const falsch = welt();
    falsch.setzeBlock(10, 5, 10, 'minecraft:torch', { torch_facing_direction: seite });
    falsch.setzeBlock(10 - dx, 5 - dy, 10 - dz, 'minecraft:stone');
    assert.equal(halt(falsch).filter((m) => m.schwere === 'verstoss').length, 1, `${seite}: Block auf der Gegenseite hält nicht`);
  }
});

test('Fackel: Jonahs Beispiel aus Spieltest 7 (west = Nachbar liegt im Westen)', () => {
  const w = welt();
  w.setzeBlock(-16, -60, 3, 'minecraft:torch', { torch_facing_direction: 'west' });
  w.setzeBlock(-17, -60, 3, 'minecraft:stone');
  assert.deepEqual(halt(w), []);
});

test('Fackel: alle Fackelarten werden erkannt, unklarer Halt und fehlender Zustand geben Hinweise', () => {
  const arten = e0.register.bloecke.ids().filter((id) => Object.hasOwn(e0.register.bloecke.block(id).zustaende, 'torch_facing_direction'));
  assert.ok(arten.length >= 5 && arten.includes('minecraft:torch') && arten.includes('minecraft:redstone_torch') && arten.includes('minecraft:soul_torch'));
  for (const id of arten) {
    const w = welt();
    w.setzeBlock(0, 0, 0, id, { torch_facing_direction: 'top' });
    assert.equal(halt(w).length, 1, id);
  }
  const unklar = welt();
  unklar.setzeBlock(0, 0, 0, 'minecraft:torch', { torch_facing_direction: 'top' });
  unklar.setzeBlock(0, -1, 0, 'minecraft:oak_stairs', { weirdo_direction: 0 });
  assert.deepEqual(halt(unklar).map((m) => m.schwere), ['hinweis']);
  const ohneZustand = welt();
  ohneZustand.setzeBlock(0, 0, 0, 'minecraft:torch');
  assert.deepEqual(halt(ohneZustand).map((m) => m.schwere), ['hinweis']);
  const unbekanntesMass = welt();
  unbekanntesMass.setzeBlock(0, 0, 0, 'minecraft:torch', { torch_facing_direction: 'unknown' });
  assert.deepEqual(halt(unbekanntesMass).map((m) => m.schwere), ['hinweis']);
});

test('Fackel bleibt nach Drehen und Spiegeln mit dem Vermesser korrekt befestigt', () => {
  const original = welt();
  original.setzeBlock(0, 0, 0, 'minecraft:torch', { torch_facing_direction: 'west' });
  original.setzeBlock(-1, 0, 0, 'minecraft:stone');
  original.setzeBlock(4, 0, 4, 'minecraft:torch', { torch_facing_direction: 'top' });
  original.setzeBlock(0, 0, 3, 'minecraft:torch', { torch_facing_direction: 'north' });
  original.setzeBlock(0, 0, 2, 'minecraft:stone');
  const teil = original.ausschnitt({ x: -5, y: -5, z: -5 }, { x: 5, y: 5, z: 5 });
  assert.deepEqual(halt(original).filter((m) => m.schwere === 'verstoss').map((m) => m.ort), [{ x: 4, y: 0, z: 4 }], 'Fackel mit top steht ohne Boden – schon im Original');
  for (const op of [(t) => e0.vermesser.drehe(t, 1), (t) => e0.vermesser.drehe(t, 2), (t) => e0.vermesser.drehe(t, 3), (t) => e0.vermesser.spiegle(t, 'x'), (t) => e0.vermesser.spiegle(t, 'z')]) {
    const ziel = welt();
    ziel.fuegeBauteilEin(op(teil), { x: 20, y: 0, z: 20 });
    assert.equal(halt(ziel).filter((m) => m.schwere === 'verstoss').length, 1, 'genau derselbe eine Verstoß, die anderen Fackeln halten weiter');
  }
});

test('Schiene braucht Boden', () => {
  for (const id of ['minecraft:rail', 'minecraft:golden_rail', 'minecraft:detector_rail', 'minecraft:activator_rail']) {
    const w = welt();
    w.setzeBlock(3, 70, 3, id, { rail_direction: 0 });
    assert.deepEqual(halt(w).map((m) => [m.regel, m.schwere]), [['pruefer.braucht-halt-schiene', 'verstoss']], id);
    w.setzeBlock(3, 69, 3, 'minecraft:stone');
    assert.deepEqual(halt(w), [], `${id} mit Boden`);
  }
  const auf_stufe = welt();
  auf_stufe.setzeBlock(0, 1, 0, 'minecraft:rail', { rail_direction: 1 });
  auf_stufe.setzeBlock(0, 0, 0, 'minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' });
  assert.deepEqual(halt(auf_stufe).map((m) => m.schwere), ['verstoss'], 'Spieltest 20.10.2026: Schiene nicht auf Halbstufe');
});

test('Prüfer: sortierte, maschinenlesbare Meldungen; die Welt bleibt unverändert', () => {
  const w = welt();
  w.setzeBlock(5, 9, 5, 'minecraft:rail', { rail_direction: 0 });
  w.setzeBlock(1, 2, 3, 'minecraft:rail', { rail_direction: 0 });
  w.setzeBlock(0, 2, 3, 'minecraft:torch', { torch_facing_direction: 'top' });
  const vorher = e0.speichereWelt(w);
  const m = halt(w);
  assert.equal(e0.speichereWelt(w), vorher);
  assert.deepEqual(m.map((x) => [x.ort.y, x.ort.z, x.ort.x]), [[2, 3, 0], [2, 3, 1], [9, 5, 5]], 'nach y, z, x');
  for (const x of m) {
    assert.deepEqual(Object.keys(x).sort(), ['meldung', 'ort', 'regel', 'schwere']);
    assert.ok(e1.regelwerk.hat(x.regel), `Regel ${x.regel} existiert im Regelwerk`);
    assert.ok(['verstoss', 'hinweis'].includes(x.schwere));
    assert.ok(Number.isInteger(x.ort.x) && Number.isInteger(x.ort.y) && Number.isInteger(x.ort.z));
  }
  assert.deepEqual(halt(welt()), [], 'leere Welt: nichts zu melden');
});

test('Tickbereich-Prüfung meldet Chunks außerhalb', () => {
  const w = welt();
  w.setzeBlock(3, 0, 3, 'minecraft:stone');
  w.setzeBlock(90, 4, 7, 'minecraft:stone');
  w.setzeBlock(91, 4, 7, 'minecraft:stone');
  w.setzeBlock(0, 0, 200, 'minecraft:stone');
  w.fuegeWesenHinzu({ id: 'minecraft:villager_v2', x: 0.5, y: 0, z: 400.5 });
  const bereich = new Tickbereich({ spieler: [{ x: 0, z: 0 }], distanz: 1 });
  const m = nur(halt(w, { tickbereich: bereich }), 'pruefer.tickbereich');
  assert.equal(m.length, 3, 'Chunk (5,0) mit 2 Blöcken, Chunk (0,12) mit 1 Block, Chunk (0,25) mit dem Dorfbewohner');
  assert.deepEqual(m.map((x) => x.ort), [{ x: 0, y: 0, z: 200 }, { x: 0, y: 0, z: 400 }, { x: 90, y: 4, z: 7 }]);
  assert.ok(m.every((x) => x.schwere === 'verstoss'));
  assert.match(m[2].meldung, /2 Einträge/);
  assert.match(m[0].meldung, /1 Einträge/);
  const alles = new Tickbereich({ spieler: [{ x: 0, z: 0 }], distanz: 30 });
  assert.deepEqual(nur(halt(w, { tickbereich: alles }), 'pruefer.tickbereich'), []);
  assert.deepEqual(nur(halt(w), 'pruefer.tickbereich'), [], 'ohne Tickbereich wird nicht geprüft');
});

/** Hilfe: setzt Haltblock + Fackel/Schiene und liefert die Schwere der Meldungen. */
const urteil = (haltId, haltZustand, seite, ort = [10, 5, 10]) => {
  const w = welt();
  const [x, y, z] = ort;
  const v = { west: [-1, 0, 0], east: [1, 0, 0], north: [0, 0, -1], south: [0, 0, 1], top: [0, -1, 0] }[seite];
  w.setzeBlock(x, y, z, 'minecraft:torch', { torch_facing_direction: seite });
  w.setzeBlock(x + v[0], y + v[1], z + v[2], haltId, haltZustand);
  return halt(w).map((m) => m.schwere);
};
const schienenUrteil = (haltId, haltZustand) => {
  const w = welt();
  w.setzeBlock(0, 1, 0, 'minecraft:rail', { rail_direction: 0 });
  w.setzeBlock(0, 0, 0, haltId, haltZustand);
  return halt(w).map((m) => m.schwere);
};

test('Spieltest 20.10.2026 (Fackel): Glas hält an allen Seiten und oben, Zaun/Glasscheibe nur oben, Halbstufe nur oben auf der oberen Hälfte', () => {
  for (const glas of ['minecraft:glass', 'minecraft:white_stained_glass']) {
    for (const seite of ['west', 'east', 'north', 'south', 'top']) assert.deepEqual(urteil(glas, {}, seite), [], `${glas} ${seite}`);
  }
  for (const id of ['minecraft:oak_fence', 'minecraft:glass_pane']) {
    assert.deepEqual(urteil(id, {}, 'top'), [], `${id}: oben drauf geht`);
    for (const seite of ['west', 'east', 'north', 'south']) assert.deepEqual(urteil(id, {}, seite), ['verstoss'], `${id} ${seite}: seitlich nicht`);
  }
  for (const seite of ['west', 'east', 'north', 'south']) assert.deepEqual(urteil('minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' }, seite), ['verstoss'], `Halbstufe seitlich ${seite}`);
  assert.deepEqual(urteil('minecraft:oak_slab', { 'minecraft:vertical_half': 'top' }, 'top'), [], 'obere Halbstufe: oben drauf geht');
  assert.deepEqual(urteil('minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' }, 'top'), ['verstoss'], 'untere Halbstufe: nicht ganze Blockhöhe');
  assert.deepEqual(urteil('minecraft:oak_slab', {}, 'top'), ['hinweis'], 'Hälfte nicht angegeben: unklar');
  assert.deepEqual(urteil('minecraft:oak_double_slab', {}, 'west'), [], 'doppelte Halbstufe = ganzer Block');
});

test('Spieltest 20.10.2026 (Fackel): Treppe hält nur an der großen Seite', () => {
  // weirdo_direction: 0 Ost, 1 West, 2 Süd, 3 Nord = Richtung der großen (hohen) Seite
  const gross = { 0: 'east', 1: 'west', 2: 'south', 3: 'north' };
  const zurFackel = { west: 'east', east: 'west', north: 'south', south: 'north' }; // Fackel mit Wert „west“ liegt östlich vom Haltblock
  for (const [w, richtung] of Object.entries(gross)) {
    for (const seite of ['west', 'east', 'north', 'south']) {
      const erwartet = zurFackel[seite] === richtung ? [] : ['verstoss'];
      assert.deepEqual(urteil('minecraft:oak_stairs', { weirdo_direction: Number(w) }, seite), erwartet, `Treppe groß=${richtung}, Fackel-Wert ${seite}`);
    }
  }
  assert.deepEqual(urteil('minecraft:oak_stairs', {}, 'west'), ['hinweis'], 'Richtung der Treppe nicht angegeben');
  assert.deepEqual(urteil('minecraft:oak_stairs', { weirdo_direction: 0 }, 'top'), ['hinweis'], 'Fackel oben auf der Treppe ist nicht getestet');
});

test('Treppe + Fackel bleibt nach Drehen und Spiegeln mit dem Vermesser gültig', () => {
  const original = welt();
  original.setzeBlock(0, 0, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
  original.setzeBlock(1, 0, 0, 'minecraft:torch', { torch_facing_direction: 'west' });
  assert.deepEqual(halt(original), [], 'große Seite zeigt nach Osten, Fackel steht östlich');
  const teil = original.ausschnitt({ x: -3, y: -3, z: -3 }, { x: 3, y: 3, z: 3 });
  const ops = [(t) => e0.vermesser.drehe(t, 1), (t) => e0.vermesser.drehe(t, 2), (t) => e0.vermesser.drehe(t, 3), (t) => e0.vermesser.spiegle(t, 'x'), (t) => e0.vermesser.spiegle(t, 'z')];
  for (const op of ops) {
    const ziel = welt();
    ziel.fuegeBauteilEin(op(teil), { x: 10, y: 0, z: 10 });
    assert.deepEqual(halt(ziel), [], 'Treppe und Fackel drehen gemeinsam');
  }
});

test('Spieltest 20.10.2026 (Schiene): Glasblock ja; Halbstufe, Treppe, Zaun, Glasscheibe nein', () => {
  assert.deepEqual(schienenUrteil('minecraft:glass', {}), []);
  assert.deepEqual(schienenUrteil('minecraft:stone', {}), []);
  assert.deepEqual(schienenUrteil('minecraft:oak_slab', { 'minecraft:vertical_half': 'top' }), [], 'obere Halbstufe trägt die Schiene (Spieltest 21.10.2026)');
  assert.deepEqual(schienenUrteil('minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' }), ['verstoss']);
  assert.deepEqual(schienenUrteil('minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false }), ['verstoss'], 'aufrechte Treppe');
  assert.deepEqual(schienenUrteil('minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: true }), [], 'kopfstehende Treppe trägt die Schiene (Spieltest 21.10.2026)');
  assert.deepEqual(schienenUrteil('minecraft:oak_stairs', { weirdo_direction: 0 }), ['hinweis'], 'Lage nicht angegeben: unklar');
  assert.deepEqual(schienenUrteil('minecraft:oak_fence', {}), ['verstoss']);
  assert.deepEqual(schienenUrteil('minecraft:glass_pane', {}), ['verstoss']);
  assert.deepEqual(schienenUrteil('minecraft:cobblestone_wall', {}), ['hinweis'], 'Mauer: nicht getestet');
  assert.deepEqual(schienenUrteil('minecraft:oak_leaves', {}), ['hinweis'], 'Laub: nicht getestet');
});

test('Ebene 0: Tragfähigkeit steht als Fakt im Register (nicht im Prüfer)', () => {
  const eig = (id) => e0.register.bloecke.block(id).eigenschaften;
  assert.deepEqual([eig('minecraft:glass').fackelOben, eig('minecraft:glass').fackelSeiten, eig('minecraft:glass').schiene], [true, 'alle', true]);
  assert.deepEqual([eig('minecraft:oak_stairs').fackelSeiten, eig('minecraft:oak_stairs').schiene], ['grosse-seite', 'wenn-oben']);
  assert.deepEqual([eig('minecraft:oak_fence').fackelOben, eig('minecraft:oak_fence').fackelSeiten], [true, 'keine']);
  assert.equal(eig('minecraft:oak_slab').fackelOben, 'obere-haelfte');
  assert.equal(eig('minecraft:oak_double_slab').vollblock, true, 'doppelte Halbstufe ist ein Vollblock');
  assert.equal(eig('minecraft:oak_leaves').fackelOben, null, 'Laub: unbekannt statt geraten');
  for (const id of e0.register.bloecke.ids()) {
    const x = eig(id);
    assert.ok([true, false, null, 'obere-haelfte'].includes(x.fackelOben), id);
    assert.ok(['alle', 'keine', 'grosse-seite', null].includes(x.fackelSeiten), id);
    assert.ok([true, false, null, 'wenn-oben'].includes(x.schiene), id);
  }
});
