import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { Zufall } from '../../src/ebene1/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const RZ = e1.redstoneZeit;
const rv = e0.vermesser.richtungVon;
const facing = (r) => [0, 1, 2, 3, 4, 5].find((v) => rv('facing_direction', v) === r);
const FREMD = ['minecraft:dirt', 'minecraft:cobblestone', 'minecraft:oak_planks'];
const FUELLER = ['minecraft:barrier', 'minecraft:structure_void', 'minecraft:light_block_0', 'minecraft:allow'];
const PITCH = 6;

const menge = (w, x, y, z, g) => (w.leseBlock(x, y, z).inhalt ?? []).filter((s) => !g || s.gegenstand === g).reduce((a, s) => a + s.anzahl, 0);

/** Welt mit Sortiereinheiten für die Sorten (je 6 Blöcke breit) und einer Überlaufkiste am Rohrende. */
function aufbau(sorten) {
  const w = e0.neueWelt();
  sorten.forEach((sorte, i) => e2.platziere(w, e2.baue('tech.sortiereinheit', { sorte: [sorte] }), {}, { x: i * PITCH, y: 0, z: 0 }));
  const ende = sorten.length * PITCH - 3; // x der Überlaufkiste (hinter dem letzten Rohrtrichter bei x = 2 + (n−1)·6)
  w.setzeBlock(ende, 3, 0, 'minecraft:chest', { 'minecraft:cardinal_direction': 'north' });
  return { w, ende, eingang: { x: -3, y: 3, z: 0 } };
}

/** Lässt einen Strom ein (höchstens alle `abstand` Ticks, nur wenn der erste Rohrtrichter leer ist) und wartet, bis alles durch ist. */
function lauf(sorten, strom, { abstand, reihenfolge }) {
  const { w, ende, eingang } = aufbau(sorten);
  const l = RZ.erzeuge(w, { trichter: true, trichterReihenfolge: reihenfolge });
  let i = 0, naechster = 1;
  const fehler = [];
  const filterIds = new Set(sorten.concat(FUELLER));
  const filterPos = sorten.map((_, k) => ({ x: k * PITCH, y: 2, z: 0 }));
  const bis = strom.length * (abstand + 1) + 600;
  while (l.taktgeber.tick < bis) {
    const t = l.taktgeber.tick + 1;
    if (i < strom.length && t >= naechster && (l.welt.leseBlock(eingang.x, eingang.y, eingang.z).inhalt ?? []).length === 0) {
      l.welt.setzeInhalt(eingang.x, eingang.y, eingang.z, [{ slot: 0, gegenstand: strom[i], anzahl: 1 }]); i++; naechster = t + abstand;
    }
    l.laufe(1);
    filterPos.forEach((p, k) => {
      for (const s of l.welt.leseBlock(p.x, p.y, p.z).inhalt ?? []) {
        if (!filterIds.has(s.gegenstand)) fehler.push(`Tick ${t}: ${s.gegenstand} in Filter ${k}`);
        if (s.slot > 0 && (s.anzahl !== 1 || s.gegenstand !== FUELLER[s.slot - 1])) fehler.push(`Tick ${t}: Füller ${s.slot} in Filter ${k} verändert`);
      }
      if (!(l.welt.leseBlock(p.x, p.y, p.z).inhalt ?? []).some((s) => s.slot === 0 && s.anzahl >= 1)) fehler.push(`Tick ${t}: Filter ${k} ohne Sorte`);
    });
    if (i >= strom.length && t > naechster + 400) break;
  }
  return { l, w: l.welt, ende, fehler, tick: l.taktgeber.tick };
}

/** Zählt alles, was in den Behältern der Welt liegt (Rohr, Filter, Ausgabe, Lager, Überlauf). */
function inventur(w, sorten, ende) {
  const rohr = {}, add = (g, n) => { rohr[g] = (rohr[g] ?? 0) + n; };
  for (let x = -3; x <= sorten.length * PITCH - 4; x++) for (const s of w.leseBlock(x, 3, 0).inhalt ?? []) add(s.gegenstand, s.anzahl);
  const lager = sorten.map((_, k) => ({ lager: menge(w, k * PITCH, 0, 0), ausgabe: menge(w, k * PITCH, 1, 0), filter: w.leseBlock(k * PITCH, 2, 0).inhalt ?? [] }));
  return { rohr, lager, ueberlauf: (w.leseBlock(ende, 3, 0).inhalt ?? []).reduce((a, s) => { a[s.gegenstand] = (a[s.gegenstand] ?? 0) + s.anzahl; return a; }, {}) };
}

