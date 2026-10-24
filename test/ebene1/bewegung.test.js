import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const B = e1.bewegung;
const STEIN = 'minecraft:stone';
const ARTEN = ['spieler', 'dorfbewohner', 'baby'];

/** Gang entlang x bei z = 0: Boden y = 0, Wände bei z = ±1 (y = 1…6), offen nach oben, Länge n. */
function gang(n = 10, decke = null) {
  const w = e0.neueWelt();
  for (let x = -2; x <= n + 2; x++) {
    for (let z = -1; z <= 1; z++) w.setzeBlock(x, 0, z, STEIN);
    for (let y = 1; y <= 8; y++) for (const z of [-1, 1]) w.setzeBlock(x, y, z, STEIN);
    if (decke !== null) w.setzeBlock(x, decke, 0, STEIN);
  }
  return w;
}
const von = { x: 0, y: 1, z: 0 };
const nach = (x, y = 1) => ({ x, y, z: 0 });
const ok = (w, ziel, art, start = von) => B.weg(w, start, ziel, art);
const arten = (w, ziel, start = von) => Object.fromEntries(ARTEN.map((a) => [a, ok(w, ziel, a, start)]));
const schritte = (r) => r.schritte.map((s) => s.art);

test('Bewegung: Größen, Gehen und Stufen', () => {
  // Hitboxen aus Ebene 0
  assert.deepEqual([B.wesenArt('spieler').platzHB, B.wesenArt('dorfbewohner').platzHB, B.wesenArt('baby').platzHB, B.wesenArt('spieler', { kriechen: true }).platzHB], [4, 4, 2, 2]);
  assert.throws(() => B.wesenArt('golem'), /Unbekannte Wesenart/);
  // eben: Gehen kostet 1 je Block für alle
  const r = arten(gang(), nach(5));
  for (const a of ARTEN) { assert.equal(r[a].ok, true, a); assert.equal(r[a].kosten, 5); assert.deepEqual(schritte(r[a]), ['start', 'gehen', 'gehen', 'gehen', 'gehen', 'gehen']); }
  // Durchgang: Decke bei y = 3 (2 Zellen Platz) → alle; Decke bei y = 2 (1 Zelle Platz) → nur Baby und kriechender Spieler
  const zwei = arten(gang(10, 3), nach(5));
  assert.deepEqual(ARTEN.map((a) => zwei[a].ok), [true, true, true]);
  const eins = arten(gang(10, 2), nach(5));
  assert.deepEqual(ARTEN.map((a) => eins[a].ok), [false, false, true], 'Baby passt durch 1 Block');
  assert.equal(ok(gang(10, 2), nach(5), 'spieler', von).ok, false);
  assert.equal(B.weg(gang(10, 2), von, nach(5), 'spieler', { kriechen: true }).ok, true, 'kriechend 0,6 hoch');
  // Halbstufe: untere Halbstufen werden ohne Sprung genommen, Zwischenschritt 0,5
  const hs = gang(); hs.setzeBlock(1, 1, 0, 'minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' });
  const rh = arten(hs, nach(1));
  for (const a of ARTEN) { assert.deepEqual(schritte(rh[a]), ['start', 'stufe'], a); assert.ok(rh[a].kosten < 2); }
  // zwei Halbstufen übereinander bilden einen Block → Sprung nötig
  const hs2 = gang(); hs2.setzeBlock(1, 1, 0, 'minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' }); hs2.setzeBlock(1, 1, 0, 'minecraft:oak_double_slab', { 'minecraft:vertical_half': 'bottom' });
  assert.ok(schritte(ok(hs2, nach(1, 2), 'spieler')).includes('springen'));
  // obere Halbstufe liegt auf Höhe 1 → wie ein Vollblock
  const ob = gang(); ob.setzeBlock(1, 1, 0, 'minecraft:oak_slab', { 'minecraft:vertical_half': 'top' });
  assert.equal(ok(ob, nach(1, 2), 'spieler').ok, true);
  assert.ok(schritte(ok(ob, nach(1, 2), 'spieler')).includes('springen'), 'obere Halbstufe: Sprung');
  // Treppen: zwei Treppen nacheinander (Rückseite im Osten) ohne Sprung hinauf
  const tr = gang();
  tr.setzeBlock(1, 1, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
  tr.setzeBlock(2, 1, 0, STEIN);
  tr.setzeBlock(2, 2, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
  tr.setzeBlock(3, 2, 0, STEIN);
  const rt = arten(tr, nach(3, 3));
  for (const a of ARTEN) { assert.equal(rt[a].ok, true, a); assert.equal(schritte(rt[a]).includes('springen'), false, `${a}: ohne Sprung`); }
  // Wegkosten: Dorfbewohner springen teurer als Spieler
  const sp = gang(); sp.setzeBlock(1, 1, 0, STEIN);
  assert.ok(ok(sp, nach(1, 2), 'dorfbewohner').kosten > ok(sp, nach(1, 2), 'spieler').kosten);
});

