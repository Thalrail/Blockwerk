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
  assert.deepEqual(i.rezepte.turm.merkmale, { eingang: ['nord', 'ost', 'sued', 'west'], fenster: ['schlitze'], geschosse: ['standard'], treppe: ['auto', 'wendel', 'gerade', 'leiter'] });
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

// ---- D4.4: Geschosse und Treppenform ----
test('Geschosse und Treppenform: Anzeigetexte, Abhängigkeit, „automatisch“ braucht kein Feld, Abschalten der Geschosse nimmt die Treppenform mit', async () => {
  const e = await engine(), i = info(e), s0 = spec();
  const m = T.rezeptMerkmale(i, 'turm');
  assert.deepEqual(m.geschosse.map((o) => o.anzeige), ['Geschosse (Etagen von 5 Blöcken)']);
  assert.deepEqual(m.treppe.map((o) => o.wert), ['auto', 'wendel', 'gerade', 'leiter']);
  assert.equal(m.treppe.find((o) => o.wert === 'leiter').anzeige, 'Leiter (nur für Spieler)', 'die Einschränkung ist sichtbar');
  assert.throws(() => T.setzeMerkmal(s0, 'turm', 'treppe', 'wendel', i), (f) => f instanceof T.TeileFehler && /zuerst die Geschosse/.test(f.message));
  const g = T.setzeMerkmal(s0, 'turm', 'geschosse', 'standard', i);
  assert.deepEqual(g.teile[0].merkmale, { geschosse: 'standard' });
  const w = T.setzeMerkmal(g, 'turm', 'treppe', 'wendel', i);
  assert.deepEqual(w.teile[0].merkmale, { geschosse: 'standard', treppe: 'wendel' });
  const auto = T.setzeMerkmal(w, 'turm', 'treppe', 'auto', i);
  assert.deepEqual(auto.teile[0].merkmale, { geschosse: 'standard' }, 'automatisch = kein Feld');
  const ohne = T.setzeMerkmal(w, 'turm', 'geschosse', null, i);
  assert.deepEqual(ohne, s0, 'ohne Geschosse auch keine Treppenform: wieder die Ausgangsfassung');
  assert.throws(() => T.setzeMerkmal(g, 'turm', 'treppe', 'rutsche', i), (f) => f instanceof T.TeileFehler && /wendel/.test(f.message));
});

test('Felder: Geschosse und Treppenform über m-geschosse und m-treppe; Anzeige der vorhandenen Werte; leer schaltet ab', async () => {
  const e = await engine(), i = info(e);
  const s = spec({ eingang: 'sued', geschosse: 'standard', treppe: 'gerade' });
  const f = T.felderVon(s, 'turm');
  assert.deepEqual([f['m-eingang'], f['m-geschosse'], f['m-treppe']], ['sued', 'standard', 'gerade']);
  assert.equal(T.felderVon(spec({ geschosse: 'standard', treppe: 'auto' }), 'turm')['m-treppe'], '', 'ein ausdrückliches „auto“ erscheint als Automatisch');
  assert.deepEqual(T.wendeFelder(s, 'turm', f, i), s, 'unveränderte Felder: unveränderte Kopie');
  const wechsel = T.wendeFelder(s, 'turm', { ...f, 'm-treppe': 'leiter' }, i);
  assert.equal(wechsel.teile[0].merkmale.treppe, 'leiter');
  const aus = T.wendeFelder(s, 'turm', { ...f, 'm-geschosse': '', 'm-treppe': 'gerade' }, i); // die Treppenform bleibt im Formular stehen, gilt aber ohne Geschosse nicht
  assert.deepEqual(aus.teile[0].merkmale, { eingang: 'sued' });
  const neu = T.wendeFelder(spec(), 'turm', { ...T.felderVon(spec(), 'turm'), 'm-geschosse': 'standard' }, i);
  assert.deepEqual(neu.teile[0].merkmale, { geschosse: 'standard' });
});

test('Vorschau und Neuplanung: Platzproblem als verständliche Rückfrage (nichts wird übernommen), passender Turm wird gebaut, Abschalten ergibt wieder den Ausgangsplan', async () => {
  const e = await engine(), i = info(e);
  const klein = spec(); klein.teile[0].form.groesse = { breite: 9, tiefe: 9, hoehe: 16 };
  const zuKlein = T.setzeMerkmal(klein, 'turm', 'geschosse', 'standard', i);
  const v = T.vorschau(e, { spezifikation: zuKlein, aenderungen: null, messungen: [], planVorher: { aenderungen: [] } });
  assert.ok(v.rueckfragen.length >= 1 && /keine einzige Etage möglich/.test(v.rueckfragen.map((q) => q.frage).join(' ')), JSON.stringify(v.rueckfragen).slice(0, 200));
  const ohne = bauen(e, spec());
  const mit = bauen(e, T.setzeMerkmal(T.setzeMerkmal(spec(), 'turm', 'geschosse', 'standard', i), 'turm', 'treppe', 'wendel', i));
  assert.equal(mit.status, 'fertig');
  assert.ok(mit.entwurf.teile.filter((p) => /^turm\.treppe-wendel-/.test(p.ref ?? '')).length >= 4);
  const wieder = bauen(e, T.setzeMerkmal(T.setzeMerkmal(spec({ geschosse: 'standard', treppe: 'wendel' }), 'turm', 'geschosse', null, i), 'turm', 'treppe', null, i));
  assert.deepEqual(wieder.entwurf, ohne.entwurf, 'abgeschaltet = Ausgangsplan, Teil für Teil');
});
