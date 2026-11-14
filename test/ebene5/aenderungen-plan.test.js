// Einbau-Architektur Paket P8 in der echten Planung: manuelle Einzelblockänderungen am Bauteil, Plan und Haken, Maßänderung und Entscheidung von Jonah bei Verwaistem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation, laufe } from '../../tools/haus-sonde.js';

async function umgebung() {
  const e = await engine();
  const { erzeugeEbene5 } = await import('../../src/ebene5/index.js');
  const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen: null });
  return { e, e5 };
}
const abschnitt = (plan, id) => plan.abschnitte.find((a) => a.id === id);
const GLAS = { teil: 'erdgeschoss', zelle: { x: 2, y: 2, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } };

test('Änderungen im Plan: ein gesetzter Block steht im Plan, nur seine Schicht ändert den Abdruck, der Besitzer ist das Teil', async () => {
  const { e, e5 } = await umgebung();
  const ohne = await laufe(hausSpezifikation(VARIANTEN.klein), e, e5);
  assert.equal(ohne.status, 'fertig');
  const mit = e.ebene3.aenderungen.setze(ohne.entwurf, GLAS, 'Jonah').entwurf;
  const plan = e5.bauplan(mit);
  const a0 = abschnitt(ohne.plan, 'erdgeschoss'), a1 = abschnitt(plan, 'erdgeschoss');
  const verschieden = a1.schichten.filter((s, i) => s.abdruck !== a0.schichten[i].abdruck).map((s) => s.y);
  assert.equal(verschieden.length, 1, 'genau eine Schicht ändert ihren Abdruck');
  for (const id of ['obergeschoss', 'dach']) assert.deepEqual(abschnitt(plan, id).schichten.map((s) => s.abdruck), abschnitt(ohne.plan, id).schichten.map((s) => s.abdruck), id);
  const s = a1.schichten.find((x) => x.y === verschieden[0]);
  const glasIndex = a1.legende.findIndex((l) => l.id === 'minecraft:glass');
  assert.ok(glasIndex >= 0, 'Glas steht in der Legende');
  const i = Array.from({ length: s.n }, (_, j) => j).find((j) => s.b[j] === glasIndex);
  assert.ok(i !== undefined);
  assert.equal(a1.teile[s.p[i]].ref, 'erdgeschoss', 'der Besitzer ist das Teil, an dem die Änderung hängt');
  assert.equal(a1.bloecke, a0.bloecke, 'ein Wandblock wurde ersetzt, kein Block kam dazu');
  // ein Entfernen: ein Block weniger
  const weg = e.ebene3.aenderungen.setze(ohne.entwurf, { teil: 'erdgeschoss', zelle: { x: 0, y: 0, z: 0 }, op: 'leere' }, 'Jonah').entwurf;
  assert.equal(abschnitt(e5.bauplan(weg), 'erdgeschoss').bloecke, a0.bloecke - 1);
});

test('Änderungen: überstehen eine Maßänderung der Spezifikation und bleiben relativ zur Nordwest-Ecke des Teils', async () => {
  const { e, e5 } = await umgebung();
  const alt = e.ebene4.baue(e.ebene4.freigeben(hausSpezifikation(VARIANTEN.klein), 'sonde'));
  const mit = e.ebene3.aenderungen.setze(alt.entwurf, GLAS, 'Jonah').entwurf;
  const neu = hausSpezifikation(VARIANTEN.gross); neu.version = 2;
  const u = e.ebene4.aktualisiereBau(mit, e.ebene4.freigeben(neu, 'sonde'));
  assert.equal(u.status, 'fertig', JSON.stringify(u.rueckfragen));
  assert.equal(u.entwurf.aenderungen.length, 1);
  const mat = e.ebene3.materialisiere(u.entwurf);
  assert.equal(mat.aenderungen.get('C1').status, 'angewandt');
  const o = mat.aenderungen.get('C1').ort;
  assert.equal(mat.welt.leseBlock(o.x, o.y, o.z).id, 'minecraft:glass');
  // dieselbe Stelle wie in einem frischen Lauf mit der Änderung
  const frisch = e.ebene4.baue(e.ebene4.freigeben(neu, 'sonde'));
  const f2 = e.ebene3.aenderungen.setze(frisch.entwurf, GLAS, 'Jonah').entwurf;
  assert.deepEqual(e.ebene3.materialisiere(f2).aenderungen.get('C1').ort, o);
});

