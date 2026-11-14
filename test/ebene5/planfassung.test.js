// Einbau-Architektur Paket P10: gemeinsame Planfassung der manuellen Änderungen mehrerer Spieler (Raum, Klient, Teilen) und ihr Weg in den Entwurf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import * as PF from '../../src/ebene5/planfassung.js';
import { neuerRaum, verarbeite, zustellungen, erzeugeKlient, liesNachricht, GRENZEN } from '../../src/ebene5/live.js';
import { kodiere, dekodiere, exportDatei, importDatei, CODE_MAX, TeilenFehler } from '../../src/ebene5/teilen.js';
import { neuerEntwurf } from '../../src/ebene3/index.js';

const zelle = (x = 1, y = 1, z = 0) => ({ x, y, z });
const glas = { op: 'setze', block: { id: 'minecraft:glass' } };
const stein = { op: 'setze', block: { id: 'minecraft:stone' } };
const op = (teil, z, erwartet, neu) => ({ teil, zelle: z, erwartet, neu });

test('Planfassung: Vergleichen-und-Setzen je Zelle: annehmen, wiederholen, entfernen; verschiedene Zellen stören sich nie; die Version steigt einmal je Nachricht', () => {
  let pf = PF.leer();
  let r = PF.wende(pf, [op('haus', zelle(1), null, glas), op('haus', zelle(2), null, stein)], 'Anna');
  assert.deepEqual([r.angenommen.length, r.konflikte.length, r.planfassung.version], [2, 0, 1]);
  pf = r.planfassung;
  assert.deepEqual(Object.keys(pf.eintraege).sort(), ['haus|1,1,0', 'haus|2,1,0']);
  assert.deepEqual(pf.eintraege['haus|1,1,0'], { teil: 'haus', zelle: zelle(1), op: 'setze', block: { id: 'minecraft:glass' }, von: 'Anna' });
  // Wiederholung (schon so): nichts passiert, keine neue Version
  r = PF.wende(pf, [op('haus', zelle(1), glas, glas)], 'Ben');
  assert.deepEqual([r.angenommen.length, r.konflikte.length, r.geaendert, r.planfassung === pf], [0, 0, false, true]);
  // Entfernen mit richtiger Erwartung
  r = PF.wende(pf, [op('haus', zelle(1), glas, null)], 'Ben');
  assert.deepEqual(Object.keys(r.planfassung.eintraege), ['haus|2,1,0']);
  assert.equal(r.planfassung.version, 2);
  assert.deepEqual(r.angenommen, [{ teil: 'haus', zelle: zelle(1), neu: null }]);
  // andere Teile und Zellen stören sich nie, auch mit veraltetem Wissen
  r = PF.wende(pf, [op('treppe', zelle(1), null, glas), op('haus', zelle(3), null, glas)], 'Ben');
  assert.deepEqual([r.angenommen.length, r.konflikte.length], [2, 0]);
  // der Blockzustand zählt zum Inhalt, die Reihenfolge seiner Schlüssel nicht
  const treppe = { op: 'setze', block: { id: 'minecraft:stone_stairs', zustand: { b: 1, a: 2 } } };
  const t = PF.wende(pf, [op('haus', zelle(9), null, treppe)], 'Anna').planfassung;
  assert.equal(PF.wende(t, [op('haus', zelle(9), { op: 'setze', block: { id: 'minecraft:stone_stairs', zustand: { a: 2, b: 1 } } }, null)], 'Ben').konflikte.length, 0);
  assert.equal(PF.wende(t, [op('haus', zelle(9), { op: 'setze', block: { id: 'minecraft:stone_stairs', zustand: { a: 3, b: 1 } } }, null)], 'Ben').konflikte.length, 1);
});

