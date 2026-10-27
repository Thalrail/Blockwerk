import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const SM = e1.stroemung;
const STEIN = 'minecraft:stone';
const WASSER = 'minecraft:water';
/** Zelle in der gewählten Strömungsrichtung des Kanals (Kanal wird für Osten gebaut und dann gedreht). */
const ABBILDUNG = { east: (x, z) => [x, z], south: (x, z) => [-z + 0, x], west: (x, z) => [-x + 0, -z + 0], north: (x, z) => [z, -x + 0] }; // + 0: kein -0

/**
 * Kanal mit Gefälle: `n` Abschnitte zu je 7 Zellen, jeder Abschnitt einen Block tiefer (Wasserfall zwischen den Abschnitten); Quelle am Anfang.
 * Abschnitt k: Zellen x = 7k … 7k + 7 bei y = 1 − k, Boden darunter außer am Fall (x = 7k + 7), Wände seitlich.
 */
function kanal(n, richtung = 'east') {
  const [pos] = [ABBILDUNG[richtung]];
  const w = e0.neueWelt();
  const setze = (x, y, z, id, zustand) => { const [a, b] = pos(x, z); w.setzeBlock(a, y, b, id, zustand); };
  for (let k = 0; k < n; k++) {
    const x0 = 7 * k, y = 1 - k, letzte = k === n - 1;
    for (let x = x0; x <= x0 + 8; x++) for (const z of [-1, 1]) for (const yy of [y + 1, y, y - 1]) setze(x, yy, z, STEIN);
    for (let x = x0; x <= x0 + (letzte ? 7 : 6); x++) setze(x, y - 1, 0, STEIN);
    setze(x0 + 8, y, 0, STEIN);
    if (letzte) setze(x0 + 8, y - 1, 0, STEIN);
  }
  for (const yy of [0, 1, 2]) for (const z of [-1, 0, 1]) setze(-1, yy, z, STEIN);
  setze(0, 1, 0, WASSER, { liquid_depth: 0 });
  return { welt: w, zelle: (x, y, z) => { const [a, b] = pos(x, z); return { x: a, y, z: b }; } };
}
const simuliert = (k) => e1.fluessigkeit.simuliere(k.welt).welt;

test('Strömung: Richtung, Weg und Zeit im Kanal', () => {
  const k = kanal(3);
  const s = simuliert(k);
  const c = k.zelle;
  // Richtung je Zelle
  assert.deepEqual(SM.richtung(s, c(0, 1, 0)), { art: 'quelle' });
  for (let x = 1; x <= 6; x++) assert.equal(SM.richtung(s, c(x, 1, 0)).richtung, 'east', `Zelle ${x}`);
  assert.equal(SM.richtung(s, c(7, 1, 0)).art, 'fall', 'über dem Wasserfall sinkt das Wesen');
  assert.equal(SM.richtung(s, c(7, 0, 0)).richtung, 'east', 'unten am Wasserfall fließt es wieder nach Osten');
  assert.equal(SM.richtung(s, c(3, 1, 1)).art, 'kein-wasser');
  assert.equal(SM.richtung(s, c(5, 0, 0)).art, 'kein-wasser');
  // Weg: von jeder Zelle bis zum Ende des Kanals (letzte Zelle des letzten Abschnitts)
  const ende = c(21, -1, 0);
  for (const start of [c(1, 1, 0), c(4, 1, 0), c(7, 1, 0), c(7, 0, 0), c(10, 0, 0), c(14, 0, 0), c(15, -1, 0)]) {
    const t = SM.treibe(s, start);
    assert.equal(t.grund, 'ende', JSON.stringify(start));
    assert.deepEqual(t.ende, ende, JSON.stringify(start));
    for (let i = 1; i < t.weg.length; i++) {
      const d = Math.abs(t.weg[i].x - t.weg[i - 1].x) + Math.abs(t.weg[i].y - t.weg[i - 1].y) + Math.abs(t.weg[i].z - t.weg[i - 1].z);
      assert.equal(d, 1, 'ein Schritt je Zelle');
    }
    assert.equal(t.sekunden, Math.round(((t.weg.length - 1) / 1.39) * 100) / 100);
  }
  // die ganze Strecke von der ersten Zelle: 7 + 1 + 7 + 1 + 6 Zellen
  const ganz = SM.treibe(s, c(1, 1, 0));
  assert.equal(ganz.weg.length, 23);
  assert.equal(ganz.sekunden, 15.83);
  // alle vier Richtungen gleich (der Kanal wird gedreht)
  for (const r of ['south', 'west', 'north']) {
    const g = kanal(3, r), sg = simuliert(g);
    const t = SM.treibe(sg, g.zelle(1, 1, 0));
    assert.equal(t.grund, 'ende', r);
    assert.deepEqual(t.ende, g.zelle(21, -1, 0), r);
    assert.equal(t.weg.length, 23, r);
  }
  // ohne Gefälle (ein Abschnitt): Ende nach 7 Zellen
  const eins = kanal(1), se = simuliert(eins);
  assert.deepEqual(SM.treibe(se, eins.zelle(1, 1, 0)).ende, eins.zelle(7, 1, 0));
  // deterministisch
  assert.equal(JSON.stringify(SM.treibe(s, c(1, 1, 0))), JSON.stringify(SM.treibe(simuliert(kanal(3)), c(1, 1, 0))));
});