test('Verwaist: wird das Haus kleiner, fragt die Planung Jonah; verwerfen, neu verankern oder zulassen entscheidet er, nichts geschieht automatisch', async () => {
  const { e, e5 } = await umgebung();
  const ablauf = e.ebene3.ablauf;
  const gross = e.ebene4.baue(e.ebene4.freigeben(hausSpezifikation(VARIANTEN.mittel), 'sonde'));
  const fern = { teil: 'erdgeschoss', zelle: { x: 11, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }; // im mittleren Haus (Außenbreite 13) die Ostwand
  const mit = e.ebene3.aenderungen.setze(gross.entwurf, fern, 'Jonah').entwurf;
  const klein = hausSpezifikation(VARIANTEN.klein); klein.version = 2;
  const u = e.ebene4.aktualisiereBau(mit, e.ebene4.freigeben(klein, 'sonde'));
  assert.equal(u.status, 'wartet');
  assert.equal(u.entwurf.aenderungen.length, 1, 'die Änderung bleibt gespeichert');
  const frage = u.entwurf.rueckfragen.find((r) => r.status === 'offen');
  assert.equal(frage.art, 'aenderung');
  assert.deepEqual(frage.optionen.map((o) => o.id), ['verwerfen', 'verankern', 'zulassen']);
  assert.match(frage.frage, /Änderung C1 .* lässt sich nicht anwenden: die Zelle liegt nicht mehr im Teil/);
  assert.equal(e.ebene3.materialisiere(u.entwurf).aenderungen.get('C1').status, 'verwaist');
  assert.equal(e5.bauplan(u.entwurf).abschnitte.length, 3, 'der Plan lässt sich trotzdem berechnen, die Änderung wirkt nicht');
  // falsche Antworten werden abgelehnt
  assert.throws(() => ablauf.antworte(u.entwurf, frage.id, { option: 'abschnitt-neu' }), /Option „abschnitt-neu“ unbekannt/);
  assert.throws(() => ablauf.antworte(u.entwurf, frage.id, { option: 'verankern' }), /ganze Zahlen|ganzen Zahlen/);
  // 1. verwerfen
  const v = ablauf.fortsetzen(ablauf.antworte(u.entwurf, frage.id, { option: 'verwerfen' }));
  assert.equal(v.status, 'fertig');
  assert.equal(v.entwurf.aenderungen.length, 0);
  assert.ok(v.entwurf.bericht.some((b) => /Änderung C1 .* verworfen auf Entscheidung von Jonah/.test(b.satz)));
  // 2. neu verankern
  const n = ablauf.fortsetzen(ablauf.antworte(u.entwurf, frage.id, { option: 'verankern', zelle: { x: 4, y: 2, z: 0 } }));
  assert.equal(n.status, 'fertig');
  assert.deepEqual(n.entwurf.aenderungen.map((a) => [a.id, a.zelle]), [['C1', { x: 4, y: 2, z: 0 }]]);
  const mn = e.ebene3.materialisiere(n.entwurf);
  assert.equal(mn.aenderungen.get('C1').status, 'angewandt');
  assert.equal(mn.welt.leseBlock(mn.aenderungen.get('C1').ort.x, mn.aenderungen.get('C1').ort.y, mn.aenderungen.get('C1').ort.z).id, 'minecraft:glass');
  // 3. zulassen: die Änderung bleibt gespeichert, wirkt nicht, die Planung läuft weiter
  const z = ablauf.fortsetzen(ablauf.antworte(u.entwurf, frage.id, { option: 'zulassen' }));
  assert.equal(z.status, 'fertig');
  assert.equal(z.entwurf.aenderungen.length, 1);
  assert.equal(e.ebene3.materialisiere(z.entwurf).aenderungen.get('C1').status, 'verwaist');
  assert.ok(z.entwurf.bericht.some((b) => /entscheidet zur Änderung C1/.test(b.satz)));
  // eine schon beantwortete Rückfrage lässt sich nicht noch einmal beantworten
  assert.throws(() => ablauf.antworte(ablauf.antworte(u.entwurf, frage.id, { option: 'verwerfen' }), frage.id, { option: 'verwerfen' }), /schon beantwortet/);
});

test('Verwaist: wird die Änderung an eine weiterhin ungültige Zelle verankert, fragt die Planung erneut, bis Jonah eine gültige Lösung wählt', async () => {
  const { e } = await umgebung();
  const ablauf = e.ebene3.ablauf;
  const gross = e.ebene4.baue(e.ebene4.freigeben(hausSpezifikation(VARIANTEN.mittel), 'sonde'));
  const mit = e.ebene3.aenderungen.setze(gross.entwurf, { teil: 'erdgeschoss', zelle: { x: 11, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  const klein = hausSpezifikation(VARIANTEN.klein); klein.version = 2;
  const u = e.ebene4.aktualisiereBau(mit, e.ebene4.freigeben(klein, 'sonde'));
  const erste = u.entwurf.rueckfragen.find((r) => r.status === 'offen');
  const nochmal = ablauf.fortsetzen(ablauf.antworte(u.entwurf, erste.id, { option: 'verankern', zelle: { x: 10, y: 1, z: 0 } }));
  assert.equal(nochmal.status, 'wartet', 'die neue Zelle liegt weiterhin außerhalb des kleinen Hauses');
  const zweite = nochmal.entwurf.rueckfragen.find((r) => r.status === 'offen');
  assert.ok(zweite && zweite.id !== erste.id && zweite.art === 'aenderung');
  assert.match(zweite.frage, /Rahmenzelle \(10, 1, 0\)/);
  const fertig = ablauf.fortsetzen(ablauf.antworte(nochmal.entwurf, zweite.id, { option: 'verwerfen' }));
  assert.equal(fertig.status, 'fertig');
  assert.equal(fertig.entwurf.aenderungen.length, 0);
});
