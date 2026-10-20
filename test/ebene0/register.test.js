import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ebene0 } from '../hilfe.js';
import { Blockregister, LUFT } from '../../src/ebene0/blockregister.js';
import { Wesenregister } from '../../src/ebene0/wesenregister.js';

const { register } = ebene0();
const lies = (n) => JSON.parse(readFileSync(new URL(`../../data/${n}`, import.meta.url), 'utf8'));

// ---------- Blockregister ----------
test('Datenstand ist Bedrock 1.26.50', () => {
  assert.match(register.bloecke.datenstand, /^1\.26\.50(\.\d+)?$/);
  assert.match(register.wesen.datenstand, /^1\.26\.50(\.\d+)?$/);
});

test('Register enthÃ¤lt Luft, Stein, Trichter, Treppe, Schiene, TÃ¼r', () => {
  for (const id of [LUFT, 'minecraft:stone', 'minecraft:hopper', 'minecraft:oak_stairs', 'minecraft:rail', 'minecraft:acacia_door', 'minecraft:chest']) {
    assert.ok(register.bloecke.hat(id), id);
  }
  assert.ok(register.bloecke.ids().length > 1000);
});

test('Jeder Block: Zustandsnamen existieren, Werte sind nicht leer und vom gemeldeten Typ', () => {
  for (const id of register.bloecke.ids()) {
    const b = register.bloecke.block(id);
    assert.match(id, /^minecraft:[a-z0-9_]+$/);
    for (const [name, art] of Object.entries(b.zustaende)) {
      assert.ok(art.werte.length > 0, `${id}.${name}`);
      const typ = art.typ === 'int' ? 'number' : art.typ === 'bool' ? 'boolean' : 'string';
      assert.ok(art.werte.every((w) => typeof w === typ), `${id}.${name} Typ ${art.typ}`);
      assert.equal(new Set(art.werte).size, art.werte.length, `${id}.${name} doppelte Werte`);
    }
  }
});

test('Jeder Block hat alle sechs Eigenschaften mit gÃ¼ltigem Typ', () => {
  for (const id of register.bloecke.ids()) {
    const e = register.bloecke.block(id).eigenschaften;
    assert.ok([true, false, null].includes(e.vollblock), id);
    assert.ok([true, false, null].includes(e.durchsichtig), id);
    assert.ok(e.licht === null || (Number.isInteger(e.licht) && e.licht >= 0 && e.licht <= 15), id);
    assert.ok(e.lichtfilter === null || (Number.isInteger(e.lichtfilter) && e.lichtfilter >= 0 && e.lichtfilter <= 15), id);
    for (const k of ['faellt', 'brauchtHalt', 'arbeitsblock']) assert.equal(typeof e[k], 'boolean', `${id}.${k}`);
  }
});

test('Bekannte Eigenschaften (Stichproben aus den Wiki-Angaben)', () => {
  const e = (id) => register.bloecke.block(id).eigenschaften;
  assert.equal(e('minecraft:stone').vollblock, true);
  assert.equal(e('minecraft:oak_stairs').vollblock, false);
  assert.equal(e('minecraft:glass').durchsichtig, true);
  assert.equal(e('minecraft:glass_pane').vollblock, false);
  assert.equal(e('minecraft:torch').licht, 14);
  assert.equal(e('minecraft:torch').brauchtHalt, true);
  assert.equal(e('minecraft:glowstone').licht, 15);
  assert.equal(e('minecraft:sand').faellt, true);
  assert.equal(e('minecraft:gravel').faellt, true);
  assert.equal(e('minecraft:white_concrete_powder').faellt, true);
  assert.equal(e('minecraft:stone').faellt, false);
  assert.equal(e('minecraft:rail').brauchtHalt, true);
  assert.equal(e('minecraft:lectern').arbeitsblock, true);
  assert.equal(e('minecraft:stone').arbeitsblock, false);
});

test('Kuratierte Angaben verweisen nur auf existierende BlÃ¶cke (kein Tippfehler)', () => {
  const k = lies('quellen/eigenschaften.json');
  for (const id of [...Object.keys(k.lichtstaerke), ...k.arbeitsbloecke, ...Object.keys(k.behaelter)]) {
    assert.ok(register.bloecke.hat(id), `kuratierter Block fehlt im Register: ${id}`);
  }
});

