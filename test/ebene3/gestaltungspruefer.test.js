// Gestaltungsprüfer (D1): Handrechen-Beispiele, Determinismus, Unveränderlichkeit der Eingabe, Turm-Befund und Basiswerte (Golden-Datei) über die echte Pipeline.
// Die Golden-Datei wird nur mit BLOCKWERK_BASIS_NEU=1 neu geschrieben, sonst vergleicht der Test exakt.
// (Der Dateiname weicht von „gestaltung.test.js“ ab: diese Datei gehört schon dem Designer-Test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { messeGestaltung, bloeckeAusEntwurf } from '../../src/ebene3/index.js';
import { engine } from '../ebene5/hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';

const STEIN = 'minecraft:stone', GLAS = 'minecraft:glass_pane';
const quader = (b, h, t, id = STEIN, x0 = 0, y0 = 0, z0 = 0) => {
  const l = [];
  for (let x = 0; x < b; x++) for (let y = 0; y < h; y++) for (let z = 0; z < t; z++) l.push({ x: x + x0, y: y + y0, z: z + z0, id });
  return l;
};
/** Hohler Kasten mit Boden und Decke (Wände, Boden y=0, Decke y=h-1). */
const kasten = (b, h, t, { decke = true, boden = true } = {}) => quader(b, h, t).filter((c) => c.x === 0 || c.x === b - 1 || c.z === 0 || c.z === t - 1 || (boden && c.y === 0) || (decke && c.y === h - 1));
const gefroren = (l) => { l.forEach(Object.freeze); return Object.freeze(l); };

test('Würfel 3×3×3 (voll): Maße, Material, Silhouette, glatte Fläche, kein Raum', () => {
  const m = messeGestaltung(quader(3, 3, 3));
  assert.deepEqual(m.maße, { von: { x: 0, y: 0, z: 0 }, bis: { x: 2, y: 2, z: 2 }, breite: 3, tiefe: 3, hoehe: 3, anzahlBloecke: 27 });
  assert.deepEqual(m.materialien, { anzahlVerschieden: 1, haeufigkeit: [{ id: STEIN, anzahl: 27 }] });
  assert.equal(m.silhouette.verschiedeneQuerschnitte, 1);
  assert.equal(m.silhouette.gleichDarunter, 1);
  assert.equal(m.silhouette.groessteAenderung, 0);
  assert.deepEqual(m.glatteFlaeche.max, { groesse: 9, richtung: 'nord', id: STEIN });
  assert.deepEqual(m.abschluss, { raumzellen: 0, hatBoden: null, hatDach: null });
  assert.equal(m.oeffnungen.fassadenzellen, 24); // Hülle 26 ohne die beiden Mitten von Boden und Decke (keine waagerechte Seite frei)
  assert.equal(m.oeffnungen.anteil, 0);
});

test('Wand mit Fenster: die Öffnung zerlegt die glatte Fläche und zählt als Öffnung', () => {
  // Wand 5×3 (x,y) bei z=0, Fenster (Glasscheibe) in der Mitte (x=2,y=1)
  const wand = quader(5, 3, 1).map((c) => (c.x === 2 && c.y === 1 ? { ...c, id: GLAS } : c));
  const m = messeGestaltung(wand);
  assert.equal(m.glatteFlaeche.jeRichtung.nord.groesse, 14); // Steine hängen rund um das Fenster zusammen
  assert.equal(m.glatteFlaeche.jeRichtung.sued.groesse, 14);
  assert.equal(m.glatteFlaeche.jeRichtung.west.groesse, 3); // Schmalseite x=0: eine Spalte aus drei Steinen
  assert.equal(m.oeffnungen.fassadenzellen, 15);
  assert.equal(m.oeffnungen.oeffnungszellen, 1);
  assert.equal(m.oeffnungen.anteil, 0.067);
  // bündig geteilte Fläche: eine Reihe Glas teilt die Wand in zwei Hälften
  const geteilt = quader(5, 3, 1).map((c) => (c.y === 1 ? { ...c, id: GLAS } : c));
  assert.equal(messeGestaltung(geteilt).glatteFlaeche.jeRichtung.nord.groesse, 5);
});

test('Rohr ohne Gliederung gegen gestuften Turm', () => {
  const rohr = quader(5, 8, 5);
  const stufen = [...quader(7, 2, 7), ...quader(5, 3, 5, STEIN, 1, 2, 1), ...quader(3, 3, 3, STEIN, 2, 5, 2)];
  const a = messeGestaltung(rohr).silhouette, b = messeGestaltung(stufen).silhouette;
  assert.equal(a.gleichDarunter, 1);
  assert.equal(a.verschiedeneQuerschnitte, 1);
  assert.equal(b.verschiedeneQuerschnitte, 3);
  assert.equal(b.groessteAenderung, 2);
  assert.equal(b.gleichDarunter, 0.714); // 8 Schichten, 7 Paare, 2 Sprünge → 5/7
});

test('Abschluss: Kasten mit Decke hat Boden und Dach, ohne Decke kein Dach, ohne Boden keinen Boden', () => {
  assert.deepEqual(messeGestaltung(kasten(5, 4, 5)).abschluss, { raumzellen: 18, hatBoden: true, hatDach: true });
  assert.equal(messeGestaltung(kasten(5, 4, 5, { decke: false })).abschluss.hatDach, false);
  assert.equal(messeGestaltung(kasten(5, 4, 5, { boden: false })).abschluss.hatBoden, false);
});

