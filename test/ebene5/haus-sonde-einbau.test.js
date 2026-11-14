// Haus-Sonde, Einbau-Architektur Paket P6: Teile in Bauteilen (innen, wand, wand-…) im Wohnhaus.
// Die Treppe im Haus, eine Trennwand mit Tür sowie Haustür und Fenster als Teile in den Außenwänden planen ohne Rückfrage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation, laufe, luftZugang, innenpunkt } from '../../tools/haus-sonde.js';

const ARTEN = ['spieler', 'dorfbewohner', 'baby'];

async function umgebung() {
  const e = await engine();
  const { erzeugeEbene5 } = await import('../../src/ebene5/index.js');
  const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen: null });
  return { e, e5 };
}

/** Stehplatz neben einer Blockzelle der Treppe (Boden darunter, Luft für Füße und Kopf), nicht auf der Treppe selbst. */
function standort(mat, zellen, y) {
  const frei = (x, z) => !mat.welt.istLuft(x, y - 1, z) && mat.welt.istLuft(x, y, z) && mat.welt.istLuft(x, y + 1, z) && !zellen.has(`${x},${y - 1},${z}`);
  for (const c of [...zellen].sort()) {
    const [x, , z] = c.split(',').map(Number);
    for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (frei(x + dx, z + dz)) return { x: x + dx, y, z: z + dz };
  }
  return null;
}

test('Haus-Sonde (P6): die Treppe im Haus ist ein Teil im Erdgeschoss, die Planung läuft ohne Rückfrage, in allen Größen kommt man vom Erdgeschoss ins Obergeschoss', async () => {
  const { e, e5 } = await umgebung();
  const B = e.ebene1.bewegung;
  for (const [name, v] of Object.entries(VARIANTEN)) {
    const r = await laufe(hausSpezifikation(v, { tuer: true, fenster: true, treppe: true }), e, e5);
    assert.equal(r.status, 'fertig', `${name}: ${JSON.stringify(r.rueckfragenBau)}`);
    assert.deepEqual(r.einwaende, [], name);
    const treppe = r.entwurf.teile.find((t) => t.ref === 'treppe');
    assert.ok(treppe, `${name}: die Treppe ist ein Teil`);
    assert.equal(treppe.abschnitt, 'erdgeschoss', `${name}: das Kind erbt den Abschnitt des Trägers`);
    assert.equal(treppe.traeger, 'erdgeschoss');
    assert.deepEqual(r.entwurf.abschnitte.map((a) => a.id).sort(), ['dach', 'erdgeschoss', 'obergeschoss'], `${name}: kein eigener Abschnitt für die Treppe`);
    // Zusammenbau: der Weg führt von unten über die Treppe und den Durchbruch in der Decke ins Obergeschoss
    const mat = e.ebene3.materialisiere(r.entwurf);
    const zellen = mat.teile.get(treppe.id).schluessel;
    const ys = [...zellen].map((c) => Number(c.split(',')[1]));
    const unten = new Set([...zellen].filter((c) => Number(c.split(',')[1]) === Math.min(...ys)));
    const oben = new Set([...zellen].filter((c) => Number(c.split(',')[1]) === Math.max(...ys)));
    const von = standort(mat, unten, Math.min(...ys)), nach = standort(mat, oben, Math.max(...ys) + 1);
    assert.ok(von && nach, `${name}: Start und Ziel gefunden`);
    for (const art of ARTEN) {
      const w = B.weg(mat.welt, von, nach, art, { radius: 40 });
      assert.equal(w.ok, true, `${name}, ${art}: ${w.grund}`);
    }
    // das Haus bleibt von außen dicht (trotz Durchbruch in der Decke)
    const p = innenpunkt(r.entwurf);
    assert.equal(luftZugang(r.plan, [p[0], p[1], p[2]]).vonAussenErreichbar, false, `${name}: Erdgeschoss dicht`);
  }
});

