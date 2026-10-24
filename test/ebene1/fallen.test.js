import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const FA = e1.fallen;
const SAND = 'minecraft:sand', STEIN = 'minecraft:stone';

/** Stein-Boden (y = 0), Radius 6. */
const boden = (r = 6) => {
  const w = e0.neueWelt();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) w.setzeBlock(x, 0, z, STEIN);
  return w;
};
const id = (w, x, y, z) => w.leseBlock(x, y, z).id;

/** Aufbau, Taktgeber und Mechanik; läuft bis nichts mehr geplant ist. */
function lauf(welt, { maxTicks = 3000 } = {}) {
  const sk = e1.neuerSandkasten(welt);
  const t = e1.neuerTaktgeber(sk);
  const m = FA.mechanik();
  t.registriere(m);
  m.anstossen(t);
  while (t.geplant.anzahl() > 0 && t.tick < maxTicks) t.schritt();
  return { sk, t, m, welt: sk.welt };
}

test('Fallen: Tempo und Start', () => {
  assert.equal(e1.regelwerk.parameter('fallen.start', 'startVerzoegerung'), 2);
  assert.equal(e1.regelwerk.parameter('fallen.tempo', 'fallTicks'), 9);
  const w = boden(); w.setzeBlock(0, 6, 0, SAND);
  const sk = e1.neuerSandkasten(w); const t = e1.neuerTaktgeber(sk); const m = FA.mechanik(); t.registriere(m); m.anstossen(t);
  const hoehe = () => { for (let y = 1; y <= 6; y++) if (id(sk.welt, 0, y, 0) === SAND) return y; return null; };
  const verlauf = [];
  for (let tick = 1; tick <= 60; tick++) { t.schritt(); verlauf.push(hoehe()); }
  // Start nach 2 Ticks (Tick 2: erster Schritt auf y = 5), dann alle 9 Ticks eine Zelle: Ticks 11, 20, 29, 38; Landung auf y = 1 mit Landeprüfung im Tick 47
  const ersteAb = (hoehe) => verlauf.findIndex((h) => h === hoehe) + 1;
  assert.deepEqual([6, 5, 4, 3, 2, 1].map((h) => verlauf.findIndex((x) => x === h) + 1), [1, 2, 11, 20, 29, 38]);
  assert.equal(ersteAb(5), 2);
  assert.deepEqual(m.ereignisse.map((e) => [e.tick, e.was]), [[2, 'faellt'], [11, 'faellt'], [20, 'faellt'], [29, 'faellt'], [38, 'faellt'], [47, 'gelandet']]);
});

test('Fallen: landet auf festem Block, Stapel fallen zusammen', () => {
  for (const hoehe of [1, 2, 5, 12, 20]) {
    const w = boden(); w.setzeBlock(0, 1 + hoehe, 0, SAND);
    const r = lauf(w);
    assert.equal(id(r.welt, 0, 1, 0), SAND, `Fallhöhe ${hoehe}`);
    assert.equal(id(r.welt, 0, 1 + hoehe, 0), 'minecraft:air');
    // Fallzeit: Start 2 + hoehe Schritte à 9 Ticks (der letzte Tick ist die Landeprüfung)
    assert.ok(r.t.tick >= 2 + 9 * (hoehe - 1), `Dauer ${hoehe}`);
  }
  // Stapel aus drei Blöcken, Kies und Sand gemischt, fällt zusammen und landet übereinander
  const w = boden();
  w.setzeBlock(0, 9, 0, SAND); w.setzeBlock(0, 10, 0, 'minecraft:gravel'); w.setzeBlock(0, 11, 0, 'minecraft:red_sand');
  const r = lauf(w);
  assert.deepEqual([id(r.welt, 0, 1, 0), id(r.welt, 0, 2, 0), id(r.welt, 0, 3, 0)], [SAND, 'minecraft:gravel', 'minecraft:red_sand']);
  assert.equal(r.welt.alleBloecke().filter((b) => b.y > 3).length, 0);
  // Ein Block auf festem Boden bleibt unberührt und erzeugt kein Ereignis
  const still = boden(); still.setzeBlock(0, 1, 0, SAND);
  assert.deepEqual(lauf(still).m.ereignisse, []);
  // Wird die Stütze entfernt (Änderung von außen), fällt der Block
  const w2 = boden(); w2.setzeBlock(0, 1, 0, STEIN); w2.setzeBlock(0, 2, 0, SAND);
  const sk = e1.neuerSandkasten(w2); const t = e1.neuerTaktgeber(sk); const m = FA.mechanik(); t.registriere(m);
  sk.welt.loescheBlock(0, 1, 0); m.aenderung(t, { x: 0, y: 1, z: 0 });
  while (t.geplant.anzahl() > 0) t.schritt();
  assert.equal(id(sk.welt, 0, 1, 0), SAND);
});

