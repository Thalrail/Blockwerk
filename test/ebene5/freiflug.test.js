import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matrix as M, kamera as K } from '../../src/ebene5/index.js';
import * as F from '../../src/ebene5/freiflug.js';

const nahe = (a, b, eps = 1e-4, was = '') => assert.ok(Math.abs(a - b) < eps, `${was} ${a} ≠ ${b}`);
const vnahe = (a, b, eps = 1e-4, was = '') => a.forEach((x, i) => nahe(x, b[i], eps, `${was}[${i}]`));
const keine = { vor: false, zurueck: false, links: false, rechts: false, hoch: false, runter: false };
const orbits = [
  { ziel: [0, 0, 0], azimut: 0, neigung: 0, abstand: 60 },
  { ziel: [10, 20, -5], azimut: Math.PI / 4, neigung: Math.PI / 6, abstand: 120 },
  { ziel: [-300, 5, 800], azimut: 4.2, neigung: -0.7, abstand: 2 },
  { ziel: [1, 2, 3], azimut: 6.0, neigung: K.NEIGUNG_MAX, abstand: 5000 },
];

test('Freiflug: Rundreise Orbit → Freiflug → Orbit', () => {
  for (const k of orbits) {
    const f = F.ausKamera(k);
    vnahe(f.position, K.auge(k), 1e-6, 'Auge');
    const r = F.zuOrbit(f, k.abstand);
    vnahe(r.ziel, k.ziel, 1e-6 * Math.max(1, k.abstand), 'Ziel');
    nahe(r.neigung, k.neigung, 1e-9, 'Neigung'); nahe(r.abstand, k.abstand);
    nahe(Math.cos(r.azimut), Math.cos(k.azimut), 1e-9); nahe(Math.sin(r.azimut), Math.sin(k.azimut), 1e-9);
  }
});

test('Freiflug: gleiche Ansichtsmatrix wie die Orbit-Kamera, auch nach der Rückumrechnung', () => {
  for (const k of orbits) {
    const soll = K.matrizen(k, 1.5).ansicht;
    const f = F.ausKamera(k);
    const ist = F.matrizen(f, 1.5, null).ansicht;
    for (let i = 0; i < 16; i++) nahe(ist[i], soll[i], 1e-3 * Math.max(1, k.abstand / 100), `Ansicht ${i}`);
    const zurueck = K.matrizen(F.zuOrbit(f, k.abstand), 1.5).ansicht;
    for (let i = 0; i < 16; i++) nahe(zurueck[i], soll[i], 1e-3 * Math.max(1, k.abstand / 100), `Rückweg ${i}`);
  }
});

test('Freiflug: Blickrichtung zeigt zum Orbit-Ziel; Richtungen W/S/A/D/Leertaste/Umschalt', () => {
  const k = orbits[1], f = F.ausKamera(k), b = F.blick(f);
  const zuZiel = [k.ziel[0] - f.position[0], k.ziel[1] - f.position[1], k.ziel[2] - f.position[2]];
  vnahe(zuZiel.map((x) => x / k.abstand), b, 1e-9, 'Blick');
  const bewegt = (tasten) => { const g = F.schritt(f, { ...keine, ...tasten }, 0.1, 10); return g.position.map((x, i) => x - f.position[i]); };
  vnahe(bewegt({ vor: true }), b, 1e-9, 'vor');
  vnahe(bewegt({ zurueck: true }), b.map((x) => -x), 1e-9, 'zurück');
  const r = F.rechts(f);
  vnahe(bewegt({ rechts: true }), r, 1e-9, 'rechts');
  vnahe(bewegt({ links: true }), r.map((x) => -x), 1e-9, 'links');
  vnahe(bewegt({ hoch: true }), [0, 1, 0], 1e-9, 'hoch');
  vnahe(bewegt({ runter: true }), [0, -1, 0], 1e-9, 'runter');
  // „rechts“ liegt im Bild wirklich rechts, „vor“ vor dem Auge
  const m = F.matrizen(f, 1, null).mvp;
  const vorn = M.zuNdc(m, f.position.map((x, i) => x + b[i] * 10));
  const rechtsNdc = M.zuNdc(m, f.position.map((x, i) => x + b[i] * 10 + r[i]));
  assert.ok(vorn.w > 0 && Math.abs(vorn.x) < 1e-6);
  assert.ok(rechtsNdc.x > 0, 'rechts ist im Bild rechts');
});

test('Freiflug: Diagonalen sind nicht schneller; Gegentasten heben sich auf', () => {
  const f = { position: [0, 0, 0], gier: 0.3, nick: 0.4 };
  const weg = (t) => { const g = F.schritt(f, { ...keine, ...t }, 0.05, 40); return Math.hypot(...g.position); };
  nahe(weg({ vor: true }), 2, 1e-9);
  nahe(weg({ vor: true, rechts: true }), 2, 1e-9);
  nahe(weg({ vor: true, rechts: true, hoch: true }), 2, 1e-9);
  nahe(weg({ rechts: true, hoch: true }), 2, 1e-9);
  assert.deepEqual(F.schritt(f, { ...keine, vor: true, zurueck: true }, 0.05, 40).position, [0, 0, 0]);
});

