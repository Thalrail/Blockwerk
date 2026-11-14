// U0 (Oberfläche für Bearbeiten): stabile Projektkennung `projekt.id` über Fassungen, Export/Import, Raum; Wand-Ausrichtung ist Sache der Wandseite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from './hilfe5.js';
import { abdruck, PROJEKT_ID } from '../../src/ebene4/spezifikation.js';
import * as P from '../../src/ebene5/projektid.js';
import * as teilen from '../../src/ebene5/teilen.js';
import { berichtAlsText } from '../../src/ebene3/index.js';
import { verarbeite, neuerRaum } from '../../src/ebene5/live.js';

const bytes = (n) => Uint8Array.from({ length: 16 }, (_, i) => (n + i * 7) % 256);
const ID_A = P.neueId(bytes(1)), ID_B = P.neueId(bytes(2));

const beispiel = async () => { const s = await holeJson('data/beispiele/zitadelle-klein.json'); delete s.freigabe; return s; };
const frei = (e, spec, von = 'jonah') => e.ebene4.freigeben(spec, von);

test('Kennung: Form, Erzeugung aus 16 Zufallsbytes, ungültige Eingaben werden abgelehnt', () => {
  assert.match(ID_A, PROJEKT_ID);
  assert.equal(ID_A, 'p-' + [...bytes(1)].map((b) => b.toString(16).padStart(2, '0')).join(''));
  assert.notEqual(ID_A, ID_B, 'verschiedene Bytes, verschiedene Kennungen');
  assert.equal(P.neueId(bytes(1)), ID_A, 'gleiche Bytes, gleiche Kennung (deterministisch, der Zufall steckt nur in der Oberfläche)');
  for (const falsch of [null, undefined, [], new Uint8Array(15), new Uint8Array(17), [...bytes(1)].map((b, i) => (i ? b : 256)), [...bytes(1)].map((b, i) => (i ? b : 1.5)), [...bytes(1)].map((b, i) => (i ? b : -1))]) assert.throws(() => P.neueId(falsch), /16 Zufallsbytes/);
  for (const nein of ['', 'p-', 'p-XYZ', 'P-' + ID_A.slice(2), ID_A.toUpperCase(), ID_A + '0', ID_A.slice(0, -1), 'x-' + ID_A.slice(2), 12]) assert.equal(PROJEKT_ID.test(nein), false, String(nein));
  assert.equal(P.idVon({ projekt: { id: ID_A } }), ID_A);
  assert.equal(P.idVon({ projekt: { id: 'kaputt' } }), null);
  assert.equal(P.idVon({ projekt: {} }), null);
  assert.equal(P.idVon(null), null);
});

test('Die Kennung ist kein Inhalt: Abdruck, Freigabe und Vergleich bleiben gleich, der Prüfer akzeptiert sie und lehnt Unform ab', async () => {
  const e = await engine();
  const s = await beispiel();
  const ohne = frei(e, s), mit = frei(e, P.mitId(s, ID_A));
  assert.equal(abdruck(P.mitId(s, ID_A)), abdruck(s), 'der Abdruck ignoriert projekt.id');
  assert.equal(mit.freigabe.abdruck, ohne.freigabe.abdruck);
  // eine Kennung nachträglich zu vergeben, hebt die Freigabe nicht auf
  assert.equal(e.ebene4.istFreigegeben(P.mitId(ohne, ID_A)), true);
  assert.equal(e.ebene4.istFreigegeben(P.mitId(mit, ID_B)), true);
  // ändert sich der Inhalt, ändert sich der Abdruck weiterhin
  const anders = P.mitId(s, ID_A); anders.projekt.name += '!';
  assert.notEqual(abdruck(anders), abdruck(s));
  // der Vergleich zweier Fassungen zeigt eine andere Kennung nicht als Änderung
  assert.deepEqual(e.ebene4.vergleiche(P.mitId(s, ID_A), P.mitId(s, ID_B)), { projekt: [], hinzugefuegt: [], entfernt: [], geaendert: [] });
  assert.deepEqual(e.ebene4.vergleiche(s, P.mitId(s, ID_A)).projekt, []);
  // Prüfer
  assert.deepEqual(e.ebene4.pruefe(P.mitId(s, ID_A)).rueckfragen, e.ebene4.pruefe(s).rueckfragen);
  for (const falsch of ['abc', 7, null, ID_A.toUpperCase(), '']) {
    const t = await beispiel(); t.projekt.id = falsch;
    const q = e.ebene4.pruefe(t).rueckfragen.filter((x) => x.pfad === 'projekt.id');
    assert.equal(q.length, 1, JSON.stringify(falsch));
    assert.match(q[0].frage, /Projektkennung .* hat nicht die Form p-<32 Hexzeichen>/);
    assert.ok(q[0].optionen.some((o) => o.id === 'entfernen'));
    assert.throws(() => e.ebene4.freigeben(t), /Rückfrage/);
  }
});

