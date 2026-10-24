import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const RS = e1.redstone;
const STAUB = 'minecraft:redstone_wire', STEIN = 'minecraft:stone';

const boden = (r = 30) => {
  const w = e0.neueWelt();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) w.setzeBlock(x, 0, z, STEIN);
  return w;
};
const staub = (w, x, y, z) => w.setzeBlock(x, y, z, STAUB, { redstone_signal: 0 });
const block = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:redstone_block');
/** Hebel an: lever_direction nennt die Richtung, in der der Befestigungsblock liegt, spiegelverkehrt (Annahme wie antrieb.hebel). */
const hebel = (w, x, y, z, richtung, an = true) => w.setzeBlock(x, y, z, 'minecraft:lever', { lever_direction: richtung, open_bit: an });
const fackel = (w, x, y, z, seite = 'top') => w.setzeBlock(x, y, z, 'minecraft:redstone_torch', { torch_facing_direction: seite });

test('Redstone: Staub-Leitung und Abnahme', () => {
  assert.equal(e1.regelwerk.parameter('redstone.staub-abnahme', 'abnahme'), 1);
  // Gerade Leitung aus 20 Blöcken: Stärke 15 … 1, dann 0
  const w = boden(); block(w, -1, 1, 0);
  for (let x = 0; x < 20; x++) staub(w, x, 1, 0);
  const k = RS.stromkarte(w);
  for (let x = 0; x < 15; x++) assert.equal(k.staub(x, 1, 0), 15 - x, `x=${x}`);
  for (let x = 15; x < 20; x++) assert.equal(k.staub(x, 1, 0), 0, `x=${x}`);
  assert.equal(k.stabil, true);
  // Abzweig und Kreuz: Staub in beiden Richtungen und seitlich
  const a = boden(); block(a, 0, 1, 0);
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [1, 1]]) staub(a, x, 1, z);
  const ka = RS.stromkarte(a);
  assert.deepEqual([[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [1, 1]].map(([x, z]) => ka.staub(x, 1, z)), [15, 15, 15, 15, 14, 14]);
  // rauf über einen Stein: Staub (1,2,0) auf Stein (1,1,0), Einspeisung vom Redstone-Block bei (−1,1,0)
  const r = boden(); block(r, -1, 1, 0); staub(r, 0, 1, 0); r.setzeBlock(1, 1, 0, STEIN); staub(r, 1, 2, 0); staub(r, 2, 2, 0);
  const kr = RS.stromkarte(r);
  assert.deepEqual([kr.staub(0, 1, 0), kr.staub(1, 2, 0), kr.staub(2, 2, 0)], [15, 14, 13]);
  // ein Block über dem unteren Staub kappt die Verbindung nach oben
  const gekappt = boden(); block(gekappt, -1, 1, 0); staub(gekappt, 0, 1, 0); gekappt.setzeBlock(1, 1, 0, STEIN); staub(gekappt, 1, 2, 0); gekappt.setzeBlock(0, 2, 0, STEIN);
  assert.equal(RS.stromkarte(gekappt).staub(1, 2, 0), 0);
  // runter: Staub (0,2,0) auf Stein, Luft daneben, Staub (1,1,0) darunter
  const d = boden(); d.setzeBlock(0, 1, 0, STEIN); block(d, -1, 2, 0); staub(d, 0, 2, 0); staub(d, 1, 1, 0);
  assert.equal(RS.stromkarte(d).staub(1, 1, 0), 14);
  // Glas daneben: Leitung fällt trotzdem (Glas leitet nicht); ein Vollblock daneben sperrt den Abstieg
  const g = boden(); g.setzeBlock(0, 1, 0, STEIN); block(g, -1, 2, 0); staub(g, 0, 2, 0); g.setzeBlock(1, 2, 0, 'minecraft:glass'); staub(g, 1, 1, 0);
  assert.equal(RS.stromkarte(g).staub(1, 1, 0), 14, 'Glas: Abstieg möglich');
  const v = boden(); v.setzeBlock(0, 1, 0, STEIN); block(v, -1, 2, 0); staub(v, 0, 2, 0); v.setzeBlock(1, 2, 0, STEIN); staub(v, 1, 1, 0);
  assert.equal(RS.stromkarte(v).staub(1, 1, 0), 0, 'Vollblock: kein Abstieg');
  // Ohne Quelle bleibt alles 0
  const o = boden(); staub(o, 0, 1, 0);
  assert.equal(RS.stromkarte(o).staub(0, 1, 0), 0);
});

