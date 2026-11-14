// Einbau-Architektur Paket P7: der Bauplan kennt den Besitz je Zelle (welches Teil) und zeigt Aussparungen; der Haken einer Schicht fällt nur, wenn sich ihre Blöcke ändern.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson, alsText } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation, laufe } from '../../tools/haus-sonde.js';
import * as fortschritt from '../../src/ebene5/fortschritt.js';
import { definiere } from '../../src/ebene2/index.js';

async function umgebung() {
  const e = await engine();
  const { erzeugeEbene5 } = await import('../../src/ebene5/index.js');
  const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen: null });
  return { e, e5 };
}
const zellen = (schicht) => new Set(Array.from({ length: schicht.n }, (_, i) => `${schicht.x[i]},${schicht.z[i]}`));
const schichtBei = (a, y) => a.schichten.find((s) => s.y === y);
const abschnitt = (plan, id) => plan.abschnitte.find((a) => a.id === id);
const hoehen = (a) => a.schichten.map((s) => s.y);

test('Bauplan: jede Zelle gehört genau einem Teil; Kinder stehen im Abschnitt ihres Trägers mit Träger und Blockzahl', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true, treppe: true }), e, e5);
  assert.equal(r.status, 'fertig');
  const eg = abschnitt(r.plan, 'erdgeschoss');
  assert.deepEqual(eg.teile.map((t) => [t.ref, t.traeger]), [['erdgeschoss', null], ['treppe', 'erdgeschoss']]);
  const treppe = eg.teile.find((t) => t.ref === 'treppe');
  assert.equal(treppe.baustein, 'bau.treppe');
  assert.equal(treppe.name, 'Treppe');
  // die Besitzkarte deckt alle Zellen, jede Zelle hat einen gültigen Besitzer, Summen stimmen mit den Blockzahlen überein
  const jeTeil = new Array(eg.teile.length).fill(0);
  for (const s of eg.schichten) {
    assert.equal(s.p.length, s.n);
    assert.equal(zellen(s).size, s.n, `Höhe ${s.y}: jede Zelle nur einmal`);
    for (let i = 0; i < s.n; i++) { assert.ok(s.p[i] < eg.teile.length, 'gültiger Besitzer'); jeTeil[s.p[i]]++; }
  }
  assert.deepEqual(jeTeil, eg.teile.map((t) => t.bloecke), 'Blöcke je Teil stimmen mit der Besitzkarte überein');
  assert.equal(jeTeil.reduce((a, b) => a + b, 0), eg.bloecke);
  assert.ok(treppe.bloecke > 0 && treppe.bloecke < eg.bloecke);
  // die Besitzkarte stimmt mit dem Zusammenbau überein: die Zellen der Treppe sind genau die Zellen mit ihrem Besitz
  const mat = e.ebene3.materialisiere(r.entwurf);
  const treppeId = r.entwurf.teile.find((t) => t.ref === 'treppe').id;
  const aus = new Set();
  for (const s of eg.schichten) for (let i = 0; i < s.n; i++) if (eg.teile[s.p[i]].ref === 'treppe') aus.add(`${s.x[i]},${s.y},${s.z[i]}`);
  assert.deepEqual(aus, mat.teile.get(treppeId).schluessel);
  // andere Abschnitte: nur ihr eigenes Teil, keine Aussparungen
  for (const id of ['obergeschoss', 'dach']) {
    const a = abschnitt(r.plan, id);
    assert.equal(a.teile.length, 1, id);
    assert.equal(a.aussparungen, 0, id);
    assert.ok(a.schichten.every((s) => s.aussparungen === undefined && s.p.every((p) => p === 0)), id);
  }
});

test('Bauplan: Aussparungen: der Durchbruch für die Treppe steht in der Decke, ist leer, nennt Kind und Träger und passt zum Plan ohne Treppe', async () => {
  const { e, e5 } = await umgebung();
  const mit = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true, treppe: true }), e, e5);
  const ohne = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true }), e, e5);
  const a = abschnitt(mit.plan, 'erdgeschoss'), a0 = abschnitt(ohne.plan, 'erdgeschoss');
  assert.equal(a0.aussparungen, 0);
  assert.ok(a.aussparungen > 0);
  const liste = a.schichten.flatMap((s) => (s.aussparungen ?? []).map((q) => ({ ...q, y: s.y })));
  assert.equal(liste.length, a.aussparungen, 'die Zahl am Abschnitt stimmt mit den Einträgen überein');
  assert.ok(liste.every((q) => q.kind === 'treppe' && q.traeger === 'erdgeschoss' && q.art === 'freihaltung'));
  // unabhängig: fehlt in der Schicht eine Zelle gegenüber dem Plan ohne Treppe, ist sie eine Aussparung oder von der Treppe belegt
  let erwartet = 0;
  for (const s0 of a0.schichten) {
    const s = schichtBei(a, s0.y);
    const hier = (s?.aussparungen ?? []).map((q) => `${q.x},${q.z}`).sort();
    const fehlt = [...zellen(s0)].filter((c) => !zellen(s).has(c)).sort();
    assert.deepEqual(hier, fehlt, `Höhe ${s0.y}: Aussparungen = Zellen, die gegenüber dem Plan ohne Treppe fehlen`);
    for (const q of s?.aussparungen ?? []) assert.ok(!zellen(s).has(`${q.x},${q.z}`), 'eine Aussparung ist leer');
    erwartet += fehlt.length;
  }
  assert.equal(erwartet, a.aussparungen);
  // alle Aussparungen liegen in der Decke oder darunter, innerhalb der Hülle, sortiert nach z und x
  for (const s of a.schichten) {
    const l = s.aussparungen ?? [];
    assert.deepEqual(l, [...l].sort((p, q) => p.z - q.z || p.x - q.x));
  }
});

