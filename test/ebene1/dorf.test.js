import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const D = e1.dorf;
const STEIN = 'minecraft:stone';
const DORFBEWOHNER = 'minecraft:villager_v2';

/** Steinboden y = 0 von −r bis r, sonst Luft. */
function halle(r = 24) {
  const w = e0.neueWelt();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) w.setzeBlock(x, 0, z, STEIN);
  return w;
}
const bewohner = (w, x, y, z, baby = false) => w.fuegeWesenHinzu({ id: DORFBEWOHNER, x: x + 0.5, y, z: z + 0.5, ...(baby ? { baby: true } : {}) });
/** Bett: Kopf bei (x, y, z), Fuß bei (x, y, z − 1). */
function bett(w, x, y, z) {
  w.setzeBlock(x, y, z, 'minecraft:bed', { head_piece_bit: true, direction: 0 });
  w.setzeBlock(x, y, z - 1, 'minecraft:bed', { head_piece_bit: false, direction: 0 });
}
const LESEPULT = 'minecraft:lectern';
const berufAn = (w, nr) => D.zuordnung(w).find((z) => z.nr === nr);

test('Ebene 0: Berufe und Betten', () => {
  const b = (id) => e0.register.bloecke.block(id).eigenschaften;
  const erwartet = {
    'minecraft:blast_furnace': 'armorer', 'minecraft:lit_blast_furnace': 'armorer', 'minecraft:smoker': 'butcher', 'minecraft:lit_smoker': 'butcher',
    'minecraft:cartography_table': 'cartographer', 'minecraft:brewing_stand': 'cleric', 'minecraft:composter': 'farmer', 'minecraft:barrel': 'fisherman',
    'minecraft:fletching_table': 'fletcher', 'minecraft:cauldron': 'leatherworker', 'minecraft:lectern': 'librarian', 'minecraft:stonecutter_block': 'mason',
    'minecraft:loom': 'shepherd', 'minecraft:smithing_table': 'toolsmith', 'minecraft:grindstone': 'weaponsmith',
  };
  for (const [id, beruf] of Object.entries(erwartet)) assert.equal(b(id).beruf, beruf, id);
  assert.equal(b(STEIN).beruf, null);
  assert.equal(b('minecraft:air').beruf, null);
  assert.deepEqual([b('minecraft:bed').bett, b('minecraft:straw_bed').bett, b(STEIN).bett], [true, true, false]);
  // jeder Berufsblock ist ein Arbeitsblock (Ebene-0-Fakt) und jeder Arbeitsblock hat einen Beruf
  for (const id of e0.register.bloecke.ids()) if (b(id).beruf) assert.equal(b(id).arbeitsblock || /^minecraft:lit_/.test(id), true, id);
  for (const id of e0.register.bloecke.ids()) if (b(id).arbeitsblock) assert.ok(b(id).beruf, id);
});

test('Dorf: Betten', () => {
  const w = halle();
  bewohner(w, 0, 1, 0);
  bett(w, 4, 1, 4);
  // zwei Hälften zählen als ein Bett
  const liste = D.betten(w);
  assert.equal(liste.length, 1);
  assert.deepEqual(liste[0], { x: 4, y: 1, z: 4, gueltig: true });
  // Block direkt über dem Bett
  w.setzeBlock(4, 2, 4, STEIN);
  assert.match(D.betten(w)[0].grund, /zwei freie Blöcke nötig/);
  w.loescheBlock(4, 2, 4);
  // Block zwei über dem Bett
  w.setzeBlock(4, 3, 4, STEIN);
  assert.equal(D.betten(w)[0].gueltig, false);
  w.loescheBlock(4, 3, 4);
  // Teppich oder Fackel darüber stört nicht (keine Kollision)
  w.setzeBlock(4, 2, 4, 'minecraft:torch', { torch_facing_direction: 'top' });
  assert.equal(D.betten(w)[0].gueltig, true);
  // unklarer Block darüber (Truhe) → ungültig mit Grund
  w.setzeBlock(4, 2, 4, 'minecraft:chest', { 'minecraft:cardinal_direction': 'north' });
  assert.match(D.betten(w)[0].grund, /unklar/);
  w.loescheBlock(4, 2, 4);
  // ohne Dorfbewohner kann keiner das Bett erreichen
  const leer = halle();
  bett(leer, 4, 1, 4);
  assert.match(D.betten(leer)[0].grund, /kein Dorfbewohner/);
  // Dorfbewohner eingemauert → Bett nicht erreichbar
  const zu = halle();
  bewohner(zu, 0, 1, 0);
  for (let y = 1; y <= 5; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z) zu.setzeBlock(x, y, z, STEIN);
  zu.setzeBlock(0, 5, 0, STEIN);
  bett(zu, 4, 1, 4);
  assert.match(D.betten(zu)[0].grund, /von keinem Dorfbewohner erreichbar/);
  // Strohbett ebenfalls
  const stroh = halle();
  bewohner(stroh, 0, 1, 0);
  stroh.setzeBlock(4, 1, 4, 'minecraft:straw_bed', { head_piece_bit: true, 'minecraft:cardinal_direction': 'north' });
  stroh.setzeBlock(4, 1, 3, 'minecraft:straw_bed', { head_piece_bit: false, 'minecraft:cardinal_direction': 'north' });
  assert.equal(D.betten(stroh).length, 1);
});