test('Fallen: Fackel, Schiene, Staub, Halbstufe und Seelensand machen einen Gegenstand', () => {
  const fall = [
    ['minecraft:rail', { rail_direction: 0 }, 1],
    ['minecraft:redstone_wire', {}, 1],
    ['minecraft:torch', { torch_facing_direction: 'top' }, 1],
    ['minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' }, 1],
    ['minecraft:oak_slab', { 'minecraft:vertical_half': 'top' }, 1],
    ['minecraft:soul_sand', {}, 0],
  ];
  for (const [blockId, zustand, y] of fall) {
    const w = boden(); w.setzeBlock(0, y, 0, blockId, zustand); w.setzeBlock(0, y + 5, 0, SAND);
    const r = lauf(w);
    assert.equal(id(r.welt, 0, y, 0), blockId, `${blockId} bleibt`);
    assert.equal(r.welt.alleBloecke().filter((b) => b.id === SAND).length, 0, `${blockId}: Sand ist weg`);
    const ev = r.m.ereignisse.filter((e) => e.was === 'zu-gegenstand');
    assert.equal(ev.length, 1, blockId);
    assert.equal(ev[0].grund, blockId);
  }
  // Seelensand liegt auf dem Boden (y = 1): Sand fällt darauf
  const s = boden(); s.setzeBlock(0, 1, 0, 'minecraft:soul_sand'); s.setzeBlock(0, 6, 0, SAND);
  assert.equal(lauf(s).m.ereignisse.at(-1).was, 'zu-gegenstand');
  // Doppelte Halbstufe ist ein Vollblock: Sand bleibt liegen
  const d = boden(); d.setzeBlock(0, 1, 0, 'minecraft:oak_double_slab', { 'minecraft:vertical_half': 'bottom' }); d.setzeBlock(0, 5, 0, SAND);
  assert.equal(id(lauf(d).welt, 0, 2, 0), SAND);
});

test('Fallen: durch Fackeln hindurch, wenn darunter Luft ist', () => {
  // Fackel an der Seite eines Blocks hängend, darunter Luft: Sand fällt durch, Fackel bleibt
  const w = boden(); w.setzeBlock(1, 3, 0, STEIN); w.setzeBlock(0, 3, 0, 'minecraft:torch', { torch_facing_direction: 'east' }); w.setzeBlock(0, 7, 0, SAND);
  const r = lauf(w);
  assert.equal(id(r.welt, 0, 1, 0), SAND, 'landet auf dem Boden');
  assert.equal(id(r.welt, 0, 3, 0), 'minecraft:torch', 'Fackel bleibt');
  assert.equal(r.m.ereignisse.filter((e) => e.was === 'zu-gegenstand').length, 0);
  // Sprung über die Fackel dauert zwei Zellen
  const sprung = r.m.ereignisse.find((e) => e.was === 'faellt' && e.pos.y === 4);
  assert.deepEqual(sprung.nach, { x: 0, y: 2, z: 0 });
});