test('Redstone: Quellen und starke/schwache Bestromung', () => {
  // Hebel am Stein: Stein stark bestromt, Staub daneben und darauf bekommt 15
  const w = boden(); w.setzeBlock(0, 1, 0, STEIN); hebel(w, -1, 1, 0, 'west'); staub(w, 1, 1, 0); staub(w, 0, 2, 0);
  const k = RS.stromkarte(w);
  assert.equal(k.blockStark(0, 1, 0), true);
  assert.equal(k.staub(1, 1, 0), 15);
  assert.equal(k.staub(0, 2, 0), 15);
  // Ausgeschalteter Hebel: nichts
  const aus = boden(); aus.setzeBlock(0, 1, 0, STEIN); hebel(aus, -1, 1, 0, 'west', false); staub(aus, 1, 1, 0);
  assert.equal(RS.stromkarte(aus).staub(1, 1, 0), 0);
  // Staub → Stein → Staub: der Stein ist nur schwach bestromt und gibt nichts weiter
  const s = boden(); block(s, -1, 1, 0); staub(s, 0, 1, 0); s.setzeBlock(1, 1, 0, STEIN); staub(s, 2, 1, 0);
  const ks = RS.stromkarte(s);
  assert.equal(ks.blockBestromt(1, 1, 0), true, 'Stein von Staub schwach bestromt');
  assert.equal(ks.blockStark(1, 1, 0), false);
  assert.equal(ks.staub(2, 1, 0), 0, 'schwach bestromter Stein speist keinen Staub');
  // Redstone-Block bestromt Blöcke nur schwach
  const b = boden(); block(b, 0, 1, 0); b.setzeBlock(0, 2, 0, STEIN); staub(b, 0, 3, 0);
  const kb = RS.stromkarte(b);
  assert.equal(kb.blockBestromt(0, 2, 0), true); assert.equal(kb.blockStark(0, 2, 0), false);
  assert.equal(kb.staub(0, 3, 0), 0);
  // Glas leitet nicht: Hebel am Glas bestromt nichts
  const glas = boden(); glas.setzeBlock(0, 1, 0, 'minecraft:glass'); hebel(glas, -1, 1, 0, 'west'); staub(glas, 0, 2, 0);
  const kg = RS.stromkarte(glas);
  assert.equal(kg.blockBestromt(0, 1, 0), false);
  assert.equal(kg.staub(0, 2, 0), 0, 'Staub auf Glas: nur der Hebel selbst fehlt, kein Kontakt');
  // Knopf (gedrückt) wirkt wie ein Hebel am Befestigungsblock; Knopf zeigt von der Wand weg
  const kn = boden(); kn.setzeBlock(0, 1, 0, STEIN);
  const west = [0, 1, 2, 3, 4, 5].find((n) => e0.vermesser.richtungVon('facing_direction', n) === 'west');
  kn.setzeBlock(-1, 1, 0, 'minecraft:stone_button', { facing_direction: west, button_pressed_bit: true }); staub(kn, 1, 1, 0);
  assert.equal(RS.stromkarte(kn).staub(1, 1, 0), 15);
  // Fackel auf einem Stein bestromt den Block darüber stark und Staub daneben
  const f = boden(); f.setzeBlock(0, 1, 0, STEIN); fackel(f, 0, 2, 0); f.setzeBlock(0, 3, 0, STEIN); staub(f, 1, 2, 0);
  const kf = RS.stromkarte(f);
  assert.equal(kf.blockStark(0, 3, 0), true);
  assert.equal(kf.staub(1, 2, 0), 15);
  // keine Quasi-Konnektivität: die Fackel bestromt nur ihre Nachbarzellen
  assert.equal(kf.staub(2, 2, 0), 14 - 14, 'Staub zwei Zellen weg bekommt nichts, wenn nicht verbunden');
});

