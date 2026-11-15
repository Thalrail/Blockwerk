// Paket 1b (Teil 1): Rezeptteile in Ebene 5 – reine Logik src/ebene5/teile.js (Größe, Lage, neues Teil, Felder) mit der echten Engine; Muster: teile.test.js, rezepte-aenderungen.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import { messeGestaltung, bloeckeAusEntwurf } from '../../src/ebene3/gestaltung.js';
import * as PF from '../../src/ebene5/planfassung.js';
import * as T from '../../src/ebene5/teile.js';

const spec = (b = 13, t = 13, h = 34) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm 1b', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', form: { groesse: { breite: b, tiefe: t, hoehe: h } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }],
});
const info = (e) => T.teileInfo(e.ebene4.vokabular);
const gruppe = (e, s) => e.ebene4.pruefe(s).rueckfragen;
/** Fehlerfall: wirft TeileFehler mit der Meldung, und die Eingabe bleibt unverändert. */
const lehntAb = (s, f, muster) => {
  const vorher = JSON.stringify(s);
  assert.throws(f, (err) => err instanceof T.TeileFehler && muster.test(err.message), String(muster));
  assert.equal(JSON.stringify(s), vorher, 'die Spezifikation bleibt unverändert');
};
const bauen = (e, s, pf = null) => { const r = bauePlan(e, e.ebene4.freigeben(structuredClone(s), 'test'), [], pf); return { ...r, plan: r.entwurf ? e.e5.bauplan(r.entwurf) : null }; };
const masse = (e, r) => { const m = messeGestaltung(bloeckeAusEntwurf(e.ebene3, r.entwurf)).maße; return [m.breite, m.tiefe, m.hoehe]; };

test('Info: rezepte mit Mindestmaßen aus dem Vokabular; Bereiche je Maß; bestehende Felder unverändert', async () => {
  const e = await engine(), i = info(e), v = e.ebene4.vokabular;
  assert.deepEqual(Object.keys(i.rezepte), Object.keys(v.rezepte));
  const turm = i.rezepte.turm;
  assert.equal(turm.id, 'turm');
  assert.deepEqual(turm.mindest, v.rezepte.turm.mindest);
  assert.deepEqual(turm.parameter.map((p) => [p.name, p.ganzzahl, p.min, p.max]), [['breite', true, 9, 4096], ['tiefe', true, 9, 4096], ['hoehe', true, 16, 384]]);
  assert.ok(turm.parameter.every((p) => typeof p.beschreibung === 'string' && p.beschreibung));
  assert.ok(i.bausteine.length >= 10 && i.teilarten.includes('turm'));
  assert.deepEqual(i.wichtigkeiten, ['muss', 'soll', 'kann']);
});

test('Oberfläche: rezeptFelder (Felder, Mindestmaß-Hinweise, Pflichttext), rezeptZeile, rezeptAusAuswahl', async () => {
  const e = await engine(), i = info(e), turm = i.rezepte.turm;
  const f = T.rezeptFelder(i, 'turm');
  assert.deepEqual(f.felder.map((x) => [x.name, x.anzeige, x.min, x.max]), [['breite', 'Breite', 9, 4096], ['tiefe', 'Tiefe', 9, 4096], ['hoehe', 'Höhe', 16, 384]]);
  assert.equal(f.felder[0].hinweis, 'mindestens 9');
  const h = turm.mindest.hoeheZuBreite;
  assert.equal(f.felder[2].hinweis, h ? `mindestens 16, mindestens ${h} × die größere Breite` : 'mindestens 16');
  assert.match(f.pflicht, /Pflichtfelder: Breite, Tiefe und Höhe/);
  assert.match(f.hinweis, /Pflicht; vorbelegt mit dem Mindestmaß/);
  assert.doesNotMatch(f.hinweis, /Leer lassen/);
  assert.deepEqual(f.felder.map((x) => x.vorgabe), [9, 9, 16]);
  assert.equal(T.rezeptZeile(i, 'turm'), `Rezept: ${turm.titel.split(':')[0]} (turm)`);
  assert.ok(!T.rezeptZeile(i, 'turm').includes(':', 'Rezept:'.length), 'Titel nur bis zum ersten Doppelpunkt');
  assert.equal(T.rezeptZeile(i, 'gibtsnicht'), 'Rezept: gibtsnicht (gibtsnicht)');
  assert.equal(T.rezeptZeile(i, 'constructor'), 'Rezept: constructor (constructor)');
  assert.deepEqual([T.rezeptBekannt(i, 'turm'), T.rezeptBekannt(i, 'gibtsnicht'), T.rezeptBekannt(i, 'constructor'), T.rezeptBekannt(i, undefined)], [true, false, false, false]);
  assert.throws(() => T.rezeptFelder(i, 'gibtsnicht'), T.TeileFehler);
  assert.equal(T.rezeptAusAuswahl('rezept:turm'), 'turm');
  assert.equal(T.rezeptAusAuswahl('bau.raum'), null);
  assert.equal(T.rezeptAusAuswahl(undefined), null);
});

