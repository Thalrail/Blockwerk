import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const RZ = e1.redstoneZeit;
const FUELLER = e1.regelwerk.parameter('lager.filter', 'fueller');
const REIHENFOLGEN = ['aufsteigend', 'absteigend'];
const RASTER = 6;

const slotsVon = (liste) => liste.map(([gegenstand, anzahl], slot) => ({ slot, gegenstand, anzahl }));
const insgesamt = (inhalt, g) => (inhalt ?? []).filter((s) => !g || s.gegenstand === g).reduce((a, s) => a + s.anzahl, 0);
const zaehle = (inhalt) => (inhalt ?? []).reduce((a, s) => { a[s.gegenstand] = (a[s.gegenstand] ?? 0) + s.anzahl; return a; }, {});

/** Welt aus dem Paket (optional gedreht) mit Inhalt der Einwurfkiste; Kisten werden an ihrer Höhe erkannt (Einwurf y = 4, Überlauf y = 3, Lager y = 0). */
function welt(sorten, { einwurf = [], drehung = 0, ohneSperre = false } = {}) {
  const p = e2.baue('tech.sortierlager', { sorten });
  let w = e0.neueWelt();
  e2.platziere(w, p, {});
  if (ohneSperre) w.loescheBlock(-9, 3, -1); // Mutation im Test: Sperr-Repeater der Drossel fehlt
  if (drehung) {
    const g = e0.neueWelt();
    g.fuegeBauteilEin(e0.vermesser.drehe(w.ausschnitt({ x: -400, y: -1, z: -400 }, { x: 400, y: 6, z: 400 }), drehung));
    w = g;
  }
  const kisten = w.alleBloecke().filter((b) => b.id === 'minecraft:chest');
  const ein = kisten.find((b) => b.y === 4);
  w.setzeInhalt(ein.x, ein.y, ein.z, slotsVon(einwurf));
  return { w, p, ein, ueberlauf: kisten.find((b) => b.y === 3), lager: kisten.filter((b) => b.y === 0) };
}

function simuliere({ w }, reihenfolge, ticks) {
  const l = RZ.erzeuge(w, { trichter: true, trichterReihenfolge: reihenfolge });
  l.laufe(ticks);
  return l;
}

