import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const RZ = e1.redstoneZeit;
const STEIN = 'minecraft:stone', STAUB = 'minecraft:redstone_wire';

const boden = () => {
  const w = e0.neueWelt();
  for (let x = -6; x <= 30; x++) for (let z = -6; z <= 20; z++) w.setzeBlock(x, 0, z, STEIN);
  return w;
};
const staub = (w, x, y, z) => w.setzeBlock(x, y, z, STAUB, { redstone_signal: 0 });
const hebel = (w, x, y, z, an) => w.setzeBlock(x, y, z, 'minecraft:lever', { lever_direction: 'west', open_bit: an });
const fackel = (w, x, y, z, seite) => w.setzeBlock(x, y, z, 'minecraft:redstone_torch', { torch_facing_direction: seite });
const repeater = (w, x, y, z, verzoegerung, eingang = 'west') => w.setzeBlock(x, y, z, 'minecraft:unpowered_repeater', { 'minecraft:cardinal_direction': eingang, repeater_delay: verzoegerung - 1 });
const block = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:redstone_block');
const luft = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:air');

/** Zur Ruhe kommen lassen und auf einen geraden Tick stellen (danach liest der nächste Tick im P-Tick). */
function ruhe(l) { l.bisRuhe(600); if (l.taktgeber.tick % 2 === 1) l.laufe(1); return l.taktgeber.tick; }
/** Ereignisse seit `ab` mit Tick relativ zu `start`. */
const seit = (l, ab, start) => l.ereignisse.slice(ab).map((e) => [e.tick - start, e.was]);

function fackelKette(n) {
  const w = boden(); w.setzeBlock(0, 1, 0, STEIN); hebel(w, -1, 1, 0, false);
  for (let i = 0; i < n; i++) { fackel(w, 1 + 2 * i, 1, 0, 'west'); w.setzeBlock(2 + 2 * i, 1, 0, STEIN); }
  return w;
}

test('Redstone-Zeit: Fackel und Staub', () => {
  assert.equal(e1.regelwerk.parameter('zeit.fackel-verzoegerung', 'redstoneTicks'), 1);
  // Kette aus n Fackeln: die erste schaltet 2 Ticks nach dem Hebel, jede weitere 2 Ticks später
  for (const n of [1, 2, 3, 5]) {
    const l = RZ.erzeuge(fackelKette(n));
    const start = ruhe(l); const ab = l.ereignisse.length;
    hebel(l.welt, -1, 1, 0, true);
    l.laufe(40);
    const erwartet = Array.from({ length: n }, (_, i) => [2 * (i + 1), i % 2 === 0 ? 'fackel-aus' : 'fackel-an']);
    assert.deepEqual(seit(l, ab, start), erwartet, `Kette aus ${n} Fackeln`);
  }
  // Staub ohne Verzögerung: 10 Blöcke Leitung sind im ersten Tick nach dem Umlegen des Hebels alle aktuell
  const w = boden(); w.setzeBlock(0, 1, 0, STEIN); hebel(w, -1, 1, 0, false);
  for (let x = 1; x <= 10; x++) staub(w, x, 1, 0);
  const l = RZ.erzeuge(w); ruhe(l);
  hebel(l.welt, -1, 1, 0, true);
  l.laufe(1);
  for (let x = 1; x <= 10; x++) assert.equal(l.welt.leseBlock(x, 1, 0).zustand.redstone_signal, 16 - x, `Staub ${x}`);
  // Wandert die Phase? Ein Hebel, der im C-Tick umgelegt wird, braucht einen Tick länger bis zur Fackel
  const k = RZ.erzeuge(fackelKette(1)); ruhe(k); k.laufe(1);
  const start = k.taktgeber.tick; const ab = k.ereignisse.length;
  hebel(k.welt, -1, 1, 0, true);
  k.laufe(10);
  assert.deepEqual(seit(k, ab, start), [[3, 'fackel-aus']], 'Umlegen vor einem C-Tick: Ablesung erst im nächsten P-Tick');
});

