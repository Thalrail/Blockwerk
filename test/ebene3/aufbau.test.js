// Aufbau (Paket 1a): Messgröße `messeAufbau`, Handrechnen auf kleinen künstlichen Blocklisten und Rohr-Referenz über die echte Pipeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messeAufbau } from '../../src/ebene3/index.js';
import { bloeckeAusEntwurf } from '../../src/ebene3/index.js';
import { engine } from '../ebene5/hilfe5.js';

const S = 'minecraft:stone';
const b = (x, y, z) => ({ x, y, z, id: S });
/** Quader von (x0,y0,z0) bis ausschließlich (x1,y1,z1). */
const quader = (x0, y0, z0, x1, y1, z1) => {
  const l = [];
  for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) l.push(b(x, y, z));
  return l;
};
/** Ring (Rand eines Quadrats) der Seitenlänge n ab (x0,z0) in Schicht y. */
const ring = (x0, z0, n, y) => {
  const l = [];
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) if (x === 0 || z === 0 || x === n - 1 || z === n - 1) l.push(b(x0 + x, y, z0 + z));
  return l;
};
const hilfe = (m) => [m.hilfsmassnahmen.punkte, m.unverbunden.teile];

test('Würfel: keine Hilfsmaßnahme, kein Überhang, verbunden', () => {
  const m = messeAufbau(quader(0, 0, 0, 3, 3, 3));
  assert.deepEqual(m, { schichten: 3, bloecke: 27, unverbunden: { teile: 0, bloecke: 0, gruppen: [] }, ueberhang: { bloecke: 0 }, hilfsmassnahmen: { punkte: 0, bloecke: 0, diagonal: 0, frei: 0, schichten: [] } });
});

test('Mauer mit Fensteröffnung: 0 Hilfsmaßnahmen (Block über der Öffnung hängt seitlich)', () => {
  const l = quader(0, 0, 0, 5, 4, 1).filter((k) => !(k.x >= 1 && k.x <= 3 && k.y >= 1 && k.y <= 2));
  const m = messeAufbau(l);
  assert.deepEqual(hilfe(m), [0, 0]);
  // Schicht 3 liegt auf den Seiten auf, die Mitte über der Öffnung (x 1..3) hat nichts darunter: Überhang 3.
  assert.equal(m.ueberhang.bloecke, 3);
});

test('Ring nur diagonal auf kleinerem Ring: genau 1 Hilfspunkt, art diagonal', () => {
  const l = [...quader(0, 0, 0, 3, 1, 3), ...ring(-1, -1, 5, 1)];
  // Unterer Quader 3x3, Ring 5x5 darüber: Ring-Block (-1,1,-1) liegt diagonal über (0,0,0); kein Block direkt darunter, keiner im Ring setzbar.
  const m = messeAufbau(l);
  assert.equal(m.hilfsmassnahmen.punkte, 1);
  assert.equal(m.hilfsmassnahmen.diagonal, 1);
  assert.equal(m.hilfsmassnahmen.frei, 0);
  assert.equal(m.hilfsmassnahmen.bloecke, 16);
  assert.deepEqual(m.hilfsmassnahmen.schichten, [{ y: 1, gruppen: 1, bloecke: 16 }]);
  assert.equal(m.unverbunden.teile, 0);
});

test('frei schwebender Block: unverbunden und art frei', () => {
  const m = messeAufbau([...quader(0, 0, 0, 2, 1, 2), b(5, 3, 5)]);
  assert.deepEqual(m.unverbunden, { teile: 1, bloecke: 1, gruppen: [{ bloecke: 1, von: { x: 5, y: 3, z: 5 } }] });
  assert.equal(m.hilfsmassnahmen.punkte, 1);
  assert.equal(m.hilfsmassnahmen.frei, 1);
  assert.equal(m.hilfsmassnahmen.diagonal, 0);
});

test('legaler Überhang (Brücke seitlich von gestütztem Block): Überhang > 0, Hilfsmaßnahmen 0', () => {
  const l = [b(0, 0, 0), b(0, 1, 0), b(1, 1, 0), b(2, 1, 0), b(3, 1, 0)];
  const m = messeAufbau(l);
  assert.equal(m.ueberhang.bloecke, 3);
  assert.equal(m.hilfsmassnahmen.punkte, 0);
  assert.equal(m.unverbunden.teile, 0);
});

test('zwei getrennte Türme: der kleinere ist unverbunden, der Hauptteil ist der größere am Boden', () => {
  const m = messeAufbau([...quader(0, 0, 0, 1, 4, 1), ...quader(10, 0, 0, 11, 2, 1)]);
  assert.equal(m.unverbunden.teile, 1);
  assert.equal(m.unverbunden.bloecke, 2);
  assert.deepEqual(m.unverbunden.gruppen, [{ bloecke: 2, von: { x: 10, y: 0, z: 0 } }]);
  // Beide stehen auf dem Boden: kein Hilfspunkt (Bauabfolge), nur geometrisch getrennt.
  assert.equal(m.hilfsmassnahmen.punkte, 0);
});