function strom(n, sorten, seed, anteil = 0.5) {
  const z = new Zufall(seed);
  return Array.from({ length: n }, () => (z.naechste() < anteil ? sorten[z.ganzzahl(sorten.length)] : FREMD[z.ganzzahl(FREMD.length)]));
}

test('Sortiereinheit: Haltemenge, Paket und Füller', () => {
  const L = e2.lager;
  // Haltemenge aus der Stapelgröße: größtes k mit Signal 1; ein Stück mehr zeigt Signal 2
  assert.equal(L.haltFuer('minecraft:stone'), 18);
  assert.equal(L.haltFuer('minecraft:ender_pearl'), 4);
  for (const [sorte, st] of [['minecraft:stone', 64], ['minecraft:ender_pearl', 16]]) {
    const k = L.haltFuer(sorte);
    assert.equal(L.signal(k, st), 1, `${sorte}: Haltemenge zeigt Signal 1`);
    assert.equal(L.signal(k + 1, st), 2, `${sorte}: ein Stück mehr zeigt Signal 2`);
  }
  // unabhängige Rechnung des Signals mit dem Lesewert der Trichter aus Ebene 1
  for (const sorte of ['minecraft:stone', 'minecraft:ender_pearl']) {
    const p = e2.baue('tech.sortiereinheit', { sorte: [sorte] });
    const w = e0.neueWelt();
    e2.platziere(w, p, {});
    const f = p.bloecke.find((b) => b.x === 0 && b.y === 2 && b.z === 0);
    assert.equal(e1.trichter.lesewert(w, { x: 0, y: 2, z: 0 }), 1, `${sorte}: Filtertrichter zeigt im Ruhezustand Signal 1`);
    const k = f.inhalt[0].anzahl;
    w.setzeInhalt(0, 2, 0, f.inhalt.map((s) => (s.slot === 0 ? { ...s, anzahl: k + 1 } : s)));
    assert.equal(e1.trichter.lesewert(w, { x: 0, y: 2, z: 0 }), 2, `${sorte}: ein Stück mehr zeigt Signal 2`);
  }
  // Füller: vier verschiedene, stapelbar zu 64, nie die Sorte; Paketform
  const p = e2.baue('tech.sortiereinheit');
  const f = p.bloecke.find((b) => b.id === 'minecraft:hopper' && b.y === 2);
  const fuellerIds = f.inhalt.filter((s) => s.slot > 0).map((s) => s.gegenstand);
  assert.deepEqual(fuellerIds, FUELLER);
  assert.ok(fuellerIds.every((g) => e0.register.stapel(g) === 64 && g !== 'minecraft:stone'));
  assert.equal(new Set(fuellerIds).size, 4);
  assert.ok(p.bloecke.every((b) => b.technik === true && !('rolle' in b)), 'nur feste Technikblöcke');
  // Bauweise: Komparatoren, Repeater und Staub stehen auf einem festen Block, die Fackel hängt am Block südlich von ihr
  const bei = (x, y, z) => p.bloecke.find((b) => b.x === x && b.y === y && b.z === z);
  for (const b of p.bloecke.filter((x) => /comparator|repeater|redstone_wire/.test(x.id))) assert.equal(bei(b.x, b.y - 1, b.z)?.id, 'minecraft:stone', `${b.id} bei ${b.x}, ${b.y}, ${b.z} braucht festen Boden`);
  const fackel = p.bloecke.find((b) => b.id === 'minecraft:redstone_torch');
  assert.equal(bei(fackel.x, fackel.y, fackel.z + 1).id, 'minecraft:stone', 'Fackel hängt an einem Block');
  assert.equal(rv('facing_direction', bei(0, 1, 0).zustand.facing_direction), 'down', 'Ausgabetrichter zeigt in die Lagerkiste');
  assert.equal(bei(0, 0, 0).id, 'minecraft:chest');
  assert.equal(p.parameter.sorte[0], 'minecraft:stone');
  assert.deepEqual(e2.baue('tech.sortiereinheit'), p, 'deterministisch');
  assert.deepEqual(p.platzbedarf.huelle, { von: { x: -3, y: 0, z: 0 }, bis: { x: 2, y: 3, z: 2 } });
  // Eingaben: Sorte muss stapelbar sein und existieren, Liste hat genau einen Eintrag
  assert.throws(() => e2.baue('tech.sortiereinheit', { sorte: ['minecraft:diamond_sword'] }), /lässt sich so nicht filtern/);
  assert.throws(() => e2.baue('tech.sortiereinheit', { sorte: ['minecraft:gibtsnicht'] }), /Unbekannter Gegenstand/);
  assert.throws(() => e2.baue('tech.sortiereinheit', { sorte: [] }), /außerhalb/);
  assert.throws(() => e2.baue('tech.sortiereinheit', { sorte: ['minecraft:stone', 'minecraft:dirt'] }), /außerhalb/);
  assert.throws(() => e2.baue('tech.sortiereinheit', { sorte: 'minecraft:stone' }), /Liste von Texten/);
  assert.throws(() => e2.baue('tech.sortiereinheit', { farbe: 1 }), /unbekannter Parameter/);
  // Platzieren mit Inhalt über Ebene 0; der Prüfer meldet keinen Verstoß
  const w = e0.neueWelt();
  e2.platziere(w, p, {});
  assert.deepEqual(w.leseBlock(0, 2, 0).inhalt.find((s) => s.slot === 0), { slot: 0, gegenstand: 'minecraft:stone', anzahl: 18 });
  assert.deepEqual(e1.pruefe(w, { schienen: null }).filter((x) => x.schwere === 'verstoss'), []);
});

