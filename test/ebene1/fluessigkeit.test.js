import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const F = e1.fluessigkeit;
const WASSER = 'minecraft:water', FLUSS = 'minecraft:flowing_water', LAVA = 'minecraft:lava', LAVAFLUSS = 'minecraft:flowing_lava';

/** Ebener Boden aus Stein (y = 0, zwei Schichten dick: y = −1 und 0), Radius r. Flüssigkeit liegt auf y = 1. */
const boden = (r = 14) => {
  const w = e0.neueWelt();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) { w.setzeBlock(x, -1, z, 'minecraft:stone'); w.setzeBlock(x, 0, z, 'minecraft:stone'); }
  return w;
};
const quelle = (w, x, y, z, id = WASSER) => w.setzeBlock(x, y, z, id, { liquid_depth: 0 });
const stufe = (w, x, y, z) => { const b = w.leseBlock(x, y, z); return /water|lava/.test(b.id) ? b.zustand.liquid_depth : null; };
const luft = (w, x, y, z) => w.leseBlock(x, y, z).id === 'minecraft:air';

/** Aufbau, Taktgeber und Mechanik; läuft bis nichts mehr geplant ist. */
function lauf(welt, { dimension = 'oberwelt', seed = 1, aufzeichnen = false, maxTicks = 2000 } = {}) {
  const sk = e1.neuerSandkasten(welt);
  const t = e1.neuerTaktgeber(sk, { seed, aufzeichnen });
  const m = F.mechanik({ dimension });
  t.registriere(m);
  m.anstossen(t);
  while (t.geplant.anzahl() > 0 && t.tick < maxTicks) t.schritt();
  return { sk, t, m, welt: sk.welt };
}
/** Stufen entlang x = −n…n bei z = 0 als Text (· = leer). */
const zeile = (w, n, y = 1, z = 0) => Array.from({ length: 2 * n + 1 }, (_, i) => { const s = stufe(w, i - n, y, z); return s === null ? '·' : s; }).join('');

test('Wasser: Weite 7 Blöcke und Tempo 5 Ticks', () => {
  const w = boden(); quelle(w, 0, 1, 0);
  const r = lauf(w);
  assert.equal(zeile(r.welt, 9), '··765432101234567··', 'genau 7 Blöcke, Stufen 1–7');
  // Quadrat (Jonah, 24.10.2026): alle Zellen mit größtem Abstand ≤ 7, Stufe = größter Abstand (Ringe), sonst nichts
  let anzahl = 0;
  for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) {
    const ring = Math.max(Math.abs(x), Math.abs(z));
    assert.equal(stufe(r.welt, x, 1, z) !== null, ring <= 7, `(${x},${z})`);
    if (ring <= 7) { assert.equal(stufe(r.welt, x, 1, z), ring, `Stufe bei (${x},${z})`); anzahl += 1; }
  }
  assert.equal(anzahl, 225);
  // Tempo: Zelle k erscheint im Tick 5·k, nicht früher (Ecke (k,k) im selben Tick wie (k,0))
  const sk = e1.neuerSandkasten((() => { const b = boden(); quelle(b, 0, 1, 0); return b; })());
  const t = e1.neuerTaktgeber(sk); const m = F.mechanik(); t.registriere(m); m.anstossen(t);
  for (let tick = 1; tick <= 40; tick++) {
    t.schritt();
    for (let k = 1; k <= 7; k++) {
      assert.equal(stufe(sk.welt, k, 1, 0) !== null, tick >= 5 * k, `Zelle ${k} im Tick ${tick}`);
      assert.equal(stufe(sk.welt, k, 1, k) !== null, tick >= 5 * k, `Ecke ${k},${k} im Tick ${tick}`);
    }
  }
});

