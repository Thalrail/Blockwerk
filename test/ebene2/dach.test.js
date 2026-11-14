import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { indexMenge, hat, zelle, symmetrisch, leck, EPS } from './formhilfe.js';
import { platziere, TESTPALETTE } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const TOLERANZ = e1.regelwerk.parameter('formen.rundung', 'toleranz');
const NEIGUNGEN = [0.5, 1, 2];

/** Oberkante je Spalte (i, k): höchste Zelle + 1, sonst 0. */
function oberkanten(m, B, T) {
  const top = new Float64Array(B * T);
  for (const s of m) { const [i, j, k] = zelle(s); top[k * B + i] = Math.max(top[k * B + i], j + 1); }
  return top;
}

test('Dach: Satteldach für alle Breiten', () => {
  const T = 7;
  const breiten = [...Array.from({ length: 65 }, (_, i) => i + 1), 100, 128, 129, 255, 256];
  for (const n of NEIGUNGEN) for (const B of breiten) {
    const p = e2.baue('form.satteldach', { breite: B, laenge: T, neigung: n });
    const m = indexMenge(p, B, T);
    if (n * (B / 2 - (B % 2 ? 0 : 0.5)) < 0.5) { assert.equal(m.size, 0, `B=${B} n=${n}: zu flach für einen Block`); continue; }
    assert.ok(m.size > 0, `B=${B} n=${n}`);
    assert.equal(symmetrisch(m, B, 0, T), null, `B=${B} n=${n}`);
    // Dachfläche höchstens ½ Block vom Ideal; Firsthöhe folgt der Proportion
    const top = oberkanten(m, B, T);
    let first = 0;
    for (let i = 0; i < B; i++) {
      const h = n * (B / 2 - Math.abs(i - (B - 1) / 2));
      for (let k = 0; k < T; k++) {
        const kante = top[k * B + i];
        assert.ok(Math.abs(kante - h) <= TOLERANZ + EPS || (kante === 0 && h <= TOLERANZ + EPS), `B=${B} n=${n} i=${i}: Kante ${kante}, Ideal ${h}`);
        first = Math.max(first, kante);
      }
    }
    assert.ok(Math.abs(first - n * B / 2) <= 1, `B=${B} n=${n}: First ${first}`);
    // Giebel offen: erste und letzte Schicht sind Dachhaut, keine Giebelwand (Querschnitt wasserdicht)
    if (B <= 129) {
      const H = p.platzbedarf.huelle.bis.y + 2;
      const schnitt = new Set([...m].filter((s) => zelle(s)[2] === Math.floor(T / 2)).map((s) => { const [i, j] = zelle(s); return `${i},${j},0`; }));
      const drin = (i, j) => j + 0.5 <= n * (B / 2 - Math.abs(i - (B - 1) / 2));
      assert.equal(leck(schnitt, B, H, 1, (i, j) => drin(i, j), { boden: true, eben: true }), null, `B=${B} n=${n}: Querschnitt dicht`);
    }
    assert.equal(p.platzbedarf.huelle.bis.y + 1 >= 1, true);
  }
  // Wandstärke: dickere Haut hat mehr Blöcke und bleibt dicht
  const dick = e2.baue('form.satteldach', { breite: 21, laenge: 5, dachstaerke: 2 });
  assert.ok(dick.bloecke.length > e2.baue('form.satteldach', { breite: 21, laenge: 5 }).bloecke.length);
  // gleiche Formel für verschiedene Größen: Firsthöhe wächst mit der Breite
  const hoehe = (B) => e2.baue('form.satteldach', { breite: B, laenge: 3 }).platzbedarf.huelle.bis.y + 1;
  assert.ok(hoehe(24) > hoehe(12) && hoehe(48) > hoehe(24));
  assert.ok(Math.abs(hoehe(48) - 2 * hoehe(24)) <= 1);
});

