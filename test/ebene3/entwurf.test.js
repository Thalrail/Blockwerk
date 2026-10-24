import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { neuerEntwurf, kopie, pruefeForm, entwurfZuJson, entwurfAusJson, haengeAn, berichtAlsText } from '../../src/ebene3/index.js';

const e3 = ebene3();

function grund() {
  let e = neuerEntwurf({ name: 'Probe' });
  e = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Halle', reihenfolge: 1 } }).entwurf;
  return e;
}

test('Entwurf: Form, JSON-Rundreise, kanonisch und unveränderlich', () => {
  const leer = neuerEntwurf({ name: ' Zitadelle ' });
  assert.equal(leer.projekt.name, 'Zitadelle');
  assert.deepEqual(leer.abschnitte, []);
  assert.deepEqual(leer.zaehler, { teil: 1, einwand: 1, bericht: 1, rueckfrage: 1 });
  assert.throws(() => neuerEntwurf({ name: '' }), /Projektname/);
  assert.throws(() => neuerEntwurf({ name: 'x', bauplatz: { breite: 0, hoehe: 1, tiefe: 1 } }), /Bauplatz/);
  assert.throws(() => neuerEntwurf({ name: 'x', nullpunkt: { x: 1.5, y: 0, z: 0 } }), /Nullpunkt/);

  // ein gefüllter Entwurf übersteht die Rundreise und ist unabhängig vom Schlüsselreihenfolge
  let e = grund();
  e = e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'form.zylinder', parameter: { breite: 5, tiefe: 5 }, lage: { x: 3, y: 0, z: -2, drehung: 1 } } }).entwurf;
  e = e3.aendere(e, 'designer', { art: 'setze-palette', palette: { wand: 'minecraft:stone_bricks' } }).entwurf;
  const text = entwurfZuJson(e);
  assert.deepEqual(entwurfAusJson(text), e);
  assert.equal(entwurfZuJson(entwurfAusJson(text)), text, 'kanonisch');
  const umgedreht = Object.fromEntries(Object.entries(e).reverse());
  assert.equal(entwurfZuJson(umgedreht), text, 'Schlüsselreihenfolge ist egal');

  // Änderungen verändern das Original nie
  const vorher = entwurfZuJson(e);
  e3.aendere(e, 'architekt', { art: 'aendere-teil', id: 'T1', felder: { lage: { x: 99 } } });
  assert.equal(entwurfZuJson(e), vorher, 'Original unverändert');
  const k = kopie(e);
  k.teile[0].lage.x = 1000;
  assert.equal(e.teile[0].lage.x, 3, 'Kopie ist unabhängig');

  // Formfehler beim Laden
  assert.throws(() => entwurfAusJson('{"version": 2}'), /Version/);
  assert.throws(() => pruefeForm({ ...kopie(e), teile: [{ id: 'T1', baustein: 'x', lage: { x: 0, y: 0, z: 0, drehung: 7 } }] }), /lage ungültig/);
  const doppelt = kopie(e);
  doppelt.teile.push({ ...doppelt.teile[0] });
  assert.throws(() => pruefeForm(doppelt), /doppelt/);
  assert.throws(() => pruefeForm({ ...kopie(e), zaehler: { teil: 1 } }), /zaehler/);
});

test('Baubericht: durchnummeriert, lesbar, deterministisch', () => {
  const lauf = () => {
    let e = grund();
    e = e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'form.kuppel', parameter: { breite: 9, tiefe: 9 }, lage: { x: 0, y: 0, z: 0, drehung: 0 } } }).entwurf;
    e = e3.fixiere(e, 'teil:T1', 'Lage von Jonah vorgegeben').entwurf;
    return e;
  };
  const a = lauf(), b = lauf();
  assert.deepEqual(a.bericht, b.bericht, 'gleicher Ablauf = gleicher Bericht');
  assert.deepEqual(a.bericht.map((x) => x.nr), [1, 2, 3]);
  assert.ok(a.bericht.every((x) => x.satz.length > 15 && /[.]$/.test(x.satz)), 'jeder Eintrag hat einen ganzen Satz');
  assert.match(a.bericht[0].satz, /Der Konstrukteur ändert abschnitt:A1/);
  assert.match(a.bericht[1].satz, /Der Architekt ändert teil:T1: form\.kuppel bei \(0, 0, 0\)/);
  assert.match(a.bericht[2].satz, /Jonah fixiert teil:T1/);
  const text = berichtAlsText(a);
  assert.equal(text.split('\n').length, 3);
  assert.match(text, /^001 /);
  assert.throws(() => haengeAn(kopie(a), 'gibtsnicht', {}), /Berichtsart/);
});
