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
