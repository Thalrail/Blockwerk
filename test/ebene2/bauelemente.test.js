import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { indexMenge, symmetrisch } from './formhilfe.js';
import { TESTPALETTE, ring } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const B = e1.bewegung;
const ARTEN = ['spieler', 'dorfbewohner', 'baby'];
const STEIN = 'minecraft:stone';
const VEKTOR = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const IM_UHRZEIGER = { north: 'east', east: 'south', south: 'west', west: 'north' };
const verstoesse = (w) => e1.pruefe(w, { schienen: null }).filter((x) => x.schwere === 'verstoss');

function boden(w, x1, x2, z1, z2, y = -1) {
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) w.setzeBlock(x, y, z, STEIN);
}

test('Bauelemente: Gang, Tür und Fenster mit Ebene 1', () => {
  // Gang: Maße, Menschenmaß, begehbar für alle Arten
  assert.throws(() => e2.baue('bau.gang', { hoehe: 1 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.gang', { breite: 0 }), /außerhalb/);
  for (const [L, w, h, t] of [[7, 1, 2, 1], [7, 3, 3, 1], [9, 4, 4, 2], [5, 5, 2, 1], [1, 2, 3, 1]]) {
    const p = e2.baue('bau.gang', { laenge: L, breite: w, hoehe: h, wandstaerke: t });
    const Bg = w + 2 * t;
    assert.equal(p.bloecke.length, L * (Bg * (h + 2 * t) - w * h), `Gang ${L}×${w}×${h}`);
    assert.ok(p.bloecke.every((b) => (b.y < 0) === (b.rolle === 'boden')), 'Boden nur unter der Gehhöhe');
    assert.deepEqual(p.anschluesse.map((a) => [a.seite, a.breite, a.hoehe]), [['nord', w, h], ['sued', w, h]]);
    const welt = e0.neueWelt();
    e2.platziere(welt, p, TESTPALETTE);
    const zs = p.bloecke.map((b) => b.z), zNord = Math.min(...zs), zSued = Math.max(...zs);
    const xs = p.bloecke.map((b) => b.x);
    const frei = []; for (let x = Math.min(...xs); x <= Math.max(...xs); x++) if (welt.leseBlock(x, 0, zNord).id === 'minecraft:air') frei.push(x);
    assert.equal(frei.length, w, `Gang ${L}×${w}×${h}: lichte Breite`);
    for (const art of ARTEN) {
      assert.equal(B.weg(welt, { x: frei[0], y: 0, z: zSued }, { x: frei[0], y: 0, z: zNord }, art).ok, true, `Gang ${L}×${w}×${h} ${art}`);
    }
    assert.deepEqual(verstoesse(welt), []);
  }

  // Tür in einer geschlossenen Mauer
  const mauer = (flugel, tuerId) => {
    const welt = e0.neueWelt();
    boden(welt, -6, 6, -6, 6);
    for (let x = -6; x <= 6; x++) for (let y = 0; y <= 5; y++) welt.setzeBlock(x, y, 0, STEIN);
    for (const x of [-7, 7]) for (let z = -6; z <= 6; z++) for (let y = 0; y <= 5; y++) welt.setzeBlock(x, y, z, STEIN);
    if (flugel) {
      const tuer = e2.baue('bau.tuer', { fluegel: flugel });
      for (const b of tuer.bloecke) welt.loescheBlock(b.x, b.y, b.z);
      e2.platziere(welt, tuer, { ...TESTPALETTE, akzent: { ...TESTPALETTE.akzent, tuer: tuerId } });
    }
    return welt;
  };
  const gehe = (welt, art, x = 0) => B.weg(welt, { x, y: 0, z: 3 }, { x, y: 0, z: -3 }, art).ok;
  for (const art of ARTEN) assert.equal(gehe(mauer(0), art), false, `Mauer ohne Tür hält ${art}`);
  for (const art of ARTEN) assert.equal(gehe(mauer(1, 'minecraft:wooden_door'), art), true, `Holztür ${art}`);
  for (const art of ARTEN) assert.equal(gehe(mauer(2, 'minecraft:wooden_door'), art, 1), true, `Doppeltür ${art}`);
  for (const art of ARTEN) assert.equal(gehe(mauer(1, 'minecraft:iron_door'), art), false, `Eisentür hält ${art}`);
  assert.deepEqual(e2.baue('bau.tuer').anschluesse, [{ art: 'durchgang', achse: 'z', breite: 1, hoehe: 2 }]);
  assert.equal(e2.baue('bau.tuer', { fluegel: 2 }).bloecke.length, 4);
  assert.throws(() => e2.baue('bau.tuer', { fluegel: 3 }), /außerhalb/);
  assert.deepEqual(verstoesse(mauer(1, 'minecraft:wooden_door')), []);
});

/** Welt mit Boden und einer Plattform oben für eine Treppe; liefert Start- und Zielzelle der Füße. */
function treppenwelt(p, lauf, r) {
  const welt = e0.neueWelt();
  boden(welt, -r - 4, r + 4, -r - 80, r + 4);
  e2.platziere(welt, p, TESTPALETTE);
  const letzte = p.bloecke[p.bloecke.length - 1];
  const dx = lauf ? lauf.x - letzte.x : 0, dz = lauf ? lauf.z - letzte.z : -1;
  const ziel = { x: letzte.x + dx, y: letzte.y + 1, z: letzte.z + dz };
  welt.setzeBlock(ziel.x, ziel.y - 1, ziel.z, STEIN);
  return { welt, ziel };
}

test('Bauelemente: Treppe und Wendeltreppe mit Ebene 1', () => {
  // gerade Treppe: Stufenhöhe 1, ohne Sprung, alle Arten
  for (const [stufen, breite] of [[1, 1], [2, 2], [5, 3], [17, 1], [64, 2]]) {
    const p = e2.baue('bau.treppe', { stufen, breite });
    assert.equal(p.bloecke.length, stufen * breite);
    assert.ok(p.bloecke.every((b, i) => b.y === Math.floor(i / breite) && b.z === -Math.floor(i / breite) && b.richtung === 'north' && b.form === 'treppe'));
    const { welt, ziel } = treppenwelt(p, null, 4);
    for (const art of ARTEN) {
      const w = B.weg(welt, { x: p.bloecke[0].x, y: 0, z: 1 }, ziel, art, { radius: 200 });
      assert.equal(w.ok, true, `Treppe ${stufen} ${art}: ${w.grund}`);
      assert.equal(w.springt, false, `Treppe ${stufen} ${art}: ohne Sprung`);
    }
    assert.deepEqual(verstoesse(welt), []);
  }

  // Wendeltreppe: Ring, Stufen pro Umdrehung wächst mit dem Radius
  let vorher = 0;
  for (let r = 1; r <= 12; r++) {
    const pfad = ring(r);
    const N = pfad.length;
    assert.ok(N >= 8 && N >= 2 * Math.PI * r && N <= 8 * r, `r=${r}: N=${N}`);
    assert.ok(N >= vorher, `r=${r}: Stufen pro Umdrehung wachsen`);
    vorher = N;
    assert.equal(new Set(pfad.map((c) => `${c.x},${c.z}`)).size, N, `r=${r}: keine Zelle doppelt`);
    for (let i = 0; i < N; i++) {
      const a = pfad[i], b = pfad[(i + 1) % N];
      assert.equal(Math.abs(a.x - b.x) + Math.abs(a.z - b.z), 1, `r=${r}: Ring geschlossen und 4-zusammenhängend`);
    }
    for (const drehsinn of [1, 0]) {
      const stufen = 2 * N + 3;
      const p = e2.baue('bau.wendeltreppe', { radius: r, stufen, drehsinn });
      const lauf = drehsinn === 1 ? pfad : pfad.slice().reverse();
      assert.equal(p.anschluesse[0].stufenProUmdrehung, N);
      p.bloecke.forEach((b, s) => {
        const a = lauf[s % N], nach = lauf[(s + 1) % N];
        assert.deepEqual([b.x, b.y, b.z], [a.x, s, a.z], `r=${r} Stufe ${s}`);
        assert.equal(b.richtung, Object.keys(VEKTOR).find((k) => VEKTOR[k][0] === nach.x - a.x && VEKTOR[k][1] === nach.z - a.z), `r=${r} Stufe ${s}: Laufrichtung`);
        // Kopfraum: über jeder Stufe sind 2 Blöcke frei (kein anderer Stufenblock an derselben Stelle in 1…2 Blöcken Höhe)
        for (const c of p.bloecke) if (c !== b && c.x === b.x && c.z === b.z) assert.ok(c.y - b.y >= 3 || b.y - c.y >= 3, `r=${r} Stufe ${s}: Kopfraum`);
      });
      if (r <= 6 || r === 12) {
        const start = lauf[N - 1];
        const ziel = lauf[stufen % N];
        const welt = e0.neueWelt();
        boden(welt, -r - 3, r + 3, -r - 3, r + 3);
        e2.platziere(welt, p, TESTPALETTE);
        welt.setzeBlock(ziel.x, stufen - 1, ziel.z, STEIN);
        for (const art of ARTEN) {
          const w = B.weg(welt, { x: start.x, y: 0, z: start.z }, { x: ziel.x, y: stufen, z: ziel.z }, art);
          assert.equal(w.ok, true, `Wendeltreppe r=${r} drehsinn=${drehsinn} ${art}: ${w.grund}`);
          assert.equal(w.springt, false, `Wendeltreppe r=${r} ${art}: ohne Sprung`);
        }
        assert.deepEqual(verstoesse(welt), []);
      }
    }
  }
  assert.equal(ring(1).length, 8);
  assert.ok(ring(12).length > ring(6).length * 1.5);
});

test('Bauelemente: Zustände, Fenster und Säule', () => {
  // Zustände: Treppe und Tür bekommen ihre Richtung über die Drehregeln aus Ebene 0
  const treppe = e2.baue('bau.wendeltreppe', { radius: 2, stufen: 12 });
  const tuer = e2.baue('bau.tuer', { fluegel: 2 });
  assert.throws(() => { const w = e0.neueWelt(); require_platziere(w, treppe); }, /ebene0/);
  const welt = e0.neueWelt();
  e2.platziere(welt, treppe, TESTPALETTE, { x: 0, y: 0, z: 0 });
  e2.platziere(welt, tuer, TESTPALETTE, { x: 20, y: 0, z: 0 });
  for (const b of treppe.bloecke) {
    const z = welt.leseBlock(b.x, b.y, b.z);
    assert.equal(z.id, 'minecraft:stone_stairs');
    assert.equal(e0.vermesser.richtungVon('weirdo_direction', z.zustand.weirdo_direction), b.richtung);
  }
  for (const b of tuer.bloecke) {
    const z = welt.leseBlock(b.x + 20, b.y, b.z);
    assert.equal(z.id, 'minecraft:wooden_door');
    assert.equal(z.zustand['minecraft:cardinal_direction'], b.richtung);
    assert.equal(z.zustand.upper_block_bit, b.haelfte === 'oben');
    assert.equal(z.zustand.door_hinge_bit, b.scharnier === 'rechts');
    assert.equal(z.zustand.open_bit, false);
  }
  assert.deepEqual(tuer.bloecke.filter((b) => b.haelfte === 'unten').map((b) => b.scharnier), ['links', 'rechts'], 'Doppeltür: Scharniere außen');
  // Drehen um 90° über den Vermesser dreht Treppen und Türen mit
  const gedreht = e0.vermesser.drehe(welt.ausschnitt({ x: -10, y: 0, z: -10 }, { x: 30, y: 20, z: 10 }), 1);
  for (const b of treppe.bloecke) {
    const g = gedreht.bloecke.find((x) => x.id === 'minecraft:stone_stairs' && x.y === b.y);
    assert.equal(e0.vermesser.richtungVon('weirdo_direction', g.zustand.weirdo_direction), IM_UHRZEIGER[b.richtung], `Stufe ${b.y}`);
  }
  const gt = gedreht.bloecke.find((x) => x.id === 'minecraft:wooden_door');
  assert.equal(gt.zustand['minecraft:cardinal_direction'], IM_UHRZEIGER.north);
  // Palette ohne die Form → klarer Fehler
  assert.throws(() => e2.platziere(e0.neueWelt(), treppe, { boden: STEIN }), /Form "treppe"/);

  // Fenster: Öffnung lückenlos mit Rahmen und Scheiben gefüllt
  for (const [breite, hoehe, rahmen] of [[1, 1, 0], [3, 2, 1], [4, 5, 2], [7, 3, 1]]) {
    const p = e2.baue('bau.fenster', { breite, hoehe, rahmen });
    const Bw = breite + 2 * rahmen, Hw = hoehe + 2 * rahmen;
    assert.equal(p.bloecke.length, Bw * Hw, `Fenster ${breite}×${hoehe}/${rahmen}: lückenlos`);
    assert.equal(p.bloecke.filter((b) => b.rolle === 'glas').length, breite * hoehe);
    assert.ok(p.bloecke.filter((b) => b.rolle === 'glas').every((b) => b.form === 'scheibe'));
    assert.equal(p.bloecke.filter((b) => b.rolle === 'akzent').length, Bw * Hw - breite * hoehe);
    assert.equal(symmetrisch(indexMenge(p, Bw, 1), Bw, Hw, 1), null);
    const w = e0.neueWelt();
    e2.platziere(w, p, TESTPALETTE);
    assert.equal(w.leseBlock(0, rahmen, 0).id, rahmen === 0 && breite % 2 === 0 ? w.leseBlock(0, rahmen, 0).id : 'minecraft:glass_pane');
    assert.deepEqual(verstoesse(w), []);
  }
  assert.throws(() => e2.baue('bau.fenster', { rahmen: 9 }), /außerhalb/);

  // Säule: symmetrisch, Schaft = Zylinder, Sockel und Kapitell folgen der Proportion
  for (const d of [1, 2, 3, 4, 7, 8, 15]) for (const H of [3, 4, 10, 30, 100]) {
    const p = e2.baue('bau.saeule', { durchmesser: d, hoehe: H });
    const Bs = d + 2;
    assert.equal(p.platzbedarf.huelle.bis.y + 1, H, `Säule d=${d} H=${H}: Höhe`);
    assert.equal(symmetrisch(indexMenge(p, Bs, Bs), Bs, H, Bs, { drehen: true }), null, `Säule d=${d} H=${H}`);
    const s = Math.max(1, Math.round(H * 0.1));
    assert.ok(Math.abs(s - H * 0.1) <= 1);
    const rollen = (y) => new Set(p.bloecke.filter((b) => b.y === y).map((b) => b.rolle));
    for (let y = 0; y < H; y++) assert.deepEqual([...rollen(y)], [y < s || y >= H - s ? 'akzent' : 'wand'], `Säule d=${d} H=${H} Schicht ${y}`);
    const zyl = (breite, y) => e2.baue('form.zylinder', { breite, tiefe: breite, hoehe: 1, wandstaerke: 0 }).bloecke.map((b) => `${b.x},${b.z}`).sort().join(';') === p.bloecke.filter((b) => b.y === y).map((b) => `${b.x},${b.z}`).sort().join(';');
    assert.ok(zyl(d + 2, 0) && zyl(d, s) && zyl(d + 2, H - 1), `Säule d=${d} H=${H}: Schichten sind Zylinder`);
  }
});

// Hilfsfunktion: platziere ohne ebene0 (für den Fehlerfall)
import { platziere as platziereOhne } from '../../src/ebene2/baustein.js';
function require_platziere(w, paket) { platziereOhne(w, paket, TESTPALETTE); }
