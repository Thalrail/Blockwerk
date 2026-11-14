// U5: Bauteile bearbeiten – reines Modul src/ebene5/teile.js (Spezifikationsweg), mit der echten Engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';
import * as T from '../../src/ebene5/teile.js';

const haus = (mit = {}) => hausSpezifikation(VARIANTEN.klein, mit);
const mitKindern = () => haus({ treppe: 1, tuerInWand: 1, fensterTeil: 1 });
const info = (e) => T.teileInfo(e.ebene4.vokabular);
const bauen = (e, spec, pf = null) => { const r = bauePlan(e, e.ebene4.freigeben(spec, 'test'), [], pf); return { ...r, plan: r.entwurf ? e.e5.bauplan(r.entwurf) : null }; };
const zellen = (plan) => { const m = new Map(); for (const a of plan.abschnitte) for (const s of a.schichten) for (let i = 0; i < s.n; i++) m.set(`${s.x[i]},${s.y},${s.z[i]}`, a.legende[s.b[i]].id); return m; };

test('Info: Bausteine mit Parametern (Größenart, Bereich) und die Begriffe der Lage kommen aus dem Vokabular der Engine, nicht aus der Oberfläche', async () => {
  const e = await engine(), i = info(e);
  const raum = i.bausteine.find((b) => b.id === 'bau.raum');
  const breite = raum.parameter.find((p) => p.name === 'breite');
  assert.deepEqual([breite.groessenart, breite.min, breite.max, breite.ganzzahl], ['geometrie', 1, 64, true]);
  assert.equal(raum.parameter.find((p) => p.name === 'hoehe').groessenart, 'menschenmass');
  assert.ok(i.bausteine.length >= 10 && i.bausteine.every((b) => b.parameter.every((p) => !p.liste)));
  assert.ok(i.relationen['neben-osten'] && i.kindrelationen.includes('wand-nord') && i.anker.includes('mitte') && i.ausrichtungen.includes('norden'));
  assert.deepEqual(i.wichtigkeiten, ['muss', 'soll', 'kann']);
  assert.deepEqual(i.versatzAchsen, ['ost', 'sued', 'hoch']);
});

test('Teilliste: Größe als Text, Kindteile (Treppe, Tür, Fenster) mit ihrem Träger gekennzeichnet', async () => {
  const e = await engine(), i = info(e);
  const l = T.teilListe(mitKindern(), i.kindrelationen);
  assert.deepEqual(l.map((x) => [x.id, x.kind, x.traeger]), [['erdgeschoss', false, null], ['obergeschoss', false, null], ['dach', false, null], ['treppe', true, 'erdgeschoss'], ['haustuer', true, 'erdgeschoss'], ['fenster', true, 'erdgeschoss']]);
  assert.match(l[0].groesse, /breite 7/);
});

test('Parameter: Bereich und ganze Zahl nach dem Bausteinpaket, Standard wiederherstellen, Kopie; die neue Größe baut', async () => {
  const e = await engine(), i = info(e);
  const s = haus(), vorher = JSON.stringify(s);
  const n = T.setzeParameter(s, 'erdgeschoss', 'breite', 9, i);
  assert.equal(JSON.stringify(s), vorher, 'die Eingabe bleibt unverändert');
  assert.equal(n.teile[0].form.groesse.breite, 9);
  assert.throws(() => T.setzeParameter(s, 'erdgeschoss', 'breite', 0, i), /nicht möglich/);
  assert.throws(() => T.setzeParameter(s, 'erdgeschoss', 'breite', 65, i), /nicht möglich/);
  assert.throws(() => T.setzeParameter(s, 'erdgeschoss', 'breite', 5.5, i), /ganze Zahl/);
  assert.throws(() => T.setzeParameter(s, 'erdgeschoss', 'breite', NaN, i), /Zahl/);
  assert.throws(() => T.setzeParameter(s, 'erdgeschoss', 'breite', '9', i), /Zahl/);
  assert.throws(() => T.setzeParameter(s, 'erdgeschoss', 'gibtsnicht', 3, i), /gibt es bei/);
  assert.throws(() => T.setzeParameter(s, 'gibtsnicht', 'breite', 3, i), /gibt es nicht/);
  assert.equal('breite' in T.setzeParameter(n, 'erdgeschoss', 'breite', null, i).teile[0].form.groesse, false, 'null = Standard des Bausteins');
  assert.deepEqual(e.ebene4.pruefe(n).rueckfragen, []);
  const alt = bauen(e, s), neu = bauen(e, n);
  assert.equal(neu.status, 'fertig');
  assert.ok(neu.plan.bloecke > alt.plan.bloecke, 'ein breiteres Erdgeschoss braucht mehr Blöcke');
});

