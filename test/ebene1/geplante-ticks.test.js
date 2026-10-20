import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeplanteTicks } from '../../src/ebene1/geplante-ticks.js';

test('Höchstens 100 geplante Ticks je Chunk und Spieltick', () => {
  const g = new GeplanteTicks();
  for (let i = 0; i < 250; i++) g.plane({ x: i % 16, z: 0, ab: 5, mechanik: 'wasser' });
  for (let i = 0; i < 30; i++) g.plane({ x: 16 + (i % 16), z: 0, ab: 5, mechanik: 'wasser' });
  assert.equal(g.faellige(4).length, 0, 'vor ab: nichts');
  const t5 = g.faellige(5);
  assert.equal(t5.filter((e) => e.cx === 0).length, 100);
  assert.equal(t5.filter((e) => e.cx === 1).length, 30, 'anderer Chunk ist unabhängig');
  assert.equal(g.anzahl(), 150);
});

test('Überlauf kommt im nächsten Tick zuerst wieder dran', () => {
  const g = new GeplanteTicks();
  const nummern = [];
  for (let i = 0; i < 230; i++) nummern.push(g.plane({ x: 0, z: 0, ab: 1, mechanik: 'm' }));
  const spaeter = g.plane({ x: 0, z: 0, ab: 2, mechanik: 'm' });
  const t1 = g.faellige(1).map((e) => e.nr);
  assert.deepEqual(t1, nummern.slice(0, 100));
  const t2 = g.faellige(2).map((e) => e.nr);
  assert.deepEqual(t2, nummern.slice(100, 200), 'zuerst die Übriggebliebenen, in Einreihreihenfolge');
  const t3 = g.faellige(3).map((e) => e.nr);
  assert.deepEqual(t3, [...nummern.slice(200), spaeter], 'dann der Rest, älteres „ab“ vor neuerem');
  assert.equal(g.anzahl(), 0);
});

test('Geplante Ticks: Reihenfolge ist (ab, Einreihnummer); Chunks außerhalb des Tickbereichs warten', () => {
  const g = new GeplanteTicks();
  const b = g.plane({ x: 0, z: 0, ab: 3, mechanik: 'm' });
  const a = g.plane({ x: 0, z: 0, ab: 2, mechanik: 'm' });
  const fern = g.plane({ x: 160, z: 0, ab: 1, mechanik: 'm' });
  const t = g.faellige(3, (cx) => cx === 0).map((e) => e.nr);
  assert.deepEqual(t, [a, b]);
  assert.equal(g.anzahl(), 1, 'der ferne Eintrag wartet');
  assert.deepEqual(g.faellige(9, () => true).map((e) => e.nr), [fern], 'wird nachgeholt, sobald der Chunk tickt');
});

test('Geplante Ticks: ungültige Eingaben', () => {
  const g = new GeplanteTicks();
  assert.throws(() => g.plane({ x: 0.5, z: 0, ab: 1, mechanik: 'm' }));
  assert.throws(() => g.plane({ x: 0, z: 0, ab: -1, mechanik: 'm' }));
  assert.throws(() => g.plane({ x: 0, z: 0, ab: 1, mechanik: '' }));
});
