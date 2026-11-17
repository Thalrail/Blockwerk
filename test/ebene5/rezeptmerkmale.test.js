// D3.4: Eingang und Fenster in Ebene 5 (reine Logik teile.js): Anzeige der vorhandenen Werte, Aktivieren, Ändern, Deaktivieren über dieselben Felder wie die Größe; Neuplanung über die echte Pipeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as T from '../../src/ebene5/teile.js';

const spec = (merkmale, stil = { stimmung: 'hell-nordisch' }) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D3.4', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', ...(merkmale ? { merkmale } : {}), form: { groesse: { breite: 13, tiefe: 13, hoehe: 34 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil }],
  });
const info = (e) => T.teileInfo(e.ebene4.vokabular);
const bauen = (e, s) => bauePlan(e, e.ebene4.freigeben(structuredClone(s), 'test'), [], null);

test('Info und Anzeige: wählbare Merkmale aus dem Vokabular mit Anzeigetexten; Teile ohne Rezept haben keine', async () => {
  const e = await engine(), i = info(e);
  assert.deepEqual(i.rezepte.turm.merkmale, { eingang: ['nord', 'ost', 'sued', 'west'], fenster: ['schlitze'] });
  const m = T.rezeptMerkmale(i, 'turm');
  assert.deepEqual(m.eingang.map((o) => o.anzeige), ['Norden', 'Osten', 'Süden', 'Westen']);
  assert.deepEqual(m.fenster, [{ wert: 'schlitze', anzeige: 'Fensterschlitze' }]);
  assert.equal(T.rezeptMerkmale(i, 'gibt-es-nicht'), null);
  const s = spec({ eingang: 'sued', fenster: 'schlitze' });
  assert.deepEqual(T.teilListe(s)[0].merkmale, { eingang: 'sued', fenster: 'schlitze' });
  assert.equal(T.teilListe(spec())[0].merkmale, null);
  // vorhandene Werte beim Öffnen: die Felder spiegeln die Spezifikation, abgeschaltet = leer
  assert.deepEqual([T.felderVon(s, 'turm')['m-eingang'], T.felderVon(s, 'turm')['m-fenster']], ['sued', 'schlitze']);
  assert.deepEqual([T.felderVon(spec(), 'turm')['m-eingang'], T.felderVon(spec(), 'turm')['m-fenster']], ['', '']);
});

test('Aktivieren, Ändern, Deaktivieren: Eingabe bleibt unverändert; nach dem Abschalten ist die Spezifikation wieder genau die ohne Merkmale', async () => {
  const e = await engine(), i = info(e), s0 = spec();
  const vorher = JSON.stringify(s0);
  const a = T.setzeMerkmal(s0, 'turm', 'eingang', 'nord', i);
  assert.equal(JSON.stringify(s0), vorher);
  assert.deepEqual(a.teile[0].merkmale, { eingang: 'nord' });
  const b = T.setzeMerkmal(a, 'turm', 'fenster', 'schlitze', i);
  assert.deepEqual(b.teile[0].merkmale, { eingang: 'nord', fenster: 'schlitze' });
  const c = T.setzeMerkmal(b, 'turm', 'eingang', 'west', i); // ändern
  assert.equal(c.teile[0].merkmale.eingang, 'west');
  const d = T.setzeMerkmal(T.setzeMerkmal(c, 'turm', 'eingang', null, i), 'turm', 'fenster', null, i); // abschalten
  assert.deepEqual(d, s0, 'ohne Merkmale kein Feld mehr: byte-identisch zur Ausgangsfassung');
  assert.ok(!('merkmale' in d.teile[0]));
});

