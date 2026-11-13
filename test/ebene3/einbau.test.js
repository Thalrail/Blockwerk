import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2, ebene3 } from '../hilfe.js';
import { neuerEntwurf, kopie, pruefeForm, migriere, entwurfAusJson, entwurfZuJson, RechtFehler, LagenFehler } from '../../src/ebene3/index.js';
import { zellenInWelt, quaderZellen } from '../../src/ebene2/zellen.js';
import { huelleVon } from '../../src/ebene2/baustein.js';

const e3 = ebene3();
const E2 = ebene2();
const e0 = E2.ebene0;
const k = (z) => `${z.x},${z.y},${z.z}`;
const menge = (l) => new Set(l.map(k));
const nf = (n) => 0 - (0 - n);
/** Drehung (x, z) → (-z, x), unabhängig vom Vermesser. */
const dreh = (z, v) => { let { x, z: zz } = z; for (let i = 0; i < ((v % 4) + 4) % 4; i++) [x, zz] = [-zz, x]; return { x: nf(x), y: z.y, z: nf(zz) }; };
const lageAn = (z, l) => { const d = dreh(z, l.drehung); return { x: d.x + l.x, y: d.y + l.y, z: d.z + l.z }; };

function grund() {
  let e = neuerEntwurf({ name: 'Probe' });
  e = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Haus', reihenfolge: 1 } }).entwurf;
  return e;
}
const setze = (e, teil) => e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', ...teil } }).entwurf;
const EI = (zone, anker, extra = {}) => ({ zone, anker, versatz: { x: 0, y: 0, z: 0 }, drehung: 0, ...extra });

test('Entwurf Version 2: Migration von Version 1 ist verlustfrei, verändert das Original nicht und ist idempotent', () => {
  let e = grund();
  e = setze(e, { baustein: 'form.zylinder', parameter: { breite: 5, tiefe: 5 }, lage: { x: 3, y: 0, z: -2, drehung: 1 } });
  e = setze(e, { baustein: 'bau.raum', parameter: { breite: 4, tiefe: 6, hoehe: 3 }, lage: { x: 10, y: 0, z: 0, drehung: 0 } });
  assert.equal(e.version, 2);
  assert.deepEqual(e.aenderungen, []);
  assert.deepEqual(e.teile.map((t) => t.ref), ['T1', 'T2'], 'ohne Angabe ist die Nummer die stabile Kennung');
  // Version 1 nachbauen: ohne aenderungen und ohne ref
  const alt = kopie(e);
  alt.version = 1;
  delete alt.aenderungen;
  for (const t of alt.teile) delete t.ref;
  const vorher = JSON.stringify(alt);
  const neu = migriere(alt);
  assert.equal(JSON.stringify(alt), vorher, 'Original unverändert');
  assert.deepEqual(neu, e, 'verlustfrei: Version 2 entspricht dem Original');
  assert.deepEqual(migriere(neu), neu, 'idempotent');
  assert.notEqual(migriere(neu), neu, 'liefert eine Kopie');
  // Laden von Text der Version 1 hebt automatisch; direktes pruefeForm verlangt Version 2 und nennt den Weg
  assert.deepEqual(entwurfAusJson(JSON.stringify(alt)), e);
  assert.throws(() => pruefeForm(alt), /migriere/);
  assert.throws(() => migriere({ version: 7 }), /Version 7/);
  assert.throws(() => migriere(null), /kein Objekt/);
  assert.equal(entwurfZuJson(entwurfAusJson(entwurfZuJson(e))), entwurfZuJson(e), 'kanonische Rundreise');
});

