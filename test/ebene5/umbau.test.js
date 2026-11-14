// Einbau-Architektur Paket P11: Umbauhinweise zwischen der zuletzt bestätigten und einer neuen Planfassung, Übernahme nur nach Bestätigung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson, alsText } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation, laufe } from '../../tools/haus-sonde.js';
import * as F from '../../src/ebene5/fortschritt.js';
import { hinweise, uebernahme, hinweisText } from '../../src/ebene5/umbau.js';

async function umgebung() {
  const e = await engine();
  const { erzeugeEbene5 } = await import('../../src/ebene5/index.js');
  const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen: null });
  return { e, e5 };
}
const alleHaken = (plan, nur = () => true) => F.haken(F.leer(), plan.abschnitte.flatMap((a) => a.schichten.filter((s) => nur(a, s)).map((s) => F.schluessel(a.id, s))), true, 'Jonah');
const abschnitt = (plan, id) => plan.abschnitte.find((a) => a.id === id);
const key = (c) => `${c.x},${c.y},${c.z}`;

test('Umbauhinweise: Treppe nachträglich in ein gebautes Erdgeschoss: die Deckenblöcke stehen als „entfernen“, die oberste Stufe „ersetzt“ die Decke, die übrigen Stufen „ergänzen“', async () => {
  const { e, e5 } = await umgebung();
  const ohne = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true }), e, e5);
  const mit = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true, treppe: true }), e, e5);
  const f = alleHaken(ohne.plan);
  const h = hinweise(ohne.plan, mit.plan, f);
  assert.equal(h.noetig, true);
  assert.ok(h.schichten.every((s) => s.abschnitt === 'erdgeschoss'), 'nur das Erdgeschoss ist betroffen, Obergeschoss und Dach nicht');
  // unabhängig aus den beiden Plänen und dem Besitz berechnet (P7)
  const eg = abschnitt(mit.plan, 'erdgeschoss'), eg0 = abschnitt(ohne.plan, 'erdgeschoss');
  const aussparung = new Set(eg.schichten.flatMap((s) => (s.aussparungen ?? []).map((q) => `${q.x},${s.y},${q.z}`)));
  const treppe = [];
  const vorher = new Set(eg0.schichten.flatMap((s) => Array.from({ length: s.n }, (_, i) => `${s.x[i]},${s.y},${s.z[i]}`)));
  for (const s of eg.schichten) for (let i = 0; i < s.n; i++) if (eg.teile[s.p[i]].ref === 'treppe') treppe.push(`${s.x[i]},${s.y},${s.z[i]}`);
  const entfernen = h.schichten.flatMap((s) => s.entfernen.map(key)), ersetzen = h.schichten.flatMap((s) => s.ersetzen.map(key)), ergaenzen = h.schichten.flatMap((s) => s.ergaenzen.map(key));
  assert.deepEqual(new Set(entfernen), aussparung, 'entfernen = die Aussparungen der Treppe (Durchbruch in der Decke)');
  assert.ok(entfernen.length > 0);
  assert.deepEqual(new Set(ersetzen), new Set(treppe.filter((c) => vorher.has(c))), 'ersetzen = Stufen, die an der Stelle eines alten Blocks stehen (Decke)');
  assert.deepEqual(new Set(ergaenzen), new Set(treppe.filter((c) => !vorher.has(c))), 'ergänzen = Stufen in bisher leerer Zelle');
  assert.equal(ersetzen.length + ergaenzen.length, treppe.length, 'jeder Stufenblock steht in genau einer der beiden Listen');
  assert.deepEqual(h.summe, { entfernen: entfernen.length, ersetzen: ersetzen.length, ergaenzen: ergaenzen.length, schichten: h.schichten.length });
  // die Deckenblöcke (Birkenbretter) sind es, die entfernt werden
  assert.ok(h.schichten.flatMap((s) => s.entfernen).every((c) => c.alt === 'minecraft:birch_planks' || /planks/.test(c.alt)));
  assert.ok(h.schichten.flatMap((s) => s.ersetzen).every((c) => /stairs/.test(c.neu) && c.alt !== c.neu));
  assert.match(hinweisText(h.schichten.find((s) => s.entfernen.length)), /^Abschnitt erdgeschoss, Höhe \d+: \d+ Blöcke entfernen/);
});

