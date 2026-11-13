import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2, ebene3 } from '../hilfe.js';
import { definiere } from '../../src/ebene2/index.js';
import { neuerEntwurf, entwurfZuJson } from '../../src/ebene3/index.js';
import { zellenInWelt, quaderZellen } from '../../src/ebene2/zellen.js';

const e3 = ebene3();
const E2 = ebene2();
const e0 = E2.ebene0;
const B = e3.ebene1.bewegung;
const ARTEN = ['spieler', 'dorfbewohner', 'baby'];
const k = (z) => `${z.x},${z.y},${z.z}`;
const MIT = { testmaterial: true };
const EI = (zone, anker, extra = {}) => ({ zone, anker, versatz: { x: 0, y: 0, z: 0 }, drehung: 0, ...extra });

function grund() {
  let e = neuerEntwurf({ name: 'Zusammenbau' });
  e = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Haus', reihenfolge: 1 } }).entwurf;
  return e;
}
const setze = (e, teil) => e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', ...teil } }).entwurf;
const einwaende = (e, regel) => e3.einwaende.sammle(e).einwaende.filter((x) => (regel ? x.regel === regel : true) && /^plan\.(geometrie|freiraum)$/.test(x.regel));
const raumTeil = { baustein: 'bau.raum', ref: 'haus', parameter: { breite: 7, tiefe: 7, hoehe: 3 }, lage: { x: 0, y: 0, z: 0, drehung: 0 } };
const mitTreppe = (drehung = 0, extra = {}) => setze(setze(grund(), raumTeil), { baustein: 'bau.treppe', ref: 'haus/treppe', parameter: { stufen: 4, breite: 2 }, traeger: 'haus', einbau: EI('innenraum', 'sw', { drehung, ...extra }) });

test('Zusammenbau Raum → Treppe: die Decke wird genau dort ausgespart, wo die Treppe steigt, nichts außerhalb; die Treppe steht in der Zone oder ersetzt Deckenblöcke', () => {
  const e = mitTreppe();
  const ohne = e3.materialisiere(setze(grund(), raumTeil), MIT);
  const mat = e3.materialisiere(e, MIT);
  const raum = mat.teile.get('T1').schluessel, kind = mat.teile.get('T2').schluessel, vorher = ohne.teile.get('T1').schluessel;
  const weg = [...vorher].filter((c) => !raum.has(c));
  assert.ok(weg.length > 0, 'es wurde etwas ausgespart');
  assert.equal([...raum].filter((c) => !vorher.has(c)).length, 0, 'der Raum bekommt keine neuen Blöcke');
  // nur die Decke (y = 3) ist betroffen: die Kopffreiheit der niedrigen Stufen reicht nicht bis in die Wände
  assert.ok(weg.every((c) => Number(c.split(',')[1]) === 3), 'nur Deckenblöcke entfallen');
  // genau: Stufen 0 … 3 liegen auf z = z0 … z0 − 3; über jeder Stufe sind die Zellen bis y = s + 3 frei, y = 3 liegt für alle vier in der Spannweite
  const kindZ = [...kind].map((c) => c.split(',').map(Number));
  const xs = new Set(kindZ.map(([x]) => x)), zs = new Set(kindZ.map(([, , z]) => z));
  const erwartet = new Set([...zs].flatMap((z) => [...xs].map((x) => `${x},3,${z}`)).filter((c) => vorher.has(c)));
  assert.deepEqual(new Set(weg), erwartet, 'Aussparung = Grundfläche der Treppe in der Decke');
  // Besitzkarte: eine ausgesparte Zelle gehört dem Kind (die oberste Stufe) oder niemandem, nie dem Raum
  for (const c of weg) assert.notEqual(mat.besitz.get(c), 'T1');
  assert.equal(mat.besitz.get([...kind][0]), 'T2');
  assert.deepEqual(einwaende(e), [], 'kein Einwand: die Treppe liegt in der Zone bzw. ersetzt Decke, die Freihaltung bleibt leer');
  // die Welt hat den Durchbruch wirklich
  for (const c of weg) { const [x, y, z] = c.split(',').map(Number); assert.ok(mat.welt.istLuft(x, y, z) || kind.has(c), `Welt: ${c}`); }
});