test('Dorf: Berufsblock-Suche', () => {
  const mitBett = () => { const w = halle(); bewohner(w, 0, 1, 0); bett(w, 2, 1, 2); return w; };
  // 16 Blöcke waagerecht: ja, 17: nein
  let w = mitBett(); w.setzeBlock(16, 1, 0, LESEPULT);
  assert.equal(berufAn(w, 1).beruf.beruf, 'librarian');
  assert.equal(berufAn(w, 1).beruf.erreichbar, true);
  w = mitBett(); w.setzeBlock(17, 1, 0, LESEPULT);
  assert.equal(berufAn(w, 1).beruf, null);
  w = mitBett(); w.setzeBlock(0, 1, -16, LESEPULT);
  assert.equal(berufAn(w, 1).beruf.beruf, 'librarian', 'auch in z-Richtung');
  w = mitBett(); w.setzeBlock(0, 1, -17, LESEPULT);
  assert.equal(berufAn(w, 1).beruf, null);
  // senkrecht: 4 Blöcke höher ja, 5 nein (er erreicht ihn dort nicht, beansprucht ihn aber)
  w = mitBett(); w.setzeBlock(3, 5, 0, LESEPULT);
  assert.equal(berufAn(w, 1).beruf.beruf, 'librarian');
  assert.equal(berufAn(w, 1).beruf.erreichbar, false);
  assert.match(berufAn(w, 1).hinweise[0], /erreicht seinen Berufsblock .* nicht/);
  w = mitBett(); w.setzeBlock(3, 6, 0, LESEPULT);
  assert.equal(berufAn(w, 1).beruf, null);
  // tiefer: 4 unter dem Dorfbewohner
  w = halle(); for (let y = -1; y >= -5; y--) w.setzeBlock(3, y, 0, STEIN);
  w.setzeBlock(0, 1, 0, STEIN); // Dorfbewohner steht auf einem Block bei y = 1 → Fuß bei 2
  bewohner(w, 0, 2, 0); bett(w, 2, 1, 2);
  w.setzeBlock(3, -2, 0, LESEPULT);
  assert.equal(berufAn(w, 1).beruf.beruf, 'librarian', '4 Blöcke tiefer');
  w.setzeBlock(3, -3, 0, LESEPULT);
  w.loescheBlock(3, -2, 0);
  assert.equal(berufAn(w, 1).beruf, null, '5 Blöcke tiefer');
  // hinter einer Wand: beansprucht, aber nicht erreichbar → Hinweis
  w = mitBett(); w.setzeBlock(6, 1, 0, LESEPULT);
  for (const [x, y, z] of [[5, 1, 0], [7, 1, 0], [6, 1, 1], [6, 1, -1], [6, 2, 0]]) w.setzeBlock(x, y, z, STEIN);
  const z = berufAn(w, 1);
  assert.deepEqual([z.beruf.beruf, z.beruf.erreichbar], ['librarian', false]);
  // Reihenfolge der Liste: y, dann z, dann x – der erste unbeanspruchte wird genommen
  w = mitBett(); bewohner(w, 1, 1, 0); bett(w, -2, 1, 2);
  w.setzeBlock(4, 1, 3, 'minecraft:composter'); w.setzeBlock(4, 1, -3, 'minecraft:barrel');
  assert.deepEqual(D.berufsblockListe(w, D.dorfbewohner(w)[0]).map((s) => s.beruf), ['fisherman', 'farmer']);
  const r = D.zuordnung(w);
  assert.equal(r[0].beruf.beruf, 'fisherman');
  assert.equal(r[1].beruf.beruf, 'farmer', 'der zweite Dorfbewohner nimmt den übrigen');
  // alle Berufe
  const berufe = ['minecraft:blast_furnace', 'minecraft:smoker', 'minecraft:cartography_table', 'minecraft:brewing_stand', 'minecraft:composter', 'minecraft:barrel', 'minecraft:fletching_table', 'minecraft:cauldron', 'minecraft:lectern', 'minecraft:stonecutter_block', 'minecraft:loom', 'minecraft:smithing_table', 'minecraft:grindstone'];
  const namen = ['armorer', 'butcher', 'cartographer', 'cleric', 'farmer', 'fisherman', 'fletcher', 'leatherworker', 'librarian', 'mason', 'shepherd', 'toolsmith', 'weaponsmith'];
  berufe.forEach((id, i) => { const v = mitBett(); v.setzeBlock(4, 1, 0, id); assert.equal(berufAn(v, 1).beruf.beruf, namen[i], id); });
  // ein Block ohne Beruf zählt nicht
  w = mitBett(); w.setzeBlock(4, 1, 0, 'minecraft:crafting_table');
  assert.equal(berufAn(w, 1).beruf, null);
});