test('Redstone: Fackel invertiert', () => {
  // Fackel an der Seite eines Steins: ohne Strom brennt sie, mit Hebel am Stein geht sie aus
  const w = boden(); w.setzeBlock(0, 1, 0, STEIN); fackel(w, 1, 1, 0, 'west');
  assert.equal(RS.stromkarte(w).fackelAn(1, 1, 0), true);
  hebel(w, -1, 1, 0, 'west');
  assert.equal(RS.stromkarte(w).fackelAn(1, 1, 0), false);
  assert.equal(RS.stromkarte(w).fackelAn(5, 5, 5), null, 'keine Fackel');
  // alle Befestigungsseiten: west/east/north/south/top
  for (const [seite, dx, dy, dz] of [['west', 1, 0, 0], ['east', -1, 0, 0], ['north', 0, 0, 1], ['south', 0, 0, -1], ['top', 0, 1, 0]]) {
    const t = boden(); t.setzeBlock(0, 1, 0, STEIN); fackel(t, dx, 1 + dy, dz, seite); block(t, 0, 1, 5);
    assert.equal(RS.stromkarte(t).fackelAn(dx, 1 + dy, dz), true, seite);
    // Redstone-Block neben dem Befestigungsblock macht ihn schwach bestromt → Fackel aus (Block liegt auf der freien Seite)
    const rb = boden(); rb.setzeBlock(0, 1, 0, STEIN); fackel(rb, dx, 1 + dy, dz, seite); block(rb, 0, 1, dz === 0 ? 1 : 0);
    if (seite === 'top') block(rb, 1, 1, 0); else if (dz !== 0) block(rb, 1, 1, 0); else block(rb, 0, 1, 1);
    assert.equal(RS.stromkarte(rb).fackelAn(dx, 1 + dy, dz), false, `${seite}: Block neben dem Stein`);
  }
  // Fackelturm: Hebel → Fackel 1 aus → Block 2 unbestromt → Fackel 2 an → Block 3 stark → Fackel 3 aus
  const turm = (an) => {
    const t = boden();
    t.setzeBlock(0, 1, 0, STEIN); fackel(t, 0, 2, 0); t.setzeBlock(0, 3, 0, STEIN); fackel(t, 0, 4, 0); t.setzeBlock(0, 5, 0, STEIN); fackel(t, 0, 6, 0);
    if (an) hebel(t, -1, 1, 0, 'west');
    const k = RS.stromkarte(t);
    return [2, 4, 6].map((y) => k.fackelAn(0, y, 0));
  };
  assert.deepEqual(turm(false), [true, false, true], 'ohne Hebel: ungerade Fackeln brennen');
  assert.deepEqual(turm(true), [false, true, false], 'mit Hebel kippt der Turm');
  // eine Fackel am Stein, der von Staub (schwach) bestromt wird, geht ebenfalls aus
  const sw = boden(); sw.setzeBlock(0, 1, 0, STEIN); fackel(sw, 1, 1, 0, 'west'); block(sw, 0, 2, 5); staub(sw, 0, 2, 0); block(sw, 0, 2, 1);
  assert.equal(RS.stromkarte(sw).fackelAn(1, 1, 0), false, 'Staub auf dem Stein bestromt ihn schwach');
});