test('Die Kennung beeinflusst weder Geometrie noch Planung: Plan, Material und Bericht sind byte-identisch mit und ohne Kennung (verschiedene Kennungen auch)', async () => {
  const e = await engine();
  const bauen = (spec) => {
    const r = e.ebene4.baue(frei(e, spec));
    const plan = e.e5.bauplan(r.entwurf);
    return JSON.stringify([plan, e.e5.material(plan), berichtAlsText(r.entwurf), r.entwurf.abschnitte.map((a) => a.id)]);
  };
  const s = await beispiel();
  const x = bauen(s);
  assert.equal(bauen(P.mitId(s, ID_A)), x);
  assert.equal(bauen(P.mitId(s, ID_B)), x);
  assert.ok(x.length > 1000);
});

test('Neue unabhängige Projekte bekommen verschiedene Kennungen, auch bei gleichem Inhalt; eine eigenständige Kopie trennt sich vom Original', async () => {
  const s = await beispiel();
  const a = P.uebernehme(null, s, { bytes: bytes(10) }), b = P.uebernehme(null, s, { bytes: bytes(11) });
  assert.equal(a.art, 'neu'); assert.equal(a.vergeben, true);
  assert.notEqual(a.kennung, b.kennung);
  assert.equal(a.spec.projekt.id, a.kennung);
  assert.equal(s.projekt.id, undefined, 'die Eingabe wird nicht verändert');
  // eigenständige Kopie: gleicher Inhalt, neue Kennung
  const k = P.eigenstaendigeKopie(a.spec, bytes(12));
  assert.notEqual(P.idVon(k), a.kennung);
  assert.equal(abdruck(k), abdruck(a.spec));
  assert.equal(P.bezug(a.spec, k).art, 'unabhaengig', 'Kopie und Original werden nie vermischt');
  assert.throws(() => P.uebernehme(null, s, {}), /16 Zufallsbytes/);
});

test('Fortsetzung oder Kopie: dieselbe Kennung = Fortsetzung (auch bei geändertem Namen), andere Kennung = unabhängig (auch bei gleichem Namen)', async () => {
  const s = await beispiel();
  const v1 = P.mitId(s, ID_A);
  const v2 = P.mitId({ ...s, version: 2, projekt: { ...s.projekt, name: 'Umbenannt' } }, ID_A);
  assert.deepEqual(P.bezug(null, v1), { art: 'neu' });
  assert.equal(P.bezug(v1, v1).art, 'gleich');
  assert.equal(P.bezug(v1, v2).art, 'fortsetzung', 'Umbenennen verliert die Zugehörigkeit nicht');
  const fremd = P.mitId(s, ID_B);
  assert.equal(P.bezug(v1, fremd).art, 'unabhaengig', 'gleicher Name und Inhalt, aber andere Kennung: nie vermischen');
  assert.equal(P.uebernehme(v1, v2).kennung, ID_A);
  assert.equal(P.uebernehme(v1, v2).vergeben, false);
  assert.equal(P.uebernehme(v1, fremd).art, 'unabhaengig');
  assert.equal(P.uebernehme(v1, fremd).kennung, ID_B, 'die Kennung der ankommenden Seite bleibt');
});

