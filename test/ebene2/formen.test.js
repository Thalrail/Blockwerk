import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { indexMenge, hat, zelle, symmetrisch, randAbweichung2D, leck, EPS } from './formhilfe.js';
import { definiere, param, platziere, TESTPALETTE, pruefePaket, ROLLEN } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const TOLERANZ = e1.regelwerk.parameter('formen.rundung', 'toleranz');

test('Bausteine: Paketform', () => {
  assert.equal(e2.bausteine.size, 20);
  for (const b of e2.bausteine.values()) {
    const p = b.erzeuge();
    pruefePaket(p);
    assert.ok(p.bloecke.length > 0, b.id);
    assert.ok(p.bloecke.every((x) => (x.technik === true ? typeof x.id === 'string' && !('rolle' in x) : ROLLEN.includes(x.rolle) && !('id' in x))), `${b.id}: Rollen, Technikblöcke nur mit technik: true`);
    assert.ok(b.parameter.every((x) => ['geometrie', 'menschenmass', 'technik'].includes(x.groessenart)), b.id);
    assert.deepEqual(b.erzeuge(), p, `${b.id}: deterministisch`);
    assert.notEqual(p.status, 'geprüft', `${b.id}: nie von mir auf geprüft`);
    // Platzbedarf = tatsächliche Hülle
    const xs = p.bloecke.map((x) => x.x), ys = p.bloecke.map((x) => x.y), zs = p.bloecke.map((x) => x.z);
    assert.deepEqual(p.platzbedarf.huelle, { von: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) }, bis: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) } }, b.id);
    // Eingaben werden geprüft
    const zahl = b.parameter.find((x) => !x.liste && x.ganzzahl); // ein ganzzahliger Maßparameter (Listenparameter prüfen ihre Bausteine selbst)
    if (zahl) {
      assert.throws(() => b.erzeuge({ [zahl.name]: zahl.min - 1 }), /außerhalb/);
      assert.throws(() => b.erzeuge({ [zahl.name]: zahl.min + 0.5 }), /ganzzahlig/);
      assert.throws(() => b.erzeuge({ [zahl.name]: 100000 }), /außerhalb/);
      assert.throws(() => b.erzeuge({ [zahl.name]: 'x' }), /Zahl/);
    }
    assert.throws(() => b.erzeuge({ farbe: 1 }), /unbekannter Parameter/);
  }
  // Größenarten: Wandstärke ist Menschenmaß, Maße sind Geometrie
  const art = (id, name) => e2.bausteine.get(id).parameter.find((x) => x.name === name).groessenart;
  assert.deepEqual([art('form.zylinder', 'wandstaerke'), art('form.zylinder', 'hoehe'), art('form.kuppel', 'hoehenverhaeltnis')], ['menschenmass', 'geometrie', 'geometrie']);
  // Paket-Hilfsfunktionen
  assert.throws(() => param('x', 'riesig', { min: 0, max: 1, standard: 0, beschreibung: 'x' }), /Größenart/);
  assert.throws(() => param('x', 'geometrie', { min: 2, max: 1, standard: 1, beschreibung: 'x' }), /Bereich/);
  assert.throws(() => pruefePaket({ id: 'a' }), /fehlt/);
  assert.throws(() => e2.baue('form.gibtsnicht'), /Unbekannter Baustein/);
  const mitId = definiere({ id: 'form.kaputt', titel: 'k', quelle: 'https://example.org', parameter: [], testszenario: { start: 'a', erwartung: 'b' }, baue: () => ({ bloecke: [{ x: 0, y: 0, z: 0, rolle: 'wand', id: 'minecraft:stone' }] }) });
  assert.throws(() => mitId.erzeuge(), /Rollen, keine Block-IDs/);
  // Regeln: nichts von mir auf „geprüft“
  for (const r of e1.regelwerk.alle().filter((x) => x.id.startsWith('formen.'))) assert.equal(r.status, 'simuliert', r.id);
});

test('Bausteine: Platzieren über Ebene 0 und Prüfer (Testszenario)', () => {
  for (const b of e2.bausteine.values()) {
    const p = b.erzeuge();
    const w = e0.neueWelt();
    e2.platziere(w, p, TESTPALETTE, { x: 10, y: 5, z: -4 });
    assert.equal(w.anzahlBloecke(), p.bloecke.length, b.id);
    assert.deepEqual(e1.pruefe(w, { schienen: null }).filter((x) => x.schwere === 'verstoss'), [], `${b.id}: ${p.testszenario.erwartung}`);
  }
  const w = e0.neueWelt();
  assert.throws(() => platziere(w, e2.baue('form.scheibe'), { wand: 'minecraft:stone' }), /Rolle/);
  assert.equal(w.anzahlBloecke(), 0, 'beim Fehler vor dem ersten Block kein Rest');
});