test('Redstone-Zeit: Fackeluhr und Brennen', () => {
  assert.deepEqual([e1.regelwerk.parameter('zeit.fackel-brennen', 'wechsel'), e1.regelwerk.parameter('zeit.fackel-brennen', 'ticks')], [8, 60]);
  // Rückkopplung: Fackel an Block B, Staub über der Fackel läuft zu Staub auf B
  const w = boden(); w.setzeBlock(0, 1, 0, STEIN); fackel(w, 1, 1, 0, 'west'); staub(w, 1, 2, 0); staub(w, 0, 2, 0);
  const l = RZ.erzeuge(w);
  l.laufe(200);
  const alle = l.ereignisse.map((e) => [e.tick, e.was]);
  // Wechsel alle 2 Ticks; der 9. Wechsel innerhalb von 60 Ticks lässt die Fackel ausbrennen
  assert.deepEqual(alle.slice(0, 9), [[2, 'fackel-aus'], [4, 'fackel-an'], [6, 'fackel-aus'], [8, 'fackel-an'], [10, 'fackel-aus'], [12, 'fackel-an'], [14, 'fackel-aus'], [16, 'fackel-an'], [18, 'brennt-aus']]);
  assert.equal(l.welt.leseBlock(1, 1, 0).id === 'minecraft:redstone_torch' || l.welt.leseBlock(1, 1, 0).id === 'minecraft:unlit_redstone_torch', true);
  // bleibt aus, bis weniger als 8 Wechsel in den letzten 60 Ticks liegen: wieder an im Tick 65, dann die nächste Runde
  assert.deepEqual(alle.filter((e) => /brennt/.test(e[1])).slice(0, 4), [[18, 'brennt-aus'], [65, 'brennt-wieder'], [82, 'brennt-aus'], [129, 'brennt-wieder']]);
  assert.equal(l.ereignisse.filter((e) => e.tick > 18 && e.tick < 65).length, 0, 'in der Ruhephase keine Wechsel');
  // Eine Fackel mit Hebel schaltet nur einmal und brennt nie aus
  const k = RZ.erzeuge(fackelKette(1)); ruhe(k); const ab = k.ereignisse.length;
  hebel(k.welt, -1, 1, 0, true); k.laufe(300);
  assert.equal(k.ereignisse.slice(ab).filter((e) => e.was === 'brennt-aus').length, 0);
});

