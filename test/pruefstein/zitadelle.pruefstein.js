// Prüfstein: die ganze Zitadelle (Stufe 1) durch die Planung. Dauert einige Minuten und gehört deshalb nicht zu `npm test`: `npm run test:pruefstein`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from '../ebene5/hilfe5.js';

test('Zitadelle: die Planung läuft durch, hat die erwarteten Schaltungsanfragen und braucht weniger als 6 Minuten', { timeout: 900_000 }, async () => {
  const e = await engine();
  const spec = e.ebene4.freigeben(await holeJson('data/beispiele/zitadelle.json'), 'pruefstein');
  const t = Date.now();
  const r = e.ebene4.baue(spec);
  const sekunden = (Date.now() - t) / 1000;
  assert.equal(r.status, 'fertig', JSON.stringify(r.rueckfragen?.slice(0, 3)));
  assert.equal(r.entwurf.abschnitte.length, 20);
  assert.deepEqual(r.rueckfragen, []);
  assert.deepEqual(r.offeneAnfragen.map((a) => a.art).sort(), ['aufzug', 'bahnhof', 'bruteranlage', 'entladestelle', 'felder', 'lorenbahn-netz', 'sammelbecken', 'wasserrueckfuehrung', 'wohnbereich']);
  assert.equal(r.entwurf.einwaende.filter((w) => w.schwere === 'verstoss' && w.status === 'offen').length, 0);
  const plan = e.e5.bauplan(r.entwurf);
  assert.ok(plan.bloecke > 50_000 && plan.bloecke < 200_000, `Blockzahl ${plan.bloecke}`);
  assert.ok(sekunden < 360, `Planung dauerte ${sekunden.toFixed(0)} s`);
  console.log(`Zitadelle: ${plan.bloecke} Blöcke, Planung ${sekunden.toFixed(0)} s`);
});