test('Bewegung: Springen und Fallen', () => {
  assert.equal(e1.regelwerk.parameter('bewegung.sprung', 'halbBloecke'), 2);
  // 1 Block hoch: springen; 2 Blöcke hoch: zu hoch
  const eins = gang(); eins.setzeBlock(1, 1, 0, STEIN);
  const r1 = arten(eins, nach(1, 2));
  for (const a of ARTEN) { assert.equal(r1[a].ok, true, a); assert.ok(schritte(r1[a]).includes('springen')); assert.equal(r1[a].springt, true); }
  const zwei = gang(); zwei.setzeBlock(1, 1, 0, STEIN); zwei.setzeBlock(1, 2, 0, STEIN);
  const r2 = arten(zwei, nach(1, 3));
  for (const a of ARTEN) { assert.equal(r2[a].ok, false, a); assert.match(r2[a].grund, /zu hoch: 2 Blöcke/); }
  // Zaun (1,5 hoch) ist ein Hindernis und kein Ziel
  const zaun = gang(); zaun.setzeBlock(1, 1, 0, 'minecraft:oak_fence');
  assert.equal(ok(zaun, nach(3), 'spieler').ok, false, 'Zaun sperrt den Gang');
  // Sprung braucht Platz über dem Start: Decke direkt über dem Startblock (y = 3, Kopf 2 Zellen) lässt keinen Sprung auf einen Block zu
  const eng = gang(10, 3); eng.setzeBlock(1, 1, 0, STEIN);
  assert.equal(ok(eng, nach(1, 2), 'spieler').ok, false, 'kein Platz zum Springen');
  // Fallen: Absatz der Höhe h, Ziel unten daneben
  const absatz = (h) => { const w = gang(); for (let x = -2; x <= 0; x++) for (let y = 1; y <= h; y++) w.setzeBlock(x, y, 0, STEIN); return w; };
  const fall = (h, art) => B.weg(absatz(h), { x: 0, y: h + 1, z: 0 }, nach(2), art);
  assert.deepEqual([3, 4, 5, 10].map((h) => fall(h, 'spieler').fallschaden), [0, 1, 2, 7], 'Schaden ab 3 Blöcken, 1 Herzhälfte je Block');
  assert.equal(fall(3, 'dorfbewohner').ok, true);
  assert.equal(fall(4, 'dorfbewohner').ok, false);
  assert.match(fall(4, 'dorfbewohner').grund, /Fallhöhe über 3/);
  assert.equal(fall(3, 'baby').ok, true);
  assert.equal(fall(4, 'baby').ok, false);
  assert.equal(fall(4, 'spieler').faellt, true);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((h) => B.fallschaden(h)), [0, 0, 0, 0, 1, 2]);
  // Lücke von 1 Block: nur der Spieler springt, bei 2 Blöcken nicht
  const luecke = (breite) => { const w = gang(); for (let i = 0; i < breite; i++) w.setzeBlock(2 + i, 0, 0, 'minecraft:air'); return w; };
  const l1 = arten(luecke(1), nach(5));
  assert.equal(l1.spieler.ok, true); assert.ok(schritte(l1.spieler).includes('luecke'));
  assert.equal(l1.dorfbewohner.ok, false); assert.equal(l1.baby.ok, false);
  assert.equal(ok(luecke(2), nach(6), 'spieler').ok, false);
  // Lücke und Boden darunter bis zu 2 Blöcke tief: Sprung auf tieferes Ufer
});