test('Trägerwald: ref eindeutig, Träger vorhanden, kein Selbstbezug, keine Zyklen, gleicher Abschnitt, einbau vollständig; Ketten aus vier Gliedern gehen', () => {
  let e = grund();
  e = setze(e, { baustein: 'bau.raum', ref: 'haus', parameter: {} });
  e = setze(e, { baustein: 'bau.wand', ref: 'haus/w1', parameter: {}, traeger: 'haus', einbau: EI('innenraum', 'nw') });
  e = setze(e, { baustein: 'bau.tuer', ref: 'haus/w1/tuer', parameter: {}, traeger: 'haus/w1', einbau: EI('wand', 'mitte') });
  e = setze(e, { baustein: 'bau.fenster', ref: 'haus/w1/tuer/f', parameter: {}, traeger: 'haus/w1/tuer', einbau: EI('x', 'mitte') });
  pruefeForm(e);
  const ablehnen = (aendere, re) => { const x = kopie(e); aendere(x); assert.throws(() => pruefeForm(x), re); };
  const teil = (x, ref) => x.teile.find((t) => t.ref === ref);
  ablehnen((x) => { teil(x, 'haus/w1').ref = 'haus'; }, /ref doppelt/);
  ablehnen((x) => { teil(x, 'haus').ref = ''; }, /ref ungültig/);
  ablehnen((x) => { teil(x, 'haus/w1').traeger = 'haus/w1'; }, /Selbstbezug/);
  ablehnen((x) => { teil(x, 'haus/w1').traeger = 'gibt-es-nicht'; }, /existiert nicht/);
  ablehnen((x) => { teil(x, 'haus').traeger = 'haus/w1/tuer/f'; teil(x, 'haus').einbau = EI('a', 'nw'); }, /Zyklus/);
  ablehnen((x) => { const t = teil(x, 'haus/w1'); t.traeger = 'haus/w1/tuer'; }, /Zyklus/);
  ablehnen((x) => { delete teil(x, 'haus/w1').ref; }, /braucht eine ref/);
  ablehnen((x) => { teil(x, 'haus/w1').abschnitt = 'A2'; }, /Abschnitt/);
  ablehnen((x) => { teil(x, 'haus').einbau = EI('innenraum', 'nw'); }, /einbau ohne traeger/);
  ablehnen((x) => { delete teil(x, 'haus/w1').einbau; }, /zone/);
  ablehnen((x) => { teil(x, 'haus/w1').einbau.zone = ''; }, /zone/);
  ablehnen((x) => { teil(x, 'haus/w1').einbau.anker = 'oben'; }, /anker/);
  ablehnen((x) => { teil(x, 'haus/w1').einbau.versatz = { x: 0.5, y: 0, z: 0 }; }, /versatz/);
  ablehnen((x) => { teil(x, 'haus/w1').einbau.drehung = 4; }, /drehung/);
  ablehnen((x) => { teil(x, 'haus/w1').traeger = ''; }, /traeger ungültig/);
  ablehnen((x) => { x.aenderungen = {}; }, /aenderungen/);
});

test('Änderungen am Trägerwald über die Fachleute: ungültige Wälder werden abgelehnt, ein Träger mit Kindern wird nicht stumm entfernt', () => {
  let e = grund();
  e = setze(e, { baustein: 'bau.raum', ref: 'haus', parameter: {} });
  e = setze(e, { baustein: 'bau.wand', ref: 'w', parameter: {}, traeger: 'haus', einbau: EI('innenraum', 'nw') });
  const vorher = entwurfZuJson(e);
  const aendere = (a) => e3.aendere(e, 'architekt', a);
  assert.throws(() => aendere({ art: 'aendere-teil', id: 'T1', felder: { traeger: 'w', einbau: EI('wand', 'mitte') } }), (f) => f instanceof RechtFehler && f.code === 'ungueltig' && /Zyklus/.test(f.message));
  assert.throws(() => aendere({ art: 'entferne-teil', id: 'T1' }), (f) => f instanceof RechtFehler && /trägt noch T2/.test(f.message));
  assert.throws(() => aendere({ art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'bau.tuer', ref: 'haus', parameter: {} } }), /ref doppelt/);
  assert.throws(() => aendere({ art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'bau.tuer', parameter: {}, traeger: 'w' } }), /einbau/);
  assert.equal(entwurfZuJson(e), vorher, 'der Entwurf bleibt unverändert');
  // Kind umhängen und lösen
  let f = aendere({ art: 'aendere-teil', id: 'T2', felder: { einbau: { anker: 'se', versatz: { x: 1, y: 0, z: 0 } } } }).entwurf;
  assert.equal(f.teile[1].einbau.anker, 'se');
  assert.equal(f.teile[1].einbau.zone, 'innenraum', 'nicht genannte Felder bleiben');
  f = e3.aendere(f, 'architekt', { art: 'aendere-teil', id: 'T2', felder: { traeger: null } }).entwurf;
  assert.equal('traeger' in f.teile[1], false);
  assert.equal('einbau' in f.teile[1], false);
  f = e3.aendere(f, 'architekt', { art: 'entferne-teil', id: 'T1' }).entwurf;
  assert.equal(f.teile.length, 1);
});