test('Sortiereinheit: Zufallsströme in beiden Reihenfolgen', () => {
  // Eingangsabstand ab 9 Ticks: jedes Stück der Sorte landet in der Lagerkiste, nichts Fremdes im Filter oder Lager, fremde Stücke erreichen das Rohrende
  for (const reihenfolge of ['aufsteigend', 'absteigend']) for (const abstand of [9, 10, 13, 20]) for (const seed of [1, 2, 3]) {
    const s = strom(120, ['minecraft:stone'], seed, 0.4);
    const ziele = s.filter((g) => g === 'minecraft:stone').length;
    const r = lauf(['minecraft:stone'], s, { abstand, reihenfolge });
    const inv = inventur(r.w, ['minecraft:stone'], r.ende);
    const was = `${reihenfolge} Abstand ${abstand} Seed ${seed}`;
    assert.deepEqual(r.fehler, [], was);
    const f = inv.lager[0];
    const imFilter = f.filter.find((x) => x.slot === 0).anzahl;
    assert.equal(inv.ueberlauf['minecraft:stone'] ?? 0, 0, `${was}: nichts von der Sorte rutscht durch`);
    assert.equal(imFilter + f.lager + f.ausgabe, 18 + ziele, `${was}: jedes Stück der Sorte ist im Filter, im Ausgabetrichter oder im Lager`);
    assert.ok(imFilter >= 1 && imFilter <= 19, `${was}: Haltemenge ${imFilter}`);
    assert.equal(r.w.leseBlock(0, 1, 0).zustand.toggle_bit, true, `${was}: Ausgabetrichter am Ende gesperrt`);
    const fremd = s.filter((g) => g !== 'minecraft:stone');
    const fremdAmEnde = Object.entries(inv.ueberlauf).filter(([g]) => g !== 'minecraft:stone').reduce((a, [, n]) => a + n, 0);
    const fremdImRohr = Object.entries(inv.rohr).filter(([g]) => g !== 'minecraft:stone').reduce((a, [, n]) => a + n, 0);
    assert.equal(fremdAmEnde + fremdImRohr, fremd.length, `${was}: alle fremden Stücke sind am Rohrende`);
    assert.equal(f.filter.filter((x) => x.slot > 0).length, 4, `${was}: Füller vollzählig`);
  }
  // Stapel 16 (Enderperle)
  for (const reihenfolge of ['aufsteigend', 'absteigend']) {
    const s = strom(100, ['minecraft:ender_pearl'], 5, 0.5);
    const ziele = s.filter((g) => g === 'minecraft:ender_pearl').length;
    const r = lauf(['minecraft:ender_pearl'], s, { abstand: 10, reihenfolge });
    const inv = inventur(r.w, ['minecraft:ender_pearl'], r.ende);
    assert.deepEqual(r.fehler, [], reihenfolge);
    assert.equal(inv.ueberlauf['minecraft:ender_pearl'] ?? 0, 0);
    assert.equal(inv.lager[0].filter.find((x) => x.slot === 0).anzahl + inv.lager[0].lager + inv.lager[0].ausgabe, 4 + ziele, `${reihenfolge}: Stapel 16`);
  }
  // Zwei Einheiten hintereinander mit verschiedenen Sorten und gemischtem Strom
  const sorten = ['minecraft:stone', 'minecraft:sand'];
  for (const reihenfolge of ['aufsteigend', 'absteigend']) {
    const s = strom(120, sorten, 9, 0.7);
    const r = lauf(sorten, s, { abstand: 9, reihenfolge });
    const inv = inventur(r.w, sorten, r.ende);
    assert.deepEqual(r.fehler, [], reihenfolge);
    sorten.forEach((sorte, k) => {
      const n = s.filter((g) => g === sorte).length;
      const f = inv.lager[k];
      assert.equal(f.filter.find((x) => x.slot === 0).anzahl + f.lager + f.ausgabe, e2.lager.haltFuer(sorte) + n, `${reihenfolge}: ${sorte}`);
      assert.equal(menge(r.w, k * PITCH, 0, 0, sorte), f.lager, 'Lagerkiste enthält nur ihre Sorte');
      assert.equal(f.lager, menge(r.w, k * PITCH, 0, 0, sorte));
    });
    assert.equal(Object.keys(inv.ueberlauf).filter((g) => sorten.includes(g)).length, 0, `${reihenfolge}: keine der Sorten am Rohrende`);
  }
  // Drehen über den Vermesser: die Einheit besteht aus Blöcken mit Richtungszuständen, die mitgedreht werden müssen
  const w = e0.neueWelt();
  e2.platziere(w, e2.baue('tech.sortiereinheit'), {});
  for (let k = 1; k <= 3; k++) {
    const g = e0.neueWelt();
    g.fuegeBauteilEin(e0.vermesser.drehe(w.ausschnitt({ x: -6, y: -1, z: -6 }, { x: 6, y: 5, z: 6 }), k));
    assert.equal(g.anzahlBloecke(), w.anzahlBloecke(), `k=${k}`);
    // der gedrehte Filtertrichter liegt unter dem gedrehten Rohrtrichter und zeigt dessen Richtung
    const hopperF = g.alleBloecke().find((b) => b.id === 'minecraft:hopper' && b.y === 2);
    const hopperP = g.alleBloecke().find((b) => b.id === 'minecraft:hopper' && b.y === 3 && b.x === hopperF.x && b.z === hopperF.z);
    assert.ok(hopperP, `k=${k}: Rohrtrichter über dem Filtertrichter`);
    assert.equal(rv('facing_direction', hopperF.zustand.facing_direction), rv('facing_direction', hopperP.zustand.facing_direction), `k=${k}: gleiche Richtung`);
  }
});