test('Formen: Scheibe und Ellipse für alle Größen', () => {
  for (let d = 1; d <= 257; d++) {
    const p = e2.baue('form.scheibe', { breite: d, tiefe: d, wandstaerke: 0 });
    const m = indexMenge(p, d, d);
    assert.ok(m.size > 0, `d=${d}`);
    assert.equal(symmetrisch(m, d, 1, d, { drehen: true }), null, `Kreis d=${d}`);
    assert.ok(randAbweichung2D(m, d, d) <= TOLERANZ + EPS, `Kreis d=${d}: Abweichung ${randAbweichung2D(m, d, d)}`);
    // gerade und ungerade Durchmesser haben dieselbe Breite wie verlangt (keine schiefe Seite)
    const xs = p.bloecke.map((b) => b.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) + 1 <= d, `d=${d}`);
  }
  for (let d = 2; d <= 129; d++) {
    const t = Math.max(1, Math.floor(d * 0.6));
    const p = e2.baue('form.scheibe', { breite: d, tiefe: t, wandstaerke: 0 });
    const m = indexMenge(p, d, t);
    assert.equal(symmetrisch(m, d, 1, t), null, `Ellipse ${d}×${t}`);
    assert.ok(randAbweichung2D(m, d, t) <= TOLERANZ + EPS, `Ellipse ${d}×${t}: ${randAbweichung2D(m, d, t)}`);
  }
  // Ring (Wandstärke 1) ist geschlossen: von außen (4er-Nachbarschaft) gelangt man nicht ins Innere
  for (let d = 3; d <= 129; d++) {
    const ring = indexMenge(e2.baue('form.scheibe', { breite: d, tiefe: d, wandstaerke: 1 }), d, d);
    const innen = (x, j, z) => ((x - (d - 1) / 2) / (d / 2)) ** 2 + ((z - (d - 1) / 2) / (d / 2)) ** 2 <= 1;
    assert.equal(leck(ring, d, 1, d, innen, { flach: true }), null, `Ring d=${d}`);
    // ohne Ring-Zellen bleibt nichts außer Rand: jede Ringzelle grenzt an eine Zelle außerhalb der Scheibe
    const massiv = indexMenge(e2.baue('form.scheibe', { breite: d, tiefe: d, wandstaerke: 0 }), d, d).size; assert.ok(d <= 4 ? ring.size <= massiv : ring.size < massiv, `d=${d}`);
  }
  // Zwei Hülldicken sind zwei Ringe
  const dick = e2.baue('form.scheibe', { breite: 21, tiefe: 21, wandstaerke: 2 });
  assert.ok(dick.bloecke.length > e2.baue('form.scheibe', { breite: 21, tiefe: 21, wandstaerke: 1 }).bloecke.length);
});