test('Bewegung: Türen, Leitern, Wasser', () => {
  const tuer = (id, offen = false) => {
    const w = gang();
    w.setzeBlock(3, 1, 0, id, { 'minecraft:cardinal_direction': 'east', door_hinge_bit: false, open_bit: offen, upper_block_bit: false });
    w.setzeBlock(3, 2, 0, id, { 'minecraft:cardinal_direction': 'east', door_hinge_bit: false, open_bit: offen, upper_block_bit: true });
    return w;
  };
  // Holz- und Kupfertür: alle; Eisentür: keiner; offene Eisentür: alle
  for (const id of ['minecraft:wooden_door', 'minecraft:spruce_door', 'minecraft:copper_door']) assert.deepEqual(ARTEN.map((a) => ok(tuer(id), nach(6), a).ok), [true, true, true], id);
  assert.deepEqual(ARTEN.map((a) => ok(tuer('minecraft:iron_door'), nach(6), a).ok), [false, false, false]);
  assert.deepEqual(ARTEN.map((a) => ok(tuer('minecraft:iron_door', true), nach(6), a).ok), [true, true, true]);
  // Zauntor: nur der Spieler öffnet es; offen passen alle
  const tor = (offen) => { const w = gang(); w.setzeBlock(3, 1, 0, 'minecraft:fence_gate', { 'minecraft:cardinal_direction': 'east', in_wall_bit: false, open_bit: offen }); return w; };
  assert.deepEqual(ARTEN.map((a) => ok(tor(false), nach(6), a).ok), [true, false, false]);
  assert.deepEqual(ARTEN.map((a) => ok(tor(true), nach(6), a).ok), [true, true, true]);
  // Falltür als Boden über einem Loch: trägt (geschlossen), alle laufen darüber; offen nicht
  const fallt = (offen) => { const w = gang(); w.setzeBlock(3, 0, 0, 'minecraft:air'); w.setzeBlock(3, 1, 0, 'minecraft:trapdoor', { direction: 0, open_bit: offen, upside_down_bit: false }); return w; };
  assert.deepEqual(ARTEN.map((a) => ok(fallt(false), nach(6), a).ok), [true, true, true], 'geschlossene Falltür trägt');
  // Leiter: Spieler klettert 5 Blöcke, Dorfbewohner nicht
  const turm = gang(); for (let y = 1; y <= 5; y++) { turm.setzeBlock(3, y, 0, 'minecraft:ladder', { facing_direction: 2 }); }
  const rl = arten(turm, { x: 3, y: 5, z: 0 });
  assert.equal(rl.spieler.ok, true); assert.ok(schritte(rl.spieler).filter((s) => s === 'leiter').length >= 3);
  assert.equal(rl.dorfbewohner.ok, false); assert.equal(rl.baby.ok, false);
  // Wasser: Säule aus 3 Wasserblöcken, hinaufschwimmen; Sturz aus 10 Blöcken in 2 Blöcke Wasser ohne Schaden
  const wasser = gang(); for (let y = 1; y <= 3; y++) wasser.setzeBlock(3, y, 0, 'minecraft:water', { liquid_depth: 0 });
  assert.equal(ok(wasser, { x: 3, y: 3, z: 0 }, 'spieler').ok, true);
  assert.ok(schritte(ok(wasser, { x: 3, y: 3, z: 0 }, 'spieler')).includes('schwimmen'));
  const sturz = gang(); for (let x = -2; x <= 0; x++) for (let y = 1; y <= 10; y++) sturz.setzeBlock(x, y, 0, STEIN);
  for (let y = 1; y <= 2; y++) sturz.setzeBlock(1, y, 0, 'minecraft:water', { liquid_depth: 0 });
  const rs = B.weg(sturz, { x: 0, y: 11, z: 0 }, { x: 1, y: 1, z: 0 }, 'spieler');
  assert.equal(rs.ok, true); assert.equal(rs.fallschaden, 0, 'Wasser fängt den Sturz');
  // Lava sperrt und wird genannt
  const lava = gang(); lava.setzeBlock(3, 0, 0, 'minecraft:lava', { liquid_depth: 0 }); lava.setzeBlock(3, 1, 0, 'minecraft:lava', { liquid_depth: 0 });
  const rlv = ok(lava, nach(6), 'spieler');
  assert.equal(rlv.ok, false);
  // Unklare Blöcke sperren und werden genannt (Truhe)
  const truhe = gang(); truhe.setzeBlock(3, 1, 0, 'minecraft:chest', { 'minecraft:cardinal_direction': 'north' });
  const rtr = ok(truhe, nach(6), 'spieler');
  assert.equal(rtr.ok, false);
  // das Ziel selbst nicht begehbar: Lava
  assert.match(ok(lava, nach(3), 'spieler').grund, /nicht begehbar/);
});

