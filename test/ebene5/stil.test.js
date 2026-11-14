// U4: Stil und Materialien bearbeiten – reines Modul src/ebene5/stil.js (Spezifikationsweg), mit der echten Engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as M from '../../src/ebene5/stil.js';

const haus = (mit = {}) => { const s = hausSpezifikation(VARIANTEN.klein, mit); for (const t of s.teile) delete t.stil; return s; };
const quellen = (e) => ({ ebene0: e.ebene0, paletten: e.ebene3.paletten });

test('Ebenen: das Projekt und jedes Teil mit eigenem Abschnitt, Kindteile (Tür, Fenster, Treppe im Haus) nicht', async () => {
  const e = await engine();
  const info = M.stilInfo({ paletten: e.ebene3.paletten, vokabular: e.ebene4.vokabular });
  const s = haus({ treppe: 1, tuerInWand: 1, fensterTeil: 1 });
  const liste = M.ebenen(s, info.kindrelationen);
  assert.deepEqual(liste.map((x) => x.id), ['projekt', 'erdgeschoss', 'obergeschoss', 'dach']);
  assert.equal(liste[0].name, 'Ganzes Projekt');
  assert.ok(M.ebenen(s, []).length > liste.length, 'ohne Kenntnis der Beziehungen würden Kindteile mitgezählt');
});

test('Stilinfo: Stimmungen, Rollen und die Formen je Rolle kommen aus den Daten des Designers', async () => {
  const e = await engine();
  const info = M.stilInfo({ paletten: e.ebene3.paletten, vokabular: e.ebene4.vokabular });
  assert.deepEqual(info.stimmungen, ['dunkel-industriell', 'glanz', 'hell-nordisch']);
  assert.deepEqual(info.rollen, ['wand', 'akzent', 'boden', 'licht', 'glas']);
  assert.deepEqual(info.rollenFormen.wand, ['voll']);
  assert.deepEqual(info.rollenFormen.akzent, ['voll', 'treppe', 'tuer']);
  assert.deepEqual(info.rollenFormen.glas, ['voll', 'scheibe']);
  assert.ok(info.kindrelationen.includes('innen'));
});