test('Vorgabe: übersteigt hoeheZuBreite die Mindesthöhe, besteht die Vorbelegung trotzdem die Prüfung', async () => {
  const e = await engine(), i = structuredClone(info(e));
  i.rezepte.turm.mindest.hoeheZuBreite = 5; // 9 × 5 = 45 > 16
  const v = Object.fromEntries(T.rezeptFelder(i, 'turm').felder.map((x) => [x.name, x.vorgabe]));
  assert.deepEqual(v, { breite: 9, tiefe: 9, hoehe: 45 });
  const lage = { relation: 'neben-osten', bezug: 'turm' };
  assert.doesNotThrow(() => T.fuegeTeilHinzu(spec(), { name: 'Wachturm', rezept: 'turm', lage, groesse: v }, i));
});

test('Liste: Rezeptteil hat rezept und baustein null, Baustein-Teil rezept null; unbekanntes Rezept wirft nicht, bleibt entfernbar', async () => {
  const e = await engine(), i = info(e);
  const leer = spec(); leer.teile[0].rezept = '';
  assert.equal(T.teilListe(leer)[0].rezept, '', 'leeres Rezept bleibt erkennbar (nicht null)');
  assert.equal(T.rezeptBekannt(i, ''), false);
  assert.equal(T.teilListe(hausSpezifikation(VARIANTEN.klein, {}))[0].rezept, null);
  const alt = spec(); alt.teile[0].rezept = 'verschwunden';
  assert.equal(T.teilListe(alt)[0].rezept, 'verschwunden');
  assert.equal(T.rezeptBekannt(i, 'verschwunden'), false);
  assert.equal(T.rezeptZeile(i, 'verschwunden'), 'Rezept: verschwunden (verschwunden)');
  assert.deepEqual(T.entferneTeil(alt, 'turm', i.kindrelationen).spec.teile, []);
  const z = T.teilListe(spec())[0];
  assert.deepEqual([z.baustein, z.rezept, z.groesse, z.kind], [null, 'turm', 'breite 13, tiefe 13, hoehe 34', false]);
  const haus = T.teilListe(hausSpezifikation(VARIANTEN.klein, {}));
  assert.ok(haus.length && haus.every((t) => t.rezept === null && typeof t.baustein === 'string'));
  assert.ok(e);
});

test('Größe ändern: gültig 13 → 17 mit Höhe 34; einzelnes Maß, Rest bleibt, Eingabe unverändert, Prüfer ohne Rückfragen', async () => {
  const e = await engine(), i = info(e), s = spec(), vorher = JSON.stringify(s);
  const neu = T.setzeParameter(s, 'turm', 'breite', 17, i);
  assert.deepEqual(neu.teile[0].form, { groesse: { breite: 17, tiefe: 13, hoehe: 34 } });
  assert.equal(neu.teile[0].rezept, 'turm');
  assert.equal(JSON.stringify(s), vorher);
  assert.deepEqual(gruppe(e, neu), []);
});