test('Sortierlager: Drossel und Dauerstrom', () => {
  assert.equal(e1.regelwerk.parameter('lager.eingang', 'mindestabstand'), 9);
  // Dauerstrom aus einer Kiste mit vollen Stapeln: Abstand der Gegenstände am Rohr mindestens 9 (gemessen 16), in beiden Reihenfolgen
  const voll = [['minecraft:dirt', 64], ['minecraft:stone', 64], ['minecraft:cobblestone', 64], ['minecraft:stone', 64]];
  const abstaende = (l) => { const t = l.trichterEreignisse.filter((e) => e.was === 'geschoben' && e.pos.x === -9 && e.pos.y === 3).map((e) => e.tick); return t.slice(1).map((x, i) => x - t[i]); };
  for (const reihenfolge of REIHENFOLGEN) {
    const a = abstaende(simuliere(welt(['minecraft:stone'], { einwurf: voll }), reihenfolge, 800));
    assert.ok(a.length > 30, `${reihenfolge}: genug Gegenstände`);
    assert.equal(Math.min(...a), e1.regelwerk.parameter('lager.drossel', 'gemessenerAbstand'), `${reihenfolge}: kleinster Abstand`);
    assert.ok(Math.min(...a) >= 9, `${reihenfolge}: mindestens 9 Ticks`);
    assert.equal(Math.max(...a), Math.min(...a), `${reihenfolge}: gleichmäßig`);
    // ohne den Sperr-Repeater läuft das Rohr mit vollem Tempo
    const ohne = abstaende(simuliere(welt(['minecraft:stone'], { einwurf: voll, ohneSperre: true }), reihenfolge, 800));
    assert.equal(Math.max(...ohne), 8, `${reihenfolge}: ohne Sperre alle 8 Ticks`);
  }

  // Sortieren aus der Einwurfkiste ohne eigene Taktung (gemischte volle Stapel), zwei Sorten
  const sorten = ['minecraft:stone', 'minecraft:sand'];
  const kiste = [['minecraft:dirt', 40], ['minecraft:stone', 50], ['minecraft:cobblestone', 40], ['minecraft:sand', 30], ['minecraft:stone', 30], ['minecraft:oak_planks', 20]];
  const gesamt = kiste.reduce((a, [, n]) => a + n, 0);
  for (const reihenfolge of REIHENFOLGEN) for (const drehung of [0, 1, 2, 3]) {
    if (drehung && reihenfolge === 'absteigend' && drehung !== 2) continue; // Drehungen mit einer Reihenfolge reichen, die 180°-Drehung zusätzlich mit der anderen
    const a = welt(sorten, { einwurf: kiste, drehung });
    const l = simuliere(a, reihenfolge, gesamt * 16 + 400);
    const w = l.welt;
    const was = `${reihenfolge}, ${drehung * 90}°`;
    const ueber = zaehle(w.leseBlock(a.ueberlauf.x, a.ueberlauf.y, a.ueberlauf.z).inhalt);
    assert.deepEqual(ueber, { 'minecraft:dirt': 40, 'minecraft:cobblestone': 40, 'minecraft:oak_planks': 20 }, `${was}: Überlaufkiste enthält genau das Fremde`);
    assert.equal(insgesamt(w.leseBlock(a.ein.x, a.ein.y, a.ein.z).inhalt), 0, `${was}: Einwurfkiste leer`);
    // jede Sorte liegt in ihrer Kiste (Lager, Ausgabetrichter und Filter zusammen = Haltemenge + eingeworfene Menge), nichts Fremdes im Lager
    const eingeworfen = { 'minecraft:stone': 80, 'minecraft:sand': 30 };
    const lagerNachX = a.lager.slice().sort((p, q) => (drehung % 2 ? p.z - q.z : p.x - q.x) * (drehung === 2 || drehung === 3 ? -1 : 1));
    sorten.forEach((sorte, i) => {
      const k = lagerNachX[i];
      const lager = w.leseBlock(k.x, k.y, k.z).inhalt;
      assert.equal(insgesamt(lager, sorte), insgesamt(lager), `${was}: ${sorte}-Kiste enthält nur ${sorte}`);
      const filter = w.alleBloecke().filter((b) => b.id === 'minecraft:hopper' && b.y === 2).find((b) => (b.inhalt ?? []).some((s) => s.slot === 0 && s.gegenstand === sorte));
      assert.ok(filter, `${was}: Filter von ${sorte}`);
      const ausgabe = w.leseBlock(filter.x + 0, 1, filter.z).inhalt;
      const imFilter = filter.inhalt.find((s) => s.slot === 0).anzahl;
      assert.equal(imFilter + insgesamt(lager) + insgesamt(ausgabe, sorte), e2.lager.haltFuer(sorte) + eingeworfen[sorte], `${was}: ${sorte} vollzählig`);
      assert.equal(filter.inhalt.filter((s) => s.slot > 0).length, 4, `${was}: Füller vollzählig`);
    });
  }
  // Prüfer ohne Verstoß
  const p = welt(sorten);
  assert.deepEqual(e1.pruefe(p.w, { schienen: null }).filter((x) => x.schwere === 'verstoss'), []);
});