test('Dorf: Zuordnung', () => {
  const w = halle();
  bewohner(w, 0, 1, 0); bewohner(w, 2, 1, 0);
  bett(w, 5, 1, 5);
  w.setzeBlock(3, 1, 3, LESEPULT);
  const [a, b] = D.zuordnung(w);
  assert.deepEqual(a.bett, { x: 5, y: 1, z: 5 });
  assert.equal(a.beruf.beruf, 'librarian');
  assert.equal(b.bett, null, 'ein Bett für zwei Dorfbewohner');
  assert.equal(b.beruf, null, 'ohne Bett kein Beruf');
  assert.match(b.hinweise[0], /kein freies/);
  // zweites Bett: der zweite bekommt es, aber der Berufsblock ist schon vergeben
  bett(w, -5, 1, 5);
  const [c, d] = D.zuordnung(w);
  assert.ok(c.bett && d.bett);
  assert.notDeepEqual(c.bett, d.bett);
  assert.equal(d.beruf, null, 'der einzige Berufsblock gehört dem ersten');
  // das nähere Bett wird genommen: Dorfbewohner 1 steht bei x = 0, Bett bei x = 5 liegt näher als x = −9
  const nah = halle(); bewohner(nah, 0, 1, 0); bett(nah, -9, 1, 5); bett(nah, 5, 1, 5);
  assert.deepEqual(D.zuordnung(nah)[0].bett, { x: 5, y: 1, z: 5 });
  // Babys nehmen kein Bett und keinen Beruf
  const baby = halle(); bewohner(baby, 0, 1, 0, true); bett(baby, 3, 1, 3); baby.setzeBlock(2, 1, 0, LESEPULT);
  assert.deepEqual(D.zuordnung(baby), []);
  // Wiederholung gibt das gleiche Ergebnis, das Original bleibt unverändert
  const vorher = e0.speichereWelt(w);
  assert.deepEqual(D.zuordnung(w), D.zuordnung(w));
  assert.equal(e0.speichereWelt(w), vorher);
});

test('Dorf: Grenze und Mittelpunkt', () => {
  const w = halle(40);
  assert.equal(D.dorf(w), null, 'ohne Bett und Dorfbewohner kein Dorf');
  bewohner(w, 0, 1, 0);
  assert.equal(D.dorf(w), null, 'ohne Bett kein Dorf');
  bett(w, 4, 1, 4);
  const d = D.dorf(w);
  assert.deepEqual(d.mittelpunkt, { x: 4, y: 1, z: 4 });
  assert.deepEqual(d.grenze, { von: { x: -28, y: -11, z: -28 }, bis: { x: 36, y: 13, z: 36 } }, '65 × 25 × 65 um das Bett');
  assert.equal(d.hoechstbevoelkerung, 1);
  // zweites Bett weiter weg: Grenze wächst
  bett(w, 30, 1, 30);
  const g = D.dorf(w).grenze;
  assert.deepEqual([g.von.x, g.bis.x, g.von.z, g.bis.z], [-28, 62, -28, 62]);
  assert.equal(D.dorf(w).hoechstbevoelkerung, 2);
  // ein Dorfbewohner außerhalb der Grenze gehört nicht dazu
  bewohner(w, -39, 1, -39);
  assert.equal(D.dorf(w).dorfbewohner, 1);
  // Vermehrung: nur mit Platz im Bett-Bestand und zwei Erwachsenen; sonst „nein“
  assert.equal(D.dorf(w).vermehrung, 'nein', 'ein Erwachsener');
  bewohner(w, 2, 1, 0);
  assert.equal(D.dorf(w).vermehrung, 'nein', 'zwei Dorfbewohner, zwei Betten');
  const v3 = halle(); bewohner(v3, 0, 1, 0); bewohner(v3, 1, 1, 0); bett(v3, 4, 1, 4); bett(v3, 8, 1, 4); bett(v3, 12, 1, 4);
  assert.equal(D.dorf(v3).vermehrung, 'unklar', 'Platz im Bett-Bestand, Futter unbekannt');
  const baby = halle(); bewohner(baby, 0, 1, 0); bewohner(baby, 1, 1, 0, true); bett(baby, 4, 1, 4); bett(baby, 8, 1, 4); bett(baby, 12, 1, 4);
  assert.equal(D.dorf(baby).vermehrung, 'nein', 'nur ein Erwachsener');
});