test('Formen: Kugel, Zylinder, Kegel (Hülle und Symmetrie)', () => {
  const groessen = [...Array.from({ length: 40 }, (_, i) => i + 1), 63, 64, 100, 128, 129, 256];
  for (const d of groessen) {
    const p = e2.baue('form.kugel', { breite: d, tiefe: d, hoehe: d, wandstaerke: 1 });
    const m = indexMenge(p, d, d);
    assert.equal(symmetrisch(m, d, d, d, { drehen: true, hoehe: true }), null, `Kugel d=${d}`);
    // Unabhängige Rechnung der Regel: Blockmitte im Ideal, Hülle = Zellen mit Nachbar außerhalb
    const drin = (i, j, k) => {
      if (i < 0 || i >= d || j < 0 || j >= d || k < 0 || k >= d) return false;
      const x = i - (d - 1) / 2, y = j - (d - 1) / 2, z = k - (d - 1) / 2;
      return (x / (d / 2)) ** 2 + (y / (d / 2)) ** 2 + (z / (d / 2)) ** 2 <= 1;
    };
    const erwartet = new Set();
    for (let j = 0; j < d; j++) for (let k = 0; k < d; k++) for (let i = 0; i < d; i++) {
      if (drin(i, j, k) && !(drin(i - 1, j, k) && drin(i + 1, j, k) && drin(i, j - 1, k) && drin(i, j + 1, k) && drin(i, j, k - 1) && drin(i, j, k + 1))) erwartet.add(`${i},${j},${k}`);
    }
    assert.equal(m.size, erwartet.size, `Kugel d=${d}: Zahl der Blöcke`);
    for (const s of m) assert.ok(erwartet.has(s), `Kugel d=${d}: ${s}`);
    // Rand weicht senkrecht höchstens ½ Block vom Ideal ab
    let schlimmste = 0;
    for (let k = 0; k < d; k++) for (let i = 0; i < d; i++) {
      const x = i - (d - 1) / 2, z = k - (d - 1) / 2;
      const r = 1 - (x / (d / 2)) ** 2 - (z / (d / 2)) ** 2;
      if (r < 0) continue;
      const h = (d / 2) * Math.sqrt(r);
      let kante = 0;
      for (let j = 0; j < d; j++) if (hat(m, i, j, k)) kante = Math.max(kante, j - (d - 1) / 2 + 0.5);
      schlimmste = Math.max(schlimmste, Math.abs(kante - h));
    }
    assert.ok(schlimmste <= TOLERANZ + EPS, `Kugel d=${d}: Abweichung ${schlimmste}`);
    if (d <= 64) assert.equal(leck(m, d, d, d, (i, j, k) => drin(i, j, k)), null, `Kugel d=${d} wasserdicht`);
  }
  // Zylinder: jede Schicht gleich dem Ring der Scheibe, Rohr oben und unten offen
  for (let d = 1; d <= 129; d++) {
    const z = e2.baue('form.zylinder', { breite: d, tiefe: d, hoehe: 3, wandstaerke: 1 });
    const m = indexMenge(z, d, d);
    assert.equal(symmetrisch(m, d, 3, d, { drehen: true }), null, `Zylinder d=${d}`);
    const ring = e2.baue('form.scheibe', { breite: d, tiefe: d, wandstaerke: 1 });
    for (let j = 0; j < 3; j++) {
      const schicht = new Set([...m].filter((s) => zelle(s)[1] === j).map((s) => { const [i, , k] = zelle(s); return `${i},0,${k}`; }));
      assert.deepEqual([...schicht].sort(), [...indexMenge(ring, d, d)].sort(), `Zylinder d=${d} Schicht ${j}`);
    }
  }
  assert.deepEqual(e2.baue('form.zylinder', { wandstaerke: 1 }).anschluesse.map((a) => a.seite), ['unten', 'oben']);
  // Kegel: jede Schicht liegt in der darunter, symmetrisch, wasserdicht von außen
  for (let d = 1; d <= 129; d++) {
    const k = e2.baue('form.kegel', { breite: d, tiefe: d, hoehe: 9, wandstaerke: 0 });
    const m = indexMenge(k, d, d);
    assert.equal(symmetrisch(m, d, 9, d, { drehen: true }), null, `Kegel d=${d}`);
    for (const s of m) { const [i, j, q] = zelle(s); if (j > 0) assert.ok(hat(m, i, j - 1, q), `Kegel d=${d}: ${s} ohne Unterlage`); }
  }
  for (const d of [9, 21, 64]) {
    const m = indexMenge(e2.baue('form.kegel', { breite: d, tiefe: d, hoehe: 12, wandstaerke: 1 }), d, d);
    const drin = (i, j, k) => { const s = 1 - (j + 0.5) / 12; const x = i - (d - 1) / 2, z = k - (d - 1) / 2; return i >= 0 && i < d && k >= 0 && k < d && j >= 0 && j < 12 && s > 0 && (x / ((d / 2) * s)) ** 2 + (z / ((d / 2) * s)) ** 2 <= 1; };
    assert.equal(leck(m, d, 12, d, drin, { boden: true }), null, `Kegel d=${d} wasserdicht`);
  }
});

