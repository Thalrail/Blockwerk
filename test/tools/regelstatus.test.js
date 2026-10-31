// Regressionstest zu Befund #1 (Codex-Review 30.10.2026): Der Status heißt „geprüft“ (Umlaut), der Zähler im Prüfbericht hieß `geprueft`;
// geprüfte Regeln landeten unter einem zweiten Schlüssel, der Bericht zeigte „0 im Spiel geprüft“.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zaehleStatus } from '../../tools/regelstatus.js';
import { ebene1 } from '../hilfe.js';

test('Statuszählung: „geprüft“ (Umlaut) wird unter geprueft gezählt, kein zweiter Schlüssel', () => {
  const z = zaehleStatus([
    { status: 'geprüft', ungeprueft: false }, { status: 'geprüft', ungeprueft: false },
    { status: 'simuliert', ungeprueft: true }, { status: 'entworfen', ungeprueft: false },
  ]);
  assert.deepEqual(z, { simuliert: 1, entworfen: 1, geprueft: 2, ungeprueft: 1, gesamt: 4 });
  assert.deepEqual(Object.keys(z).sort(), ['entworfen', 'geprueft', 'gesamt', 'simuliert', 'ungeprueft']);
});

test('Statuszählung: leere Regelliste ergibt überall 0', () => {
  assert.deepEqual(zaehleStatus([]), { simuliert: 0, entworfen: 0, geprueft: 0, ungeprueft: 0, gesamt: 0 });
});

test('Statuszählung: unbekannter Status wird abgelehnt statt still neu gezählt', () => {
  assert.throws(() => zaehleStatus([{ status: 'geprueft', ungeprueft: false }]), /Unbekannter Regelstatus/);
});

test('Statuszählung am echten Regelwerk: Summe stimmt, alle geprüften Regeln werden gezählt', () => {
  const regeln = ebene1().regelwerk.alle();
  const z = zaehleStatus(regeln);
  const echt = regeln.filter((r) => r.status === 'geprüft').length;
  assert.ok(echt > 0, 'das Regelwerk enthält von Jonah geprüfte Regeln');
  assert.equal(z.geprueft, echt);
  assert.equal(z.gesamt, regeln.length);
  assert.equal(z.simuliert + z.entworfen + z.geprueft, regeln.length);
});