/** Dorf mit n Dorfbewohnern und b Betten (Betten alle 3 Blöcke in einer Reihe bei z = 10). */
function dorfMit(n, b) {
  const w = halle(32);
  for (let i = 0; i < n; i++) bewohner(w, -20 + i, 1, 0);
  for (let i = 0; i < b; i++) bett(w, -30 + 3 * i, 1, 10);
  return w;
}

test('Dorf: Iron Golem', () => {
  const golem = (n, b) => D.dorf(dorfMit(n, b)).golem;
  assert.equal(golem(9, 20), 'nein');
  assert.equal(golem(10, 19), 'nein');
  assert.equal(golem(10, 20), 'ja');
  assert.equal(golem(12, 25), 'ja');
  assert.equal(golem(1, 1), 'nein');
  // Betten mit Block darüber zählen nicht: 20 Betten, eines verbaut → nur 19
  const w = dorfMit(10, 20); w.setzeBlock(-30, 2, 10, STEIN);
  assert.equal(D.dorf(w).betten, 19);
  assert.equal(D.dorf(w).golem, 'nein');
  // Babys zählen als Dorfbewohner
  const b = dorfMit(9, 20); bewohner(b, 5, 1, 0, true);
  assert.equal(D.dorf(b).golem, 'ja');
  // mit vorhandenem Golem im Dorf: unklar
  const g = dorfMit(10, 20); g.fuegeWesenHinzu({ id: 'minecraft:iron_golem', x: 0.5, y: 1, z: 3.5 });
  assert.equal(D.dorf(g).golem, 'unklar');
  assert.equal(D.dorf(g).eisengolems, 1);
});

test('Prüfer: Dorf', () => {
  const m = (w) => e1.pruefe(w, { schienen: null, dorfPruefen: true }).filter((x) => x.regel === 'pruefer.dorf');
  // ohne Option läuft keine Prüfung
  const w = halle();
  bewohner(w, 0, 1, 0); bett(w, 2, 1, 2); w.setzeBlock(6, 1, 0, LESEPULT);
  for (const [x, y, z] of [[5, 1, 0], [7, 1, 0], [6, 1, 1], [6, 1, -1], [6, 2, 0]]) w.setzeBlock(x, y, z, STEIN);
  assert.deepEqual(e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.dorf'), []);
  const vorher = e0.speichereWelt(w);
  const r = m(w);
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  const verstoss = r.filter((x) => x.schwere === 'verstoss');
  assert.equal(verstoss.length, 1);
  assert.deepEqual(verstoss[0].ort, { x: 6, y: 1, z: 0 });
  assert.match(verstoss[0].meldung, /erreicht ihn aber nicht/);
  assert.deepEqual(m(w), r, 'deterministisch');
  // Dorfbewohner ohne Bett → Hinweis; Bett mit Block darüber → Hinweis
  const o = halle(); bewohner(o, 0, 1, 0); bett(o, 3, 1, 3); o.setzeBlock(3, 2, 3, STEIN);
  const rm = m(o);
  assert.ok(rm.some((x) => /zählt nicht/.test(x.meldung)));
  assert.ok(rm.some((x) => /findet kein freies, erreichbares Bett/.test(x.meldung)));
  // Berufsblock ohne Dorfbewohner in Reichweite
  const f = halle(); bewohner(f, 0, 1, 0); bett(f, 2, 1, 2); f.setzeBlock(20, 1, 0, LESEPULT);
  assert.ok(m(f).some((x) => /kein Dorfbewohner in Reichweite/.test(x.meldung) && x.ort.x === 20));
  // mehr Dorfbewohner als Betten; Golems möglich
  assert.ok(m(dorfMit(11, 10)).some((x) => /Mehr Dorfbewohner \(11\) als gültige Betten \(10\)/.test(x.meldung)));
  assert.ok(m(dorfMit(10, 20)).some((x) => /Iron Golems können im Dorf spawnen/.test(x.meldung)));
  assert.ok(!m(dorfMit(10, 19)).some((x) => /Iron Golems/.test(x.meldung)));
  // Verschieben vertauscht sich mit der Rechnung: gleiche Zuordnung um (7, 0, −3) verschoben
  const t = dorfMit(3, 3); t.setzeBlock(-18, 1, 3, LESEPULT);
  const kasten = { von: { x: -40, y: 0, z: -40 }, bis: { x: 40, y: 4, z: 40 } };
  const ziel = e0.neueWelt();
  ziel.fuegeBauteilEin(t.ausschnitt(kasten.von, kasten.bis), { x: 7, y: 0, z: -3 });
  const a = D.zuordnung(t).map((z) => z.beruf?.beruf ?? null);
  const b = D.zuordnung(ziel).map((z) => z.beruf?.beruf ?? null);
  assert.deepEqual(a, b);
});