test('Dach: Walmdach und Zeltdach', () => {
  for (const n of NEIGUNGEN) for (let B = 1; B <= 40; B++) for (const T of new Set([B, Math.max(1, Math.floor(B * 0.6)), B + 4])) {
    const p = e2.baue('form.walmdach', { breite: B, tiefe: T, neigung: n });
    const m = indexMenge(p, B, T);
    assert.equal(symmetrisch(m, B, 0, T, { drehen: B === T }), null, `${B}×${T} n=${n}`);
    const top = oberkanten(m, B, T);
    for (let k = 0; k < T; k++) for (let i = 0; i < B; i++) {
      const h = n * Math.min(B / 2 - Math.abs(i - (B - 1) / 2), T / 2 - Math.abs(k - (T - 1) / 2));
      const kante = top[k * B + i];
      assert.ok(Math.abs(kante - h) <= TOLERANZ + EPS || (kante === 0 && h <= TOLERANZ + EPS), `${B}×${T} n=${n} (${i},${k}): Kante ${kante}, Ideal ${h}`);
    }
    // wasserdicht von außen (Boden gesperrt), auch an allen vier Seiten
    if (B <= 21) {
      const H = p.platzbedarf.huelle.bis.y + 2;
      const drin = (i, j, k) => j + 0.5 <= n * Math.min(B / 2 - Math.abs(i - (B - 1) / 2), T / 2 - Math.abs(k - (T - 1) / 2));
      assert.equal(leck(m, B, H, T, drin, { boden: true }), null, `${B}×${T} n=${n}: dicht`);
    }
  }
  // Zeltdach: auf quadratischem Grundriss ein Gipfel in der Mitte (ungerade Breite)
  const zelt = e2.baue('form.walmdach', { breite: 11, tiefe: 11 });
  assert.equal(zelt.platzbedarf.huelle.bis.y + 1, 6);
  assert.ok(zelt.bloecke.some((b) => b.x === 0 && b.z === 0 && b.y === 5));
});

test('Dach: Platzieren, Prüfer und Proportion', () => {
  for (const id of ['form.satteldach', 'form.walmdach']) {
    const p = e2.baue(id);
    const w = e0.neueWelt();
    platziere(w, p, TESTPALETTE, { x: 3, y: 10, z: -2 });
    assert.equal(w.anzahlBloecke(), p.bloecke.length);
    assert.deepEqual(e1.pruefe(w, { schienen: null }).filter((x) => x.schwere === 'verstoss'), [], id);
    assert.ok(p.bloecke.every((b) => b.rolle === 'akzent'), 'Dach setzt die Rolle „akzent“');
    assert.deepEqual(p.anschluesse, [{ art: 'auflage', seite: 'unten' }]);
  }
  // Neigung ist eine Proportion: doppelte Neigung = doppelte Firsthöhe
  const h = (n) => e2.baue('form.satteldach', { breite: 40, laenge: 3, neigung: n }).platzbedarf.huelle.bis.y + 1;
  assert.ok(Math.abs(h(2) - 2 * h(1)) <= 1);
  assert.throws(() => e2.baue('form.satteldach', { neigung: 9 }), /außerhalb/);
  // Standardneigung 1,0 (45 Grad): Firsthöhe = halbe Breite
  for (const B of [10, 21, 50]) assert.ok(Math.abs(e2.baue('form.satteldach', { breite: B, laenge: 3 }).platzbedarf.huelle.bis.y + 1 - B / 2) <= 1, `Standardneigung B=${B}`);
});