test('Lava: Weite 3 (Oberwelt) und 7 (Nether), Tempo 30 und 10 Ticks', () => {
  const w = boden(); quelle(w, 0, 1, 0, LAVA);
  const lw = lauf(w).welt;
  assert.equal(zeile(lw, 9), '······6420246······', 'Oberwelt: 3 Blöcke, Stufen 2, 4, 6');
  assert.equal(stufe(lw, 3, 1, 3), 6, 'Ecke des Quadrats');
  assert.equal(stufe(lw, 4, 1, 4), null);
  assert.equal(lw.alleBloecke().filter((b) => /lava/.test(b.id)).length, 49, '7 × 7');
  const n = boden(); quelle(n, 0, 1, 0, LAVA);
  assert.equal(zeile(lauf(n, { dimension: 'nether' }).welt, 9), '··765432101234567··', 'Nether: 7 Blöcke');
  for (const [dimension, takt, weite] of [['oberwelt', 30, 3], ['nether', 10, 7]]) {
    const b = boden(); quelle(b, 0, 1, 0, LAVA);
    const sk = e1.neuerSandkasten(b); const t = e1.neuerTaktgeber(sk); const m = F.mechanik({ dimension }); t.registriere(m); m.anstossen(t);
    for (let tick = 1; tick <= takt * weite + 2; tick++) {
      t.schritt();
      for (let k = 1; k <= weite; k++) assert.equal(stufe(sk.welt, k, 1, 0) !== null, tick >= takt * k, `${dimension}: Zelle ${k} im Tick ${tick}`);
    }
  }
  assert.throws(() => F.mechanik({ dimension: 'ende-2' }), /Dimension/);
});

test('Flüssigkeit: fällt unbegrenzt und breitet sich unten aus', () => {
  const w = boden(); quelle(w, 0, 20, 0);
  const r = lauf(w).welt;
  for (let y = 1; y <= 19; y++) assert.equal(stufe(r, 0, y, 0), 8, `Säule y=${y}`);
  assert.equal(r.leseBlock(0, 10, 0).id, FLUSS);
  // Die Quelle in der Luft fließt auch zur Seite (Stufe 1) und fällt dort weiter: Plus-Form (Annahme, siehe Regel)
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    assert.equal(stufe(r, x, 20, z), 1, `oben (${x},${z})`);
    assert.equal(stufe(r, x, 10, z), 8, `Säule (${x},${z})`);
  }
  assert.equal(stufe(r, 1, 10, 1), null, 'keine Diagonalen');
  // unten: Aufprallpunkte breiten sich je 7 Blöcke aus
  assert.equal(zeile(r, 9), '·76543218881234567·');
  assert.equal(stufe(r, 0, 1, 8), 7);
  // Lava fällt ebenfalls und breitet sich unten ihre 3 Blöcke aus
  const l = boden(); quelle(l, 0, 8, 0, LAVA);
  const rl = lauf(l).welt;
  assert.equal(rl.leseBlock(0, 3, 0).id, LAVAFLUSS);
  assert.equal(stufe(rl, 4, 1, 0), 6, 'Aufprall bei x=1, dann 3 Blöcke weiter');
  assert.equal(stufe(rl, 5, 1, 0), null);
});

test('Flüssigkeit: Gefälle bis 4 Blöcke wird bevorzugt', () => {
  const mitLoch = (x) => { const w = boden(); w.setzeBlock(x, 0, 0, 'minecraft:air'); quelle(w, 0, 1, 0); return lauf(w).welt; };
  // Loch 3 Blöcke östlich: nur nach Osten
  const nah = mitLoch(3);
  assert.ok(stufe(nah, 1, 1, 0) !== null && stufe(nah, 2, 1, 0) !== null, 'fließt zum Loch');
  assert.ok(luft(nah, -1, 1, 0) && luft(nah, 0, 1, 1) && luft(nah, 0, 1, -1), 'nicht in die anderen Richtungen');
  assert.ok(stufe(nah, 3, 0, 0) !== null, 'Loch gefüllt');
  // Loch 4 Blöcke östlich: auch gefunden
  const vier = mitLoch(4);
  assert.ok(luft(vier, -1, 1, 0), 'Loch im 4. Block wird noch gefunden');
  // Loch im 5. Block (nach höchstens 4 Blöcken Weg): gerade noch gefunden – pinnt den Parameter suchweite = 4
  const fuenf = mitLoch(5);
  assert.ok(luft(fuenf, -1, 1, 0) && luft(fuenf, 0, 1, 1), 'Loch im 5. Block wird noch gefunden');
  // Loch 6 Blöcke östlich: zu weit, Wasser breitet sich nach allen Seiten aus
  const fern = mitLoch(6);
  assert.ok(stufe(fern, -1, 1, 0) !== null && stufe(fern, 0, 1, 1) !== null, 'zu weit weg: keine Vorzugsrichtung');
  // Loch direkt daneben: nur dorthin
  const neben = mitLoch(1);
  assert.ok(luft(neben, -1, 1, 0) && luft(neben, 0, 1, 1));
  // Wand um das Gefälle herum: Wasser läuft um die Wand
  const w = boden(); w.setzeBlock(3, 0, 0, 'minecraft:air');
  for (const z of [-1, 0, 1]) w.setzeBlock(2, 1, z, 'minecraft:stone');
  quelle(w, 0, 1, 0);
  const um = lauf(w).welt;
  assert.ok(stufe(um, 3, 0, 0) !== null, 'Wasser kommt trotz Wand zum Loch');
});

