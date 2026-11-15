// D2.2 Qualitätsnachweis: Vorher-Nachher mit den D1-Metriken. Rohr (form.zylinder, bisheriger Turm) gegen Rezept (`rezept: "turm"`), gleiche Außenmaße und Stimmung.
// Die Golden-Datei (rezepte-vergleich.json) wird nur mit BLOCKWERK_VERGLEICH_NEU=1 neu geschrieben, sonst vergleicht der Test exakt.
// Der Test erzwingt echte Verbesserung der Gestalt, nicht nur Mehrverbrauch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { messeGestaltung, bloeckeAusEntwurf } from '../../src/ebene3/index.js';
import { engine } from '../ebene5/hilfe5.js';

const spec = (b, t, h, rezept) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D2', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 },
  teile: [{
    id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss',
    form: rezept ? { groesse: { breite: b, tiefe: t, hoehe: h } } : { baustein: 'form.zylinder', groesse: { breite: b, tiefe: t, hoehe: h } },
    ...(rezept ? { rezept: 'turm' } : {}),
    lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' },
  }],
});
/** Die für den Vergleich nötigen Kennzahlen (nicht die ganze Messung: die Schichtliste bleibt weg). */
const kennzahlen = (m) => ({
  aussenmass: [m.maße.breite, m.maße.tiefe, m.maße.hoehe],
  bloecke: m.maße.anzahlBloecke,
  materialien: m.materialien,
  verschiedeneQuerschnitte: m.silhouette.verschiedeneQuerschnitte,
  gleichDarunter: m.silhouette.gleichDarunter,
  groessteAenderung: m.silhouette.groessteAenderung,
  glatteFlaecheMax: m.glatteFlaeche.max,
  oeffnungen: m.oeffnungen,
  hatDach: m.abschluss.hatDach,
  hatBoden: m.abschluss.hatBoden,
});
async function miss(b, t, h, rezept) {
  const e = await engine();
  const r = e.ebene4.baue(e.ebene4.freigeben(spec(b, t, h, rezept), 'test'));
  assert.equal(r.status, 'fertig', JSON.stringify(r.rueckfragen ?? ''));
  return kennzahlen(messeGestaltung(bloeckeAusEntwurf(e.ebene3, r.entwurf)));
}

const FAELLE = [[13, 13, 34], [21, 17, 45], [9, 9, 20]];
// Blockzuwachs höchstens +60 %: Sockel, Absatz und Krone mit Überstand sowie das Dach brauchen mehr Blöcke als ein glattes Rohr;
// gemessen liegt er bei den Fällen darunter (Zahlen im Golden). Der Schwellwert ist die Grenze „Gestalt kostet Material, aber nicht das Doppelte“.
const MAX_ZUWACHS = 1.6;

test('Vorher-Nachher: Rezept-Turm ist echt besser als das Rohr (Dach, Gliederung, keine glatte Wand) bei gleichem Außenmaß und begrenztem Mehrverbrauch', async () => {
  const gemessen = {};
  for (const [b, t, h] of FAELLE) {
    const rohr = await miss(b, t, h, false), rezept = await miss(b, t, h, true);
    const name = `${b}x${t}x${h}`;
    gemessen[name] = { rohr, rezept };
    assert.deepEqual(rohr.aussenmass, [b, t, h], `${name}: Rohr hat das Außenmaß`);
    assert.deepEqual(rezept.aussenmass, [b, t, h], `${name}: Rezept hat exakt das Außenmaß`);
    assert.equal(rohr.hatDach, false, `${name}: das Rohr hat kein Dach`);
    assert.equal(rezept.hatDach, true, `${name}: das Rezept hat ein Dach`);
    assert.equal(rohr.verschiedeneQuerschnitte, 1);
    assert.ok(rezept.verschiedeneQuerschnitte > rohr.verschiedeneQuerschnitte, `${name}: mehr verschiedene Querschnitte (${rezept.verschiedeneQuerschnitte})`);
    assert.ok(rezept.gleichDarunter < 0.9, `${name}: Silhouette gliedert sich, gleichDarunter ${rezept.gleichDarunter} deutlich unter 1`);
    assert.ok(rezept.glatteFlaecheMax.groesse < rohr.glatteFlaecheMax.groesse, `${name}: größte glatte Fläche kleiner (${rezept.glatteFlaecheMax.groesse} < ${rohr.glatteFlaecheMax.groesse})`);
    assert.ok(rezept.bloecke <= rohr.bloecke * MAX_ZUWACHS, `${name}: Blockzuwachs ${rezept.bloecke} gegen ${rohr.bloecke} (${Math.round((rezept.bloecke / rohr.bloecke - 1) * 100)} %)`);
    assert.ok(rezept.materialien.anzahlVerschieden >= rohr.materialien.anzahlVerschieden, `${name}: mindestens so viele Materialien`);
  }
  const datei = new URL('./rezepte-vergleich.json', import.meta.url);
  if (process.env.BLOCKWERK_VERGLEICH_NEU === '1') writeFileSync(datei, `${JSON.stringify(gemessen, null, 1)}\n`);
  assert.deepEqual(JSON.parse(JSON.stringify(gemessen)), JSON.parse(readFileSync(datei, 'utf8')));
});
