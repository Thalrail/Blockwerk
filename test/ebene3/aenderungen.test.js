import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2, ebene3 } from '../hilfe.js';
import { neuerEntwurf, kopie, pruefeForm, entwurfZuJson, entwurfAusJson, AenderungsFehler } from '../../src/ebene3/index.js';
import { rahmenZuPaket, zellenInWelt } from '../../src/ebene2/zellen.js';
import { huelleVon } from '../../src/ebene2/baustein.js';

const e3 = ebene3();
const E2 = ebene2();
const e0 = E2.ebene0;
const A = e3.aenderungen;
const MIT = { testmaterial: true };
const k = (z) => `${z.x},${z.y},${z.z}`;
const nf = (n) => 0 - (0 - n);
const dreh = (z, v) => { let { x, z: zz } = z; for (let i = 0; i < ((v % 4) + 4) % 4; i++) [x, zz] = [-zz, x]; return { x: nf(x), y: z.y, z: nf(zz) }; };
const lageAn = (z, l) => { const d = dreh(z, l.drehung); return { x: d.x + l.x, y: d.y + l.y, z: d.z + l.z }; };
const EI = (zone, anker, extra = {}) => ({ zone, anker, versatz: { x: 0, y: 0, z: 0 }, drehung: 0, ...extra });
const raumPar = { breite: 7, tiefe: 5, hoehe: 3 };

function grund(lage = { x: 4, y: 10, z: -3, drehung: 0 }, par = raumPar) {
  let e = neuerEntwurf({ name: 'Änderungen' });
  e = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Haus', reihenfolge: 1 } }).entwurf;
  e = e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'bau.raum', ref: 'haus', parameter: par, lage } }).entwurf;
  return e;
}
const setzeTeil = (e, teil) => e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', ...teil } }).entwurf;
/** Weltzelle einer Rahmenzelle des Raums (unabhängig berechnet: Paketkoordinaten, dann Lage). */
const weltZelle = (par, lage, rz) => { const p = E2.baue('bau.raum', par), h = huelleVon(p.bloecke).von; return lageAn({ x: rz.x + h.x, y: rz.y + h.y, z: rz.z + h.z }, lage); };
const einwaende = (e) => e3.einwaende.sammle(e).einwaende.filter((x) => x.regel === 'plan.aenderung');

