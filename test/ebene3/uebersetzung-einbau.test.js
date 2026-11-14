// Einbau-Architektur Paket P6: Teile in Bauteilen (innen, wand, wand-…) in Prüfer und Übersetzung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3, ebene4 } from '../hilfe.js';

const e3 = ebene3();
const L = ebene4();
const U = e3.uebersetzung;
const raum = (extra = {}) => ({ baustein: 'bau.raum', groesse: { breite: 9, tiefe: 7, hoehe: 4, ...extra } });
const haus = { id: 'haus', name: 'Haus', art: 'halle', wichtigkeit: 'muss', form: raum(), lage: { bezug: 'projekt', relation: 'mitte' } };
const kind = (id, baustein, groesse, lage, extra = {}) => ({ id, name: id.toUpperCase(), art: 'anlage', wichtigkeit: 'soll', form: { baustein, groesse }, lage, ...extra });
const spec = (teile) => ({ schema: 1, version: 1, projekt: { name: 'Probe', bauplatz: { breite: 100, hoehe: 60, tiefe: 100 }, nullpunkt: { x: 0, y: 0, z: 0 } }, teile });
const treppe = (lage = { bezug: 'haus', relation: 'innen' }) => kind('treppe', 'bau.treppe', { stufen: 5, breite: 2 }, lage);
const uebersetze = (teile) => U.uebersetze(spec(teile));
const fragen = (teile) => uebersetze(teile).rueckfragen.map((q) => q.frage);
const kinderVon = (v, id) => v.abschnitte.find((a) => a.id === id).kinder ?? [];

test('Übersetzung: ein Teil innen im Haus bekommt keinen eigenen Abschnitt, sondern wird Kind des Hauses mit Zone, Anker, Versatz und Drehung', () => {
  const r = uebersetze([haus, treppe({ bezug: 'haus', relation: 'innen', anker: 'suedost', versatz: { ost: -1, sued: 2, hoch: 0 }, ausrichtung: 'westen' })]);
  assert.deepEqual(r.rueckfragen, []);
  assert.deepEqual(r.vorgabe.abschnitte.map((a) => a.id), ['haus'], 'kein Abschnitt für die Treppe');
  assert.deepEqual(kinderVon(r.vorgabe, 'haus'), [{
    ref: 'treppe', name: 'TREPPE', baustein: 'bau.treppe', parameter: { stufen: 5, breite: 2 }, traeger: 'haus',
    einbau: { zone: 'innenraum', anker: 'se', versatz: { x: -1, y: 0, z: 2 }, drehung: 3 },
  }]);
  // das Haus bekommt seine stabile Kennung auch im Formwunsch (damit das Kind einen Träger hat)
  assert.equal(r.vorgabe.abschnitte[0].formen[0].ref, 'haus');
  // Standardwerte: Anker Mitte, kein Versatz, Ausrichtung Norden
  const standard = kinderVon(uebersetze([haus, treppe()]).vorgabe, 'haus')[0];
  assert.deepEqual(standard.einbau, { zone: 'innenraum', anker: 'mitte', versatz: { x: 0, y: 0, z: 0 }, drehung: 0 });
});