test('Planfassung: Konflikt statt Überschreiben: wer eine andere Erwartung hat, bekommt den aktuellen Eintrag, der Raum bleibt unverändert', () => {
  const pf = PF.wende(PF.leer(), [op('haus', zelle(), null, glas)], 'Anna').planfassung;
  const r = PF.wende(pf, [op('haus', zelle(), null, stein), op('haus', zelle(5), null, stein)], 'Ben');
  assert.equal(r.konflikte.length, 1, 'nur die gemeinsame Zelle kollidiert');
  assert.deepEqual(r.konflikte[0], { teil: 'haus', zelle: zelle(), aktuell: { op: 'setze', block: { id: 'minecraft:glass' }, von: 'Anna' }, vorschlag: { op: 'setze', block: { id: 'minecraft:stone' } } });
  assert.deepEqual(r.planfassung.eintraege['haus|1,1,0'].block.id, 'minecraft:glass', 'Annas Änderung steht noch');
  assert.equal(r.planfassung.eintraege['haus|5,1,0'].block.id, 'minecraft:stone', 'die andere Operation wurde angenommen');
  // Ben glaubt, die Zelle sei leer, hat aber veraltet: auch ein Entfernen ist ein Konflikt
  const e = PF.wende(pf, [op('haus', zelle(), stein, null)], 'Ben');
  assert.deepEqual([e.konflikte.length, e.planfassung === pf], [1, true]);
  // wer auf null erwartet und die Zelle ist belegt: Konflikt; wer auf etwas erwartet und sie ist leer: Konflikt
  assert.equal(PF.wende(PF.leer(), [op('haus', zelle(), glas, stein)], 'Ben').konflikte[0].aktuell, null);
});

test('Planfassung: Eingaben werden streng geprüft, eine kaputte Operation lehnt die ganze Nachricht ab, Grenzen gelten', () => {
  const pf = PF.leer();
  const fehler = (ops, grund) => assert.throws(() => PF.wende(pf, ops, 'Anna'), (f) => f instanceof PF.PlanfassungFehler && f.grund === grund, grund);
  fehler([], 'form');
  fehler('nein', 'form');
  fehler([op('ha|us', zelle(), null, glas)], 'teil');
  fehler([op('', zelle(), null, glas)], 'teil');
  fehler([op('haus', { x: 1.5, y: 0, z: 0 }, null, glas)], 'zelle');
  fehler([op('haus', { x: 1e9, y: 0, z: 0 }, null, glas)], 'zelle');
  fehler([op('haus', zelle(), null, { op: 'zaubere' })], 'op');
  fehler([op('haus', zelle(), null, { op: 'setze' })], 'block');
  fehler([op('haus', zelle(), null, { op: 'setze', block: { id: 'glass' } })], 'block');
  fehler([op('haus', zelle(), null, { op: 'leere', block: glas.block })], 'block');
  fehler([op('haus', zelle(), null, { op: 'setze', block: { id: 'minecraft:stone', zustand: { x: 'a'.repeat(600) } } })], 'block');
  fehler([{ teil: 'haus', zelle: zelle(), neu: glas }], 'form');
  fehler([op('haus', zelle(), null, glas), op('haus', zelle(2), null, { op: 'kaputt' })], 'op'); // die gültige erste Operation wird nicht angewendet
  fehler(Array.from({ length: PF.PF_GRENZEN.operationen + 1 }, (_, i) => op('haus', zelle(i), null, glas)), 'zu-gross');
  // mehr Einträge als erlaubt
  let voll = PF.leer();
  for (let i = 0; i < PF.PF_GRENZEN.eintraege / 100; i++) voll = PF.wende(voll, Array.from({ length: 100 }, (_, j) => op('haus', zelle(i * 100 + j), null, glas)), 'Anna').planfassung;
  assert.equal(Object.keys(voll.eintraege).length, PF.PF_GRENZEN.eintraege);
  assert.throws(() => PF.wende(voll, [op('haus', zelle(-1), null, glas)], 'Anna'), (f) => f.grund === 'zu-gross');
  assert.ok(JSON.stringify(voll.eintraege).length <= PF.PF_GRENZEN.groesse, 'die tausend einfachen Einträge passen ins Gesamtbudget');
  // Gesamtbudget: wenige Einträge mit großem Zustand sprengen die Größe, auch wenn jeder einzeln erlaubt ist
  const grossStueck = (i) => op('haus', zelle(i), null, { op: 'setze', block: { id: 'minecraft:stone', zustand: { a: 'x'.repeat(480) } } });
  let breit = PF.leer();
  assert.throws(() => { for (let i = 0; i < 20; i++) breit = PF.wende(breit, Array.from({ length: 20 }, (_, j) => grossStueck(i * 20 + j)), 'Anna').planfassung; }, (f) => f.grund === 'zu-gross' && /zusammen größer/.test(f.message));
  assert.ok(JSON.stringify(breit.eintraege).length <= PF.PF_GRENZEN.groesse, 'was angenommen wurde, bleibt im Budget');
  assert.throws(() => PF.pruefeForm({ version: 1, eintraege: Object.fromEntries(Array.from({ length: 400 }, (_, i) => { const o = grossStueck(i); return [PF.schluessel(o.teil, o.zelle), { teil: o.teil, zelle: o.zelle, ...o.neu, von: 'A' }]; })) }), (f) => f.grund === 'zu-gross');
  // Versionsgrenze
  assert.throws(() => PF.wende({ version: PF.PF_GRENZEN.version, eintraege: {} }, [op('haus', zelle(), null, glas)], 'Anna'), (f) => f.grund === 'version');
  assert.throws(() => PF.pruefeForm({ version: Number.MAX_SAFE_INTEGER, eintraege: {} }), (f) => f.grund === 'form');
  // Form einer ganzen Planfassung (Raum, Link, Datei)
  assert.deepEqual(PF.pruefeForm(voll).version, voll.version);
  for (const [x, grund] of [[null, 'form'], [{ version: -1, eintraege: {} }, 'form'], [{ version: 0, eintraege: { 'haus|1,1,0': { teil: 'andere', zelle: zelle(), op: 'leere', von: 'A' } } }, 'schluessel'], [{ version: 0, eintraege: { 'haus|1,1,0': { teil: 'haus', zelle: zelle(), op: 'leere' } } }, 'von'], [{ version: 0, eintraege: { 'haus|1,1,0': { teil: 'haus', zelle: zelle(), op: 'setze', von: 'A' } } }, 'block']]) {
    assert.throws(() => PF.pruefeForm(x), (f) => f instanceof PF.PlanfassungFehler && f.grund === grund, grund);
  }
});

