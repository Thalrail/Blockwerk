import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene0 } from '../hilfe.js';
import { ungedeckteRichtungszustaende } from '../../src/ebene0/vermesser.js';

const { vermesser: v, register, drehregeln } = ebene0();
const teil = (...bloecke) => ({ bloecke: bloecke.map(([x, y, z, id, zustand = {}]) => ({ x, y, z, id, zustand })), wesen: [] });
const z1 = (id, zustand, op, n = 1) => v.transformiereZustand(zustand, op, n);
const DREH = { typ: 'drehen' };
const sp = (achse) => ({ typ: 'spiegeln', achse });

test('Verschieben', () => {
  const r = v.verschiebe(teil([0, 0, 0, 'minecraft:stone'], [1, 2, 3, 'minecraft:dirt']), { x: 10, y: -1, z: 5 });
  assert.deepEqual(r.bloecke.map((b) => [b.x, b.y, b.z]), [[10, -1, 5], [11, 1, 8]]);
  assert.throws(() => v.verschiebe(teil(), { x: 1.5, y: 0, z: 0 }));
});

test('Drehen: Ost → Süd → West → Nord, Block 0,0,0 bleibt', () => {
  const t = teil([0, 0, 0, 'minecraft:stone'], [3, 1, 0, 'minecraft:dirt']);
  const pos = (n) => v.drehe(t, n).bloecke.map((b) => [b.x, b.y, b.z]);
  assert.deepEqual(pos(1), [[0, 0, 0], [0, 1, 3]], 'Ost → Süd (z positiv)');
  assert.deepEqual(pos(2), [[0, 0, 0], [-3, 1, 0]], 'West');
  assert.deepEqual(pos(3), [[0, 0, 0], [0, 1, -3]], 'Nord');
  assert.deepEqual(pos(4), pos(0));
  assert.deepEqual(pos(-1), pos(3));
});

test('Spiegeln x/z ändert die Position, zweimal = Identität', () => {
  const t = teil([2, 0, 3, 'minecraft:stone']);
  assert.deepEqual(v.spiegle(t, 'x').bloecke[0], { x: -2, y: 0, z: 3, id: 'minecraft:stone', zustand: {} });
  assert.deepEqual(v.spiegle(t, 'z').bloecke[0].z, -3);
  assert.deepEqual(v.spiegle(v.spiegle(t, 'x'), 'x'), t);
  assert.throws(() => v.spiegle(t, 'y'));
});

test('Trichter (facing_direction als Zahl): Drehen und Spiegeln', () => {
  // 2 = Nord, 3 = Süd, 4 = West, 5 = Ost, 0 = unten
  assert.deepEqual(z1('', { facing_direction: 2 }, DREH), { facing_direction: 5 });
  assert.deepEqual(z1('', { facing_direction: 5 }, DREH), { facing_direction: 3 });
  assert.deepEqual(z1('', { facing_direction: 3 }, DREH), { facing_direction: 4 });
  assert.deepEqual(z1('', { facing_direction: 4 }, DREH), { facing_direction: 2 });
  assert.deepEqual(z1('', { facing_direction: 0 }, DREH), { facing_direction: 0 }, 'unten bleibt unten');
  assert.deepEqual(z1('', { facing_direction: 5 }, sp('x')), { facing_direction: 4 });
  assert.deepEqual(z1('', { facing_direction: 2 }, sp('x')), { facing_direction: 2 });
  assert.deepEqual(z1('', { facing_direction: 2 }, sp('z')), { facing_direction: 3 });
});

