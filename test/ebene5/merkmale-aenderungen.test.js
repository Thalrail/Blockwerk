// D3: manuelle Einzelblockänderungen beim Ein- und Ausschalten der Merkmale (Eingang, Fenster): nichts verschwindet still.
//  - Eine Änderung an einer Wandzelle, die ein neues Fenster oder der Eingang aussparen, bleibt gespeichert und wird sichtbar als „überholt“ (ohne Wirkung) gemeldet; schaltet man das Merkmal ab, wirkt sie wieder.
//  - Eine Änderung am Eingang selbst (Kind-Kennung `turm.eingang`) wird beim Abschalten des Eingangs „verwaist“ gemeldet: die Planung wartet, Jonah entscheidet (verwerfen, verankern, zulassen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';

const spec = (merkmale) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D3', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', ...(merkmale ? { merkmale } : {}), form: { groesse: { breite: 13, tiefe: 13, hoehe: 34 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }],
});
const pf = (teil, zelle, id) => PF.wende(PF.leer(), [{ teil, zelle, erwartet: null, neu: { op: 'setze', block: { id } } }], 'Jonah').planfassung;
const aus = async (s, planfassung) => {
  const e = await engine();
  const r = bauePlan(e, e.ebene4.freigeben(s, 'test'), [], planfassung);
  return { e, r, plan: e.e5.bauplan(r.entwurf) };
};
const GLAS = 'minecraft:glass';
const SOCKEL_AUSSEN_SUED = { x: 6, y: 0, z: 12 }; // Sockel 13×13: Südmitte, äußerste Zelle (Rahmen der Hülle, Nordwest unten = 0): hier sitzt der Türblock
const DURCHGANG_SUED = { x: 6, y: 0, z: 11 }; // eine Zelle weiter innen: im Durchgang hinter der Tür (Wand, die der Eingang ausspart)

test('Änderung an einer Wandzelle im Durchgang des neuen Eingangs: Konflikt (Freihaltung), die Planung wartet; die Änderung bleibt gespeichert und wirkt wieder, wenn der Eingang abgeschaltet wird', async () => {
  const f = pf('turm.sockel', DURCHGANG_SUED, GLAS);
  const vorher = await aus(spec(), f);
  assert.equal(vorher.r.status, 'fertig');
  assert.deepEqual([vorher.plan.aenderungen[0].status, vorher.plan.aenderungen[0].block.id], ['angewandt', GLAS], 'ohne Eingang wirkt die Änderung');

  const mit = await aus(spec({ eingang: 'sued' }), f);
  assert.equal(mit.r.status, 'wartet', 'ein Block im Durchgang würde den Eingang zumauern: Jonah entscheidet');
  assert.equal(mit.plan.aenderungen.length, 1, 'die Änderung ist nicht verloren');
  const a = mit.plan.aenderungen[0];
  assert.deepEqual([a.teil, a.status], ['turm.sockel', 'konflikt']);
  assert.deepEqual(a.zelle, DURCHGANG_SUED, 'Zelle bleibt unverändert gespeichert');
  assert.ok(a.rueckfrage.optionen.some((o) => o.id === 'verwerfen'));

  const wieder = await aus(spec(), f);
  assert.equal(wieder.plan.aenderungen[0].status, 'angewandt', 'Eingang abgeschaltet: die Änderung wirkt wieder');
  assert.deepEqual(wieder.plan.summe, vorher.plan.summe);
});

test('Änderung genau an der Zelle des neuen Türblocks: Konflikt, die Planung wartet auf Jonahs Entscheidung (nie stilles Überschreiben)', async () => {
  const f = pf('turm.sockel', SOCKEL_AUSSEN_SUED, GLAS);
  assert.equal((await aus(spec(), f)).plan.aenderungen[0].status, 'angewandt');
  const mit = await aus(spec({ eingang: 'sued' }), f);
  assert.equal(mit.r.status, 'wartet');
  const a = mit.plan.aenderungen[0];
  assert.deepEqual([a.teil, a.status], ['turm.sockel', 'konflikt']);
  assert.deepEqual(a.zelle, SOCKEL_AUSSEN_SUED, 'bleibt gespeichert');
  assert.equal(mit.r.rueckfragen.filter((q) => q.art === 'aenderung').length, 1);
  assert.ok(a.rueckfrage.optionen.some((o) => o.id === 'verwerfen'), 'Jonah entscheidet');
});

test('Änderung am Eingang selbst: wirkt mit Eingang, wird beim Abschalten verwaist gemeldet; die Planung wartet, nichts wird still verworfen', async () => {
  const f = pf('turm.eingang', { x: 0, y: 0, z: 0 }, GLAS); // untere Türhälfte durch Glas ersetzt
  const mit = await aus(spec({ eingang: 'sued' }), f);
  assert.equal(mit.r.status, 'fertig', JSON.stringify(mit.r.rueckfragen ?? ''));
  assert.deepEqual([mit.plan.aenderungen[0].teil, mit.plan.aenderungen[0].status], ['turm.eingang', 'angewandt']);

  const ohne = await aus(spec(), f);
  assert.equal(ohne.r.status, 'wartet', 'ohne den Eingang gibt es das Teil nicht mehr: Rückfrage statt stillem Verlust');
  const v = ohne.plan.aenderungen[0];
  assert.deepEqual([v.teil, v.status], ['turm.eingang', 'verwaist']);
  assert.deepEqual(v.zelle, { x: 0, y: 0, z: 0 });
  assert.ok(v.rueckfrage.optionen.some((o) => o.id === 'verwerfen'));
  assert.equal(ohne.r.rueckfragen.filter((q) => q.art === 'aenderung').length, 1);
});

test('Änderung an einer Fensterzelle: bleibt nach Seitenwechsel des Eingangs und bei Größenänderung der Fenster erhalten oder wird verwaist gemeldet, nie still verworfen', async () => {
  const mit = await aus(spec({ eingang: 'sued', fenster: 'schlitze' }));
  const fenster = mit.r.entwurf.teile.find((p) => /^turm\.fenster-/.test(p.ref));
  assert.ok(fenster, 'ein Fenster existiert');
  const f = pf(fenster.ref, { x: 0, y: 0, z: 0 }, GLAS);
  const gleich = await aus(spec({ eingang: 'sued', fenster: 'schlitze' }), f);
  assert.equal(gleich.plan.aenderungen[0].status, 'angewandt');
  const ohneFenster = await aus(spec({ eingang: 'sued' }), f);
  assert.equal(ohneFenster.r.status, 'wartet');
  assert.equal(ohneFenster.plan.aenderungen[0].status, 'verwaist');
  assert.equal(ohneFenster.plan.aenderungen[0].teil, fenster.ref);
});