test('Größe ändern: Breite und Höhe gemeinsam über wendeFelder (einzeln wäre die Höhe zu klein)', async () => {
  const e = await engine(), i = info(e), s = spec();
  lehntAb(s, () => T.setzeParameter(s, 'turm', 'breite', 40, i), /Höhe mindestens 40 Blöcke bei Breite 40 und Tiefe 13 \(Rezept Turm\)/);
  const neu = T.wendeFelder(s, 'turm', { ...T.felderVon(s, 'turm'), 'p-breite': '40', 'p-hoehe': '45' }, i);
  assert.deepEqual(neu.teile[0].form.groesse, { breite: 40, tiefe: 13, hoehe: 45 });
  assert.deepEqual(gruppe(e, neu), []);
  // ohne Unterschied: unveränderte Kopie
  assert.deepEqual(T.wendeFelder(s, 'turm', T.felderVon(s, 'turm'), i), s);
  // ein fehlendes Feld ist keine Angabe
  assert.deepEqual(T.wendeFelder(s, 'turm', { 'p-breite': '17' }, i).teile[0].form.groesse, { breite: 17, tiefe: 13, hoehe: 34 });
});

test('Größe ändern: ungültig → TeileFehler, Spezifikation unverändert', async () => {
  const e = await engine(), i = info(e), s = spec();
  lehntAb(s, () => T.setzeParameter(s, 'turm', 'breite', 8, i), /breite = 8 ist nicht möglich \(9 bis 4096\)/);
  lehntAb(s, () => T.setzeParameter(s, 'turm', 'tiefe', 13.5, i), /ganze Zahl/);
  lehntAb(s, () => T.setzeParameter(s, 'turm', 'hoehe', 15, i), /hoehe = 15 ist nicht möglich/);
  lehntAb(s, () => T.setzeParameter(spec(13, 13, 16), 'turm', 'breite', 17, i), /Höhe mindestens 17 Blöcke bei Breite 17 und Tiefe 13 \(Rezept Turm\)/);
  lehntAb(s, () => T.setzeParameter(s, 'turm', 'hoehe', null, i), /Breite, Tiefe und Höhe Pflicht/);
  lehntAb(s, () => T.setzeParameter(s, 'turm', 'hoehe', '34', i), /bitte eine Zahl/);
  lehntAb(s, () => T.setzeParameter(s, 'turm', 'dicke', 5, i), /nur Breite, Tiefe und Höhe/);
  for (const f of ['p-breite', 'p-tiefe', 'p-hoehe']) lehntAb(s, () => T.wendeFelder(s, 'turm', { ...T.felderVon(s, 'turm'), [f]: '' }, i), /Pflicht/);
  lehntAb(s, () => T.wendeFelder(s, 'turm', { ...T.felderVon(s, 'turm'), 'p-breite': 'abc' }, i), /bitte eine Zahl/);
  lehntAb(s, () => T.wendeFelder(s, 'turm', { ...T.felderVon(s, 'turm'), 'p-breite': '40' }, i), /Höhe mindestens 40/);
  // ein Fehler in einem Feld verwirft auch die anderen Änderungen (Rückgabe nur bei Erfolg)
  lehntAb(s, () => T.wendeFelder(s, 'turm', { ...T.felderVon(s, 'turm'), name: 'Neu', 'p-breite': '5' }, i), /breite = 5/);
  assert.ok(e);
});