test('Treppe: weirdo_direction dreht mit, Ecke und upside_down bleiben beim Drehen, Ecke wechselt beim Spiegeln', () => {
  assert.deepEqual(z1('', { weirdo_direction: 0, upside_down_bit: true }, DREH), { upside_down_bit: true, weirdo_direction: 2 }, 'Ost → Süd');
  assert.deepEqual(z1('', { weirdo_direction: 3 }, DREH), { weirdo_direction: 0 }, 'Nord → Ost');
  assert.deepEqual(z1('', { weirdo_direction: 0 }, sp('x')), { weirdo_direction: 1 });
  assert.deepEqual(z1('', { 'minecraft:corner': 'inner_left' }, DREH), { 'minecraft:corner': 'inner_left' });
  assert.deepEqual(z1('', { 'minecraft:corner': 'inner_left' }, sp('x')), { 'minecraft:corner': 'inner_right' });
  assert.deepEqual(z1('', { 'minecraft:corner': 'outer_right' }, sp('z')), { 'minecraft:corner': 'outer_left' });
  assert.deepEqual(z1('', { 'minecraft:corner': 'none' }, sp('x')), { 'minecraft:corner': 'none' });
});

test('Tür: Richtung dreht mit, Scharnier wechselt beim Spiegeln', () => {
  assert.deepEqual(z1('', { 'minecraft:cardinal_direction': 'north', door_hinge_bit: false }, DREH), { 'minecraft:cardinal_direction': 'east', door_hinge_bit: false });
  assert.deepEqual(z1('', { 'minecraft:cardinal_direction': 'north', door_hinge_bit: false }, sp('x')), { 'minecraft:cardinal_direction': 'north', door_hinge_bit: true });
  assert.deepEqual(z1('', { 'minecraft:cardinal_direction': 'east', open_bit: true }, sp('x')), { 'minecraft:cardinal_direction': 'west', open_bit: true });
});

test('Schiene: Nord-Süd ↔ Ost-West, Steigungen und Kurven', () => {
  const r = (w, op, n) => z1('', { rail_direction: w }, op, n).rail_direction;
  assert.equal(r(0, DREH), 1);
  assert.equal(r(1, DREH), 0);
  assert.equal(r(2, DREH), 5, 'ansteigend Ost → Süd');
  assert.equal(r(5, DREH), 3);
  assert.equal(r(3, DREH), 4);
  assert.equal(r(4, DREH), 2);
  assert.equal(r(6, DREH), 7, 'Süd-Ost → Süd-West');
  assert.equal(r(9, DREH), 6, 'Nord-Ost → Süd-Ost');
  assert.equal(r(2, sp('x')), 3);
  assert.equal(r(4, sp('z')), 5);
  assert.equal(r(6, sp('x')), 7);
  assert.equal(r(6, sp('z')), 9, 'Süd-Ost → Nord-Ost');
});

test('Schienen-Tabellen sind Permutationen (nichts geht verloren)', () => {
  const regel = drehregeln.zustaende.rail_direction;
  const permutation = (t) => assert.deepEqual(Object.values(t).map(Number).sort(), Array.from({ length: 10 }, (_, i) => i));
  permutation(regel.drehen);
  permutation(regel.spiegeln.x);
  permutation(regel.spiegeln.z);
});

test('Säulenachse (Baumstamm) vertauscht x/z beim Drehen, y bleibt', () => {
  assert.deepEqual(z1('', { pillar_axis: 'x' }, DREH), { pillar_axis: 'z' });
  assert.deepEqual(z1('', { pillar_axis: 'z' }, DREH), { pillar_axis: 'x' });
  assert.deepEqual(z1('', { pillar_axis: 'y' }, DREH), { pillar_axis: 'y' });
  assert.deepEqual(z1('', { pillar_axis: 'x' }, sp('x')), { pillar_axis: 'x' });
});

