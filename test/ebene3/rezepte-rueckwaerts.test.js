// D2.1 Rückwärtskompatibilität: OHNE das Feld `rezept` bleibt die Planung byte-identisch zum Stand vor D2 (main, fc950a8).
// Die Abdrücke (SHA-256 über JSON, 16 Zeichen) wurden auf dem unveränderten Stand gemessen (zweimal gleich); sie dürfen nur bei einer bewussten Änderung der Planung ohne Rezept ersetzt werden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { entwurfZuJson, berichtAlsText } from '../../src/ebene3/index.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import { engine } from '../ebene5/hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';

const hash = (x) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const turm = (b, t, h, stil) => ({ schema: 1, version: 1, projekt: { name: 'Turm', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 }, teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', form: { baustein: 'form.zylinder', groesse: { breite: b, tiefe: t, hoehe: h } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: stil } }] });

async function abdruck(spec) {
  const e = await engine();
  const r = bauePlan(e, e.ebene4.freigeben(spec, 'basis'), []);
  const plan = e.e5.bauplan(r.entwurf);
  return { entwurf: hash(entwurfZuJson(r.entwurf)), plan: hash(JSON.stringify(plan)), material: hash(JSON.stringify(e.e5.material(plan))), bericht: hash(berichtAlsText(r.entwurf)) };
}

const FAELLE = [
  ['Turm 13×13×34 hell-nordisch', () => turm(13, 13, 34, 'hell-nordisch'), { entwurf: 'cc40b54ed16a5fc2', plan: '7c7066a27218d83d', material: 'a82a3f53cb58fcc4', bericht: '00c59d2fc3f412e8' }],
  ['Turm 9×9×20 glanz', () => turm(9, 9, 20, 'glanz'), { entwurf: 'e3d923449c2a6ad6', plan: 'be690336dd265729', material: 'f064b2c0830db7dd', bericht: '00c59d2fc3f412e8' }],
  ['Turm 21×15×40 dunkel-industriell', () => turm(21, 15, 40, 'dunkel-industriell'), { entwurf: 'e11b02da1aed1b9b', plan: '961b135b83bebbb8', material: '00b252e1308c77de', bericht: '00c59d2fc3f412e8' }],
  ['Haus klein', () => hausSpezifikation(VARIANTEN.klein, {}), { entwurf: '0c661e8975cf8eef', plan: 'd44ef86c02905501', material: '572e2516dce486a0', bericht: 'ee8439587a25c46a' }],
  ['Haus mittel', () => hausSpezifikation(VARIANTEN.mittel, {}), { entwurf: '1f331eceb94c250a', plan: '412e0f9104c6d459', material: 'f8841cfc7a709c97', bericht: '77aa3a49d6cdb601' }],
  ['Haus groß', () => hausSpezifikation(VARIANTEN.gross, {}), { entwurf: 'cb9264510de4e24d', plan: '87166dcc69c9a9f4', material: 'cf607de2bd57b726', bericht: '0c876c6ecb323f59' }],
];

for (const [name, spec, soll] of FAELLE) {
  test(`Rückwärtskompatibilität: ${name} ohne rezept byte-identisch zu main`, async () => {
    assert.deepEqual(await abdruck(spec()), soll);
  });
}

test('Rückwärtskompatibilität: ein Rezept-Turm ändert die Planung eines Teils ohne Rezept im selben Entwurf nicht', async () => {
  const e = await engine();
  const roh = turm(13, 13, 34, 'hell-nordisch');
  // zweites Teil mit Rezept, gleiche Stimmung (die Palette gilt für das ganze Projekt); es steht rechts vom Rohr
  const zwei = structuredClone(roh);
  zwei.teile.push({ id: 'turm2', name: 'Turm 2', art: 'turm', wichtigkeit: 'soll', rezept: 'turm', form: { groesse: { breite: 11, tiefe: 11, hoehe: 24 } }, lage: { bezug: 'turm', relation: 'neben-osten', abstand: 4 }, stil: { stimmung: 'hell-nordisch' } });
  const ohne = bauePlan(e, e.ebene4.freigeben(roh, 'basis'), []);
  const mit = bauePlan(e, e.ebene4.freigeben(zwei, 'basis'), []);
  assert.equal(mit.status, 'fertig', JSON.stringify(mit.rueckfragen ?? mit.fehler ?? ''));
  const teile = (r, ref) => r.entwurf.teile.filter((t) => t.ref === ref).map((t) => ({ baustein: t.baustein, parameter: t.parameter, ...(t.rollen ? { rollen: t.rollen } : {}) }));
  assert.deepEqual(teile(mit, 'turm'), teile(ohne, 'turm'));
  assert.ok(mit.entwurf.teile.some((t) => t.ref === 'turm2.sockel'), 'das Rezept-Teil besteht aus Gliedern');
});

test('Determinismus: zweimal planen = gleicher Entwurf, auch mit Rezept', async () => {
  const e = await engine();
  const spec = { schema: 1, version: 1, projekt: { name: 'T', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 }, teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', form: { groesse: { breite: 21, tiefe: 15, hoehe: 40 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }] };
  const a = bauePlan(e, e.ebene4.freigeben(structuredClone(spec), 'basis'), []);
  const b = bauePlan(e, e.ebene4.freigeben(structuredClone(spec), 'basis'), []);
  assert.equal(a.status, 'fertig');
  assert.equal(entwurfZuJson(a.entwurf), entwurfZuJson(b.entwurf));
});
