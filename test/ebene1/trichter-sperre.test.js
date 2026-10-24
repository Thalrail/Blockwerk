import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const RZ = e1.redstoneZeit;
const TR = e1.trichter;
const rv = e0.vermesser.richtungVon;
const facing = (r) => [0, 1, 2, 3, 4, 5].find((v) => rv('facing_direction', v) === r);

const hop = (w, x, y, z, r = 'down', inhalt = null) => w.setzeBlock(x, y, z, 'minecraft:hopper', { facing_direction: facing(r), toggle_bit: false }, inhalt);
const kiste = (w, x, y, z, inhalt = null) => w.setzeBlock(x, y, z, 'minecraft:chest', { 'minecraft:cardinal_direction': 'north' }, inhalt);
const stein = (n) => [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: n }];
const menge = (w, x, y, z) => (w.leseBlock(x, y, z).inhalt ?? []).reduce((a, s) => a + s.anzahl, 0);
const ticks = (l, was) => [...l.ereignisse, ...l.trichterEreignisse].filter((e) => e.was === was).map((e) => e.tick);
const gesperrt = (w, x, y, z) => w.leseBlock(x, y, z).zustand.toggle_bit === true;

/** Kiste (64 Stein) → Trichter → Kiste, Lampe zwei Blöcke neben dem Trichter. */
function strecke() {
  const w = e0.neueWelt();
  kiste(w, 0, 3, 0, stein(64)); hop(w, 0, 2, 0); kiste(w, 0, 1, 0);
  w.setzeBlock(2, 2, 0, 'minecraft:redstone_lamp');
  return w;
}

test('Trichter-Sperre: Redstone-Block, Fackel und Takt', () => {
  assert.equal(e1.regelwerk.parameter('trichter.cooldown', 'ticks'), 8);
  // Schon beim Start bestromt: der Trichter beginnt gesperrt und bewegt nie etwas
  let w = strecke();
  w.setzeBlock(1, 2, 0, 'minecraft:redstone_block');
  let l = RZ.erzeuge(w, { trichter: true });
  assert.deepEqual(ticks(l, 'trichter-gesperrt'), [0], 'Anfangszustand');
  l.laufe(60);
  assert.deepEqual([ticks(l, 'geschoben'), ticks(l, 'gezogen')], [[], []], 'gesperrt: kein Transfer');
  assert.equal(menge(l.welt, 0, 3, 0), 64);
  assert.equal(gesperrt(l.welt, 0, 2, 0), true);
  assert.equal(gesperrt(w, 0, 2, 0), false, 'Original unverändert (Sandkasten)');
  // Block weg: Freigabe im nächsten C-Tick (gerade), danach läuft er im Takt von 8 Ticks
  l.welt.loescheBlock(1, 2, 0);
  l.laufe(2);
  const freiTick = ticks(l, 'trichter-frei')[0];
  l.laufe(40);
  assert.equal(ticks(l, 'trichter-frei').length, 1);
  assert.equal(freiTick % 2, 0, 'Freigabe nur im C-Tick');
  const gezogen = ticks(l, 'gezogen');
  assert.ok(gezogen[0] >= freiTick && gezogen[0] <= freiTick + 2, `erster Transfer kurz nach der Freigabe (${gezogen[0]} nach ${freiTick})`);
  assert.deepEqual(gezogen.slice(1, 4).map((t, i) => t - gezogen[i]), [8, 8, 8], 'danach alle 8 Ticks (Cooldown)');
  assert.equal(menge(l.welt, 0, 3, 0), 64 - gezogen.length);

  // Dynamisch: Block wird mitten im Lauf gesetzt (nach Tick 10 = P-Tick 11 folgt): Sperre und Lampe schalten im selben C-Tick 12
  w = strecke();
  l = RZ.erzeuge(w, { trichter: true });
  l.laufe(10);
  assert.equal(gesperrt(l.welt, 0, 2, 0), false);
  l.welt.setzeBlock(1, 2, 0, 'minecraft:redstone_block');
  l.laufe(6);
  assert.deepEqual([ticks(l, 'trichter-gesperrt').filter((t) => t > 0), ticks(l, 'lampe-an')], [[12], [12]], 'Trichter und Lampe im selben C-Tick');
  assert.ok(ticks(l, 'geschoben').every((t) => t <= 12) && ticks(l, 'gezogen').every((t) => t <= 12), 'nach dem Sperren keine Transfers mehr');
  assert.equal(gesperrt(l.welt, 0, 2, 0), true);

  // Fackel neben dem Trichter sperrt; ohne Fackel läuft er wieder
  w = strecke();
  w.setzeBlock(1, 1, 0, 'minecraft:stone');
  w.setzeBlock(1, 2, 0, 'minecraft:redstone_torch', { torch_facing_direction: 'top' });
  l = RZ.erzeuge(w, { trichter: true });
  l.laufe(30);
  assert.equal(gesperrt(l.welt, 0, 2, 0), true, 'Fackel sperrt');
  assert.deepEqual(ticks(l, 'geschoben'), []);
  l.welt.loescheBlock(1, 2, 0);
  l.laufe(30);
  assert.equal(gesperrt(l.welt, 0, 2, 0), false);
  assert.ok(ticks(l, 'geschoben').length > 0, 'nach dem Entfernen läuft er');

  // Ein gesperrter Trichter empfängt weiter von einem Trichter darüber, schiebt aber nichts weiter
  w = e0.neueWelt();
  kiste(w, 0, 4, 0, stein(10)); hop(w, 0, 3, 0); hop(w, 0, 2, 0); kiste(w, 0, 1, 0);
  w.setzeBlock(1, 2, 0, 'minecraft:redstone_block');
  l = RZ.erzeuge(w, { trichter: true });
  l.laufe(120);
  assert.equal(gesperrt(l.welt, 0, 2, 0), true);
  assert.equal(menge(l.welt, 0, 2, 0), 10, 'alle 10 Steine sind im gesperrten Trichter gelandet');
  assert.equal(menge(l.welt, 0, 1, 0), 0, 'unten kommt nichts an');
});

