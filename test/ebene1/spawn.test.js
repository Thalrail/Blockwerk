import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const S = e1.spawn;
const STEIN = 'minecraft:stone';

/** Geschlossener Raum: Boden y = 0, Decke y = 6, Wände bei ±r. Innen y = 1…5 ist Luft. */
function raum(r = 22) {
  const w = e0.neueWelt();
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) { w.setzeBlock(x, 0, z, STEIN); w.setzeBlock(x, 6, z, STEIN); }
  for (let y = 1; y <= 5; y++) for (let i = -r; i <= r; i++) for (const [x, z] of [[i, -r], [i, r], [-r, i], [r, i]]) w.setzeBlock(x, y, z, STEIN);
  return w;
}
const fackel = (w, x, y, z) => w.setzeBlock(x, y, z, 'minecraft:torch', { torch_facing_direction: 'top' });
const bereich = (r = 5, y0 = 1, y1 = 1) => ({ von: { x: -r, y: y0, z: -r }, bis: { x: r, y: y1, z: r } });
const hat = (stellen, x, y, z) => stellen.find((s) => s.x === x && s.y === y && s.z === z);

test('Spawn: dunkler Raum bei Nacht – Spawn möglich', () => {
  const w = raum();
  const s = S.spawnstellen(w, bereich(5));
  assert.equal(s.length, 11 * 11);
  assert.ok(s.every((x) => x.urteil === 'moeglich' && x.gruende.length === 0 && x.y === 1));
  // ohne Boden (Luft darunter) nichts
  const w2 = raum(); for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) w2.setzeBlock(x, 0, z, 'minecraft:air');
  assert.equal(S.spawnstellen(w2, bereich(5)).length, 121 - 25);
  // Sortierung y, z, x und Welt unverändert
  const vorher = e0.speichereWelt(w);
  const a = S.spawnstellen(w, bereich(3, 1, 2));
  assert.deepEqual(a.map((x) => [x.y, x.z, x.x]), [...a.map((x) => [x.y, x.z, x.x])].sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]));
  assert.equal(e0.speichereWelt(w), vorher);
  assert.throws(() => S.spawnstellen(w, bereich(2), { monster: 'minecraft:cod' }), /keine bekannte Hitbox/);
});

test('Spawn: Fackel verhindert Spawn im Umkreis', () => {
  const w = raum(); fackel(w, 0, 1, 0);
  const s = S.spawnstellen(w, bereich(16));
  for (let x = -16; x <= 16; x++) {
    for (let z = -16; z <= 16; z++) {
      const dist = Math.abs(x) + Math.abs(z);
      if (x === 0 && z === 0) { assert.equal(hat(s, x, 1, z), undefined, 'Fackel-Block selbst'); continue; }
      assert.equal(Boolean(hat(s, x, 1, z)), dist >= 14, `(${x},${z}) Abstand ${dist}`);
    }
  }
  // Schon Blocklicht 1 reicht: Lichtblock Stärke 2 erhellt den Nachbarn mit 1, zwei Blöcke weiter ist es 0
  const l = raum(); l.setzeBlock(0, 1, 0, 'minecraft:light_block_2');
  assert.equal(Boolean(hat(S.spawnstellen(l, bereich(3)), 0, 1, 1)), false, 'direkt daneben: Blocklicht 1');
  assert.equal(Boolean(hat(S.spawnstellen(l, bereich(3)), 0, 1, 2)), true, 'zwei Blöcke weiter: Blocklicht 0');
});

test('Spawn: Himmelslicht entscheidet, ob draußen gespawnt wird', () => {
  const frei = e0.neueWelt();
  for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) frei.setzeBlock(x, 0, z, STEIN);
  const n = (himmel) => S.spawnstellen(frei, bereich(4), { himmel }).length;
  assert.equal(n('tag'), 0, 'Tag (inneres Himmelslicht 15)');
  assert.equal(n('regen'), 0, 'Regen (12)');
  assert.equal(n('gewitter'), 0, 'Gewitter (10)');
  assert.equal(n('nacht'), 81, 'Nacht (4): draußen dunkel genug');
  // überdachte Halle: tief im Inneren dunkel, nahe am offenen Rand auch tagsüber hell
  const halle = e0.neueWelt();
  for (let x = 0; x <= 60; x++) for (let z = -10; z <= 10; z++) { halle.setzeBlock(x, 0, z, STEIN); halle.setzeBlock(x, 4, z, STEIN); }
  const tag = S.spawnstellen(halle, { von: { x: 0, y: 1, z: 0 }, bis: { x: 60, y: 1, z: 0 } }, { himmel: 'tag' });
  assert.equal(hat(tag, 2, 1, 0), undefined, 'am Rand der Halle (Himmelslicht hoch) kein Spawn');
  assert.ok(hat(tag, 30, 1, 0), 'tief in der Halle (Himmelslicht unter 7) Spawn auch tagsüber');
  assert.equal(S.spawnstellen(halle, { von: { x: 0, y: 1, z: 0 }, bis: { x: 60, y: 1, z: 0 } }, { himmel: 'nacht' }).length, 61);
  assert.throws(() => S.spawnstellen(frei, bereich(2), { himmel: 'schnee' }), /Himmelszustand/);
});

