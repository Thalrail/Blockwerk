import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene0 } from '../hilfe.js';

const e = ebene0();

function testwelt() {
  const w = e.neueWelt();
  w.setzeBlock(0, 0, 0, 'minecraft:stone');
  w.setzeBlock(-17, -64, 33, 'minecraft:oak_stairs', { weirdo_direction: 3, upside_down_bit: true, 'minecraft:corner': 'outer_left' });
  w.setzeBlock(5, 70, -5, 'minecraft:hopper', { facing_direction: 0, toggle_bit: true }, [
    { slot: 1, gegenstand: 'minecraft:diamond', anzahl: 64 },
    { slot: 4, gegenstand: 'minecraft:stick', anzahl: 1 },
  ]);
  w.setzeBlock(6, 70, -5, 'minecraft:chest', {}, [{ slot: 26, gegenstand: 'minecraft:emerald', anzahl: 12 }]);
  w.fuegeWesenHinzu({ id: 'minecraft:villager_v2', x: 0.5, y: 64, z: 0.5, yaw: 90, baby: true, name: 'Hans' });
  const zweites = w.fuegeWesenHinzu({ id: 'minecraft:minecart', x: -7.25, y: 3, z: 8.75 });
  w.fuegeWesenHinzu({ id: 'minecraft:player', x: 1, y: 1, z: 1 });
  w.entferneWesen(zweites);
  return w;
}

test('Roundtrip: Welt → JSON → Welt ist verlustfrei', () => {
  const w = testwelt();
  const geladen = e.ladeWelt(e.speichereWelt(w));
  assert.deepEqual(geladen.alleBloecke(), w.alleBloecke());
  assert.deepEqual(geladen.wesen(), w.wesen());
  assert.deepEqual(geladen.chunks(), w.chunks());
  assert.equal(e.speichereWelt(geladen), e.speichereWelt(w), 'zweites Speichern ergibt denselben Text');
});

test('Wesen-Nummern bleiben erhalten, auch Lücken und der Zähler', () => {
  const w = testwelt();
  const g = e.ladeWelt(e.speichereWelt(w));
  assert.deepEqual(g.wesen().map((x) => x.nr), [1, 3]);
  assert.equal(g.fuegeWesenHinzu({ id: 'minecraft:player', x: 0, y: 0, z: 0 }), 4);
});

test('Speichern ist deterministisch: Reihenfolge des Setzens spielt keine Rolle', () => {
  const w = testwelt();
  const w2 = e.neueWelt();
  for (const b of [...w.alleBloecke()].reverse()) w2.setzeBlock(b.x, b.y, b.z, b.id, b.zustand, b.inhalt ?? null);
  for (const x of w.wesen()) { const { nr, ...rest } = x; w2.fuegeWesenHinzu(rest); }
  // Wesen-Nummern weichen ab (1,2 statt 1,3) – Blöcke und Palette müssen aber identisch sein
  assert.deepEqual(e.weltAlsObjekt(w2).bloecke, e.weltAlsObjekt(w).bloecke);
  assert.deepEqual(e.weltAlsObjekt(w2).palette, e.weltAlsObjekt(w).palette);
});

test('Leere Welt', () => {
  const g = e.ladeWelt(e.speichereWelt(e.neueWelt()));
  assert.equal(g.anzahlBloecke(), 0);
  assert.deepEqual(g.wesen(), []);
});

test('Größere Welt (50.000 Blöcke) übersteht den Roundtrip', () => {
  const w = e.neueWelt();
  const ids = ['minecraft:stone', 'minecraft:dirt', 'minecraft:oak_planks', 'minecraft:glass'];
  for (let x = -25; x < 25; x++) for (let y = 0; y < 20; y++) for (let z = -25; z < 25; z++) {
    if ((x + y + z) % 5 !== 0) w.setzeBlock(x, y, z, ids[(x * 3 + y * 5 + z * 7 + 1000) % 4]);
  }
  const g = e.ladeWelt(e.speichereWelt(w));
  assert.equal(g.anzahlBloecke(), w.anzahlBloecke());
  assert.deepEqual(g.alleBloecke(), w.alleBloecke());
});

test('Kaputte oder fremde Dateien werden abgelehnt', () => {
  const ok = e.weltAlsObjekt(testwelt());
  assert.throws(() => e.ladeWeltObjekt({ ...ok, format: 'andere-datei' }), /Keine Blockwerk-Weltdatei/);
  assert.throws(() => e.ladeWeltObjekt({ ...ok, version: 99 }), /Version/);
  assert.throws(() => e.ladeWeltObjekt({ ...ok, datenstand: '1.20.0' }), /Datenstand/);
  assert.throws(() => e.ladeWeltObjekt({ ...ok, bloecke: [[0, 0, 0, 999]] }), /Paletteneintrag/);
  assert.throws(() => e.ladeWeltObjekt({ ...ok, palette: [{ id: 'minecraft:quatsch', zustand: {} }], bloecke: [[0, 0, 0, 0]] }), /Unbekannter Block/);
  assert.throws(() => e.ladeWeltObjekt({ ...ok, naechsteWesenNr: 1 }), /naechsteWesenNr/);
  assert.throws(() => e.ladeWeltObjekt(null), /Keine Blockwerk-Weltdatei/);
  assert.throws(() => e.ladeWelt('{kein json'));
});

test('Gespeicherte Datei enthält nur JSON-Grundtypen (keine Funktionen/Maps)', () => {
  const text = e.speichereWelt(testwelt());
  assert.deepEqual(JSON.parse(text), e.weltAlsObjekt(testwelt()));
});