test('ref-Vergabe: eine ausdrückliche ref blockiert dieselbe automatische Nummer, id null zählt als fehlend, Ersetzen behält die stabile Kennung', () => {
  let e = grund();
  e = setze(e, { baustein: 'bau.raum', ref: 'T2', parameter: {} }); // id T1, ref T2
  e = setze(e, { baustein: 'bau.wand', parameter: {} });           // würde T2 als id und ref bekommen: kollidiert mit der ausdrücklichen ref
  e = setze(e, { baustein: 'bau.tuer', parameter: {} });
  assert.deepEqual(e.teile.map((t) => [t.id, t.ref]), [['T1', 'T2'], ['T3', 'T3'], ['T4', 'T4']]);
  pruefeForm(e);
  const n = setze(e, { id: null, baustein: 'bau.fenster', parameter: {} });
  assert.deepEqual(n.teile.at(-1).id, 'T5');
  assert.equal(n.teile.at(-1).ref, 'T5');
  // Ersetzen eines vorhandenen Teils ohne ref behält dessen ref
  const f = setze(e, { id: 'T1', baustein: 'bau.raum', parameter: { breite: 3 } });
  assert.equal(f.teile.find((t) => t.id === 'T1').ref, 'T2');
  const g = setze(setze(grund(), { baustein: 'bau.raum', ref: 'haus', parameter: {} }), { baustein: 'bau.wand', ref: 'w', parameter: {}, traeger: 'haus', einbau: EI('innenraum', 'nw') });
  const h = setze(g, { id: 'T1', baustein: 'bau.raum', parameter: { breite: 8 } });
  assert.equal(h.teile.find((t) => t.id === 'T1').ref, 'haus', 'das Kind verliert seinen Träger nicht');
  pruefeForm(h);
});

/** Erwartete Weltzellen des Kinds: Kind-Blöcke im Träger-Paket (gedreht, Ecke an den Zonenpunkt) und dann mit der Träger-Lage in die Welt. */
function erwarteteWeltzellen(tPaket, kPaket, einbau, tLage) {
  const zone = tPaket.einbauzonen.find((z) => z.id === einbau.zone);
  const gedreht = kPaket.bloecke.map((b) => dreh(b, einbau.drehung));
  const h = huelleVon(gedreht);
  const mx = (a, b) => a + Math.floor((b - a) / 2);
  const pt = (q, anker) => ({ nw: [q.von.x, q.von.z], ne: [q.bis.x, q.von.z], sw: [q.von.x, q.bis.z], se: [q.bis.x, q.bis.z], mitte: [mx(q.von.x, q.bis.x), mx(q.von.z, q.bis.z)] })[anker];
  const [zx, zz] = pt(zone, einbau.anker), [cx, cz] = pt(h, einbau.anker);
  const s = { x: zx + einbau.versatz.x - cx, y: zone.von.y + einbau.versatz.y - h.von.y, z: zz + einbau.versatz.z - cz };
  return menge(gedreht.map((b) => lageAn({ x: b.x + s.x, y: b.y + s.y, z: b.z + s.z }, tLage)));
}

const zoneVon = (paket, id) => { const z = paket.einbauzonen.find((x) => x.id === id); return [z.von, z.bis]; };

test('loeseLagen: alle 5 Anker, 16 Kombinationen aus Träger- und Kinddrehung, Kind sitzt wie berechnet und liegt im Innenraum; Träger drehen und verschieben: Kinder folgen', () => {
  const raumPar = { breite: 7, tiefe: 5, hoehe: 4, wandstaerke: 2 };
  const kindPar = { stufen: 3, breite: 2 }; // nichtquadratisch (2 × 3), Nullpunkt nicht in der Ecke
  const raum = E2.baue('bau.raum', raumPar), kind = E2.baue('bau.treppe', kindPar);
  for (const anker of ['nw', 'ne', 'sw', 'se', 'mitte']) for (const dt of [0, 1, 2, 3]) for (const dk of [0, 1, 2, 3]) {
    const tLage = { x: -13, y: 64, z: 21, drehung: dt };
    const einbau = EI('innenraum', anker, { drehung: dk });
    let e = grund();
    e = setze(e, { baustein: 'bau.raum', ref: 'haus', parameter: raumPar, lage: tLage });
    e = setze(e, { baustein: 'bau.treppe', ref: 'haus/treppe', parameter: kindPar, traeger: 'haus', einbau });
    const l = e3.loeseLagen(e);
    const k2 = l.teile.find((t) => t.ref === 'haus/treppe');
    assert.equal(k2.lage.drehung, (dt + dk) % 4);
    const welt = menge(zellenInWelt(e0, kind.bloecke, k2.lage));
    assert.deepEqual(welt, erwarteteWeltzellen(raum, kind, einbau, tLage), `Anker ${anker}, Träger ${dt}, Kind ${dk}`);
    const zoneWelt = menge(zellenInWelt(e0, quaderZellen(...zoneVon(raum, 'innenraum')), tLage));
    for (const c of welt) assert.ok(zoneWelt.has(c), `Anker ${anker}, Träger ${dt}, Kind ${dk}: ${c} liegt außerhalb des Innenraums`);
    assert.deepEqual(l.teile.find((t) => t.ref === 'haus').lage, tLage, 'das Wurzelteil behält seine Lage');
  }
});

