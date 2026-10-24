import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const L = e1.licht;
const STEIN = 'minecraft:stone';

/** Geschlossener Raum: Boden y = 0, Decke y = 6, Wände bei ±r (kein Himmelslicht, Blocklicht bleibt drin). */
function raum(r = 22) {
  const w = e0.neueWelt();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) { w.setzeBlock(x, 0, z, STEIN); w.setzeBlock(x, 6, z, STEIN); }
  for (let y = 1; y <= 5; y++) for (let i = -r; i <= r; i++) for (const [x, z] of [[i, -r], [i, r], [-r, i], [r, i]]) w.setzeBlock(x, y, z, STEIN);
  return w;
}
const fackel = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:torch', { torch_facing_direction: 'top' });
const bereich = (r = 8, y = 1) => ({ von: { x: -r, y, z: -r }, bis: { x: r, y: y + 3, z: r } });
const taxi = (x, y, z) => Math.abs(x) + Math.abs(y - 1) + Math.abs(z);

test('Licht: Blocklicht nimmt um 1 je Block ab', () => {
  assert.equal(e1.regelwerk.parameter('licht.blocklicht', 'abnahme'), 1);
  const w = raum(); fackel(w, 0, 1, 0);
  const k = L.lichtkarte(w, bereich(16, 1));
  assert.deepEqual(k.block(0, 1, 0), { min: 14, max: 14 }, 'Fackel: Stärke 14');
  for (const [x, y, z] of [[1, 1, 0], [3, 2, 2], [5, 1, 0], [-6, 1, 4], [0, 4, 0], [9, 1, 5], [13, 1, 0], [10, 1, 4]]) {
    const erwartet = Math.max(0, 14 - taxi(x, y, z));
    assert.deepEqual(k.block(x, y, z), { min: erwartet, max: erwartet }, `(${x},${y},${z})`);
  }
  assert.equal(k.block(14, 1, 0).max, 0, 'ab 14 Blöcken Abstand dunkel');
  assert.equal(k.blocklicht(13, 1, 0), 'hell');
  assert.equal(k.blocklicht(14, 1, 0), 'dunkel');
  // Zwei Quellen: das hellere zählt (kein Addieren)
  fackel(w, 4, 1, 0);
  const k2 = L.lichtkarte(w, bereich(8, 1));
  assert.equal(k2.block(2, 1, 0).max, 12, 'zwischen zwei Fackeln: max(12, 12), nicht 24');
  assert.equal(k2.block(3, 1, 0).max, 13);
  // Lichtblock: Stärke aus dem Namen
  const lb = raum(); lb.setzeBlock(0, 1, 0, 'minecraft:light_block_7');
  assert.equal(L.lichtkarte(lb, bereich(4, 1)).block(2, 1, 0).max, 5);
});

test('Licht: undurchsichtige Blöcke halten Licht auf', () => {
  const w = raum(); fackel(w, 0, 1, 0);
  for (let y = 1; y <= 5; y++) for (let z = -21; z <= 21; z++) w.setzeBlock(3, y, z, STEIN); // durchgehende Wand
  const k = L.lichtkarte(w, bereich(8, 1));
  assert.equal(k.block(2, 1, 0).max, 12);
  for (let x = 4; x <= 8; x++) assert.deepEqual(k.block(x, 1, 0), { min: 0, max: 0 }, `hinter der Wand x=${x}`);
  // Lücke in der Wand: Licht kommt durch (Umweg über das Loch)
  w.setzeBlock(3, 1, 0, 'minecraft:air');
  const k2 = L.lichtkarte(w, bereich(8, 1));
  assert.deepEqual(k2.block(4, 1, 0), { min: 10, max: 10 });
  assert.deepEqual(k2.block(4, 1, 3), { min: 7, max: 7 });
});