test('Spawn: Boden muss eine volle feste Oberseite haben', () => {
  const boden = (id, zustand = {}) => {
    const w = raum(); w.setzeBlock(0, 0, 0, id, zustand);
    return hat(S.spawnstellen(w, bereich(2)), 0, 1, 0);
  };
  for (const id of ['minecraft:stone', 'minecraft:oak_planks', 'minecraft:dirt', 'minecraft:grass_block', 'minecraft:cobblestone']) assert.equal(boden(id)?.urteil, 'moeglich', id);
  assert.equal(boden('minecraft:oak_double_slab', { 'minecraft:vertical_half': 'bottom' })?.urteil, 'moeglich', 'doppelte Halbstufe');
  for (const [id, zustand] of [
    ['minecraft:oak_fence', {}], ['minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false }], ['minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: true }],
    ['minecraft:chest', {}], ['minecraft:unpowered_repeater', {}], ['minecraft:oak_slab', { 'minecraft:vertical_half': 'bottom' }],
  ]) assert.equal(boden(id, zustand), undefined, `${id} ${JSON.stringify(zustand)} zählt nicht als Boden`);
  // Teppich zählt nicht: darüber (y = 2) kein Spawn, auf dem Teppich-Feld selbst (y = 1) steht ein Block
  const t = raum(); t.setzeBlock(0, 1, 0, 'minecraft:white_carpet');
  const st = S.spawnstellen(t, bereich(2, 1, 2));
  assert.equal(hat(st, 0, 2, 0), undefined);
  assert.equal(hat(st, 0, 1, 0), undefined);
  assert.equal(S.boden(t, 0, 2, 0), 'nein');
});

test('Spawn: Platz für die Hitbox (Zombie 2 hoch, Spinne 1 hoch, 3 breit)', () => {
  // Massiver Block mit drei Gängen; Fuß-Zelle jeweils y = 1
  const w = e0.neueWelt();
  for (let x = -10; x <= 10; x++) for (let y = 0; y <= 6; y++) for (let z = -10; z <= 10; z++) w.setzeBlock(x, y, z, STEIN);
  const gang = (z0, z1, hoehe) => { for (let x = -8; x <= 8; x++) for (let z = z0; z <= z1; z++) for (let y = 1; y <= hoehe; y++) w.setzeBlock(x, y, z, 'minecraft:air'); };
  gang(0, 0, 2);   // 1 breit, 2 hoch
  gang(6, 8, 1);   // 3 breit, 1 hoch (Mitte z = 7)
  gang(-8, -6, 2); // 3 breit, 2 hoch (Mitte z = -7)
  const b = { von: { x: -4, y: 1, z: -9 }, bis: { x: 4, y: 1, z: 9 } };
  const zombie = S.spawnstellen(w, b, { monster: 'minecraft:zombie' });
  const spinne = S.spawnstellen(w, b, { monster: 'minecraft:spider' });
  assert.ok(hat(zombie, 0, 1, 0), 'Zombie passt in 1 breit × 2 hoch');
  assert.equal(hat(spinne, 0, 1, 0), undefined, 'Spinne (1,4 breit) passt nicht in einen 1 breiten Gang');
  assert.equal(hat(zombie, 0, 1, 7), undefined, 'Zombie braucht 2 Blöcke Höhe');
  assert.ok(hat(spinne, 0, 1, 7), 'Spinne passt in 3 breit × 1 hoch');
  assert.equal(hat(spinne, 0, 1, 6), undefined, 'am Rand des breiten Gangs ragt die Spinne in die Wand');
  assert.ok(hat(zombie, 0, 1, -6) && hat(zombie, 0, 1, -7) && hat(zombie, 0, 1, -8), 'Zombie in 3×2 überall');
  assert.ok(hat(spinne, 0, 1, -7), 'Spinne in 3×2 in der Mitte');
  assert.equal(hat(spinne, 0, 1, -8), undefined, 'Spinne am Rand nicht');
  // Skelett wie Zombie
  const skelett = S.spawnstellen(w, b, { monster: 'minecraft:skeleton' });
  assert.deepEqual(skelett.map((x) => [x.x, x.y, x.z]), zombie.map((x) => [x.x, x.y, x.z]));
});