test('Name und Wichtigkeit', async () => {
  const e = await engine(), i = info(e);
  const s = haus();
  assert.equal(T.setzeEigenschaft(s, 'dach', 'name', '  Spitzdach ', i).teile[2].name, 'Spitzdach');
  assert.equal(T.setzeEigenschaft(s, 'dach', 'wichtigkeit', 'kann', i).teile[2].wichtigkeit, 'kann');
  assert.throws(() => T.setzeEigenschaft(s, 'dach', 'name', '   ', i), /Name/);
  assert.throws(() => T.setzeEigenschaft(s, 'dach', 'name', 'x'.repeat(61), i), /Name/);
  assert.throws(() => T.setzeEigenschaft(s, 'dach', 'wichtigkeit', 'egal', i), /gibt es nicht/);
  assert.throws(() => T.setzeEigenschaft(s, 'dach', 'id', 'neu', i), /lässt sich hier nicht ändern/, 'die Kennung bleibt (Änderungen sind an sie gebunden)');
});

test('Lage: nicht passende Felder entfallen (Abstand bei Kindteilen, Anker bei freien Teilen); ein Kindteil lässt sich verschieben und der Plan folgt', async () => {
  const e = await engine(), i = info(e);
  const s = mitKindern();
  // freies Teil: Abstand ja, Anker nein
  const a = T.setzeLage(s, 'dach', { bezug: 'obergeschoss', relation: 'ueber', abstand: 2, anker: 'mitte', versatz: { ost: 1 } }, i);
  assert.deepEqual(a.teile[2].lage, { bezug: 'obergeschoss', relation: 'ueber', abstand: 2 });
  // Kindteil: Anker, Ausrichtung, Versatz ja (Nullen entfallen), Abstand nein; bei Wänden keine Ausrichtung
  const k = T.setzeLage(s, 'treppe', { bezug: 'erdgeschoss', relation: 'innen', anker: 'suedost', ausrichtung: 'osten', versatz: { ost: 0, sued: -1 }, abstand: 3 }, i);
  assert.deepEqual(k.teile[3].lage, { bezug: 'erdgeschoss', relation: 'innen', anker: 'suedost', ausrichtung: 'osten', versatz: { sued: -1 } });
  const w = T.setzeLage(s, 'fenster', { bezug: 'erdgeschoss', relation: 'wand-west', ausrichtung: 'norden', versatz: { hoch: 1 } }, i);
  assert.equal('ausrichtung' in w.teile[5].lage, false, 'die Wandseite legt die Ausrichtung fest');
  for (const x of [a, k, w]) assert.deepEqual(e.ebene4.pruefe(x).rueckfragen, [], JSON.stringify(e.ebene4.pruefe(x).rueckfragen.map((q) => q.frage)));
  // Fehler
  const lage = (zusatz) => ({ bezug: 'erdgeschoss', relation: 'innen', ...zusatz });
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ relation: 'daneben' }), i), /Lagebeziehung/);
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ bezug: 'gibtsnicht' }), i), /gibt es nicht/);
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ bezug: 'treppe' }), i), /selbst/);
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ anker: 'mittig' }), i), /Anker/);
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ ausrichtung: 'oben' }), i), /Ausrichtung/);
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ versatz: { west: 1 } }), i), /kennt „west“/);
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ versatz: { ost: 1.5 } }), i), /nicht möglich/);
  assert.throws(() => T.setzeLage(s, 'treppe', lage({ versatz: { ost: 999 } }), i), /nicht möglich/);
  assert.throws(() => T.setzeLage(s, 'dach', { bezug: 'obergeschoss', relation: 'ueber', abstand: -1 }, i), /Abstand/);
  assert.throws(() => T.setzeLage(s, 'dach', null, i), /Beziehung/);
  // verschoben: das Fenster sitzt jetzt in der Westwand statt in der Nordwand
  const vorher = bauen(e, s), nachher = bauen(e, w);
  assert.equal(nachher.status, 'fertig');
  const glas = (p) => [...zellen(p)].filter(([, id]) => /glass/.test(id)).map(([k]) => k.split(',').map(Number));
  const huelle = vorher.entwurf.abschnitte.find((x) => x.id === 'erdgeschoss').huelle;
  const mitteX = (huelle.von.x + huelle.bis.x) / 2;
  assert.ok(glas(vorher.plan).every(([x]) => x > mitteX - 3) && glas(nachher.plan).some(([x]) => x < mitteX - 3), 'Fenster wechselt von der Nordwand in die Westwand');
});