test('Redstone-Zeit: Repeater', () => {
  const aufbau = (verzoegerung) => {
    const w = boden(); repeater(w, 0, 1, 0, verzoegerung); staub(w, 1, 1, 0); staub(w, 2, 1, 0);
    return w;
  };
  // Verzögerung 1 bis 4 Redstone-Ticks = 2, 4, 6, 8 Spielticks
  for (const d of [1, 2, 3, 4]) {
    const l = RZ.erzeuge(aufbau(d)); const start = ruhe(l); const ab = l.ereignisse.length;
    block(l.welt, -1, 1, 0);
    l.laufe(30);
    assert.deepEqual(seit(l, ab, start), [[2 * d, 'repeater-an']], `Verzögerung ${d}`);
    assert.equal(l.welt.leseBlock(1, 1, 0).zustand.redstone_signal, 15, 'Ausgang gibt 15 an den Staub davor');
    assert.equal(l.welt.leseBlock(2, 1, 0).zustand.redstone_signal, 14);
    assert.equal(l.welt.leseBlock(0, 1, 0).zustand.repeater_delay, d - 1, 'Verzögerung bleibt im Zustand');
    // Ausschalten braucht dieselbe Zeit
    const bis = l.taktgeber.tick % 2 === 1 ? l.laufe(1) : l.taktgeber.tick; const ab2 = l.ereignisse.length;
    luft(l.welt, -1, 1, 0);
    l.laufe(30);
    assert.deepEqual(seit(l, ab2, bis), [[2 * d, 'repeater-aus']], `Aus nach ${d}`);
  }
  // Der Repeater leitet nur von hinten nach vorn: Strom von vorn geht nicht zurück
  const v = RZ.erzeuge(aufbau(1)); ruhe(v);
  block(v.welt, 3, 1, 0);
  v.laufe(30);
  assert.equal(v.welt.leseBlock(0, 1, 0).id, 'minecraft:unpowered_repeater');
  assert.equal(v.welt.leseBlock(-1, 1, 0).id, 'minecraft:air');
  // Richtung: Blickrichtung Nord = Eingang im Norden, Ausgang im Süden (Annahme, siehe Regel)
  const n = boden(); repeater(n, 0, 1, 0, 1, 'north'); staub(n, 0, 1, 1);
  const ln = RZ.erzeuge(n); ruhe(ln);
  block(ln.welt, 0, 1, -1); ln.laufe(10);
  assert.equal(ln.welt.leseBlock(0, 1, 1).zustand.redstone_signal, 15);
  // Sperre: ein bestromter Repeater, der seitlich auf den ersten zeigt, friert den Ausgang ein
  const s = boden(); repeater(s, 0, 1, 0, 1); staub(s, 1, 1, 0);
  repeater(s, 0, 1, 1, 1, 'south'); // Front nach Norden: zeigt auf den ersten Repeater
  const ls = RZ.erzeuge(s); ruhe(ls);
  block(ls.welt, -1, 1, 0); ls.laufe(10);
  assert.equal(ls.welt.leseBlock(0, 1, 0).id, 'minecraft:powered_repeater', 'erster Repeater ist an');
  block(ls.welt, 0, 1, 2); ls.laufe(10);
  assert.equal(ls.welt.leseBlock(0, 1, 1).id, 'minecraft:powered_repeater', 'zweiter Repeater ist an und sperrt');
  luft(ls.welt, -1, 1, 0); ls.laufe(30);
  assert.equal(ls.welt.leseBlock(0, 1, 0).id, 'minecraft:powered_repeater', 'gesperrt: bleibt an');
  luft(ls.welt, 0, 1, 2); ls.laufe(30);
  assert.equal(ls.welt.leseBlock(0, 1, 0).id, 'minecraft:unpowered_repeater', 'Sperre gelöst: geht aus');
  // kurze Impulse: Ein 1-Redstone-Tick-Impuls (2 Spielticks) an einem Repeater mit Verzögerung 4 gibt einen Ausgangsimpuls von 8 Spielticks
  const p = RZ.erzeuge(aufbau(4)); const start = ruhe(p); const ab = p.ereignisse.length;
  block(p.welt, -1, 1, 0); p.laufe(2); luft(p.welt, -1, 1, 0); p.laufe(30);
  assert.deepEqual(seit(p, ab, start), [[8, 'repeater-an'], [16, 'repeater-aus']], 'an für 8 Ticks');
  // kurzer Gegenimpuls (ein Redstone-Tick aus) während der Repeater an ist: unterdrückt
  const u = RZ.erzeuge(aufbau(4)); ruhe(u); block(u.welt, -1, 1, 0); u.laufe(20);
  assert.equal(u.welt.leseBlock(0, 1, 0).id, 'minecraft:powered_repeater');
  const ab3 = u.ereignisse.length;
  if (u.taktgeber.tick % 2 === 1) u.laufe(1);
  luft(u.welt, -1, 1, 0); u.laufe(2); block(u.welt, -1, 1, 0); u.laufe(30);
  assert.equal(u.welt.leseBlock(0, 1, 0).id, 'minecraft:powered_repeater');
  assert.equal(u.ereignisse.slice(ab3).filter((e) => e.was === 'repeater-aus').length, 0, 'kein Ausschalten');
});

