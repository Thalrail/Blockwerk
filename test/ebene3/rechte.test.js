import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { neuerEntwurf, entwurfZuJson, RechtFehler } from '../../src/ebene3/index.js';

const e3 = ebene3();
const F = e3.fachleute;

const aendere = (e, wer, a) => e3.aendere(e, wer, a).entwurf;
const code = (fn) => { try { fn(); } catch (f) { assert.ok(f instanceof RechtFehler, String(f)); return f.code; } return null; };

function grund() {
  return aendere(neuerEntwurf({ name: 'Probe' }), 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Halle', reihenfolge: 1 } });
}
const teil = (baustein, extra = {}) => ({ art: 'setze-teil', teil: { abschnitt: 'A1', baustein, parameter: {}, lage: { x: 0, y: 0, z: 0, drehung: 0 }, ...extra } });

test('Rechte: Besitz, Rangfolge und Fixierung', () => {
  // Rangfolge: Techniker > Grobdesigner > Architekt > Konstrukteur > Designer; der Bauleiter steht außerhalb, Jonahs Fixierung darüber
  assert.deepEqual(F.reihenfolge, ['techniker', 'grobdesigner', 'architekt', 'konstrukteur', 'designer']);
  const r = F.reihenfolge.map((f) => F.rang(f));
  assert.deepEqual(r, [0, 1, 2, 3, 4]);
  assert.ok(F.hoeher('techniker', 'designer') && F.hoeher('architekt', 'konstrukteur') && !F.hoeher('designer', 'architekt') && !F.hoeher('architekt', 'architekt'));
  assert.equal(F.rang('bauleiter'), Infinity);
  assert.equal(F.rang('jonah'), -1);

  // Besitz: jeder ändert nur seinen eigenen Teil
  let e = grund();
  assert.equal(code(() => e3.aendere(e, 'architekt', { art: 'setze-abschnitt', abschnitt: { id: 'A2', name: 'x', reihenfolge: 2 } })), 'fremd');
  assert.equal(code(() => e3.aendere(e, 'designer', { art: 'setze-zone', zone: { id: 'Z1', von: { x: 0, y: 0, z: 0 }, bis: { x: 1, y: 1, z: 1 } } })), 'fremd');
  assert.equal(code(() => e3.aendere(e, 'architekt', { art: 'setze-palette', palette: { wand: 'minecraft:stone' } })), 'fremd');
  assert.equal(code(() => e3.aendere(e, 'architekt', teil('tech.antriebsstrecke'))), 'fremd', 'Technikteile gehören dem Techniker');
  assert.equal(code(() => e3.aendere(e, 'techniker', teil('form.zylinder'))), 'fremd', 'Formen gehören dem Architekten');
  assert.equal(code(() => e3.aendere(e, 'techniker', teil('bau.gang'))), 'fremd', 'Bauelemente gehören dem Architekten');
  assert.equal(code(() => e3.aendere(e, 'architekt', teil('bau.gang', { verbindung: true }))), 'fremd', 'Verbindungen gehören dem Konstrukteur');
  assert.equal(code(() => e3.aendere(e, 'bauleiter', teil('form.zylinder'))), 'fremd', 'der Bauleiter ändert nie selbst');
  assert.equal(code(() => e3.aendere(e, 'jemand', teil('form.zylinder'))), 'fremd');
  e = aendere(e, 'techniker', teil('tech.antriebsstrecke'));
  e = aendere(e, 'architekt', teil('form.zylinder'));
  e = aendere(e, 'konstrukteur', teil('bau.gang', { verbindung: true }));
  e = aendere(e, 'grobdesigner', { art: 'setze-zone', zone: { id: 'Z1', abschnitt: 'A1', von: { x: -9, y: 0, z: -9 }, bis: { x: 9, y: 9, z: 9 } } });
  e = aendere(e, 'techniker', { art: 'setze-sperrzone', sperrzone: { id: 'S1', von: { x: 0, y: 0, z: 0 }, bis: { x: 1, y: 1, z: 1 }, verbot: 'alles' } });
  e = aendere(e, 'designer', { art: 'setze-palette', palette: { wand: 'minecraft:stone_bricks' } });
  e = aendere(e, 'konstrukteur', { art: 'setze-pruefung', pruefung: { id: 'P1', art: 'begehbar', start: { x: 0, y: 0, z: 0 }, ziele: [] } });
  assert.deepEqual(e.teile.map((t) => [t.id, t.art, t.gesetztVon]), [['T1', 'technik', 'techniker'], ['T2', 'form', 'architekt'], ['T3', 'verbindung', 'konstrukteur']]);
  // fremde Änderungen an vorhandenen Teilen
  assert.equal(code(() => e3.aendere(e, 'architekt', { art: 'aendere-teil', id: 'T1', felder: { lage: { x: 5 } } })), 'fremd');
  assert.equal(code(() => e3.aendere(e, 'architekt', { art: 'entferne-teil', id: 'T3' })), 'fremd');
  assert.equal(code(() => e3.aendere(e, 'techniker', { art: 'setze-teil', teil: { id: 'T2', abschnitt: 'A1', baustein: 'tech.kurve' } })), 'fremd', 'ein Teil lässt sich nicht in die Art eines anderen umwidmen');

  // Ungültiges
  assert.equal(code(() => e3.aendere(e, 'architekt', teil('form.zylinder', { abschnitt: 'A9' }))), 'ungueltig');
  assert.equal(code(() => e3.aendere(e, 'architekt', teil('zauber.kugel'))), 'ungueltig');
  assert.equal(code(() => e3.aendere(e, 'architekt', teil('form.zylinder', { lage: { x: 1.5, y: 0, z: 0, drehung: 0 } }))), 'ungueltig');
  assert.equal(code(() => e3.aendere(e, 'architekt', teil('form.zylinder', { lage: { x: 0, y: 0, z: 0, drehung: 4 } }))), 'ungueltig');
  assert.equal(code(() => e3.aendere(e, 'architekt', { art: 'aendere-teil', id: 'T9', felder: {} })), 'ungueltig');
  assert.equal(code(() => e3.aendere(e, 'architekt', { art: 'aendere-teil', id: 'T2', felder: { baustein: 'form.kugel' } })), 'ungueltig', 'der Baustein eines Teils ist nicht änderbar');
  assert.equal(code(() => e3.aendere(e, 'techniker', { art: 'setze-sperrzone', sperrzone: { id: 'S2', von: { x: 0, y: 0, z: 0 }, bis: { x: 1, y: 1, z: 1 }, verbot: 'nie' } })), 'ungueltig');
  assert.equal(code(() => e3.aendere(e, 'architekt', { art: 'tue-etwas' })), 'ungueltig');

  // Eigene Änderungen sind erlaubt, das Original bleibt unverändert
  const vorher = entwurfZuJson(e);
  const e2 = aendere(e, 'architekt', { art: 'aendere-teil', id: 'T2', felder: { lage: { x: 7, drehung: 2 }, parameter: { breite: 11 } } });
  assert.deepEqual([e2.teile[1].lage, e2.teile[1].parameter], [{ x: 7, y: 0, z: 0, drehung: 2 }, { breite: 11 }]);
  assert.equal(entwurfZuJson(e), vorher);
  e = aendere(e2, 'architekt', { art: 'entferne-teil', id: 'T2' });
  assert.deepEqual(e.teile.map((t) => t.id), ['T1', 'T3']);

  // Sperren: wer ein Feld festgelegt hat, steht in `sperren`; ein Höherrangiger sperrt es für den Besitzer (hier: manuell gesetzt wie durch den Bauleiter)
  const gesperrt = structuredClone(e);
  gesperrt.sperren.push({ ziel: 'teil:T3', von: 'techniker', rang: 0 });
  assert.equal(code(() => e3.aendere(gesperrt, 'konstrukteur', { art: 'aendere-teil', id: 'T3', felder: { lage: { x: 1 } } })), 'gesperrt');
  const gleichrangig = structuredClone(e);
  gleichrangig.sperren = [{ ziel: 'teil:T3', von: 'designer', rang: 4 }];
  assert.doesNotThrow(() => e3.aendere(gleichrangig, 'konstrukteur', { art: 'aendere-teil', id: 'T3', felder: { lage: { x: 1 } } }), 'ein Niederrangiger sperrt nicht');

  // Fixierung durch Jonah steht über allem
  const fix = e3.fixiere(e, 'teil:T3', 'Lage nach Absprache festgelegt');
  assert.equal(fix.eintrag.art, 'fixierung');
  assert.equal(code(() => e3.aendere(fix.entwurf, 'konstrukteur', { art: 'aendere-teil', id: 'T3', felder: { lage: { x: 1 } } })), 'gesperrt');
  assert.equal(code(() => e3.aendere(fix.entwurf, 'konstrukteur', { art: 'entferne-teil', id: 'T3' })), 'gesperrt');
  assert.equal(fix.entwurf.sperren.find((s) => s.ziel === 'teil:T3').von, 'jonah');
  assert.equal(entwurfZuJson(e), vorher.replace(/x/g, 'x') && entwurfZuJson(e), 'Original unverändert');

  // Berichtseintrag zu jeder Änderung; die letzte Änderung hat den Besitzer in `sperren`
  assert.ok(e.bericht.every((b) => b.art === 'aenderung'));
  assert.equal(e.bericht.length, 10);
  assert.ok(e.sperren.some((s) => s.ziel === 'teil:T1' && s.von === 'techniker' && s.rang === 0));
});