test('Änderungen: Setzen und Entfernen am Bauteil: Welt, Besitz und Schlüssel stimmen, in allen Drehungen und Lagen', () => {
  for (const drehung of [0, 1, 2, 3]) {
    const lage = { x: -9, y: 20, z: 7, drehung };
    let e = grund(lage);
    const glas = { x: 2, y: 1, z: 0 }, weg = { x: 0, y: 0, z: 0 };     // Rahmenzelle (2,1,0): Nordwand, (0,0,0): untere Nordwest-Ecke
    e = A.setze(e, { teil: 'haus', zelle: glas, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
    e = A.setze(e, { teil: 'haus', zelle: weg, op: 'leere' }, 'Jonah').entwurf;
    const ohne = e3.materialisiere(grund(lage), MIT), mat = e3.materialisiere(e, MIT);
    const g = weltZelle(raumPar, lage, glas), w = weltZelle(raumPar, lage, weg);
    assert.equal(mat.welt.leseBlock(g.x, g.y, g.z).id, 'minecraft:glass', `Drehung ${drehung}: Glas an der Weltzelle`);
    assert.ok(mat.welt.istLuft(w.x, w.y, w.z), `Drehung ${drehung}: Eckblock entfernt`);
    assert.ok(!ohne.welt.istLuft(w.x, w.y, w.z) && ohne.welt.leseBlock(g.x, g.y, g.z).id !== 'minecraft:glass');
    const t = mat.teile.get('T1');
    assert.ok(t.schluessel.has(k(g)) && !t.schluessel.has(k(w)));
    assert.equal(t.schluessel.size, ohne.teile.get('T1').schluessel.size - 1, 'ein Block weniger (Eckblock), der Glasblock ersetzt nur');
    assert.equal(mat.besitz.get(k(g)), 'T1');
    assert.deepEqual([...mat.aenderungen].map(([id, s]) => [id, s.status]), [['C1', 'angewandt'], ['C2', 'angewandt']]);
    // gemerkte Teile bleiben unverändert: ein zweiter Lauf ohne Änderungen sieht wieder den vollständigen Raum
    const wieder = e3.materialisiere(grund(lage), MIT);
    assert.equal(wieder.teile.get('T1').schluessel.size, ohne.teile.get('T1').schluessel.size);
    assert.ok(!wieder.welt.istLuft(w.x, w.y, w.z));
  }
});

test('Änderungen: der Zustand eines gesetzten Blocks dreht mit dem Bauteil mit (Treppe zeigt in dieselbe Richtung relativ zum Raum)', () => {
  const stufe = { id: 'minecraft:stone_stairs', zustand: { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' } };
  const zustaende = [0, 1, 2, 3].map((drehung) => {
    const lage = { x: 0, y: 0, z: 0, drehung };
    let e = A.setze(grund(lage), { teil: 'haus', zelle: { x: 3, y: 0, z: 2 }, op: 'setze', block: stufe }, 'Jonah').entwurf; // Boden-/Innenzelle
    const g = weltZelle(raumPar, lage, { x: 3, y: 0, z: 2 });
    return e3.materialisiere(e, MIT).welt.leseBlock(g.x, g.y, g.z);
  });
  for (const [drehung, b] of zustaende.entries()) {
    assert.equal(b.id, 'minecraft:stone_stairs');
    const soll = e0.vermesser.transformiereZustand(stufe.zustand, { typ: 'drehen' }, drehung, stufe.id);
    assert.deepEqual(b.zustand, { ...soll }, `Drehung ${drehung}`);
  }
  assert.notEqual(zustaende[0].zustand.weirdo_direction, zustaende[1].zustand.weirdo_direction, 'der Zustand hat sich wirklich gedreht');
});

test('Änderungen: Eingaben werden geprüft, die jüngste Änderung je Zelle gilt, der Baubericht protokolliert, der Entwurf bleibt unverändert', () => {
  const e = grund();
  const vorher = entwurfZuJson(e);
  const z = { x: 1, y: 1, z: 0 };
  for (const [a, re] of [
    [{ teil: 'gibtsnicht', zelle: z, op: 'leere' }, /gibt es nicht/],
    [{ teil: 'haus', zelle: { x: 1.5, y: 0, z: 0 }, op: 'leere' }, /ganze Zahlen/],
    [{ teil: 'haus', zelle: z, op: 'zaubere' }, /op „zaubere“ unbekannt/],
    [{ teil: 'haus', zelle: z, op: 'setze' }, /setze braucht block/],
    [{ teil: 'haus', zelle: z, op: 'setze', block: { id: 'minecraft:gibtsnicht' } }, AenderungsFehler],
    [{ teil: 'haus', zelle: z, op: 'setze', block: { id: 'minecraft:glass', zustand: 'viel' } }, /zustand muss ein Objekt/],
    [{ teil: 'haus', zelle: z, op: 'leere', block: { id: 'minecraft:glass' } }, /leere hat keinen block/],
  ]) assert.throws(() => A.setze(e, a, 'Jonah'), re);
  assert.equal(entwurfZuJson(e), vorher);
  let f = A.setze(e, { teil: 'haus', zelle: z, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  f = A.setze(f, { teil: 'haus', zelle: z, op: 'setze', block: { id: 'minecraft:stone' } }, 'Anna').entwurf;
  assert.equal(f.aenderungen.length, 1, 'je Teil und Zelle gilt die jüngste Änderung');
  assert.deepEqual([f.aenderungen[0].id, f.aenderungen[0].block.id, f.aenderungen[0].von, f.aenderungen[0].quelle], ['C2', 'minecraft:stone', 'Anna', 'benutzer']);
  assert.equal(f.zaehler.aenderung, 3);
  assert.equal(f.bericht.length, e.bericht.length + 2);
  assert.match(f.bericht.at(-1).satz, /minecraft:stone gesetzt an Zelle \(1, 1, 0\) im Rahmen des Teils \(C2, von Anna\)/);
  // JSON-Rundreise und Formprüfung
  assert.deepEqual(entwurfAusJson(entwurfZuJson(f)), f);
  const kaputt = (aendere, re) => { const x = kopie(f); aendere(x); assert.throws(() => pruefeForm(x), re); };
  kaputt((x) => x.aenderungen.push({ ...x.aenderungen[0] }), /Änderung-ID doppelt/);
  kaputt((x) => { x.aenderungen[0].quelle = 'agent'; }, /quelle muss/);
  kaputt((x) => { delete x.aenderungen[0].von; }, /von \(Name\) fehlt/);
  kaputt((x) => { x.aenderungen[0].zelle = { x: 0, y: 0 }; }, /zelle braucht/);
  kaputt((x) => { x.aenderungen[0].block = { id: 'stone' }; }, /block\.id/);
});

test('Verwaisung: eine Änderung außerhalb des Teils wird nicht angewendet und ist ein Einwand an Jonah, nichts geschieht automatisch', () => {
  let e = A.setze(grund(), { teil: 'haus', zelle: { x: 8, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf; // Ostwand des 9 breiten Außenmaßes (7 + 2 Wände)
  assert.deepEqual(einwaende(e), [], 'solange die Zelle im Teil liegt, kein Einwand');
  const klein = e3.aendere(e, 'architekt', { art: 'aendere-teil', id: 'T1', felder: { parameter: { breite: 3 } } }).entwurf; // Außenmaß 5: Zelle x = 8 liegt draußen
  const mat = e3.materialisiere(klein, MIT);
  assert.deepEqual([mat.aenderungen.get('C1').status, mat.aenderungen.get('C1').grund], ['verwaist', 'ausserhalb']);
  const t = mat.teile.get('T1');
  assert.equal([...t.schluessel].filter((c) => mat.welt.leseBlock(...c.split(',').map(Number)).id === 'minecraft:glass').length, 0, 'nichts wurde angewendet, nichts verschoben');
  const liste = einwaende(klein);
  assert.equal(liste.length, 1);
  assert.match(liste[0].text, /Änderung C1 \(minecraft:glass setzen an der Rahmenzelle \(8, 1, 0\) von „haus“\) lässt sich nicht anwenden: die Zelle liegt nicht mehr im Teil/);
  assert.match(liste[0].text, /Jonah entscheidet: verwerfen oder neu verankern/);
  assert.equal(liste[0].regel, 'plan.aenderung');
  assert.equal(liste[0].ziel, 'teil:T1');
  assert.equal(klein.aenderungen.length, 1, 'die Änderung bleibt gespeichert, bis Jonah entscheidet');
  // Jonah verankert neu: danach wirkt sie und der Einwand verschwindet
  const neu = A.verankere(klein, 'C1', { zelle: { x: 4, y: 1, z: 0 } }, 'Jonah').entwurf;
  assert.deepEqual(einwaende(neu), []);
  assert.equal(e3.materialisiere(neu, MIT).aenderungen.get('C1').status, 'angewandt');
  assert.match(neu.bericht.at(-1).satz, /Änderung C1 neu verankert/);
  // oder verwirft sie
  const weg = A.verwirf(klein, 'C1', 'Jonah').entwurf;
  assert.equal(weg.aenderungen.length, 0);
  assert.deepEqual(einwaende(weg), []);
  assert.match(weg.bericht.at(-1).satz, /Änderung C1 .* verworfen auf Entscheidung von Jonah/);
  assert.throws(() => A.verwirf(klein, 'C9', 'Jonah'), /gibt es nicht/);
  assert.throws(() => A.verankere(klein, 'C1', { zelle: { x: 1, y: 1 } }, 'Jonah'), /ganzen Zahlen|ganze Zahlen/);
  assert.throws(() => A.verankere(klein, 'C1', { teil: 'nix', zelle: { x: 1, y: 1, z: 1 } }, 'Jonah'), /gibt es nicht/);
});

test('Neu verankern: eine schon vorhandene Änderung an der Zielzelle wird nie stillschweigend verdrängt', () => {
  let e = A.setze(grund(), { teil: 'haus', zelle: { x: 2, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  e = A.setze(e, { teil: 'haus', zelle: { x: 3, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:stone' } }, 'Jonah').entwurf;
  const vorher = JSON.stringify(e.aenderungen);
  assert.throws(() => A.verankere(e, 'C1', { zelle: { x: 3, y: 1, z: 0 } }, 'Jonah'), /gibt es schon die Änderung C2/);
  assert.equal(JSON.stringify(e.aenderungen), vorher, 'beide Änderungen bleiben unverändert');
  // erst ausdrücklich verwerfen, dann geht es
  const frei = A.verwirf(e, 'C2', 'Jonah').entwurf;
  const ok = A.verankere(frei, 'C1', { zelle: { x: 3, y: 1, z: 0 } }, 'Jonah').entwurf;
  assert.deepEqual(ok.aenderungen.map((x) => [x.id, x.zelle.x]), [['C1', 3]]);
  // dieselbe Zelle für sich selbst bleibt erlaubt
  assert.equal(A.verankere(e, 'C1', { zelle: { x: 2, y: 1, z: 0 } }, 'Jonah').entwurf.aenderungen.length, 2);
});

test('Verwaisung: Größenänderung nach Osten und Süden lässt die Änderung an derselben Stelle relativ zur Nordwest-Ecke; Teil entfernt oder Block weg = verwaist', () => {
  const z = { x: 2, y: 1, z: 0 };
  const lage = { x: 4, y: 10, z: -3, drehung: 1 };
  let e = A.setze(grund(lage), { teil: 'haus', zelle: z, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  for (const par of [{ breite: 7, tiefe: 5, hoehe: 3 }, { breite: 12, tiefe: 9, hoehe: 5 }, { breite: 4, tiefe: 6, hoehe: 4 }, { breite: 7, tiefe: 5, hoehe: 3, wandstaerke: 2 }]) {
    const f = e3.aendere(e, 'architekt', { art: 'aendere-teil', id: 'T1', felder: { parameter: par } }).entwurf;
    const mat = e3.materialisiere(f, MIT);
    assert.equal(mat.aenderungen.get('C1').status, 'angewandt', JSON.stringify(par));
    const g = weltZelle({ ...raumPar, ...par }, lage, z);
    assert.equal(mat.welt.leseBlock(g.x, g.y, g.z).id, 'minecraft:glass', `${JSON.stringify(par)}: an der Rahmenzelle ${k(z)}`);
  }
  // Teil entfernt: die Änderung bleibt stehen und ist verwaist
  const ohne = e3.aendere(e, 'architekt', { art: 'entferne-teil', id: 'T1' }).entwurf;
  assert.equal(ohne.aenderungen.length, 1);
  const mat = e3.materialisiere(ohne, MIT);
  assert.deepEqual([mat.aenderungen.get('C1').status, mat.aenderungen.get('C1').grund], ['verwaist', 'teil-fehlt']);
  const ew = einwaende(ohne);
  assert.equal(ew.length, 1);
  assert.equal(ew[0].ziel, null);
  assert.match(ew[0].text, /das Teil gibt es nicht mehr/);
  // leere an einer Zelle, an der das Teil keinen Block hat (Innenraum): verwaist (kein Block)
  const luft = A.setze(grund(), { teil: 'haus', zelle: { x: 3, y: 1, z: 2 }, op: 'leere' }, 'Jonah').entwurf;
  assert.deepEqual([e3.materialisiere(luft, MIT).aenderungen.get('C1').status, e3.materialisiere(luft, MIT).aenderungen.get('C1').grund], ['verwaist', 'kein-block']);
});

test('Konflikt und Überholt: fremder Block und Freihaltung blockieren ein Setzen, ein Kind, das die Zelle schon ausspart, überholt ein Entfernen', () => {
  const lage = { x: 0, y: 0, z: 0, drehung: 0 };
  let e = setzeTeil(grund(lage), { baustein: 'bau.treppe', ref: 'treppe', parameter: { stufen: 4, breite: 2 }, traeger: 'haus', einbau: EI('innenraum', 'nw') });
  const mat0 = e3.materialisiere(e, MIT);
  const kind = [...mat0.teile.get('T2').schluessel].map((c) => c.split(',').map(Number));
  const s1 = kind.find((c) => c[1] === 1);               // Block der zweiten Stufe (Welt)
  const rahmen = (c) => { const h = huelleVon(E2.baue('bau.raum', raumPar).bloecke).von; return { x: c[0] - h.x, y: c[1] - h.y, z: c[2] - h.z }; }; // Lage ist die Null-Lage: Welt = Paket
  // Setzen auf einen Block des Kindes: Konflikt (fremder Block)
  const a = A.setze(e, { teil: 'haus', zelle: rahmen(s1), op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  assert.deepEqual([e3.materialisiere(a, MIT).aenderungen.get('C1').status, e3.materialisiere(a, MIT).aenderungen.get('C1').grund, e3.materialisiere(a, MIT).aenderungen.get('C1').mit], ['konflikt', 'fremder-block', 'T2']);
  assert.match(einwaende(a)[0].text, /dort steht ein Block eines anderen Teils \(T2\)/);
  // Setzen in die Kopffreiheit über der Treppe (leere Luft im Innenraum): Konflikt (Freiraum)
  const luft = [s1[0], s1[1] + 2, s1[2]];
  const b = A.setze(e, { teil: 'haus', zelle: rahmen(luft), op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  const sb = e3.materialisiere(b, MIT).aenderungen.get('C1');
  assert.deepEqual([sb.status, sb.grund, sb.mit], ['konflikt', 'freiraum', ['T2']]);
  assert.match(einwaende(b)[0].text, /muss freigehalten werden \(T2\)/);
  const welt = e3.materialisiere(b, MIT).welt;
  assert.ok(welt.istLuft(...luft), 'die Freihaltung bleibt leer');
  // Entfernen einer Deckenzelle, die die Treppe schon ausgespart hat: überholt (wirkt nicht, kein Fehler, kein Einwand)
  const decke = [...mat0.einbau.herkunft.keys()].map((c) => c.split(',').map(Number))[0];
  const c = A.setze(e, { teil: 'haus', zelle: rahmen(decke), op: 'leere' }, 'Jonah').entwurf;
  assert.equal(e3.materialisiere(c, MIT).aenderungen.get('C1').status, 'ueberholt');
  assert.deepEqual(einwaende(c), []);
});

test('Änderungen: unabhängig von der Reihenfolge in der Liste, deterministisch, die jüngste Änderung je Zelle gilt', () => {
  let e = grund();
  e = A.setze(e, { teil: 'haus', zelle: { x: 2, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  e = A.setze(e, { teil: 'haus', zelle: { x: 2, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:stone' } }, 'Jonah').entwurf; // ersetzt C1
  e = A.setze(e, { teil: 'haus', zelle: { x: 3, y: 2, z: 0 }, op: 'leere' }, 'Jonah').entwurf;
  const umgekehrt = kopie(e); umgekehrt.aenderungen.reverse();
  const a = e3.materialisiere(e, MIT), b = e3.materialisiere(umgekehrt, MIT);
  assert.deepEqual([...a.teile.get('T1').schluessel].sort(), [...b.teile.get('T1').schluessel].sort());
  assert.deepEqual([...a.aenderungen], [...b.aenderungen]);
  assert.equal(a.aenderungen.size, 2);
});

test('Änderungen an einem Kind (Treppe) folgen seiner abgeleiteten Lage mit Träger-Drehung und -Verschiebung; wird das Kind entfernt, bleibt die Änderung gespeichert und ist verwaist', () => {
  const stufenParameter = { stufen: 4, breite: 2 };
  for (const drehung of [0, 1, 2, 3]) {
    const lage = { x: 6, y: 3, z: -8, drehung };
    let e = setzeTeil(grund(lage), { baustein: 'bau.treppe', ref: 'treppe', parameter: stufenParameter, traeger: 'haus', einbau: EI('innenraum', 'nw') });
    const ohne = e3.materialisiere(e, MIT);
    // Rahmenzelle (0, 0, 3) = erste Stufe in der Westspalte (Paketzelle (-1, 0, 0))
    e = A.setze(e, { teil: 'treppe', zelle: { x: 0, y: 0, z: 3 }, op: 'leere' }, 'Jonah').entwurf;
    const mat = e3.materialisiere(e, MIT);
    assert.equal(mat.aenderungen.get('C1').status, 'angewandt', `Drehung ${drehung}`);
    const o = mat.aenderungen.get('C1').ort;
    assert.ok(ohne.teile.get('T2').schluessel.has(k(o)), `Drehung ${drehung}: genau der Stufenblock an der Weltzelle`);
    assert.ok(!mat.teile.get('T2').schluessel.has(k(o)) && mat.welt.istLuft(o.x, o.y, o.z), 'er ist entfernt');
    assert.equal(mat.teile.get('T2').schluessel.size, ohne.teile.get('T2').schluessel.size - 1);
    assert.equal(mat.teile.get('T1').schluessel.size, ohne.teile.get('T1').schluessel.size, 'der Träger bleibt unberührt');
    // Kind entfernt: Änderung bleibt, verwaist, Einwand ohne Ziel
    const weg = e3.aendere(e, 'architekt', { art: 'entferne-teil', id: 'T2' }).entwurf;
    assert.equal(weg.aenderungen.length, 1);
    assert.deepEqual([e3.materialisiere(weg, MIT).aenderungen.get('C1').status, e3.materialisiere(weg, MIT).aenderungen.get('C1').grund], ['verwaist', 'teil-fehlt']);
    assert.equal(einwaende(weg).length, 1);
  }
});

test('Konflikt: mit mehreren Besitzern in einer Zelle zählt jeder, nicht nur der erste', () => {
  // zwei Teile belegen dieselbe Zelle (die Planung meldet das schon als Überschneidung); ein Setzen am ersten Teil darf den Block des zweiten nicht überschreiben
  let e = grund({ x: 0, y: 0, z: 0, drehung: 0 });
  e = setzeTeil(e, { baustein: 'bau.wand', ref: 'klotz', parameter: { laenge: 1, hoehe: 1, dicke: 1 }, lage: { x: -3, y: 0, z: -3, drehung: 0 } }); // Zelle liegt in der Nordwand des Raums (Raum: Außenmaß 9 × 7, Nordwest (-4, 0, -3))
  const mat0 = e3.materialisiere(e, MIT);
  const doppelt = [...mat0.teile.get('T2').schluessel].find((c) => mat0.teile.get('T1').schluessel.has(c));
  assert.ok(doppelt, 'beide Teile belegen die Zelle');
  const h = huelleVon(E2.baue('bau.raum', raumPar).bloecke).von, [x, y, z] = doppelt.split(',').map(Number);
  const f = A.setze(e, { teil: 'haus', zelle: { x: x - h.x, y: y - h.y, z: z - h.z }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  const st = e3.materialisiere(f, MIT).aenderungen.get('C1');
  assert.deepEqual([st.status, st.grund, st.mit], ['konflikt', 'fremder-block', 'T2']);
});

test('Zulassen deckt nur die konkrete Verankerung: wird die Änderung neu verankert und ist wieder verwaist, kommt der Einwand erneut', () => {
  let e = A.setze(grund(), { teil: 'haus', zelle: { x: 30, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  const erster = einwaende(e);
  assert.equal(erster.length, 1);
  assert.match(erster[0].schluessel, /^plan\.aenderung\|C1\|verwaist\|ausserhalb\|haus\|30,1,0\|$/);
  e.zulassungen = [erster[0].schluessel];
  assert.deepEqual(einwaende(e), [], 'zugelassen: kein Einwand mehr');
  const neu = A.verankere(e, 'C1', { zelle: { x: 31, y: 1, z: 0 } }, 'Jonah').entwurf;
  const zweiter = einwaende(neu);
  assert.equal(zweiter.length, 1, 'die frühere Zulassung unterdrückt den neuen Einwand nicht');
  assert.notEqual(zweiter[0].schluessel, erster[0].schluessel);
});