test('Stimmung und Materialwahl setzen und wegnehmen: Kopie, andere Formen bleiben, Leeres verschwindet', () => {
  const s = haus();
  const vorher = JSON.stringify(s);
  let n = M.setzeStimmung(s, 'projekt', 'glanz', ['glanz', 'hell-nordisch']);
  assert.equal(JSON.stringify(s), vorher, 'die Eingabe bleibt unverändert');
  assert.deepEqual(M.stilVon(n, 'projekt'), { stimmung: 'glanz', palette: {} });
  n = M.setzeMaterial(n, 'projekt', 'wand', 'voll', { id: 'minecraft:stone_bricks' });
  assert.equal(n.projekt.stil.palette.wand, 'minecraft:stone_bricks', 'ein Block ohne Zustand steht als Text');
  n = M.setzeMaterial(n, 'erdgeschoss', 'akzent', 'treppe', { id: 'minecraft:stone_brick_stairs' });
  assert.deepEqual(n.teile[0].stil.palette.akzent, { treppe: 'minecraft:stone_brick_stairs' });
  n = M.setzeMaterial(n, 'erdgeschoss', 'akzent', 'voll', { id: 'minecraft:oak_log', zustand: { pillar_axis: 'y' } });
  assert.deepEqual(n.teile[0].stil.palette.akzent, { treppe: 'minecraft:stone_brick_stairs', voll: { id: 'minecraft:oak_log', zustand: { pillar_axis: 'y' } } }, 'zwei Formen, die Treppe blieb');
  assert.deepEqual(M.wahlFuer(n, 'erdgeschoss', 'akzent', 'voll'), { id: 'minecraft:oak_log', zustand: { pillar_axis: 'y' } });
  assert.deepEqual(M.wahlFuer(n, 'erdgeschoss', 'akzent', 'treppe'), { id: 'minecraft:stone_brick_stairs' });
  assert.equal(M.wahlFuer(n, 'erdgeschoss', 'wand', 'voll'), null);
  // eine Form weg: die andere bleibt; alles weg: Rolle, Palette und Stil verschwinden
  n = M.setzeMaterial(n, 'erdgeschoss', 'akzent', 'voll', null);
  assert.deepEqual(n.teile[0].stil.palette.akzent, 'minecraft:stone_brick_stairs'.length ? { treppe: 'minecraft:stone_brick_stairs' } : null);
  n = M.setzeMaterial(n, 'erdgeschoss', 'akzent', 'treppe', null);
  assert.equal('stil' in n.teile[0], false, 'leerer Stil wird entfernt');
  n = M.setzeMaterial(n, 'projekt', 'wand', 'voll', null);
  assert.deepEqual(n.projekt.stil, { stimmung: 'glanz' }, 'die Stimmung bleibt');
  n = M.setzeStimmung(n, 'projekt', null);
  assert.equal('stil' in n.projekt, false);
  assert.deepEqual(n, s, 'alles zurück: die Spezifikation ist wieder die ursprüngliche');
  // Fehler
  assert.throws(() => M.setzeStimmung(s, 'projekt', 'gibtsnicht', ['glanz']), /gibt es nicht/);
  assert.throws(() => M.setzeMaterial(s, 'projekt', 'dach', 'voll', { id: 'minecraft:stone' }, { rollen: ['wand'] }), /Rolle/);
  assert.throws(() => M.setzeMaterial(s, 'projekt', 'wand', 'rund', { id: 'minecraft:stone' }, { formen: ['voll'] }), /Form/);
  assert.throws(() => M.setzeMaterial(s, 'projekt', 'wand', 'voll', {}), /Kennung/);
  assert.throws(() => M.setzeMaterial(s, 'gibtsnicht', 'wand', 'voll', { id: 'minecraft:stone' }), /gibt es nicht/);
});

test('Auswahlliste: nur, was die Palettenregeln annehmen (Form, Licht, kein Arbeitsblock, Zustand für Säulen), je Rolle und Form', async () => {
  const e = await engine();
  const q = quellen(e);
  const ids = (text, rolle, form, grenze) => M.materialSuche(q, text, rolle, form, grenze).treffer.map((t) => t.id);
  assert.ok(ids('stairs', 'akzent', 'treppe', 1000).length > 20 && ids('stairs', 'akzent', 'treppe', 1000).every((id) => id.endsWith('_stairs')), 'Treppen nur für die Form treppe');
  assert.equal(ids('stairs', 'wand', 'voll', 1000).length, 0, 'Treppen sind kein Vollblock');
  assert.ok(ids('door', 'akzent', 'tuer', 1000).every((id) => id.endsWith('_door')) && ids('door', 'akzent', 'tuer', 1000).length > 3);
  assert.ok(ids('glowstone', 'licht', 'voll').includes('minecraft:glowstone'));
  assert.equal(ids('stone_bricks', 'licht', 'voll').length, 0, 'Licht muss leuchten');
  assert.equal(ids('barrel', 'wand', 'voll').length, 0, 'ein Arbeitsblock ist als Material verboten');
  assert.ok(ids('oak_log', 'wand', 'voll').includes('minecraft:oak_log'), 'Säulen werden angeboten (mit Achse als Zustand)');
  assert.ok(ids('glass_pane', 'glas', 'scheibe', 1000).every((id) => id.endsWith('_pane')));
  assert.equal(ids('air', 'wand', 'voll', 1000).includes('minecraft:air'), false);
  const knapp = M.materialSuche(q, 'stone', 'wand', 'voll', 3);
  assert.equal(knapp.treffer.length, 3);
  assert.equal(knapp.mehr, true, 'es gibt mehr als angezeigt');
  assert.equal(M.materialSuche(q, 'gibtsnicht', 'wand', 'voll').mehr, false);
  assert.deepEqual(M.materialSuche(q, '', 'wand', 'voll').treffer, []);
});