test('Licht: Himmelslicht fällt senkrecht ungeschwächt und seitlich um 1', () => {
  const w = e0.neueWelt();
  for (let x = -30; x <= 30; x++) for (let z = -30; z <= 30; z++) { w.setzeBlock(x, 0, z, STEIN); if (x !== 0 || z !== 0) w.setzeBlock(x, 5, z, STEIN); }
  const k = L.lichtkarte(w, { von: { x: -4, y: 1, z: -4 }, bis: { x: 16, y: 4, z: 4 } }, { himmel: 'tag' });
  for (let y = 1; y <= 4; y++) assert.deepEqual(k.himmelRoh(0, y, 0), { min: 15, max: 15 }, `Schacht y=${y}`);
  assert.equal(k.himmelRoh(1, 1, 0).max, 14);
  assert.equal(k.himmelRoh(0, 1, 3).max, 12);
  assert.equal(k.himmelRoh(3, 4, 0).max, 12);
  assert.equal(k.himmelRoh(15, 1, 0).max, 0, 'ab 15 Blöcken seitlich dunkel');
  assert.equal(k.himmelRoh(14, 1, 0).max, 1);
  // Freies Gelände: überall 15
  const frei = e0.neueWelt(); frei.setzeBlock(0, 0, 0, STEIN);
  const kf = L.lichtkarte(frei, { von: { x: -3, y: 1, z: -3 }, bis: { x: 3, y: 3, z: 3 } });
  assert.deepEqual(kf.himmelRoh(2, 1, 2), { min: 15, max: 15 });
});

test('Licht: Filter von Laub, Wasser und doppelten Halbstufen', () => {
  assert.deepEqual([e1.regelwerk.parameter('licht.filter', 'laub'), e1.regelwerk.parameter('licht.filter', 'wasser'), e1.regelwerk.parameter('licht.filter', 'doppelteHalbstufe')], [2, 1, 15]);
  // Die Regel und die Fakten in Ebene 0 stimmen überein
  const f = (id) => e0.register.bloecke.block(id).eigenschaften.lichtfilter;
  assert.deepEqual([f('minecraft:oak_leaves'), f('minecraft:water'), f('minecraft:oak_double_slab'), f('minecraft:stone'), f('minecraft:air')], [2, 1, 15, 15, 0]);
  assert.deepEqual([f('minecraft:glass'), f('minecraft:white_carpet'), f('minecraft:lava'), f('minecraft:ice')], [0, 0, 15, 1], 'Wiki „Opacity“: Glas und Teppich wie Luft, Lava blockiert, Eis wie Wasser');
  assert.deepEqual([f('minecraft:tinted_glass'), f('minecraft:snow_layer'), f('minecraft:hopper')], [null, null, null], 'Schnee, getöntes Glas und alles ohne Angabe bleibt unbekannt');
  // Treppen und Halbstufen (Java-Kategorie): Filter 0, aber lichtblockierende Form
  const form = (id) => e0.register.bloecke.block(id).eigenschaften.lichtform;
  assert.deepEqual([f('minecraft:oak_stairs'), f('minecraft:oak_slab'), f('minecraft:oak_double_slab')], [0, 0, 15]);
  assert.deepEqual([form('minecraft:oak_stairs'), form('minecraft:oak_slab'), form('minecraft:oak_double_slab'), form('minecraft:stone')], ['treppe', 'halbstufe', null, null]);
  // Jonah, 24.10.2026: wo Bedrock nichts sagt, gilt Java – dünne Blöcke lassen Licht durch wie Luft (Filter 0)
  assert.deepEqual([f('minecraft:oak_fence'), f('minecraft:torch'), f('minecraft:glass_pane'), f('minecraft:golden_rail'), f('minecraft:cobblestone_wall'), f('minecraft:poppy'), f('minecraft:tube_coral_fan'), f('minecraft:stone_button')], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([f('minecraft:sea_lantern'), f('minecraft:melon_stem')].map((x) => x), [15, 0], 'Seelaterne ist ein Vollblock, Stängel sind dünn');
  const dach = (id, zustand = {}) => {
    const w = e0.neueWelt();
    for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) { w.setzeBlock(x, 0, z, STEIN); w.setzeBlock(x, 5, z, id, zustand); }
    return L.lichtkarte(w, { von: { x: -1, y: 1, z: -1 }, bis: { x: 1, y: 4, z: 1 } }, { himmel: 'tag' }).himmelRoh(0, 4, 0);
  };
  assert.deepEqual(dach('minecraft:oak_leaves'), { min: 12, max: 13 }, 'Laub: 15 − 2 (Obergrenze) bzw. 15 − (1 + 2) (Untergrenze)');
  assert.deepEqual(dach('minecraft:water', { liquid_depth: 0 }), { min: 13, max: 14 }, 'Wasser: 15 − 1 bzw. 15 − (1 + 1)');
  assert.deepEqual(dach('minecraft:oak_double_slab', { 'minecraft:vertical_half': 'bottom' }), { min: 0, max: 0 }, 'doppelte Halbstufe blockiert');
  // waagerecht: ein Laubblock kostet 2 statt 1
  const w = raum(); fackel(w, 0, 1, 0);
  const luft = L.lichtkarte(w, bereich(6, 1)).block(4, 1, 0).max;
  w.setzeBlock(3, 1, 0, 'minecraft:oak_leaves');
  const laub = L.lichtkarte(w, bereich(6, 1)).block(4, 1, 0);
  assert.equal(luft, 10);
  assert.equal(laub.max, 9, 'durch ein Laubblatt eine Stufe weniger als durch Luft (um 2 statt 1)');
  assert.equal(laub.min, 8, 'Untergrenze: um 1 + 2 = 3');
});