test('Spawn: unbekannte Böden und Blöcke geben „unklar“', () => {
  const w = raum(); w.setzeBlock(0, 0, 0, 'minecraft:glass'); w.setzeBlock(1, 0, 0, 'minecraft:oak_leaves'); w.setzeBlock(2, 0, 0, 'minecraft:soul_sand');
  w.setzeBlock(3, 0, 0, 'minecraft:oak_slab', { 'minecraft:vertical_half': 'top' });
  const s = S.spawnstellen(w, bereich(4));
  for (const x of [0, 1, 2, 3]) {
    assert.equal(hat(s, x, 1, 0)?.urteil, 'unklar', `Boden x=${x}`);
    assert.deepEqual(hat(s, x, 1, 0).gruende, ['boden']);
  }
  assert.equal(hat(s, 4, 1, 0).urteil, 'moeglich');
  // Lichtfilter unbekannt: getöntes Glas zwischen Fackel und Standort, sonst kein Weg → Blocklicht unklar
  const t = raum(); fackel(t, 0, 1, 0);
  for (let y = 1; y <= 5; y++) for (let z = -21; z <= 21; z++) t.setzeBlock(3, y, z, STEIN);
  t.setzeBlock(3, 1, 0, 'minecraft:tinted_glass');
  const st = S.spawnstellen(t, bereich(8));
  assert.equal(hat(st, 4, 1, 0)?.urteil, 'unklar');
  assert.deepEqual(hat(st, 4, 1, 0).gruende, ['blocklicht']);
  assert.equal(hat(st, 8, 1, 0)?.urteil, 'unklar', 'weiter dahinter: Maximum 6 → noch hell möglich');
  assert.equal(hat(st, 1, 1, 0), undefined, 'neben der Fackel sicher hell');
  // Kerze (Stärke 0–15): in der Nähe unklar
  const k = raum(); k.setzeBlock(0, 1, 0, 'minecraft:candle', {});
  const sk = S.spawnstellen(k, bereich(10));
  assert.equal(hat(sk, 0, 1, 1)?.urteil, 'unklar');
  assert.deepEqual(hat(sk, 0, 1, 1).gruende, ['blocklicht']);
  assert.equal(hat(sk, 8, 1, 7)?.urteil, 'moeglich', 'ab 15 Blöcken Abstand erreicht auch Stärke 15 nichts mehr');
  assert.equal(hat(sk, 8, 1, 6)?.urteil, 'unklar', 'bei Abstand 14 wäre noch Stärke 1 möglich');
  // Pflanze im Platzbedarf: Hitbox überlappt einen unbekannten Block
  const p = raum(); p.setzeBlock(0, 2, 0, 'minecraft:oak_sapling', {});
  const sp = S.spawnstellen(p, bereich(2));
  assert.deepEqual(hat(sp, 0, 1, 0)?.gruende, ['platz']);
});

test('Spawn: drehen mit dem Vermesser vertauscht sich mit der Spawn-Suche', () => {
  const w = raum(12); fackel(w, 3, 1, 1); w.setzeBlock(-2, 0, 2, 'minecraft:glass'); w.setzeBlock(1, 0, -3, 'minecraft:oak_fence');
  w.setzeBlock(4, 1, 4, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false, 'minecraft:corner': 'none' });
  const teil = w.ausschnitt({ x: -12, y: 0, z: -12 }, { x: 12, y: 6, z: 12 });
  const norm = S.spawnstellen(w, bereich(8));
  for (const viertel of [1, 2, 3]) {
    const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(teil, viertel));
    const dreh = ([x, z]) => { let a = x, b = z; for (let i = 0; i < viertel; i++) [a, b] = [-b, a]; return [a, b]; };
    const erwartet = norm.map((s) => { const [x, z] = dreh([s.x, s.z]); return { x, y: s.y, z, urteil: s.urteil, gruende: s.gruende }; }).sort((p, q) => p.y - q.y || p.z - q.z || p.x - q.x);
    assert.deepEqual(S.spawnstellen(g, bereich(8)), erwartet, `um ${viertel} Vierteldrehungen`);
  }
});