test('Lage: Kindbeziehungen werden für Rezeptteile abgelehnt, andere Lagen gelten; Name, Wichtigkeit, Entfernen erhalten Rezept und Maße', async () => {
  const e = await engine(), i = info(e), s = spec();
  s.teile.push({ id: 'halle', name: 'Halle', art: 'halle', wichtigkeit: 'soll', form: { baustein: 'bau.raum', groesse: { breite: 20 } }, lage: { bezug: 'projekt', relation: 'mitte' } });
  for (const relation of i.kindrelationen) lehntAb(s, () => T.setzeLage(s, 'turm', { relation, bezug: 'halle' }, i), /nicht für ein Teil in einem anderen Bauteil/);
  const neben = T.setzeLage(s, 'turm', { relation: 'neben-osten', bezug: 'halle', abstand: 3 }, i);
  assert.deepEqual(neben.teile[0].lage, { bezug: 'halle', relation: 'neben-osten', abstand: 3 });
  assert.deepEqual(neben.teile[0].form, s.teile[0].form);
  const n = T.setzeEigenschaft(T.setzeEigenschaft(s, 'turm', 'name', ' Nordturm ', i), 'turm', 'wichtigkeit', 'kann', i);
  assert.deepEqual([n.teile[0].name, n.teile[0].wichtigkeit, n.teile[0].rezept, n.teile[0].form], ['Nordturm', 'kann', 'turm', s.teile[0].form]);
  const weg = T.entferneTeil(s, 'halle', i.kindrelationen).spec;
  assert.deepEqual(weg.teile[0], s.teile[0]);
  assert.ok(T.entferneTeil(s, 'turm', i.kindrelationen).spec.teile.every((t) => t.rezept === undefined));
  assert.ok(e);
});

test('Neues Teil mit Rezept: alle drei Maße Pflicht, Art aus dem Rezeptnamen, landet gültig im Prüfer', async () => {
  const e = await engine(), i = info(e), s = spec(), lage = { relation: 'neben-osten', bezug: 'turm', abstand: 4 };
  const { spec: neu, id } = T.fuegeTeilHinzu(s, { name: 'Wachturm', rezept: 'turm', lage, groesse: { breite: 9, tiefe: 9, hoehe: 16 } }, i);
  assert.equal(id, 'wachturm');
  assert.deepEqual(neu.teile[1], { id: 'wachturm', name: 'Wachturm', art: 'turm', rezept: 'turm', form: { groesse: { breite: 9, tiefe: 9, hoehe: 16 } }, lage: { bezug: 'turm', relation: 'neben-osten', abstand: 4 }, wichtigkeit: 'soll' });
  assert.equal(neu.teile[1].form.baustein, undefined);
  assert.equal(s.teile.length, 1, 'Eingabe unverändert');
  assert.deepEqual(gruppe(e, neu), []);
});

test('Neues Teil mit Rezept: eigene Größen, Art ausdrücklich, Felder-Weg `rezept:<name>` (leeres Feld = Pflicht-Fehler, keine stille Ergänzung)', async () => {
  const e = await engine(), i = info(e), s = spec(), lage = { relation: 'neben-osten', bezug: 'turm' };
  const gr = { breite: 21, tiefe: 9, hoehe: 21 }; // Höhe ≥ 1 × größere Breite
  const a = T.fuegeTeilHinzu(s, { name: 'Breiter', rezept: 'turm', art: 'anlage', lage, groesse: gr }, i);
  assert.deepEqual([a.spec.teile[1].art, a.spec.teile[1].form.groesse], ['anlage', gr]);
  assert.deepEqual(gruppe(e, a.spec), []);
  const felder = { name: 'Feldturm', baustein: 'rezept:turm', art: '', wicht: 'kann', rel: 'neben-osten', bezug: 'turm', 'p-breite': '11', 'p-tiefe': '9', 'p-hoehe': '30' };
  const f = T.neuAusFeldern(s, felder, i);
  assert.deepEqual([f.id, f.spec.teile[1].rezept, f.spec.teile[1].form, f.spec.teile[1].wichtigkeit], ['feldturm', 'turm', { groesse: { breite: 11, tiefe: 9, hoehe: 30 } }, 'kann']);
  assert.deepEqual(gruppe(e, f.spec), []);
  for (const k of ['p-breite', 'p-tiefe', 'p-hoehe']) lehntAb(s, () => T.neuAusFeldern(s, { ...felder, [k]: '' }, i), /Pflicht/);
  for (const k of ['p-breite', 'p-tiefe', 'p-hoehe']) { const { [k]: _weg, ...ohne } = felder; lehntAb(s, () => T.neuAusFeldern(s, ohne, i), /Pflicht/); }
});

