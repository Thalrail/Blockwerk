import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICKS_PRO_SEKUNDE, TICKS_PRO_TAG, sekundenZuTicks, tickZuZeit, ticksZuSekunden } from '../../src/ebene1/weltzeit.js';

test('Ein Tag hat 24.000 Ticks (20 Ticks pro Sekunde)', () => {
  assert.equal(TICKS_PRO_SEKUNDE, 20);
  assert.equal(TICKS_PRO_TAG, 24000);
  assert.equal(TICKS_PRO_TAG / TICKS_PRO_SEKUNDE, 1200, 'ein Tag = 20 Minuten');
  assert.deepEqual(tickZuZeit(0), { tag: 0, tickImTag: 0, sekundenImTag: 0 });
  assert.deepEqual(tickZuZeit(23999), { tag: 0, tickImTag: 23999, sekundenImTag: 1199.95 });
  assert.deepEqual(tickZuZeit(24000), { tag: 1, tickImTag: 0, sekundenImTag: 0 });
  assert.deepEqual(tickZuZeit(24000 * 7 + 100), { tag: 7, tickImTag: 100, sekundenImTag: 5 });
});

test('Sekunden ↔ Ticks', () => {
  assert.equal(sekundenZuTicks(1), 20);
  assert.equal(sekundenZuTicks(0.05), 1);
  assert.equal(sekundenZuTicks(0.4), 8);
  assert.equal(ticksZuSekunden(8), 0.4);
});

test('Ungültige Eingaben werfen', () => {
  assert.throws(() => tickZuZeit(-1));
  assert.throws(() => tickZuZeit(1.5));
  assert.throws(() => sekundenZuTicks(-2));
  assert.throws(() => ticksZuSekunden(NaN));
});
