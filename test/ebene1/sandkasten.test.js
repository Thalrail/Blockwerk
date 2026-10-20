import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;

test('Sandkasten: die Simulation verändert das Original nicht', () => {
  const original = e0.neueWelt();
  original.setzeBlock(0, 0, 0, 'minecraft:chest', {}, [{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 5 }]);
  original.fuegeWesenHinzu({ id: 'minecraft:player', x: 0.5, y: 1, z: 0.5 });
  const vorher = e0.speichereWelt(original);
  const sk = e1.neuerSandkasten(original);
  const t = e1.neuerTaktgeber(sk, { seed: 3 });
  t.registriere({
    id: 'zerstoerer', tickart: 'spieltick',
    schritt: (k) => { k.welt.setzeBlock(k.tick, 0, 0, 'minecraft:stone'); k.welt.fuegeWesenHinzu({ id: 'minecraft:minecart', x: k.tick, y: 0, z: 0 }); },
  });
  t.laufe(50);
  assert.equal(e0.speichereWelt(original), vorher, 'Original unverändert');
  assert.equal(sk.welt.anzahlBloecke(), 51);
  assert.equal(sk.welt.wesen().length, 51);
});

test('Sandkasten: abzweigen erzeugt eine unabhängige Kopie', () => {
  const sk = e1.neuerSandkasten(e0.neueWelt());
  sk.welt.setzeBlock(1, 1, 1, 'minecraft:stone');
  const zweig = sk.abzweigen();
  zweig.welt.setzeBlock(2, 2, 2, 'minecraft:dirt');
  assert.equal(sk.welt.anzahlBloecke(), 1);
  assert.equal(zweig.welt.anzahlBloecke(), 2);
  assert.equal(zweig.welt.leseBlock(1, 1, 1).id, 'minecraft:stone');
});