test('Zusammenbau Raum → Treppe (Ebene 1): Spieler, Dorfbewohner und Baby gehen durch den Durchbruch hinauf; in allen vier Drehungen von Raum und Treppe', () => {
  for (const dt of [0, 1, 2, 3]) for (const dk of [0, 2]) {
    let e = setze(grund(), { ...raumTeil, lage: { x: 3, y: 0, z: -2, drehung: dt } });
    e = setze(e, { baustein: 'bau.treppe', ref: 'haus/treppe', parameter: { stufen: 4, breite: 2 }, traeger: 'haus', einbau: EI('innenraum', 'mitte', { drehung: dk }) });
    const mat = e3.materialisiere(e, MIT);
    assert.deepEqual(einwaende(e), [], `Raum ${dt}, Treppe ${dk}`);
    // Weg: von einer Innenzelle vor dem Fuß der Treppe bis auf die Decke hinter dem Kopf der Treppe
    const stufen = [...mat.teile.get('T2').schluessel].map((c) => c.split(',').map(Number));
    const oben = stufen.filter(([, y]) => y === 3), unten = stufen.filter(([, y]) => y === 0);
    const mx = (l, i) => l.reduce((s, c) => s + c[i], 0) / l.length;
    const fuss = { x: mx(unten, 0), z: mx(unten, 2) }, kopf = { x: mx(oben, 0), z: mx(oben, 2) };
    const dx = Math.sign(kopf.x - fuss.x), dz = Math.sign(kopf.z - fuss.z);
    assert.ok(Math.abs(dx) + Math.abs(dz) === 1, `Treppe steigt entlang einer Achse (${dx},${dz})`);
    const von = { x: Math.round(fuss.x - dx * 1), y: 0, z: Math.round(fuss.z - dz * 1) }, nach = { x: Math.round(kopf.x + dx * 1), y: 4, z: Math.round(kopf.z + dz * 1) };
    for (const art of ARTEN) {
      const r = B.weg(mat.welt, von, nach, art, { radius: 12 });
      assert.equal(r.ok, true, `${art}, Raum ${dt}, Treppe ${dk}: ${r.grund}`);
    }
  }
});

