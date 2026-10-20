import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Tickbereich } from '../../src/ebene1/tickbereich.js';

test('Tickbereich: Spieler mit Simulationsdistanz und Tickingarea', () => {
  const t = new Tickbereich({ spieler: [{ x: 8, z: 8 }], distanz: 2 });
  assert.equal(t.chunks().length, 25);
  assert.ok(t.tickt(0, 0) && t.tickt(2, 2) && t.tickt(-2, -2));
  assert.ok(!t.tickt(3, 0) && !t.tickt(0, -3));
  assert.ok(t.ticktBlock(40, 40) && !t.ticktBlock(48, 0), 'Block 40 liegt in Chunk 2, Block 48 in Chunk 3');

  const mitArea = new Tickbereich({ spieler: [{ x: 8, z: 8 }], distanz: 0, tickingAreas: [{ von: { x: 100, z: 100 }, bis: { x: 130, z: 120 } }] });
  assert.ok(mitArea.tickt(0, 0));
  assert.ok(mitArea.tickt(6, 6) && mitArea.tickt(8, 7), 'Rechteck deckt Chunks 6–8 × 6–7');
  assert.ok(!mitArea.tickt(5, 6) && !mitArea.tickt(9, 6));
});

test('Tickbereich: negative Koordinaten, mehrere Spieler, sortierte Ausgabe', () => {
  const t = new Tickbereich({ spieler: [{ x: -1, z: -1 }, { x: 100, z: 0 }], distanz: 1 });
  assert.ok(t.tickt(-1, -1) && t.tickt(-2, -2) && t.tickt(0, 0));
  assert.ok(t.tickt(6, 0) && !t.tickt(3, 0));
  const c = t.chunks();
  assert.deepEqual(c, [...c].sort((a, b) => a.cx - b.cx || a.cz - b.cz));
});

test('Tickbereich: ohne Distanz kein Rateversuch', () => {
  assert.throws(() => new Tickbereich({ spieler: [{ x: 0, z: 0 }] }), /Simulationsdistanz/);
  assert.throws(() => new Tickbereich({ spieler: [{ x: 0, z: 0 }], distanz: -1 }));
  assert.deepEqual(new Tickbereich().chunks(), []);
});

test('Aternos-Server (data/server.json): 4 Chunks Simulationsdistanz um den Spieler', () => {
  const server = JSON.parse(readFileSync(new URL('../../data/server.json', import.meta.url), 'utf8'));
  assert.equal(server.simulationsdistanzChunks, 4);
  assert.equal(server.ticksProSekunde, 20);
  assert.equal(server.chunkGroesse, 16);
  const t = new Tickbereich({ spieler: [{ x: 0, z: 0 }], distanz: server.simulationsdistanzChunks });
  assert.equal(t.chunks().length, 81, '9 × 9 Chunks');
  assert.ok(t.ticktBlock(4 * 16 + 15, 0) && !t.ticktBlock(5 * 16, 0), 'bis 79 Blöcke Entfernung, ab 80 nicht mehr');
});