/** Ein Raum mit Anna und Ben; `sende` verarbeitet Nachrichten wie der Dienst und gibt je Verbindung zurück, was ankommt. */
function raumMit(...namen) {
  const z = { raum: neuerRaum(), post: new Map() };
  const sende = (von, m) => {
    const r = verarbeite(z.raum, liesNachricht(JSON.stringify(m)), von);
    z.raum = r.raum;
    for (const s of zustellungen(r.raum, r.senden, von)) { if (!z.post.has(s.an)) z.post.set(s.an, []); z.post.get(s.an).push(s.nachricht); }
    return r;
  };
  const klienten = {};
  const verteile = (id) => { const k = klienten[id]; const aus = []; for (const m of z.post.get(id) ?? []) { const r = k.beiNachricht(m); aus.push(...r.meldungen); for (const n of r.senden) sende(id, n); } z.post.set(id, []); return aus; };
  for (const [i, n] of namen.entries()) { const id = `v${i}`; klienten[id] = erzeugeKlient({ name: n }); for (const m of klienten[id].verbunden()) sende(id, m); }
  for (const id of Object.keys(klienten)) verteile(id);
  return { z, sende, klienten, verteile, ids: Object.keys(klienten) };
}

test('Live: zwei Spieler ändern dieselbe Zelle: der Zweite sieht den Konflikt, nichts wird still überschrieben, er entscheidet bewusst (behalten oder überschreiben)', () => {
  const R = raumMit('Anna', 'Ben');
  const [a, b] = R.ids, A = R.klienten[a], B = R.klienten[b];
  // beide kennen die Zelle als leer; Anna ist schneller
  for (const m of A.aendere('haus', zelle(), glas)) R.sende(a, m);
  const annasMeldungen = R.verteile(a);
  assert.deepEqual(annasMeldungen.map((m) => m.art), ['aenderungen-angenommen']);
  assert.equal(R.z.raum.aenderungen.version, 1);
  // Ben schickt, ohne Annas Nachricht schon verarbeitet zu haben (Nachricht noch unterwegs): Erwartung „leer“
  for (const m of B.aendere('haus', zelle(), stein)) R.sende(b, m);
  const bens = R.verteile(b); // Annas Rundsendung und der Konflikt kommen an
  const konflikt = bens.find((m) => m.art === 'aenderung-konflikt');
  assert.ok(konflikt, 'der Konflikt ist sichtbar');
  assert.deepEqual(konflikt.konflikte[0].aktuell, { op: 'setze', block: { id: 'minecraft:glass' }, von: 'Anna' });
  assert.equal(konflikt.konflikte[0].vorschlag.block.id, 'minecraft:stone');
  assert.equal(R.z.raum.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:glass', 'Annas Änderung gilt weiter');
  assert.equal(B.zustand.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:glass', 'Ben sieht jetzt den Stand des Raums');
  // „ihre behalten“: nichts wird gesendet
  assert.deepEqual(B.konfliktLoesen(konflikt.konflikte[0], 'ihre'), []);
  assert.throws(() => B.konfliktLoesen(konflikt.konflikte[0], 'vielleicht'), /meine/);
  // „meine“: bewusst überschreiben, mit dem aktuellen Eintrag als Erwartung
  for (const m of B.konfliktLoesen(konflikt.konflikte[0], 'meine')) R.sende(b, m);
  const nach = R.verteile(b);
  assert.deepEqual(nach.map((m) => m.art), ['aenderungen-angenommen']);
  assert.equal(R.z.raum.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:stone');
  assert.equal(R.z.raum.aenderungen.eintraege['haus|1,1,0'].von, 'Ben');
  assert.equal(R.z.raum.aenderungen.version, 2);
  const annas = R.verteile(a);
  assert.deepEqual(annas.map((m) => [m.art, m.von]), [['aenderungen', 'Ben']]);
  assert.equal(A.zustand.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:stone', 'auch Anna sieht den neuen Stand');
  assert.deepEqual(A.zustand.aenderungen, B.zustand.aenderungen, 'beide Spieler und der Raum stimmen überein');
  assert.deepEqual(A.zustand.aenderungen, R.z.raum.aenderungen);
});

test('Live: verschiedene Zellen kollidieren nie, ein später Dazukommender sieht den Stand, Entfernen verlangt den richtigen Stand', () => {
  const R = raumMit('Anna', 'Ben');
  const [a, b] = R.ids, A = R.klienten[a], B = R.klienten[b];
  for (const m of A.aendere('haus', zelle(1), glas)) R.sende(a, m);
  for (const m of B.aendere('haus', zelle(2), stein)) R.sende(b, m); // Ben kennt Annas Änderung noch nicht, aber andere Zelle
  R.verteile(a); R.verteile(b); R.verteile(a);
  assert.deepEqual(Object.keys(R.z.raum.aenderungen.eintraege).sort(), ['haus|1,1,0', 'haus|2,1,0']);
  assert.deepEqual(A.zustand.aenderungen, R.z.raum.aenderungen);
  assert.deepEqual(B.zustand.aenderungen, R.z.raum.aenderungen);
  // Nachzügler
  const C = erzeugeKlient({ name: 'Clara' });
  for (const m of C.verbunden()) R.sende('v9', m);
  const meldungen = (R.z.post.get('v9') ?? []).flatMap((m) => C.beiNachricht(m).meldungen);
  assert.deepEqual(meldungen.map((m) => m.art), ['zustand']);
  assert.deepEqual(C.zustand.aenderungen, R.z.raum.aenderungen);
  // Entfernen: Anna entfernt Bens Änderung mit dem Stand, den sie kennt
  for (const m of A.aendere('haus', zelle(2), null)) R.sende(a, m);
  assert.equal(R.verteile(a).filter((m) => m.art === 'aenderung-konflikt').length, 0, 'Anna kennt Bens Änderung');
  assert.deepEqual(Object.keys(R.z.raum.aenderungen.eintraege), ['haus|1,1,0']);
});

test('Live: Ablehnungen ändern den Raum nie; ohne Anmeldung nichts; ältere Räume ohne Änderungen funktionieren', () => {
  const R = raumMit('Anna');
  const [a] = R.ids;
  const vorher = R.z.raum;
  const abgelehnt = (m, grund, id = a) => { const r = R.sende(id, m); const x = r.senden.find((s) => s.nachricht.typ === 'abgelehnt'); assert.ok(x && x.nachricht.grund === grund, `${grund}: ${JSON.stringify(r.senden.map((s) => s.nachricht.typ))}`); assert.equal(R.z.raum, vorher, grund); };
  abgelehnt({ typ: 'aenderung', operationen: [op('haus', zelle(), null, { op: 'zaubere' })] }, 'op');
  abgelehnt({ typ: 'aenderung', operationen: [] }, 'form');
  abgelehnt({ typ: 'aenderung', operationen: [op('haus', zelle(), null, glas)] }, 'hallo', 'unbekannt');
  assert.ok(GRENZEN.nachricht >= 262144);
  // alter Raum ohne `aenderungen` (aus dem Speicher)
  const alt = { spezifikation: null, fortschritt: R.z.raum.fortschritt, spieler: R.z.raum.spieler };
  const r = verarbeite(alt, { typ: 'aenderung', operationen: [op('haus', zelle(), null, glas)] }, a);
  assert.equal(r.raum.aenderungen.version, 1);
  assert.equal(verarbeite(alt, { typ: 'ping' }, a).senden[0].nachricht.typ, 'pong');
});

test('Teilen: Änderungen reisen mit (Link und Datei), werden streng gelesen; zu viele Änderungen für einen Link sind eine klare Fehlermeldung, die Datei geht immer', async () => {
  const spezifikation = { schema: 1, version: 1, projekt: { name: 'Probe' }, teile: [] };
  let pf = PF.wende(PF.leer(), [op('haus', zelle(), null, glas), op('treppe', zelle(2, 0, 3), null, { op: 'leere' })], 'Anna').planfassung;
  const { code, zuLang } = await kodiere({ spezifikation, aenderungen: pf });
  assert.equal(zuLang, false);
  const zurueck = await dekodiere(code);
  assert.deepEqual(zurueck.aenderungen, pf);
  assert.deepEqual(importDatei(exportDatei({ spezifikation, aenderungen: pf })).aenderungen, pf);
  // ohne Änderungen kein Feld (wie bisher)
  assert.equal('aenderungen' in importDatei(exportDatei({ spezifikation })), false);
  assert.equal('aenderungen' in importDatei(exportDatei({ spezifikation, aenderungen: PF.leer() })), false);
  // kaputte Änderungen im Link oder in der Datei
  for (const kaputt of [{ version: 0, eintraege: 5 }, { version: 0, eintraege: { 'haus|1,1,0': { teil: 'haus', zelle: zelle(), op: 'zaubere', von: 'A' } } }]) {
    assert.throws(() => importDatei(JSON.stringify({ typ: 'blockwerk-projekt', version: 1, spezifikation, aenderungen: kaputt })), (f) => f instanceof TeilenFehler && /die Änderungen sind ungültig/.test(f.message));
  }
  // Link zu groß: Zufallstext lässt sich schlecht komprimieren; die Änderungen allein sprengen den Link nie (Gesamtbudget), mit einer großen Spezifikation schon
  let voll = PF.leer(), n = 0, zufall = 12345;
  const rnd = () => { zufall = (Math.imul(zufall, 1103515245) + 12345) >>> 0; return zufall.toString(36); };
  const zufallstext = (laenge) => { let s = ''; while (s.length < laenge) s += rnd(); return s.slice(0, laenge); };
  while (JSON.stringify(voll.eintraege).length < PF.PF_GRENZEN.groesse - 2000) {
    voll = PF.wende(voll, Array.from({ length: 2 }, () => op('haus', zelle(n++, 1, 0), null, { op: 'setze', block: { id: 'minecraft:stone', zustand: { a: zufallstext(200) } } })), 'Anna').planfassung;
  }
  const grosseSpezifikation = { ...spezifikation, notiz: zufallstext(190000) };
  await assert.rejects(() => kodiere({ spezifikation: grosseSpezifikation, aenderungen: voll }), (f) => f instanceof TeilenFehler && /für einen Link zu groß/.test(f.message) && /zu viele Änderungen/.test(f.message) && /als Datei sichern/.test(f.message));
  await kodiere({ spezifikation, aenderungen: voll }); // dieselben Änderungen mit kleiner Spezifikation gehen als Link
  assert.equal(importDatei(exportDatei({ spezifikation: grosseSpezifikation, aenderungen: voll })).aenderungen.version, voll.version, 'die Datei verträgt es');
  assert.ok(CODE_MAX >= 200000);
});

test('Entwurf: die Planfassung wird zum Entwurf und zurück, mit gleichen Ids bei allen Spielern; die Auswirkung auf den Plan ist dieselbe wie bei direkten Änderungen', () => {
  const e3 = ebene3();
  let e = neuerEntwurf({ name: 'Plan' });
  e = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Haus', reihenfolge: 1 } }).entwurf;
  e = e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'bau.raum', ref: 'haus', parameter: { breite: 7, tiefe: 5, hoehe: 3 }, lage: { x: 0, y: 0, z: 0, drehung: 0 } } }).entwurf;
  const direkt = e3.aenderungen.setze(e3.aenderungen.setze(e, { teil: 'haus', zelle: { x: 2, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Anna').entwurf, { teil: 'haus', zelle: { x: 0, y: 0, z: 0 }, op: 'leere' }, 'Ben').entwurf;
  const pf = e3.aenderungen.zuPlanfassung(direkt);
  assert.deepEqual(Object.keys(pf.eintraege).sort(), ['haus|0,0,0', 'haus|2,1,0'].sort());
  for (const k of Object.keys(pf.eintraege)) assert.equal(k, PF.schluessel(pf.eintraege[k].teil, pf.eintraege[k].zelle), 'derselbe Schlüssel wie im Raum');
  PF.pruefeForm({ version: 1, eintraege: pf.eintraege });
  const hin = e3.aenderungen.ausPlanfassung(e, { version: 1, eintraege: pf.eintraege });
  assert.deepEqual(hin.aenderungen.map((a) => [a.id, a.teil, a.op, a.von]), [['C1', 'haus', 'leere', 'Ben'], ['C2', 'haus', 'setze', 'Anna']], 'Ids nach Schlüssel sortiert');
  assert.equal(hin.zaehler.aenderung, 3);
  const mat = e3.materialisiere(hin, { testmaterial: true }), matDirekt = e3.materialisiere(direkt, { testmaterial: true });
  assert.deepEqual([...mat.teile.get('T1').schluessel].sort(), [...matDirekt.teile.get('T1').schluessel].sort(), 'dieselben Blöcke wie bei direkten Änderungen');
  for (const k of [...mat.teile.get('T1').schluessel]) { const [x, y, z] = k.split(',').map(Number); assert.deepEqual(mat.welt.leseBlock(x, y, z), matDirekt.welt.leseBlock(x, y, z), `Block und Zustand bei ${k}`); }
  assert.deepEqual([...mat.aenderungen.values()].map((s) => s.status).sort(), ['angewandt', 'angewandt']);
  assert.deepEqual(e3.aenderungen.zuPlanfassung(hin).eintraege, pf.eintraege, 'Rundreise');
  // die Liste wird ersetzt, nicht vermischt
  const leerer = e3.aenderungen.ausPlanfassung(hin, PF.leer());
  assert.deepEqual(leerer.aenderungen, []);
  assert.throws(() => e3.aenderungen.ausPlanfassung(e, { version: 1, eintraege: { x: { teil: 'a', zelle: { x: 1, y: 1 }, op: 'leere', von: 'A', quelle: 'x' } } }));
});

test('Live: geht eine Rundsendung verloren, merkt der Klient die Versionslücke und holt den vollen Zustand nach; nichts bleibt dauerhaft veraltet', () => {
  const R = raumMit('Anna', 'Ben');
  const [a, b] = R.ids, A = R.klienten[a], B = R.klienten[b];
  for (const m of A.aendere('haus', zelle(1), glas)) R.sende(a, m);
  R.verteile(a);
  R.z.post.set(b, (R.z.post.get(b) ?? []).filter((m) => m.typ !== 'aenderungen')); // Bens Verbindung hat Annas erste Meldung verpasst
  assert.deepEqual(B.zustand.aenderungen.eintraege, {}, 'Ben weiß nichts');
  // Anna ändert eine andere Zelle: bei Ben kommt Version 2 an, er kennt erst Version 0: Lücke
  for (const m of A.aendere('haus', zelle(2), stein)) R.sende(a, m);
  R.verteile(a);
  const meldungen = R.verteile(b);
  assert.ok(meldungen.some((m) => m.art === 'zustand'), 'Ben hat den vollen Zustand geholt');
  assert.deepEqual(B.zustand.aenderungen, R.z.raum.aenderungen, 'beide Zellen sind bei Ben angekommen');
  assert.deepEqual(A.zustand.aenderungen, R.z.raum.aenderungen);
  // Konflikt auf einer Zelle, deren Änderung Ben verpasst hat: der Endstand kommt an, die Lücke wird geschlossen
  for (const m of A.aendere('haus', zelle(3), glas)) R.sende(a, m);
  R.verteile(a);
  R.z.post.set(b, (R.z.post.get(b) ?? []).filter((m) => m.typ !== 'aenderungen'));
  for (const m of B.aendere('haus', zelle(3), stein)) R.sende(b, m);
  const spaeter = R.verteile(b);
  assert.deepEqual(spaeter.filter((m) => m.art !== 'zustand').map((m) => [m.art, m.abgleich]), [['aenderung-konflikt', true]], 'der Konflikt wird gemeldet, auch wenn der Stand erst nachgeholt wird');
  assert.deepEqual(B.zustand.aenderungen, R.z.raum.aenderungen);
  assert.equal(R.z.raum.aenderungen.eintraege['haus|3,1,0'].block.id, 'minecraft:glass', 'nichts wurde überschrieben');
});

test('Live: mehrere Operationen auf derselben Zelle in einer Nachricht (Annahme, Konflikt, Annahme): der Absender endet beim Endstand des Raums', () => {
  const R = raumMit('Anna', 'Ben');
  const [a, b] = R.ids, A = R.klienten[a];
  R.sende(a, { typ: 'aenderung', operationen: [op('haus', zelle(), null, glas), op('haus', zelle(), null, stein), op('haus', zelle(), glas, stein)] });
  const meldungen = R.verteile(a);
  assert.ok(meldungen.some((m) => m.art === 'aenderung-konflikt'));
  assert.equal(R.z.raum.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:stone', 'Endstand des Raums');
  assert.equal(A.zustand.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:stone', 'der Absender hält denselben Endstand (nicht den Zwischenstand des Konflikts)');
  assert.deepEqual(A.zustand.aenderungen, R.z.raum.aenderungen);
  R.verteile(b);
  assert.deepEqual(R.klienten[b].zustand.aenderungen, R.z.raum.aenderungen, 'auch Ben');
  const konflikt = meldungen.find((m) => m.art === 'aenderung-konflikt').konflikte[0];
  assert.equal(konflikt.aktuell.block.id, 'minecraft:stone', 'der Konflikt nennt den Endstand der Zelle');
  const r = PF.wende(PF.leer(), [op('haus', zelle(), null, glas), op('haus', zelle(), null, stein), op('haus', zelle(), glas, stein)], 'Anna');
  assert.deepEqual(r.zellen.map((x) => [x.teil, x.zelle, x.aktuell.block.id]), [['haus', zelle(), 'minecraft:stone']]);
  assert.equal(r.konflikte[0].aktuell.block.id, 'minecraft:stone');
});

test('Klient: veraltete Nachrichten (kleinere Version) werden nicht angewendet und setzen neuere Stände nicht zurück', () => {
  const k = erzeugeKlient({ name: 'Ben' });
  k.beiNachricht({ typ: 'zustand', spezifikation: null, fortschritt: { eintraege: {}, uhr: 0 }, aenderungen: { version: 2, eintraege: { 'haus|1,1,0': { teil: 'haus', zelle: zelle(), op: 'setze', block: stein.block, von: 'Anna' } } }, spieler: ['Ben'] });
  const alt = { teil: 'haus', zelle: zelle(), neu: { op: 'setze', block: glas.block, von: 'Anna' } };
  const r1 = k.beiNachricht({ typ: 'aenderungen', von: 'Anna', version: 1, operationen: [alt] });
  assert.deepEqual([r1.meldungen, r1.senden], [[], []], 'ein älteres Delta wird ignoriert');
  assert.equal(k.zustand.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:stone');
  const r2 = k.beiNachricht({ typ: 'aenderung-ergebnis', version: 1, angenommen: [], konflikte: [], zellen: [{ teil: 'haus', zelle: zelle(), aktuell: { op: 'setze', block: glas.block, von: 'Anna' } }] });
  assert.equal(k.zustand.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:stone', 'eine veraltete Antwort setzt nichts zurück');
  assert.deepEqual([r2.meldungen, r2.senden], [[], []], 'eine veraltete Antwort ohne Konflikt wird still ignoriert (kein Abgleich nötig)');
  assert.equal(k.zustand.aenderungen.version, 2);
  const r3 = k.beiNachricht({ typ: 'aenderungen', von: 'Anna', version: 5, operationen: [alt] });
  assert.deepEqual([r3.meldungen.length, r3.senden], [0, [{ typ: 'hallo', name: 'Ben' }]], 'eine Lücke wird nicht angewendet, sondern löst den Abgleich aus');
  assert.equal(k.zustand.aenderungen.eintraege['haus|1,1,0'].block.id, 'minecraft:stone');
  // veraltete Antwort MIT Konflikt: der Vorschlag des Spielers geht nicht verloren, der Stand bleibt
  const konflikt = { teil: 'haus', zelle: zelle(), aktuell: { op: 'setze', block: glas.block, von: 'Anna' }, vorschlag: stein };
  const r4 = k.beiNachricht({ typ: 'aenderung-ergebnis', version: 1, angenommen: [], konflikte: [konflikt], zellen: [{ teil: 'haus', zelle: zelle(), aktuell: konflikt.aktuell }] });
  assert.deepEqual([r4.meldungen.map((x) => [x.art, x.abgleich]), r4.senden], [[['aenderung-konflikt', false]], []]);
  assert.equal(k.zustand.aenderungen.version, 2);
});

test('Klient: eine Antwort mit Versionslücke verändert den lokalen Stand nicht (kein halber Zwischenstand), meldet nur den Konflikt und holt einmal den vollen Zustand', () => {
  const k = erzeugeKlient({ name: 'Ben' });
  const stand = { version: 2, eintraege: { 'haus|1,1,0': { teil: 'haus', zelle: zelle(), op: 'setze', block: stein.block, von: 'Anna' } } };
  k.beiNachricht({ typ: 'zustand', spezifikation: null, fortschritt: { eintraege: {}, uhr: 0 }, aenderungen: stand, spieler: ['Ben'] });
  const vorher = structuredClone(k.zustand.aenderungen);
  const neuerEintrag = { op: 'setze', block: glas.block, von: 'Ben' };
  const konflikt = { teil: 'haus', zelle: zelle(7), aktuell: { op: 'leere', von: 'Anna' }, vorschlag: stein };
  const r = k.beiNachricht({ typ: 'aenderung-ergebnis', version: 5, angenommen: [{ teil: 'haus', zelle: zelle(5), neu: neuerEintrag }], konflikte: [konflikt], zellen: [{ teil: 'haus', zelle: zelle(5), aktuell: neuerEintrag }, { teil: 'haus', zelle: zelle(7), aktuell: konflikt.aktuell }] });
  assert.deepEqual(k.zustand.aenderungen, vorher, 'Einträge und Version bleiben genau wie vorher');
  assert.deepEqual(r.meldungen.map((x) => [x.art, x.abgleich]), [['aenderung-konflikt', true]], 'keine Annahme-Meldung, nur der Konflikt');
  assert.deepEqual(r.senden, [{ typ: 'hallo', name: 'Ben' }], 'genau ein Abgleich');
});