test('Dach: deckend bedeckt jede Spalte der Grundfläche, Giebel schließt die Enden mit Wand, beides dicht und symmetrisch', () => {
  for (const n of [0.2, 0.5, 0.8, 1, 2]) for (const B of [1, 2, 3, 4, 5, 8, 9, 12, 21, 40, 65]) for (const T of [1, 2, 7]) for (const dachstaerke of [1, 2]) {
    const name = `B=${B} T=${T} n=${n} Stärke ${dachstaerke}`;
    const eben = (extra) => e2.baue('form.satteldach', { breite: B, laenge: T, neigung: n, dachstaerke, ...extra });
    // deckend: jede Spalte (i, k) trägt mindestens einen Block, die Kante liegt höchstens max(½ Block, 1) über dem Ideal
    const d = eben({ deckend: 1 }), md = indexMenge(d, B, T), top = oberkanten(md, B, T);
    assert.equal(symmetrisch(md, B, 0, T), null, `${name}: deckend symmetrisch`);
    for (let i = 0; i < B; i++) for (let k = 0; k < T; k++) {
      const h = n * (B / 2 - Math.abs(i - (B - 1) / 2));
      assert.ok(top[k * B + i] >= 1, `${name}: Spalte ${i},${k} bedeckt`);
      assert.ok(Math.abs(top[k * B + i] - h) <= Math.max(TOLERANZ, 1 - h) + EPS, `${name}: Spalte ${i},${k}: Kante ${top[k * B + i]}, Ideal ${h}`);
    }
    // Dachfläche weiter wie bisher dort, wo das Ideal ≥ 1 Block ist (Kante unverändert)
    const ohne = oberkanten(indexMenge(eben({}), B, T), B, T);
    for (let q = 0; q < B * T; q++) if (ohne[q] >= 1) assert.equal(top[q], ohne[q], `${name}: Kante unverändert über flachen Rändern`);
    assert.equal(d.platzbedarf.huelle.von.x, 0 - Math.floor(B / 2), `${name}: Hülle beginnt an der Grundfläche`);
    assert.equal(d.platzbedarf.huelle.bis.x, B - 1 - Math.floor(B / 2), `${name}: Hülle endet an der Grundfläche`);
    // Giebel: genau die Zellen unter der Dachfläche in der ersten und letzten Schicht, die nicht Dachhaut sind, als Rolle Wand
    const g = eben({ deckend: 1, giebel: 1 }), mg = indexMenge(g, B, T);
    assert.equal(symmetrisch(mg, B, 0, T), null, `${name}: Giebel symmetrisch`);
    const waende = g.bloecke.filter((b) => b.rolle === 'wand'), oz = Math.floor(T / 2);
    assert.ok(waende.every((b) => b.z === -oz || b.z === T - 1 - oz), `${name}: Giebelwand nur an den Enden`);
    assert.ok(g.bloecke.filter((b) => b.rolle === 'akzent').length === d.bloecke.length, `${name}: Dachhaut bleibt gleich`);
    // die Giebelwand ist genau die Menge der Zellen unter der Dachfläche in der ersten und letzten Schicht, die nicht Dachhaut sind
    const haut = new Set(d.bloecke.map((b) => `${b.x},${b.y},${b.z}`)), ox = Math.floor(B / 2), soll = new Set();
    for (const k of new Set([0, T - 1])) for (let j = 0; j <= g.platzbedarf.huelle.bis.y + 1; j++) for (let i = 0; i < B; i++) {
      if (j + 0.5 <= Math.max(n * (B / 2 - Math.abs(i - (B - 1) / 2)), 1) && !haut.has(`${i - ox},${j},${k - oz}`)) soll.add(`${i - ox},${j},${k - oz}`);
    }
    assert.deepEqual([...new Set(waende.map((b) => `${b.x},${b.y},${b.z}`))].sort(), [...soll].sort(), `${name}: Giebelwand = Zellen unter der Dachfläche an den Enden`);
    assert.equal(waende.length, soll.size, `${name}: keine Wandblöcke doppelt`);
    // wasserdicht: mit Giebel kommt von außen nichts ins Dachinnere (Boden gesperrt), ohne Giebel liegt es an den Enden offen
    if (B >= 5 && B <= 40 && T >= 2) {
      const H = g.platzbedarf.huelle.bis.y + 2;
      const drin = (i, j) => j + 0.5 <= Math.max(n * (B / 2 - Math.abs(i - (B - 1) / 2)), 1);
      assert.equal(leck(mg, B, H, T, (i, j) => drin(i, j), { boden: true }), null, `${name}: mit Giebel dicht`);
      const innenVorhanden = d.bloecke.length < B * T * H && Array.from({ length: B }).some((_, i) => Array.from({ length: H }).some((_, j) => drin(i, j) && !md.has(`${i},${j},${Math.floor(T / 2)}`)));
      if (innenVorhanden && dachstaerke === 1) assert.notEqual(leck(md, B, H, T, (i, j) => drin(i, j), { boden: true }), null, `${name}: ohne Giebel offen`);
    }
  }
  // Walmdach: deckend bedeckt jede Spalte
  for (const n of [0.5, 0.8, 1]) for (const [B, T] of [[1, 1], [1, 7], [7, 1], [2, 2], [5, 5], [8, 6], [11, 11], [20, 9]]) {
    const w = e2.baue('form.walmdach', { breite: B, tiefe: T, neigung: n, deckend: 1 }), top = oberkanten(indexMenge(w, B, T), B, T);
    const ohne = oberkanten(indexMenge(e2.baue('form.walmdach', { breite: B, tiefe: T, neigung: n }), B, T), B, T);
    assert.ok(top.every((h) => h >= 1), `Walm ${B}×${T} n=${n}: jede Spalte bedeckt`);
    for (let q = 0; q < B * T; q++) assert.equal(top[q], ohne[q] >= 1 ? ohne[q] : 1, `Walm ${B}×${T} n=${n}: Spalte ${q}: Kante unverändert, flache Ränder genau 1 Block`);
    assert.equal(symmetrisch(indexMenge(w, B, T), B, 0, T, { drehen: B === T }), null, `Walm ${B}×${T} n=${n}`);
  }
  assert.throws(() => e2.baue('form.satteldach', { giebel: 2 }), /außerhalb/);
  assert.throws(() => e2.baue('form.walmdach', { giebel: 1 }), /unbekannter Parameter/);
});
