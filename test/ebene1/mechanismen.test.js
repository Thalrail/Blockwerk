import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const RZ = e1.redstoneZeit;
const STEIN = 'minecraft:stone', STAUB = 'minecraft:redstone_wire', LAMPE = 'minecraft:redstone_lamp', LAMPE_AN = 'minecraft:lit_redstone_lamp';

const boden = () => {
  const w = e0.neueWelt();
  for (let x = -8; x <= 12; x++) for (let z = -8; z <= 12; z++) w.setzeBlock(x, 0, z, STEIN);
  return w;
};
const staub = (w, x, y, z) => w.setzeBlock(x, y, z, STAUB, { redstone_signal: 0 });
const block = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:redstone_block');
const luft = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:air');
function ruhe(l) { l.bisRuhe(300); if (l.taktgeber.tick % 2 === 1) l.laufe(1); return l.taktgeber.tick; }
const seit = (l, ab, start) => l.ereignisse.slice(ab).map((e) => [e.tick - start, e.was]);
const id = (l, x, y, z) => l.welt.leseBlock(x, y, z).id;

/** Lampe bei (1,1,0), Staub bei (0,1,0) davor; Quelle wird bei (−1,1,0) gesetzt. */
function lampeAufbau() { const w = boden(); staub(w, 0, 1, 0); w.setzeBlock(1, 1, 0, LAMPE); return w; }

test('Mechanismen: Bestromung und Lampen', () => {
  assert.deepEqual([e1.regelwerk.parameter('mech.lampe', 'ausTicks')], [6]);
  // Lampe: an im ersten C-Tick nach dem Strom, aus 6 Ticks nach dem ersten C-Tick ohne Strom
  const l = RZ.erzeuge(lampeAufbau()); const start = ruhe(l); const ab = l.ereignisse.length;
  block(l.welt, -1, 1, 0); l.laufe(20);
  luft(l.welt, -1, 1, 0); l.laufe(20);
  assert.deepEqual(seit(l, ab, start), [[2, 'lampe-an'], [28, 'lampe-aus']]);
  // ein kurzer Strompuls verlängert nichts und lässt die Lampe nicht flackern: Strom wieder an, bevor die 6 Ticks um sind
  const k = RZ.erzeuge(lampeAufbau()); ruhe(k); block(k.welt, -1, 1, 0); k.laufe(10);
  luft(k.welt, -1, 1, 0); k.laufe(4); block(k.welt, -1, 1, 0); k.laufe(30);
  assert.equal(id(k, 1, 1, 0), LAMPE_AN, 'bleibt an');
  assert.equal(k.ereignisse.filter((e) => e.was === 'lampe-aus').length, 0);
  // Mechanismen schalten nur im C-Tick: Strom im P-Tick wird erst im nächsten C-Tick gesehen
  const p = RZ.erzeuge(lampeAufbau()); ruhe(p); p.laufe(1); const s2 = p.taktgeber.tick; const ab2 = p.ereignisse.length;
  block(p.welt, -1, 1, 0); p.laufe(6);
  assert.deepEqual(seit(p, ab2, s2), [[1, 'lampe-an']], 'P-Tick: nächster Tick ist ein C-Tick');
  // Lagen: alles, was die Lampe bestromt
  const lage = (aufbau) => { const w = boden(); w.setzeBlock(0, 1, 0, LAMPE); aufbau(w); const r = RZ.erzeuge(w); r.laufe(10); return id(r, 0, 1, 0) === LAMPE_AN; };
  assert.equal(lage((w) => block(w, 1, 1, 0)), true, 'Redstone-Block daneben');
  assert.equal(lage((w) => block(w, 0, 2, 0)), true, 'Redstone-Block oben');
  assert.equal(lage((w) => block(w, 0, 0, 0)), true, 'Redstone-Block unten');
  assert.equal(lage((w) => { block(w, 5, 1, 0); for (let x = 1; x <= 4; x++) staub(w, x, 1, 0); }), true, 'Staub zeigt auf die Lampe');
  assert.equal(lage((w) => { block(w, 3, 2, 0); staub(w, 0, 2, 0); staub(w, 1, 2, 0); staub(w, 2, 2, 0); }), true, 'Staub liegt auf der Lampe');
  assert.equal(lage((w) => { staub(w, 1, 1, 0); staub(w, 1, 1, 1); block(w, 1, 1, 2); }), false, 'Staub zeigt weg (Linie entlang z)');
  assert.equal(lage((w) => { staub(w, 1, 1, 0); w.setzeBlock(1, 1, 1, STEIN); w.setzeBlock(1, 1, 2, 'minecraft:lever', { lever_direction: 'south', open_bit: true }); }), true, 'Staub ohne Verbindung (Punkt) zeigt in alle Richtungen');
  assert.equal(lage((w) => { w.setzeBlock(1, 1, 0, STEIN); block(w, 2, 1, 0); }), true, 'bestromter Block daneben, in dem die Lampe selbst nichts speist');
  // schwach bestromter Block neben der Lampe (Staub liegt auf dem Block)
  assert.equal(lage((w) => { w.setzeBlock(1, 1, 0, STEIN); staub(w, 1, 2, 0); block(w, 2, 2, 0); }), true, 'durch Staub schwach bestromter Block');
  // Fackel daneben (an einem anderen Block) bestromt die Lampe; hängt die Fackel an der Lampe selbst, bestromt sie sie nicht
  assert.equal(lage((w) => { w.setzeBlock(1, 1, 1, STEIN); w.setzeBlock(1, 1, 0, 'minecraft:redstone_torch', { torch_facing_direction: 'south' }); }), true, 'Fackel an anderem Block');
  assert.equal(lage((w) => { w.setzeBlock(1, 1, 0, 'minecraft:redstone_torch', { torch_facing_direction: 'west' }); }), false, 'Fackel an der Lampe selbst');
  // Repeater davor
  assert.equal(lage((w) => { w.setzeBlock(1, 1, 0, 'minecraft:unpowered_repeater', { 'minecraft:cardinal_direction': 'east', repeater_delay: 0 }); block(w, 2, 1, 0); }), true, 'Repeater, dessen Ausgang in die Lampe zeigt');
});

