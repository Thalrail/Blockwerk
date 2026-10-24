import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const RZ = e1.redstoneZeit;
const KO = e1.kolben;
const STEIN = 'minecraft:stone', KOLBEN = 'minecraft:piston', KLEBRIG = 'minecraft:sticky_piston';
const ARM = 'minecraft:piston_arm_collision', KLEBRIG_ARM = 'minecraft:sticky_piston_arm_collision';

const boden = () => {
  const w = e0.neueWelt();
  for (let x = -8; x <= 25; x++) for (let z = -8; z <= 8; z++) w.setzeBlock(x, 0, z, STEIN);
  return w;
};
const fd = (r) => [0, 1, 2, 3, 4, 5].find((n) => e0.vermesser.richtungVon('facing_direction', n) === r);
const kolben = (w, x, y, z, r = 'east', id = KOLBEN) => w.setzeBlock(x, y, z, id, { facing_direction: fd(r) });
/** Ausgefahrener Kolben: Kolben plus Armblock in der Kopfzelle. */
const ausgefahren = (w, x, y, z, r = 'east', id = KOLBEN) => {
  kolben(w, x, y, z, r, id);
  const v = { east: [1, 0, 0], west: [-1, 0, 0], south: [0, 0, 1], north: [0, 0, -1], up: [0, 1, 0], down: [0, -1, 0] }[r];
  w.setzeBlock(x + v[0], y + v[1], z + v[2], id === KLEBRIG ? KLEBRIG_ARM : ARM, { facing_direction: fd(r) });
};
const block = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:redstone_block');
const luft = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:air');
function ruhe(l) { l.bisRuhe(300); if (l.taktgeber.tick % 2 === 1) l.laufe(1); return l.taktgeber.tick; }
const seit = (l, ab, start) => l.ereignisse.slice(ab).map((e) => [e.tick - start, e.was]);
const id = (l, x, y, z) => l.welt.leseBlock(x, y, z).id;
/** Reihe aus n Steinen ab x = 1 vor einem Kolben bei x = 0, Strom durch einen Redstone-Block darüber. */
function reihe(n, klebrig = false) {
  const w = boden(); kolben(w, 0, 1, 0, 'east', klebrig ? KLEBRIG : KOLBEN);
  for (let i = 1; i <= n; i++) w.setzeBlock(i, 1, 0, STEIN);
  return w;
}

test('Kolben: Zeit und Strom', () => {
  assert.deepEqual([e1.regelwerk.parameter('kolben.start', 'startTicks'), e1.regelwerk.parameter('kolben.dauer', 'ticks')], [2, 2]);
  // Ausfahren: erster C-Tick mit Strom (Tick 2) + Start 2 + Dauer 2 = Tick 6; Einfahren ebenso
  const l = RZ.erzeuge(reihe(3)); const start = ruhe(l); const ab = l.ereignisse.length;
  block(l.welt, 0, 2, 0); l.laufe(20);
  assert.deepEqual(seit(l, ab, start), [[6, 'kolben-aus']]);
  assert.deepEqual([1, 2, 3, 4].map((x) => id(l, x, 1, 0)), [ARM, STEIN, STEIN, STEIN]);
  assert.equal(l.welt.leseBlock(1, 1, 0).zustand.facing_direction, fd('east'));
  const s2 = l.taktgeber.tick; const ab2 = l.ereignisse.length;
  luft(l.welt, 0, 2, 0); l.laufe(20);
  assert.deepEqual(seit(l, ab2, s2), [[6, 'kolben-ein']]);
  assert.deepEqual([1, 2, 3, 4].map((x) => id(l, x, 1, 0)), ['minecraft:air', STEIN, STEIN, STEIN]);
  // Strom von hinten, oben, unten, seitlich ja; nur der Kopf zählt nicht
  const seite = (x, y, z) => { const w = reihe(1); block(w, x, y, z); const r = RZ.erzeuge(w); r.laufe(14); return r.ereignisse.some((e) => e.was === 'kolben-aus'); };
  assert.deepEqual([seite(-1, 1, 0), seite(0, 2, 0), seite(0, 0, 0), seite(0, 1, 1), seite(0, 1, -1)], [true, true, true, true, true]);
  // der Kopf (Zelle vor dem Kolben) bestromt ihn nicht – dort liegt ein Redstone-Block statt des Steins
  const kopf = boden(); kolben(kopf, 0, 1, 0); block(kopf, 1, 1, 0);
  const lk = RZ.erzeuge(kopf); lk.laufe(20);
  assert.equal(lk.ereignisse.filter((e) => e.was === 'kolben-aus').length, 0);
  // keine Quasi-Konnektivität: ein Redstone-Block zwei Blöcke oberhalb bestromt den Kolben nicht
  const quasi = reihe(1); block(quasi, 0, 3, 0);
  const lq = RZ.erzeuge(quasi); lq.laufe(20);
  assert.equal(lq.ereignisse.filter((e) => e.was === 'kolben-aus').length, 0);
  // alle sechs Richtungen: Block vor dem Kolben rückt um eins weiter, Strom von hinten
  for (const r of ['east', 'west', 'south', 'north', 'up', 'down']) {
    const v = { east: [1, 0, 0], west: [-1, 0, 0], south: [0, 0, 1], north: [0, 0, -1], up: [0, 1, 0], down: [0, -1, 0] }[r];
    const w = boden(); const p = [8, 8, 0];
    kolben(w, ...p, r);
    w.setzeBlock(p[0] + v[0], p[1] + v[1], p[2] + v[2], 'minecraft:gold_block');
    block(w, p[0] - v[0], p[1] - v[1], p[2] - v[2]);
    const lr = RZ.erzeuge(w); lr.laufe(14);
    assert.equal(id(lr, p[0] + 2 * v[0], p[1] + 2 * v[1], p[2] + 2 * v[2]), 'minecraft:gold_block', `Richtung ${r}`);
    assert.equal(id(lr, p[0] + v[0], p[1] + v[1], p[2] + v[2]), ARM);
  }
});

