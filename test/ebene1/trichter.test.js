import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const TR = e1.trichter;
const rv = e0.vermesser.richtungVon;
/** facing_direction-Wert für eine Richtung (aus den geprüften Drehregeln). */
const facing = (r) => [0, 1, 2, 3, 4, 5].find((v) => rv('facing_direction', v) === r);

const trichterBlock = (w, x, y, z, r = 'down', inhalt = null, gesperrt = false) => w.setzeBlock(x, y, z, 'minecraft:hopper', { facing_direction: facing(r), toggle_bit: gesperrt }, inhalt);
const kiste = (w, x, y, z, inhalt = null, id = 'minecraft:chest') => w.setzeBlock(x, y, z, id, id === 'minecraft:chest' ? { 'minecraft:cardinal_direction': 'north' } : {}, inhalt);
const inhalt = (w, x, y, z) => w.leseBlock(x, y, z).inhalt ?? [];
const anzahl = (w, x, y, z, g) => inhalt(w, x, y, z).filter((s) => s.gegenstand === g).reduce((a, s) => a + s.anzahl, 0);

/** Taktgeber ohne Simulation-Abkürzung: Ereignisse mit Ticks. */
function lauf(welt, ticks) {
  const sk = e1.neuerSandkasten(welt);
  const t = e1.neuerTaktgeber(sk);
  const m = TR.mechanik();
  t.registriere(m);
  for (let i = 0; i < ticks; i++) t.schritt();
  return { welt: sk.welt, m, t };
}

test('Trichter: Tempo und Reihenfolge', () => {
  assert.equal(e1.regelwerk.parameter('trichter.cooldown', 'ticks'), 8);
  // Kiste (64 Stein) → Trichter → Kiste: Tick 1 ziehen, ab Tick 9 alle 8 Ticks schieben und ziehen
  const w = e0.neueWelt();
  kiste(w, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 64 }]);
  trichterBlock(w, 0, 2, 0, 'down'); kiste(w, 0, 1, 0);
  const r = TR.simuliere(w);
  assert.equal(anzahl(r.welt, 0, 1, 0, 'minecraft:stone'), 64);
  assert.equal(anzahl(r.welt, 0, 3, 0, 'minecraft:stone'), 0);
  assert.equal(r.stabil, true);
  const gezogen = r.ereignisse.filter((e) => e.was === 'gezogen').map((e) => e.tick);
  const geschoben = r.ereignisse.filter((e) => e.was === 'geschoben').map((e) => e.tick);
  assert.equal(gezogen[0], 1, 'sofort bereit');
  assert.deepEqual(gezogen.slice(0, 3), [1, 9, 17], 'danach alle 8 Ticks');
  assert.deepEqual(geschoben.slice(0, 3), [9, 17, 25], 'schieben und ziehen im selben Vorgang, erst schieben');
  assert.equal(geschoben.at(-1), 9 + 8 * 63, '64 Gegenstände: letzter Schub nach 8 Ticks je Gegenstand');
  // Reihenfolge im selben Tick: erst geschoben, dann gezogen (Tick 9)
  const t9 = r.ereignisse.filter((e) => e.tick === 9).map((e) => e.was);
  assert.deepEqual(t9, ['geschoben', 'gezogen']);
  // Kette Trichter → Trichter (waagerecht): jede Stufe hat ihren eigenen Takt, es gibt keinen Stau
  const k = e0.neueWelt();
  kiste(k, 0, 2, 0, [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 20 }]);
  trichterBlock(k, 0, 1, 0, 'east'); trichterBlock(k, 1, 1, 0, 'east'); kiste(k, 2, 1, 0);
  const rk = TR.simuliere(k);
  assert.equal(anzahl(rk.welt, 2, 1, 0, 'minecraft:coal'), 20);
  assert.equal(rk.welt.leseBlock(0, 2, 0).inhalt, undefined, 'Quellkiste leer');
});