test('Redstone-Zeit: Komparator', () => {
  /** Komparator bei (0,1,0), Eingang West: hinten ein Behälter (Kiste mit Wert 8), seitlich eine Staubleitung mit der gewünschten Stärke. */
  const aufbau = (modus, seitenStaerke) => {
    const w = boden();
    w.setzeBlock(-1, 1, 0, 'minecraft:chest', { 'minecraft:cardinal_direction': 'north' }, Array.from({ length: 14 }, (_, i) => ({ slot: i, gegenstand: 'minecraft:stone', anzahl: 64 })));
    w.setzeBlock(0, 1, 0, 'minecraft:unpowered_comparator', { 'minecraft:cardinal_direction': 'west', output_lit_bit: false, output_subtract_bit: modus === 'subtrahieren' });
    staub(w, 1, 1, 0);
    if (seitenStaerke > 0) {
      const n = 16 - seitenStaerke;
      for (let z = 1; z <= n; z++) staub(w, 0, 1, z);
      block(w, 0, 1, n + 1);
    }
    return w;
  };
  assert.equal(e1.trichter.lesewert(aufbau('vergleichen', 0), { x: -1, y: 1, z: 0 }), 8, 'Kiste mit 14 Stapeln = 8');
  const erwartet = { vergleichen: { 0: 8, 5: 8, 8: 8, 9: 0 }, subtrahieren: { 0: 8, 5: 3, 8: 0, 9: 0 } };
  for (const [modus, tabelle] of Object.entries(erwartet)) {
    for (const [seite, aus] of Object.entries(tabelle)) {
      const l = RZ.erzeuge(aufbau(modus, Number(seite)));
      l.bisRuhe(600);
      assert.equal(l.komparatorStufe(0, 1, 0), aus, `${modus}, Seite ${seite}`);
      assert.equal(l.welt.leseBlock(1, 1, 0).zustand.redstone_signal, aus, `Staub vor dem Komparator: ${modus}, Seite ${seite}`);
      assert.equal(l.welt.leseBlock(0, 1, 0).zustand.output_lit_bit, aus > 0);
    }
  }
  // Wiki-Beispiel: hinten 9, links 5, rechts 2 → Subtraktion 4 (hinten: Redstone-Block = 15 ist hier nicht möglich; wir prüfen mit Staub 9)
  const w = boden();
  w.setzeBlock(0, 1, 0, 'minecraft:unpowered_comparator', { 'minecraft:cardinal_direction': 'west', output_lit_bit: false, output_subtract_bit: true });
  // Rücken: Staub bei (-1,1,0) mit Stärke 9 (7 Blöcke von der Quelle), Seiten: Staub 5 (Süd) und 2 (Nord)
  for (let x = -7; x <= -1; x++) staub(w, x, 1, 0); block(w, -8, 1, 0);
  const seite = (z0, richtung, staerke) => { const n = 16 - staerke; for (let i = 1; i <= n; i++) staub(w, 0, 1, z0 + richtung * (i - 1)); block(w, 0, 1, z0 + richtung * n); };
  seite(1, 1, 5); seite(-1, -1, 2);
  staub(w, 1, 1, 0);
  const lw = RZ.erzeuge(w); lw.bisRuhe(600);
  assert.equal(lw.welt.leseBlock(-1, 1, 0).zustand.redstone_signal, 9);
  assert.equal(lw.komparatorStufe(0, 1, 0), 4);
  // Verzögerung: 2 Spielticks nach einer Änderung des Rückens
  const d = boden(); d.setzeBlock(0, 1, 0, 'minecraft:unpowered_comparator', { 'minecraft:cardinal_direction': 'west', output_lit_bit: false, output_subtract_bit: false }); staub(d, 1, 1, 0); staub(d, -1, 1, 0);
  const ld = RZ.erzeuge(d); const start = ruhe(ld); const ab = ld.ereignisse.length;
  block(ld.welt, -2, 1, 0); ld.laufe(20);
  assert.deepEqual(ld.ereignisse.slice(ab).map((e) => [e.tick - start, e.was, e.stufe]), [[2, 'komparator', 15]]);
});

test('Redstone-Zeit: Knöpfe', () => {
  const west = [0, 1, 2, 3, 4, 5].find((n) => e0.vermesser.richtungVon('facing_direction', n) === 'west');
  for (const [id, dauer] of [['minecraft:stone_button', 20], ['minecraft:polished_blackstone_button', 20], ['minecraft:wooden_button', 30], ['minecraft:bamboo_button', 30], ['minecraft:cherry_button', 30]]) {
    const w = boden(); w.setzeBlock(0, 1, 0, STEIN); w.setzeBlock(-1, 1, 0, id, { facing_direction: west, button_pressed_bit: false }); staub(w, 1, 1, 0);
    const l = RZ.erzeuge(w); const start = ruhe(l); const ab = l.ereignisse.length;
    l.welt.setzeBlock(-1, 1, 0, id, { facing_direction: west, button_pressed_bit: true });
    const verlauf = [];
    for (let i = 0; i < dauer + 5; i++) { l.laufe(1); verlauf.push(l.welt.leseBlock(1, 1, 0).zustand.redstone_signal); }
    assert.deepEqual(seit(l, ab, start), [[dauer + 1, 'knopf-los']], id);
    assert.equal(verlauf.filter((s) => s === 15).length, dauer, `${id}: Staub daneben ${dauer} Ticks an`);
    assert.equal(l.welt.leseBlock(-1, 1, 0).zustand.button_pressed_bit, false);
  }
});