test('Mechanismen: Türen', () => {
  const tuer = (id0, zustand) => (w, x, y, z) => w.setzeBlock(x, y, z, id0, zustand);
  // Tür (zwei Hälften): Strom an der unteren Hälfte öffnet beide
  const w = boden();
  w.setzeBlock(0, 1, 0, 'minecraft:spruce_door', { 'minecraft:cardinal_direction': 'north', door_hinge_bit: false, open_bit: false, upper_block_bit: false });
  w.setzeBlock(0, 2, 0, 'minecraft:spruce_door', { 'minecraft:cardinal_direction': 'north', door_hinge_bit: false, open_bit: false, upper_block_bit: true });
  const l = RZ.erzeuge(w); const start = ruhe(l); const ab = l.ereignisse.length;
  block(l.welt, 1, 1, 0); l.laufe(6);
  assert.deepEqual(seit(l, ab, start), [[2, 'tuer-auf']]);
  assert.equal(l.welt.leseBlock(0, 1, 0).zustand.open_bit, true); assert.equal(l.welt.leseBlock(0, 2, 0).zustand.open_bit, true);
  luft(l.welt, 1, 1, 0); l.laufe(6);
  assert.equal(l.welt.leseBlock(0, 1, 0).zustand.open_bit, false); assert.equal(l.welt.leseBlock(0, 2, 0).zustand.open_bit, false);
  // nur die obere Hälfte bestromt reicht
  const o = boden();
  o.setzeBlock(0, 1, 0, 'minecraft:iron_door', { 'minecraft:cardinal_direction': 'north', door_hinge_bit: false, open_bit: false, upper_block_bit: false });
  o.setzeBlock(0, 2, 0, 'minecraft:iron_door', { 'minecraft:cardinal_direction': 'north', door_hinge_bit: false, open_bit: false, upper_block_bit: true });
  block(o, 1, 2, 0);
  const lo = RZ.erzeuge(o); lo.laufe(6);
  assert.equal(lo.welt.leseBlock(0, 1, 0).zustand.open_bit, true);
  // Falltür und Zauntor
  const f = boden();
  tuer('minecraft:trapdoor', { direction: 0, open_bit: false, upside_down_bit: false })(f, 0, 1, 0);
  tuer('minecraft:fence_gate', { 'minecraft:cardinal_direction': 'north', in_wall_bit: false, open_bit: false })(f, 3, 1, 0);
  block(f, 1, 1, 0); block(f, 4, 1, 0);
  const lf = RZ.erzeuge(f); lf.laufe(6);
  assert.equal(lf.welt.leseBlock(0, 1, 0).zustand.open_bit, true, 'Falltür');
  assert.equal(lf.welt.leseBlock(3, 1, 0).zustand.open_bit, true, 'Zauntor');
  // ohne Strom bleibt alles zu
  const z = boden(); tuer('minecraft:trapdoor', { direction: 0, open_bit: false, upside_down_bit: false })(z, 0, 1, 0);
  const lz = RZ.erzeuge(z); lz.laufe(10);
  assert.equal(lz.welt.leseBlock(0, 1, 0).zustand.open_bit, false);
});