test('Trichter: Slots und Stapelgrenzen', () => {
  // links zuerst: Kohle (Slot 3) vor Eisen (Slot 5); Ziel: Kohle in Slot 0, Eisen in Slot 1
  const w = e0.neueWelt();
  kiste(w, 0, 3, 0, [{ slot: 3, gegenstand: 'minecraft:coal', anzahl: 5 }, { slot: 5, gegenstand: 'minecraft:iron_ingot', anzahl: 3 }]);
  trichterBlock(w, 0, 2, 0, 'down'); kiste(w, 0, 1, 0);
  const r = TR.simuliere(w);
  assert.deepEqual(inhalt(r.welt, 0, 1, 0), [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 5 }, { slot: 1, gegenstand: 'minecraft:iron_ingot', anzahl: 3 }]);
  // Stapelgrößen: Enderperlen 16, Schwerter 1, Stein 64
  const s = e0.neueWelt();
  kiste(s, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:ender_pearl', anzahl: 16 }, { slot: 1, gegenstand: 'minecraft:ender_pearl', anzahl: 4 },
    { slot: 2, gegenstand: 'minecraft:iron_sword', anzahl: 1 }, { slot: 3, gegenstand: 'minecraft:iron_sword', anzahl: 1 }, { slot: 4, gegenstand: 'minecraft:iron_sword', anzahl: 1 }]);
  trichterBlock(s, 0, 2, 0, 'down'); kiste(s, 0, 1, 0);
  const rs = TR.simuliere(s);
  assert.deepEqual(inhalt(rs.welt, 0, 1, 0), [
    { slot: 0, gegenstand: 'minecraft:ender_pearl', anzahl: 16 }, { slot: 1, gegenstand: 'minecraft:ender_pearl', anzahl: 4 },
    { slot: 2, gegenstand: 'minecraft:iron_sword', anzahl: 1 }, { slot: 3, gegenstand: 'minecraft:iron_sword', anzahl: 1 }, { slot: 4, gegenstand: 'minecraft:iron_sword', anzahl: 1 }]);
  assert.equal(e0.register.stapel('minecraft:ender_pearl'), 16);
  assert.equal(e0.register.stapel('minecraft:iron_sword'), 1);
  assert.equal(e0.register.stapel('minecraft:stone'), 64);
  // Ebene 0 lehnt zu große Stapel ab
  assert.throws(() => kiste(e0.neueWelt(), 0, 0, 0, [{ slot: 0, gegenstand: 'minecraft:ender_pearl', anzahl: 17 }]), /Anzahl muss 1…16/);
  // Trichter selbst hat 5 Slots: mit 6 Schwertern gefüllt staut die Quelle
  const v = e0.neueWelt();
  const schwerter = Array.from({ length: 9 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:iron_sword', anzahl: 1 }));
  kiste(v, 0, 3, 0, schwerter); trichterBlock(v, 0, 2, 0, 'north');
  const rv2 = TR.simuliere(v);
  assert.equal(inhalt(rv2.welt, 0, 2, 0).length, 5, 'Trichter hat nur 5 Slots');
  assert.equal(inhalt(rv2.welt, 0, 3, 0).length, 4);
  // volles Ziel staut den Trichter
  const voll = e0.neueWelt();
  kiste(voll, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 10 }]);
  trichterBlock(voll, 0, 2, 0, 'down');
  kiste(voll, 0, 1, 0, Array.from({ length: 27 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:stone', anzahl: 64 })));
  const rvoll = TR.simuliere(voll);
  assert.equal(anzahl(rvoll.welt, 0, 1, 0, 'minecraft:stone'), 27 * 64, 'nichts passt mehr');
  assert.equal(anzahl(rvoll.welt, 0, 2, 0, 'minecraft:stone') + anzahl(rvoll.welt, 0, 3, 0, 'minecraft:stone'), 10);
  // gemischte Sorten: Ziel hat in Slot 0 Stein 63 → nimmt noch einen, dann Sand in den nächsten freien Slot
  const m = e0.neueWelt();
  kiste(m, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 3 }, { slot: 1, gegenstand: 'minecraft:sand', anzahl: 1 }]);
  trichterBlock(m, 0, 2, 0, 'down'); kiste(m, 0, 1, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 63 }]);
  assert.deepEqual(inhalt(TR.simuliere(m).welt, 0, 1, 0), [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 64 }, { slot: 1, gegenstand: 'minecraft:stone', anzahl: 2 }, { slot: 2, gegenstand: 'minecraft:sand', anzahl: 1 }].map((x) => x));
});