test('Haken: ein Treppeneinbau lässt nur die Schichten fallen, die sich ändern; Obergeschoss und Dach behalten ihre Haken', async () => {
  const { e, e5 } = await umgebung();
  const ohne = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true }), e, e5);
  const mit = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true, treppe: true }), e, e5);
  // alles abhaken im Plan ohne Treppe, dann prüfen, welche Haken im neuen Plan noch gelten
  let f = fortschritt.leer();
  f = fortschritt.haken(f, ohne.plan.abschnitte.flatMap((a) => a.schichten.map((s) => fortschritt.schluessel(a.id, s))), true, 'Jonah');
  const gelten = (a, s) => fortschritt.istAbgehakt(f, fortschritt.schluessel(a.id, s));
  const berührt = new Set();
  for (const a of mit.plan.abschnitte) for (const s of a.schichten) {
    const alt = abschnitt(ohne.plan, a.id)?.schichten.find((x) => x.y === s.y);
    // unabhängig berechnet: die Schicht ändert sich genau dann, wenn Treppenblöcke oder Aussparungen in ihr liegen
    const trifft = a.teile.length > 1 && (s.p.some((p) => a.teile[p].ref === 'treppe') || (s.aussparungen ?? []).length > 0);
    assert.equal(gelten(a, s), !trifft, `${a.id}, Höhe ${s.y}: Haken ${trifft ? 'fällt' : 'bleibt'}`);
    assert.equal(alt !== undefined && alt.abdruck === s.abdruck, !trifft);
    if (trifft) berührt.add(`${a.id}|${s.y}`);
  }
  assert.ok(berührt.size >= 2 && [...berührt].every((k) => k.startsWith('erdgeschoss|')), 'nur Schichten des Erdgeschosses (Treppe und Decke) fallen');
  const gesamt = mit.plan.abschnitte.reduce((s, a) => s + a.schichten.length, 0);
  assert.ok(berührt.size < gesamt / 2, 'die meisten Haken bleiben');
});

test('Haken: eine Innentür in der Trennwand ändert genau die Schichten, in denen die Tür steht; Besitzänderungen allein ändern keinen Abdruck', async () => {
  const { e, e5 } = await umgebung();
  const ohneTuer = hausSpezifikation(VARIANTEN.klein, { trennwand: true });
  ohneTuer.teile = ohneTuer.teile.filter((t) => t.id !== 'innentuer');
  const a0 = await laufe(ohneTuer, e, e5);
  const a1 = await laufe(hausSpezifikation(VARIANTEN.klein, { trennwand: true }), e, e5);
  assert.equal(a0.status, 'fertig');
  assert.equal(a1.status, 'fertig');
  const eg0 = abschnitt(a0.plan, 'erdgeschoss'), eg1 = abschnitt(a1.plan, 'erdgeschoss');
  assert.equal(eg0.teile.length, 2);
  assert.equal(eg1.teile.length, 3, 'Haus, Trennwand, Innentür');
  const tuerYs = new Set(eg1.schichten.filter((s) => s.p.some((p) => eg1.teile[p].ref === 'innentuer')).map((s) => s.y));
  assert.ok(tuerYs.size === 2, 'die Tür ist zwei Blöcke hoch');
  const geaendert = new Set(eg1.schichten.filter((s) => schichtBei(eg0, s.y).abdruck !== s.abdruck).map((s) => s.y));
  assert.deepEqual(geaendert, tuerYs, 'genau die Schichten der Tür ändern ihren Abdruck');
  for (const id of ['obergeschoss', 'dach']) assert.deepEqual(abschnitt(a0.plan, id).schichten.map((s) => s.abdruck), abschnitt(a1.plan, id).schichten.map((s) => s.abdruck), id);
  // die Tür steht in der Öffnung der Wand: die Wand verliert zwei Zellen, die Tür füllt sie, die Blockzahl bleibt gleich, nur der Besitz wechselt
  assert.equal(eg1.bloecke, eg0.bloecke);
  assert.equal(eg1.teile.find((x) => x.ref === 'trennwand').bloecke, eg0.teile.find((x) => x.ref === 'trennwand').bloecke - 2);
});