test('Flüssigkeit: Gefälle auf der Diagonalen bis (3,3), gerade bis zum 5. Block', () => {
  const mitLoch = (x, z) => { const w = boden(); w.setzeBlock(x, 0, z, 'minecraft:air'); quelle(w, 0, 1, 0); return lauf(w).welt; };
  const nurRichtung = (r) => luft(r, -1, 1, 0) && luft(r, 0, 1, -1) && luft(r, -1, 1, -1);
  // Jonah, 24.10.2026: diagonales Loch bis (3,3) gefunden, bei (4,4) breitet sich das Wasser wieder in alle Richtungen aus
  for (const n of [1, 2, 3]) {
    const r = mitLoch(n, n);
    assert.ok(nurRichtung(r), `Loch bei (${n},${n}): nur Richtung Loch`);
    assert.ok(stufe(r, n, 0, n) !== null, `Loch bei (${n},${n}) gefüllt`);
  }
  const fern = mitLoch(4, 4);
  assert.ok(stufe(fern, -1, 1, 0) !== null && stufe(fern, 0, 1, -1) !== null && stufe(fern, -1, 1, -1) !== null, 'Loch bei (4,4) zu weit: alle Richtungen');
  // gerade: 5 ja, 6 nein (wie bisher), in jede der vier Himmelsrichtungen
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nah = mitLoch(5 * dx, 5 * dz), weit = mitLoch(6 * dx, 6 * dz);
    assert.ok(stufe(nah, -dx, 1, -dz) === null, `5. Block Richtung (${dx},${dz}) gefunden`);
    assert.ok(stufe(weit, -dx, 1, -dz) !== null, `6. Block Richtung (${dx},${dz}) zu weit`);
  }
  // Mischweg nach den Kosten 2 (gerade) und 3 (diagonal): (3,1) = 3 + 2 + 2 = 7 gefunden, (4,2) = 3 + 3 + 2 + 2 = 10 gefunden, (4,3) = 3·3 + 2 = 11 nicht
  assert.ok(stufe(mitLoch(3, 1), -1, 1, 0) === null, '(3,1) gefunden');
  assert.ok(stufe(mitLoch(4, 2), -1, 1, 0) === null, '(4,2) gerade noch gefunden');
  assert.ok(stufe(mitLoch(4, 3), -1, 1, 0) !== null, '(4,3) zu weit');
});

test('Flüssigkeit: diagonale Lücken zwischen festen Blöcken lassen kein Wasser durch', () => {
  const w = boden();
  // Ring aus Steinen um die Quelle, nur diagonal zwischen (1,0) und (0,1) offen
  for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1]]) w.setzeBlock(x, 1, z, 'minecraft:stone');
  quelle(w, 0, 1, 0);
  const r = lauf(w).welt;
  assert.ok(luft(r, 1, 1, 1), 'durch die diagonale Lücke fließt nichts');
  assert.equal(r.alleBloecke().filter((b) => /water/.test(b.id)).length, 1);
});