test('Außen und innen: ein Block im geschlossenen Hohlraum ist keine Fassade, bei offenem Dach schon', () => {
  const innen = { x: 2, y: 2, z: 2, id: GLAS };
  const zu = messeGestaltung([...kasten(5, 5, 5), innen]);
  assert.deepEqual([zu.oeffnungen.fassadenzellen, zu.oeffnungen.oeffnungszellen], [80, 0]); // nur die senkrechten Wände (5·5·5 − 3·3·5)
  assert.equal(zu.glatteFlaeche.max.groesse, 25);
  const offen = messeGestaltung([...kasten(5, 5, 5, { decke: false }), innen]);
  assert.deepEqual([offen.oeffnungen.fassadenzellen, offen.oeffnungen.oeffnungszellen], [81, 1]);
});

test('Leere Eingabe und Luft: Nullwerte, keine Ausnahme', () => {
  for (const l of [[], [{ x: 0, y: 0, z: 0, id: 'minecraft:air' }]]) {
    const m = messeGestaltung(l);
    assert.equal(m.maße.anzahlBloecke, 0);
    assert.equal(m.maße.von, null);
    assert.equal(m.glatteFlaeche.max.groesse, 0);
    assert.equal(m.abschluss.hatDach, null);
  }
});

test('Ungültige Blöcke und doppelte Zellen werden abgelehnt', () => {
  assert.throws(() => messeGestaltung([{ x: 0.5, y: 0, z: 0, id: STEIN }]), /ungültiger Block/);
  assert.throws(() => messeGestaltung([{ x: 0, y: 0, z: 0 }]), /ungültiger Block/);
  assert.throws(() => messeGestaltung([{ x: 0, y: 0, z: 0, id: STEIN }, { x: 0, y: 0, z: 0, id: GLAS }]), /doppelt/);
});

test('Leere ID: ungültiger Block, auch bei Doppelbelegung', () => {
  assert.throws(() => messeGestaltung([{ x: 0, y: 0, z: 0, id: '' }]), /ungültiger Block/);
  assert.throws(() => messeGestaltung([{ x: 0, y: 0, z: 0, id: '' }, { x: 0, y: 0, z: 0, id: STEIN }]), /ungültiger Block/);
});

test('Größengrenze: kontrollierter Fehler vor der Allokation, knapp darunter funktioniert es', () => {
  const zwei = (x, y, z) => [{ x: 0, y: 0, z: 0, id: STEIN }, { x, y, z, id: STEIN }];
  assert.throws(() => messeGestaltung(zwei(5000, 0, 0)), /Gestaltungsprüfer: Bauwerk zu groß/);
  assert.throws(() => messeGestaltung(zwei(1024, 0, 0)), /Bauwerk zu groß/); // Ausdehnung 1025
  assert.throws(() => messeGestaltung(zwei(259, 259, 259)), /Bauwerk zu groß/); // Raster 262³ > 16 Mio. (Flutfüllung zählt mit)
  assert.throws(() => messeGestaltung(zwei(Number.MAX_SAFE_INTEGER + 2, 0, 0)), /ungültiger Block/);
  assert.throws(() => messeGestaltung(zwei(2 ** 53, 0, 0)), /ungültiger Block/);
  assert.equal(messeGestaltung(zwei(1023, 0, 0)).maße.breite, 1024);
  assert.equal(messeGestaltung(zwei(100, 100, 100)).maße.anzahlBloecke, 2);
});

test('Deterministisch, Reihenfolge der Eingabe egal, Eingabe bleibt unverändert', () => {
  const l = kasten(6, 5, 4).map((c, i) => (i % 7 === 0 ? { ...c, id: GLAS } : c));
  const eingefroren = gefroren(l.map((c) => ({ ...c })));
  const kopie = JSON.stringify(eingefroren);
  const a = messeGestaltung(eingefroren);
  assert.deepEqual(messeGestaltung(eingefroren), a);
  assert.deepEqual(messeGestaltung([...eingefroren].reverse()), a);
  assert.deepEqual(messeGestaltung([...eingefroren].sort((p, q) => (p.id < q.id ? 1 : p.id > q.id ? -1 : q.x - p.x))), a);
  assert.equal(JSON.stringify(eingefroren), kopie);
});

// ---------- echte Pipeline ----------
const baue = async (spec) => {
  const e = await engine();
  const r = e.ebene4.baue(e.ebene4.freigeben(spec, 'test'));
  assert.equal(r.status, 'fertig');
  return bloeckeAusEntwurf(e.ebene3, r.entwurf);
};
const turmSpezifikation = () => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D1', bauplatz: { breite: 60, hoehe: 80, tiefe: 60 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', form: { baustein: 'form.zylinder', groesse: { breite: 13, tiefe: 13, hoehe: 34 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }],
});

test('Turm-Befund (Roadmap): 34 Schichten à 36 Blöcken, ein Material, kein Dach', async () => {
  const m = messeGestaltung(await baue(turmSpezifikation()));
  assert.equal(m.silhouette.schichten.length, 34);
  assert.ok(m.silhouette.schichten.every((s) => s.bloecke === 36));
  assert.equal(m.materialien.anzahlVerschieden, 1);
  assert.equal(m.abschluss.hatDach, false);
  assert.equal(m.silhouette.gleichDarunter, 1);
});

test('Basiswerte: Turm und Wohnhaus gegen die Golden-Datei', async () => {
  const gemessen = {
    turm: messeGestaltung(await baue(turmSpezifikation())),
    wohnhaus: messeGestaltung(await baue(hausSpezifikation(Object.values(VARIANTEN)[0], {}))),
  };
  const datei = new URL('./gestaltung-basis.json', import.meta.url);
  if (process.env.BLOCKWERK_BASIS_NEU === '1') writeFileSync(datei, `${JSON.stringify(gemessen, null, 1)}\n`);
  assert.deepEqual(JSON.parse(JSON.stringify(gemessen)), JSON.parse(readFileSync(datei, 'utf8')));
});
