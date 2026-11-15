// D2.2: manuelle Einzelblockänderungen an Gliedern eines Rezept-Teils (Kennung `<teil>.<glied>`, Zellen im Koordinatensystem des Glieds) bleiben bei erneuter Planung
// mit unveränderter Spezifikation wirksam; fällt die Zelle bei anderen Maßen weg, wird sie als verwaist gemeldet (nie still verworfen). Muster: aenderungen-im-plan.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';

const spec = (b, t, h) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D2', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', form: { groesse: { breite: b, tiefe: t, hoehe: h } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }],
});
const pf = (teil, zelle, id) => PF.wende(PF.leer(), [{ teil, zelle, erwartet: null, neu: { op: 'setze', block: { id } } }], 'Jonah').planfassung;
const aus = async (s, planfassung) => {
  const e = await engine();
  const r = bauePlan(e, e.ebene4.freigeben(s, 'test'), [], planfassung);
  return { e, r, plan: e.e5.bauplan(r.entwurf) };
};
/** Eine Randzelle des Glieds (größtes x, dann z) im Koordinatensystem der Hülle des Glieds (Nullpunkt = Ecke der Hülle). */
const randzelle = (e, r, ref) => {
  const t = r.entwurf.teile.find((x) => x.ref === ref);
  const bl = e.ebene2.baue(t.baustein, t.parameter).bloecke;
  const von = { x: Math.min(...bl.map((b) => b.x)), y: Math.min(...bl.map((b) => b.y)), z: Math.min(...bl.map((b) => b.z)) };
  const b = bl.filter((c) => c.y === von.y).sort((p, q) => q.x - p.x || p.z - q.z)[0];
  return { x: b.x - von.x, y: b.y - von.y, z: b.z - von.z };
};
const GLAS = 'minecraft:glass';

for (const glied of ['krone', 'schaft-unten']) {
  test(`Änderung am Glied ${glied}: bleibt bei erneuter Planung mit unveränderter Spezifikation wirksam und unverändert`, async () => {
    const ohne = await aus(spec(13, 13, 34));
    const teil = `turm.${glied}`, zelle = randzelle(ohne.e, ohne.r, teil);
    const mit = await aus(spec(13, 13, 34), pf(teil, zelle, GLAS));
    assert.equal(mit.r.status, 'fertig');
    const a = mit.plan.aenderungen;
    assert.equal(a.length, 1);
    assert.deepEqual([a[0].teil, a[0].status, a[0].block.id, a[0].zugelassen], [teil, 'angewandt', GLAS, false]);
    assert.equal(mit.plan.bloecke, ohne.plan.bloecke, 'ein Block ersetzt, die Gesamtzahl bleibt');
    assert.equal((mit.plan.summe[GLAS] ?? 0) - (ohne.plan.summe[GLAS] ?? 0), 1);
    // erneute Planung (frisch, gleiche Eingaben): derselbe Plan
    const nochmal = await aus(spec(13, 13, 34), pf(teil, zelle, GLAS));
    assert.deepEqual(nochmal.plan, mit.plan);
  });
}

test('Ändert sich die Größe so, dass die Zelle nicht mehr existiert, wird die Änderung als verwaist gemeldet: die Planung wartet, nichts wird still verworfen', async () => {
  const ohne = await aus(spec(21, 21, 40));
  const zelle = randzelle(ohne.e, ohne.r, 'turm.krone'); // Rand der Krone bei Breite 21
  const gleich = await aus(spec(21, 21, 40), pf('turm.krone', zelle, GLAS));
  assert.equal(gleich.plan.aenderungen[0].status, 'angewandt');
  const klein = await aus(spec(9, 9, 20), pf('turm.krone', zelle, GLAS));
  assert.equal(klein.r.status, 'wartet');
  const v = klein.plan.aenderungen[0];
  assert.equal(v.status, 'verwaist');
  assert.equal(v.teil, 'turm.krone');
  assert.deepEqual(v.zelle, zelle, 'die Änderung bleibt mit ihrer Zelle gespeichert');
  assert.ok(v.rueckfrage.optionen.some((o) => o.id === 'verwerfen'), 'Jonah entscheidet: verwerfen, verankern oder zulassen');
  assert.equal(klein.r.rueckfragen.filter((q) => q.art === 'aenderung').length, 1);
});
