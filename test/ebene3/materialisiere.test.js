import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { neuerEntwurf } from '../../src/ebene3/index.js';

const e3 = ebene3();
const huelle = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } });
const aendere = (e, wer, a) => e3.aendere(e, wer, a).entwurf;
const entwurf = (teile) => {
  let e = e3.konstrukteur.gliedere(neuerEntwurf({ name: 'Speicher' }), [{ id: 'A', name: 'A', huelle: huelle(0, 0, 0, 200, 40, 100) }]);
  for (const t of teile) e = aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A', baustein: 'form.zylinder', parameter: t.parameter, lage: { drehung: 0, ...t.lage } } });
  return e;
};
const zyl = (breite, hoehe, x) => ({ parameter: { breite, tiefe: breite, hoehe, wandstaerke: 1 }, lage: { x, y: 0, z: 10 } });
const bloecke = (e) => JSON.stringify(e3.materialisiere(e, { testmaterial: true }).welt.alleBloecke());

/** Zählt die Aufrufe von ebene2.baue (jeder Aufruf baut ein Teil neu). */
function zaehle(f) {
  const orig = e3.ebene2.baue; let n = 0;
  e3.ebene2.baue = (...a) => { n++; return orig(...a); };
  try { f(); } finally { e3.ebene2.baue = orig; }
  return n;
}

test('Materialisieren: unveränderte Teile werden nicht neu gebaut, geänderte schon; das Ergebnis bleibt gleich', () => {
  const a = entwurf([zyl(9, 6, 10), zyl(11, 8, 40)]);
  const kalt = bloecke(a); // füllt den Speicher
  assert.equal(zaehle(() => e3.materialisiere(a, { testmaterial: true })), 0, 'zweiter Durchlauf baut nichts neu');
  assert.equal(bloecke(a), kalt, 'gleiches Ergebnis aus dem Speicher');
  // ein Teil geändert (andere Höhe), eines gleich: nur das geänderte wird gebaut
  const b = entwurf([zyl(9, 6, 10), zyl(11, 9, 40)]);
  assert.equal(zaehle(() => e3.materialisiere(b, { testmaterial: true })), 1);
  assert.notEqual(bloecke(b), kalt);
  // andere Lage und andere Palette zählen als anderes Teil
  assert.equal(zaehle(() => e3.materialisiere(entwurf([zyl(9, 6, 12), zyl(11, 8, 40)]), { testmaterial: true })), 1, 'Lage');
  const palette = e3.designer.setzePalette(a, 'glanz');
  assert.equal(zaehle(() => e3.materialisiere(palette, { testmaterial: true })), 2, 'Palette');
  assert.notEqual(bloecke(palette), kalt);
  // wer die Welt aus dem Speicher verändert, stört spätere Läufe nicht
  const m = e3.materialisiere(a, { testmaterial: true });
  m.welt.setzeBlock(0, 0, 0, 'minecraft:gold_block');
  for (const t of m.teile.values()) { t.schluessel.clear?.(); }
  assert.equal(bloecke(a), kalt, 'Speicher blieb unberührt');
});

test('Materialisieren: der Speicher ist begrenzt (viele verschiedene Teile verdrängen die ältesten)', () => {
  for (let i = 0; i < 120; i++) e3.materialisiere(entwurf([zyl(5 + (i % 7), 4 + Math.floor(i / 7), 10 + (i % 5))]), { testmaterial: true });
  // das zuletzt gebaute Teil ist noch da, ein ganz altes wurde verdrängt
  const letzter = entwurf([zyl(5 + (119 % 7), 4 + Math.floor(119 / 7), 10 + (119 % 5))]);
  assert.equal(zaehle(() => e3.materialisiere(letzter, { testmaterial: true })), 0);
  const erster = entwurf([zyl(5, 4, 10)]);
  assert.equal(zaehle(() => e3.materialisiere(erster, { testmaterial: true })), 1);
});
