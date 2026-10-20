import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const A = e1.antrieb;
const GOLD = 'minecraft:golden_rail';
const RAIL = 'minecraft:rail';

/** Steinboden y = 0 von −30…30 × −6…6; Schienen liegen auf y = 1. */
const boden = () => {
  const w = e0.neueWelt();
  for (let x = -30; x <= 30; x++) for (let z = -6; z <= 6; z++) w.setzeBlock(x, 0, z, 'minecraft:stone');
  return w;
};
/** Reihe aus n Schienen in Ost-West-Richtung ab x = von (Antriebsschienen, wenn nichts anderes steht), gelegt wie im Spiel. */
const reihe = (w, von, n, id = GOLD, z = 0) => { for (let i = 0; i < n; i++) e1.schienen.platziere(w, { x: von + i, y: 1, z }, id); };
const aktiv = (w, quellen) => [...A.aktive(w, quellen)].map((k) => Number(k.split(',')[0])).sort((a, b) => a - b);
const redstoneBlock = (w, x, z = 1, y = 1) => w.setzeBlock(x, y, z, 'minecraft:redstone_block');

test('Antrieb: Reichweite 8 Schienen weit', () => {
  assert.equal(A.reichweite, 8);
  assert.equal(e1.regelwerk.parameter('antrieb.reichweite', 'maximalVersorgt'), 17);
  // Quelle am Anfang: erste Schiene + 8 weitere = 9
  const a = boden(); reihe(a, 0, 20); redstoneBlock(a, 0);
  assert.deepEqual(aktiv(a), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  // Quelle in der Mitte (Schiene 10): 8 links, 8 rechts = 17
  const m = boden(); reihe(m, 0, 20); redstoneBlock(m, 10);
  assert.deepEqual(aktiv(m), Array.from({ length: 17 }, (_, i) => 2 + i));
  assert.equal(aktiv(m).length, e1.regelwerk.parameter('antrieb.reichweite', 'maximalVersorgt'));
  // Zwei Quellen: Bereiche vereinigen sich
  const z = boden(); reihe(z, 0, 30); redstoneBlock(z, 3); redstoneBlock(z, 20);
  assert.deepEqual(aktiv(z), [...Array.from({ length: 12 }, (_, i) => i), ...Array.from({ length: 17 }, (_, i) => 12 + i)]);
});

test('Antrieb: nur verbundene Antriebsschienen geben Strom weiter', () => {
  // normale Schiene dazwischen (3. von 5): Strom endet davor
  const n = boden(); reihe(n, 0, 2); reihe(n, 2, 1, RAIL); reihe(n, 3, 2); redstoneBlock(n, 0);
  assert.deepEqual(aktiv(n), [0, 1]);
  // Lücke
  const l = boden(); reihe(l, 0, 2); reihe(l, 3, 2); redstoneBlock(l, 0);
  assert.deepEqual(aktiv(l), [0, 1]);
  // zweite Reihe daneben ist nicht verbunden
  const q = boden(); reihe(q, 0, 4); reihe(q, 0, 4, GOLD, 3); redstoneBlock(q, 0);
  assert.equal(A.aktive(q).size, 4);
  // Strom fließt in beide Richtungen von der Quelle aus
  const b = boden(); reihe(b, 0, 5); redstoneBlock(b, 2);
  assert.deepEqual(aktiv(b), [0, 1, 2, 3, 4]);
});

test('Antrieb: Redstone-Block versorgt die Nachbarschiene', () => {
  // Lagen: seitlich (Süd/Nord), davor/dahinter (Ost/West), darunter, darüber – direkt benachbart
  const lagen = { sued: [0, 1, 1], nord: [0, 1, -1], ost: [1, 1, 0], west: [-1, 1, 0], unten: [0, 0, 0], oben: [0, 2, 0] };
  for (const [name, [x, y, z]] of Object.entries(lagen)) {
    const w = boden();
    e1.schienen.platziere(w, { x: 0, y: 1, z: 0 }, GOLD);
    w.setzeBlock(x, y, z, 'minecraft:redstone_block');
    assert.equal(A.aktive(w).size, 1, `Redstone-Block ${name}`);
  }
  // nicht benachbart: nichts
  const fern = boden(); e1.schienen.platziere(fern, { x: 0, y: 1, z: 0 }, GOLD); redstoneBlock(fern, 0, 3);
  assert.equal(A.aktive(fern).size, 0);
  // von außen übergebene Stromquelle (z. B. künftiger Hebel) wirkt wie ein Stromblock
  const ext = boden(); reihe(ext, 0, 3);
  assert.deepEqual(aktiv(ext, [{ x: 0, y: 1, z: 1 }]), [0, 1, 2]);
  assert.deepEqual(aktiv(ext, []), []);
});

test('Antrieb: Steigung und Kurve im Strang', () => {
  // Strang mit Rampe: Antriebsschienen auf y = 1 (Ost-West), dann eine Steigung nach Osten zur Antriebsschiene auf y = 2
  const w = boden();
  w.setzeBlock(3, 1, 0, 'minecraft:stone');
  reihe(w, 0, 3);
  e1.schienen.platziere(w, { x: 3, y: 2, z: 0 }, GOLD);
  assert.equal(w.leseBlock(2, 1, 0).zustand.rail_direction, 2, 'dritte Schiene steigt an');
  redstoneBlock(w, 0);
  const alle = [...A.aktive(w)];
  assert.ok(alle.includes('3,2,0'), 'Strom läuft über die Steigung bis zur oberen Schiene');
  assert.equal(alle.length, 4);
  // normale Schienen in Kurven unterbrechen den Strang, Antriebsschienen bleiben gerade
  const k = boden(); reihe(k, 0, 3); e1.schienen.platziere(k, { x: 3, y: 1, z: 0 }, RAIL); e1.schienen.platziere(k, { x: 3, y: 1, z: 1 }, RAIL); redstoneBlock(k, 0, -1);
  assert.equal(A.aktive(k).size, 3);
});

test('Antrieb: schaltet nur im C-Tick', () => {
  const welt = boden(); reihe(welt, 0, 3);
  const sk = e1.neuerSandkasten(welt);
  const t = e1.neuerTaktgeber(sk, { aufzeichnen: true });
  t.registriere(A.mechanik());
  const bit = (x) => sk.welt.leseBlock(x, 1, 0).zustand.rail_data_bit;
  assert.deepEqual([0, 1, 2].map(bit), [false, false, false], 'Schienen starten unbestromt');
  t.schritt(); // Tick 1 (P)
  // Redstone-Block erscheint im P-Tick 1 (nach dem Schritt)
  sk.welt.setzeBlock(0, 1, 1, 'minecraft:redstone_block');
  t.schritt(); // Tick 2 (C)
  assert.deepEqual([0, 1, 2].map(bit), [true, true, true], 'im folgenden C-Tick aktiv');
  // Quelle wird im C-Tick 2 entfernt (nach dem Schritt): im P-Tick 3 bleibt die Schiene aktiv, erst im C-Tick 4 aus
  sk.welt.loescheBlock(0, 1, 1);
  t.schritt(); // Tick 3 (P)
  assert.deepEqual([0, 1, 2].map(bit), [true, true, true], 'P-Tick ändert nichts');
  t.schritt(); // Tick 4 (C)
  assert.deepEqual([0, 1, 2].map(bit), [false, false, false]);
  // Das Protokoll zeigt: die Mechanik lief nur in geraden Ticks
  const ticks = t.protokoll.filter((p) => p.id === 'antrieb').map((p) => [p.tick, p.phase]);
  assert.deepEqual(ticks, [[2, 'C'], [4, 'C']]);
});

test('Antrieb: gleicher Ablauf = gleiches Ergebnis; andere Zustände der Schiene bleiben', () => {
  const lauf = () => {
    const welt = boden(); reihe(welt, 0, 6); redstoneBlock(welt, 2);
    const sk = e1.neuerSandkasten(welt);
    const t = e1.neuerTaktgeber(sk, { seed: 9 });
    t.registriere(A.mechanik());
    t.laufe(6);
    return e0.speichereWelt(sk.welt);
  };
  assert.equal(lauf(), lauf());
  const w = boden(); reihe(w, 0, 3); redstoneBlock(w, 0);
  const vorher = w.leseBlock(1, 1, 0).zustand.rail_direction;
  const aenderung = A.aktiviere(w);
  assert.equal(aenderung.length, 3);
  assert.equal(w.leseBlock(1, 1, 0).zustand.rail_direction, vorher, 'Form bleibt');
  assert.equal(w.leseBlock(1, 1, 0).zustand.rail_data_bit, true);
  assert.deepEqual(A.aktiviere(w), [], 'zweites Aktivieren ändert nichts');
});

test('Prüfer: Antriebsschiene ohne Stromquelle', () => {
  const w = boden(); reihe(w, 0, 12); redstoneBlock(w, 0);
  const m = e1.pruefe(w, { stromQuellen: [], schienen: null }).filter((x) => x.regel === 'pruefer.antrieb-ohne-quelle');
  assert.deepEqual(m.map((x) => x.ort.x), [9, 10, 11], 'Schienen 9–11 sind mehr als 8 von der Quelle entfernt');
  assert.ok(m.every((x) => x.schwere === 'hinweis' && x.ort.y === 1 && x.ort.z === 0));
  assert.deepEqual(e1.pruefe(w, { stromQuellen: [], schienen: null }).filter((x) => x.regel === 'pruefer.antrieb-ohne-quelle' && x.ort.x < 9), []);
  // Ohne Angabe der Stromquellen läuft diese Prüfung nicht
  assert.deepEqual(e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.antrieb-ohne-quelle'), []);
  // Eine zweite Quelle in der Mitte deckt den Rest ab
  redstoneBlock(w, 10);
  assert.deepEqual(e1.pruefe(w, { stromQuellen: [], schienen: null }).filter((x) => x.regel === 'pruefer.antrieb-ohne-quelle'), []);
});