test('Formen: Kuppel und Proportionen', () => {
  const groessen = [...Array.from({ length: 62 }, (_, i) => i + 3), 100, 127, 128, 129, 200, 256, 257];
  for (const d of groessen) {
    const massiv = e2.baue('form.kuppel', { breite: d, tiefe: d, wandstaerke: 0 });
    const m = indexMenge(massiv, d, d);
    const hoehe = massiv.platzbedarf.huelle.bis.y + 1;
    // Proportion: Höhe = 0,5 × Radius = d / 4 (± 1 Schicht Rundung), für jede Größe
    assert.ok(Math.abs(hoehe - d / 4) <= 1, `d=${d}: Höhe ${hoehe}`);
    assert.equal(symmetrisch(m, d, hoehe, d, { drehen: true }), null, `Kuppel d=${d}`);
    if (d <= 100) {
      // Rand weicht senkrecht höchstens ½ Block vom Ideal ab
      const b = 0.5 * (d / 2);
      let schlimmste = 0;
      for (let k = 0; k < d; k++) for (let i = 0; i < d; i++) {
        const x = i - (d - 1) / 2, z = k - (d - 1) / 2;
        const r = 1 - (x / (d / 2)) ** 2 - (z / (d / 2)) ** 2;
        if (r < 0) continue;
        let kante = 0;
        for (let j = 0; j < hoehe; j++) if (hat(m, i, j, k)) kante = j + 1;
        schlimmste = Math.max(schlimmste, Math.abs(kante - b * Math.sqrt(r)));
      }
      assert.ok(schlimmste <= TOLERANZ + EPS, `Kuppel d=${d}: Abweichung ${schlimmste}`);
    }
  }
  // Hülle ist von außen dicht (Boden gesperrt), Boden bleibt offen
  for (const d of [3, 4, 9, 12, 21, 40]) {
    const p = e2.baue('form.kuppel', { breite: d, tiefe: d, wandstaerke: 1 });
    const hoehe = p.platzbedarf.huelle.bis.y + 1;
    const b = 0.5 * (d / 2);
    const drin = (i, j, k) => { const x = i - (d - 1) / 2, z = k - (d - 1) / 2; return i >= 0 && i < d && k >= 0 && k < d && (x / (d / 2)) ** 2 + (z / (d / 2)) ** 2 + ((j + 0.5) / b) ** 2 <= 1; };
    assert.equal(leck(indexMenge(p, d, d), d, hoehe, d, drin, { boden: true }), null, `Kuppel d=${d} wasserdicht`);
    assert.deepEqual(p.anschluesse, [{ art: 'oeffnung', seite: 'unten' }]);
  }
  // Proportion einstellbar: Halbkugel (1,0) ist doppelt so hoch wie die flache Kuppel (0,5)
  const flach = e2.baue('form.kuppel', { breite: 64, tiefe: 64, wandstaerke: 0 }).platzbedarf.huelle.bis.y + 1;
  const halb = e2.baue('form.kuppel', { breite: 64, tiefe: 64, hoehenverhaeltnis: 1, wandstaerke: 0 }).platzbedarf.huelle.bis.y + 1;
  assert.equal(halb, 2 * flach);
  // Skalierung: dieselbe Formel für r = 12, 20, 100
  for (const r of [12, 20, 100]) {
    const h = e2.baue('form.kuppel', { breite: 2 * r + 1, tiefe: 2 * r + 1, wandstaerke: 0 }).platzbedarf.huelle.bis.y + 1;
    assert.ok(Math.abs(h - 0.5 * (r + 0.5)) <= 1, `r=${r}: Höhe ${h}`);
  }
});

test('Formen: Drehen über den Vermesser und Platzbedarf', () => {
  const ellipse = e2.baue('form.scheibe', { breite: 7, tiefe: 5, wandstaerke: 0 });
  const w = e0.neueWelt();
  platziere(w, ellipse, TESTPALETTE);
  const gedreht = e0.vermesser.drehe(w.ausschnitt({ x: -10, y: 0, z: -10 }, { x: 10, y: 3, z: 10 }), 1);
  const soll = e2.baue('form.scheibe', { breite: 5, tiefe: 7, wandstaerke: 0 });
  assert.deepEqual(gedreht.bloecke.map((b) => `${b.x},${b.y},${b.z}`).sort(), soll.bloecke.map((b) => `${b.x},${b.y},${b.z}`).sort());
  // Verschieben ändert nur den Versatz, nicht die Form
  const w2 = e0.neueWelt();
  platziere(w2, ellipse, TESTPALETTE, { x: 100, y: 7, z: -50 });
  assert.equal(w2.anzahlBloecke(), ellipse.bloecke.length);
  assert.equal(w2.leseBlock(100, 7, -50).id, 'minecraft:stone');
});
