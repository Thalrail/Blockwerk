import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { indexMenge, hat, EPS } from './formhilfe.js';
import { platziere, TESTPALETTE } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const TOLERANZ = e1.regelwerk.parameter('formen.rundung', 'toleranz');
const STICH = e1.regelwerk.parameter('bogen.stich', 'verhaeltnis');

/** Unabhängige Nachrechnung des Segmentbogens (Regel bogen.stich). */
function ideal(w, r, pf, t) {
  const s = r * w;
  const R = (s * s + (w / 2) ** 2) / (2 * s);
  const c = s - R;
  return {
    s,
    innen: (x) => pf + c + Math.sqrt(Math.max(0, R * R - x * x)),
    aussen: (x) => Math.max(pf, pf + c + Math.sqrt(Math.max(0, (R + t) ** 2 - x * x))),
  };
}

/** Öffnung eines Bogenquerschnitts (Schicht k = 0): Flutfüllung aus der Mitte, 4er-Nachbarschaft, ohne den Boden zu verlassen. */
function oeffnung(m, B, H) {
  const i0 = Math.floor((B - 1) / 2);
  const sehe = new Set([`${i0},0`]);
  const stapel = [[i0, 0]];
  let beruehrtRand = false;
  if (hat(m, i0, 0, 0)) throw new Error('Start liegt im Körper');
  while (stapel.length) {
    const [i, j] = stapel.pop();
    if (i === 0 || i === B - 1 || j === H - 1) beruehrtRand = true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + di, y = j + dj;
      if (x < 0 || x >= B || y < 0 || y >= H || sehe.has(`${x},${y}`) || hat(m, x, y, 0)) continue;
      sehe.add(`${x},${y}`);
      stapel.push([x, y]);
    }
  }
  return { sehe, beruehrtRand };
}

const daten = (w, r, pf, t) => {
  const p = e2.baue('form.bogen', { spannweite: w, stichverhaeltnis: r, pfeilerhoehe: pf, bogenstaerke: t, tiefe: 1 });
  const B = w + 2 * t;
  const H = p.platzbedarf.huelle.bis.y + 2;
  return { p, B, H, m: indexMenge(p, B, 1), id: ideal(w, r, pf, t) };
};

test('Bogen: Form für alle Spannweiten', () => {
  const weiten = [...Array.from({ length: 65 }, (_, i) => i + 1), 100, 128];
  for (const w of weiten) for (const r of [0.15, STICH, 0.5]) {
    const { p, B, H, m, id } = daten(w, r, 2, 1);
    // symmetrisch
    for (const s of m) { const [i, j] = s.split(',').map(Number); assert.ok(hat(m, B - 1 - i, j, 0), `w=${w} r=${r}: ${s}`); }
    // Rand höchstens ½ Block vom Ideal: Unterkante des Bogens je Spalte und Oberkante je Spalte
    for (let i = 0; i < B; i++) {
      const x = i - (B - 1) / 2;
      const js = []; for (let j = 0; j < H; j++) if (hat(m, i, j, 0)) js.push(j);
      assert.ok(js.length > 0, `w=${w} r=${r}: Spalte ${i} leer`);
      assert.ok(Math.abs(Math.max(...js) + 1 - id.aussen(x)) <= TOLERANZ + EPS, `w=${w} r=${r}: Außenkante x=${x}`);
      if (Math.abs(x) <= w / 2) assert.ok(Math.abs(Math.min(...js.filter((j) => j >= 0)) - id.innen(x)) <= TOLERANZ + EPS || Math.min(...js) < 2, `w=${w} r=${r}: Innenkante x=${x}`);
    }
    // lückenlos: die Öffnung kommt nirgends heraus und ist genau die Idealöffnung
    const o = oeffnung(m, B, H);
    assert.equal(o.beruehrtRand, false, `w=${w} r=${r}: Öffnung nicht geschlossen`);
    let soll = 0;
    for (let i = 0; i < B; i++) for (let j = 0; j < H; j++) { const x = i - (B - 1) / 2; if (Math.abs(x) <= w / 2 && (j + 0.5 < 2 || j + 0.5 <= id.innen(x))) soll++; }
    assert.equal(o.sehe.size, soll, `w=${w} r=${r}: Größe der Öffnung`);
    // lichte Höhe mindestens 2, Stich ≈ Verhältnis × Spannweite
    const xm = w % 2 === 1 ? 0 : 0.5;
    const frei = p.anschluesse[0].hoehe;
    assert.ok(frei >= 2, `w=${w} r=${r}: lichte Höhe ${frei}`);
    assert.ok(Math.abs(frei - id.innen(xm)) <= TOLERANZ + EPS, `w=${w} r=${r}: lichte Höhe ${frei} statt ${id.innen(xm)}`);
    assert.equal(p.anschluesse[0].breite, w);
  }
  // Bogenstärke 1…4 und höhere Pfeiler
  for (const [w, t, pf] of [[9, 2, 2], [9, 3, 3], [20, 4, 2], [20, 2, 5], [31, 3, 2]]) {
    const { B, H, m, id } = daten(w, STICH, pf, t);
    for (let i = 0; i < B; i++) {
      const x = i - (B - 1) / 2;
      const js = []; for (let j = 0; j < H; j++) if (hat(m, i, j, 0)) js.push(j);
      assert.ok(Math.abs(Math.max(...js) + 1 - id.aussen(x)) <= TOLERANZ + EPS, `w=${w} t=${t}: Außenkante x=${x}`);
    }
    assert.equal(oeffnung(m, B, H).beruehrtRand, false, `w=${w} t=${t}`);
  }
});