test('Trichter-Sperre: Filterkern des Sortierers (Komparator liest den Filtertrichter)', () => {
  // Filtertrichter F zeigt ins Leere; der Komparator liest F und zeigt auf den Linientrichter L (Kiste A → L → Kiste B)
  const w = e0.neueWelt();
  hop(w, 0, 2, 0, 'down');
  w.setzeBlock(1, 2, 0, 'minecraft:unpowered_comparator', { 'minecraft:cardinal_direction': 'west', output_lit_bit: false, output_subtract_bit: false });
  kiste(w, 2, 3, 0, stein(64)); hop(w, 2, 2, 0); kiste(w, 2, 1, 0);
  const l = RZ.erzeuge(w, { trichter: true });
  // F leer: L läuft
  l.laufe(30);
  const vorher = menge(l.welt, 2, 1, 0);
  assert.ok(vorher >= 3, `L läuft (${vorher} Steine unten)`);
  assert.equal(gesperrt(l.welt, 2, 2, 0), false);
  // F bekommt einen Gegenstand: Komparator an (Stärke = lesewert), L im nächsten C-Tick gesperrt
  const filter = [{ slot: 0, gegenstand: 'minecraft:stone', anzahl: 1 }];
  l.welt.setzeBlock(0, 2, 0, 'minecraft:hopper', { facing_direction: facing('down'), toggle_bit: false }, filter);
  const wert = TR.lesewert(l.welt, { x: 0, y: 2, z: 0 });
  assert.equal(wert, 1);
  const t0 = l.taktgeber.tick;
  l.laufe(12);
  const komp = l.ereignisse.find((e) => e.was === 'komparator' && e.tick > t0);
  const sperre = l.ereignisse.find((e) => e.was === 'trichter-gesperrt' && e.tick > t0 && e.pos.x === 2);
  assert.equal(komp.stufe, wert, 'Komparator zeigt den Lesewert des Filtertrichters');
  assert.ok(sperre && sperre.tick % 2 === 0 && sperre.tick >= komp.tick && sperre.tick <= komp.tick + 2, `L sperrt im C-Tick ${sperre?.tick} nach dem Komparator ${komp.tick}`);
  const mengeGesperrt = menge(l.welt, 2, 1, 0);
  l.laufe(60);
  assert.equal(menge(l.welt, 2, 1, 0), mengeGesperrt, 'gesperrt: nichts kommt mehr unten an');
  assert.equal(gesperrt(l.welt, 2, 2, 0), true);
  // F leeren: Komparator aus, L frei, es läuft weiter
  l.welt.setzeBlock(0, 2, 0, 'minecraft:hopper', { facing_direction: facing('down'), toggle_bit: false });
  const t1 = l.taktgeber.tick;
  l.laufe(40);
  assert.ok(l.ereignisse.some((e) => e.was === 'komparator' && e.tick > t1 && e.stufe === 0), 'Komparator aus');
  assert.ok(l.ereignisse.some((e) => e.was === 'trichter-frei' && e.tick > t1 && e.pos.x === 2));
  assert.ok(menge(l.welt, 2, 1, 0) > mengeGesperrt, 'L läuft wieder');
  assert.equal(gesperrt(l.welt, 2, 2, 0), false);
});

test('Trichter-Sperre: ohne Option, deterministisch, Ruhe und Prüfer', () => {
  // ohne Option bewegt sich nichts und kein Zustand ändert sich
  const w = strecke();
  w.setzeBlock(1, 2, 0, 'minecraft:redstone_block');
  const vorher = e0.speichereWelt(w);
  const aus = RZ.erzeuge(w);
  aus.laufe(60);
  assert.deepEqual(aus.trichterEreignisse, []);
  assert.equal(menge(aus.welt, 0, 3, 0), 64);
  assert.equal(gesperrt(aus.welt, 0, 2, 0), false, 'ohne Option bleibt toggle_bit unberührt');
  assert.equal(e0.speichereWelt(w), vorher);
  // deterministisch und Ruhe: alle 64 Steine kommen an, dann ist alles still
  const frei = strecke();
  const a = RZ.erzeuge(frei, { trichter: true }), b = RZ.erzeuge(frei, { trichter: true });
  const ra = a.bisRuhe(2000), rb = b.bisRuhe(2000);
  assert.deepEqual(ra, rb);
  assert.equal(ra.stabil, true);
  assert.deepEqual(JSON.stringify(a.ereignisse.concat(a.trichterEreignisse)), JSON.stringify(b.ereignisse.concat(b.trichterEreignisse)));
  assert.equal(menge(a.welt, 0, 1, 0), 64);
  assert.equal(menge(a.welt, 0, 3, 0), 0);
  // Prüfer: dauerhaft gesperrter Trichter wird gemeldet (nur mit Option trichterSperre)
  const gp = strecke();
  gp.setzeBlock(1, 2, 0, 'minecraft:redstone_block');
  const hinweise = (opt) => e1.pruefe(gp, { schienen: null, redstoneZeit: RZ, ...opt }).filter((x) => /gesperrt/.test(x.meldung));
  const mit = hinweise({ trichterSperre: true });
  assert.equal(mit.length, 1);
  assert.deepEqual(mit[0].ort, { x: 0, y: 2, z: 0 });
  assert.match(mit[0].meldung, /dauerhaft gesperrt/);
  assert.deepEqual(hinweise({}), []);
});