test('Trichter: Ziel und Richtungen', () => {
  for (const r of ['down', 'north', 'east', 'south', 'west']) {
    const w = e0.neueWelt();
    trichterBlock(w, 5, 5, 5, r, [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 3 }]);
    const v = { down: [0, -1, 0], north: [0, 0, -1], east: [1, 0, 0], south: [0, 0, 1], west: [-1, 0, 0] }[r];
    kiste(w, 5 + v[0], 5 + v[1], 5 + v[2]);
    const lauf1 = TR.simuliere(w);
    assert.equal(anzahl(lauf1.welt, 5 + v[0], 5 + v[1], 5 + v[2], 'minecraft:coal'), 3, `Richtung ${r}`);
  }
  // Zeigt auf einen Block ohne Behälter: es passiert nichts
  const k = e0.neueWelt();
  trichterBlock(k, 0, 1, 0, 'east', [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 3 }]); k.setzeBlock(1, 1, 0, 'minecraft:stone');
  const rk = TR.simuliere(k);
  assert.equal(anzahl(rk.welt, 0, 1, 0, 'minecraft:coal'), 3);
  assert.equal(rk.ereignisse.length, 0);
  // Zieht nur von oben, nicht von der Seite
  const s = e0.neueWelt();
  trichterBlock(s, 0, 1, 0, 'down'); kiste(s, 0, 0, 0); kiste(s, 1, 1, 0, [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 3 }]);
  assert.equal(TR.simuliere(s).ereignisse.length, 0);
});

test('Trichter: Redstone-Sperre', () => {
  // bestromter Trichter (toggle_bit) schiebt und zieht nicht
  const w = e0.neueWelt();
  kiste(w, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 5 }]);
  trichterBlock(w, 0, 2, 0, 'down', null, true); kiste(w, 0, 1, 0);
  const r = TR.simuliere(w);
  assert.equal(anzahl(r.welt, 0, 3, 0, 'minecraft:coal'), 5);
  assert.deepEqual(r.ereignisse.map((e) => e.was), ['gesperrt']);
  // empfängt aber weiterhin von einem Trichter darüber
  const e = e0.neueWelt();
  trichterBlock(e, 0, 3, 0, 'down', [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 2 }]);
  trichterBlock(e, 0, 2, 0, 'down', null, true); kiste(e, 0, 1, 0);
  const re = TR.simuliere(e);
  assert.equal(anzahl(re.welt, 0, 2, 0, 'minecraft:coal'), 2, 'gesperrter Trichter hält die empfangenen Gegenstände');
  assert.equal(anzahl(re.welt, 0, 1, 0, 'minecraft:coal'), 0);
  // ohne Sperre läuft alles durch
  const f = e0.neueWelt();
  trichterBlock(f, 0, 3, 0, 'down', [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 2 }]);
  trichterBlock(f, 0, 2, 0, 'down'); kiste(f, 0, 1, 0);
  assert.equal(anzahl(TR.simuliere(f).welt, 0, 1, 0, 'minecraft:coal'), 2);
});

test('Trichter: Behälter und Sonderbehälter', () => {
  // Shulkerkiste nicht in Shulkerkiste; andere Gegenstände schon
  const s = e0.neueWelt();
  trichterBlock(s, 0, 2, 0, 'down', [{ slot: 0, gegenstand: 'minecraft:black_shulker_box', anzahl: 1 }, { slot: 1, gegenstand: 'minecraft:coal', anzahl: 2 }]);
  s.setzeBlock(0, 1, 0, 'minecraft:blue_shulker_box', {});
  const rs = TR.simuliere(s);
  assert.equal(anzahl(rs.welt, 0, 1, 0, 'minecraft:coal'), 2);
  assert.equal(anzahl(rs.welt, 0, 1, 0, 'minecraft:black_shulker_box'), 0);
  assert.equal(anzahl(rs.welt, 0, 2, 0, 'minecraft:black_shulker_box'), 1, 'bleibt im Trichter');
  // Fass, Werfer, Spender und Trichter als Ziel
  for (const [id, slots] of [['minecraft:barrel', 27], ['minecraft:dropper', 9], ['minecraft:dispenser', 9], ['minecraft:trapped_chest', 27]]) {
    const w = e0.neueWelt();
    trichterBlock(w, 0, 2, 0, 'down', [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 2 }]); w.setzeBlock(0, 1, 0, id, id === 'minecraft:trapped_chest' ? { 'minecraft:cardinal_direction': 'north' } : {});
    assert.equal(anzahl(TR.simuliere(w).welt, 0, 1, 0, 'minecraft:coal'), 2, id);
    assert.equal(e0.register.bloecke.slots(id), slots);
  }
  // Ofen: Sonderbehälter, nichts wird bewegt, Ereignis „unklar“
  const o = e0.neueWelt();
  trichterBlock(o, 0, 2, 0, 'down', [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 2 }]); o.setzeBlock(0, 1, 0, 'minecraft:furnace', {});
  const ro = TR.simuliere(o);
  assert.equal(anzahl(ro.welt, 0, 2, 0, 'minecraft:coal'), 2);
  const u = ro.ereignisse.filter((x) => x.was === 'unklar');
  assert.equal(u.length, 1); assert.equal(u[0].grund, 'minecraft:furnace');
  assert.equal(TR.behaelterArt('minecraft:furnace'), 'sonder');
  assert.equal(TR.behaelterArt('minecraft:stone'), null);
  assert.equal(TR.behaelterArt('minecraft:chest'), 'ok');
});

