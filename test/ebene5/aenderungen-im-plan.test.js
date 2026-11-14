// U1 (Oberfläche für Bearbeiten): manuelle Einzelblockänderungen (Planfassung) fließen in den wirksamen Plan ein, auch wenn die Spezifikation unverändert bleibt.
// Verwaistes und Widersprüchliches verschwindet nie stillschweigend, gebaute Schichten werden über Abdruck und Umbauhinweise erkannt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from './hilfe5.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import { ebene3 as ebene3Hilfe } from '../hilfe.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { berichtAlsText } from '../../src/ebene3/index.js';
import * as PF from '../../src/ebene5/planfassung.js';
import * as F from '../../src/ebene5/fortschritt.js';
import * as Umbau from '../../src/ebene5/umbau.js';

const haus = () => hausSpezifikation(Object.values(VARIANTEN)[0], {});
const aus = async (spec, aenderungen) => {
  const e = await engine();
  const r = bauePlan(e, e.ebene4.freigeben(spec, 'test'), [], aenderungen);
  const plan = e.e5.bauplan(r.entwurf);
  return { e, r, plan, material: e.e5.material(plan), bericht: berichtAlsText(r.entwurf) };
};
/** Planfassung aus Änderungen: [teil, x, y, z, 'leere' | blockId] */
const pf = (liste) => liste.reduce((p, [teil, x, y, z, was]) => PF.wende(p, [{ teil, zelle: { x, y, z }, erwartet: null, neu: was === 'leere' ? { op: 'leere' } : { op: 'setze', block: { id: was } } }], 'Jonah').planfassung, PF.leer());
const GLAS = ['erdgeschoss', 2, 1, 0, 'minecraft:glass'];
const schichtDe = (plan, abschnitt, y) => plan.abschnitte.find((a) => a.id === abschnitt).schichten.find((s) => s.y === y);

test('Ohne Änderungen bleibt alles beim Alten: fehlende, null, leere Planfassung = byte-identischer Plan, Material und Bericht, kein zusätzliches Feld', async () => {
  const x = await aus(haus());
  const json = (o) => JSON.stringify([o.plan, o.material, o.bericht]);
  for (const leer of [null, PF.leer(), { version: 7, eintraege: {} }]) {
    const y = await aus(haus(), leer);
    assert.equal(json(y), json(x));
    assert.equal('aenderungen' in y.plan, false);
  }
  assert.equal(x.r.status, 'fertig');
});