test('Mechanismen: Beobachter', () => {
  // Beobachter schaut nach Osten, Ausgang hinten (Westen): Staub dort
  const aufbau = () => { const w = boden(); w.setzeBlock(0, 1, 0, 'minecraft:observer', { 'minecraft:facing_direction': 'east', powered_bit: false }); staub(w, -1, 1, 0); staub(w, -2, 1, 0); return w; };
  const l = RZ.erzeuge(aufbau()); const start = ruhe(l); const ab = l.ereignisse.length;
  l.welt.setzeBlock(1, 1, 0, STEIN);
  const verlauf = [];
  for (let i = 0; i < 8; i++) { l.laufe(1); verlauf.push([l.welt.leseBlock(0, 1, 0).zustand.powered_bit, l.welt.leseBlock(-1, 1, 0).zustand.redstone_signal, l.welt.leseBlock(-2, 1, 0).zustand.redstone_signal]); }
  assert.deepEqual(seit(l, ab, start), [[2, 'beobachter-impuls']]);
  // Beobachter an von Tick 2 bis 3 (zwei Ticks), Staub dahinter 15 und 14 in den Ticks 3 und 4
  assert.deepEqual(verlauf.map((v) => v[0]), [false, true, true, false, false, false, false, false]);
  assert.deepEqual(verlauf.map((v) => v[1]), [0, 0, 15, 15, 0, 0, 0, 0]);
  assert.equal(verlauf[2][2], 14);
  // keine Änderung davor → kein Impuls
  const still = RZ.erzeuge(aufbau()); ruhe(still); const abS = still.ereignisse.length; still.laufe(40);
  assert.equal(still.ereignisse.length, abS);
  // Entfernen und Zustandsänderung zählen auch
  for (const aendern of [(w) => luft(w, 1, 1, 0), (w) => w.setzeBlock(1, 1, 0, 'minecraft:oak_slab', { 'minecraft:vertical_half': 'top' })]) {
    const x = RZ.erzeuge((() => { const w = aufbau(); w.setzeBlock(1, 1, 0, STEIN); return w; })()); ruhe(x); const a = x.ereignisse.length;
    aendern(x.welt); x.laufe(10);
    assert.equal(x.ereignisse.slice(a).filter((e) => e.was === 'beobachter-impuls').length, 1);
  }
  // Der Impuls bestromt den Block dahinter stark: Staub daneben bekommt 15
  const stark = boden(); stark.setzeBlock(0, 1, 0, 'minecraft:observer', { 'minecraft:facing_direction': 'east', powered_bit: false }); stark.setzeBlock(-1, 1, 0, STEIN); staub(stark, -1, 2, 0);
  const ls = RZ.erzeuge(stark); ruhe(ls);
  ls.welt.setzeBlock(1, 1, 0, STEIN); ls.laufe(5);
  assert.equal(ls.ereignisse.filter((e) => e.was === 'beobachter-impuls').length, 1);
  // Richtung: facing nach Süden schaut auf (0,1,1), Ausgang nach Norden
  const sued = boden(); sued.setzeBlock(0, 1, 0, 'minecraft:observer', { 'minecraft:facing_direction': 'south', powered_bit: false }); staub(sued, 0, 1, -1);
  const lsu = RZ.erzeuge(sued); ruhe(lsu); lsu.welt.setzeBlock(0, 1, 1, STEIN); lsu.laufe(4);
  assert.equal(lsu.welt.leseBlock(0, 1, -1).zustand.redstone_signal, 15);
  // Beobachterkette: der Impuls des ersten Beobachters ändert den Staub vor dem zweiten (Zustand des Staubs) und löst ihn aus
  const kette = boden();
  kette.setzeBlock(0, 1, 0, 'minecraft:observer', { 'minecraft:facing_direction': 'east', powered_bit: false });
  staub(kette, -1, 1, 0);
  kette.setzeBlock(-4, 1, 0, 'minecraft:observer', { 'minecraft:facing_direction': 'east', powered_bit: false });
  staub(kette, -3, 1, 0); // zweiter Beobachter schaut auf (-3,1,0)
  staub(kette, -2, 1, 0);
  const lk = RZ.erzeuge(kette); ruhe(lk); const abK = lk.ereignisse.length;
  lk.welt.setzeBlock(1, 1, 0, STEIN); lk.laufe(20);
  const beob = lk.ereignisse.slice(abK).filter((e) => e.was === 'beobachter-impuls');
  assert.equal(beob.length, 2, 'beide Beobachter lösen aus');
  assert.ok(beob[1].tick > beob[0].tick);
});