test('Ring mit dem Prüfer: jeder angebotene Block wird vom Prüfer der Spezifikation angenommen; die neue Spezifikation baut, und der Block steht im Plan', async () => {
  const e = await engine();
  const q = quellen(e), info = M.stilInfo({ paletten: e.ebene3.paletten, vokabular: e.ebene4.vokabular });
  const basis = M.setzeStimmung(haus({ treppe: 1 }), 'projekt', 'hell-nordisch', info.stimmungen);
  for (const rolle of info.rollen) for (const form of info.rollenFormen[rolle]) {
    const text = { wand: 'stone', akzent: form === 'treppe' ? 'stone_brick' : form === 'tuer' ? 'door' : 'iron', boden: form === 'treppe' ? 'stone' : 'stone', licht: 'lantern', glas: form === 'scheibe' ? 'glass_pane' : 'glass' }[rolle];
    const { treffer } = M.materialSuche(q, text, rolle, form, 6);
    assert.ok(treffer.length > 0, `${rolle}/${form}: „${text}“ liefert etwas`);
    for (const t of treffer) {
      const inf = (await import('../../src/ebene5/bearbeiten.js')).blockInfo(e.ebene0, t.id);
      const zustand = Object.fromEntries(inf.zustaende.filter((z) => z.pflicht).map((z) => [z.name, z.vorschlag]));
      const spec = M.setzeMaterial(basis, 'projekt', rolle, form, { id: t.id, ...(Object.keys(zustand).length ? { zustand } : {}) }, info);
      assert.deepEqual(e.ebene4.pruefe(spec).rueckfragen, [], `${rolle}/${form}: ${t.id}`);
    }
  }
  // gebaut: Wand aus Steinziegeln, im Plan
  const spec = M.setzeMaterial(basis, 'projekt', 'wand', 'voll', { id: 'minecraft:stone_bricks' }, info);
  const r = bauePlan(e, e.ebene4.freigeben(e.ebene4.neueVersion(spec), 'test'));
  assert.equal(r.status, 'fertig');
  assert.ok(e.e5.bauplan(r.entwurf).abschnitte.some((a) => a.legende.some((l) => l.id === 'minecraft:stone_bricks')));
});

test('Review: manipulierte Daten (null, Zahl, Liste als Block oder Palette) lassen die Oberfläche nicht abstürzen', () => {
  const s = haus();
  for (const wert of [null, 5, [1], { id: 7 }, true]) {
    s.projekt.stil = { stimmung: wert, palette: { wand: { voll: wert }, licht: wert } };
    assert.doesNotThrow(() => M.stilVon(s, 'projekt'));
    assert.equal(M.wahlFuer(s, 'projekt', 'wand', 'voll'), null);
    assert.equal(M.wahlFuer(s, 'projekt', 'licht', 'voll'), null);
  }
  s.projekt.stil = { palette: [1, 2] };
  assert.deepEqual(M.stilVon(s, 'projekt').palette, {});
  s.projekt.stil = { palette: { wand: { id: 'minecraft:stone', zustand: [1] } } };
  assert.deepEqual(M.wahlFuer(s, 'projekt', 'wand', 'voll'), { id: 'minecraft:stone' }, 'ein Zustand, der kein Objekt ist, wird ignoriert');
});

test('Review: Rollennamen, die keine einfachen Namen sind (__proto__, Punkt, Klammer), werden von setzeMaterial abgelehnt', () => {
  for (const rolle of ['__proto__', 'wand.voll', 'teile[0]', '', 'Wand']) assert.throws(() => M.setzeMaterial(haus(), 'projekt', rolle, 'voll', { id: 'minecraft:stone' }), /Rollenname/, rolle);
});