test('Eine angewandte Änderung steht im Plan: Block im Schichtplan, Status, Weltzelle, Besitz; sonst bleibt alles gleich (andere Schichten, Summe ±1)', async () => {
  const ohne = await aus(haus());
  const mit = await aus(haus(), pf([GLAS]));
  assert.equal(mit.r.status, 'fertig');
  assert.deepEqual(mit.plan.aenderungen.map(({ ort, ...a }) => a), [{ id: 'C1', teil: 'erdgeschoss', zelle: { x: 2, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' }, von: 'Jonah', status: 'angewandt', abschnitt: 'erdgeschoss', zugelassen: false }]);
  const ort = mit.plan.aenderungen[0].ort;
  assert.ok(Number.isInteger(ort.x) && Number.isInteger(ort.y) && Number.isInteger(ort.z), 'die Weltzelle der Änderung steht dabei');
  // genau eine Schicht ändert ihren Abdruck, alle anderen Schichten bleiben gleich
  const abdruecke = (p) => p.abschnitte.flatMap((a) => a.schichten.map((s) => `${a.id}|${s.y}|${s.abdruck}`));
  const a0 = abdruecke(ohne.plan), a1 = abdruecke(mit.plan);
  assert.equal(a0.length, a1.length);
  const anders = a0.map((k, i) => [k, a1[i]]).filter(([p, q]) => p !== q);
  assert.equal(anders.length, 1);
  assert.equal(anders[0][0].split('|')[1], String(ort.y));
  // der Block steht im Schichtplan der Weltzelle
  const s = schichtDe(mit.plan, 'erdgeschoss', ort.y), i = s.x.findIndex((x, k) => x === ort.x && s.z[k] === ort.z);
  assert.ok(i >= 0);
  assert.equal(mit.plan.abschnitte.find((a) => a.id === 'erdgeschoss').legende[s.b[i]].id, 'minecraft:glass');
  // Material: ein Block Glas mehr, genau ein anderer Block weniger
  const m = (p) => Object.fromEntries(Object.entries(p.summe));
  const d = Object.entries(m(mit.plan)).map(([id, n]) => [id, n - (m(ohne.plan)[id] ?? 0)]).filter(([, n]) => n !== 0);
  assert.equal(d.length, 2);
  assert.deepEqual(d.map(([, n]) => n).sort(), [-1, 1]);
  assert.equal(d.find(([id]) => id === 'minecraft:glass')?.[1], 1);
  assert.equal(mit.plan.bloecke, ohne.plan.bloecke, 'ein Block ersetzt, die Gesamtzahl bleibt');
});

test('Eine Änderung an einer gebauten Schicht löst Umbauhinweise aus, obwohl die Spezifikation unverändert bleibt; nur diese Schicht wird offen', async () => {
  const ohne = await aus(haus());
  const mit = await aus(haus(), pf([GLAS]));
  // alles gebaut nach dem alten Plan
  let f = F.leer();
  const keys = ohne.plan.abschnitte.flatMap((a) => a.schichten.map((s) => F.schluessel(a.id, s)));
  f = F.haken(f, keys, true, 'Anna');
  assert.ok(keys.every((k) => F.istAbgehakt(f, k)));
  const h = Umbau.hinweise(ohne.plan, mit.plan, f);
  assert.equal(h.noetig, true);
  assert.deepEqual([h.summe.entfernen, h.summe.ersetzen, h.summe.ergaenzen, h.summe.schichten], [0, 1, 0, 1]);
  const c = h.schichten[0].ersetzen[0];
  assert.equal(c.neu, 'minecraft:glass');
  assert.notEqual(c.alt, 'minecraft:glass');
  assert.equal(h.schichten[0].abschnitt, 'erdgeschoss');
  // die Haken des neuen Plans: nur die geänderte Schicht verliert ihren Haken (Schlüssel enthält den Abdruck), die übrigen gelten weiter
  const nochGebaut = mit.plan.abschnitte.flatMap((a) => a.schichten.map((s) => [a.id, s.y, F.istAbgehakt(f, F.schluessel(a.id, s))]));
  assert.equal(nochGebaut.filter(([, , ok]) => !ok).length, 1);
  assert.equal(nochGebaut.find(([, , ok]) => !ok)[1], mit.plan.aenderungen[0].ort.y);
  // mit der Fassung ohne Änderung ist der Vergleich ohne Hinweise (Gegenprobe)
  assert.equal(Umbau.hinweise(ohne.plan, (await aus(haus(), PF.leer())).plan, f).noetig, false);
  // Änderung wieder weg: ebenfalls Hinweis (Glas zurück zur Wand), A → B → A
  assert.equal(Umbau.hinweise(mit.plan, ohne.plan, F.haken(F.leer(), mit.plan.abschnitte.flatMap((a) => a.schichten.map((s) => F.schluessel(a.id, s))), true, 'Anna')).noetig, true);
});

test('Änderungen an Teilen späterer Abschnitte (Dach) werden nicht vorzeitig als verwaist gemeldet; die Planung läuft durch', async () => {
  const r = await aus(haus(), pf([['dach', 1, 0, 1, 'minecraft:stone']]));
  assert.equal(r.r.status, 'fertig');
  assert.equal(r.r.rueckfragen.length, 0);
  assert.equal(r.plan.aenderungen[0].status, 'angewandt');
  assert.equal(r.plan.aenderungen[0].abschnitt, 'dach');
});

test('Verwaiste Änderungen verschwinden nie stillschweigend: sie stehen im Plan, die Planung wartet auf Jonah mit den drei Optionen; jede Antwort hat ihre Folge', async () => {
  const nix = await aus(haus(), pf([['nix', 1, 1, 1, 'minecraft:stone']]));
  assert.equal(nix.r.status, 'wartet');
  const a = nix.plan.aenderungen[0];
  assert.deepEqual([a.id, a.status, a.grund, a.teil, a.zugelassen], ['C1', 'verwaist', 'teil-fehlt', 'nix', false]);
  assert.deepEqual(a.rueckfrage.optionen.map((o) => o.id), ['verwerfen', 'verankern', 'zulassen']);
  assert.equal(nix.r.rueckfragen.filter((q) => q.art === 'aenderung').length, 1);
  const { e } = nix, rf = a.rueckfrage.id, ablauf = e.ebene3.ablauf;
  const weiter = (entwurf) => ablauf.fortsetzen(entwurf);
  const plan = (r) => e.e5.bauplan(r.entwurf);

  // zulassen: es wird weitergebaut, die Änderung bleibt gespeichert, sichtbar und als zugelassen markiert (nicht angewendet)
  const z = weiter(ablauf.antworte(nix.r.entwurf, rf, { option: 'zulassen' }));
  assert.equal(z.status, 'fertig');
  const pz = plan(z).aenderungen[0];
  assert.deepEqual([pz.status, pz.zugelassen, pz.rueckfrage], ['verwaist', true, undefined]);

  // verwerfen: weg aus Entwurf und Plan (ausdrückliche Entscheidung)
  const v = weiter(ablauf.antworte(nix.r.entwurf, rf, { option: 'verwerfen' }));
  assert.equal(v.status, 'fertig');
  assert.equal(v.entwurf.aenderungen.length, 0);
  assert.equal('aenderungen' in plan(v), false);

  // neu verankern: an eine gültige Zelle eines vorhandenen Teils, dann angewendet
  const k = weiter(ablauf.antworte(nix.r.entwurf, rf, { option: 'verankern', teil: 'erdgeschoss', zelle: { x: 2, y: 1, z: 0 } }));
  assert.equal(k.status, 'fertig');
  assert.deepEqual(plan(k).aenderungen.map((x) => [x.id, x.teil, x.status]), [['C1', 'erdgeschoss', 'angewandt']]);
});

test('Weitere Fälle: Zelle außerhalb des Teils, unbekannter Block und Entfernen eines leeren Raums sind Einwände an Jonah mit Grund, nichts wird geraten', async () => {
  const aussen = await aus(haus(), pf([['erdgeschoss', 99, 1, 0, 'minecraft:stone']]));
  assert.deepEqual([aussen.r.status, aussen.plan.aenderungen[0].status, aussen.plan.aenderungen[0].grund], ['wartet', 'verwaist', 'ausserhalb']);
  const falsch = await aus(haus(), pf([['erdgeschoss', 2, 1, 0, 'minecraft:gibt_es_nicht']]));
  assert.deepEqual([falsch.r.status, falsch.plan.aenderungen[0].status], ['wartet', 'ungueltig']);
  const luft = await aus(haus(), pf([['erdgeschoss', 3, 1, 2, 'leere']]));
  assert.deepEqual([luft.r.status, luft.plan.aenderungen[0].status, luft.plan.aenderungen[0].grund], ['wartet', 'verwaist', 'kein-block']);
  // ungültiger Blockzustand: ebenfalls ein Einwand, kein Absturz
  const zustand = { version: 1, eintraege: { 'erdgeschoss|2,1,0': { teil: 'erdgeschoss', zelle: { x: 2, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:oak_stairs', zustand: { gibt_es_nicht: 1 } }, von: 'Jonah' } } };
  const kaputt = await aus(haus(), zustand);
  assert.deepEqual([kaputt.r.status, kaputt.plan.aenderungen[0].status], ['wartet', 'ungueltig']);
  for (const x of [aussen, falsch, luft, kaputt]) assert.equal(x.plan.aenderungen[0].rueckfrage.optionen.length, 3);
});

test('Mehrere Änderungen: stabile Reihenfolge, deterministisch und unabhängig von der Einfügereihenfolge; eine kaputte Planfassung wird abgelehnt', async () => {
  const liste = [GLAS, ['erdgeschoss', 3, 1, 0, 'minecraft:stone'], ['obergeschoss', 2, 1, 0, 'minecraft:glass']];
  const a = await aus(haus(), pf(liste)), b = await aus(haus(), pf([...liste].reverse()));
  assert.equal(JSON.stringify(a.plan), JSON.stringify(b.plan));
  assert.deepEqual(a.plan.aenderungen.map((x) => x.id), ['C1', 'C2', 'C3']);
  assert.equal(JSON.stringify((await aus(haus(), pf(liste))).plan), JSON.stringify(a.plan), 'zweimal gleich');
  const e = await engine();
  const frei = e.ebene4.freigeben(haus(), 'test');
  assert.throws(() => e.ebene4.baue(frei, [], { aenderungen: { version: 1, eintraege: { 'a|1,1,1': { teil: 'a', zelle: { x: 1, y: 1, z: 1 }, op: 'tanzen' } } } }), /Änderungen der Planfassung sind ungültig/);
});

test('Technik: eine Änderung im Prüfbereich einer Anlage wird mit neu geprüft; der Plan nennt die Änderung an der Anlage, andere Anlagen bleiben unberührt', async () => {
  const spec = await holeJson('data/beispiele/zitadelle-klein.json');
  const e = await engine();
  const bauen = (aenderungen) => { const r = bauePlan(e, spec, [], aenderungen); return { r, plan: e.e5.bauplan(r.entwurf) }; };
  const ohne = bauen(null);
  const mit = bauen(pf([['T1', 9, 1, 3, 'leere']])); // ein Trichter im Sortierlager
  assert.equal(mit.r.status, 'fertig');
  assert.equal(mit.plan.aenderungen[0].status, 'angewandt');
  const t = (p, ref) => p.technik.find((x) => x.ref === ref);
  assert.deepEqual(t(mit.plan, 'T1').geaendertDurch, ['C1']);
  assert.equal(t(mit.plan, 'T5').geaendertDurch, undefined);
  assert.equal(t(ohne.plan, 'T1').geaendertDurch, undefined);
  assert.equal(t(mit.plan, 'T1').status, 'bestaetigt', 'nach der Änderung neu geprüft (Ebene 1 ohne Verstoß)');
  // der neue Abdruck der Anlage unterscheidet sich vom unveränderten, die andere Anlage nicht
  const ab = (r, ref) => r.entwurf.bestaetigungen.find((b) => b.teil === ref).abdruck;
  assert.notEqual(ab(mit.r, 'T1'), ab(ohne.r, 'T1'));
  assert.equal(ab(mit.r, 'T5'), ab(ohne.r, 'T5'));
  // in der Abschnittsliste steht es ebenfalls
  assert.deepEqual(mit.plan.abschnitte.find((a) => a.id === 'lagerkeller').technik.find((x) => x.ref === 'T1').geaendertDurch, ['C1']);
});

test('Technik: nur angewandte Änderungen gelten als „im Prüfbereich geändert“; ungültige und verwaiste werden gemeldet, nicht gezählt', async () => {
  const spec = await holeJson('data/beispiele/zitadelle-klein.json');
  const e = await engine();
  const r = bauePlan(e, spec, [], pf([['T1', 9, 1, 3, 'leere'], ['T1', 9, 1, 4, 'minecraft:gibt_es_nicht'], ['T1', 99, 1, 0, 'minecraft:stone']]));
  const plan = e.e5.bauplan(r.entwurf);
  assert.equal(r.status, 'wartet');
  assert.ok(r.entwurf.abschnitte.every((x) => x.status === 'fertig'), 'ein Einwand gegen eine manuelle Änderung öffnet keinen Abschnitt neu (Neuplanen kann ihn nicht beheben)');
  assert.deepEqual(plan.aenderungen.map((a) => [a.id, a.status]), [['C1', 'angewandt'], ['C2', 'ungueltig'], ['C3', 'verwaist']]);
  assert.deepEqual(plan.technik.find((x) => x.ref === 'T1').geaendertDurch, ['C1'], 'nur die angewandte Änderung');
  // ohne die angewandte Änderung steht gar nichts an der Anlage
  const nur = bauePlan(e, spec, [], pf([['T1', 9, 1, 4, 'minecraft:gibt_es_nicht'], ['T1', 99, 1, 0, 'minecraft:stone']]));
  assert.equal(e.e5.bauplan(nur.entwurf).technik.find((x) => x.ref === 'T1').geaendertDurch, undefined);
  // Ebene 3 liefert die Zuordnung (Ebene 5 zeigt sie nur)
  const m = e.ebene3.materialisiere(r.entwurf);
  assert.deepEqual([...e.ebene3.bestaetigung.geaendertDurch(r.entwurf, m)], [['T1', ['C1']]]);
  assert.deepEqual([...e.ebene3.bestaetigung.geaendertDurch(e.ebene3.aenderungen.ausPlanfassung(r.entwurf, PF.leer()), e.ebene3.materialisiere(e.ebene3.aenderungen.ausPlanfassung(r.entwurf, PF.leer())))], []);
});

test('Keine Änderung geht verloren: auch wenn schon der Vorlauf wartet, bleibt die Planfassung im Entwurf; jeder angegebene, aber ungültige Wert wird abgelehnt (nur null und fehlend heißen „keine Änderungen“)', async () => {
  const e = await engine();
  const spec = haus();
  delete spec.teile[0].stil; // keine Stimmung: die Planung stellt eine Rückfrage zur Palette
  const frei = e.ebene4.freigeben(spec, 'test');
  const r = bauePlan(e, frei, [], pf([GLAS]));
  assert.equal(r.status, 'wartet');
  assert.equal(r.entwurf.aenderungen.length, 1, 'die Änderung steht schon im wartenden Entwurf');
  assert.throws(() => bauePlan(e, frei, [], { version: 1, eintraege: { 'a|1,1,1': { teil: 'a', zelle: { x: 1, y: 1, z: 1 }, op: 'tanzen' } } }), /Änderungen der Planfassung sind ungültig/);
  const gut = e.ebene4.freigeben(haus(), 'test');
  for (const falsch of [false, 0, '', 'text', [], 5]) assert.throws(() => bauePlan(e, gut, [], falsch), /Planfassung sind ungültig/, JSON.stringify(falsch));
  for (const keine of [null, undefined]) assert.equal(bauePlan(e, gut, [], keine).status, 'fertig');
});

test('Wartet schon der Vorlauf (Einspruch des Technikers ohne Lösung, hier ein Zyklus), bleibt die Planfassung im Entwurf, und eine ungültige wird sofort abgelehnt', () => {
  const huelle = (a, b, c, d, e, f) => ({ von: { x: a, y: b, z: c }, bis: { x: d, y: e, z: f } });
  const sorten = ['minecraft:stone', 'minecraft:dirt'];
  const vorgabe = () => ({ name: 'V', stimmung: 'glanz', abschnitte: [
    { id: 'halle', name: 'Halle', huelle: huelle(-10, 0, -10, 20, 12, 20), zonen: [{ funktion: 'technik', anteil: 100 }], bedarf: [{ art: 'lager', sorten, braucht: ['lager'] }] },
    { id: 'lager', name: 'Lager', huelle: huelle(100, 0, 0, 130, 12, 30), zonen: [{ funktion: 'technik', anteil: 100 }], bedarf: [{ art: 'lager', sorten, braucht: ['halle'] }] },
  ] });
  const ab = ebene3Hilfe().ablauf;
  assert.equal(ab.vorlauf(vorgabe()).art, 'wartet', 'Ausgangslage: der Vorlauf wartet');
  const r = ab.starte(vorgabe(), { aenderungen: pf([GLAS]) });
  assert.equal(r.status, 'wartet');
  assert.equal(r.entwurf.aenderungen.length, 1);
  assert.throws(() => ab.starte(vorgabe(), { aenderungen: { version: 1, eintraege: { 'a|1,1,1': { teil: 'a', zelle: { x: 1, y: 1, z: 1 }, op: 'tanzen' } } } }), /Änderungen der Planfassung sind ungültig/);
});