test('Umbauhinweise: nur gebaute Schichten bekommen Hinweise; unveränderte, ungebaute und fremde Schichten nicht', async () => {
  const { e, e5 } = await umgebung();
  const ohne = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true }), e, e5);
  const mit = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true, treppe: true }), e, e5);
  const voll = hinweise(ohne.plan, mit.plan, alleHaken(ohne.plan));
  const betroffeneHoehen = voll.schichten.map((s) => s.y);
  // nichts gebaut: keine Hinweise
  assert.deepEqual(hinweise(ohne.plan, mit.plan, F.leer()), { noetig: false, schichten: [], summe: { entfernen: 0, ersetzen: 0, ergaenzen: 0, schichten: 0 } });
  // nur die betroffenen Höhen sind gebaut, die anderen nicht: alle betroffenen Hinweise bleiben
  const nurBetroffene = hinweise(ohne.plan, mit.plan, alleHaken(ohne.plan, (a, s) => a.id === 'erdgeschoss' && betroffeneHoehen.includes(s.y)));
  assert.deepEqual(nurBetroffene, voll);
  // nur eine betroffene Höhe gebaut: nur diese bekommt einen Hinweis
  const eine = betroffeneHoehen[0];
  const h1 = hinweise(ohne.plan, mit.plan, alleHaken(ohne.plan, (a, s) => a.id === 'erdgeschoss' && s.y === eine));
  assert.deepEqual(h1.schichten.map((s) => s.y), [eine]);
  // nur unbetroffene Schichten gebaut (Obergeschoss, Dach): keine Hinweise
  assert.equal(hinweise(ohne.plan, mit.plan, alleHaken(ohne.plan, (a) => a.id !== 'erdgeschoss')).noetig, false);
  // derselbe Plan: keine Hinweise
  assert.equal(hinweise(ohne.plan, ohne.plan, alleHaken(ohne.plan)).noetig, false);
});

test('Umbauhinweise: Tür an eine andere Wand: alter Türblock wird zu Wand („ersetzen“), neue Stelle wird zur Tür; Fortschritt einer anderen Fassung zählt nicht', async () => {
  const { e, e5 } = await umgebung();
  const spec = (wand) => { const s = hausSpezifikation(VARIANTEN.klein, { tuer: true }); s.teile[0].form.groesse.tuerwand = wand; return s; };
  const sued = await laufe(spec(3), e, e5), nord = await laufe(spec(1), e, e5);
  const h = hinweise(sued.plan, nord.plan, alleHaken(sued.plan));
  assert.equal(h.noetig, true);
  const ersetzen = h.schichten.flatMap((s) => s.ersetzen);
  assert.equal(ersetzen.length, 4, 'zwei Türblöcke werden Wand, zwei Wandblöcke werden Tür');
  assert.equal(ersetzen.filter((c) => /door/.test(c.alt)).length, 2);
  assert.equal(ersetzen.filter((c) => /door/.test(c.neu)).length, 2);
  assert.equal(h.summe.entfernen + h.summe.ergaenzen, 0);
  // Haken, die nicht zu den alten Schichten gehören (falscher Abdruck), zählen nicht
  const fremd = F.haken(F.leer(), sued.plan.abschnitte.flatMap((a) => a.schichten.map((s) => `${a.id}|${s.y}|ffffffff`)), true, 'Jonah');
  assert.equal(hinweise(sued.plan, nord.plan, fremd).noetig, false);
});

/** Kleiner künstlicher Plan für die Randfälle (Richtung, verschwundene Schicht oder Abschnitt, Behälterinhalt). */
const plan = (abschnitte) => ({ abschnitte: abschnitte.map((a) => ({ id: a.id, legende: a.legende.map((id) => ({ id })), schichten: a.schichten.map((s) => ({ y: s.y, n: s.zellen.length, x: Int32Array.from(s.zellen.map((c) => c[0])), z: Int32Array.from(s.zellen.map((c) => c[1])), b: Uint16Array.from(s.zellen.map((c) => c[2])), r: Uint8Array.from(s.zellen.map((c) => c[3] ?? 0)), abdruck: s.abdruck })) })) });
const schluesselAlle = (p) => F.haken(F.leer(), p.abschnitte.flatMap((a) => a.schichten.map((s) => F.schluessel(a.id, s))), true, 'Jonah');