test('Mechanismen: Tagessensor', () => {
  const staerke = (zeit, wetter = 'klar', invertiert = false, dach = false) => {
    const w = boden();
    w.setzeBlock(0, 1, 0, invertiert ? 'minecraft:daylight_detector_inverted' : 'minecraft:daylight_detector', { redstone_signal: 0 });
    if (dach) for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) w.setzeBlock(x, 3, z, STEIN);
    const l = RZ.erzeuge(w, { startzeit: zeit, wetter }); l.laufe(2);
    return l.welt.leseBlock(0, 1, 0).zustand.redstone_signal;
  };
  // Tageszeit 0 = Sonnenaufgang, 6000 = Mittag, 12000 = Sonnenuntergang, 18000 = Mitternacht
  assert.deepEqual([0, 3000, 6000, 9000, 11000, 12000, 13000, 18000, 23000].map((z) => staerke(z)), [5, 13, 15, 13, 10, 5, 1, 0, 1]);
  assert.deepEqual([0, 3000, 6000, 9000, 12000, 18000].map((z) => staerke(z, 'regen')), [4, 11, 12, 11, 4, 0]);
  assert.deepEqual([6000, 12000].map((z) => staerke(z, 'gewitter')), [10, 4]);
  // invertiert: Mittag 0, Mitternacht 11 (Wiki), unter einem Dach 15 zu jeder Zeit
  assert.deepEqual([6000, 12000, 18000].map((z) => staerke(z, 'klar', true)), [0, 4, 11]);
  assert.deepEqual([6000, 18000].map((z) => staerke(z, 'klar', true, true)), [15, 15]);
  assert.deepEqual([6000, 12000].map((z) => staerke(z, 'klar', false, true)), [0, 0], 'unter einem Dach 0');
  // rechnet nur alle 20 Ticks neu (und einmal beim Start): Änderungen erscheinen nur in Ticks, die durch 20 teilbar sind
  const w = boden(); w.setzeBlock(0, 1, 0, 'minecraft:daylight_detector', { redstone_signal: 0 });
  for (const [start, erwartet] of [[11500, [[1, 8], [140, 7]]], [11900, [[1, 6], [100, 5]]], [12300, [[1, 4], [120, 3]]]]) {
    const l = RZ.erzeuge(w, { startzeit: start }); l.laufe(250);
    assert.deepEqual(l.ereignisse.filter((e) => e.was === 'tagessensor').map((e) => [e.tick, e.stufe]), erwartet, `Start bei ${start}`);
  }
  // der Sensor speist Staub daneben schwach mit seiner Stärke
  const s = boden(); s.setzeBlock(0, 1, 0, 'minecraft:daylight_detector', { redstone_signal: 0 }); staub(s, 1, 1, 0); staub(s, 2, 1, 0);
  const ls = RZ.erzeuge(s, { startzeit: 6000 }); ls.laufe(3);
  assert.deepEqual([ls.welt.leseBlock(1, 1, 0).zustand.redstone_signal, ls.welt.leseBlock(2, 1, 0).zustand.redstone_signal], [15, 14]);
  // Verdunkelung nach der Java-Formel: Mittag 0, Mitternacht 11
  assert.deepEqual([RZ.verdunkelung(6000, 'klar'), RZ.verdunkelung(18000, 'klar')], [0, 11]);
});

