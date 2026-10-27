import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from './hilfe5.js';

const BERUFE = { 0: 'armorer', 1: 'butcher', 2: 'cartographer', 3: 'cleric', 4: 'farmer', 5: 'fisherman', 6: 'fletcher', 7: 'leatherworker', 8: 'librarian', 9: 'mason', 10: 'shepherd', 11: 'toolsmith', 12: 'weaponsmith' };

test('Zitadelle (Stufe 1): die Spezifikation besteht Prüfer und Übersetzung und enthält die Zahlen aus den Bildern', async () => {
  const e = await engine();
  const spec = await holeJson('data/beispiele/zitadelle.json');
  const p = e.ebene4.pruefe(spec);
  assert.deepEqual(p.rueckfragen, []);
  const u = e.ebene3.uebersetzung.uebersetze(spec);
  assert.deepEqual(u.rueckfragen, []);
  assert.equal(u.vorgabe.abschnitte.length, spec.teile.length, 'ein Abschnitt je Teil');
  // Hüllen überschneiden sich nicht (3D)
  const h = u.vorgabe.abschnitte.map((a) => a.huelle);
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) {
    const a = h[i], b = h[j];
    const ueber = a.von.x <= b.bis.x && b.von.x <= a.bis.x && a.von.y <= b.bis.y && b.von.y <= a.bis.y && a.von.z <= b.bis.z && b.von.z <= a.bis.z;
    assert.equal(ueber, false, `${u.vorgabe.abschnitte[i].id} und ${u.vorgabe.abschnitte[j].id} überschneiden sich`);
  }
  // Zahlen aus den Bildern. ACHTUNG: Bild 13 nennt „8 × 20 = 160 Nischen“, zeigt aber nur 7 Viertel mit Ständen (Händlerlisten 1–70 = 7 × 10) und die Eingangshalle ohne Stände: 7 × 20 = 140.
  // Die Spezifikation folgt den Viertel-Karten (140); die Frage an Jonah steht in docs/zitadelle/beschreibung.md.
  const nischen = spec.teile.flatMap((t) => (t.funktionen ?? []).filter((f) => f.art === 'handelsnischen'));
  assert.equal(nischen.reduce((s, f) => s + f.menge, 0), 140);
  const viertel = spec.teile.filter((t) => t.id.startsWith('viertel-') && t.id !== 'viertel-sued');
  assert.equal(viertel.length, 7, 'sieben Viertel mit Ständen, dazu die Eingangshalle im Süden');
  for (const v of viertel) assert.equal(v.funktionen.reduce((s, f) => s + f.menge, 0), 20, v.id);
  const lager = spec.teile.find((t) => t.id === 'hauptlager').funktionen[0].sorten;
  assert.equal(lager.length, 48);
  assert.equal(new Set(lager).size, 48);
  // Berufe je Viertel nach Bild 13
  const berufe = (id) => [...new Set(spec.teile.find((t) => t.id === id).funktionen.map((f) => BERUFE[f.beruf]))].sort();
  assert.deepEqual(berufe('viertel-nord'), ['librarian']);
  assert.deepEqual(berufe('viertel-nordwest'), ['cleric', 'fletcher']);
  assert.deepEqual(berufe('viertel-west'), ['cartographer', 'mason']);
  assert.deepEqual(berufe('viertel-suedwest'), ['fisherman', 'leatherworker', 'shepherd']);
  assert.deepEqual(berufe('viertel-suedost'), ['butcher', 'farmer']);
  assert.deepEqual(berufe('viertel-ost'), ['toolsmith', 'weaponsmith']);
  assert.deepEqual(berufe('viertel-nordost'), ['armorer']);
  // Maße aus den Bildern
  const maß = (id) => spec.teile.find((t) => t.id === id).form.groesse;
  assert.equal(maß('rotunde').breite, 33);
  assert.equal(maß('hauptturm').hoehe, 110);
  for (const k of ['nw', 'no', 'sw', 'so']) assert.equal(maß(`eckturm-${k}`).hoehe, 80);
  assert.equal(maß('bruecke-west').laenge, 46);
  assert.equal(maß('bruecke-west').spannweite, 13);
  assert.equal(maß('portal').spannweite, 15);
  // Rotunde 36 hoch + Kuppel (Ø 33, Verhältnis 1,7 → 28) = Höhe 64
  const kuppel = u.vorgabe.abschnitte.find((a) => a.id === 'kuppel').huelle, halle = u.vorgabe.abschnitte.find((a) => a.id === 'rotunde').huelle;
  assert.equal(kuppel.bis.y - halle.von.y + 1, 64);
  // Lage der diagonalen Viertel strahlenförmig von der Rotunde (die vier Richtungen liegen in den richtigen Ecken)
  const mitte = (a) => [(a.von.x + a.bis.x) / 2, (a.von.z + a.bis.z) / 2];
  const [rx, rz] = mitte(halle);
  const ort = (id) => { const [x, z] = mitte(u.vorgabe.abschnitte.find((a) => a.id === id).huelle); return [Math.sign(x - rx), Math.sign(z - rz)]; };
  assert.deepEqual(ort('viertel-nordost'), [1, -1]);
  assert.deepEqual(ort('viertel-suedost'), [1, 1]);
  assert.deepEqual(ort('viertel-suedwest'), [-1, 1]);
  assert.deepEqual(ort('viertel-nordwest'), [-1, -1]);
  // das Untergeschoss steht unter der Erde, die Hülle liegt im erlaubten Höhenbereich
  const ug = u.vorgabe.abschnitte.find((a) => a.id === 'untergeschoss').huelle;
  assert.ok(ug.bis.y < 0 && ug.von.y >= -64);
  // offene Funktionen ohne Modul werden gemeldet, nicht verschwiegen
  const ohne = p.hinweise.filter((x) => /noch kein Modul/.test(x.text)).map((x) => x.text.match(/„([^“]+)“/)[1]).sort();
  assert.deepEqual(ohne, ['aufzug', 'bahnhof', 'bruteranlage', 'entladestelle', 'felder', 'lorenbahn-netz', 'sammelbecken', 'wasserrueckfuehrung', 'wohnbereich']);
});