test('Redstone-Zeit: Welt in einer Kopie, deterministisch, Drehen', () => {
  const w = fackelKette(3); staub(w, 7, 1, 0); repeater(w, 8, 1, 0, 2);
  const vorher = e0.speichereWelt(w);
  /** Ruhe herstellen, den Hebel umlegen und 40 Ticks mitschreiben (Ticks relativ zum Umlegen). */
  const lauf = (welt) => {
    const l = RZ.erzeuge(welt); const start = ruhe(l); const ab = l.ereignisse.length;
    const h = l.welt.alleBloecke().find((x) => x.id === 'minecraft:lever');
    l.welt.setzeBlock(h.x, h.y, h.z, 'minecraft:lever', { ...h.zustand, open_bit: true });
    l.laufe(40);
    return { l, ereignisse: seit(l, ab, start) };
  };
  const a = lauf(w), b = lauf(w);
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  assert.deepEqual(a.ereignisse, b.ereignisse);
  assert.equal(e0.speichereWelt(a.l.welt), e0.speichereWelt(b.l.welt));
  assert.deepEqual(a.ereignisse, [[2, 'fackel-aus'], [4, 'fackel-an'], [6, 'fackel-aus']]);
  // Drehen um 90° vor der Simulation: gleiche Ereignisse zu gleichen Ticks (nur die Orte ändern sich)
  const teil = w.ausschnitt({ x: -3, y: 0, z: -3 }, { x: 12, y: 3, z: 3 });
  const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(teil, 1));
  assert.deepEqual(lauf(g).ereignisse, a.ereignisse);
});

test('Prüfer: Redstone läuft ab', () => {
  const m = (w) => e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.redstone-zeit');
  // Ausbrennende Rückkopplung: Hinweis mit Koordinate der Fackel
  const o = boden(); o.setzeBlock(0, 1, 0, STEIN); fackel(o, 1, 1, 0, 'west'); staub(o, 1, 2, 0); staub(o, 0, 2, 0);
  const mo = m(o);
  assert.ok(mo.some((x) => /brennt im Tick 18 aus/.test(x.meldung) && x.ort.x === 1 && x.ort.y === 1 && x.ort.z === 0));
  // Uhr aus Repeater (Verzögerung 4) und Fackel: Periode 20 Ticks (8 + 2 + 8 + 2), brennt nicht aus
  const u = boden();
  u.setzeBlock(0, 1, 0, 'minecraft:unpowered_repeater', { 'minecraft:cardinal_direction': 'west', repeater_delay: 3 });
  staub(u, 1, 1, 0); staub(u, 2, 1, 0); u.setzeBlock(3, 1, 0, STEIN); fackel(u, 4, 1, 0, 'west');
  for (const [x, z] of [[4, 1], [4, 2], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3], [-1, 3], [-2, 3], [-2, 2], [-2, 1], [-2, 0], [-1, 0]]) staub(u, x, 1, z);
  const mu = m(u);
  assert.equal(mu.length, 1);
  assert.match(mu[0].meldung, /Uhr \(Periode 20 Ticks\)/);
  // Ruhige Schaltung: nichts zu melden
  assert.deepEqual(m(fackelKette(2)), []);
  // Welt ohne Zeitbauteile: nichts, keine Simulation
  assert.deepEqual(m(boden()), []);
  // Original unverändert
  assert.equal(o.leseBlock(1, 1, 0).id, 'minecraft:redstone_torch');
});