test('Fallen: durch Wasser und Lava', () => {
  for (const flut of ['minecraft:water', 'minecraft:lava', 'minecraft:flowing_water', 'minecraft:fire']) {
    const w = boden();
    for (let y = 1; y <= 3; y++) w.setzeBlock(0, y, 0, flut, flut === 'minecraft:fire' ? { age: 0 } : { liquid_depth: 0 });
    w.setzeBlock(0, 8, 0, SAND);
    const r = lauf(w);
    assert.equal(id(r.welt, 0, 1, 0), SAND, flut);
    assert.equal(r.welt.alleBloecke().filter((b) => b.id === SAND).length, 1);
  }
});

test('Fallen: Betonpulver wird im Wasser zu Beton', () => {
  // fallend durch eine Wasserschicht: wird bei Wasserberührung Beton
  const w = boden(); w.setzeBlock(0, 1, 0, 'minecraft:water', { liquid_depth: 0 }); w.setzeBlock(0, 5, 0, 'minecraft:white_concrete_powder');
  const r = lauf(w);
  assert.equal(r.welt.alleBloecke().filter((b) => b.id === 'minecraft:white_concrete').length, 1);
  assert.equal(r.welt.alleBloecke().filter((b) => /powder/.test(b.id)).length, 0);
  assert.ok(r.m.ereignisse.some((e) => e.was === 'zu-beton' && e.nach === 'minecraft:white_concrete'));
  // liegendes Pulver neben Wasser wird Beton (alle Farben, Seite)
  const l = boden(); l.setzeBlock(1, 1, 0, 'minecraft:water', { liquid_depth: 0 }); l.setzeBlock(0, 1, 0, 'minecraft:red_concrete_powder');
  assert.equal(id(lauf(l).welt, 0, 1, 0), 'minecraft:red_concrete');
  // ohne Wasser bleibt es Pulver
  const t = boden(); t.setzeBlock(0, 4, 0, 'minecraft:blue_concrete_powder');
  assert.equal(id(lauf(t).welt, 0, 1, 0), 'minecraft:blue_concrete_powder');
  // alle 16 Farben haben ein Beton-Gegenstück im Register
  for (const farbe of ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']) {
    const ww = boden(); ww.setzeBlock(1, 1, 0, 'minecraft:water', { liquid_depth: 0 }); ww.setzeBlock(0, 1, 0, `minecraft:${farbe}_concrete_powder`);
    assert.equal(id(lauf(ww).welt, 0, 1, 0), `minecraft:${farbe}_concrete`, farbe);
  }
});

test('Fallen: Amboss und andere fallende Blöcke', () => {
  for (const blockId of ['minecraft:anvil', 'minecraft:chipped_anvil', 'minecraft:damaged_anvil', 'minecraft:dragon_egg', 'minecraft:gravel', 'minecraft:red_sand', 'minecraft:suspicious_sand', 'minecraft:suspicious_gravel', 'minecraft:black_concrete_powder']) {
    assert.equal(FA.faelltBlock(blockId), true, blockId);
    const w = boden(); w.setzeBlock(0, 6, 0, blockId, blockId.endsWith('anvil') ? { 'minecraft:cardinal_direction': 'east' } : {});
    const r = lauf(w);
    assert.equal(id(r.welt, 0, 1, 0), blockId, blockId);
  }
  // Der Zustand (Blickrichtung des Ambosses) bleibt erhalten
  const w = boden(); w.setzeBlock(0, 5, 0, 'minecraft:anvil', { 'minecraft:cardinal_direction': 'west' });
  assert.equal(lauf(w).welt.leseBlock(0, 1, 0).zustand['minecraft:cardinal_direction'], 'west');
  // Gerüst hat eine eigene Regel und fällt hier nicht; Stein, Wasser nie
  assert.equal(FA.faelltBlock('minecraft:scaffolding'), false);
  assert.equal(FA.faelltBlock(STEIN), false);
  const g = boden(); g.setzeBlock(0, 6, 0, 'minecraft:scaffolding');
  assert.equal(id(lauf(g).welt, 0, 6, 0), 'minecraft:scaffolding');
});