test('Teil hinzufügen: Kennung aus dem Namen (Umlaute, eindeutig), Standardgrößen, der Anbau baut als eigener Abschnitt', async () => {
  const e = await engine(), i = info(e);
  const s = haus();
  s.projekt.bauplatz = { breite: 80, hoehe: 19, tiefe: 60 }; // der Bauplatz der Haus-Sonde ist für einen Anbau zu klein (Rand und Technik)
  assert.equal(T.neueKennung(s, 'Nordturm'), 'nordturm');
  assert.equal(T.neueKennung(s, 'Große Überdachung!'), 'grosse-ueberdachung');
  assert.equal(T.neueKennung(s, 'Dach'), 'dach-2');
  assert.equal(T.neueKennung(s, '  '), 'teil');
  assert.equal(T.neueKennung(s, '***'), 'teil');
  assert.equal(T.neueKennung({ teile: [{ id: 'teil' }, { id: 'teil-2' }] }, ''), 'teil-3');
  const r = T.fuegeTeilHinzu(s, { name: 'Anbau', baustein: 'bau.raum', art: 'halle', lage: { bezug: 'erdgeschoss', relation: 'neben-osten' }, groesse: { breite: 3, tiefe: 3 } }, i);
  assert.equal(r.id, 'anbau');
  assert.deepEqual(r.spec.teile.at(-1), { id: 'anbau', name: 'Anbau', art: 'halle', form: { baustein: 'bau.raum', groesse: { breite: 3, tiefe: 3 } }, lage: { bezug: 'erdgeschoss', relation: 'neben-osten' }, wichtigkeit: 'soll' });
  assert.equal(s.teile.length, 3, 'die Eingabe bleibt unverändert');
  assert.deepEqual(e.ebene4.pruefe(r.spec).rueckfragen, []);
  const b = bauen(e, r.spec);
  assert.equal(b.status, 'fertig');
  assert.equal(b.plan.abschnitte.length, 4);
  assert.ok(b.plan.abschnitte.some((a) => a.id === 'anbau'));
  assert.throws(() => T.fuegeTeilHinzu(s, { name: 'X', baustein: 'bau.raum', art: 'halle', groesse: { breite: 99 }, lage: { bezug: 'projekt', relation: 'mitte' } }, i), /nicht möglich/);
  assert.throws(() => T.fuegeTeilHinzu(s, { name: 'X', baustein: 'bau.raum', art: 'halle', groesse: { gibts: 1 }, lage: { bezug: 'projekt', relation: 'mitte' } }, i), /gibt es bei/);
  // ohne Größen: Standardgrößen; passt es nicht auf den Bauplatz, fragt die Planung nach statt still anzupassen
  const eng = structuredClone(s); eng.projekt.bauplatz = { breite: 39, hoehe: 19, tiefe: 37 };
  const standard = T.fuegeTeilHinzu(eng, { name: 'Groß', baustein: 'bau.raum', art: 'halle', lage: { bezug: 'erdgeschoss', relation: 'neben-osten' } }, i).spec;
  assert.deepEqual(standard.teile.at(-1).form.groesse, {});
  assert.equal(bauen(e, standard).status, 'rueckfragen');
  assert.throws(() => T.fuegeTeilHinzu(s, { name: '', baustein: 'bau.raum', art: 'halle', lage: { bezug: 'projekt', relation: 'mitte' } }, i), /Name/);
  assert.throws(() => T.fuegeTeilHinzu(s, { name: 'X', baustein: 'bau.gibtsnicht', art: 'halle', lage: { bezug: 'projekt', relation: 'mitte' } }, i), /Baustein/);
  assert.throws(() => T.fuegeTeilHinzu(s, { name: 'X', baustein: 'bau.raum', art: 'schloss', lage: { bezug: 'projekt', relation: 'mitte' } }, i), /Art/);
  assert.throws(() => T.fuegeTeilHinzu(s, { name: 'X', baustein: 'bau.raum', art: 'halle', wichtigkeit: 'egal', lage: { bezug: 'projekt', relation: 'mitte' } }, i), /Wichtigkeit/);
  assert.throws(() => T.fuegeTeilHinzu(s, { name: 'X', baustein: 'bau.raum', art: 'halle', lage: { bezug: 'gibtsnicht', relation: 'mitte' } }, i), /gibt es nicht/);
});