test('Übersetzung: Wandzonen: die Ausrichtung folgt der Wandseite (das Kind schaut nach außen), eine zusätzliche Ausrichtung wird abgelehnt', () => {
  const tuer = (relation, extra = {}) => kind('tuer', 'bau.tuer', { fluegel: 1 }, { bezug: 'haus', relation, ...extra });
  for (const [seite, drehung] of [['nord', 0], ['ost', 1], ['sued', 2], ['west', 3]]) {
    const k = kinderVon(uebersetze([haus, tuer(`wand-${seite}`)]).vorgabe, 'haus')[0];
    assert.deepEqual([k.einbau.zone, k.einbau.drehung], [`wand-${seite}`, drehung], seite);
  }
  // Option A (Jonah, 14.11.2026): die Wandseite legt die Ausrichtung fest; eine widersprüchliche Angabe wird vom Prüfer abgelehnt, die Übersetzung folgt in jedem Fall der Wand
  assert.equal(kinderVon(uebersetze([haus, tuer('wand-sued', { ausrichtung: 'norden' })]).vorgabe, 'haus')[0].einbau.drehung, 2, 'Wandseite gewinnt auch dann, wenn jemand die Prüfung umgeht');
  const q = L.pruefe(spec([haus, tuer('wand-sued', { ausrichtung: 'norden' })])).rueckfragen.filter((x) => x.pfad === 'teile[1].lage.ausrichtung');
  assert.equal(q.length, 1);
  for (const teil of ['in der Südwand', 'die Seite der Wand legt die Ausrichtung fest (nach außen)', '„norden“ widerspricht dem; bitte weglassen']) assert.ok(q[0].frage.includes(teil), teil);
  assert.ok(q[0].optionen.some((o) => o.id === 'entfernen'));
  // auch die gleiche Richtung wie die Wand ist eine überflüssige, zweite Angabe: abgelehnt (eindeutig statt stillschweigend gleich)
  assert.equal(L.pruefe(spec([haus, tuer('wand-sued', { ausrichtung: 'sueden' })])).rueckfragen.filter((x) => /ausrichtung/.test(x.pfad)).length, 1);
  // ohne Ausrichtung, und bei den Relationen ohne Seite (innen, wand) bleibt die Ausrichtung erlaubt
  assert.deepEqual(L.pruefe(spec([haus, tuer('wand-sued')])).rueckfragen.filter((x) => /lage/.test(x.pfad)), []);
  assert.deepEqual(L.pruefe(spec([haus, tuer('innen', { ausrichtung: 'westen' })])).rueckfragen.filter((x) => /lage/.test(x.pfad)), []);
  // alle vier Seiten
  for (const s of ['nord', 'ost', 'sued', 'west']) assert.equal(L.pruefe(spec([haus, tuer(`wand-${s}`, { ausrichtung: 'osten' })])).rueckfragen.filter((x) => /ausrichtung/.test(x.pfad)).length, 1, s);
});

test('Übersetzung: Kette Haus → Trennwand → Tür: Träger vor Kind, beide im Abschnitt des Hauses', () => {
  const wand = kind('trennwand', 'bau.wand', { laenge: 9, hoehe: 4, dicke: 1 }, { bezug: 'haus', relation: 'innen', anker: 'nordwest', versatz: { sued: 2 } });
  const tuer = kind('tuer', 'bau.tuer', { fluegel: 1 }, { bezug: 'trennwand', relation: 'wand' });
  const a = kinderVon(uebersetze([haus, tuer, wand]).vorgabe, 'haus'), b = kinderVon(uebersetze([haus, wand, tuer]).vorgabe, 'haus');
  assert.deepEqual(a.map((k) => [k.ref, k.traeger, k.einbau.zone]), [['trennwand', 'haus', 'innenraum'], ['tuer', 'trennwand', 'wand']]);
  assert.deepEqual(a, b, 'die Reihenfolge der Teile in der Spezifikation ist egal');
  assert.deepEqual(uebersetze([haus, wand, tuer]), uebersetze([haus, wand, tuer]), 'deterministisch');
});

test('Übersetzung: was sich nicht übersetzen lässt, wird eine Rückfrage: Zone fehlt, Funktionen und Verbindungen am Kind, Anordnung an ein Kind', () => {
  assert.match(fragen([{ ...haus, form: { baustein: 'form.zylinder', groesse: { breite: 9, tiefe: 9, hoehe: 6 } } }, treppe()])[0], /TREPPE: Haus \(form\.zylinder\) bietet keine Zone „innenraum“ \(es bietet überhaupt keine Zonen\)/);
  assert.match(fragen([{ ...haus, form: { baustein: 'bau.wand', groesse: {} } }, treppe()])[0], /bietet keine Zone „innenraum“ \(vorhanden: wand\)/);
  assert.match(fragen([haus, { ...treppe(), funktionen: [{ art: 'lager', sorten: ['minecraft:dirt'] }] }])[0], /Technik und Bedarf in einem Bauteil/);
  assert.match(fragen([haus, { ...treppe(), verbindungen: [{ mit: 'haus', art: 'gang' }] }])[0], /Verbindungen von und zu Teilen in einem anderen Bauteil kommen später/);
  const daneben = kind('lampe', 'bau.saeule', { durchmesser: 1, hoehe: 4 }, { bezug: 'treppe', relation: 'neben-osten' });
  assert.match(fragen([haus, treppe(), daneben])[0], /liegt in einem anderen Bauteil und hat keine eigene Hülle/);
});