test('Fallen: unbekannte Blöcke geben unklar', () => {
  for (const blockId of ['minecraft:oak_fence', 'minecraft:glass_pane', 'minecraft:hopper']) {
    const w = boden(); w.setzeBlock(0, 1, 0, blockId); w.setzeBlock(0, 5, 0, SAND);
    const r = lauf(w);
    assert.equal(id(r.welt, 0, 2, 0), SAND, `${blockId}: Sand bleibt oben liegen`);
    const u = r.m.ereignisse.find((e) => e.was === 'unklar');
    assert.equal(u.grund, blockId);
  }
});

test('Fallen: Welt in einer Kopie, deterministisch, Drehen vertauscht sich', () => {
  const w = boden(); w.setzeBlock(0, 6, 0, SAND); w.setzeBlock(3, 5, 1, 'minecraft:gravel');
  const vorher = e0.speichereWelt(w);
  const a = FA.simuliere(w), b = FA.simuliere(w);
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  assert.deepEqual(a.ereignisse, b.ereignisse);
  assert.equal(e0.speichereWelt(a.welt), e0.speichereWelt(b.welt));
  assert.equal(a.stabil, true);
  // Drehen um 90° vor der Simulation = Drehen danach
  const teil = w.ausschnitt({ x: -6, y: 0, z: -6 }, { x: 6, y: 8, z: 6 });
  const gedreht = e0.neueWelt(); gedreht.fuegeBauteilEin(e0.vermesser.drehe(teil, 1));
  const gedrehtErst = FA.simuliere(gedreht).welt;
  const gedrehtDanach = e0.neueWelt(); gedrehtDanach.fuegeBauteilEin(e0.vermesser.drehe(a.welt.ausschnitt({ x: -6, y: 0, z: -6 }, { x: 6, y: 8, z: 6 }), 1));
  assert.equal(e0.speichereWelt(gedrehtErst), e0.speichereWelt(gedrehtDanach));
});

test('Prüfer: Block fällt', () => {
  const m = (w) => e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.faellt');
  // Sand 4 Blöcke über dem Boden: Verstoß an der Ausgangszelle, Meldung nennt das Ziel
  const w = boden(); w.setzeBlock(2, 5, 3, SAND);
  const r = m(w);
  assert.deepEqual(r.map((x) => [x.schwere, x.ort.x, x.ort.y, x.ort.z]), [['verstoss', 2, 5, 3]]);
  assert.match(r[0].meldung, /landet bei \(2, 1, 3\)/);
  // Stapel: jeder Block wird gemeldet
  const s = boden(); s.setzeBlock(0, 5, 0, SAND); s.setzeBlock(0, 6, 0, 'minecraft:gravel');
  assert.deepEqual(m(s).map((x) => [x.ort.y, /landet bei \(0, (\d), 0\)/.exec(x.meldung)[1]]).sort(), [[5, '1'], [6, '2']]);
  // Gegenstand: Verstoß; unbekannt: Hinweis; Pulver zu Beton: Hinweis
  const g = boden(); g.setzeBlock(0, 1, 0, 'minecraft:rail', { rail_direction: 0 }); g.setzeBlock(0, 4, 0, SAND);
  assert.equal(m(g)[0].schwere, 'verstoss'); assert.match(m(g)[0].meldung, /Gegenstand/);
  const u = boden(); u.setzeBlock(0, 1, 0, 'minecraft:oak_fence'); u.setzeBlock(0, 2, 0, SAND);
  assert.equal(m(u)[0].schwere, 'hinweis');
  const b = boden(); b.setzeBlock(1, 1, 0, 'minecraft:water', { liquid_depth: 0 }); b.setzeBlock(0, 1, 0, 'minecraft:lime_concrete_powder');
  assert.equal(m(b)[0].schwere, 'hinweis');
  // Sauberer Aufbau: nichts zu melden; ohne fallende Blöcke läuft keine Simulation
  const ok = boden(); ok.setzeBlock(0, 1, 0, SAND); ok.setzeBlock(0, 2, 0, 'minecraft:gravel');
  assert.deepEqual(m(ok), []);
  assert.deepEqual(m(boden()), []);
  // Original unverändert
  assert.equal(id(w, 2, 5, 3), SAND);
});