test('Strömung: Quelle schiebt nicht', () => {
  const w = e0.neueWelt();
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) w.setzeBlock(x, 0, z, STEIN);
  for (const [x, z] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1], [-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]]) w.setzeBlock(x, 1, z, STEIN);
  w.setzeBlock(0, 1, 0, WASSER, { liquid_depth: 0 });
  assert.equal(SM.richtung(w, { x: 0, y: 1, z: 0 }).art, 'quelle');
  const t = SM.treibe(w, { x: 0, y: 1, z: 0 });
  assert.equal(t.grund, 'quelle');
  assert.equal(t.weg.length, 1);
  assert.equal(t.sekunden, 0);
  // Quelle neben fließendem Wasser: auch dort schiebt sie nicht, das Wesen bleibt auf der Quelle
  const k = kanal(1), s = simuliert(k);
  assert.equal(SM.treibe(s, k.zelle(0, 1, 0)).grund, 'quelle');
  // Stilles Wasser ohne Gefälle (gleiche Stufe ringsum): keine Richtung
  const v = e0.neueWelt();
  v.setzeBlock(0, 1, 0, 'minecraft:flowing_water', { liquid_depth: 3 });
  assert.equal(SM.richtung(v, { x: 0, y: 1, z: 0 }).art, 'keine');
  assert.equal(SM.treibe(v, { x: 0, y: 1, z: 0 }).grund, 'quelle');
  // nicht im Wasser
  assert.equal(SM.treibe(v, { x: 5, y: 1, z: 5 }).grund, 'kein-wasser');
});

test('Strömung: Gleichstand und Richtungsvektor sind eindeutig (feste Reihenfolge Nord, Ost, Süd, West)', () => {
  const w = e0.neueWelt();
  // Zelle in der Mitte (Stufe 3) mit zwei tieferen Nachbarn (Stufe 5) im Norden und Osten: gleich stark, Nord gewinnt
  w.setzeBlock(0, 1, 0, 'minecraft:flowing_water', { liquid_depth: 3 });
  w.setzeBlock(0, 1, -1, 'minecraft:flowing_water', { liquid_depth: 5 });
  w.setzeBlock(1, 1, 0, 'minecraft:flowing_water', { liquid_depth: 5 });
  const r = SM.richtung(w, { x: 0, y: 1, z: 0 });
  assert.equal(r.richtung, 'north');
  assert.deepEqual(r.vektor, { x: 2, z: -2 });
  // Der Süd-Nachbar mit Stufe 7 (stärker) zieht Süden vor
  w.setzeBlock(0, 1, -1, 'minecraft:flowing_water', { liquid_depth: 4 });
  w.setzeBlock(1, 1, 0, 'minecraft:flowing_water', { liquid_depth: 4 });
  w.setzeBlock(0, 1, 1, 'minecraft:flowing_water', { liquid_depth: 7 });
  assert.equal(SM.richtung(w, { x: 0, y: 1, z: 0 }).richtung, 'south');
  assert.deepEqual(SM.richtung(w, { x: 0, y: 1, z: 0 }).vektor, { x: 1, z: 3 });
  // Ein Nachbar mit höherer Oberfläche (kleinere Stufe) schiebt weg von sich
  const v = e0.neueWelt();
  v.setzeBlock(0, 1, 0, 'minecraft:flowing_water', { liquid_depth: 4 });
  v.setzeBlock(-1, 1, 0, 'minecraft:flowing_water', { liquid_depth: 2 });
  assert.equal(SM.richtung(v, { x: 0, y: 1, z: 0 }).richtung, 'east');
});