test('Licht: Unbekanntes wird mit zwei Schranken berechnet', () => {
  // Wand über den ganzen Raum, in der Mitte ein Glasblock: dahinter kommt Licht nur durch das Glas
  const w = raum(); fackel(w, 0, 1, 0);
  for (let y = 1; y <= 5; y++) for (let z = -21; z <= 21; z++) w.setzeBlock(3, y, z, STEIN);
  w.setzeBlock(3, 1, 0, 'minecraft:tinted_glass');
  const k = L.lichtkarte(w, bereich(8, 1));
  assert.deepEqual(k.block(4, 1, 0), { min: 0, max: 10 }, 'getöntes Glas unbekannt: dahinter 0 bis 10');
  assert.equal(k.blocklicht(4, 1, 0), 'unklar');
  assert.equal(k.blocklicht(2, 1, 0), 'hell');
  assert.equal(k.blocklicht(8, 1, 5), 'unklar');
  // Überall Minimum ≤ Maximum
  for (let x = -8; x <= 8; x++) for (let y = 1; y <= 4; y++) for (let z = -8; z <= 8; z++) {
    const b = k.block(x, y, z), h = k.himmelRoh(x, y, z);
    assert.ok(b.min <= b.max && h.min <= h.max, `(${x},${y},${z})`);
  }
  // Ohne unbekannte Blöcke gibt es keine Unklarheit
  const klar = raum(); fackel(klar, 0, 1, 0);
  const kk = L.lichtkarte(klar, bereich(8, 1));
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) assert.equal(kk.block(x, 1, z).min, kk.block(x, 1, z).max);
  // Zustandsabhängige Quelle (Kerze): 0 bis 15
  const kerze = raum(); kerze.setzeBlock(0, 1, 0, 'minecraft:candle', {});
  const kc = L.lichtkarte(kerze, bereich(3, 1));
  assert.deepEqual(kc.block(0, 1, 0), { min: 0, max: 15 });
  assert.deepEqual(kc.block(2, 1, 0), { min: 0, max: 13 });
});

