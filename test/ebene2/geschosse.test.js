// D4.1 (Ebene 2): Geschossdecken in Zylinder und Kegel, Innenzone, Wendeltreppen-Stück mit Aussparung, interne Leiter. Ohne die internen Parameter ändert sich nichts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from '../ebene5/hilfe5.js';

const k = (b) => `${b.x},${b.y},${b.z}`;
const GROESSEN = [[9, 9], [13, 13], [12, 12], [21, 16], [16, 21], [31, 31]];

test('Standardwerte: Zylinder, Kegel und Wendeltreppe bauen genau dasselbe wie vor D4 (keine Zonen, keine Aussparungen)', async () => {
  const { ebene2 } = await engine();
  for (const [B, T] of GROESSEN) {
    const roh = ebene2.baue('form.zylinder', { breite: B, tiefe: T, hoehe: 20, wandstaerke: 2 });
    const mit0 = ebene2.baue('form.zylinder', { breite: B, tiefe: T, hoehe: 20, wandstaerke: 2, deckenAnzahl: 0, innenzone: 0 });
    assert.deepEqual(mit0, roh);
    assert.equal(roh.einbauzonen, undefined);
    const kegel = ebene2.baue('form.kegel', { breite: B, tiefe: T, hoehe: 12, wandstaerke: 2 });
    assert.equal(kegel.einbauzonen, undefined);
  }
  const w = ebene2.baue('bau.wendeltreppe', { radius: 2, stufen: 10 });
  assert.equal(w.aussparungen, undefined);
  assert.deepEqual(ebene2.baue('bau.wendeltreppe', { radius: 2, stufen: 10, start: 0, aussparung: 0 }), w);
});

test('Decken: die Schicht ist ganz gefüllt (Wand bleibt Wand, innen Rolle boden), alle anderen Schichten bleiben gleich', async () => {
  const { ebene2 } = await engine();
  for (const [B, T] of GROESSEN) for (const form of ['form.zylinder', 'form.kegel']) {
    const H = form === 'form.zylinder' ? 24 : 14;
    const basis = { breite: B, tiefe: T, hoehe: H, wandstaerke: 2 };
    const ohne = ebene2.baue(form, basis);
    const mit = ebene2.baue(form, { ...basis, deckenAnzahl: 3, deckenErste: 4, deckenAbstand: 5 });
    const massiv = ebene2.baue(form, { ...basis, wandstaerke: 0 }); // massiver Körper: dessen Schicht ist die ganze Fläche
    const decken = [4, 9, 14].filter((j) => j < H);
    const vorher = new Map(ohne.bloecke.map((b) => [k(b), b]));
    for (const b of ohne.bloecke) assert.ok(mit.bloecke.some((c) => k(c) === k(b) && c.rolle === b.rolle) || decken.includes(b.y), `${form} ${B}×${T}: ${k(b)} blieb nicht erhalten`);
    for (const j of decken) {
      const schicht = mit.bloecke.filter((b) => b.y === j), erwartet = massiv.bloecke.filter((b) => b.y === j);
      assert.deepEqual(new Set(schicht.map(k)), new Set(erwartet.map(k)), `${form} ${B}×${T} Schicht ${j}: genau die Querschnittsfläche`);
      for (const b of schicht) assert.equal(b.rolle, vorher.has(k(b)) ? vorher.get(k(b)).rolle : 'boden', `${k(b)}: Wand bleibt, Innenfläche ist Boden`);
    }
    // Die Blöcke außerhalb der Deckenschichten sind genau die vorherigen
    assert.deepEqual(mit.bloecke.filter((b) => !decken.includes(b.y)), ohne.bloecke.filter((b) => !decken.includes(b.y)));
  }
});

test('Decken: eine Decke liegt flächig an der Wand (jede Schicht ist zusammenhängend, 4er-Nachbarschaft)', async () => {
  const { ebene2 } = await engine();
  for (const [B, T] of GROESSEN) {
    const p = ebene2.baue('form.zylinder', { breite: B, tiefe: T, hoehe: 12, wandstaerke: 2, deckenAnzahl: 2, deckenErste: 3, deckenAbstand: 5 });
    for (const j of [3, 8]) {
      const zellen = new Map(p.bloecke.filter((b) => b.y === j).map((b) => [`${b.x},${b.z}`, b]));
      const start = zellen.values().next().value, gesehen = new Set([`${start.x},${start.z}`]), st = [start];
      while (st.length) { const c = st.pop(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = `${c.x + dx},${c.z + dz}`; if (zellen.has(n) && !gesehen.has(n)) { gesehen.add(n); st.push(zellen.get(n)); } } }
      assert.equal(gesehen.size, zellen.size, `${B}×${T} Schicht ${j}`);
    }
  }
});