test('Umbauhinweise: Richtung, verschwundene Schicht, verschwundener Abschnitt und reine Abdruck-Änderung', () => {
  const alt = plan([
    { id: 'a', legende: ['stein', 'treppe'], schichten: [{ y: 0, abdruck: 'a0', zellen: [[0, 0, 0], [1, 0, 1, 1]] }, { y: 1, abdruck: 'a1', zellen: [[0, 0, 0]] }, { y: 2, abdruck: 'a2', zellen: [[5, 5, 0]] }] },
    { id: 'b', legende: ['glas'], schichten: [{ y: 0, abdruck: 'b0', zellen: [[0, 0, 0], [1, 0, 0]] }] },
    { id: 'c', legende: ['truhe'], schichten: [{ y: 0, abdruck: 'c0', zellen: [[0, 0, 0]] }] },
  ]);
  const neu = plan([
    { id: 'a', legende: ['stein', 'treppe'], schichten: [{ y: 0, abdruck: 'neu0', zellen: [[0, 0, 0], [1, 0, 1, 3]] }, { y: 2, abdruck: 'a2', zellen: [[5, 5, 0]] }] }, // Treppe dreht sich, Schicht 1 entfällt, Schicht 2 gleich
    { id: 'c', legende: ['truhe'], schichten: [{ y: 0, abdruck: 'c1', zellen: [[0, 0, 0]] }] },                                                                       // nur der Abdruck (z. B. Inhalt) ändert sich
  ]);
  const h = hinweise(alt, neu, schluesselAlle(alt));
  assert.deepEqual(h.schichten.map((s) => [s.abschnitt, s.y]), [['a', 0], ['a', 1], ['b', 0]], 'Abschnitt c: nur der Abdruck, kein Block ändert sich: kein Hinweis');
  assert.deepEqual(h.schichten[0].ersetzen, [{ x: 1, y: 0, z: 0, alt: 'treppe', neu: 'treppe', altRichtung: 1, neuRichtung: 3 }], 'nur die Richtung ändert sich');
  assert.deepEqual(h.schichten[1].entfernen, [{ x: 0, y: 1, z: 0, alt: 'stein' }], 'verschwundene Schicht: alles entfernen');
  assert.deepEqual(h.schichten[2].entfernen.map((c) => c.alt), ['glas', 'glas'], 'verschwundener Abschnitt: alles entfernen');
  assert.deepEqual(h.summe, { entfernen: 3, ersetzen: 1, ergaenzen: 0, schichten: 3 });
  // Eingaben bleiben unverändert, Ergebnis deterministisch
  const vorher = alsText(alt) + alsText(neu);
  assert.equal(alsText(hinweise(alt, neu, schluesselAlle(alt))), alsText(h));
  assert.equal(alsText(alt) + alsText(neu), vorher);
});

test('Übernahme: Hinweise verlangen die ausdrückliche Bestätigung, ohne gebaute Änderungen geht es sofort, der Fortschritt bleibt erhalten', async () => {
  const { e, e5 } = await umgebung();
  const ohne = await laufe(hausSpezifikation(VARIANTEN.klein), e, e5);
  const mit = await laufe(hausSpezifikation(VARIANTEN.klein, { treppe: true }), e, e5);
  const f = alleHaken(ohne.plan);
  const roh = uebernahme(ohne.plan, mit.plan, f);
  assert.equal(roh.status, 'bestaetigung-noetig');
  assert.equal(roh.fortschritt, undefined, 'nichts wird ohne Bestätigung übernommen');
  assert.ok(roh.hinweise.noetig);
  for (const nein of [false, undefined, 'ja', 1, null]) assert.equal(uebernahme(ohne.plan, mit.plan, f, { bestaetigt: nein }).status, 'bestaetigung-noetig', String(nein));
  const ok = uebernahme(ohne.plan, mit.plan, f, { bestaetigt: true });
  assert.equal(ok.status, 'uebernommen');
  assert.equal(ok.fortschritt, f);
  // unveränderte Schichten behalten ihren Haken in der neuen Fassung, geänderte gebaute sind dort offen
  const geaendert = new Set(roh.hinweise.schichten.map((s) => `${s.abschnitt}|${s.y}`));
  for (const a of mit.plan.abschnitte) for (const s of a.schichten) assert.equal(F.istAbgehakt(f, F.schluessel(a.id, s)), !geaendert.has(`${a.id}|${s.y}`), `${a.id} ${s.y}`);
  // nichts gebaut oder nichts geändert: sofort übernommen, ohne Bestätigung
  assert.equal(uebernahme(ohne.plan, mit.plan, F.leer()).status, 'uebernommen');
  assert.equal(uebernahme(ohne.plan, ohne.plan, f).status, 'uebernommen');
});