test('Flüssigkeit: unten vor seitlich', () => {
  // Loch direkt neben der Quelle: der Fließblock über dem Loch fällt und breitet sich nicht seitlich aus
  const w = boden(); w.setzeBlock(1, 0, 0, 'minecraft:air'); quelle(w, 0, 1, 0);
  const r = lauf(w).welt;
  assert.equal(stufe(r, 1, 1, 0), 1, 'Fließblock über dem Loch');
  assert.equal(stufe(r, 1, 0, 0), 8, 'Loch wird gefüllt (fallend)');
  assert.ok(luft(r, 2, 1, 0) && luft(r, 1, 1, 1) && luft(r, 1, 1, -1), 'über dem Loch geht es nicht seitlich weiter');
  assert.ok(luft(r, -1, 1, 0) && luft(r, 0, 1, 1), 'die Quelle fließt nur zum Gefälle');
});

test('Wasser: zwei Quellen ergeben eine neue Quelle, Lava nicht', () => {
  const w = boden(); quelle(w, -1, 1, 0); quelle(w, 1, 1, 0);
  const r = lauf(w);
  assert.equal(r.welt.leseBlock(0, 1, 0).id, WASSER);
  assert.equal(r.welt.leseBlock(0, 1, 0).zustand.liquid_depth, 0, 'neue Quelle in der Mitte');
  assert.ok(r.m.ereignisse.some((e) => e.was === 'neue-quelle' && e.pos.x === 0));
  // nur eine Quelle daneben: keine neue Quelle
  const e = boden(); quelle(e, 0, 1, 0);
  const re = lauf(e).welt;
  assert.equal(re.leseBlock(1, 1, 0).id, FLUSS);
  // Lava bildet nie neue Quellen
  const l = boden(); quelle(l, -1, 1, 0, LAVA); quelle(l, 1, 1, 0, LAVA);
  const rl = lauf(l).welt;
  assert.equal(rl.leseBlock(0, 1, 0).id, LAVAFLUSS);
  // unter dem Flussblock ist Luft (Loch) → keine Quelle
  const h = boden(); h.setzeBlock(0, 0, 0, 'minecraft:air'); h.setzeBlock(0, -1, 0, 'minecraft:air'); quelle(h, -1, 1, 0); quelle(h, 1, 1, 0);
  assert.notEqual(lauf(h).welt.leseBlock(0, 1, 0).id, WASSER);
});

test('Flüssigkeit: Mischen von Wasser und Lava', () => {
  // Wasserquelle neben Lavaquelle → Obsidian
  const a = boden(); quelle(a, 0, 1, 0, LAVA); quelle(a, 1, 1, 0);
  assert.equal(lauf(a).welt.leseBlock(0, 1, 0).id, 'minecraft:obsidian');
  // Wasserfluss trifft Lavafluss → Bruchstein, und danach grenzt nirgends Lava an Wasser
  const b = boden(); quelle(b, -2, 1, 0, LAVA); quelle(b, 8, 1, 0);
  const rb = lauf(b);
  const ids = rb.welt.alleBloecke().map((x) => x.id);
  assert.ok(ids.includes('minecraft:cobblestone'), 'Bruchstein entsteht');
  for (const blk of rb.welt.alleBloecke().filter((x) => /lava/.test(x.id))) {
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
      assert.ok(!/water/.test(rb.welt.leseBlock(blk.x + dx, blk.y + dy, blk.z + dz).id), `Lava bei ${blk.x},${blk.y},${blk.z} grenzt an Wasser`);
    }
  }
  assert.ok(rb.m.ereignisse.some((e) => e.was === 'gemischt'));
  // Lava fällt von oben auf Wasser → Stein
  const c = boden(); quelle(c, 0, 1, 0); quelle(c, 0, 4, 0, LAVA);
  const rc = lauf(c).welt;
  assert.equal(rc.leseBlock(0, 1, 0).id, 'minecraft:stone', 'Wasserquelle unter fallender Lava wird Stein');
  // Wasser fällt von oben auf Lavaquelle → Obsidian
  const d = boden(); quelle(d, 0, 1, 0, LAVA); quelle(d, 0, 4, 0);
  assert.equal(lauf(d).welt.leseBlock(0, 1, 0).id, 'minecraft:obsidian');
  // Lava neben Wasser darunter zählt nicht: Wasser unter Lava-Quelle ohne Fall (Lava auf festem Stein) – kein Obsidian
  const e = boden(); quelle(e, 0, 1, 0, LAVA);
  assert.equal(lauf(e).welt.leseBlock(0, 1, 0).id, LAVA, 'Lava allein bleibt Lava');
});