test('Fackel, Hebel, Schild (16 Richtungen), Mauer-Verbindungen, Ranken', () => {
  assert.deepEqual(z1('', { torch_facing_direction: 'west' }, DREH), { torch_facing_direction: 'north' });
  assert.deepEqual(z1('', { torch_facing_direction: 'top' }, DREH), { torch_facing_direction: 'top' });
  assert.deepEqual(z1('', { torch_facing_direction: 'unknown' }, DREH), { torch_facing_direction: 'unknown' });
  assert.deepEqual(z1('', { lever_direction: 'east' }, DREH), { lever_direction: 'south' });
  assert.deepEqual(z1('', { lever_direction: 'up_east_west' }, DREH), { lever_direction: 'up_north_south' });
  assert.deepEqual(z1('', { lever_direction: 'down_north_south' }, DREH), { lever_direction: 'down_east_west' });
  assert.deepEqual(z1('', { ground_sign_direction: 0 }, DREH), { ground_sign_direction: 4 }, 'Süd → West');
  assert.deepEqual(z1('', { ground_sign_direction: 12 }, DREH), { ground_sign_direction: 0 });
  assert.deepEqual(z1('', { ground_sign_direction: 4 }, sp('x')), { ground_sign_direction: 12 });
  assert.deepEqual(z1('', { ground_sign_direction: 0 }, sp('z')), { ground_sign_direction: 8 });
  assert.deepEqual(
    z1('', { wall_connection_type_north: 'tall', wall_connection_type_east: 'short' }, DREH),
    { wall_connection_type_east: 'tall', wall_connection_type_south: 'short' },
  );
  assert.deepEqual(z1('', { vine_direction_bits: 1 }, DREH), { vine_direction_bits: 2 }, 'Süd → West');
  assert.deepEqual(z1('', { vine_direction_bits: 1 | 8 }, DREH), { vine_direction_bits: 2 | 1 });
  assert.deepEqual(z1('', { orientation: 'down_east' }, DREH), { orientation: 'down_south' });
  assert.deepEqual(z1('', { orientation: 'west_up' }, sp('x')), { orientation: 'east_up' });
});

test('Eigenschaft: 4× Drehen = Identität für ALLE Zustandswerte aller Blöcke', () => {
  for (const id of register.bloecke.ids()) {
    const zustaende = register.bloecke.block(id).zustaende;
    for (const [name, art] of Object.entries(zustaende)) {
      for (const w of art.werte) {
        const z = { [name]: w };
        assert.deepEqual(v.transformiereZustand(z, DREH, 4), z, `${id}.${name}=${w} (4× drehen)`);
        for (const a of ['x', 'z']) assert.deepEqual(v.transformiereZustand(v.transformiereZustand(z, sp(a)), sp(a)), z, `${id}.${name}=${w} (2× spiegeln ${a})`);
      }
    }
  }
});

test('Eigenschaft: jedes Drehen/Spiegeln liefert wieder gültige Zustände (alle Blöcke, alle Werte)', () => {
  for (const id of register.bloecke.ids()) {
    const zustaende = register.bloecke.block(id).zustaende;
    for (const [name, art] of Object.entries(zustaende)) {
      for (const w of art.werte) {
        for (const op of [DREH, sp('x'), sp('z')]) {
          const neu = v.transformiereZustand({ [name]: w }, op);
          assert.ok(register.bloecke.zustandGueltig(id, neu), `${id}.${name}=${w} → ${JSON.stringify(neu)} ungültig`);
        }
      }
    }
  }
});

test('Eigenschaft: Drehen ist eine Bijektion auf den Werten jeder Zustandsart', () => {
  for (const name of Object.keys(drehregeln.zustaende)) {
    const werte = register.bloecke.zustandsart(name).werte;
    const bilder = werte.map((w) => v.transformiereZustand({ [name]: w }, DREH)[name]);
    assert.equal(new Set(bilder).size, werte.length, `${name}: Drehen ist nicht umkehrbar`);
  }
});

test('Alle Richtungs-/Achsen-Zustände des Registers sind durch eine Regel oder einen Vermerk gedeckt', () => {
  assert.deepEqual(ungedeckteRichtungszustaende(register.bloecke, drehregeln), []);
});