test('Zusammenbau Raum → Wand → Tür: die Tür sitzt in der ausgesparten Wand, Kette über drei Ebenen; ohne Tür hält die Wand, mit Tür gehen alle hindurch', () => {
  const raum = { ...raumTeil, parameter: { breite: 9, tiefe: 7, hoehe: 3 } };
  const wand = { baustein: 'bau.wand', ref: 'haus/w', parameter: { laenge: 9, hoehe: 3, dicke: 1 }, traeger: 'haus', einbau: EI('innenraum', 'nw', { versatz: { x: 0, y: 0, z: 3 } }) };
  const tuer = { baustein: 'bau.tuer', ref: 'haus/w/t', parameter: { fluegel: 1 }, traeger: 'haus/w', einbau: EI('wand', 'mitte') };
  for (const dt of [0, 1, 2, 3]) {
    const lage = { x: 4, y: 0, z: 4, drehung: dt };
    const a = setze(setze(grund(), { ...raum, lage }), wand), b = setze(a, tuer);
    const ma = e3.materialisiere(a, MIT), mb = e3.materialisiere(b, MIT);
    assert.deepEqual(einwaende(b), [], `Träger ${dt}`);
    assert.equal(ma.teile.get('T2').schluessel.size, 9 * 3);
    assert.equal(mb.teile.get('T2').schluessel.size, 9 * 3 - 2, 'die Wand verliert genau die zwei Türzellen');
    const t = mb.teile.get('T3').schluessel;
    assert.equal(t.size, 2);
    for (const c of t) { assert.ok(ma.teile.get('T2').schluessel.has(c), `Tür ${c} saß in der Wand`); assert.ok(!mb.teile.get('T2').schluessel.has(c)); assert.equal(mb.besitz.get(c), 'T3'); }
    // Weg: von der einen Raumhälfte in die andere, entlang der Raumachse senkrecht zur Wand
    const wz = [...ma.teile.get('T2').schluessel].map((c) => c.split(',').map(Number));
    const mxx = wz.reduce((s, c) => s + c[0], 0) / wz.length, mzz = wz.reduce((s, c) => s + c[2], 0) / wz.length;
    const tz = [...t].map((c) => c.split(',').map(Number));
    const tx = tz.reduce((s, c) => s + c[0], 0) / tz.length, tzz = tz.reduce((s, c) => s + c[2], 0) / tz.length;
    // Wandrichtung ist die Achse mit der größeren Ausdehnung
    const breitX = Math.max(...wz.map((c) => c[0])) - Math.min(...wz.map((c) => c[0])) > Math.max(...wz.map((c) => c[2])) - Math.min(...wz.map((c) => c[2]));
    const von = breitX ? { x: Math.round(tx), y: 0, z: Math.round(mzz) - 1 } : { x: Math.round(mxx) - 1, y: 0, z: Math.round(tzz) };
    const nach = breitX ? { ...von, z: von.z + 2 } : { ...von, x: von.x + 2 };
    for (const art of ARTEN) {
      assert.equal(B.weg(ma.welt, von, nach, art, { radius: 12 }).ok, false, `${art}, Träger ${dt}: die Wand ohne Tür hält`);
      const r = B.weg(mb.welt, von, nach, art, { radius: 12 });
      assert.equal(r.ok, true, `${art}, Träger ${dt}: durch die Tür ${r.grund}`);
    }
  }
});

test('Einwand: ein Kind außerhalb der Einbauzone seines Trägers wird gemeldet, mit Ort, Text und Zuständigem', () => {
  let e = setze(grund(), raumTeil);
  e = setze(e, { baustein: 'bau.tuer', ref: 'haus/t', parameter: {}, traeger: 'haus', einbau: EI('wand-sued', 'mitte', { versatz: { x: 30, y: 0, z: 0 } }) });
  const liste = einwaende(e, 'plan.geometrie');
  assert.equal(liste.length, 1);
  assert.match(liste[0].text, /außerhalb der Einbauzone "wand-sued" von bau\.raum \(T1\)/);
  assert.equal(liste[0].ziel, 'teil:T2');
  assert.equal(liste[0].schluessel, 'plan.geometrie|einbau|T2');
  // in der Zone: kein Einwand
  const gut = setze(setze(grund(), raumTeil), { baustein: 'bau.tuer', ref: 'haus/t', parameter: {}, traeger: 'haus', einbau: EI('wand-sued', 'mitte') });
  assert.deepEqual(einwaende(gut), []);
});