test('Haus-Sonde (P6): Trennwand mit Innentür sowie Haustür und Fenster als Teile in den Wänden planen ohne Rückfrage; die Tür verbindet die Räume, ohne Tür hält die Wand', async () => {
  const { e, e5 } = await umgebung();
  const B = e.ebene1.bewegung;
  const mitWand = () => hausSpezifikation(VARIANTEN.klein, { trennwand: true, tuerInWand: true, fensterTeil: true });
  const r = await laufe(mitWand(), e, e5);
  assert.equal(r.status, 'fertig', JSON.stringify(r.rueckfragenBau));
  assert.deepEqual(r.einwaende, []);
  const kinder = ['trennwand', 'innentuer', 'haustuer', 'fenster'];
  for (const ref of kinder) assert.ok(r.entwurf.teile.some((t) => t.ref === ref), ref);
  assert.ok(r.entwurf.teile.filter((t) => kinder.includes(t.ref)).every((t) => t.abschnitt === 'erdgeschoss'), 'alle Kinder liegen im Abschnitt des Erdgeschosses');
  assert.equal(r.entwurf.teile.find((t) => t.ref === 'innentuer').traeger, 'trennwand', 'Kette Haus → Trennwand → Tür');
  assert.ok(r.plan.abschnitte.flatMap((a) => a.legende.map((l) => l.id)).some((i) => /pane/.test(i)), 'Fensterscheiben im Plan');
  const mat = e.ebene3.materialisiere(r.entwurf);
  const idOf = (ref) => r.entwurf.teile.find((t) => t.ref === ref).id;
  const zellenVon = (ref) => [...mat.teile.get(idOf(ref)).schluessel].map((c) => c.split(',').map(Number));
  const tuer = zellenVon('innentuer').sort((a, b) => a[1] - b[1])[0];
  const wand = zellenVon('trennwand');
  assert.equal(new Set(wand.map((c) => c[2])).size, 1, 'die Trennwand liegt in einer Reihe');
  const zw = wand[0][2];
  const hin = { x: tuer[0], y: tuer[1], z: zw - 1 }, her = { x: tuer[0], y: tuer[1], z: zw + 1 };
  for (const art of ARTEN) assert.equal(B.weg(mat.welt, hin, her, art, { radius: 12 }).ok, true, `${art}: durch die Innentür`);
  // ohne Tür hält die Wand (sie reicht über die ganze Breite des Raums)
  const s = mitWand();
  s.teile = s.teile.filter((t) => t.id !== 'innentuer');
  const ohne = await laufe(s, e, e5);
  assert.equal(ohne.status, 'fertig');
  const mat2 = e.ebene3.materialisiere(ohne.entwurf);
  for (const art of ARTEN) assert.equal(B.weg(mat2.welt, hin, her, art, { radius: 12 }).ok, false, `${art}: die Wand ohne Tür hält`);
  // Haustür: von außen in den Raum (draußen ein Stück Boden, der Zusammenbau liefert nur das Bauwerk); das Haus bleibt dicht
  const ht = zellenVon('haustuer').sort((a, b) => a[1] - b[1])[0];
  for (let dx = -3; dx <= 3; dx++) for (let dz = 1; dz <= 4; dz++) mat.welt.setzeBlock(ht[0] + dx, ht[1] - 1, ht[2] + dz, 'minecraft:stone');
  for (const art of ARTEN) assert.equal(B.weg(mat.welt, { x: ht[0], y: ht[1], z: ht[2] + 1 }, { x: ht[0], y: ht[1], z: ht[2] - 1 }, art, { radius: 12 }).ok, true, `${art}: durch die Haustür`);
  const p = innenpunkt(r.entwurf);
  assert.equal(luftZugang(r.plan, [p[0], p[1], p[2]]).vonAussenErreichbar, false, 'Haus dicht');
});