test('Prüfer: Anker, Versatz und Ausrichtung nur bei Teilen in Bauteilen, mit Rückfragen statt Raten', () => {
  const pruefe = (teile) => L.pruefe(spec(teile)).rueckfragen;
  const text = (teile) => pruefe(teile).map((q) => q.frage).join('|');
  const mitLage = (lage) => [haus, treppe(lage)];
  assert.deepEqual(pruefe(mitLage({ bezug: 'haus', relation: 'innen', anker: 'suedost', versatz: { ost: 1, hoch: -1 }, ausrichtung: 'osten' })).filter((q) => /lage/.test(q.pfad)), []);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'innen', anker: 'oben' })), /Der Anker von .* „oben“ kennt Blockwerk nicht/);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'innen', ausrichtung: 'oben' })), /Die Ausrichtung von .* „oben“ kennt Blockwerk nicht/);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'innen', versatz: { x: 1 } })), /Der Versatz kennt „x“ nicht \(erlaubt: ost, sued, hoch\)/);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'innen', versatz: { ost: 1.5 } })), /Der Versatz ost = 1\.5 ist nicht möglich/);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'innen', versatz: { ost: 999 } })), /nicht möglich \(ganze Zahl von -256 bis 256\)/);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'innen', versatz: 'viel' })), /Der Versatz von .* muss ein Objekt/);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'innen', abstand: 3 })), /dort gibt es keinen Abstand/);
  assert.match(text(mitLage({ bezug: 'projekt', relation: 'innen' })), /braucht darum ein Teil als Bezug/);
  assert.match(text(mitLage({ bezug: 'haus', relation: 'neben-osten', anker: 'mitte' })), /„anker“ gilt nur für Teile in einem anderen Bauteil/);
  assert.match(text([{ ...haus, lage: { bezug: 'projekt', relation: 'mitte', versatz: { ost: 1 } } }]), /„versatz“ gilt nur für Teile in einem anderen Bauteil/);
});

test('Briefing: der Prompt erklärt Teile in Bauteilen, Anker, Versatz und Ausrichtung aus denselben Daten wie der Prüfer', () => {
  const b = L.briefing ? L.briefing({}) : null;
  const s = typeof b === 'string' ? b : JSON.stringify(b);
  for (const wort of ['innen', 'wand-sued', 'lage.anker', 'nordwest', 'lage.versatz', 'ost, sued, hoch', 'lage.ausrichtung', 'sueden']) assert.ok(s.includes(wort), wort);
});

test('Übersetzung: ungültige Kind-Bezüge enden in Rückfragen ohne Ausnahme, vorangestellte Kinder finden ihre Wurzel', () => {
  const wand = kind('trennwand', 'bau.wand', { laenge: 9, hoehe: 4, dicke: 1 }, { bezug: 'haus', relation: 'innen' });
  const tuer = kind('tuer', 'bau.tuer', { fluegel: 1 }, { bezug: 'trennwand', relation: 'wand' });
  // vollständig umgekehrte Reihenfolge: Tür, Wand, Haus
  const umgekehrt = uebersetze([tuer, wand, haus]);
  assert.deepEqual(umgekehrt.rueckfragen, []);
  assert.deepEqual(kinderVon(umgekehrt.vorgabe, 'haus').map((k) => k.ref), ['trennwand', 'tuer']);
  assert.deepEqual(umgekehrt.vorgabe, uebersetze([haus, wand, tuer]).vorgabe);
  // zwei Teile liegen gegenseitig ineinander, keines hat eine Wurzel
  const a = kind('a', 'bau.wand', {}, { bezug: 'b', relation: 'innen' }), b = kind('b', 'bau.wand', {}, { bezug: 'a', relation: 'innen' });
  const kreis = U.uebersetze(spec([haus, a, b]));
  assert.equal(kreis.vorgabe, null);
  assert.match(kreis.rueckfragen[0].frage, /führen nicht auf den Bauplatz zurück/);
  // Bezug auf ein Teil, das es nicht gibt
  const fehlt = U.uebersetze(spec([haus, kind('x', 'bau.treppe', {}, { bezug: 'gibtsnicht', relation: 'innen' })]));
  assert.equal(fehlt.vorgabe, null);
  assert.ok(fehlt.rueckfragen.length > 0);
});