test('Freiraum: ein Block in der Kopffreiheit der Treppe ist ein Einwand (auch ein Teil des Geschwisters), außerhalb der Freihaltung nicht', () => {
  const e = mitTreppe();
  const mat = e3.materialisiere(e, MIT);
  const stufen = [...mat.teile.get('T2').schluessel].map((c) => c.split(',').map(Number));
  const s2 = stufen.find(([, y]) => y === 2); // Stufe 2: Kopffreiheit y = 3 … 5
  const kopf = { x: s2[0], y: 4, z: s2[2] };
  // ein einzelner Wandblock (Geschwister der Treppe) mitten in der Kopffreiheit
  const blockiert = setze(e, { baustein: 'bau.wand', ref: 'klotz', parameter: { laenge: 1, hoehe: 1, dicke: 1 }, lage: { x: kopf.x, y: kopf.y, z: kopf.z, drehung: 0 } });
  const liste = einwaende(blockiert, 'plan.freiraum');
  assert.equal(liste.length, 1);
  assert.match(liste[0].text, /steht in 1 Zellen, die bau\.treppe \(T2\) freihalten muss/);
  assert.deepEqual(liste[0].ort, kopf);
  assert.equal(liste[0].schluessel, 'plan.freiraum|T2|T3');
  // außerhalb der Freihaltung (vier Blöcke über der Stufe, ein Block neben der Treppe): kein Einwand
  for (const aus of [{ x: s2[0], y: 6, z: s2[2] }, { x: s2[0] + 5, y: 1, z: s2[2] }]) {
    const frei = setze(e, { baustein: 'bau.wand', ref: 'klotz', parameter: { laenge: 1, hoehe: 1, dicke: 1 }, lage: { ...aus, drehung: 0 } });
    assert.deepEqual(einwaende(frei, 'plan.freiraum'), [], JSON.stringify(aus));
  }
});

test('Zusammenbau: deterministisch, unabhängig von der Reihenfolge der Teile, ändert den Entwurf nicht; ohne Kinder wie zuvor (kein einbau, Besitz = erstes Teil)', () => {
  const e = mitTreppe(1);
  const vorher = entwurfZuJson(e);
  const a = e3.materialisiere(e, MIT);
  assert.equal(entwurfZuJson(e), vorher);
  const umgekehrt = JSON.parse(vorher); umgekehrt.teile.reverse();
  const b = e3.materialisiere(umgekehrt, MIT);
  for (const id of ['T1', 'T2']) assert.deepEqual([...a.teile.get(id).schluessel].sort(), [...b.teile.get(id).schluessel].sort(), id);
  assert.deepEqual([...a.besitz].sort(), [...b.besitz].sort());
  const flach = e3.materialisiere(setze(grund(), raumTeil), MIT);
  assert.equal(flach.einbau, null);
  for (const [c, id] of flach.besitz) assert.equal(id, 'T1', c);
});

test('Zusammenbau: gemerkte Teile bleiben unverändert (der Raum ohne Kind hat danach wieder seine Decke), Entwürfe ohne Kinder liefern dieselbe Besitzkarte', () => {
  const nurRaum = setze(grund(), raumTeil);
  const schnapp = (m) => ({ t: [...m.teile.get('T1').schluessel].sort(), a: [...m.teile.get('T1').arbeitsbloecke].sort(), b: [...m.besitz].sort() });
  const vorher = schnapp(e3.materialisiere(nurRaum, MIT));
  assert.ok(vorher.t.length > 0 && vorher.b.length === vorher.t.length, 'die Besitzkarte ist nicht leer');
  const mitKind = e3.materialisiere(mitTreppe(), MIT);
  assert.ok(mitKind.teile.get('T1').schluessel.size < vorher.t.length, 'mit Treppe fehlen Deckenblöcke');
  assert.deepEqual(schnapp(e3.materialisiere(nurRaum, MIT)), vorher, 'danach wieder vollständig (der Cache wurde nicht verändert)');
});