test('Haus-Sonde (P6): ändert sich ein Maß, entsteht mit Treppe, Trennwand und Türen über die neue Version derselbe Plan wie in einem frischen Lauf', async () => {
  const { e, e5 } = await umgebung();
  // zwei Kombinationen: die Treppe liegt in der Nordwestecke und die Trennwand würde sie kreuzen (das meldet die Planung als Einwand), darum getrennt
  for (const [mit, erwartet] of [[{ tuer: true, fenster: true, treppe: true, tuerInWand: true, fensterTeil: true }, ['fenster', 'haustuer', 'treppe']], [{ trennwand: true, tuerInWand: true, fensterTeil: true }, ['fenster', 'haustuer', 'innentuer', 'trennwand']]]) {
    const alt = e.ebene4.baue(e.ebene4.freigeben(hausSpezifikation(VARIANTEN.mittel, mit), 'sonde'));
    assert.equal(alt.status, 'fertig', JSON.stringify(alt.rueckfragen));
    const neu = hausSpezifikation(VARIANTEN.gross, mit);
    neu.version = 2;
    const u = e.ebene4.aktualisiereBau(alt.entwurf, e.ebene4.freigeben(neu, 'sonde'));
    assert.equal(u.status, 'fertig', JSON.stringify(u.rueckfragen));
    const frisch = await laufe(hausSpezifikation(VARIANTEN.gross, mit), e, e5);
    assert.equal(frisch.status, 'fertig', JSON.stringify(frisch.rueckfragenBau));
    const abd = (p) => p.abschnitte.map((a) => a.schichten.map((s) => s.abdruck));
    assert.deepEqual(abd(e5.bauplan(u.entwurf)), abd(frisch.plan), JSON.stringify(mit));
    assert.deepEqual(u.entwurf.teile.map((t) => t.ref).filter((x) => ['treppe', 'trennwand', 'innentuer', 'haustuer', 'fenster'].includes(x)).sort(), erwartet, 'jedes Kind genau einmal');
  }
});

test('Haus-Sonde (P6): Änderungen nur an den Kindern (Versatz, Kind entfernen) bei gleichen Hausmaßen ergeben denselben Plan wie ein frischer Lauf, entfernte Kinder bleiben nicht im Entwurf', async () => {
  const { e, e5 } = await umgebung();
  const abd = (p) => p.abschnitte.map((a) => a.schichten.map((s) => s.abdruck));
  const basis = () => hausSpezifikation(VARIANTEN.mittel, { trennwand: true, tuerInWand: true, fensterTeil: true });
  let aktuell = e.ebene4.baue(e.ebene4.freigeben(basis(), 'sonde'));
  assert.equal(aktuell.status, 'fertig');
  const schritte = [
    ['Versatz der Trennwand', (s) => { s.teile.find((t) => t.id === 'trennwand').lage.versatz = { sued: 3 }; }, ['fenster', 'haustuer', 'innentuer', 'trennwand']],
    ['Innentür entfernt', (s) => { s.teile = s.teile.filter((t) => t.id !== 'innentuer'); }, ['fenster', 'haustuer', 'trennwand']],
    ['ganze Trennwandkette entfernt', (s) => { s.teile = s.teile.filter((t) => t.id !== 'trennwand'); }, ['fenster', 'haustuer']],
  ];
  let spez = basis();
  for (const [name, aendere, erwartet] of schritte) {
    aendere(spez);
    spez.version += 1;
    const u = e.ebene4.aktualisiereBau(aktuell.entwurf, e.ebene4.freigeben(spez, 'sonde'));
    assert.equal(u.status, 'fertig', `${name}: ${JSON.stringify(u.rueckfragen)}`);
    const frisch = await laufe(structuredClone(spez), e, e5);
    assert.equal(frisch.status, 'fertig', name);
    assert.deepEqual(abd(e5.bauplan(u.entwurf)), abd(frisch.plan), name);
    assert.deepEqual(u.entwurf.teile.map((t) => t.ref).filter((x) => ['trennwand', 'innentuer', 'haustuer', 'fenster'].includes(x)).sort(), erwartet, `${name}: Kinder im Entwurf`);
    aktuell = { entwurf: u.entwurf };
  }
});