test('Hauptteil: mehr Blöcke in der untersten Schicht gewinnt vor der Gesamtgröße', () => {
  // Turm A: 1 Block unten, 5 hoch; Platte B: 4 Blöcke unten.
  const m = messeAufbau([...quader(0, 0, 0, 1, 5, 1), ...quader(10, 0, 0, 12, 1, 2)]);
  assert.deepEqual(m.unverbunden.gruppen, [{ bloecke: 5, von: { x: 0, y: 0, z: 0 } }]);
});

test('eine Schicht mit mehreren Gruppen zählt Gruppen, nicht Blöcke', () => {
  // Boden 5x1x5 plus in Schicht 2 (y=2, y=1 leer): zwei Gruppen mit 3 und 1 Block, frei schwebend; Schicht 1 leer.
  const l = [...quader(0, 0, 0, 5, 1, 5), b(0, 2, 0), b(1, 2, 0), b(2, 2, 0), b(4, 2, 4)];
  const m = messeAufbau(l);
  assert.equal(m.hilfsmassnahmen.punkte, 2);
  assert.equal(m.hilfsmassnahmen.bloecke, 4);
  assert.deepEqual(m.hilfsmassnahmen.schichten, [{ y: 2, gruppen: 2, bloecke: 4 }]);
  assert.equal(m.unverbunden.teile, 2);
});

test('leere Eingabe und nur Luft', () => {
  const leer = { schichten: 0, bloecke: 0, unverbunden: { teile: 0, bloecke: 0, gruppen: [] }, ueberhang: { bloecke: 0 }, hilfsmassnahmen: { punkte: 0, bloecke: 0, diagonal: 0, frei: 0, schichten: [] } };
  assert.deepEqual(messeAufbau([]), leer);
  assert.deepEqual(messeAufbau([{ x: 0, y: 0, z: 0, id: 'minecraft:air' }]), leer);
});

test('ungültige Blöcke und zu große Ausdehnung: kontrollierter Fehler', () => {
  for (const x of [null, undefined, {}]) assert.throws(() => messeAufbau(x), /Blockliste muss ein Array sein/);
  assert.throws(() => messeAufbau([null]), /ungültiger Block/);
  assert.throws(() => messeAufbau([{ x: 0.5, y: 0, z: 0, id: S }]), /ungültiger Block/);
  assert.throws(() => messeAufbau([{ x: 0, y: 0, z: 0, id: '' }]), /ungültiger Block/);
  assert.throws(() => messeAufbau([b(0, 0, 0), b(0, 0, 0)]), /doppelt belegt/);
  assert.throws(() => messeAufbau([b(0, 0, 0), b(1024, 0, 0)]), /zu groß/);
  assert.throws(() => messeAufbau([b(0, 0, 0), b(1023, 1023, 1023)]), /zu groß/);
});

test('deterministisch (Reihenfolge egal) und Eingabe unverändert', () => {
  const l = [...quader(0, 0, 0, 3, 2, 3), ...ring(-1, -1, 5, 2), b(9, 9, 9)];
  const kopie = JSON.stringify(l);
  l.forEach((k) => Object.freeze(k)); Object.freeze(l);
  const m1 = messeAufbau(l);
  const m2 = messeAufbau([...l].reverse());
  assert.deepEqual(m1, m2);
  assert.equal(JSON.stringify(l), kopie);
});

// Echte Pipeline wie rezepte-vergleich.test.js
const spec = (breite, tiefe, hoehe, rezept) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm Aufbau', bauplatz: { breite: 80, hoehe: 130, tiefe: 80 }, massstab: 1 },
  teile: [{
    id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss',
    form: rezept ? { groesse: { breite, tiefe, hoehe } } : { baustein: 'form.zylinder', groesse: { breite, tiefe, hoehe } },
    ...(rezept ? { rezept: 'turm' } : {}),
    lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' },
  }],
});
async function messeTurm(breite, tiefe, hoehe, rezept) {
  const e = await engine();
  const r = e.ebene4.baue(e.ebene4.freigeben(spec(breite, tiefe, hoehe, rezept), 'test'));
  assert.equal(r.status, 'fertig', JSON.stringify(r.rueckfragen ?? ''));
  return messeAufbau(bloeckeAusEntwurf(e.ebene3, r.entwurf));
}

test('Rohr-Referenz (form.zylinder 13×13×34): 0 Hilfsmaßnahmen, 0 unverbunden', async () => {
  const m = await messeTurm(13, 13, 34);
  assert.equal(m.hilfsmassnahmen.punkte, 0);
  assert.equal(m.unverbunden.teile, 0);
  assert.ok(m.bloecke > 0);
});

test('Rezept-Turm: Messung läuft, Summen stimmig (keine Goldwerte)', async () => {
  const m = await messeTurm(13, 13, 34, true);
  const h = m.hilfsmassnahmen;
  assert.equal(h.punkte, h.diagonal + h.frei);
  assert.equal(h.punkte, h.schichten.reduce((s, k) => s + k.gruppen, 0));
  assert.ok(h.bloecke >= h.punkte);
  assert.ok(m.unverbunden.bloecke <= m.bloecke);
  assert.ok(m.ueberhang.bloecke <= m.bloecke);
});