test('Altbestand ohne Kennung wird kontrolliert übernommen: ohne Entscheidung Fehler, danach Fortsetzung oder eigenständig; nichts wird geraten', async () => {
  const s = await beispiel();
  const alt = s, neuAlt = { ...s, version: 2 };
  const b = P.bezug(alt, neuAlt);
  assert.deepEqual([b.art, b.nameGleich, b.inhaltGleich], ['unklar', true, false]);
  assert.equal(P.bezug(alt, P.mitId(neuAlt, ID_A)).art, 'unklar', 'nur eine Seite hat eine Kennung');
  assert.equal(P.bezug(P.mitId(alt, ID_A), neuAlt).art, 'unklar');
  assert.equal(P.bezug(alt, { ...s, projekt: { ...s.projekt, name: 'Anderes' } }).nameGleich, false);
  assert.throws(() => P.uebernehme(alt, neuAlt, { bytes: bytes(1) }), /unklar.*Benutzer muss entscheiden/);
  assert.throws(() => P.uebernehme(alt, neuAlt, { entscheidung: 'raten', bytes: bytes(1) }), /unklar/);
  // Fortsetzung zweier Altbestände: das Projekt bekommt eine neue Kennung
  const f = P.uebernehme(alt, neuAlt, { entscheidung: 'fortsetzung', bytes: bytes(5) });
  assert.deepEqual([f.art, f.vergeben], ['fortsetzung', true]);
  assert.equal(f.spec.projekt.id, f.kennung);
  // Fortsetzung eines Projekts mit Kennung durch eine Fassung ohne: die vorhandene Kennung gilt
  const g = P.uebernehme(P.mitId(alt, ID_A), neuAlt, { entscheidung: 'fortsetzung' });
  assert.deepEqual([g.kennung, g.vergeben], [ID_A, false]);
  // Fortsetzung eines Altbestands durch eine Fassung mit Kennung: die ankommende Kennung gilt
  const h = P.uebernehme(alt, P.mitId(neuAlt, ID_B), { entscheidung: 'fortsetzung' });
  assert.deepEqual([h.kennung, h.vergeben], [ID_B, false]);
  // eigenständig: neue Kennung (oder die ankommende, falls sie eine hat)
  const n = P.uebernehme(P.mitId(alt, ID_A), neuAlt, { entscheidung: 'neu', bytes: bytes(6) });
  assert.deepEqual([n.art, n.vergeben, n.kennung === ID_A], ['neu', true, false]);
  assert.equal(P.uebernehme(alt, P.mitId(neuAlt, ID_B), { entscheidung: 'neu' }).kennung, ID_B);
  // ohne offenes Projekt bekommt ein Altbestand eine Kennung, ohne zu fragen
  assert.equal(P.uebernehme(null, alt, { bytes: bytes(7) }).vergeben, true);
  assert.throws(() => P.mitId(alt, 'kaputt'), /Form/);
  assert.throws(() => P.mitId({ teile: [] }, ID_A), /kein Projekt/);
});

test('Export und Import (Datei und Link) erhalten die Kennung; alte Dateien und Links ohne Kennung bleiben lesbar', async () => {
  const e = await engine();
  const s = frei(e, P.mitId(await beispiel(), ID_A));
  const datei = teilen.importDatei(teilen.exportDatei({ spezifikation: s }));
  assert.equal(P.idVon(datei.spezifikation), ID_A);
  assert.equal(abdruck(datei.spezifikation), s.freigabe.abdruck);
  const { code } = await teilen.kodiere({ spezifikation: s });
  assert.equal(P.idVon((await teilen.dekodiere(code)).spezifikation), ID_A);
  assert.equal(P.idVon((await teilen.ausLink((await teilen.link('https://beispiel.invalid/', { spezifikation: s })).link)).spezifikation), ID_A);
  // Altbestand: eine Datei ohne Kennung (wie vor U0) wird weiterhin angenommen und bleibt ohne Kennung
  const alt = frei(e, await beispiel());
  const altDatei = teilen.importDatei(teilen.exportDatei({ spezifikation: alt }));
  assert.equal(P.idVon(altDatei.spezifikation), null);
  assert.equal((await teilen.dekodiere((await teilen.kodiere({ spezifikation: alt })).code)).spezifikation.projekt.id, undefined);
  // dasselbe Projekt, einmal mit und einmal ohne Kennung exportiert: gleicher Abdruck, die Freigabe gilt in beiden
  assert.equal(e.ebene4.istFreigegeben(datei.spezifikation), true);
  assert.equal(e.ebene4.istFreigegeben(altDatei.spezifikation), true);
  assert.equal(datei.spezifikation.freigabe.abdruck, altDatei.spezifikation.freigabe.abdruck);
});

