import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_GROESSE, GEGENRICHTUNG, HORIZONTAL, RICHTUNGEN, VEKTOR, chunkVon, dreheRichtung, spiegleRichtung, yawZuRichtung,
} from '../../src/ebene0/richtungen.js';

test('Konvention: x = Ost, z = Süd, y = oben', () => {
  assert.deepEqual(VEKTOR.east, { x: 1, y: 0, z: 0 });
  assert.deepEqual(VEKTOR.south, { x: 0, y: 0, z: 1 });
  assert.deepEqual(VEKTOR.north, { x: 0, y: 0, z: -1 });
  assert.deepEqual(VEKTOR.up, { x: 0, y: 1, z: 0 });
});

test('Gegenrichtung ist symmetrisch und hebt den Vektor auf', () => {
  for (const r of RICHTUNGEN) {
    assert.equal(GEGENRICHTUNG[GEGENRICHTUNG[r]], r);
    const a = VEKTOR[r], b = VEKTOR[GEGENRICHTUNG[r]];
    assert.deepEqual({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }, { x: 0, y: 0, z: 0 });
  }
});

test('Drehen im Uhrzeigersinn: Nord → Ost → Süd → West', () => {
  assert.equal(dreheRichtung('north'), 'east');
  assert.equal(dreheRichtung('east'), 'south');
  assert.equal(dreheRichtung('south'), 'west');
  assert.equal(dreheRichtung('west'), 'north');
});

test('Vier Vierteldrehungen = Identität, negative und große Werte', () => {
  for (const r of RICHTUNGEN) {
    assert.equal(dreheRichtung(r, 4), r);
    assert.equal(dreheRichtung(r, -1), dreheRichtung(r, 3));
    assert.equal(dreheRichtung(r, 401), dreheRichtung(r, 1));
  }
});

test('oben/unten bleiben beim Drehen und Spiegeln', () => {
  for (const r of ['up', 'down']) {
    assert.equal(dreheRichtung(r, 1), r);
    assert.equal(spiegleRichtung(r, 'x'), r);
    assert.equal(spiegleRichtung(r, 'z'), r);
  }
});

test('Spiegeln: x vertauscht Ost/West, z vertauscht Nord/Süd, zweimal = Identität', () => {
  assert.equal(spiegleRichtung('east', 'x'), 'west');
  assert.equal(spiegleRichtung('north', 'x'), 'north');
  assert.equal(spiegleRichtung('north', 'z'), 'south');
  assert.equal(spiegleRichtung('east', 'z'), 'east');
  for (const r of RICHTUNGEN) for (const a of ['x', 'z']) assert.equal(spiegleRichtung(spiegleRichtung(r, a), a), r);
});

test('Ungültige Eingaben werfen', () => {
  assert.throws(() => dreheRichtung('norden'));
  assert.throws(() => dreheRichtung('north', 1.5));
  assert.throws(() => spiegleRichtung('north', 'y'));
});

test('Horizontale Richtungen sind im Uhrzeigersinn geordnet', () => {
  assert.deepEqual([...HORIZONTAL], ['north', 'east', 'south', 'west']);
});

test('Chunk-Zuordnung auch für negative Koordinaten', () => {
  assert.deepEqual(chunkVon(0, 0), { cx: 0, cz: 0, lx: 0, lz: 0 });
  assert.deepEqual(chunkVon(15, 15), { cx: 0, cz: 0, lx: 15, lz: 15 });
  assert.deepEqual(chunkVon(16, -1), { cx: 1, cz: -1, lx: 0, lz: 15 });
  assert.deepEqual(chunkVon(-1, -16), { cx: -1, cz: -1, lx: 15, lz: 0 });
  assert.deepEqual(chunkVon(-17, 32), { cx: -2, cz: 2, lx: 15, lz: 0 });
  assert.equal(CHUNK_GROESSE, 16);
});

test('Blickrichtung wie Bedrock: 0 Süd, 90 West, 180 Nord, 270 Ost', () => {
  assert.equal(yawZuRichtung(0), 'south');
  assert.equal(yawZuRichtung(90), 'west');
  assert.equal(yawZuRichtung(-90), 'east');
  assert.equal(yawZuRichtung(450), 'west');
  assert.equal(yawZuRichtung(45), null);
});