test('Freiraum: Rangregel und alle Belegungen: Techniker über Architekt, gleicher Besitzer → Bauleiter, mehrere Teile in einer Zelle', () => {
  const e = mitTreppe();
  const mat = e3.materialisiere(e, MIT);
  const s2 = [...mat.teile.get('T2').schluessel].map((c) => c.split(',').map(Number)).find(([, y]) => y === 2);
  const kopf = { x: s2[0], y: 4, z: s2[2] };
  const klotz = (ref) => ({ baustein: 'bau.wand', ref, parameter: { laenge: 1, hoehe: 1, dicke: 1 }, lage: { ...kopf, drehung: 0 } });
  // gleicher Besitzer (Architekt): der Bauleiter fragt den Architekten, das Ziel ist der Blockierer
  const gleich = einwaende(setze(e, klotz('klotz')), 'plan.freiraum');
  assert.equal(gleich.length, 1);
  assert.deepEqual([gleich[0].von, gleich[0].an, gleich[0].ziel], ['bauleiter', 'architekt', 'teil:T3']);
  // ein Technikteil in der Kopffreiheit: der höhere Rang (Techniker) verlangt, dass der Architekt die Treppe ändert
  const t = e3.aendere(e, 'techniker', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'tech.antriebsstrecke', parameter: {}, lage: { ...kopf, drehung: 0 } } }).entwurf;
  const tech = einwaende(t, 'plan.freiraum');
  assert.equal(tech.length, 1);
  assert.deepEqual([tech[0].von, tech[0].an, tech[0].ziel], ['techniker', 'architekt', 'teil:T2']);
  // zwei Teile in derselben Freihaltezelle: für jeden ein Einwand (die Überschneidung der beiden meldet plan.geometrie zusätzlich)
  const zwei = setze(setze(e, klotz('a')), klotz('b'));
  assert.deepEqual(einwaende(zwei, 'plan.freiraum').map((x) => x.schluessel).sort(), ['plan.freiraum|T2|T3', 'plan.freiraum|T2|T4']);
  assert.equal(einwaende(zwei, 'plan.geometrie').filter((x) => /gemeinsame Blöcke/.test(x.text)).length, 1);
});

test('Freiraum: ein Kind, dessen eigener Block in der eigenen Freihaltung steht, ist ein Einwand; große Räume mit mehreren Kindern bleiben schnell', () => {
  const selbst = definiere({
    id: 'bau.test-selbst', titel: 'Selbstblockade (nur Test)', quelle: 'https://beispiel.invalid/', testszenario: { start: 's', erwartung: 'e' }, parameter: [],
    baue: () => ({ bloecke: [{ x: 0, y: 0, z: 0, rolle: 'wand' }], aussparungen: [{ art: 'freihaltung', von: { x: 0, y: 0, z: 0 }, bis: { x: 0, y: 1, z: 0 } }] }),
  });
  E2.bausteine.set(selbst.id, selbst);
  try {
    const e = setze(setze(grund(), raumTeil), { baustein: selbst.id, ref: 'haus/s', parameter: {}, traeger: 'haus', einbau: EI('innenraum', 'mitte') });
    const liste = einwaende(e, 'plan.freiraum');
    assert.equal(liste.length, 1);
    assert.deepEqual([liste[0].von, liste[0].an, liste[0].ziel, liste[0].schluessel], ['bauleiter', 'architekt', 'teil:T2', 'plan.freiraum|T2|T2']);
  } finally { E2.bausteine.delete(selbst.id); }
  // großer Raum (Innenraum 40 × 40 × 20) mit drei Kindern: die Zone wird nicht Zelle für Zelle aufgebaut
  let e = setze(grund(), { ...raumTeil, parameter: { breite: 40, tiefe: 40, hoehe: 20 }, lage: { x: 0, y: 0, z: 0, drehung: 1 } });
  e = setze(e, { baustein: 'bau.tuer', ref: 'haus/t', parameter: {}, traeger: 'haus', einbau: EI('wand-sued', 'mitte') });
  e = setze(e, { baustein: 'bau.fenster', ref: 'haus/f', parameter: {}, traeger: 'haus', einbau: EI('wand-nord', 'mitte', { versatz: { x: 0, y: 3, z: 0 } }) });
  e = setze(e, { baustein: 'bau.treppe', ref: 'haus/tr', parameter: { stufen: 21, breite: 3 }, traeger: 'haus', einbau: EI('innenraum', 'nw') });
  const start = Date.now();
  const mat = e3.materialisiere(e, MIT);
  assert.deepEqual(einwaende(e), []);
  assert.ok(mat.teile.get('T1').schluessel.size > 1000);
  assert.ok(Date.now() - start < 20000, 'große Räume brauchen keine Zellenmengen der ganzen Zone');
});