test('Redstone: instabile Schaltungen', () => {
  // Rückkopplung: Fackel an Block B, Staub über der Fackel läuft zu Staub auf B, der B bestromt → Fackel aus → Staub aus → Fackel an …
  const w = boden(); w.setzeBlock(0, 1, 0, STEIN); fackel(w, 1, 1, 0, 'west'); staub(w, 1, 2, 0); staub(w, 0, 2, 0);
  const k = RS.stromkarte(w);
  assert.equal(k.stabil, false);
  assert.deepEqual(k.instabil, [{ x: 1, y: 1, z: 0 }]);
  assert.equal(k.runden, 63, 'nach der Höchstzahl von Runden abgebrochen');
  // ohne Rückkopplung stabil
  const ok = boden(); ok.setzeBlock(0, 1, 0, STEIN); fackel(ok, 1, 1, 0, 'west'); staub(ok, 1, 2, 0);
  const kok = RS.stromkarte(ok);
  assert.equal(kok.stabil, true); assert.deepEqual(kok.instabil, []);
});

test('Redstone: Aktivierungs- und Detektorschiene', () => {
  const reihe = (n) => { const w = boden(); for (let i = 0; i < n; i++) e1.schienen.platziere(w, { x: i, y: 1, z: 0 }, 'minecraft:activator_rail'); return w; };
  // Aktivierungsschiene wie Antriebsschiene: Quelle neben der ersten → 9, in der Mitte → 17
  const w = reihe(20); block(w, 0, 1, 1);
  assert.equal(e1.aktivierung.aktive(w).size, 9);
  const m = reihe(20); block(m, 9, 1, 1);
  assert.equal(e1.aktivierung.aktive(m).size, 17);
  // Antriebs- und Aktivierungsschienen übertragen nicht untereinander
  const gemischt = boden();
  for (let i = 0; i < 4; i++) e1.schienen.platziere(gemischt, { x: i, y: 1, z: 0 }, 'minecraft:activator_rail');
  for (let i = 4; i < 8; i++) e1.schienen.platziere(gemischt, { x: i, y: 1, z: 0 }, 'minecraft:golden_rail');
  block(gemischt, 0, 1, 1);
  assert.equal(e1.aktivierung.aktive(gemischt).size, 4);
  assert.equal(e1.antrieb.aktive(gemischt).size, 0);
  // Staub, der auf die Schiene zeigt, versorgt sie (über stromQuellen); Staub, der woanders hinzeigt, nicht
  const s = boden(); e1.schienen.platziere(s, { x: 0, y: 1, z: 0 }, 'minecraft:activator_rail');
  block(s, -3, 1, 0); staub(s, -2, 1, 0); staub(s, -1, 1, 0);
  const ks = RS.stromkarte(s);
  const q = ks.staubQuellenFuer(['minecraft:activator_rail']);
  assert.deepEqual(q, [{ x: -1, y: 1, z: 0 }]);
  assert.equal(e1.aktivierung.aktive(s, q).size, 1);
  const seit = boden(); e1.schienen.platziere(seit, { x: 0, y: 1, z: 0 }, 'minecraft:activator_rail'); block(seit, -1, 1, -2); staub(seit, -1, 1, -1); staub(seit, -1, 1, 0);
  assert.deepEqual(RS.stromkarte(seit).staubQuellenFuer(['minecraft:activator_rail']), [], 'Staub mit Verbindung nach Norden zeigt nach Norden und Süden, nicht nach Osten');
  // Detektorschiene als Quelle: nur mit Lore oder gesetztem rail_data_bit
  const dk = (lore, bit = false) => {
    const w2 = boden(); w2.setzeBlock(0, 1, 0, 'minecraft:detector_rail', { rail_direction: 0, rail_data_bit: bit }); staub(w2, 1, 1, 0); staub(w2, 2, 1, 0);
    const k = RS.stromkarte(w2, { loren: lore ? [{ x: 0, y: 1, z: 0 }] : [] });
    return [k.staub(1, 1, 0), k.staub(2, 1, 0)];
  };
  assert.deepEqual(dk(false), [0, 0]);
  assert.deepEqual(dk(true), [15, 14]);
  assert.deepEqual(dk(false, true), [15, 14]);
  // die Detektorschiene bestromt den Block darunter stark: Staub neben diesem Block bekommt 15
  const u = boden(); u.setzeBlock(0, 1, 0, STEIN); u.setzeBlock(0, 2, 0, 'minecraft:detector_rail', { rail_direction: 0, rail_data_bit: true }); staub(u, 1, 1, 0);
  const ku = RS.stromkarte(u);
  assert.equal(ku.blockStark(0, 1, 0), true); assert.equal(ku.staub(1, 1, 0), 15);
});