test('Freiflug: bildratenunabhängig, dt geklemmt, kein NaN', () => {
  const f = { position: [5, 6, 7], gier: 1, nick: -0.2 }, t = { ...keine, vor: true, rechts: true };
  const ganz = F.schritt(f, t, 0.08, 30);
  const halb = F.schritt(F.schritt(f, t, 0.04, 30), t, 0.04, 30);
  vnahe(halb.position, ganz.position, 1e-9, 'Halbschritte');
  // dt-Klemme: eine ganze Sekunde wirkt wie 0,1 s; negativ wirkt wie 0
  assert.deepEqual(F.schritt(f, t, 1, 30).position, F.schritt(f, t, F.DT_MAX, 30).position);
  assert.deepEqual(F.schritt(f, t, -1, 30).position, f.position);
  for (const [tasten, dt] of [[keine, 0.05], [t, 0], [t, NaN], [t, Infinity], [{}, 0.05]]) {
    const g = F.schritt(f, tasten, dt, 30);
    assert.ok(g.position.every(Number.isFinite), `${JSON.stringify(tasten)} ${dt}`);
  }
  assert.deepEqual(F.schritt(f, keine, 0.05, 30).position, f.position);
  assert.ok(F.schritt(f, t, 0.05, NaN).position.every(Number.isFinite));
});

test('Freiflug: Nick auf ±85° begrenzt, Gier läuft rund', () => {
  let f = { position: [0, 0, 0], gier: 0, nick: 0 };
  f = F.drehen(f, 0, 10); nahe(f.nick, K.NEIGUNG_MAX, 1e-12);
  f = F.drehen(f, 0, -100); nahe(f.nick, -K.NEIGUNG_MAX, 1e-12);
  f = F.drehen(f, 7, 0); assert.ok(f.gier >= 0 && f.gier < 2 * Math.PI);
  f = F.drehen({ ...f, gier: 0.1 }, -0.3, 0); assert.ok(f.gier >= 0 && f.gier < 2 * Math.PI);
  // Orbit-Neigung am Anschlag bleibt am Anschlag
  nahe(F.ausKamera({ ziel: [0, 0, 0], azimut: 1, neigung: 9, abstand: 10 }).nick, -K.NEIGUNG_MAX, 1e-12);
  // drehen verändert die Eingabe nicht
  const g = { position: [1, 2, 3], gier: 1, nick: 0 }; F.drehen(g, 1, 1); assert.deepEqual(g, { position: [1, 2, 3], gier: 1, nick: 0 });
});

test('Freiflug: Tempo wächst mit der Bauwerksgröße, mit Unter- und Obergrenze', () => {
  const h = (n) => ({ von: [0, 0, 0], bis: [n, n, n] });
  const klein = F.standardTempo(h(3)), mittel = F.standardTempo(h(100)), gross = F.standardTempo(h(600));
  assert.equal(klein, F.TEMPO_MIN);
  assert.ok(mittel > klein && gross > mittel);
  assert.equal(F.standardTempo(h(4096)), F.TEMPO_MAX);
  assert.ok(Number.isFinite(F.standardTempo(null)));
  assert.equal(F.standardTempo({ von: [1, 1, 1], bis: [1, 1, 1] }), F.TEMPO_MIN);
  assert.equal(F.tempoAnpassen(10, 2), 20);
  assert.equal(F.tempoAnpassen(10, 1e-9), 1);
  assert.equal(F.tempoAnpassen(10, 1e9), 2000);
});

test('Freiflug: Far-Plane deckt die ganze Hülle ab, Near fest', () => {
  for (const [huelle, pos] of [
    [{ von: [0, 0, 0], bis: [10, 10, 10] }, [5, 5, 5]],
    [{ von: [0, 0, 0], bis: [4096, 300, 4096] }, [-3000, 100, -3000]],
    [{ von: [-2000, 0, -2000], bis: [2000, 100, 2000] }, [9000, 800, 9000]],
  ]) {
    const f = { position: pos, gier: 1, nick: 0.2 };
    const p = F.matrizen(f, 1.7, huelle).projektion;
    const nah = p[14] / (p[10] - 1), fern = p[14] / (p[10] + 1);
    nahe(nah, 0.1, 1e-4, 'Near');
    for (const x of [huelle.von[0], huelle.bis[0]]) for (const y of [huelle.von[1], huelle.bis[1]]) for (const zz of [huelle.von[2], huelle.bis[2]]) {
      assert.ok(Math.hypot(x - pos[0], y - pos[1], zz - pos[2]) < fern, `Ecke ${x},${y},${zz} liegt hinter der Far-Plane ${fern}`);
    }
  }
});

test('Freiflug: Determinismus (gleiche Eingabe = gleiches Ergebnis)', () => {
  const lauf = () => {
    let f = F.ausKamera(orbits[1]);
    for (let i = 0; i < 50; i++) f = F.drehen(F.schritt(f, { ...keine, vor: i % 3 > 0, rechts: i % 2 === 0, hoch: i % 5 === 0 }, 0.016, 33), 0.01 * i, -0.005 * i);
    return [f, [...F.matrizen(f, 1.3, { von: [0, 0, 0], bis: [50, 50, 50] }).mvp]];
  };
  assert.deepEqual(lauf(), lauf());
});