test('Wasser: spült wegspülbare Blöcke weg', () => {
  const w = boden(); quelle(w, 0, 1, 0);
  const wegspuelbar = [[2, 'minecraft:torch', { torch_facing_direction: 'top' }], [-2, 'minecraft:redstone_wire', {}], [3, 'minecraft:rail', { rail_direction: 0 }], [-3, 'minecraft:white_carpet', {}], [4, 'minecraft:golden_rail', { rail_direction: 1 }]];
  for (const [x, id, z] of wegspuelbar) w.setzeBlock(x, 1, 0, id, z);
  w.setzeBlock(0, 1, 2, 'minecraft:oak_sapling', {});
  w.setzeBlock(5, 1, 0, 'minecraft:stone'); w.setzeBlock(0, 1, -4, 'minecraft:glass');
  const r = lauf(w);
  for (const [x] of wegspuelbar) assert.ok(stufe(r.welt, x, 1, 0) !== null, `bei ${x} fließt jetzt Wasser`);
  assert.equal(r.welt.leseBlock(5, 1, 0).id, 'minecraft:stone');
  assert.equal(r.welt.leseBlock(0, 1, -4).id, 'minecraft:glass');
  const weg = r.m.ereignisse.filter((e) => e.was === 'weggespuelt').map((e) => e.von).sort();
  assert.deepEqual(weg, ['minecraft:golden_rail', 'minecraft:oak_sapling', 'minecraft:rail', 'minecraft:redstone_wire', 'minecraft:torch', 'minecraft:white_carpet']);
  // Original bleibt unverändert
  assert.equal(w.leseBlock(2, 1, 0).id, 'minecraft:torch');
});

test('Wasser: Abklingen ohne Nachschub', () => {
  const w = boden(); quelle(w, 0, 1, 0);
  const sk = e1.neuerSandkasten(w);
  const t = e1.neuerTaktgeber(sk); const m = F.mechanik(); t.registriere(m); m.anstossen(t);
  while (t.geplant.anzahl() > 0) t.schritt();
  assert.equal(sk.welt.alleBloecke().filter((b) => /water/.test(b.id)).length, 225);
  sk.welt.loescheBlock(0, 1, 0);
  m.aenderung(t, { x: 0, y: 1, z: 0 });
  const start = t.tick;
  let hoechste = 0;
  while (t.geplant.anzahl() > 0 && t.tick < 5000) {
    t.schritt();
    for (const b of sk.welt.alleBloecke().filter((x) => /water/.test(x.id))) hoechste = Math.max(hoechste, b.zustand.liquid_depth);
  }
  assert.equal(sk.welt.alleBloecke().filter((b) => /water/.test(b.id)).length, 0, 'alles Wasser ist weg');
  assert.ok(t.tick - start >= 5, 'dauert mindestens einen Verzögerungsschritt');
  assert.ok(hoechste <= 7);
  assert.ok(m.ereignisse.filter((e) => e.was === 'verschwunden').length === 225);
});

test('Flüssigkeit: nur feste Blöcke halten Wasser auf', () => {
  for (const [id, zustand] of [['minecraft:stone', {}], ['minecraft:glass', {}], ['minecraft:oak_double_slab', {}], ['minecraft:oak_stairs', { weirdo_direction: 0 }], ['minecraft:oak_slab', {}], ['minecraft:glass_pane', {}]]) {
    const w = boden(); quelle(w, 0, 1, 0); w.setzeBlock(2, 1, 0, id, zustand);
    const r = lauf(w).welt;
    assert.equal(r.leseBlock(2, 1, 0).id, id, `${id} bleibt stehen`);
    assert.equal(stufe(r, 2, 1, 0), null, `${id} füllt sich nicht`);
    assert.ok(stufe(r, 3, 1, 0) !== null, 'Wasser fließt außen herum');
  }
  // Wand mit Lücke
  const w = boden(); quelle(w, 0, 1, 0);
  for (let z = -8; z <= 8; z++) if (z !== 3) w.setzeBlock(2, 1, z, 'minecraft:stone');
  const r = lauf(w).welt;
  assert.ok(stufe(r, 3, 1, 3) !== null && stufe(r, 3, 1, 0) === null, 'Wasser kommt nur durch die Lücke');
});