test('Bauteil drehen: Treppe, Trichter, Wesen (Position + Blickrichtung) zusammen', () => {
  const t = {
    bloecke: [
      { x: 2, y: 0, z: 0, id: 'minecraft:oak_stairs', zustand: { weirdo_direction: 0 } },
      { x: 0, y: 0, z: 1, id: 'minecraft:hopper', zustand: { facing_direction: 2 } },
    ],
    wesen: [{ id: 'minecraft:villager_v2', x: 2.5, y: 0, z: 0.5, yaw: 0, baby: false }],
  };
  const r = v.drehe(t, 1);
  assert.deepEqual(r.bloecke.find((b) => b.id.endsWith('stairs')), { x: 0, y: 0, z: 2, id: 'minecraft:oak_stairs', zustand: { weirdo_direction: 2 } });
  assert.equal(r.bloecke.find((b) => b.id.endsWith('hopper')).zustand.facing_direction, 5);
  assert.deepEqual(r.wesen[0], { id: 'minecraft:villager_v2', x: 0.5, y: 0, z: 2.5, yaw: 90, baby: false }, 'Block-Mitte bleibt Block-Mitte, Blick Süd → West');
  assert.deepEqual(v.drehe(t, 4), v.drehe(t, 0));
});

test('Wesen: Spiegeln hält die Blockmitte und spiegelt die Blickrichtung', () => {
  const t = { bloecke: [], wesen: [{ id: 'minecraft:player', x: 2.5, y: 0, z: 0.5, yaw: 90, baby: false }] };
  assert.deepEqual(v.spiegle(t, 'x').wesen[0], { id: 'minecraft:player', x: -1.5, y: 0, z: 0.5, yaw: 270, baby: false });
  assert.equal(v.spiegle(t, 'z').wesen[0].yaw, 90);
  assert.equal(v.spiegle(v.spiegle(t, 'x'), 'x').wesen[0].yaw, 90);
  assert.deepEqual(v.spiegle(v.spiegle(t, 'z'), 'z'), t);
});

test('Drehen ∘ Verschieben: erst drehen dann verschieben = erst verschieben (gedreht) dann drehen', () => {
  const t = teil([1, 0, 2, 'minecraft:hopper', { facing_direction: 4 }], [-3, 5, 1, 'minecraft:oak_stairs', { weirdo_direction: 1 }]);
  const d = { x: 4, y: 1, z: -2 };
  const gedrehtD = { x: -d.z, y: d.y, z: d.x };
  assert.deepEqual(v.verschiebe(v.drehe(t, 1), gedrehtD), v.drehe(v.verschiebe(t, d), 1));
});