test('BehÃ¤lter: Trichter 5, Truhe 27, alle Shulkerkisten 27; Stein 0', () => {
  assert.equal(register.bloecke.slots('minecraft:hopper'), 5);
  assert.equal(register.bloecke.slots('minecraft:chest'), 27);
  assert.equal(register.bloecke.slots('minecraft:barrel'), 27);
  assert.equal(register.bloecke.slots('minecraft:light_blue_shulker_box'), 27);
  assert.equal(register.bloecke.slots('minecraft:stone'), 0);
  const shulker = register.bloecke.ids().filter((i) => i.endsWith('shulker_box'));
  assert.equal(shulker.length, 17);
  assert.equal(register.bloecke.slots('minecraft:copper_chest'), 27);
  assert.equal(register.bloecke.slots('minecraft:lit_furnace'), 3);
  for (const s of shulker) assert.equal(register.bloecke.slots(s), 27, s);
});

test('ZustandsprÃ¼fung: erlaubt, falscher Name, falscher Wert, falscher Typ', () => {
  const r = register.bloecke;
  assert.ok(r.zustandGueltig('minecraft:hopper', { facing_direction: 3 }));
  assert.ok(r.zustandGueltig('minecraft:hopper', {}));
  assert.ok(!r.zustandGueltig('minecraft:hopper', { facing_direction: 6 }));
  assert.ok(!r.zustandGueltig('minecraft:hopper', { facing_direction: '3' }));
  assert.ok(!r.zustandGueltig('minecraft:hopper', { open_bit: true }));
  assert.ok(!r.zustandGueltig('minecraft:stone', { facing_direction: 1 }));
  assert.throws(() => r.pruefeZustand('minecraft:gibtesnicht', {}), /Unbekannter Block/);
  assert.throws(() => r.block('__proto__'), /Unbekannter Block/);
});

test('UngÃ¼ltige Registerdaten werden abgelehnt', () => {
  assert.throws(() => new Blockregister(null));
  assert.throws(() => new Blockregister({ zustandsarten: {}, bloecke: { 'minecraft:x': { zustaende: ['a'], eigenschaften: {} } } }), /unbekannten Zustand/);
  assert.throws(() => new Blockregister({ zustandsarten: {}, bloecke: {} }), /Luft fehlt/);
});

// ---------- Wesenregister ----------
test('Wesenregister: Pflichtwesen vorhanden mit Hitbox', () => {
  const w = register.wesen;
  assert.deepEqual(w.hitbox('minecraft:player'), { breite: 0.6, hoehe: 1.8 });
  assert.deepEqual(w.hitbox('minecraft:villager_v2'), { breite: 0.6, hoehe: 1.9 });
  assert.deepEqual(w.hitbox('minecraft:item'), { breite: 0.25, hoehe: 0.25 });
  assert.deepEqual(w.hitbox('minecraft:minecart'), { breite: 0.98, hoehe: 0.7 });
});

test('Wesenregister: alle Loren (Minecarts) sind erfasst und haben eine Hitbox', () => {
  const lore = register.wesen.lore();
  for (const id of ['minecraft:minecart', 'minecraft:chest_minecart', 'minecraft:hopper_minecart', 'minecraft:tnt_minecart', 'minecraft:command_block_minecart']) {
    assert.ok(lore.includes(id), id);
  }
  for (const id of lore) assert.ok(register.wesen.hitbox(id), id);
});

test('Wesenregister: Baby-Hitbox des alten Dorfbewohners ist halb so groÃŸ', () => {
  assert.deepEqual(register.wesen.hitbox('minecraft:villager', { baby: true }), { breite: 0.3, hoehe: 0.95 });
  assert.ok(register.wesen.kannBaby('minecraft:villager_v2'));
  assert.ok(!register.wesen.kannBaby('minecraft:player'));
  assert.throws(() => register.wesen.hitbox('minecraft:player', { baby: true }));
  assert.throws(() => register.wesen.wesen('minecraft:gibtesnicht'), /Unbekanntes Wesen/);
});

test('Wesenregister: jede Hitbox ist positiv, jede Quelle benannt', () => {
  for (const id of register.wesen.ids()) {
    const h = register.wesen.hitbox(id);
    if (h) assert.ok(h.breite > 0 && h.hoehe > 0, id);
  }
  assert.throws(() => new Wesenregister({ wesen: {} }), /fehlt/);
});

test('GegenstÃ¤nde enthalten Diamant und Trichter, keine Duplikate', () => {
  const g = lies('gegenstaende.json').gegenstaende;
  assert.ok(g.includes('minecraft:diamond') && g.includes('minecraft:hopper'));
  assert.equal(new Set(g).size, g.length);
});