test('Kolben: Schieben und Grenzen', () => {
  assert.equal(e1.regelwerk.parameter('kolben.limit', 'bloecke'), 12);
  const versuch = (n) => { const l = RZ.erzeuge(reihe(n)); ruhe(l); block(l.welt, 0, 2, 0); l.laufe(20); return l; };
  for (const n of [0, 1, 5, 12]) {
    const l = versuch(n);
    assert.equal(l.ereignisse.filter((e) => e.was === 'kolben-aus').length, 1, `${n} Blöcke`);
    for (let i = 2; i <= n + 1; i++) assert.equal(id(l, i, 1, 0), STEIN, `Stein ${i}`);
    assert.equal(id(l, 1, 1, 0), ARM);
  }
  const zuviel = versuch(13);
  assert.equal(zuviel.ereignisse.filter((e) => e.was === 'kolben-aus').length, 0);
  assert.equal(zuviel.ereignisse.filter((e) => e.was === 'kolben-blockiert').length, 1, 'wird nur einmal gemeldet');
  assert.match(zuviel.ereignisse.find((e) => e.was === 'kolben-blockiert').grund, /mehr als 12/);
  assert.equal(id(zuviel, 1, 1, 0), STEIN, 'nichts bewegt sich');
  // Unbewegliche Blöcke
  for (const unbeweglich of ['minecraft:obsidian', 'minecraft:bedrock', 'minecraft:crying_obsidian', 'minecraft:command_block', 'minecraft:jukebox', 'minecraft:enchanting_table', 'minecraft:ender_chest', 'minecraft:grindstone', 'minecraft:lodestone', 'minecraft:respawn_anchor']) {
    const w = reihe(1); w.setzeBlock(2, 1, 0, unbeweglich, unbeweglich === 'minecraft:command_block' ? { conditional_bit: false, facing_direction: 0 } : unbeweglich === 'minecraft:ender_chest' ? { 'minecraft:cardinal_direction': 'north' } : unbeweglich === 'minecraft:respawn_anchor' ? { respawn_anchor_charge: 0 } : unbeweglich === 'minecraft:bedrock' ? { infiniburn_bit: false } : {});
    block(w, 0, 2, 0);
    const l = RZ.erzeuge(w); l.laufe(14);
    assert.equal(l.ereignisse.filter((e) => e.was === 'kolben-blockiert').length, 1, unbeweglich);
    assert.match(l.ereignisse.find((e) => e.was === 'kolben-blockiert').grund, /unbeweglich/, unbeweglich);
  }
  // Zerstörbares am Ende: Fackel, Blume, Staub, Knopf werden entfernt; der Stein davor rückt vor
  for (const [zerst, zustand] of [['minecraft:torch', { torch_facing_direction: 'top' }], ['minecraft:poppy', {}], ['minecraft:redstone_wire', { redstone_signal: 0 }], ['minecraft:lever', { lever_direction: 'up_north_south', open_bit: false }]]) {
    const w = reihe(1); w.setzeBlock(2, 1, 0, zerst, zustand); block(w, 0, 2, 0);
    const l = RZ.erzeuge(w); l.laufe(14);
    assert.equal(id(l, 2, 1, 0), STEIN, `${zerst}: Stein ist vorgerückt`);
    assert.equal(l.ereignisse.find((e) => e.was === 'kolben-aus').zerstoert, zerst);
  }
  // Teppich und Schiene werden geschoben, nicht zerstört
  for (const [beweglich, zustand] of [['minecraft:white_carpet', {}], ['minecraft:rail', { rail_direction: 0 }]]) {
    const w = reihe(0); w.setzeBlock(1, 1, 0, beweglich, zustand); block(w, 0, 2, 0);
    const l = RZ.erzeuge(w); l.laufe(14);
    assert.equal(id(l, 2, 1, 0), beweglich, beweglich);
    assert.equal(l.ereignisse.find((e) => e.was === 'kolben-aus').zerstoert, null);
  }
  // Behälter: unklar, der Kolben bleibt eingefahren
  for (const behaelter of ['minecraft:barrel', 'minecraft:furnace', 'minecraft:hopper', 'minecraft:dispenser']) {
    const w = reihe(0); w.setzeBlock(1, 1, 0, behaelter, behaelter === 'minecraft:furnace' ? { 'minecraft:cardinal_direction': 'north' } : behaelter === 'minecraft:hopper' ? { facing_direction: 0, toggle_bit: false } : behaelter === 'minecraft:dispenser' ? { facing_direction: 0, triggered_bit: false } : { facing_direction: 0, open_bit: false });
    block(w, 0, 2, 0);
    const l = RZ.erzeuge(w); l.laufe(14);
    assert.match(l.ereignisse.find((e) => e.was === 'kolben-blockiert').grund, /unklar/, behaelter);
  }
  // Zustand bleibt erhalten (Treppe, Richtung)
  const t = reihe(0); t.setzeBlock(1, 1, 0, 'minecraft:oak_stairs', { weirdo_direction: 2, upside_down_bit: true, 'minecraft:corner': 'none' }); block(t, 0, 2, 0);
  const lt = RZ.erzeuge(t); lt.laufe(14);
  assert.deepEqual(lt.welt.leseBlock(2, 1, 0).zustand, { weirdo_direction: 2, upside_down_bit: true, 'minecraft:corner': 'none' });
  // Kolben schiebt einen eingefahrenen Kolben; ausgefahrene Kolben und Köpfe sind unbeweglich
  const k = reihe(0); kolben(k, 1, 1, 0); k.setzeBlock(2, 1, 0, STEIN); block(k, 0, 2, 0);
  const lk = RZ.erzeuge(k); lk.laufe(14);
  assert.deepEqual([1, 2, 3].map((x) => id(lk, x, 1, 0)), [ARM, KOLBEN, STEIN]);
  const a = reihe(0); ausgefahren(a, 1, 1, 0); block(a, 0, 2, 0);
  const la = RZ.erzeuge(a); la.laufe(14);
  assert.match(la.ereignisse.find((e) => e.was === 'kolben-blockiert').grund, /ausgefahren/);
  // Beobachter vor dem Kolben: das Ausfahren verändert die Zelle und löst ihn aus
  const o = reihe(0); block(o, 0, 2, 0);
  o.setzeBlock(1, 2, 0, 'minecraft:observer', { 'minecraft:facing_direction': 'down', powered_bit: false });
  const lo = RZ.erzeuge(o); lo.laufe(20);
  const ereignisse = lo.ereignisse.map((e) => e.was);
  assert.ok(ereignisse.indexOf('kolben-aus') >= 0 && ereignisse.indexOf('beobachter-impuls') > ereignisse.indexOf('kolben-aus'), 'Beobachter pulst nach dem Ausfahren');
});