test('Licht: Glas und Teppich lassen Licht durch wie Luft (Wiki „Opacity“)', () => {
  for (const [id, zustand] of [['minecraft:glass', {}], ['minecraft:white_stained_glass', {}], ['minecraft:white_carpet', {}]]) {
    const w = raum(); fackel(w, 0, 1, 0);
    for (let y = 1; y <= 5; y++) for (let z = -21; z <= 21; z++) w.setzeBlock(3, y, z, STEIN);
    w.setzeBlock(3, 1, 0, id, zustand);
    const k = L.lichtkarte(w, bereich(8, 1));
    assert.deepEqual(k.block(4, 1, 0), { min: 10, max: 10 }, `${id}: dahinter genauso hell wie durch Luft`);
  }
  // dünne Blöcke gelten nach Java wie Luft (Filter 0)
  for (const id of ['minecraft:glass_pane', 'minecraft:oak_fence', 'minecraft:golden_rail']) {
    const w = raum(); fackel(w, 0, 1, 0);
    for (let y = 1; y <= 5; y++) for (let z = -21; z <= 21; z++) w.setzeBlock(3, y, z, STEIN);
    w.setzeBlock(3, 1, 0, id, id.endsWith('rail') ? { rail_direction: 0 } : {});
    assert.deepEqual(L.lichtkarte(w, bereich(8, 1)).block(4, 1, 0), { min: 10, max: 10 }, `${id}: wie Luft`);
  }
  // getöntes Glas ist nicht belegt → unklar
  for (const id of ['minecraft:tinted_glass']) {
    const w = raum(); fackel(w, 0, 1, 0);
    for (let y = 1; y <= 5; y++) for (let z = -21; z <= 21; z++) w.setzeBlock(3, y, z, STEIN);
    w.setzeBlock(3, 1, 0, id, {});
    assert.equal(L.lichtkarte(w, bereich(8, 1)).blocklicht(4, 1, 0), 'unklar', id);
  }
});

test('Licht: Himmelslicht unter 15 senkrecht – Schranken statt Raten', () => {
  // Dach ab x = 1, Grube bei x = 3 (tiefer Schacht im Boden): seitlich verteiltes Licht im Schacht
  const w = e0.neueWelt();
  for (let x = -30; x <= 30; x++) for (let z = -30; z <= 30; z++) { w.setzeBlock(x, -4, z, STEIN); if (!(x === 3 && z === 0)) w.setzeBlock(x, 0, z, STEIN); if (x !== 0 || z !== 0) w.setzeBlock(x, 5, z, STEIN); }
  const k = L.lichtkarte(w, { von: { x: 0, y: -3, z: -2 }, bis: { x: 4, y: 4, z: 2 } }, { himmel: 'tag' });
  assert.deepEqual(k.himmelRoh(3, 1, 0), { min: 12, max: 12 }, 'unter dem Dach drei Blöcke seitlich');
  assert.deepEqual(k.himmelRoh(3, -3, 0), { min: 8, max: 12 }, 'Grubenboden: Obergrenze senkrecht ungeschwächt (12), Untergrenze 1 je Block (12 − 4)');
  assert.deepEqual(k.himmelRoh(3, 0, 0), { min: 11, max: 12 });
  // Unter freiem Himmel (15) fällt das Licht in beiden Schranken ungeschwächt
  for (let y = 1; y <= 4; y++) assert.deepEqual(k.himmelRoh(0, y, 0), { min: 15, max: 15 });
});