test('Teil entfernen: nie stumm, wenn andere darin liegen oder sich beziehen; Verbindungen zu ihm entfallen und werden genannt', async () => {
  const e = await engine(), i = info(e);
  const s = mitKindern();
  assert.deepEqual(T.abhaengige(s, 'erdgeschoss', i.kindrelationen).kinder.sort(), ['fenster', 'haustuer', 'treppe']);
  assert.deepEqual(T.abhaengige(s, 'erdgeschoss', i.kindrelationen).bezogene, ['obergeschoss']);
  assert.throws(() => T.entferneTeil(s, 'erdgeschoss', i.kindrelationen), /In diesem Teil liegen „treppe“, „haustuer“, „fenster“.*beziehen sich „obergeschoss“/);
  assert.throws(() => T.entferneTeil(s, 'gibtsnicht', i.kindrelationen), /gibt es nicht/);
  const ohneDach = T.entferneTeil(s, 'dach', i.kindrelationen);
  assert.deepEqual(ohneDach.entfernteVerbindungen, []);
  assert.deepEqual(e.ebene4.pruefe(ohneDach.spec).rueckfragen, []);
  assert.equal(bauen(e, ohneDach.spec).plan.abschnitte.length, 2);
  assert.equal(s.teile.length, 6, 'die Eingabe bleibt unverändert');
  // ein Kindteil lässt sich einfach entfernen
  assert.equal(T.entferneTeil(s, 'fenster', i.kindrelationen).spec.teile.length, 5);
  // Verbindungen: das Beispielprojekt verbindet Teile; das Ziel zu entfernen nimmt die Verbindungen der anderen mit und nennt sie
  const z = await holeJson('data/beispiele/zitadelle-klein.json');
  const ziel = z.teile.find((t) => z.teile.some((x) => (x.verbindungen ?? []).some((v) => v.mit === t.id)));
  assert.ok(ziel, 'das Beispiel hat eine Verbindung');
  const a = T.abhaengige(z, ziel.id, i.kindrelationen);
  assert.ok(a.verbindungen.length > 0);
  if (!a.kinder.length && !a.bezogene.length) {
    const r = T.entferneTeil(z, ziel.id, i.kindrelationen);
    assert.deepEqual(r.entfernteVerbindungen, a.verbindungen);
    assert.equal(r.spec.teile.some((t) => (t.verbindungen ?? []).some((v) => v.mit === ziel.id)), false);
  } else assert.throws(() => T.entferneTeil(z, ziel.id, i.kindrelationen), /Erst diese Teile/);
});

