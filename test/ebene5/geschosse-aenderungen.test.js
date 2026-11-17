// D4.3: manuelle Einzelblockänderungen beim Ein- und Ausschalten der Geschosse und beim Wechsel der Treppenform: nichts verschwindet still.
//  - Eine Änderung in einer Deckenöffnung (Freihaltung der Treppe) ist ein Konflikt: sie bleibt gespeichert, die Planung wartet auf Jonahs Entscheidung; ohne Geschosse wirkt sie wieder.
//  - Eine Änderung an einer Deckenzelle des Glieds (Fußboden) wirkt; schaltet man die Geschosse ab, bleibt sie gespeichert (die Zelle liegt wieder im leeren Innenraum).
//  - Eine Änderung an einer Treppenstufe (Kind) wird beim Abschalten verwaist gemeldet: die Planung wartet, Jonah entscheidet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';

const spec = (merkmale) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D4', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', ...(merkmale ? { merkmale } : {}), form: { groesse: { breite: 13, tiefe: 13, hoehe: 34 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }],
});
const MIT = { eingang: 'sued', geschosse: 'standard', treppe: 'wendel' };
const pf = (teil, zelle, id) => PF.wende(PF.leer(), [{ teil, zelle, erwartet: null, neu: { op: 'setze', block: { id } } }], 'Jonah').planfassung;
const aus = async (s, planfassung) => {
  const e = await engine();
  const r = bauePlan(e, e.ebene4.freigeben(s, 'test'), [], planfassung);
  return { e, r, plan: r.entwurf ? e.e5.bauplan(r.entwurf) : null };
};
const GLAS = 'minecraft:glass';
/** Zelle im Rahmen des Glieds (Ecke Nordwest unten der Blöcke) aus einer Paketkoordinate. */
const rahmen = (e, teil, x, y, z) => {
  const bl = e.ebene2.baue(teil.baustein, { ...teil.parameter }).bloecke;
  return { x: x - Math.min(...bl.map((b) => b.x)), y: y - Math.min(...bl.map((b) => b.y)), z: z - Math.min(...bl.map((b) => b.z)) };
};

test('Änderung in der Deckenöffnung der Treppe: Konflikt, die Planung wartet; sie bleibt gespeichert und wirkt wieder ohne Geschosse', async () => {
  const mit = await aus(spec(MIT));
  assert.equal(mit.r.status, 'fertig', JSON.stringify(mit.r.rueckfragen ?? ''));
  const glied = mit.r.entwurf.teile.find((p) => p.parameter?.deckenLoecher?.length);
  const [j, x, z] = glied.parameter.deckenLoecher[0].split(',').map(Number);
  const zelle = rahmen(mit.e, glied, x, j, z);
  const f = pf(glied.ref, zelle, GLAS);
  const konflikt = await aus(spec(MIT), f);
  assert.equal(konflikt.r.status, 'wartet', 'ein Block in der Öffnung würde die Treppe versperren: Jonah entscheidet');
  const a = konflikt.plan.aenderungen[0];
  assert.deepEqual([a.teil, a.status], [glied.ref, 'konflikt']);
  assert.deepEqual(a.zelle, zelle, 'bleibt gespeichert');
  assert.ok(a.rueckfrage.optionen.some((o) => o.id === 'verwerfen'));
  // ohne Geschosse: die Zelle liegt im leeren Innenraum, die Änderung ist nicht verloren
  const ohne = await aus(spec({ eingang: 'sued' }), f);
  assert.equal(ohne.plan.aenderungen.length, 1, 'die Änderung bleibt gespeichert');
  assert.notEqual(ohne.plan.aenderungen[0].status, 'konflikt');
});

test('Änderung an einer Deckenzelle (Fußboden): wirkt; die Geschosse abzuschalten verwirft sie nie still', async () => {
  const mit = await aus(spec(MIT));
  const glied = mit.r.entwurf.teile.find((p) => p.parameter?.deckenAnzahl > 0);
  const bl = mit.e.ebene2.baue(glied.baustein, { ...glied.parameter }).bloecke.filter((b) => b.rolle === 'boden');
  const fussboden = bl.find((b) => !glied.parameter.deckenLoecher.includes(`${b.y},${b.x},${b.z}`));
  const zelle = rahmen(mit.e, glied, fussboden.x, fussboden.y, fussboden.z);
  const f = pf(glied.ref, zelle, GLAS);
  const an = await aus(spec(MIT), f);
  assert.equal(an.r.status, 'fertig', JSON.stringify(an.r.rueckfragen ?? ''));
  assert.deepEqual([an.plan.aenderungen[0].teil, an.plan.aenderungen[0].status], [glied.ref, 'angewandt']);
  assert.ok((an.plan.summe[GLAS] ?? 0) >= 1);
  const aus2 = await aus(spec({ eingang: 'sued' }), f);
  assert.equal(aus2.plan.aenderungen.length, 1, 'ohne Geschosse bleibt die Änderung gespeichert und sichtbar');
});

test('Änderung an einer Treppenstufe: wirkt, beim Abschalten der Geschosse oder Wechsel der Form wird sie verwaist gemeldet (die Planung wartet)', async () => {
  const mit = await aus(spec(MIT));
  const stufe = mit.r.entwurf.teile.find((p) => /^turm\.treppe-wendel-1-/.test(p.ref ?? ''));
  assert.ok(stufe);
  const f = pf(stufe.ref, { x: 0, y: 0, z: 0 }, GLAS);
  const an = await aus(spec(MIT), f);
  assert.deepEqual([an.plan.aenderungen[0].teil, an.plan.aenderungen[0].status], [stufe.ref, 'angewandt']);
  for (const merkmale of [{ eingang: 'sued' }, { eingang: 'sued', geschosse: 'standard', treppe: 'gerade' }]) {
    const weg = await aus(spec(merkmale), f);
    assert.equal(weg.r.status, 'wartet', JSON.stringify(merkmale));
    assert.deepEqual([weg.plan.aenderungen[0].teil, weg.plan.aenderungen[0].status], [stufe.ref, 'verwaist']);
    assert.ok(weg.plan.aenderungen[0].rueckfrage.optionen.some((o) => o.id === 'verwerfen'));
    assert.equal(weg.r.rueckfragen.filter((q) => q.art === 'aenderung').length, 1);
  }
});

test('Änderungen am Eingang und am Fenster bleiben mit Geschossen erhalten (Kennungen unverändert)', async () => {
  const ohneG = await aus(spec({ eingang: 'sued', fenster: 'schlitze' }));
  const eingang = ohneG.r.entwurf.teile.find((p) => p.ref === 'turm.eingang');
  const f = pf(eingang.ref, { x: 0, y: 0, z: 0 }, GLAS);
  const vorher = await aus(spec({ eingang: 'sued', fenster: 'schlitze' }), f);
  assert.deepEqual([vorher.plan.aenderungen[0].teil, vorher.plan.aenderungen[0].status], ['turm.eingang', 'angewandt']);
  const nachher = await aus(spec({ eingang: 'sued', fenster: 'schlitze', geschosse: 'standard' }), f);
  assert.equal(nachher.r.status, 'fertig', JSON.stringify(nachher.r.rueckfragen ?? ''));
  assert.deepEqual([nachher.plan.aenderungen[0].teil, nachher.plan.aenderungen[0].status], ['turm.eingang', 'angewandt']);
});