test('Licht: Treppen und Halbstufen sperren nur über ihre vollen Flächen (Java-Kategorie, ungeprüft)', () => {
  const stufe = (richtung, kopf = false) => ({ weirdo_direction: richtung, upside_down_bit: kopf, 'minecraft:corner': 'none' });
  const durch = (id, zustand) => {
    const w = raum(); fackel(w, 0, 1, 0);
    for (let y = 1; y <= 5; y++) for (let z = -21; z <= 21; z++) w.setzeBlock(3, y, z, STEIN);
    w.setzeBlock(3, 1, 0, id, zustand);
    const k = L.lichtkarte(w, bereich(8, 1));
    durch.zelle = k.block(3, 1, 0);
    return k.block(4, 1, 0);
  };
  const hell = { min: 10, max: 10 }, dunkel = { min: 0, max: 0 };
  // Halbstufen lassen Licht seitlich durch (Seiten nur halb gefüllt)
  assert.deepEqual(durch('minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' }), hell);
  assert.deepEqual(durch('minecraft:oak_slab', { 'minecraft:vertical_half': 'top' }), hell);
  // Treppe: Rückseite ist voll (0 Ost, 1 West, 2 Süd, 3 Nord = Seite des Vollblocks)
  assert.deepEqual(durch('minecraft:oak_stairs', stufe(0)), dunkel, 'Rückseite nach Osten sperrt das Licht, das nach Osten will');
  assert.deepEqual(durch('minecraft:oak_stairs', stufe(1)), dunkel, 'Rückseite nach Westen sperrt den Eintritt von Westen');
  durch('minecraft:oak_stairs', stufe(0)); assert.deepEqual(durch.zelle, { min: 11, max: 11 }, 'Rückseite im Osten: Licht kommt von Westen in die Treppe hinein');
  durch('minecraft:oak_stairs', stufe(1)); assert.deepEqual(durch.zelle, dunkel, 'Rückseite im Westen: Eintritt von Westen gesperrt');
  assert.deepEqual(durch('minecraft:oak_stairs', stufe(2)), hell, 'Rückseite nach Süden: Ost und West halb offen');
  assert.deepEqual(durch('minecraft:oak_stairs', stufe(3, true)), hell);
  // senkrecht: untere Halbstufen sperren über die Unterseite, obere über die Oberseite
  const ebene = (zustand, id = 'minecraft:oak_slab') => {
    const w = raum(); fackel(w, 0, 1, 0);
    for (let x = -21; x <= 21; x++) for (let z = -21; z <= 21; z++) w.setzeBlock(x, 3, z, id, zustand);
    const k = L.lichtkarte(w, bereich(8, 1));
    return [k.block(0, 2, 0), k.block(0, 3, 0), k.block(0, 4, 0)];
  };
  assert.deepEqual(ebene({ 'minecraft:vertical_half': 'bottom' }), [{ min: 13, max: 13 }, dunkel, dunkel], 'untere Halbstufen: Unterseite voll');
  assert.deepEqual(ebene({ 'minecraft:vertical_half': 'top' }), [{ min: 13, max: 13 }, { min: 12, max: 12 }, dunkel], 'obere Halbstufen: Licht kommt von unten hinein, oben ist voll');
  assert.deepEqual(ebene(stufe(2), 'minecraft:oak_stairs'), [{ min: 13, max: 13 }, dunkel, dunkel], 'Treppe: Unterseite voll');
  assert.deepEqual(ebene(stufe(2, true), 'minecraft:oak_stairs'), [{ min: 13, max: 13 }, { min: 12, max: 12 }, dunkel], 'kopfstehende Treppe: Oberseite voll');
  // Himmelslicht: Dach aus Halbstufen sperrt die Spalte (untere Halbstufe: unten voll, obere: oben voll)
  for (const h of ['bottom', 'top']) {
    const w = e0.neueWelt();
    for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) { w.setzeBlock(x, 0, z, STEIN); w.setzeBlock(x, 5, z, 'minecraft:oak_slab', { 'minecraft:vertical_half': h }); }
    const k = L.lichtkarte(w, { von: { x: -1, y: 1, z: -1 }, bis: { x: 1, y: 4, z: 1 } }, { himmel: 'tag' });
    assert.deepEqual(k.himmelRoh(0, 4, 0), { min: 0, max: 0 }, `Dach aus ${h}-Halbstufen`);
  }
});

