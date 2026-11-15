// D2 Bausteinrezepte, Regression: OHNE das Feld `rezept` bleibt die Planung byte-identisch (Spezifikation → Plan → Material → Bericht).
// Die Abdrücke (SHA-256, gekürzt) wurden VOR der Änderung vom unveränderten Stand gemessen: Entwurf, Bericht, Blöcke, Materialliste und Bauplan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { entwurfZuJson, berichtAlsText, bloeckeAusEntwurf } from '../../src/ebene3/index.js';
import { engine, beispiel, alsText } from '../ebene5/hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';

const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const abdruck = (e, r) => {
  const bloecke = bloeckeAusEntwurf(e.ebene3, r.entwurf).sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z || (a.id < b.id ? -1 : 1));
  return { status: r.status, entwurf: h(entwurfZuJson(r.entwurf)), bericht: h(berichtAlsText(r.entwurf)), bloecke: h(JSON.stringify(bloecke)), material: h(alsText(e.e5.materialListe(r.entwurf))), plan: h(alsText(e.e5.bauplan(r.entwurf))) };
};
const turmRohr = () => ({ schema: 1, version: 1, projekt: { name: 'Turm D1', bauplatz: { breite: 60, hoehe: 80, tiefe: 60 }, massstab: 1 }, teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', form: { baustein: 'form.zylinder', groesse: { breite: 13, tiefe: 13, hoehe: 34 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }] });

const BASIS = {
  turm: { status: 'fertig', entwurf: '683965849efbfebf', bericht: '3baa28162c703b0b', bloecke: 'cb75cb6e6bfda4ef', material: '43189169f5efac31', plan: '4c92c7d87f8c3e60' },
  haus: { status: 'fertig', entwurf: 'e035809f82bcc919', bericht: 'fafbf71bd42b0cd2', bloecke: '3890d8c5f9b0a261', material: '4384de45aaa43d45', plan: '7f7836c71d59c0ee' },
  zitadelle: { status: 'fertig', entwurf: '9779fbe44c4ae45a', bericht: '60a37ba27d07b257', bloecke: 'bfb304cc2f813491', material: '87311b237fb84fe8', plan: 'd06a4ac902f2a90e' },
};

test('Regression: Turmrohr 13×13×34 ohne rezept unverändert', async () => {
  const e = await engine();
  assert.deepEqual(abdruck(e, e.ebene4.baue(e.ebene4.freigeben(turmRohr(), 'test'))), BASIS.turm);
});

test('Regression: Haus (mittel, mit Tür, Fenster, Treppe) ohne rezept unverändert', async () => {
  const e = await engine();
  const spec = hausSpezifikation(VARIANTEN.mittel, { tuer: 1, fenster: 1, treppe: 1 });
  assert.deepEqual(abdruck(e, e.ebene4.baue(e.ebene4.freigeben(spec, 'test'))), BASIS.haus);
});

test('Regression: Beispielprojekt Zitadelle (klein) ohne rezept unverändert', async () => {
  const b = await beispiel();
  assert.deepEqual(abdruck(b.e, b.ergebnis), BASIS.zitadelle);
});