test('Decken: Schichten außerhalb der Höhe werden ignoriert, die Zahl begrenzt, der Abstand wirkt', async () => {
  const { ebene2 } = await engine();
  const p = ebene2.baue('form.zylinder', { breite: 9, tiefe: 9, hoehe: 10, wandstaerke: 2, deckenAnzahl: 5, deckenErste: 2, deckenAbstand: 4 });
  const innen = (j) => p.bloecke.filter((b) => b.y === j && b.rolle === 'boden').length;
  assert.deepEqual([2, 6, 10].map(innen), [25, 25, 0], 'Schicht 10 liegt außerhalb der Höhe (0..9)');
  assert.deepEqual([3, 4, 5].map(innen), [0, 0, 0]);
});

test('Innenzone: der Innenraum als ganzer Querschnitt, für Zylinder und Kegel, nur auf Wunsch', async () => {
  const { ebene2 } = await engine();
  for (const form of ['form.zylinder', 'form.kegel']) for (const [B, T] of GROESSEN) {
    const p = ebene2.baue(form, { breite: B, tiefe: T, hoehe: 12, wandstaerke: 2, innenzone: 1 });
    const z = p.einbauzonen.find((q) => q.id === 'innenraum');
    assert.equal(z.art, 'innenraum');
    const xs = p.bloecke.map((b) => b.x), zs = p.bloecke.map((b) => b.z);
    assert.deepEqual([z.von.x, z.bis.x, z.von.z, z.bis.z], [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  }
  // zusammen mit den Wandzonen: beide vorhanden, Reihenfolge Wände, dann Innenraum
  const beides = ebene2.baue('form.zylinder', { breite: 13, tiefe: 13, hoehe: 8, wandstaerke: 2, wandzonen: 1, innenzone: 1 });
  assert.deepEqual(beides.einbauzonen.map((q) => q.id), ['wand-nord', 'wand-ost', 'wand-sued', 'wand-west', 'innenraum']);
});

test('Wendeltreppe als Stück: start verschiebt die erste Stufe auf dem Ring, aussparung meldet Stufe und 3 Zellen Kopffreiheit', async () => {
  const { ebene2 } = await engine();
  const ganz = ebene2.baue('bau.wendeltreppe', { radius: 3, stufen: 12 });
  const stueck = ebene2.baue('bau.wendeltreppe', { radius: 3, stufen: 5, start: 5, aussparung: 1 });
  assert.deepEqual(stueck.bloecke.map((b) => [b.x, b.z, b.richtung]), ganz.bloecke.slice(5, 10).map((b) => [b.x, b.z, b.richtung]), 'Stufen 5 bis 9 der ganzen Treppe');
  assert.deepEqual(stueck.bloecke.map((b) => b.y), [0, 1, 2, 3, 4], 'das Stück beginnt auf Höhe 0');
  const arten = stueck.aussparungen.map((a) => a.art);
  assert.deepEqual(arten, ['oeffnung', 'freihaltung', 'oeffnung', 'freihaltung', 'oeffnung', 'freihaltung', 'oeffnung', 'freihaltung', 'oeffnung', 'freihaltung']);
  stueck.bloecke.forEach((b, s) => {
    const o = stueck.aussparungen[2 * s], f = stueck.aussparungen[2 * s + 1];
    assert.deepEqual([o.von, o.bis], [{ x: b.x, y: s, z: b.z }, { x: b.x, y: s, z: b.z }]);
    assert.deepEqual([f.von, f.bis], [{ x: b.x, y: s + 1, z: b.z }, { x: b.x, y: s + 3, z: b.z }]);
  });
});

test('Leiter: fester Technikblock, ein Block breit, Aussparung je Leiterblock; interner Baustein (Leser und Oberfläche sehen ihn nicht)', async () => {
  const e = await engine();
  const p = e.ebene2.baue('bau.leiter', { hoehe: 6 });
  assert.equal(p.bloecke.length, 6);
  assert.ok(p.bloecke.every((b, y) => b.technik === true && b.id === 'minecraft:ladder' && b.y === y && b.x === 0 && b.z === 0 && b.zustand.facing_direction === 2));
  assert.equal(p.aussparungen.length, 6);
  assert.ok(!e.ebene4.vokabular.bausteine.some((b) => b.id === 'bau.leiter'), 'nicht im Vokabular');
  assert.doesNotMatch(e.ebene4.briefing(), /bau\.leiter/);
  assert.ok(!e.ebene4.vokabular.bausteine.some((b) => b.parameter.some((q) => ['innenzone', 'deckenAnzahl', 'deckenErste', 'deckenAbstand', 'start', 'aussparung'].includes(q.name))), 'interne Parameter bleiben verborgen');
});
