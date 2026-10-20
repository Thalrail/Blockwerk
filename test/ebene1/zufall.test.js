import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Zufall, erwarteteMinuten, erwarteteTicks } from '../../src/ebene1/zufall.js';

const folge = (seed, n) => { const z = new Zufall(seed); return Array.from({ length: n }, () => z.naechste()); };

test('Zufall: gleicher Seed = gleiche Folge', () => {
  assert.deepEqual(folge(42, 100), folge(42, 100));
  assert.notDeepEqual(folge(42, 20), folge(43, 20));
});

test('Zufall: Werte liegen in [0, 1) und sind ungefähr gleichverteilt', () => {
  const werte = folge(7, 20000);
  assert.ok(werte.every((w) => w >= 0 && w < 1));
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
  assert.ok(Math.abs(mittel - 0.5) < 0.01, `Mittelwert ${mittel}`);
  const klassen = new Array(10).fill(0);
  for (const w of werte) klassen[Math.floor(w * 10)] += 1;
  for (const k of klassen) assert.ok(k > 1800 && k < 2200, `Klasse ${k}`);
});

test('Zufall: ganzzahl, ereignis, kopie', () => {
  const z = new Zufall(1);
  for (let i = 0; i < 1000; i++) { const g = z.ganzzahl(6); assert.ok(g >= 0 && g < 6 && Number.isInteger(g)); }
  const a = new Zufall(5); a.naechste();
  const b = a.kopie();
  assert.equal(a.naechste(), b.naechste(), 'Kopie läuft identisch weiter');
  assert.equal(new Zufall(3).ereignis(0), false);
  assert.equal(new Zufall(3).ereignis(1), true);
  assert.throws(() => z.ereignis(1.5));
  assert.throws(() => z.ganzzahl(0));
  assert.throws(() => new Zufall(1.5));
});

test('Erwartungswert passt zur Häufigkeit im Versuch', () => {
  assert.equal(erwarteteTicks(0.01), 100);
  assert.equal(erwarteteTicks(1), 1);
  assert.equal(erwarteteMinuten(1 / 1200), 1, '1200 Ticks = 1 Minute');
  const z = new Zufall(99);
  const p = 0.02;
  let summe = 0;
  const laeufe = 4000;
  for (let i = 0; i < laeufe; i++) { let t = 1; while (!z.ereignis(p)) t += 1; summe += t; }
  assert.ok(Math.abs(summe / laeufe - erwarteteTicks(p)) < 3, `Mittel ${summe / laeufe}`);
  assert.throws(() => erwarteteTicks(0));
});