test('Flüssigkeit: Obergrenze 100 geplante Ticks je Chunk und Spieltick', () => {
  const w = boden();
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) quelle(w, x, 1, z); // 256 Quellen in einem Chunk
  const r = lauf(w, { aufzeichnen: true });
  const proTick = new Map();
  for (const p of r.t.protokoll.filter((q) => q.art === 'geplanter-tick')) {
    const [x, z] = p.aktion.split(',').map(Number);
    const k = `${p.tick}:${Math.floor(x / 16)},${Math.floor(z / 16)}`;
    proTick.set(k, (proTick.get(k) ?? 0) + 1);
  }
  assert.ok(proTick.size > 0);
  assert.ok([...proTick.values()].every((n) => n <= 100), 'nie mehr als 100');
  assert.ok([...proTick.values()].some((n) => n === 100), 'die Grenze wird erreicht');
});

test('Flüssigkeit: deterministisch, Original unverändert, Sandkasten-Simulation', () => {
  const bauen = () => { const w = boden(); w.setzeBlock(3, 0, 0, 'minecraft:air'); w.setzeBlock(-2, 1, 1, 'minecraft:stone'); quelle(w, 0, 1, 0); quelle(w, 0, 6, 4, LAVA); return w; };
  const a = bauen(), vorher = e0.speichereWelt(a);
  const r1 = lauf(a, { aufzeichnen: true }), r2 = lauf(bauen(), { aufzeichnen: true });
  assert.equal(e0.speichereWelt(a), vorher, 'Original unverändert');
  assert.equal(e0.speichereWelt(r1.welt), e0.speichereWelt(r2.welt));
  assert.deepEqual(r1.t.protokoll, r2.t.protokoll);
  assert.deepEqual(r1.m.ereignisse, r2.m.ereignisse);
  const s = F.simuliere(a);
  assert.equal(s.stabil, true);
  assert.equal(e0.speichereWelt(s.welt), e0.speichereWelt(r1.welt), 'simuliere = Lauf bis zum stabilen Zustand');
});

test('Flüssigkeit: Drehen mit dem Vermesser vertauscht sich mit der Simulation', () => {
  const w = boden(10); w.setzeBlock(3, 0, 0, 'minecraft:air'); w.setzeBlock(-2, 1, 1, 'minecraft:stone'); w.setzeBlock(1, 1, -3, 'minecraft:stone'); quelle(w, 0, 1, 0);
  const aus = (welt) => welt.ausschnitt({ x: -10, y: -1, z: -10 }, { x: 10, y: 3, z: 10 });
  const normal = F.simuliere(w).welt;
  for (const k of [1, 2, 3]) {
    const gedreht = e0.neueWelt(); gedreht.fuegeBauteilEin(e0.vermesser.drehe(aus(w), k));
    const ergebnisGedreht = F.simuliere(gedreht).welt;
    const vergleich = e0.neueWelt(); vergleich.fuegeBauteilEin(e0.vermesser.drehe(aus(normal), k));
    assert.deepEqual(ergebnisGedreht.alleBloecke().filter((b) => b.y > 0), vergleich.alleBloecke().filter((b) => b.y > 0), `um ${k} Vierteldrehungen`);
  }
});