test('Folgen für Einzelblockänderungen: eine verkleinerte Größe verwaist Änderungen vorab erkennbar; bestehende Probleme zählen nicht als neu; ohne Änderungen kein Probebau', async () => {
  const e = await engine(), i = info(e);
  const s = haus(), bau = bauen(e, s);
  // zwei Änderungen weit außen im Erdgeschoss: Nordost- und Südwest-Ecke einer Wandschicht (aus dem Plan)
  const z = zellen(bau.plan), ebene = [...z.keys()].map((k) => k.split(',').map(Number)).filter(([, y]) => y === 1);
  const ost = ebene.reduce((p, c) => (c[0] > p[0] || (c[0] === p[0] && c[2] < p[2]) ? c : p)), west = ebene.reduce((p, c) => (c[0] < p[0] || (c[0] === p[0] && c[2] > p[2]) ? c : p));
  const wahlen = [ost, west].map(([x, y, zz]) => e.ebene3.zellenwahl.waehle(bau.entwurf, { x, y, z: zz }).gewaehlt);
  assert.ok(wahlen.every((g) => g?.teil === 'erdgeschoss'));
  const pf = PF.wende(PF.leer(), wahlen.map((g) => ({ teil: g.teil, zelle: g.zelle, erwartet: null, neu: { op: 'setze', block: { id: 'minecraft:glass' } } })), 'Jonah').planfassung;
  const mit = bauen(e, s, pf);
  assert.deepEqual(T.aenderungsFolgen(mit.plan), [], 'zuerst wirken beide');
  // breiter: die Rahmenzellen bleiben im Teil (Ecke Nordwest bleibt Ursprung); schmaler: die Ost-Zelle fällt heraus
  const breiter = T.setzeParameter(s, 'erdgeschoss', 'breite', 9, i);
  assert.deepEqual(T.vorschau(e, { spezifikation: breiter, aenderungen: pf }).folgen, []);
  const schmal = T.setzeParameter(s, 'erdgeschoss', 'breite', 3, i);
  const v = T.vorschau(e, { spezifikation: schmal, aenderungen: pf, planVorher: mit.plan });
  assert.deepEqual(v.rueckfragen, []);
  assert.ok(v.folgen.length >= 1, 'mindestens die Änderung an der äußeren Zelle wird verwaist');
  assert.ok(v.folgen.every((f) => f.status === 'verwaist' && /verwaist: die Zelle liegt nicht mehr im Teil/.test(f.text)), JSON.stringify(v.folgen.map((f) => f.text)));
  assert.ok(v.folgen.every((f) => f.teil === 'erdgeschoss'));
  // dieselben Folgen als schon vorhandenes Problem sind nicht neu
  const schonBekannt = bauen(e, schmal, pf);
  assert.deepEqual(T.vorschau(e, { spezifikation: schmal, aenderungen: pf, planVorher: schonBekannt.plan }).folgen, []);
  // ohne Einzelblockänderungen kein Probebau, aber der Prüfer läuft: ungültig → Rückfragen mit Pfad
  assert.deepEqual(T.vorschau(e, { spezifikation: schmal }).folgen, []);
  const kaputt = structuredClone(s); kaputt.teile[0].form.groesse.breite = 500;
  const k = T.vorschau(e, { spezifikation: kaputt, aenderungen: pf });
  assert.ok(k.rueckfragen.some((q) => /breite/.test(q.pfad)) && k.folgen.length === 0);
  // das Entfernen des Teils verwaist alle seine Änderungen („das Teil gibt es nicht mehr“): erst das Dach (ohne Änderungen) ist harmlos
  const ohneDach = T.entferneTeil(s, 'dach', i.kindrelationen).spec;
  assert.deepEqual(T.vorschau(e, { spezifikation: ohneDach, aenderungen: pf }).folgen, []);
});

test('Folgen: Texte für Konflikt, Überholt und Ungültig; ältere Probleme werden herausgefiltert', () => {
  const a = (id, teil, status, grund, op = 'setze', x = 1) => ({ id, teil, zelle: { x, y: 0, z: 0 }, op, status, grund, ort: null });
  const plan = { aenderungen: [a('C1', 't', 'angewandt'), a('C2', 't', 'ueberholt', undefined, 'leere', 2), a('C3', 't', 'konflikt', 'freiraum', 'setze', 3), a('C4', 'u', 'ungueltig', 'kaputt', 'setze', 4), a('C5', 'v', 'verwaist', 'teil-fehlt', 'leere', 5)] };
  const f = T.aenderungsFolgen(plan);
  assert.deepEqual(f.map((x) => x.id), ['C2', 'C3', 'C4', 'C5']);
  assert.match(f[0].text, /wirkt nicht mehr, weil ein Einbauteil/);
  assert.match(f[1].text, /ein Konflikt: die Zelle gehört jetzt zu einem freizuhaltenden Raum/);
  assert.match(f[2].text, /ungültig: kaputt/);
  assert.match(f[3].text, /verwaist: das Teil gibt es nicht mehr/);
  assert.deepEqual(T.aenderungsFolgen(plan, { aenderungen: [a('C9', 't', 'konflikt', 'freiraum', 'setze', 3)] }).map((x) => x.id), ['C2', 'C4', 'C5'], 'dieselbe Zelle war schon ein Problem');
  assert.deepEqual(T.aenderungsFolgen(null), []);
});

