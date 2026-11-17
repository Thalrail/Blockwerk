// D3.1 (Ebene 2): Wandzonen am Zylinder (Parameter wandzonen, Standard 0) und Wanddicke `tiefe` bei Tür und Fenster (Standard 1). Alles ohne die neuen Werte bleibt unverändert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from '../ebene5/hilfe5.js';

const KEY = (b) => `${b.x},${b.y},${b.z}`;

test('Zylinder: wandzonen 0 (Standard) und 1 bauen dieselben Blöcke, Zonen nur mit 1', async () => {
  const { ebene2 } = await engine();
  for (const [B, T, H, w] of [[13, 13, 6, 2], [12, 12, 8, 2], [9, 15, 5, 3], [21, 21, 10, 4]]) {
    const a = ebene2.baue('form.zylinder', { breite: B, tiefe: T, hoehe: H, wandstaerke: w });
    const b = ebene2.baue('form.zylinder', { breite: B, tiefe: T, hoehe: H, wandstaerke: w, wandzonen: 1 });
    assert.equal(a.einbauzonen, undefined, 'ohne wandzonen keine Zonen');
    assert.deepEqual(b.bloecke, a.bloecke, 'Blöcke gleich');
    assert.deepEqual(b.platzbedarf, a.platzbedarf);
    assert.deepEqual(b.einbauzonen.map((z) => z.id), ['wand-nord', 'wand-ost', 'wand-sued', 'wand-west']);
  }
});

test('Zylinder: jede Wandzone liegt auf der äußersten Zellschicht ihrer Seite, über die ganze Höhe und Länge', async () => {
  const { ebene2 } = await engine();
  for (const [B, T, H] of [[13, 13, 6], [12, 12, 8], [9, 15, 5], [10, 7, 4]]) {
    const p = ebene2.baue('form.zylinder', { breite: B, tiefe: T, hoehe: H, wandstaerke: 2, wandzonen: 1 });
    const xs = p.bloecke.map((b) => b.x), zs = p.bloecke.map((b) => b.z), ys = p.bloecke.map((b) => b.y);
    const [x0, x1, z0, z1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), Math.min(...ys), Math.max(...ys)];
    const z = Object.fromEntries(p.einbauzonen.map((q) => [q.seite, q]));
    assert.deepEqual([z.nord.von.z, z.nord.bis.z, z.sued.von.z, z.sued.bis.z, z.west.von.x, z.west.bis.x, z.ost.von.x, z.ost.bis.x], [z0, z0, z1, z1, x0, x0, x1, x1]);
    for (const q of p.einbauzonen) assert.deepEqual([q.von.y, q.bis.y], [y0, y1]);
    // über die ganze Länge der Seite (nicht abgeschnitten)
    assert.deepEqual([z.nord.von.x, z.nord.bis.x, z.sued.von.x, z.sued.bis.x], [x0, x1, x0, x1]);
    assert.deepEqual([z.west.von.z, z.west.bis.z, z.ost.von.z, z.ost.bis.z], [z0, z1, z0, z1]);
    // Die Mitte jeder Seite (Anker „mitte“) trifft bei ungerader Breite den mittleren Block, bei gerader den kleineren Mittelblock: symmetrisch zu den Blöcken
    const mitte = (v, b) => v + Math.floor((b - v) / 2);
    const dichte = new Set(p.bloecke.map(KEY));
    assert.ok(dichte.has(`${mitte(x0, x1)},${y0},${z0}`) , `${B}×${T}: Außenblock an der Nordmitte`);
    assert.ok(dichte.has(`${mitte(x0, x1)},${y0},${z1}`), `${B}×${T}: Außenblock an der Südmitte`);
    assert.ok(dichte.has(`${x0},${y0},${mitte(z0, z1)}`), `${B}×${T}: Außenblock an der Westmitte`);
    assert.ok(dichte.has(`${x1},${y0},${mitte(z0, z1)}`), `${B}×${T}: Außenblock an der Ostmitte`);
  }
});

test('Tür und Fenster: ohne tiefe wie bisher (eine Zelle tief), mit tiefe reicht die Aussparung durch die Wand', async () => {
  const { ebene2 } = await engine();
  const tiefeZ = (p) => Math.max(...p.aussparungen.map((a) => a.bis.z));
  const arten = (p) => p.aussparungen.map((a) => `${a.art}:${a.von.z}-${a.bis.z}`);
  assert.equal(tiefeZ(ebene2.baue('bau.tuer', { fluegel: 1 })), 0);
  assert.equal(tiefeZ(ebene2.baue('bau.tuer', { fluegel: 2, tiefe: 3 })), 2);
  assert.equal(tiefeZ(ebene2.baue('bau.fenster', { breite: 1, hoehe: 2, rahmen: 0 })), 0);
  assert.equal(tiefeZ(ebene2.baue('bau.fenster', { breite: 2, hoehe: 2, rahmen: 0, tiefe: 4 })), 3);
  // Die Vorderseite ist die Öffnung (ersetzt die Wand), dahinter hält die Freihaltung den Durchgang frei (ein manuell gesetzter Block dort wäre ein Konflikt)
  assert.deepEqual(arten(ebene2.baue('bau.tuer', { fluegel: 1 })), ['oeffnung:0-0'], 'ohne tiefe: genau wie bisher');
  assert.deepEqual(arten(ebene2.baue('bau.tuer', { fluegel: 1, tiefe: 3 })), ['oeffnung:0-0', 'freihaltung:1-2']);
  assert.deepEqual(arten(ebene2.baue('bau.fenster', { breite: 1, hoehe: 2, rahmen: 0, tiefe: 2 })), ['oeffnung:0-0', 'freihaltung:1-1']);
  // Die Blöcke der Bausteine bleiben gleich (nur die Aussparung wird tiefer)
  assert.deepEqual(ebene2.baue('bau.tuer', { fluegel: 1, tiefe: 3 }).bloecke, ebene2.baue('bau.tuer', { fluegel: 1 }).bloecke);
  assert.deepEqual(ebene2.baue('bau.fenster', { breite: 1, hoehe: 2, rahmen: 0, tiefe: 3 }).bloecke, ebene2.baue('bau.fenster', { breite: 1, hoehe: 2, rahmen: 0 }).bloecke);
});

test('Tür und Fenster: auch durch eine sehr dicke Wand (über 16 Blöcke) reicht die Freihaltung lückenlos', async () => {
  const { ebene2 } = await engine();
  for (const [id, parameter] of [['bau.tuer', { fluegel: 2, tiefe: 40 }], ['bau.fenster', { breite: 2, hoehe: 2, rahmen: 0, tiefe: 40 }]]) {
    const p = ebene2.baue(id, parameter);
    assert.deepEqual(p.aussparungen.map((a) => `${a.art}:${a.von.z}-${a.bis.z}`), ['oeffnung:0-0', 'freihaltung:1-39'], id);
  }
});