test('Sortiereinheit: Grenze bei dichtem Strom', () => {
  // Bei voller Auslastung (alle 8 Ticks) rutscht je nach Reihenfolge ein Teil der Sorte am Filter vorbei (Wiki, Bedrock); Fremdes gerät nie in den Filter
  let verloren = 0;
  for (const reihenfolge of ['aufsteigend', 'absteigend']) {
    const s = strom(150, ['minecraft:stone'], 1, 0.4);
    const r = lauf(['minecraft:stone'], s, { abstand: 1, reihenfolge });
    const inv = inventur(r.w, ['minecraft:stone'], r.ende);
    assert.ok(r.fehler.every((f) => !/in Filter/.test(f)), `${reihenfolge}: nichts Fremdes im Filter`);
    assert.equal(menge(r.w, 0, 0, 0) - menge(r.w, 0, 0, 0, 'minecraft:stone'), 0, `${reihenfolge}: auch bei dichtem Strom nur die Sorte im Lager`);
    verloren += (inv.ueberlauf['minecraft:stone'] ?? 0) + (inv.rohr['minecraft:stone'] ?? 0);
  }
  assert.ok(verloren > 0, 'bei dichtem Strom geht in mindestens einer Reihenfolge etwas durch (deshalb Mindestabstand 9 Ticks)');
  assert.equal(e1.regelwerk.parameter('lager.eingang', 'mindestabstand'), 9);
});