test('Fehlerfälle: unbekannter Wert, unbekanntes Merkmal, Teil ohne Rezept: verständliche Meldung, nichts geändert', async () => {
  const e = await engine(), i = info(e), s = spec();
  const vorher = JSON.stringify(s);
  assert.throws(() => T.setzeMerkmal(s, 'turm', 'eingang', 'oben', i), (f) => f instanceof T.TeileFehler && /nord, ost, sued, west/.test(f.message));
  assert.throws(() => T.setzeMerkmal(s, 'turm', 'fenster', 'bogen', i), (f) => f instanceof T.TeileFehler && /schlitze/.test(f.message));
  assert.throws(() => T.setzeMerkmal(s, 'turm', 'balkon', 'ja', i), (f) => f instanceof T.TeileFehler && /bietet kein Merkmal/.test(f.message));
  const ohneRezept = structuredClone(s); delete ohneRezept.teile[0].rezept; ohneRezept.teile[0].form = { baustein: 'form.zylinder', groesse: { breite: 13, tiefe: 13, hoehe: 34 } };
  assert.throws(() => T.setzeMerkmal(ohneRezept, 'turm', 'eingang', 'sued', i), (f) => f instanceof T.TeileFehler && /nur bei Teilen mit Rezept/.test(f.message));
  assert.equal(JSON.stringify(s), vorher);
});

test('Felder: wendeFelder ändert nur, was sich unterscheidet; unveränderte Felder lassen die Spezifikation gleich; leer schaltet ab', async () => {
  const e = await engine(), i = info(e), s = spec({ eingang: 'sued' });
  assert.deepEqual(T.wendeFelder(s, 'turm', T.felderVon(s, 'turm'), i), s, 'unveränderte Felder: unveränderte Kopie');
  const an = T.wendeFelder(s, 'turm', { ...T.felderVon(s, 'turm'), 'm-fenster': 'schlitze', 'm-eingang': 'ost' }, i);
  assert.deepEqual(an.teile[0].merkmale, { eingang: 'ost', fenster: 'schlitze' });
  const aus = T.wendeFelder(an, 'turm', { ...T.felderVon(an, 'turm'), 'm-eingang': '', 'm-fenster': '' }, i);
  assert.ok(!('merkmale' in aus.teile[0]));
  // Größe und Merkmale gemeinsam in einem Schritt
  const beides = T.wendeFelder(s, 'turm', { ...T.felderVon(s, 'turm'), 'p-breite': '17', 'p-tiefe': '17', 'p-hoehe': '40', 'm-fenster': 'schlitze' }, i);
  assert.deepEqual([beides.teile[0].form.groesse.breite, beides.teile[0].merkmale.fenster], [17, 'schlitze']);
});

test('Neuplanung: Aktivieren, Ändern und Deaktivieren laufen durch die echte Pipeline; Ebene 3 sagt bei Konflikten verständlich warum', async () => {
  const e = await engine(), i = info(e);
  const ohne = bauen(e, spec());
  const mit = bauen(e, T.setzeMerkmal(T.setzeMerkmal(spec(), 'turm', 'eingang', 'sued', i), 'turm', 'fenster', 'schlitze', i));
  assert.equal(mit.status, 'fertig');
  assert.ok(mit.entwurf.teile.some((p) => p.ref === 'turm.eingang'));
  assert.ok(mit.entwurf.teile.filter((p) => /^turm\.fenster-/.test(p.ref)).length >= 4);
  const ost = bauen(e, T.setzeMerkmal(spec({ eingang: 'sued' }), 'turm', 'eingang', 'ost', i));
  assert.equal(ost.entwurf.teile.find((p) => p.ref === 'turm.eingang').einbau.zone, 'wand-ost');
  const wieder = bauen(e, T.setzeMerkmal(T.setzeMerkmal(spec({ eingang: 'sued', fenster: 'schlitze' }), 'turm', 'eingang', null, i), 'turm', 'fenster', null, i));
  assert.deepEqual(wieder.entwurf, ohne.entwurf, 'abgeschaltet = Ausgangsplan, Teil für Teil');
  // Konflikt der Materialwahl: Eisentür der Stimmung dunkel-industriell
  const eisen = e.ebene4.baue(e.ebene4.freigeben(T.setzeMerkmal(spec(undefined, { stimmung: 'dunkel-industriell' }), 'turm', 'eingang', 'sued', i), 'test'));
  assert.notEqual(eisen.status, 'fertig');
  assert.match(JSON.stringify(eisen.rueckfragen), /nicht von Hand/);
});