test('Bogen: Durchgang und Tonnengewölbe mit Ebene 1', () => {
  assert.throws(() => e2.baue('form.bogen', { pfeilerhoehe: 1 }), /außerhalb/);
  // Standard laut docs/ebenen.md: Stich = 0,3 × Spannweite, Pfeiler mindestens 2
  for (const w of [10, 21, 50, 100]) assert.ok(Math.abs(e2.baue('form.bogen', { spannweite: w }).anschluesse[0].hoehe - 2 - 0.3 * w) <= 0.5 + EPS, `Standardstich w=${w}`);
  assert.throws(() => e2.baue('form.bogen', { stichverhaeltnis: 0.9 }), /außerhalb/);
  assert.throws(() => e2.baue('form.bogen', { spannweite: 0 }), /außerhalb/);
  assert.equal(e2.bausteine.get('form.bogen').parameter.find((x) => x.name === 'pfeilerhoehe').groessenart, 'menschenmass');
  for (const w of [1, 2, 3, 5, 8, 12]) {
    const { p, B, H, m } = daten(w, STICH, 2, 1);
    const o = oeffnung(m, B, H);
    const tiefe = 3;
    const bogen = e2.baue('form.bogen', { spannweite: w, stichverhaeltnis: STICH, pfeilerhoehe: 2, bogenstaerke: 1, tiefe });
    const xmin = -Math.floor(B / 2) - 6, xmax = B - 1 - Math.floor(B / 2) + 6;
    const bauen = (dicht) => {
      const welt = e0.neueWelt();
      for (let x = xmin; x <= xmax; x++) for (let z = -8; z <= 8; z++) welt.setzeBlock(x, -1, z, 'minecraft:stone');
      for (const x of [xmin - 1, xmax + 1]) for (let z = -8; z <= 8; z++) for (let y = 0; y <= H + 2; y++) welt.setzeBlock(x, y, z, 'minecraft:stone');
      platziere(welt, bogen, TESTPALETTE);
      const ox = Math.floor(B / 2);
      for (let x = xmin; x <= xmax; x++) for (let y = 0; y < H; y++) {
        const i = x + ox;
        const imKoerper = i >= 0 && i < B && hat(m, i, y, 0);
        const inOeffnung = i >= 0 && i < B && o.sehe.has(`${i},${y}`);
        if (!imKoerper && !inOeffnung) for (let z = -1; z <= 1; z++) welt.setzeBlock(x, y, z, 'minecraft:stone');
      }
      if (dicht) for (const s of o.sehe) { const [i, j] = s.split(',').map(Number); if (j < 2) welt.setzeBlock(i - ox, j, 0, 'minecraft:stone'); }
      return welt;
    };
    const x0 = Math.min(...[...o.sehe].filter((s) => s.endsWith(',0')).map((s) => Number(s.split(',')[0]))) - Math.floor(B / 2);
    const offen = bauen(false);
    for (const art of ['spieler', 'dorfbewohner', 'baby']) {
      assert.equal(e1.bewegung.weg(offen, { x: x0, y: 0, z: 6 }, { x: x0, y: 0, z: -6 }, art).ok, true, `w=${w} ${art}: Durchgang`);
    }
    const zu = bauen(true);
    assert.equal(e1.bewegung.weg(zu, { x: x0, y: 0, z: 6 }, { x: x0, y: 0, z: -6 }, 'spieler').ok, false, `w=${w}: Mauer ohne Durchgang ist dicht`);
    assert.deepEqual(e1.pruefe(offen, { schienen: null }).filter((x) => x.schwere === 'verstoss'), []);
    assert.equal(p.anschluesse[0].art, 'durchgang');
  }
  // Tonnengewölbe: jede Schicht gleicht dem Bogenquerschnitt, zwei Anschlüsse, von Ende zu Ende begehbar
  for (const w of [3, 6, 9]) {
    const L = 7;
    const t = e2.baue('form.tonnengewoelbe', { spannweite: w, laenge: L });
    const b = e2.baue('form.bogen', { spannweite: w, tiefe: 1 });
    const schicht = (paket, k) => paket.bloecke.filter((x) => x.z === k).map((x) => `${x.x},${x.y}`).sort();
    const sollSchicht = schicht(b, 0);
    for (let k = -Math.floor(L / 2); k < L - Math.floor(L / 2); k++) assert.deepEqual(schicht(t, k), sollSchicht, `w=${w} Schicht ${k}`);
    assert.equal(t.anschluesse.length, 2);
    assert.deepEqual(t.anschluesse.map((a) => a.seite), ['nord', 'sued']);
    const welt = e0.neueWelt();
    for (let x = -w; x <= w; x++) for (let z = -6; z <= 6; z++) welt.setzeBlock(x, -1, z, 'minecraft:stone');
    platziere(welt, t, TESTPALETTE);
    const frei = t.bloecke.filter((x) => x.y === 0).map((x) => x.x);
    const x0 = Array.from({ length: 2 * w + 1 }, (_, i) => i - w).find((x) => !frei.includes(x) && x >= Math.min(...frei) && x <= Math.max(...frei));
    for (const art of ['spieler', 'dorfbewohner']) assert.equal(e1.bewegung.weg(welt, { x: x0, y: 0, z: -3 }, { x: x0, y: 0, z: 3 }, art).ok, true, `w=${w} ${art}: Tunnel`);
  }
});