test('Raum: die Kennung bleibt erhalten; ein anderes Projekt oder ein Plan ohne Kennung kommt nicht in einen Raum mit Kennung', async () => {
  const e = await engine();
  const fassung = (id, version = 1, name = 'Probe') => {
    const s = { ...e.ebene4 && {}, ...JSON.parse(JSON.stringify({ schema: 1, version, projekt: { name, bauplatz: { breite: 20, hoehe: 10, tiefe: 20 } }, teile: [] })) };
    if (id) s.projekt.id = id;
    s.freigabe = { von: 'jonah', version, abdruck: abdruck(s) };
    return s;
  };
  let raum = verarbeite(neuerRaum(), { typ: 'hallo', name: 'Anna' }, 'a').raum;
  const plan = (r, spec, basis) => verarbeite(r, { typ: 'plan', basis, spezifikation: spec }, 'a');
  // leerer Raum nimmt eine Fassung mit Kennung an; die nächste Fassung derselben Kennung ebenfalls
  let r = plan(raum, fassung(ID_A, 1), 0); assert.equal(r.raum.spezifikation.projekt.id, ID_A); raum = r.raum;
  r = plan(raum, fassung(ID_A, 2, 'Umbenannt'), 1); assert.equal(r.raum.spezifikation.version, 2, 'Umbenennen ist eine Fortsetzung'); raum = r.raum;
  // andere Kennung: abgelehnt, Raum unverändert
  const vorher = JSON.stringify(raum);
  r = plan(raum, fassung(ID_B, 3), 2);
  assert.equal(r.senden[0].nachricht.grund, 'projekt'); assert.match(r.senden[0].nachricht.text, /anderen Projekt/); assert.equal(JSON.stringify(r.raum), vorher);
  // keine Kennung: abgelehnt
  r = plan(raum, fassung(null, 3), 2);
  assert.equal(r.senden[0].nachricht.grund, 'projekt'); assert.match(r.senden[0].nachricht.text, /fehlt die Projektkennung/); assert.equal(JSON.stringify(r.raum), vorher);
  // Unform: abgelehnt
  r = plan(raum, fassung('murks', 3), 2);
  assert.equal(r.senden[0].nachricht.grund, 'form'); assert.equal(JSON.stringify(r.raum), vorher);
  // Räume ohne Kennung (Altbestand) nehmen weiterhin Fassungen ohne Kennung an und dürfen eine Kennung erhalten
  let alt = verarbeite(neuerRaum(), { typ: 'hallo', name: 'Anna' }, 'a').raum;
  alt = plan(alt, fassung(null, 1), 0).raum;
  alt = plan(alt, fassung(null, 2), 1).raum; assert.equal(alt.spezifikation.version, 2);
  alt = plan(alt, fassung(ID_A, 3), 2).raum; assert.equal(alt.spezifikation.projekt.id, ID_A, 'der Altbestand wird mit der Kennung fortgesetzt');
});

test('Eine vorhandene, aber ungültige Kennung ist ein Fehler und wird nie stillschweigend ersetzt (Zuordnung, Übernahme, Datei, Link)', async () => {
  const s = await beispiel();
  for (const falsch of ['murks', '', 7, null, ID_A.toUpperCase(), ID_A + '0']) {
    const t = JSON.parse(JSON.stringify(s)); t.projekt.id = falsch;
    assert.throws(() => P.bezug(null, t), /Projektkennung .* hat nicht die Form/, JSON.stringify(falsch));
    assert.throws(() => P.bezug(P.mitId(s, ID_A), t), /Projektkennung/);
    assert.throws(() => P.uebernehme(null, t, { bytes: bytes(1) }), /Projektkennung/);
    assert.throws(() => P.uebernehme(P.mitId(s, ID_A), t, { entscheidung: 'neu', bytes: bytes(1) }), /Projektkennung/);
    assert.throws(() => teilen.importDatei(JSON.stringify({ typ: teilen.TYP, version: teilen.VERSION, spezifikation: t })), /Projektkennung ist ungültig/);
  }
  const kaputt = JSON.parse(JSON.stringify(s)); kaputt.projekt.id = 'murks';
  await assert.rejects(async () => teilen.dekodiere((await teilen.kodiere({ spezifikation: kaputt })).code), /Projektkennung ist ungültig/);
  // ein wirklich fehlendes Feld bleibt Altbestand, auch wenn es im Objekt `undefined` ist
  const leer = JSON.parse(JSON.stringify(s)); leer.projekt.id = undefined;
  assert.equal(P.bezug(null, leer).art, 'neu');
});