test('Kolben: klebriger Kolben', () => {
  assert.equal(e1.regelwerk.parameter('kolben.klebrig', 'anzahl'), 1);
  // klebrig, ausgefahren, zwei Steine hinter dem Kopf: zieht genau einen zurück
  const aufbau = (klebrig, vorneId = STEIN) => {
    const w = boden(); ausgefahren(w, 0, 1, 0, 'east', klebrig ? KLEBRIG : KOLBEN);
    if (vorneId) w.setzeBlock(2, 1, 0, vorneId, vorneId === 'minecraft:torch' ? { torch_facing_direction: 'top' } : {});
    w.setzeBlock(3, 1, 0, STEIN);
    return w;
  };
  const l = RZ.erzeuge(aufbau(true)); l.laufe(14);
  assert.deepEqual(seit(l, 0, 0), [[6, 'kolben-ein']], 'erster C-Tick ohne Strom: Tick 2, dann 2 + 2 Ticks');
  assert.equal(l.ereignisse.find((e) => e.was === 'kolben-ein').gezogen, STEIN);
  assert.deepEqual([1, 2, 3].map((x) => id(l, x, 1, 0)), [STEIN, 'minecraft:air', STEIN], 'genau ein Block gezogen');
  // normaler Kolben lässt den Block liegen
  const n = RZ.erzeuge(aufbau(false)); n.laufe(14);
  assert.deepEqual([1, 2, 3].map((x) => id(n, x, 1, 0)), ['minecraft:air', STEIN, STEIN]);
  // Unbewegliches oder Zerstörbares wird nicht gezogen
  for (const vorn of ['minecraft:obsidian', 'minecraft:torch']) {
    const s = RZ.erzeuge(aufbau(true, vorn)); s.laufe(14);
    assert.equal(id(s, 1, 1, 0), 'minecraft:air', vorn);
    assert.equal(id(s, 2, 1, 0), vorn, vorn);
  }
  // klebrig: der Armblock heißt anders; Ausfahren setzt den klebrigen Kopf
  const k = reihe(1, true); block(k, 0, 2, 0);
  const lk = RZ.erzeuge(k); lk.laufe(14);
  assert.equal(id(lk, 1, 1, 0), KLEBRIG_ARM);
  // nichts vor dem Kopf: nur der Arm verschwindet
  const leer = boden(); ausgefahren(leer, 0, 1, 0, 'east', KLEBRIG);
  const ll = RZ.erzeuge(leer); ll.laufe(14);
  assert.equal(ll.ereignisse.find((e) => e.was === 'kolben-ein').gezogen, null);
});