test('Bewegung: Welt in einer Kopie, deterministisch, Drehen', () => {
  const marker = 'minecraft:emerald_block';
  const w = gang(); w.setzeBlock(1, 1, 0, STEIN); w.setzeBlock(4, 0, 0, 'minecraft:air'); w.setzeBlock(7, 1, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
  w.setzeBlock(0, 0, 0, marker); // Marker unter dem Startpunkt: wandert beim Drehen mit
  const vorher = e0.speichereWelt(w);
  const a = B.erreichbar(w, von, 'spieler'), b = B.erreichbar(w, von, 'spieler');
  assert.equal(e0.speichereWelt(w), vorher, 'Original unverändert');
  assert.deepEqual([...a.zustaende.keys()].sort(), [...b.zustaende.keys()].sort());
  assert.deepEqual(ok(w, nach(9), 'spieler'), ok(w, nach(9), 'spieler'));
  // Drehen um 90° vor der Rechnung: gleiche Zahl erreichbarer Stehstellen und gleiche Kosten zum gedrehten Ziel
  const kasten = [{ x: -3, y: 0, z: -2 }, { x: 14, y: 9, z: 2 }];
  const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(w.ausschnitt(...kasten), 1));
  const m = g.alleBloecke().find((x) => x.id === marker);
  const start = { x: m.x, y: m.y + 1, z: m.z };
  assert.equal(B.erreichbar(g, start, 'spieler').anzahl, a.anzahl);
  assert.equal(B.erreichbar(g, start, 'dorfbewohner').anzahl, B.erreichbar(w, von, 'dorfbewohner').anzahl);
});

test('Prüfer: Begehbarkeit', () => {
  const m = (w, optionen) => e1.pruefe(w, { schienen: null, begehbarkeit: optionen }).filter((x) => x.regel === 'pruefer.begehbar');
  // Ziel auf 3 Blöcken Höhe: Verstoß mit Koordinate und Grund
  const w = gang(); for (let y = 1; y <= 3; y++) w.setzeBlock(5, y, 0, STEIN);
  const r = m(w, { start: von, ziele: [{ pos: { x: 5, y: 4, z: 0 }, art: 'spieler' }] });
  assert.deepEqual(r.map((x) => [x.schwere, x.ort.x, x.ort.y, x.ort.z]), [['verstoss', 5, 4, 0]]);
  assert.match(r[0].meldung, /zu hoch/);
  // Ziel auf Höhe 1 mit Sprung: Hinweis; über Treppe: nichts
  const s = gang(); s.setzeBlock(5, 1, 0, STEIN);
  const rs = m(s, { start: von, ziele: [{ pos: { x: 5, y: 2, z: 0 }, art: 'dorfbewohner' }] });
  assert.deepEqual(rs.map((x) => x.schwere), ['hinweis']);
  assert.match(rs[0].meldung, /nur mit Sprüngen/);
  const t = gang(); t.setzeBlock(5, 1, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
  assert.deepEqual(m(t, { start: von, ziele: [{ pos: { x: 5, y: 1, z: 0 }, art: 'spieler' }] }), []);
  // Sturz: Hinweis mit Schaden; mehrere Ziele, Art Standard = Spieler
  const f = gang(); for (let x = -2; x <= 0; x++) for (let y = 1; y <= 5; y++) f.setzeBlock(x, y, 0, STEIN);
  const rf = m(f, { start: { x: 0, y: 6, z: 0 }, ziele: [{ pos: { x: 3, y: 1, z: 0 } }, { pos: { x: 3, y: 1, z: 0 }, art: 'dorfbewohner' }] });
  assert.deepEqual(rf.map((x) => x.schwere), ['hinweis', 'verstoss']);
  assert.match(rf[0].meldung, /Stürzen \(Schaden 2 Herzhälften\)/);
  // ohne Option läuft keine Prüfung; Original unverändert
  assert.deepEqual(e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.begehbar'), []);
  assert.equal(w.leseBlock(5, 3, 0).id, STEIN);
});