test('Prüfer: Wasser zerstört Schiene und Fackel', () => {
  const w = boden(); quelle(w, 0, 1, 0);
  w.setzeBlock(3, 1, 0, 'minecraft:rail', { rail_direction: 0 });
  w.setzeBlock(0, 1, 5, 'minecraft:torch', { torch_facing_direction: 'top' });
  w.setzeBlock(7, 1, 7, 'minecraft:torch', { torch_facing_direction: 'top' }); // Ecke des Quadrats (Jonah: Ecken sind nass)
  w.setzeBlock(9, 1, 9, 'minecraft:torch', { torch_facing_direction: 'top' }); // außerhalb der Reichweite
  const m = e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.wasser-zerstoert');
  assert.deepEqual(m.map((x) => [x.schwere, x.ort.x, x.ort.z]).sort(), [['verstoss', 0, 5], ['verstoss', 3, 0], ['verstoss', 7, 7]]);
  assert.match(m[0].meldung, /weggespült/);
  // sauberer Aufbau: nichts zu melden; ohne Flüssigkeit läuft keine Simulation
  const sauber = boden(); quelle(sauber, 0, 1, 0);
  assert.deepEqual(e1.pruefe(sauber, { schienen: null }).filter((x) => x.regel === 'pruefer.wasser-zerstoert'), []);
  assert.deepEqual(e1.pruefe(boden(), { schienen: null }), []);
  // Mischung als Hinweis
  const mix = boden(); quelle(mix, 0, 1, 0, LAVA); quelle(mix, 1, 1, 0);
  const mm = e1.pruefe(mix, { schienen: null }).filter((x) => x.regel === 'pruefer.wasser-zerstoert');
  assert.ok(mm.length >= 1 && mm.every((x) => x.schwere === 'hinweis'));
  // Original unverändert
  assert.equal(w.leseBlock(3, 1, 0).id, 'minecraft:rail');
});

test('Wasser: spült die von Jonah getesteten Pflanzen weg', () => {
  // Jonah, 24.10.2026: Fackeln, Redstone-Staub, Samen, Seegurken, Ranken, Setzlinge, Bodendecker, Korallen, Blumen
  const familien = {
    fackeln: ['minecraft:torch', 'minecraft:redstone_torch'],
    'redstone-staub': ['minecraft:redstone_wire'],
    samen: ['minecraft:wheat', 'minecraft:carrots', 'minecraft:potatoes', 'minecraft:beetroot', 'minecraft:melon_stem', 'minecraft:pumpkin_stem', 'minecraft:torchflower_crop', 'minecraft:pitcher_crop'],
    seegurke: ['minecraft:sea_pickle'],
    ranken: ['minecraft:vine', 'minecraft:cave_vines', 'minecraft:weeping_vines', 'minecraft:twisting_vines'],
    setzlinge: ['minecraft:oak_sapling', 'minecraft:spruce_sapling', 'minecraft:cherry_sapling', 'minecraft:bamboo_sapling', 'minecraft:mangrove_propagule'],
    bodendecker: ['minecraft:leaf_litter', 'minecraft:pink_petals', 'minecraft:wildflowers', 'minecraft:moss_carpet'],
    korallen: ['minecraft:tube_coral', 'minecraft:brain_coral_fan', 'minecraft:dead_horn_coral', 'minecraft:fire_coral_wall_fan'],
    blumen: ['minecraft:dandelion', 'minecraft:poppy', 'minecraft:blue_orchid', 'minecraft:oxeye_daisy', 'minecraft:cornflower', 'minecraft:torchflower', 'minecraft:sunflower', 'minecraft:rose_bush'],
  };
  const gruppen = e1.regelwerk.parameter('fluessigkeit.wegspuelen-getestet', 'familien');
  assert.deepEqual(Object.keys(familien).sort(), [...gruppen].sort(), 'die Regel nennt genau diese Gruppen');
  const ids = Object.values(familien).flat();
  for (const id of ids) {
    const w = boden(3); quelle(w, 0, 1, 0); w.setzeBlock(2, 1, 0, id, {});
    const r = lauf(w, { maxTicks: 30 });
    assert.deepEqual(r.m.ereignisse.filter((e) => e.was === 'weggespuelt').map((e) => e.von), [id], id);
    assert.ok(stufe(r.welt, 2, 1, 0) !== null, id + ' ist durch Wasser ersetzt');
  }
  // Korallenblöcke bleiben, Wasserpflanzen im Wasser nicht gemeint
  const w2 = boden(); quelle(w2, 0, 1, 0); w2.setzeBlock(1, 1, 0, 'minecraft:tube_coral_block'); w2.setzeBlock(2, 1, 0, 'minecraft:kelp');
  const r2 = lauf(w2);
  assert.equal(r2.welt.leseBlock(1, 1, 0).id, 'minecraft:tube_coral_block');
  assert.equal(r2.m.ereignisse.filter((e) => e.was === 'weggespuelt').length, 0);
});