test('Kolben: Welt in einer Kopie, deterministisch, Drehen', () => {
  const aufbau = () => {
    const w = boden(); kolben(w, 0, 1, 0); w.setzeBlock(1, 1, 0, STEIN); w.setzeBlock(2, 1, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
    w.setzeBlock(0, 2, 0, 'minecraft:emerald_block');
    return w;
  };
  const w = aufbau();
  const vorher = e0.speichereWelt(w);
  const lauf = (welt) => {
    const l = RZ.erzeuge(welt); const start = ruhe(l); const ab = l.ereignisse.length;
    const m = l.welt.alleBloecke().find((x) => x.id === 'minecraft:emerald_block');
    l.welt.setzeBlock(m.x, m.y, m.z, 'minecraft:redstone_block');
    l.laufe(20);
    return { l, ereignisse: seit(l, ab, start) };
  };
  const a = lauf(w), b = lauf(w);
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  assert.deepEqual(a.ereignisse, b.ereignisse);
  assert.equal(e0.speichereWelt(a.l.welt), e0.speichereWelt(b.l.welt));
  assert.deepEqual(a.ereignisse, [[6, 'kolben-aus']]);
  // Drehen um 90° vor der Simulation: gleiche Ereignisse
  const teil = w.ausschnitt({ x: -3, y: 0, z: -3 }, { x: 5, y: 3, z: 3 });
  const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(teil, 1));
  assert.deepEqual(lauf(g).ereignisse, a.ereignisse);
});

test('Prüfer: Kolben', () => {
  const m = (w) => e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.kolben');
  // Obsidian davor
  const a = boden(); kolben(a, 2, 1, 3); a.setzeBlock(3, 1, 3, 'minecraft:obsidian');
  assert.deepEqual(m(a).map((x) => [x.schwere, x.ort.x, x.ort.y, x.ort.z]), [['hinweis', 2, 1, 3]]);
  assert.match(m(a)[0].meldung, /obsidian ist unbeweglich/);
  // 13 Steine
  assert.match(m(reihe(13))[0].meldung, /mehr als 12/);
  // Fackel davor: zerstört
  const f = reihe(0); f.setzeBlock(1, 1, 0, 'minecraft:torch', { torch_facing_direction: 'top' });
  assert.match(m(f)[0].meldung, /zerstört beim Ausfahren minecraft:torch/);
  // Sauber: Luft oder 12 Steine; ausgefahrene Kolben werden nicht geprüft
  assert.deepEqual(m(reihe(0)), []);
  assert.deepEqual(m(reihe(12)), []);
  const ex = boden(); ausgefahren(ex, 0, 1, 0);
  assert.deepEqual(m(ex), []);
  // Welt ohne Kolben
  assert.deepEqual(m(boden()), []);
  // Original unverändert
  assert.equal(a.leseBlock(3, 1, 3).id, 'minecraft:obsidian');
  void KO;
});