test('loeseLagen: Versatz wirkt in Träger-Richtungen (mit dem Träger gedreht), Raum → Wand → Tür als Kette, Tür liegt in der Zone der Wand', () => {
  const raumPar = { breite: 9, tiefe: 6, hoehe: 4 };
  for (const dt of [0, 1, 2, 3]) {
    const tLage = { x: 5, y: 10, z: -7, drehung: dt };
    let e = grund();
    e = setze(e, { baustein: 'bau.raum', ref: 'haus', parameter: raumPar, lage: tLage });
    e = setze(e, { baustein: 'bau.wand', ref: 'haus/w', parameter: { laenge: 5, hoehe: 3, dicke: 1 }, traeger: 'haus', einbau: EI('innenraum', 'nw', { versatz: { x: 1, y: 0, z: 2 } }) });
    e = setze(e, { baustein: 'bau.tuer', ref: 'haus/w/t', parameter: { fluegel: 1 }, traeger: 'haus/w', einbau: EI('wand', 'mitte') });
    const ohne = e3.loeseLagen(e);
    const w = ohne.teile.find((t) => t.ref === 'haus/w'), t = ohne.teile.find((x) => x.ref === 'haus/w/t');
    // die Wand liegt mit ihrer Nordwest-Ecke am Innenraum-Anfang plus Versatz (in Träger-Richtungen)
    const raum = E2.baue('bau.raum', raumPar), wand = E2.baue('bau.wand', { laenge: 5, hoehe: 3, dicke: 1 });
    const iv = raum.einbauzonen.find((z) => z.id === 'innenraum').von;
    const wh = huelleVon(wand.bloecke).von;
    const lokal = { x: iv.x + 1 - wh.x, y: iv.y - wh.y, z: iv.z + 2 - wh.z };
    assert.deepEqual({ x: w.lage.x, y: w.lage.y, z: w.lage.z }, lageAn(lokal, tLage), `Träger ${dt}: Wand`);
    // die Tür steckt vollständig in der Wandzone (Welt)
    const wandZone = menge(zellenInWelt(e0, quaderZellen(...zoneVon(wand, 'wand')), w.lage));
    for (const c of zellenInWelt(e0, E2.baue('bau.tuer', { fluegel: 1 }).bloecke, t.lage)) assert.ok(wandZone.has(k(c)), `Träger ${dt}: Tür ${k(c)} außerhalb der Wandzone`);
  }
});

test('loeseLagen: deterministisch, unabhängig von der Reihenfolge der Teile, ändert die Eingabe nicht, ist idempotent; Fehler bei unbekannter Zone', () => {
  let e = grund();
  e = setze(e, { baustein: 'bau.raum', ref: 'haus', parameter: { breite: 6, tiefe: 6, hoehe: 3 }, lage: { x: 1, y: 2, z: 3, drehung: 3 } });
  e = setze(e, { baustein: 'bau.wand', ref: 'haus/w', parameter: {}, traeger: 'haus', einbau: EI('innenraum', 'mitte') });
  e = setze(e, { baustein: 'bau.tuer', ref: 'haus/w/t', parameter: {}, traeger: 'haus/w', einbau: EI('wand', 'ne') });
  const vorher = entwurfZuJson(e);
  const a = e3.loeseLagen(e);
  assert.equal(entwurfZuJson(e), vorher, 'Eingabe unverändert');
  assert.equal(entwurfZuJson(e3.loeseLagen(a)), entwurfZuJson(a), 'idempotent');
  const rueck = kopie(e);
  rueck.teile.reverse();
  const b = e3.loeseLagen(rueck);
  for (const t of a.teile) assert.deepEqual(b.teile.find((x) => x.id === t.id).lage, t.lage, `Reihenfolge egal: ${t.ref}`);
  const falsch = kopie(e);
  falsch.teile[1].einbau.zone = 'keller';
  assert.throws(() => e3.loeseLagen(falsch), (f) => f instanceof LagenFehler && /keller/.test(f.message) && /innenraum/.test(f.message), 'die Meldung nennt die vorhandenen Zonen');
  const ohneZonen = kopie(e);
  ohneZonen.teile[2].traeger = 'haus/w'; ohneZonen.teile[2].einbau.zone = 'innenraum'; // bau.wand hat nur die Zone "wand"
  assert.throws(() => e3.loeseLagen(ohneZonen), LagenFehler);
  const zyklus = kopie(e);
  zyklus.teile[0].traeger = 'haus/w/t'; zyklus.teile[0].einbau = EI('wand', 'nw');
  assert.throws(() => e3.loeseLagen(zyklus), /Zyklus/, 'auch ohne pruefeForm läuft die Funktion nie endlos');
  const keinTraeger = kopie(e);
  keinTraeger.teile[1].traeger = 'weg';
  assert.throws(() => e3.loeseLagen(keinTraeger), /existiert nicht/);
});