test('Neues Teil mit Rezept: Fehlerfälle (Rezeptname, Art, Größen, Kindlage, Baustein zugleich)', async () => {
  const e = await engine(), i = info(e), s = spec(), lage = { relation: 'neben-osten', bezug: 'turm' };
  const neu = (zusatz) => () => T.fuegeTeilHinzu(s, { name: 'X', rezept: 'turm', lage, ...zusatz }, i);
  lehntAb(s, () => T.fuegeTeilHinzu(s, { name: 'X', rezept: 'burg', lage }, i), /Das Rezept „burg“ gibt es nicht/);
  lehntAb(s, neu({ art: 'schloss' }), /Die Art „schloss“ gibt es nicht/);
  const voll = { breite: 9, tiefe: 9, hoehe: 16 };
  lehntAb(s, neu({ groesse: { ...voll, breite: 8 } }), /breite = 8 ist nicht möglich/);
  lehntAb(s, neu({ groesse: { ...voll, breite: 9.5 } }), /ganze Zahl/);
  lehntAb(s, neu({ groesse: { ...voll, breite: 30 } }), /Höhe mindestens 30/);
  lehntAb(s, neu({ groesse: { ...voll, hoehe: null } }), /Pflicht/);
  lehntAb(s, neu({}), /Pflicht/); // ohne Größe keine stillen Mindestmaße
  lehntAb(s, neu({ groesse: { breite: 21 } }), /Pflicht/);
  lehntAb(s, neu({ groesse: { ...voll, dicke: 3 } }), /nur Breite, Tiefe und Höhe/);
  lehntAb(s, neu({ groesse: voll, baustein: 'bau.raum' }), /entweder einen Baustein oder ein Rezept/);
  lehntAb(s, neu({ groesse: voll, lage: { relation: i.kindrelationen[0], bezug: 'turm' } }), /nicht für ein Teil in einem anderen Bauteil/);
  lehntAb(s, () => T.fuegeTeilHinzu(s, { name: 'X', rezept: 'turm', lage, groesse: voll, wichtigkeit: 'egal' }, i), /Die Wichtigkeit/);
  // ohne Rezeptname als Teilart und ohne Art: Fehler statt stiller Wahl (Rezept „turm“ ist selbst eine Art, daher eine Prüfung über ein Vokabular ohne diese Art)
  const ohneArt = { ...i, teilarten: i.teilarten.filter((a) => a !== 'turm') };
  lehntAb(s, () => T.fuegeTeilHinzu(s, { name: 'X', rezept: 'turm', lage, groesse: voll }, ohneArt), /Die Art „undefined“ gibt es nicht/);
  assert.ok(e);
});

test('Planung: nach der Größenänderung hat das Bauwerk exakt die neuen Außenmaße; zweimal planen ist identisch', async () => {
  const e = await engine(), i = info(e);
  const klein = bauen(e, spec());
  assert.deepEqual(masse(e, klein), [13, 13, 34]);
  const neu = T.wendeFelder(spec(), 'turm', { ...T.felderVon(spec(), 'turm'), 'p-breite': '17', 'p-tiefe': '15', 'p-hoehe': '40' }, i);
  const a = bauen(e, neu), b = bauen(e, neu);
  assert.equal(a.status, 'fertig');
  assert.deepEqual(masse(e, a), [17, 15, 40]);
  assert.deepEqual(a.plan, b.plan);
});