test('Mechanismen: Welt in einer Kopie, deterministisch, Drehen', () => {
  // Marker (Smaragdblöcke) bezeichnen die Stellen, an denen später eingegriffen wird; sie wandern beim Drehen mit
  const aufbau = () => {
    const w = lampeAufbau(); w.setzeBlock(3, 1, 0, 'minecraft:observer', { 'minecraft:facing_direction': 'east', powered_bit: false }); staub(w, 2, 1, 0);
    w.setzeBlock(-1, 1, 0, 'minecraft:emerald_block'); w.setzeBlock(4, 1, 0, 'minecraft:emerald_block');
    return w;
  };
  const w = aufbau();
  const vorher = e0.speichereWelt(w);
  const lauf = (welt) => {
    const l = RZ.erzeuge(welt); const start = ruhe(l); const ab = l.ereignisse.length;
    const marker = l.welt.alleBloecke().filter((x) => x.id === 'minecraft:emerald_block');
    assert.equal(marker.length, 2);
    // Marker neben dem Staub (Strom) → Redstone-Block; Marker vor dem Beobachter → Stein
    for (const m of marker) {
      const nahBeiLampe = l.welt.alleBloecke().some((x) => x.id === LAMPE && Math.abs(x.x - m.x) + Math.abs(x.z - m.z) === 2);
      l.welt.setzeBlock(m.x, m.y, m.z, nahBeiLampe ? 'minecraft:redstone_block' : STEIN);
    }
    l.laufe(40);
    return { l, ereignisse: seit(l, ab, start) };
  };
  const a = lauf(w), b = lauf(w);
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  assert.deepEqual(a.ereignisse, b.ereignisse);
  assert.equal(e0.speichereWelt(a.l.welt), e0.speichereWelt(b.l.welt));
  assert.deepEqual(a.ereignisse.map((e) => e[1]).sort(), ['beobachter-impuls', 'lampe-an']);
  // Drehen um 90° vor der Simulation: gleiche Ereignisse zu gleichen Ticks
  const teil = w.ausschnitt({ x: -3, y: 0, z: -3 }, { x: 6, y: 3, z: 3 });
  const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(teil, 1));
  assert.deepEqual(lauf(g).ereignisse, a.ereignisse);
});

test('Prüfer: Mechanismen', () => {
  const m = (w) => e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.mechanismus');
  // Lampe ohne Strom
  const a = boden(); a.setzeBlock(2, 1, 3, LAMPE);
  assert.deepEqual(m(a).map((x) => [x.schwere, x.ort.x, x.ort.y, x.ort.z]), [['hinweis', 2, 1, 3]]);
  assert.match(m(a)[0].meldung, /nie bestromt/);
  // Lampe mit Redstone-Block daneben: nichts zu melden
  const b = boden(); b.setzeBlock(2, 1, 3, LAMPE); block(b, 3, 1, 3);
  assert.deepEqual(m(b), []);
  // Tür ohne Strom bleibt zu: Hinweis
  const t = boden(); t.setzeBlock(0, 1, 0, 'minecraft:trapdoor', { direction: 0, open_bit: false, upside_down_bit: false });
  assert.equal(m(t).length, 1);
  // Welt ohne Mechanismen: nichts
  assert.deepEqual(m(boden()), []);
  // Original unverändert
  assert.equal(a.leseBlock(2, 1, 3).id, LAMPE);
});