test('Prüfer: Spawn möglich in Innenräumen', () => {
  const w = raum();
  const m = (o) => e1.pruefe(w, { schienen: null, ...o }).filter((x) => x.regel === 'pruefer.spawn-moeglich');
  assert.deepEqual(m({}), [], 'ohne Bereich keine Prüfung');
  const dunkel = m({ spawnBereich: bereich(3) });
  assert.equal(dunkel.length, 49);
  assert.ok(dunkel.every((x) => x.schwere === 'verstoss' && x.ort.y === 1));
  assert.match(dunkel[0].meldung, /Monster spawnen/);
  // Fackeln alle 12 Blöcke: dann ist der Bereich sicher
  const hell = raum(8);
  for (const [x, z] of [[-6, -6], [-6, 6], [6, -6], [6, 6], [0, 0]]) fackel(hell, x, 1, z);
  const mh = e1.pruefe(hell, { schienen: null, spawnBereich: bereich(8) }).filter((x) => x.regel === 'pruefer.spawn-moeglich');
  assert.deepEqual(mh.filter((x) => x.schwere === 'verstoss'), [], 'überall Blocklicht ≥ 1');
  // Glasboden: Hinweis statt Verstoß
  const g = raum(); g.setzeBlock(0, 0, 0, 'minecraft:glass');
  const mg = e1.pruefe(g, { schienen: null, spawnBereich: bereich(1) }).filter((x) => x.regel === 'pruefer.spawn-moeglich');
  assert.equal(mg.find((x) => x.ort.x === 0 && x.ort.z === 0).schwere, 'hinweis');
  // Tag draußen: nichts
  const frei = e0.neueWelt(); for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) frei.setzeBlock(x, 0, z, STEIN);
  assert.deepEqual(e1.pruefe(frei, { schienen: null, spawnBereich: bereich(3), himmel: 'tag' }).filter((x) => x.regel === 'pruefer.spawn-moeglich'), []);
  assert.equal(e1.pruefe(frei, { schienen: null, spawnBereich: bereich(3), himmel: 'nacht' }).filter((x) => x.regel === 'pruefer.spawn-moeglich').length, 49);
});

test('Spawn: Fuß-Zelle ist dreiwertig (Luft, Pflanze, Teppich, Unbekanntes)', () => {
  const fuss = (id, zustand = {}) => {
    const w = raum(); w.setzeBlock(0, 1, 0, id, zustand);
    return hat(S.spawnstellen(w, bereich(2)), 0, 1, 0);
  };
  assert.equal(fuss('minecraft:short_grass')?.urteil, 'moeglich', 'Gras in der Fuß-Zelle');
  assert.equal(fuss('minecraft:poppy')?.urteil, 'moeglich', 'Blume in der Fuß-Zelle');
  for (const [id, zustand] of [['minecraft:rail', { rail_direction: 0 }], ['minecraft:stone_pressure_plate', {}], ['minecraft:oak_sapling', {}]]) {
    const s = fuss(id, zustand);
    assert.equal(s?.urteil, 'unklar', `${id}: nicht eingeordnet → unklar, nicht still weggelassen`);
    assert.ok(s.gruende.includes('fuesse'), id);
  }
  assert.equal(fuss('minecraft:white_carpet'), undefined, 'Teppich blockiert den Spawn');
  assert.equal(fuss('minecraft:stone'), undefined, 'fester Block in der Fuß-Zelle');
  assert.equal(S.fuesse(raum(), 0, 1, 0), 'ja');
});

test('Spawn: Himmelslicht genau 7 ist unklar', () => {
  const w = e0.neueWelt();
  for (let x = -30; x <= 30; x++) for (let z = -30; z <= 30; z++) { w.setzeBlock(x, 0, z, STEIN); if (x !== 0 || z !== 0) w.setzeBlock(x, 5, z, STEIN); }
  const b = { von: { x: 0, y: 1, z: 0 }, bis: { x: 9, y: 1, z: 0 } };
  // Rohlicht an der Stelle x: 15 − x (unter dem Dach, seitlich von der Öffnung bei x = 0)
  const regen = S.spawnstellen(w, b, { himmel: 'regen' }); // inneres Himmelslicht = Rohlicht − 3
  assert.equal(hat(regen, 3, 1, 0), undefined, 'Rohlicht 12 → innen 9: sicher nein');
  assert.equal(hat(regen, 4, 1, 0), undefined, 'Rohlicht 11 → innen 8: sicher nein (ab 8)');
  assert.equal(hat(regen, 5, 1, 0)?.urteil, 'unklar', 'Rohlicht 10 → innen genau 7: unklar');
  assert.deepEqual(hat(regen, 5, 1, 0).gruende, ['himmel']);
  assert.equal(hat(regen, 6, 1, 0)?.urteil, 'moeglich', 'Rohlicht 9 → innen 6: sicher ja');
  const gewitter = S.spawnstellen(w, b, { himmel: 'gewitter' }); // Rohlicht − 5
  assert.equal(hat(gewitter, 5, 1, 0)?.urteil, 'moeglich', 'Rohlicht 10 → innen 5');
  assert.equal(hat(gewitter, 3, 1, 0)?.urteil, 'unklar', 'Rohlicht 12 → innen genau 7');
  assert.equal(S.spawnstellen(w, b, { himmel: 'tag' }).find((s) => s.x === 5), undefined, 'Tag: Rohlicht 10 bleibt 10 → nein');
});