test('Trichter: Komparator-Wert', () => {
  const k = (id, slots, besetzt) => { const w = e0.neueWelt(); w.setzeBlock(0, 0, 0, id, id === 'minecraft:chest' ? { 'minecraft:cardinal_direction': 'north' } : {}, besetzt.length ? besetzt : null); return TR.lesewert(w, { x: 0, y: 0, z: 0 }); };
  const stein = (n, g = 'minecraft:stone') => Array.from({ length: n }, (_, i) => ({ slot: i, gegenstand: g, anzahl: 64 }));
  // Wiki-Beispiel: 300 Blöcke in einem Spender mit 9 Slots → 8
  assert.equal(k('minecraft:dispenser', 9, [...stein(4), { slot: 4, gegenstand: 'minecraft:stone', anzahl: 44 }]), 8);
  assert.equal(k('minecraft:chest', 27, []), 0, 'leer');
  assert.equal(k('minecraft:chest', 27, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 1 }]), 1, 'ein Gegenstand');
  assert.equal(k('minecraft:chest', 27, stein(27)), 15, 'voll');
  assert.equal(k('minecraft:chest', 27, stein(14)), 8, 'etwas über die Hälfte');
  assert.equal(k('minecraft:hopper', 5, stein(1)), 3);
  assert.equal(k('minecraft:hopper', 5, stein(5)), 15);
  // Stapel 16 und 1 zählen als volle Slots
  assert.equal(k('minecraft:chest', 27, Array.from({ length: 27 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:ender_pearl', anzahl: 16 }))), 15);
  assert.equal(k('minecraft:chest', 27, Array.from({ length: 27 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:iron_sword', anzahl: 1 }))), 15);
  assert.equal(k('minecraft:chest', 27, [{ slot: 0, gegenstand: 'minecraft:iron_sword', anzahl: 1 }]), 1);
  assert.equal(k('minecraft:chest', 27, Array.from({ length: 14 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:iron_sword', anzahl: 1 }))), 8);
  // Sonderbehälter und Nicht-Behälter: unbekannt
  const w = e0.neueWelt(); w.setzeBlock(0, 0, 0, 'minecraft:furnace', {}); w.setzeBlock(1, 0, 0, 'minecraft:stone');
  assert.equal(TR.lesewert(w, { x: 0, y: 0, z: 0 }), null);
  assert.equal(TR.lesewert(w, { x: 1, y: 0, z: 0 }), null);
});

test('Trichter: Welt in einer Kopie, deterministisch, Drehen vertauscht sich', () => {
  const w = e0.neueWelt();
  kiste(w, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 9 }, { slot: 1, gegenstand: 'minecraft:iron_ingot', anzahl: 4 }]);
  trichterBlock(w, 0, 2, 0, 'down'); trichterBlock(w, 0, 1, 0, 'east'); trichterBlock(w, 1, 1, 0, 'south'); kiste(w, 1, 1, 1);
  const vorher = e0.speichereWelt(w);
  const a = TR.simuliere(w), b = TR.simuliere(w);
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  assert.deepEqual(a.ereignisse, b.ereignisse);
  assert.equal(e0.speichereWelt(a.welt), e0.speichereWelt(b.welt));
  assert.equal(anzahl(a.welt, 1, 1, 1, 'minecraft:coal'), 9);
  // Drehen um 90° vor der Simulation = Drehen danach
  const kasten = [{ x: -3, y: 0, z: -3 }, { x: 3, y: 5, z: 3 }];
  const drehe = (welt) => { const n = e0.neueWelt(); n.fuegeBauteilEin(e0.vermesser.drehe(welt.ausschnitt(...kasten), 1)); return n; };
  assert.equal(e0.speichereWelt(TR.simuliere(drehe(w)).welt), e0.speichereWelt(drehe(a.welt)));
});

test('Prüfer: Trichter', () => {
  const m = (w) => e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.trichter');
  // Zeigt auf Stein: Hinweis mit Koordinate
  const a = e0.neueWelt(); trichterBlock(a, 2, 2, 2, 'east'); a.setzeBlock(3, 2, 2, 'minecraft:stone');
  assert.deepEqual(m(a).map((x) => [x.schwere, x.ort.x, x.ort.y, x.ort.z]), [['hinweis', 2, 2, 2]]);
  assert.match(m(a)[0].meldung, /minecraft:stone/);
  // Zeigt auf Luft: auch Hinweis
  const l = e0.neueWelt(); trichterBlock(l, 0, 1, 0, 'down');
  assert.equal(m(l).length, 1);
  // Zeigt auf Ofen: Sonderbehälter
  const o = e0.neueWelt(); trichterBlock(o, 0, 2, 0, 'down'); o.setzeBlock(0, 1, 0, 'minecraft:furnace', {});
  assert.match(m(o)[0].meldung, /Sonderbehälter/);
  // Sauber: Kiste → Trichter → Kiste, nichts zu melden
  const s = e0.neueWelt(); kiste(s, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 4 }]); trichterBlock(s, 0, 2, 0, 'down'); kiste(s, 0, 1, 0);
  assert.deepEqual(m(s), []);
  // Kreis aus vier Trichtern
  const c = e0.neueWelt();
  trichterBlock(c, 0, 1, 0, 'east'); trichterBlock(c, 1, 1, 0, 'south'); trichterBlock(c, 1, 1, 1, 'west'); trichterBlock(c, 0, 1, 1, 'north');
  const k = m(c).filter((x) => /Kreis/.test(x.meldung));
  assert.equal(k.length, 4);
  // Stau: volles Ziel
  const v = e0.neueWelt();
  kiste(v, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 10 }]); trichterBlock(v, 0, 2, 0, 'down');
  kiste(v, 0, 1, 0, Array.from({ length: 27 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:stone', anzahl: 64 })));
  const st = m(v);
  assert.equal(st.length, 1); assert.match(st[0].meldung, /staut/);
  assert.deepEqual([st[0].ort.x, st[0].ort.y, st[0].ort.z], [0, 2, 0]);
  // Gesperrter Trichter mit Inhalt staut nicht (Sperre ist Absicht)
  const g = e0.neueWelt(); trichterBlock(g, 0, 2, 0, 'down', [{ slot: 0, gegenstand: 'minecraft:coal', anzahl: 2 }], true); kiste(g, 0, 1, 0);
  assert.deepEqual(m(g), []);
  // Welt ohne Trichter: keine Simulation, keine Meldung; Original unverändert
  assert.deepEqual(m(e0.neueWelt()), []);
  assert.equal(e0.speichereWelt(v), e0.speichereWelt(v));
});

/** Taktgeber von Hand führen, damit zwischen einzelnen Ticks die Welt verändert werden kann. */
function starte(welt) {
  const sk = e1.neuerSandkasten(welt);
  const t = e1.neuerTaktgeber(sk);
  const m = TR.mechanik();
  t.registriere(m);
  return { sk, t, m, laufe(n) { for (let i = 0; i < n; i++) t.schritt(); } };
}
const tickVon = (m, was, x) => m.ereignisse.filter((e) => e.was === was && e.pos.x === x).map((e) => e.tick);
/** Kiste (64 Stein) oben → A → B (→ C) waagerecht nach Osten → Kiste am Ende. */
function waagerecht(anzahl, ende = null) {
  const w = e0.neueWelt();
  kiste(w, 0, 3, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 64 }]);
  for (let x = 0; x < anzahl; x++) trichterBlock(w, x, 2, 0, 'east');
  kiste(w, anzahl, 2, 0, ende);
  return w;
}

test('Trichter: Wartezeit des Empfängers', () => {
  assert.equal(e1.regelwerk.parameter('trichter.empfang', 'ticks'), 8);
  // Waagerechte Kette A → B → C: A zieht im Tick 1, schiebt im Tick 9; B bekommt den Gegenstand in einen LEEREN Trichter und wartet 8 Ticks (17),
  // C ebenso (25). Ohne die Regel käme der Gegenstand schon im Tick 9 in der letzten Kiste an.
  const k = starte(waagerecht(3));
  k.laufe(100);
  assert.deepEqual(tickVon(k.m, 'gezogen', 0).slice(0, 2), [1, 9]);
  assert.equal(tickVon(k.m, 'geschoben', 0)[0], 9);
  assert.equal(tickVon(k.m, 'geschoben', 1)[0], 17, 'B schiebt frühestens 8 Ticks nach dem Empfang');
  assert.equal(tickVon(k.m, 'geschoben', 2)[0], 25, 'C ebenso');
  // Durchsatz im Beharrungszustand: 1 Gegenstand je 8 Ticks = 2,5 pro Sekunde (Wiki), Anlauf 8 Ticks je Trichter
  const c = tickVon(k.m, 'geschoben', 2);
  assert.deepEqual(c.slice(0, 4).map((t, i, a) => (i ? t - a[i - 1] : 0)), [0, 8, 8, 8]);
  assert.equal(anzahl(k.sk.welt, 3, 2, 0, 'minecraft:stone'), c.length);
  assert.equal(c.length, 10, 'in 100 Ticks kommen 10 Gegenstände an (Ticks 25, 33 … 97)');
  // Senkrechte Kette: B zieht aus A (eigener Vorgang), die Empfangsregel greift nicht
  const w = e0.neueWelt();
  kiste(w, 0, 4, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 64 }]); trichterBlock(w, 0, 3, 0, 'down'); trichterBlock(w, 0, 2, 0, 'down'); kiste(w, 0, 1, 0);
  const s = starte(w);
  s.laufe(20);
  assert.equal(s.m.ereignisse.find((e) => e.was === 'gezogen' && e.pos.y === 2).tick, 2, 'unterer Trichter zieht schon im Tick 2');
  assert.equal(s.m.ereignisse.find((e) => e.was === 'geschoben' && e.pos.y === 2).tick, 10, '8 Ticks nach seinem eigenen Zug');

  // Nicht leerer Empfänger: keine zusätzliche Wartezeit (Java-Platzhalter, ungeprüft). B hält 1 Stein (von Hand eingelegt), die Kiste dahinter ist voll.
  const voll = Array.from({ length: 27 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:stone', anzahl: 64 }));
  const nv = waagerecht(2, voll);
  nv.setzeInhalt(1, 2, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 1 }]);
  const n = starte(nv);
  n.laufe(9); // A schiebt im Tick 9 in den nicht leeren B
  assert.deepEqual(tickVon(n.m, 'geschoben', 1), [], 'B kann nicht schieben (Kiste voll)');
  n.sk.welt.setzeInhalt(2, 2, 0, []);
  n.laufe(1);
  assert.deepEqual(tickVon(n.m, 'geschoben', 1), [10], 'sofort im nächsten Tick, ohne Empfangswartezeit');

  // Von Hand eingelegt zählt nicht: B bekommt im Tick 5 per Hand einen Stein und schiebt ihn im Tick 6
  const hand = starte(waagerecht(2));
  hand.laufe(5);
  hand.sk.welt.setzeInhalt(1, 2, 0, [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 1 }]);
  hand.laufe(1);
  assert.deepEqual(tickVon(hand.m, 'geschoben', 1), [6]);

  // Gesperrter, leerer Empfänger: Sperre wird bei Tick 12 aufgehoben, die Empfangswartezeit (bis 17) gilt trotzdem
  const g = waagerecht(2);
  trichterBlock(g, 1, 2, 0, 'east', null, true);
  const gs = starte(g);
  gs.laufe(12);
  const b = gs.sk.welt.leseBlock(1, 2, 0);
  gs.sk.welt.setzeBlock(1, 2, 0, 'minecraft:hopper', { ...b.zustand, toggle_bit: false }, b.inhalt ?? null);
  gs.laufe(10);
  assert.deepEqual(tickVon(gs.m, 'geschoben', 1).slice(0, 1), [17], 'nach dem Entsperren gilt die Empfangswartezeit weiter');
  // Welt im Original unverändert
  assert.equal(inhalt(g, 1, 2, 0).length, 0);
});