test('Gedrehte Welt-Ausschnitte lassen sich in die Welt einsetzen (Gültigkeit bleibt erhalten)', () => {
  const e = ebene0();
  const w = e.neueWelt();
  w.setzeBlock(0, 0, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, 'minecraft:corner': 'inner_left' });
  w.setzeBlock(1, 0, 0, 'minecraft:hopper', { facing_direction: 5 }, [{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 1 }]);
  const gedreht = e.vermesser.drehe(w.ausschnitt({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 1);
  const ziel = e.neueWelt();
  ziel.fuegeBauteilEin(gedreht, { x: 10, y: 0, z: 10 });
  assert.equal(ziel.leseBlock(10, 0, 11).zustand.facing_direction, 3, 'Trichter zeigte nach Ost, jetzt nach Süd');
  assert.equal(ziel.leseInhalt(10, 0, 11).length, 1, 'Inhalt wandert mit');
});

test('Fehlender Richtungszustand: Drehen/Spiegeln wirft, statt still falsch zu sein', () => {
  const leereTreppe = teil([0, 0, 0, 'minecraft:oak_stairs', {}]);
  assert.throws(() => v.drehe(leereTreppe, 1), /weirdo_direction.*fehlt/);
  assert.throws(() => v.spiegle(leereTreppe, 'x'), /fehlt/);
  assert.throws(() => v.drehe(teil([0, 0, 0, 'minecraft:hopper', {}]), 1), /facing_direction.*fehlt/);
  assert.throws(() => v.drehe(teil([0, 0, 0, 'minecraft:oak_log', {}]), 1), /pillar_axis.*fehlt/);
  assert.throws(() => v.spiegle(teil([0, 0, 0, 'minecraft:oak_stairs', { weirdo_direction: 0, upside_down_bit: false }]), 'x'), /minecraft:corner.*fehlt/);
  // Drehen braucht die Ecke nicht, Spiegeln braucht die Achse nicht
  assert.doesNotThrow(() => v.drehe(teil([0, 0, 0, 'minecraft:oak_stairs', { weirdo_direction: 0 }]), 1));
  assert.doesNotThrow(() => v.spiegle(teil([0, 0, 0, 'minecraft:oak_log', {}]), 'x'));
  // Blöcke ohne Richtung brauchen nichts; Drehen um 0 Viertel ändert nichts und prüft nichts
  assert.doesNotThrow(() => v.drehe(teil([0, 0, 0, 'minecraft:stone', {}]), 1));
  assert.doesNotThrow(() => v.drehe(leereTreppe, 4));
});

test('Jede Drehregel nennt ihre Quelle, jeder Vermerk eine Begründung', () => {
  for (const [name, regel] of Object.entries(drehregeln.zustaende)) assert.ok(regel.quelle, `${name}: Quelle fehlt`);
  for (const [name, grund] of Object.entries(drehregeln.unbehandelt)) assert.ok(grund.length > 10, `${name}: Begründung fehlt`);
  assert.ok(!('direction' in drehregeln.zustaende), 'unbelegte Zuordnung darf nicht gedreht werden');
});

test('Jede Drehregel hat einen Status; „geprüft“ nur mit Datum und Beobachtung von Jonahs Spieltest', () => {
  const gepruefte = [];
  for (const [name, regel] of Object.entries(drehregeln.zustaende)) {
    assert.ok(['geprüft', 'ungeprüft'].includes(regel.status), `${name}: Status fehlt oder ungültig`);
    if (regel.status === 'geprüft') {
      gepruefte.push(name);
      assert.match(regel.geprueftAm, /^\d{4}-\d{2}-\d{2}$/, `${name}: Datum fehlt`);
      assert.ok(regel.beobachtung?.length > 10, `${name}: Beobachtung fehlt`);
    }
  }
  // Stand der Spieltests vom 20.10.2026 (Jonah): Test 1, 2, 4 (wiederholt), 5, 7, 8 bestätigt; Test 3 nicht aussagekräftig
  assert.deepEqual(gepruefte.sort(), [
    'door_hinge_bit', 'facing_direction', 'minecraft:cardinal_direction', 'multi_face_direction_bits', 'rail_direction', 'torch_facing_direction', 'weirdo_direction',
  ]);
  assert.equal(drehregeln.zustaende['minecraft:corner'].status, 'ungeprüft');
});

test('Fackel: Wert = Seite des Nachbarblocks, an dem sie hängt (Spieltest 7) – dreht mit', () => {
  // Fackel hängt an einem Block im Westen; nach einer Vierteldrehung liegt dieser Block im Norden
  assert.deepEqual(z1('', { torch_facing_direction: 'west' }, DREH), { torch_facing_direction: 'north' });
  assert.deepEqual(z1('', { torch_facing_direction: 'east' }, sp('x')), { torch_facing_direction: 'west' });
});

test('Glow-Lichen-Bits (Wiki: 1 unten, 2 oben, 4 Süd, 8 West, 16 Nord, 32 Ost) und Wand-Koralle', () => {
  assert.deepEqual(z1('', { multi_face_direction_bits: 4 }, DREH), { multi_face_direction_bits: 8 }, 'Süd → West');
  assert.deepEqual(z1('', { multi_face_direction_bits: 1 | 2 | 32 }, DREH), { multi_face_direction_bits: 1 | 2 | 4 }, 'Ost → Süd, oben/unten bleiben');
  assert.deepEqual(z1('', { multi_face_direction_bits: 16 }, sp('z')), { multi_face_direction_bits: 4 }, 'Nord ↔ Süd');
  assert.deepEqual(z1('', { coral_direction: 0 }, DREH), { coral_direction: 2 }, 'West → Nord');
  assert.deepEqual(z1('', { coral_direction: 3 }, sp('x')), { coral_direction: 3 }, 'Süd bleibt beim Spiegeln an x');
});
