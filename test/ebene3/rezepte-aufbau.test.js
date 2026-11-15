// Paket 1a, Teil 2: Aufbau des Rezept-Turms über die echte Pipeline (Spezifikation → baue → bloeckeAusEntwurf) und die Messgröße `messeAufbau`.
// Acht feste Größen: keine unverbundenen Teile, Hilfspunkte (Annahme `ungeprüft`, Regel der Messgröße: Block an die Fläche eines gesetzten Blocks) und Überhang als Golden,
// Blockzuwachs gegen das Rohr gleicher Hüllmaße, Dach hoch genug. Golden nur mit BLOCKWERK_AUFBAU_NEU=1 neu schreiben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { bloeckeAusEntwurf, messeAufbau } from '../../src/ebene3/index.js';
import { engine } from '../ebene5/hilfe5.js';

const REIHE = [[9, 9, 16], [11, 11, 24], [13, 13, 34], [17, 17, 40], [21, 15, 45], [21, 21, 56], [31, 31, 60], [45, 45, 80]];
const MAX_HILFSPUNKTE = 0; // gemessen: alle acht Größen ohne Hilfspunkt; ein Wert über 0 braucht eine bewusste Anhebung hier und einen Begründungstext im Golden
const MAX_ZUWACHS = 0.8; // höchstens +80 % Blöcke gegenüber dem Rohr (gemessen höchstens +69 % bei 45×45×80: die Auflage macht die Ringe der großen Türme dicker)
const DACH_ANTEIL = [0.25, 0.4]; // Dachhöhe als Anteil der Gesamthöhe (gemessen 29 bis 38 %)

const spec = (b, t, h, rezept) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm Aufbau', bauplatz: { breite: 140, hoehe: 140, tiefe: 140 }, massstab: 1 },
  teile: [{
    id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss',
    form: rezept ? { groesse: { breite: b, tiefe: t, hoehe: h } } : { baustein: 'form.zylinder', groesse: { breite: b, tiefe: t, hoehe: h } },
    ...(rezept ? { rezept: 'turm' } : {}),
    lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' },
  }],
});

test('Rezept-Turm: Aufbau über acht Größen (verbunden, Hilfspunkte, Blockzuwachs, Dachhöhe) gegen das Golden', async () => {
  const e = await engine();
  const gemessen = {};
  for (const [b, t, h] of REIHE) {
    const name = `${b}x${t}x${h}`;
    const baue = (rezept) => { const r = e.ebene4.baue(e.ebene4.freigeben(spec(b, t, h, rezept), 'test')); assert.equal(r.status, 'fertig', name); return r.entwurf; };
    const entwurf = baue(true);
    const bl = bloeckeAusEntwurf(e.ebene3, entwurf);
    const rohr = bloeckeAusEntwurf(e.ebene3, baue(false)).length;
    const m = messeAufbau(bl);
    const dach = entwurf.teile.find((x) => String(x.ref).endsWith('.dach')).parameter.hoehe;
    const ext = (k) => Math.max(...bl.map((c) => c[k])) - Math.min(...bl.map((c) => c[k])) + 1;
    assert.deepEqual([ext('x'), ext('z'), ext('y')], [b, t, h], `${name}: Außenmaß exakt`);
    assert.equal(m.unverbunden.teile, 0, `${name}: keine unverbundenen Teile`);
    assert.ok(m.hilfsmassnahmen.punkte <= MAX_HILFSPUNKTE, `${name}: ${m.hilfsmassnahmen.punkte} Hilfspunkte (Obergrenze ${MAX_HILFSPUNKTE})`);
    const zuwachs = bl.length / rohr - 1;
    assert.ok(zuwachs <= MAX_ZUWACHS, `${name}: Blockzuwachs ${Math.round(zuwachs * 100)} % (${bl.length} gegen ${rohr})`);
    assert.ok(dach / h >= DACH_ANTEIL[0] && dach / h <= DACH_ANTEIL[1], `${name}: Dach ${dach} von ${h} Schichten`);
    gemessen[name] = { bloecke: bl.length, rohr, hilfspunkte: m.hilfsmassnahmen.punkte, ueberhangBloecke: m.ueberhang.bloecke, dachHoehe: dach };
  }
  const datei = new URL('./rezepte-aufbau.json', import.meta.url);
  if (process.env.BLOCKWERK_AUFBAU_NEU === '1') writeFileSync(datei, `${JSON.stringify(gemessen, null, 1)}\n`);
  const golden = JSON.parse(readFileSync(datei, 'utf8'));
  for (const [name, w] of Object.entries(golden)) if (w.hilfspunkte > 0) assert.ok(typeof w.begruendung === 'string' && w.begruendung.length > 10, `${name}: Hilfspunkte über 0 brauchen eine Begründung im Golden`);
  const ohneText = Object.fromEntries(Object.entries(golden).map(([n, w]) => { const { begruendung, ...rest } = w; return [n, rest]; }));
  assert.deepEqual(JSON.parse(JSON.stringify(gemessen)), ohneText);
});
