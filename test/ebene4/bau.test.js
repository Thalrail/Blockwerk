import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene4 } from '../hilfe.js';
import { BauFehler, zuJson } from '../../src/ebene4/index.js';
import { entwurfZuJson, berichtAlsText, RechtFehler } from '../../src/ebene3/index.js';

const L = ebene4();
const SORTEN = L.ebene0.register.gegenstaende
  .filter((id) => /^minecraft:[a-z_]+$/.test(id) && L.ebene0.register.stapel(id) === 64 && !/light_block|barrier|allow|deny|border|void|command|structure|jigsaw|debug|air|bedrock|spawn_egg|banner_pattern|unknown/.test(id))
  .slice(0, 3);
const fehler = (klasse, fn) => { try { fn(); } catch (f) { assert.ok(f instanceof klasse, String(f)); return f; } return null; };

/** Die Zitadelle in klein: Turm in der Mitte, Markthalle daneben, Lagerkeller darunter. */
const SPEC = () => ({
  schema: 1, version: 1,
  projekt: { name: 'Kleine Zitadelle', bauplatz: { breite: 400, hoehe: 100, tiefe: 300 }, massstab: 1 },
  teile: [
    { id: 'zentralturm', name: 'Zentralturm', art: 'turm', wichtigkeit: 'muss', form: { baustein: 'form.zylinder', groesse: { breite: 21, tiefe: 21, hoehe: 40 }, proportionen: { hoehe_zu_breite: 1.9 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'glanz' }, verbindungen: [{ mit: 'markthalle', art: 'gang' }] },
    { id: 'markthalle', name: 'Markthalle', art: 'halle', wichtigkeit: 'muss', form: { baustein: 'form.kuppel', groesse: { breite: 31, tiefe: 31 } }, lage: { bezug: 'zentralturm', relation: 'neben-osten' }, funktionen: [{ art: 'handelsnischen', menge: 6 }, { art: 'bruteranlage' }] },
    { id: 'lagerkeller', name: 'Lagerkeller', art: 'keller', wichtigkeit: 'soll', form: { baustein: 'form.satteldach', groesse: { breite: 25, laenge: 25 } }, lage: { bezug: 'zentralturm', relation: 'unter' }, funktionen: [{ art: 'lager', sorten: SORTEN }], stil: { stimmung: 'dunkel-industriell' } },
  ],
});
const frei = (s = SPEC()) => L.freigeben(s);
/** Abdruck der Welt, unabhängig von der Reihenfolge, in der die Teile gebaut wurden. */
const welt = (e) => JSON.stringify(L.ebene3.materialisiere(e).welt.alleBloecke().map((b) => JSON.stringify(b)).sort());
const keinEinwand = (e) => assert.deepEqual(L.ebene3.einwaende.sammle(e).einwaende.map((x) => `${x.regel}: ${x.text}`), []);
const teileVon = (e, id) => e.teile.filter((t) => t.abschnitt === id).map((t) => t.id);

test('Bau: von der freigegebenen Spezifikation bis zum geplanten Bauwerk', () => {
  // ohne Freigabe wird nichts gebaut, auch nicht nach einer Änderung seit der Freigabe
  assert.match(fehler(BauFehler, () => L.baue(SPEC())).message, /nicht freigegeben/);
  const f = frei();
  const geaendert = structuredClone(f);
  geaendert.teile[0].form.groesse.hoehe = 41;
  assert.match(fehler(BauFehler, () => L.baue(geaendert)).message, /nicht freigegeben \(oder nach der Freigabe geändert/);

  const r = L.baue(f);
  assert.equal(r.status, 'fertig');
  const e = r.entwurf;
  // Reihenfolge: der Keller zuerst, dann der Turm, dann die Halle
  assert.deepEqual([...e.abschnitte].sort((a, b) => a.reihenfolge - b.reihenfolge).map((a) => a.id), ['lagerkeller', 'zentralturm', 'markthalle']);
  assert.ok(e.abschnitte.every((a) => a.status === 'fertig'));
  keinEinwand(e);
  // Bilanz: 6 Nischen, 6 Dorfbewohner; die Schaltungsanfrage für die Brüteranlage bleibt offen
  assert.deepEqual(r.offeneAnfragen.map((a) => a.art), ['bruteranlage']);
  const bilanz = e.bericht.filter((b) => b.art === 'bilanz').at(-1).daten;
  assert.deepEqual([bilanz.betten, bilanz.dorfbewohner, bilanz.golem], [6, 6, 'nein']);
  // die Lage kommt aus der Übersetzung: Keller unter dem Boden, Halle östlich neben dem Turm
  const h = (id) => e.abschnitte.find((a) => a.id === id).huelle;
  assert.ok(h('lagerkeller').bis.y < 0 && h('zentralturm').von.y === 0 && h('markthalle').von.x > h('zentralturm').bis.x);
  assert.equal(e.verbindungenGeprueft, undefined);
  assert.ok(e.pruefungen.some((p) => p.art === 'begehbar' && p.abschnitt === 'zentralturm'), 'der Gang vom Turm zur Halle ist geprüft');
  // die Gesamtstimmung steht im Entwurf, die Abschnittspalette beim Keller
  assert.equal(e.palette.wand, 'minecraft:polished_blackstone', 'zwei Stimmungen je einmal: die alphabetisch erste ist die Gesamtstimmung');
  assert.ok(e.paletten.lagerkeller && e.paletten.zentralturm);
  // deterministisch: gleiche freigegebene Spezifikation = gleicher Entwurf, auch nach dem Speichern
  assert.equal(entwurfZuJson(L.baue(f).entwurf), entwurfZuJson(e));
  assert.equal(L.vorbereiten(f).status, 'bereit');
  assert.match(berichtAlsText(e), /Der Konstrukteur sagt „Lagerkeller“ als Nummer 1 an/);

  // Rückfragen aus dem Abgleich und aus der Übersetzung verhindern den Bau
  const falsch = L.baue(f, [{ teil: 'zentralturm', art: 'grundriss', bild: 'oben.png', ergebnis: { form: 'eckig', seitenverhaeltnis: 1 } }]);
  assert.equal(falsch.status, 'rueckfragen');
  assert.equal(falsch.rueckfragen[0].id, 'M1');
  const klein = SPEC();
  klein.projekt.bauplatz = { breite: 60, hoehe: 100, tiefe: 60 };
  const eng = L.baue(frei(klein));
  assert.equal(eng.status, 'rueckfragen');
  assert.equal(eng.rueckfragen[0].regel, 'leser.uebersetzung');
  assert.match(eng.rueckfragen[0].frage, /das passt nicht auf den Bauplatz \(60 × 100 × 60\)/);
});

test('Bau: neue Version der Spezifikation', () => {
  const f1 = frei();
  const r1 = L.baue(f1);
  const e1 = r1.entwurf;
  assert.equal(r1.status, 'fertig');

  // keine Änderung: nichts wird neu geplant
  const gleich = L.aktualisiereBau(e1, frei(L.neueVersion(f1)));
  assert.deepEqual([gleich.status, gleich.geaendert, gleich.neu, gleich.entfernt], ['fertig', [], [], []]);
  assert.deepEqual(gleich.entwurf.teile.map((t) => t.id), e1.teile.map((t) => t.id), 'alle Teile bleiben, wie sie sind');

  // der Turm wird höher: nur der Turm und seine Abhängigen (die Halle) werden neu geplant, der Keller bleibt unberührt
  const v2 = L.neueVersion(f1, (s) => { s.teile[0].form.groesse.hoehe = 46; delete s.teile[0].form.proportionen; });
  const f2 = frei(v2);
  const r2 = L.aktualisiereBau(e1, f2);
  assert.equal(r2.status, 'fertig');
  assert.deepEqual(r2.geaendert, ['zentralturm']);
  assert.deepEqual(teileVon(r2.entwurf, 'lagerkeller'), teileVon(e1, 'lagerkeller'), 'der Keller behält seine Teile (gleiche Ids)');
  assert.notDeepEqual(teileVon(r2.entwurf, 'zentralturm'), teileVon(e1, 'zentralturm'));
  assert.notDeepEqual(teileVon(r2.entwurf, 'markthalle'), teileVon(e1, 'markthalle'), 'die Halle hängt vom Turm ab und wird neu aufgebaut');
  assert.match(berichtAlsText(r2.entwurf), /Der Konstrukteur entscheidet: plant nach der neuen Fassung neu: zentralturm geändert/);
  assert.match(berichtAlsText(r2.entwurf), /öffnet den Abschnitt zentralturm wieder \(mit markthalle\)/);
  keinEinwand(r2.entwurf);
  assert.equal(r2.entwurf.abschnitte.find((a) => a.id === 'zentralturm').rueckgriffe, 0, 'ein Fassungswechsel zählt nicht zu den automatischen Rückgriffen');
  // Ergebnis = frischer Lauf der neuen Fassung
  assert.equal(welt(r2.entwurf), welt(L.baue(f2).entwurf));

  // ein Teil kommt hinzu, eines fällt weg
  const v3 = L.neueVersion(f1, (s) => {
    s.teile.push({ id: 'wachturm', name: 'Wachturm', art: 'turm', wichtigkeit: 'kann', form: { baustein: 'form.zylinder', groesse: { breite: 9, tiefe: 9, hoehe: 20 } }, lage: { bezug: 'markthalle', relation: 'neben-osten' } });
  });
  const f3 = frei(v3);
  const r3 = L.aktualisiereBau(e1, f3);
  assert.deepEqual([r3.status, r3.neu, r3.geaendert, r3.entfernt], ['fertig', ['wachturm'], [], []]);
  assert.deepEqual(r3.entwurf.teile.filter((t) => t.abschnitt !== 'wachturm').map((t) => t.id), e1.teile.map((t) => t.id), 'die vorhandenen Abschnitte bleiben unverändert');
  assert.equal(welt(r3.entwurf), welt(L.baue(f3).entwurf));
  const v4 = L.neueVersion(f3, (s) => { s.teile = s.teile.filter((t) => t.id !== 'wachturm'); });
  const r4 = L.aktualisiereBau(r3.entwurf, frei(v4));
  assert.deepEqual([r4.status, r4.entfernt], ['fertig', ['wachturm']]);
  assert.ok(!r4.entwurf.abschnitte.some((a) => a.id === 'wachturm'));
  assert.equal(r4.entwurf.teile.some((t) => t.abschnitt === 'wachturm'), false);
  assert.equal(welt(r4.entwurf), welt(e1), 'zurück zur ersten Fassung ergibt dieselbe Welt');
  // der Keller fällt weg: der Turm hängt nicht mehr von ihm ab
  const v5 = L.neueVersion(f1, (s) => { s.teile = s.teile.filter((t) => t.id !== 'lagerkeller'); });
  const r5 = L.aktualisiereBau(e1, frei(v5));
  assert.deepEqual([r5.status, r5.entfernt, r5.geaendert], ['fertig', ['lagerkeller'], ['zentralturm']]);
  assert.equal(welt(r5.entwurf), welt(L.baue(frei(v5)).entwurf));

  // Fixierungen von Jonah bleiben: im unveränderten Keller bleibt alles, im geänderten Turm verhindert sie die Neuplanung
  const festKeller = L.ebene3.fixiere(e1, `teil:${teileVon(e1, 'lagerkeller')[0]}`, 'bleibt so').entwurf;
  const ok = L.aktualisiereBau(festKeller, f2);
  assert.equal(ok.status, 'fertig');
  assert.ok(ok.entwurf.sperren.some((s) => s.von === 'jonah'), 'die Fixierung ist noch da');
  assert.deepEqual(teileVon(ok.entwurf, 'lagerkeller'), teileVon(e1, 'lagerkeller'));
  const festTurm = L.ebene3.fixiere(e1, `teil:${teileVon(e1, 'zentralturm')[0]}`, 'bleibt so').entwurf;
  assert.match(fehler(RechtFehler, () => L.aktualisiereBau(festTurm, f2)).message, /gesperrt/);

  // eine nicht freigegebene neue Fassung wird nicht angewendet
  assert.match(fehler(BauFehler, () => L.aktualisiereBau(e1, v2)).message, /nicht freigegeben/);
  assert.equal(L.aktualisiereBau(e1, frei(L.neueVersion(f1, (s) => { s.projekt.bauplatz = { breite: 50, hoehe: 50, tiefe: 50 }; }))).status, 'rueckfragen');
  void zuJson;
});