test('Licht: Himmelslicht innen (Tag, Regen, Gewitter, Nacht)', () => {
  const frei = e0.neueWelt(); frei.setzeBlock(0, 0, 0, STEIN);
  const b = { von: { x: -2, y: 1, z: -2 }, bis: { x: 2, y: 2, z: 2 } };
  const erwartet = { tag: 15, regen: 12, gewitter: 10, nacht: 4 };
  for (const [himmel, wert] of Object.entries(erwartet)) {
    assert.deepEqual(L.lichtkarte(frei, b, { himmel }).himmelInnen(0, 1, 0), { min: wert, max: wert }, himmel);
  }
  assert.deepEqual(L.himmelsWerte, erwartet);
  assert.throws(() => L.lichtkarte(frei, b, { himmel: 'schnee' }), /Unbekannter Himmelszustand/);
  // Rohwert 12 (3 Blöcke unter einem Dach) bei Nacht: 12 − 11 = 1
  const w = e0.neueWelt();
  for (let x = -30; x <= 30; x++) for (let z = -30; z <= 30; z++) { w.setzeBlock(x, 0, z, STEIN); if (x !== 0 || z !== 0) w.setzeBlock(x, 5, z, STEIN); }
  const k = L.lichtkarte(w, { von: { x: -4, y: 1, z: -4 }, bis: { x: 4, y: 4, z: 4 } }, { himmel: 'nacht' });
  assert.deepEqual(k.himmelInnen(0, 1, 3), { min: 1, max: 1 });
  assert.deepEqual(k.himmelInnen(0, 1, 4), { min: 0, max: 0 });
  assert.throws(() => k.himmelInnen(20, 1, 0), /außerhalb/);
});

test('Licht: Drehen mit dem Vermesser vertauscht sich mit der Lichtberechnung', () => {
  const w = raum(12); fackel(w, 2, 1, 1);
  w.setzeBlock(4, 1, 0, 'minecraft:glass'); w.setzeBlock(-3, 1, 2, 'minecraft:oak_leaves'); w.setzeBlock(1, 1, -3, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
  const teil = w.ausschnitt({ x: -12, y: 0, z: -12 }, { x: 12, y: 6, z: 12 });
  const k = L.lichtkarte(w, bereich(6, 1));
  for (const viertel of [1, 2, 3]) {
    const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(teil, viertel));
    const kg = L.lichtkarte(g, bereich(6, 1));
    const dreh = ([x, z]) => { let a = x, b = z; for (let i = 0; i < viertel; i++) [a, b] = [-b, a]; return [a, b]; };
    for (let x = -6; x <= 6; x++) for (let y = 1; y <= 4; y++) for (let z = -6; z <= 6; z++) {
      const [gx, gz] = dreh([x, z]);
      assert.deepEqual(kg.block(gx, y, gz), k.block(x, y, z), `um ${viertel} gedreht, (${x},${y},${z})`);
    }
  }
});

test('Licht: Bereich begrenzt, deterministisch, Welt unverändert', () => {
  const w = raum(); fackel(w, 0, 1, 0);
  const vorher = e0.speichereWelt(w);
  const t0 = Date.now();
  const a = L.lichtkarte(w, bereich(10, 1));
  assert.ok(Date.now() - t0 < 5000, 'Bereich 21×4×21 plus Rand rechnet schnell');
  const b = L.lichtkarte(w, bereich(10, 1));
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) assert.deepEqual(a.block(x, 2, z), b.block(x, 2, z));
  assert.equal(e0.speichereWelt(w), vorher);
  assert.throws(() => L.lichtkarte(w, { von: { x: 0, y: -100, z: 0 }, bis: { x: 1, y: 1, z: 1 } }), /Welthöhe/);
});

test('Prüfer: Lichtquellen mit unklarer Stärke', () => {
  const w = raum(5);
  w.setzeBlock(1, 1, 1, 'minecraft:candle', {});
  w.setzeBlock(2, 1, 1, 'minecraft:sea_pickle', {});
  w.setzeBlock(3, 1, 1, 'minecraft:torch', { torch_facing_direction: 'top' });
  const m = e1.pruefe(w, { schienen: null }).filter((x) => x.regel === 'pruefer.licht-unklar');
  assert.deepEqual(m.map((x) => [x.ort.x, x.schwere]), [[1, 'hinweis'], [2, 'hinweis']], 'Kerze und Seegurke, nicht die Fackel');
  assert.deepEqual(e1.pruefe(raum(5), { schienen: null }).filter((x) => x.regel === 'pruefer.licht-unklar'), []);
});
