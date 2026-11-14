// U2 (Review): der Merker für die Zellenwahl gehört dem neuesten Auftrag, unabhängig von der `lauf`-Nummer des Aufrufers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erzeugeEntwurfsspeicher } from '../../src/ebene5/entwurfsspeicher.js';

test('Entwurfsspeicher: nur der neueste Auftrag darf setzen; ein langsamer, überholter Auftrag ändert nichts (auch ohne eindeutige Auftragsnummer)', () => {
  const s = erzeugeEntwurfsspeicher();
  assert.equal(s.hole(), null, 'zu Beginn gibt es keinen Entwurf');
  const alt = s.beginne(), neu = s.beginne(); // zwei Aufträge, der zweite überholt den ersten
  assert.notEqual(alt, neu);
  assert.equal(s.hole(), null, 'bis zum fertigen Plan des neuesten Auftrags gibt es keinen');
  assert.equal(s.setze(neu, { entwurf: 'neu' }), true);
  assert.equal(s.setze(alt, { entwurf: 'alt' }), false, 'der langsame ältere Auftrag kommt zuletzt und wird abgewiesen');
  assert.deepEqual(s.hole(), { entwurf: 'neu' });
  // ein neuer Start verwirft den bisherigen Entwurf sofort
  const dritter = s.beginne();
  assert.equal(s.hole(), null);
  assert.equal(s.setze(neu, { entwurf: 'zu spät' }), false);
  assert.equal(s.setze(dritter, { entwurf: 'dritter' }), true);
  assert.deepEqual(s.hole(), { entwurf: 'dritter' });
  // zwei Speicher beeinflussen sich nicht
  const t = erzeugeEntwurfsspeicher();
  assert.equal(t.setze(1, { x: 1 }), false, 'ohne beginne() ist keine Erzeugung gültig... (Zähler steht bei 0)');
  assert.equal(t.beginne(), 1);
  assert.equal(t.setze(1, { x: 1 }), true);
  assert.deepEqual(s.hole(), { entwurf: 'dritter' });
});

test('Entwurfsspeicher (U3): die letzten fertigen Entwürfe bleiben unter ihrer Erzeugung abrufbar; ein älterer, nicht mehr gezeigter fällt heraus', () => {
  const s = erzeugeEntwurfsspeicher();
  const g = [];
  for (let i = 1; i <= 5; i++) { g.push(s.beginne()); assert.equal(s.setze(g[i - 1], { i }), true); }
  assert.deepEqual(s.hole(g[4]), { i: 5 });
  assert.deepEqual(s.hole(g[3]), { i: 4 });
  assert.deepEqual(s.hole(g[2]), { i: 3 }, 'drei bleiben erhalten: angezeigt, wartend, neu');
  assert.equal(s.hole(g[1]), null, 'der vierte zurück ist weg');
  assert.equal(s.hole(999), null);
  assert.deepEqual(s.hole(), { i: 5 }, 'ohne Angabe der neueste');
  // ein neuer Start lässt den „neuesten“ leer, die fertigen bleiben abrufbar (die Seite zeigt noch den alten Plan)
  const n = s.beginne();
  assert.equal(s.hole(), null);
  assert.deepEqual(s.hole(g[4]), { i: 5 });
  assert.equal(s.setze(g[4], { i: 'zu spät' }), false, 'ein überholter Auftrag überschreibt nie');
  assert.deepEqual(s.hole(g[4]), { i: 5 });
  s.setze(n, { i: 6 });
  assert.deepEqual(s.hole(n), { i: 6 });
});