test('Bauplan: deterministisch (gleicher Entwurf, gleicher Plan inklusive Besitz und Aussparungen)', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(hausSpezifikation(VARIANTEN.klein, { treppe: true, tuer: true }), e, e5);
  assert.equal(alsText(e5.bauplan(r.entwurf)), alsText(e5.bauplan(r.entwurf)));
  assert.equal(alsText(r.plan), alsText(e5.bauplan(r.entwurf)));
});

test('Haken: wechselt nur der Besitz (Tür als Parameter des Raums oder als eigenes Kind, gleiche Blöcke), bleiben alle Haken erhalten', async () => {
  const { e, e5 } = await umgebung();
  const alsParameter = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true }), e, e5);
  const alsKind = await laufe(hausSpezifikation(VARIANTEN.klein, { tuerInWand: true }), e, e5);
  const a = abschnitt(alsParameter.plan, 'erdgeschoss'), b = abschnitt(alsKind.plan, 'erdgeschoss');
  assert.equal(a.teile.length, 1);
  assert.deepEqual(b.teile.map((t) => t.ref), ['erdgeschoss', 'haustuer'], 'der Besitz ist ein anderer');
  assert.ok(b.schichten.some((s) => s.p.some((p) => p === 1)));
  assert.deepEqual(a.schichten.map((s) => s.abdruck), b.schichten.map((s) => s.abdruck), 'gleiche Blöcke, gleiche Abdrücke');
});

test('Haken: Pläne ohne Kinder behalten ihre Abdrücke aus der Zeit vor P7 (gespeicherte Haken bleiben gültig)', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true }), e, e5);
  // festgehalten am Stand vor P7 (Commit 9b40230), berechnet mit dessen bauplan.js
  assert.deepEqual(r.plan.abschnitte.map((a) => [a.id, a.schichten.map((s) => s.abdruck)]), [
    ['erdgeschoss', ['656b3e4c', '08264726', '92d7e649', 'fa3e7af0', 'b9eb9300']],
    ['obergeschoss', ['4c7fcee3', '3432ed9e', '3307ab09', '9eaf02df']],
    ['dach', ['a937878a', '511ce850', 'd0ae34b1', '93ae6662', 'd72d60e0']],
  ]);
});

test('Bauplan: Aussparungen in einer Höhe ohne Blöcke gehen nicht verloren (aussparungenOhneSchicht, gezählt)', async () => {
  const { e, e5 } = await umgebung();
  // künstlicher Baustein (nur Test): ein Block weit über der Wand, der die ganze Wand freihält
  const frei = definiere({
    id: 'bau.test-freihalter', titel: 'Freihalter (nur Test)', quelle: 'https://beispiel.invalid/', testszenario: { start: 's', erwartung: 'e' }, parameter: [],
    baue: () => ({ bloecke: [{ x: 0, y: 5, z: 0, rolle: 'wand' }], aussparungen: [{ art: 'freihaltung', von: { x: -2, y: 0, z: 0 }, bis: { x: 2, y: 0, z: 0 } }] }),
  });
  e.ebene2.bausteine.set(frei.id, frei);
  try {
    let en = e.ebene3.neuerEntwurf ? null : null; void en;
    const { neuerEntwurf } = await import('../../src/ebene3/index.js');
    let x = neuerEntwurf({ name: 'Probe' });
    const a = (wer, aenderung) => { x = e.ebene3.aendere(x, wer, aenderung).entwurf; };
    a('konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Wand', reihenfolge: 1 } });
    a('designer', { art: 'setze-palette', palette: { wand: 'minecraft:stone', akzent: 'minecraft:stone', boden: 'minecraft:stone', licht: 'minecraft:glowstone', glas: 'minecraft:glass' } });
    a('architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'bau.wand', ref: 'w', parameter: { laenge: 5, hoehe: 1, dicke: 1 }, lage: { x: 0, y: 0, z: 0, drehung: 0 } } });
    a('architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: frei.id, ref: 'f', parameter: {}, traeger: 'w', einbau: { zone: 'wand', anker: 'mitte', versatz: { x: 0, y: 5, z: 0 }, drehung: 0 } } });
    const plan = e5.bauplan(x);
    const ab = abschnitt(plan, 'A1');
    assert.deepEqual(hoehen(ab), [5], 'nur der Block des Freihalters ist übrig; die Wand ist ausgespart');
    assert.equal(ab.aussparungen, 5, 'alle fünf Wandblöcke sind Aussparungen');
    assert.equal((ab.aussparungenOhneSchicht ?? []).length, 5, 'keine Schicht hat Blöcke in dieser Höhe, die Aussparungen stehen am Abschnitt');
    assert.ok(ab.aussparungenOhneSchicht.every((q) => q.kind === 'f' && q.traeger === 'w' && q.art === 'freihaltung' && q.y === 0));
    assert.equal(ab.schichten[0].aussparungen, undefined);
  } finally { e.ebene2.bausteine.delete(frei.id); }
});