test('Redstone: Welt in einer Kopie, deterministisch, Drehen', () => {
  const w = boden(); w.setzeBlock(0, 1, 0, STEIN); hebel(w, -1, 1, 0, 'west'); staub(w, 1, 1, 0); staub(w, 2, 1, 0); staub(w, 2, 1, 1); fackel(w, 0, 2, 0); w.setzeBlock(0, 3, 0, STEIN); staub(w, 1, 3, 0);
  const vorher = e0.speichereWelt(w);
  const a = RS.stromkarte(w), b = RS.stromkarte(w);
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  assert.deepEqual(a.staubZellen.map((p) => a.staub(p.x, p.y, p.z)), b.staubZellen.map((p) => b.staub(p.x, p.y, p.z)));
  // Drehen um 90°: gleiche Stärken und Fackelzustände (Reihenfolge der Zellen ändert sich, die Menge nicht)
  const teil = w.ausschnitt({ x: -5, y: 0, z: -5 }, { x: 5, y: 6, z: 5 });
  const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(teil, 1));
  const kg = RS.stromkarte(g);
  const stufen = (k) => k.staubZellen.map((p) => k.staub(p.x, p.y, p.z)).sort((x, y) => x - y);
  assert.deepEqual(stufen(kg), stufen(a));
  assert.equal(kg.stabil, true);
});

test('Prüfer: Redstone', () => {
  const m = (w, optionen = {}) => e1.pruefe(w, { schienen: null, ...optionen }).filter((x) => x.regel === 'pruefer.redstone');
  // Staub ohne Quelle
  const a = boden(); staub(a, 3, 1, 3);
  assert.deepEqual(m(a).map((x) => [x.schwere, x.ort.x, x.ort.z]), [['hinweis', 3, 3]]);
  assert.match(m(a)[0].meldung, /nie Strom/);
  // Leitung zu lang: Meldung an der Stelle, an der sie ausgeht
  const l = boden(); block(l, -1, 1, 0); for (let x = 0; x < 20; x++) staub(l, x, 1, 0);
  const ml = m(l);
  assert.equal(ml.length, 1); assert.deepEqual([ml[0].ort.x, ml[0].ort.y, ml[0].ort.z], [15, 1, 0]);
  assert.match(ml[0].meldung, /ausgegangen/);
  // schwingende Schaltung
  const o = boden(); o.setzeBlock(0, 1, 0, STEIN); fackel(o, 1, 1, 0, 'west'); staub(o, 1, 2, 0); staub(o, 0, 2, 0);
  const mo = m(o);
  assert.ok(mo.some((x) => /Gleichgewicht/.test(x.meldung) && x.ort.x === 1 && x.ort.y === 1));
  // unbekannte Leitfähigkeit neben Staub (Amboss)
  const u = boden(); block(u, -1, 1, 0); staub(u, 0, 1, 0); u.setzeBlock(1, 1, 0, 'minecraft:anvil', { 'minecraft:cardinal_direction': 'north' });
  assert.ok(m(u).some((x) => /nicht belegt/.test(x.meldung) && x.ort.x === 1));
  // sauber: kurze Leitung mit Quelle
  const s = boden(); block(s, -1, 1, 0); for (let x = 0; x < 5; x++) staub(s, x, 1, 0);
  assert.deepEqual(m(s), []);
  // ohne Redstone läuft nichts
  assert.deepEqual(m(boden()), []);
});