test('Sortierlager: 48 Sorten und Paket', () => {
  // 48 verschiedene stapelbare Sorten aus dem Register (ohne Füller)
  const sorten = e0.register.gegenstaende
    .filter((id) => /^minecraft:[a-z_]+$/.test(id) && e0.register.stapel(id) === 64 && !FUELLER.includes(id) && !/light_block|barrier|allow|deny|border|void|command|structure|jigsaw|debug|air|bedrock|spawn_egg|banner_pattern|unknown/.test(id))
    .slice(0, 48);
  assert.equal(sorten.length, 48);
  assert.equal(new Set(sorten).size, 48);
  // Paket: Blöcke und Platzbedarf wachsen linear mit der Zahl der Sorten, die Einheit bleibt gleich groß
  const anzahl = (n) => e2.baue('tech.sortierlager', { sorten: sorten.slice(0, n) });
  const [p1, p2, p3, p48] = [anzahl(1), anzahl(2), anzahl(3), anzahl(48)];
  const je = p2.bloecke.length - p1.bloecke.length;
  assert.equal(p3.bloecke.length - p2.bloecke.length, je);
  assert.equal(p48.bloecke.length, p1.bloecke.length + 47 * je);
  assert.equal(p48.platzbedarf.huelle.bis.x - p1.platzbedarf.huelle.bis.x, 47 * RASTER);
  for (const a of ['y', 'z']) assert.deepEqual([p48.platzbedarf.huelle.von[a], p48.platzbedarf.huelle.bis[a]], [p1.platzbedarf.huelle.von[a], p1.platzbedarf.huelle.bis[a]], `Platzbedarf wächst nur in x (${a})`);
  assert.equal(p48.anschluesse.filter((a) => a.art === 'lager').length, 48);
  assert.deepEqual(p48.anschluesse.filter((a) => a.art === 'lager').map((a) => a.sorte), sorten);
  assert.deepEqual(anzahl(48), p48, 'deterministisch');

  // Fehlerfälle
  assert.throws(() => e2.baue('tech.sortierlager', { sorten: [] }), /außerhalb/);
  assert.throws(() => e2.baue('tech.sortierlager', { sorten: [...sorten, 'minecraft:emerald_block'] }), /außerhalb/);
  assert.throws(() => e2.baue('tech.sortierlager', { sorten: ['minecraft:stone', 'minecraft:stone'] }), /doppelt/);
  assert.throws(() => e2.baue('tech.sortierlager', { sorten: ['minecraft:barrier'] }), /Füller/);
  assert.throws(() => e2.baue('tech.sortierlager', { sorten: ['minecraft:diamond_sword'] }), /lässt sich so nicht filtern/);
  assert.throws(() => e2.baue('tech.sortierlager', { sorten: ['minecraft:gibtsnicht'] }), /Unbekannter Gegenstand/);

  // Das Rohr ist lückenlos: Trichter von x = −9 bis zum Ende, alle nach Osten
  const rohr = p48.bloecke.filter((b) => b.id === 'minecraft:hopper' && b.y === 3 && b.z === 0).sort((q, r) => q.x - r.x);
  assert.deepEqual(rohr.map((b) => b.x), Array.from({ length: 48 * RASTER + 6 }, (_, i) => i - 9));
  assert.ok(rohr.every((b) => e0.vermesser.richtungVon('facing_direction', b.zustand.facing_direction) === 'east'));

  // Alle 48 Einheiten arbeiten: jede Sorte wird zweimal am Anfang ihres eigenen Rohrstücks eingelegt (die Strecke vom Einwurf bis ans Ende ist mit zwei Sorten getestet,
  // eine Simulation über 300 Trichter dauert zu lange), danach liegt jedes Stück in seiner Kiste und der Überlauf ist leer
  const a = welt(sorten);
  const l = RZ.erzeuge(a.w, { trichter: true });
  for (let runde = 0; runde < 2; runde++) {
    sorten.forEach((sorte, i) => l.welt.setzeInhalt(i * RASTER - 3, 3, 0, [{ slot: 0, gegenstand: sorte, anzahl: 1 }]));
    l.laufe(60);
  }
  l.laufe(300);
  const w = l.welt;
  const lager = a.lager.slice().sort((q, r) => q.x - r.x);
  sorten.forEach((sorte, i) => {
    const kisteInhalt = w.leseBlock(lager[i].x, 0, 0).inhalt;
    const filter = w.leseBlock(lager[i].x, 2, 0).inhalt.find((s) => s.slot === 0).anzahl;
    const ausgabe = insgesamt(w.leseBlock(lager[i].x, 1, 0).inhalt, sorte);
    assert.equal(insgesamt(kisteInhalt, sorte), insgesamt(kisteInhalt), `${sorte}: nur die eigene Sorte in der Kiste`);
    assert.equal(filter + insgesamt(kisteInhalt) + ausgabe, e2.lager.haltFuer(sorte) + 2, `${sorte}: vollzählig (Einheit ${i})`);
  });
  assert.deepEqual(w.leseBlock(a.ueberlauf.x, 3, 0).inhalt ?? [], [], 'nichts Fremdes, nichts Verlorenes: Überlaufkiste leer');
});