test('Planung: ein neues Rezeptteil mit Mindestmaßen wird gebaut', async () => {
  const e = await engine(), i = info(e);
  const r = bauen(e, T.fuegeTeilHinzu(spec(), { name: 'Zweiter', rezept: 'turm', lage: { relation: 'neben-osten', bezug: 'turm', abstand: 5 }, groesse: { breite: 9, tiefe: 9, hoehe: 16 } }, i).spec);
  assert.equal(r.status, 'fertig');
  assert.ok(r.entwurf.teile.some((t) => t.ref.startsWith('zweiter.')));
});

const pf = (teil, zelle, id) => PF.wende(PF.leer(), [{ teil, zelle, erwartet: null, neu: { op: 'setze', block: { id } } }], 'Jonah').planfassung;
const randzelle = (e, r, ref) => {
  const t = r.entwurf.teile.find((x) => x.ref === ref);
  const bl = e.ebene2.baue(t.baustein, t.parameter).bloecke;
  const von = { x: Math.min(...bl.map((b) => b.x)), y: Math.min(...bl.map((b) => b.y)), z: Math.min(...bl.map((b) => b.z)) };
  const b = bl.filter((c) => c.y === von.y).sort((p, q) => q.x - p.x || p.z - q.z)[0];
  return { x: b.x - von.x, y: b.y - von.y, z: b.z - von.z };
};

test('Einzelblockänderung am Glied: bleibt nach Vergrößern wirksam, wird nach Verkleinern verwaist gemeldet (Zelle gespeichert)', async () => {
  const e = await engine(), i = info(e), GLAS = 'minecraft:glass';
  const basis = bauen(e, spec(13, 13, 34));
  for (const glied of ['krone', 'schaft-unten']) {
    const teil = `turm.${glied}`, zelle = randzelle(e, basis, teil), aenderung = pf(teil, zelle, GLAS);
    const gross = bauen(e, T.setzeParameter(spec(13, 13, 34), 'turm', 'hoehe', 40, i), aenderung);
    assert.equal(gross.status, 'fertig', `${glied} ${JSON.stringify(gross.rueckfragen)}`);
    assert.deepEqual(gross.plan.aenderungen.map((a) => [a.teil, a.status, a.block.id]), [[teil, 'angewandt', GLAS]], glied);
  }
  const grossZelle = randzelle(e, bauen(e, spec(21, 21, 40)), 'turm.krone');
  const verkleinert = T.wendeFelder(spec(21, 21, 40), 'turm', { ...T.felderVon(spec(21, 21, 40), 'turm'), 'p-breite': '9', 'p-tiefe': '9', 'p-hoehe': '20' }, i);
  const klein = bauen(e, verkleinert, pf('turm.krone', grossZelle, GLAS));
  assert.equal(klein.status, 'wartet');
  assert.equal(klein.plan.aenderungen[0].status, 'verwaist');
  assert.deepEqual(klein.plan.aenderungen[0].zelle, grossZelle);
  assert.equal(klein.rueckfragen.filter((q) => q.art === 'aenderung').length, 1);
});

test('Rückwärts: Baustein-Teile durchlaufen dieselben Funktionen unverändert', async () => {
  const e = await engine(), i = info(e), s = hausSpezifikation(VARIANTEN.klein, { treppe: 1, tuerInWand: 1, fensterTeil: 1 });
  for (const t of s.teile) {
    assert.deepEqual(T.wendeFelder(s, t.id, T.felderVon(s, t.id), i), s, t.id);
    assert.deepEqual(T.setzeEigenschaft(s, t.id, 'name', t.name, i), s, t.id);
  }
  assert.deepEqual(T.teilListe(s).map((t) => t.baustein), s.teile.map((t) => t.form.baustein));
  const roh = s.teile[0], par = Object.keys(roh.form.groesse)[0];
  if (par) assert.deepEqual(T.setzeParameter(s, roh.id, par, roh.form.groesse[par], i), s);
  // Baustein-Parameter: `null` nimmt die Angabe weiterhin weg
  const ohne = T.setzeParameter(s, roh.id, 'breite', null, i);
  assert.equal(ohne.teile[0].form.groesse.breite, undefined);
});