test('Formularfelder: Anfangswerte aus dem Teil, Anwendung nur der Unterschiede, Zahlen mit Komma, leere Felder = Standard; ohne Änderung bleibt die Spezifikation byte-gleich', async () => {
  const e = await engine(), i = info(e);
  const s = mitKindern();
  const f = T.felderVon(s, 'erdgeschoss');
  assert.deepEqual([f.name, f.rel, f.bezug, f['p-breite'], f['p-tiefe']], ['Erdgeschoss', 'mitte', 'projekt', '7', '5']);
  assert.equal(JSON.stringify(T.wendeFelder(s, 'erdgeschoss', f, i)), JSON.stringify(s), 'unverändert');
  for (const id of ['treppe', 'haustuer', 'fenster', 'dach']) assert.equal(JSON.stringify(T.wendeFelder(s, id, T.felderVon(s, id), i)), JSON.stringify(s), `${id}: Felder zurückgeben ändert nichts`);
  const g = T.wendeFelder(s, 'erdgeschoss', { ...f, name: 'Wohnhaus', wicht: 'kann', 'p-breite': '9', 'p-tiefe': '' }, i);
  assert.deepEqual([g.teile[0].name, g.teile[0].wichtigkeit, g.teile[0].form.groesse.breite], ['Wohnhaus', 'kann', 9]);
  assert.equal('tiefe' in g.teile[0].form.groesse, false, 'leer = Standard');
  assert.equal(T.wendeFelder(s, 'erdgeschoss', { ...f, 'p-breite': '9,0' }, i).teile[0].form.groesse.breite, 9, 'Komma geht');
  assert.throws(() => T.wendeFelder(s, 'erdgeschoss', { ...f, 'p-breite': 'viel' }, i), /bitte eine Zahl/);
  assert.throws(() => T.wendeFelder(s, 'erdgeschoss', { ...f, 'p-breite': '0' }, i), /nicht möglich/);
  assert.throws(() => T.wendeFelder(s, 'erdgeschoss', { ...f, rel: 'daneben' }, i), /Lagebeziehung/);
  // Kindteil verschieben über Felder (Treppe in die Südost-Ecke, mit Versatz)
  const k = T.wendeFelder(s, 'treppe', { ...T.felderVon(s, 'treppe'), anker: 'suedost', 'v-sued': '-1', ausr: 'osten' }, i);
  assert.deepEqual(k.teile[3].lage, { bezug: 'erdgeschoss', relation: 'innen', anker: 'suedost', ausrichtung: 'osten', versatz: { sued: -1 } });
  assert.deepEqual(e.ebene4.pruefe(k).rueckfragen, []);
  // Beziehung wechseln: Felder, die nicht mehr passen, fallen weg
  const w = T.wendeFelder(s, 'treppe', { ...T.felderVon(s, 'treppe'), rel: 'neben-osten', bezug: 'erdgeschoss', abstand: '2' }, i);
  assert.deepEqual(w.teile[3].lage, { bezug: 'erdgeschoss', relation: 'neben-osten', abstand: 2 });
  // neues Teil aus Feldern
  const gross = structuredClone(s); gross.projekt.bauplatz = { breite: 80, hoehe: 19, tiefe: 60 };
  const n = T.neuAusFeldern(gross, { name: 'Gartenhaus', baustein: 'bau.raum', art: 'halle', wicht: 'kann', rel: 'neben-osten', bezug: 'erdgeschoss', abstand: '1', 'p-breite': '3', 'p-tiefe': '3', 'p-hoehe': '' }, i);
  assert.equal(n.id, 'gartenhaus');
  assert.deepEqual(n.spec.teile.at(-1), { id: 'gartenhaus', name: 'Gartenhaus', art: 'halle', form: { baustein: 'bau.raum', groesse: { breite: 3, tiefe: 3 } }, lage: { bezug: 'erdgeschoss', relation: 'neben-osten', abstand: 1 }, wichtigkeit: 'kann' });
  assert.deepEqual(e.ebene4.pruefe(n.spec).rueckfragen, []);
});

test('Felder: eine anders geschriebene, aber gleiche Lage (Abstand 0, andere Schlüsselreihenfolge) wird nicht angetastet, wenn die Felder unverändert bleiben', async () => {
  const e = await engine(), i = info(e);
  const s = haus();
  s.teile[2].lage = { abstand: 0, relation: 'ueber', bezug: 'obergeschoss' };
  assert.equal(JSON.stringify(T.wendeFelder(s, 'dach', T.felderVon(s, 'dach'), i)), JSON.stringify(s), 'byte-gleich, keine neue Fassung wegen einer Schreibweise');
  const g = T.wendeFelder(s, 'dach', { ...T.felderVon(s, 'dach'), abstand: '2' }, i);
  assert.deepEqual(g.teile[2].lage, { bezug: 'obergeschoss', relation: 'ueber', abstand: 2 });
});
