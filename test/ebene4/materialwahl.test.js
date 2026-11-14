// U4: Materialwahl von Hand in der Spezifikation (projekt.stil, teile[].stil.palette): Mischen, Prüfer, Übersetzung, Bau, Umbauhinweise, Zusammenfassung, Briefing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from '../ebene5/hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import { mischePaletten } from '../../src/ebene3/designer.js';
import * as Umbau from '../../src/ebene5/umbau.js';
import * as PF from '../../src/ebene5/planfassung.js';
import * as fortschritt from '../../src/ebene5/fortschritt.js';

// Das Wohnhaus der Haus-Sonde gibt dem Erdgeschoss eine eigene Stimmung; für die Tests ohne Teilstimmung, damit nur gilt, was ein Test selbst setzt
const haus = (mit = {}) => { const s = hausSpezifikation(VARIANTEN.klein, mit); for (const t of s.teile) delete t.stil; return s; };
const mitStil = (spec, projektStil, teilStile = {}) => {
  const s = structuredClone(spec);
  if (projektStil) s.projekt.stil = projektStil;
  for (const [id, stil] of Object.entries(teilStile)) { const t = s.teile.find((x) => x.id === id); t.stil = { ...(t.stil ?? {}), ...stil }; }
  return s;
};
const bauen = (e, spec, pf = null) => { const r = bauePlan(e, e.ebene4.freigeben(spec, 'test'), [], pf); return { ...r, mat: r.entwurf ? e.ebene3.materialisiere(r.entwurf) : null }; };
/** Alle Blöcke der Welt als „x,y,z → id“ (für Vergleiche). */
const welt = (mat) => { const m = new Map(); for (const t of mat.teile.values()) void t; const p = mat.welt; return p; };
const blockIds = (e, r) => { const p = e.e5.bauplan(r.entwurf); const ids = new Map(); for (const a of p.abschnitte) for (const s of a.schichten) for (let i = 0; i < s.n; i++) ids.set(`${s.x[i]},${s.y},${s.z[i]}`, a.legende[s.b[i]].id); return ids; };
void welt;

test('mischePaletten: je Rolle und Form gewinnt die Überschreibung, andere Formen bleiben, Eingaben bleiben unverändert, feste Reihenfolge', () => {
  const basis = { wand: { id: 'minecraft:quartz_block', zustand: { pillar_axis: 'y' } }, akzent: { voll: 'minecraft:gold_block', treppe: 'minecraft:quartz_stairs', tuer: 'minecraft:birch_door' }, licht: 'minecraft:glowstone' };
  const kopie = structuredClone(basis);
  const r = mischePaletten(basis, { akzent: { voll: 'minecraft:iron_block' }, wand: 'minecraft:stone', glas: 'minecraft:glass' });
  assert.deepEqual(basis, kopie, 'die Eingabe bleibt unverändert');
  assert.deepEqual(r.akzent, { tuer: 'minecraft:birch_door', treppe: 'minecraft:quartz_stairs', voll: 'minecraft:iron_block' }.constructor === Object ? { treppe: 'minecraft:quartz_stairs', tuer: 'minecraft:birch_door', voll: 'minecraft:iron_block' } : null, 'nur die Form voll geändert, Treppe und Tür der Stimmung bleiben');
  assert.equal(r.wand, 'minecraft:stone', 'eine Rolle nur mit „voll“ wird wieder ein einfacher Wert; das Zustandsobjekt der Stimmung entfällt mit dem Block');
  assert.equal(r.licht, 'minecraft:glowstone');
  assert.equal(r.glas, 'minecraft:glass');
  assert.deepEqual(Object.keys(r), ['akzent', 'glas', 'licht', 'wand'], 'Rollen alphabetisch');
  assert.deepEqual(Object.keys(r.akzent), ['treppe', 'tuer', 'voll'], 'Formen alphabetisch');
  assert.deepEqual(mischePaletten({}, {}), {});
  assert.deepEqual(mischePaletten(undefined, { wand: 'minecraft:stone' }), { wand: 'minecraft:stone' });
  assert.deepEqual(mischePaletten({ wand: 'minecraft:stone' }, undefined), { wand: 'minecraft:stone' });
  const r2 = mischePaletten({ wand: { id: 'minecraft:quartz_block', zustand: { pillar_axis: 'y' } } }, { wand: { id: 'minecraft:bone_block', zustand: { pillar_axis: 'y' } } });
  assert.deepEqual(r2.wand, { id: 'minecraft:bone_block', zustand: { pillar_axis: 'y' } }, 'Block mit Zustand bleibt ein Block mit Zustand');
});

test('Prüfer: gültige Materialwahl (Projekt und Teile) ergibt keine Rückfrage; Palette ändert Abdruck und Fassungsvergleich', async () => {
  const e = await engine();
  const s = mitStil(haus(), { stimmung: 'hell-nordisch', palette: { wand: 'minecraft:stone_bricks', akzent: { voll: 'minecraft:gold_block' } } }, { erdgeschoss: { palette: { licht: 'minecraft:sea_lantern', boden: 'minecraft:oak_planks' } } });
  const r = e.ebene4.pruefe(s);
  assert.deepEqual(r.rueckfragen, [], JSON.stringify(r.rueckfragen.map((q) => q.frage)));
  assert.notEqual(e.ebene4.abdruck?.(s) ?? JSON.stringify(s), e.ebene4.abdruck?.(haus()) ?? JSON.stringify(haus()));
  const v = e.ebene4.vergleiche(haus(), s);
  assert.ok(v.projekt.length > 0, 'Projekt-Stil im Vergleich');
  assert.ok(v.geaendert.some((x) => x.id === 'erdgeschoss'), 'Teil-Stil im Vergleich');
});

test('Prüfer: ungültige Materialwahl wird eine Rückfrage mit Pfad (nie ein Absturz in Ebene 3); Kindteile, unbekannte Felder und Nicht-Objekte werden abgelehnt', async () => {
  const e = await engine();
  const s = mitStil(haus({ treppe: 1, tuerInWand: 1, fensterTeil: 1 }), { palette: { wand: 'minecraft:furnace' }, farbe: 'rot' },
    { obergeschoss: { palette: { licht: 'minecraft:stone', akzent: 'minecraft:gibtsnicht', boden: 5, glas: 'minecraft:chest' } }, treppe: { palette: { wand: 'minecraft:stone' } }, dach: { palette: [1] }, erdgeschoss: { palette: { fantasie: 'minecraft:stone' } } });
  const pfade = e.ebene4.pruefe(s).rueckfragen.map((q) => q.pfad).sort();
  for (const p of ['projekt.stil.palette.wand', 'projekt.stil.farbe', 'teile[1].stil.palette.licht', 'teile[1].stil.palette.akzent', 'teile[1].stil.palette.boden', 'teile[1].stil.palette.glas', 'teile[3].stil.palette', 'teile[2].stil.palette', 'teile[0].stil.palette.fantasie']) assert.ok(pfade.includes(p), `${p} fehlt in ${pfade.join(' | ')}`);
  for (const q of e.ebene4.pruefe(s).rueckfragen) assert.ok(q.optionen.some((o) => o.id === 'entfernen'), q.pfad);
  // Stimmung des Projekts unbekannt, Stil kein Objekt
  assert.ok(e.ebene4.pruefe(mitStil(haus(), { stimmung: 'gibtsnicht' })).rueckfragen.some((q) => q.pfad === 'projekt.stil.stimmung'));
  const kaputt = haus(); kaputt.projekt.stil = 'rot';
  assert.ok(e.ebene4.pruefe(kaputt).rueckfragen.some((q) => q.pfad === 'projekt.stil'));
  // Arbeitsblock als Material ist verboten (Sperre des Technikers gilt auch hier)
  const arbeit = e.ebene4.pruefe(mitStil(haus(), { palette: { wand: 'minecraft:barrel' } })).rueckfragen;
  assert.ok(arbeit.some((q) => q.pfad === 'projekt.stil.palette.wand' && /Arbeitsblock/.test(q.frage)), JSON.stringify(arbeit.map((q) => q.frage)));
});

test('Übersetzung: ohne neue Felder keine neuen Schlüssel; Stimmung des Projekts geht vor der häufigsten; Materialwahl wird je Abschnitt in sich vollständig', async () => {
  const e = await engine();
  const ohne = e.ebene3.uebersetzung.uebersetze(haus()).vorgabe;
  assert.equal(JSON.stringify(ohne).includes('palette'), false, 'unverändert, wenn nichts gewählt ist');
  const s = mitStil(haus(), { stimmung: 'glanz', palette: { wand: 'minecraft:stone_bricks', licht: 'minecraft:sea_lantern' } }, {
    erdgeschoss: { palette: { wand: 'minecraft:brick_block' } },                           // erbt Stimmung und Projektwahl, überschreibt die Wand
    obergeschoss: { stimmung: 'dunkel-industriell', palette: { akzent: { voll: 'minecraft:iron_block' } } }, // eigene Stimmung: Projektwahl gilt dort nicht
  });
  const v = e.ebene3.uebersetzung.uebersetze(s).vorgabe;
  assert.equal(v.stimmung, 'glanz', 'ausdrückliche Projektstimmung vor der häufigsten Teilstimmung');
  assert.deepEqual(v.palette, { licht: 'minecraft:sea_lantern', wand: 'minecraft:stone_bricks' });
  const eg = v.abschnitte.find((a) => a.id === 'erdgeschoss'), og = v.abschnitte.find((a) => a.id === 'obergeschoss'), dach = v.abschnitte.find((a) => a.id === 'dach');
  assert.equal(eg.stimmung, 'glanz');
  assert.deepEqual(eg.palette, { licht: 'minecraft:sea_lantern', wand: 'minecraft:brick_block' }, 'Projektwahl plus eigene Wand');
  assert.equal(og.stimmung, 'dunkel-industriell');
  assert.deepEqual(og.palette, { akzent: 'minecraft:iron_block' }, 'bei eigener Stimmung zählt die Projektwahl nicht (nur die Form voll: wird ein einfacher Wert)');
  assert.equal('palette' in dach || 'stimmung' in dach, false, 'ohne eigenes Material erbt der Abschnitt über die Gesamtpalette');
});

test('Bau: die Wand bekommt den gewählten Block, Treppe und Tür der Stimmung bleiben; ohne Stimmung bleibt es bei der Rückfrage statt eines stillen Teststeins', async () => {
  const e = await engine();
  const basis = bauen(e, mitStil(haus({ treppe: 1, tuerInWand: 1, fensterTeil: 1 }), { stimmung: 'hell-nordisch' }));
  assert.equal(basis.status, 'fertig');
  const s = mitStil(haus({ treppe: 1, tuerInWand: 1, fensterTeil: 1 }), { stimmung: 'hell-nordisch', palette: { wand: 'minecraft:stone_bricks' } }, { obergeschoss: { palette: { wand: 'minecraft:brick_block' } } });
  const r = bauen(e, s);
  assert.equal(r.status, 'fertig', JSON.stringify(r.rueckfragen?.map((q) => q.frage)));
  const alt = blockIds(e, basis), neu = blockIds(e, r);
  const zaehl = (m) => { const z = {}; for (const id of m.values()) z[id] = (z[id] ?? 0) + 1; return z; };
  assert.ok((zaehl(neu)['minecraft:stone_bricks'] ?? 0) > 20, 'Erdgeschoss-Wand aus Steinziegeln');
  assert.ok((zaehl(neu)['minecraft:brick_block'] ?? 0) > 20, 'Obergeschoss-Wand aus Ziegeln (Teil geht vor Projekt)');
  assert.equal(zaehl(alt)['minecraft:stone_bricks'] ?? 0, 0);
  // Treppen- und Türblöcke der Stimmung bleiben (nur die Form „voll“ der Wand wurde überschrieben)
  const treppen = (m) => Object.keys(zaehl(m)).filter((id) => id.endsWith('_stairs')).sort();
  assert.deepEqual(treppen(neu), treppen(alt));
  // ohne Stimmung irgendwo: die Palette ist unvollständig, die Planung fragt nach (kein stilles Testmaterial)
  const leer = haus({ treppe: 1 });
  const teil = bauen(e, mitStil(leer, { palette: { wand: 'minecraft:stone_bricks' } }));
  assert.notEqual(teil.status, 'fertig');
  assert.ok((teil.rueckfragen ?? []).length > 0, 'Rückfrage statt Plan');
  assert.equal(JSON.stringify(teil.rueckfragen ?? []).includes('TESTPALETTE'), false);
});

test('Aktualisieren statt Neubau: eine geänderte oder entfernte Materialwahl ergibt denselben Plan wie ein frischer Bau (keine alten Rollen bleiben hängen)', async () => {
  const e = await engine();
  const fassungen = [
    mitStil(haus({ treppe: 1 }), { stimmung: 'hell-nordisch' }),
    mitStil(haus({ treppe: 1 }), { stimmung: 'hell-nordisch', palette: { wand: 'minecraft:stone_bricks', licht: 'minecraft:sea_lantern' } }, { erdgeschoss: { palette: { boden: 'minecraft:dirt' } } }),
    mitStil(haus({ treppe: 1 }), { stimmung: 'hell-nordisch', palette: { akzent: { voll: 'minecraft:iron_block' } } }),
    mitStil(haus({ treppe: 1 }), { stimmung: 'hell-nordisch' }, { erdgeschoss: { stimmung: 'glanz' } }), // eigene Stimmung eines Abschnitts
    mitStil(haus({ treppe: 1 }), { stimmung: 'hell-nordisch' }), // wieder ohne Materialwahl
  ];
  let frei = e.ebene4.freigeben(fassungen[0], 'test');
  let r = e.ebene4.baue(frei);
  assert.ok(r.entwurf);
  for (const f of fassungen.slice(1)) {
    const neu = e.ebene4.neueVersion(f);
    frei = e.ebene4.freigeben(neu, 'test');
    r = e.ebene4.aktualisiereBau(r.entwurf, frei);
    const frisch = e.ebene4.baue(frei);
    // Teil-Nummern (T4, T8) zählen je Entwurf anders; verglichen werden Block je Zelle, Palette, Abschnittspaletten und Material
    assert.deepEqual([...blockIds(e, r)].sort(), [...blockIds(e, frisch)].sort(), 'inkrementell = frisch: jeder Block');
    assert.deepEqual(r.entwurf.palette, frisch.entwurf.palette);
    const nichtLeer = (pal) => Object.fromEntries(Object.entries(pal ?? {}).filter(([, v]) => Object.keys(v).length)); // eine geleerte Abschnittspalette gilt wie keine
    assert.deepEqual(nichtLeer(r.entwurf.paletten), nichtLeer(frisch.entwurf.paletten));
    assert.equal(JSON.stringify(e.e5.material(e.e5.bauplan(r.entwurf))), JSON.stringify(e.e5.material(e.e5.bauplan(frisch.entwurf))));
  }
});

test('Umbauhinweise: eine neue Materialwahl nach gebauten Schichten nennt die zu ersetzenden Blöcke; Änderungen des Benutzers (U3) bleiben an ihrem Platz', async () => {
  const e = await engine();
  const alt = bauen(e, mitStil(haus(), { stimmung: 'hell-nordisch' }));
  const planAlt = e.e5.bauplan(alt.entwurf);
  // erste Schicht des Erdgeschosses ist gebaut
  const a0 = planAlt.abschnitte[0], f = fortschritt.haken(fortschritt.leer(), [fortschritt.schluessel(a0.id, a0.schichten[1])], true, 'Jonah');
  const neu = bauen(e, mitStil(haus(), { stimmung: 'hell-nordisch', palette: { wand: 'minecraft:stone_bricks' } }));
  const h = Umbau.hinweise(planAlt, e.e5.bauplan(neu.entwurf), f);
  assert.equal(h.noetig, true);
  assert.ok(h.summe.ersetzen > 0, 'gebaute Wand wird ersetzt');
  assert.equal(h.summe.entfernen, 0);
  // eine eigene Einzelblockänderung (Planfassung, an Teil und Rahmenzelle gebunden) wirkt mit und ohne Materialwahl an derselben Weltzelle
  const wahl = e.ebene3.zellenwahl.waehle(alt.entwurf, { x: planAlt.abschnitte[0].schichten[1].x[0], y: planAlt.abschnitte[0].schichten[1].y, z: planAlt.abschnitte[0].schichten[1].z[0] });
  const pf = PF.wende(PF.leer(), [{ teil: wahl.gewaehlt.teil, zelle: wahl.gewaehlt.zelle, erwartet: null, neu: { op: 'setze', block: { id: 'minecraft:glass' } } }], 'Jonah').planfassung;
  for (const spec of [mitStil(haus(), { stimmung: 'hell-nordisch' }), mitStil(haus(), { stimmung: 'hell-nordisch', palette: { wand: 'minecraft:stone_bricks' } })]) {
    const r = bauen(e, spec, pf);
    const p = e.e5.bauplan(r.entwurf);
    assert.equal(p.aenderungen[0].status, 'angewandt');
    assert.equal(r.mat.welt.leseBlock(p.aenderungen[0].ort.x, p.aenderungen[0].ort.y, p.aenderungen[0].ort.z).id, 'minecraft:glass');
  }
});

test('Zusammenfassung und Briefing: die Materialwahl steht im Text für Jonah; der Leser bekommt sie nie angeboten', async () => {
  const e = await engine();
  const s = mitStil(haus(), { stimmung: 'glanz', palette: { wand: 'minecraft:stone_bricks', akzent: { voll: 'minecraft:gold_block', treppe: 'minecraft:quartz_stairs' } } }, { erdgeschoss: { palette: { licht: 'minecraft:sea_lantern' } } });
  const text = e.ebene4.zusammenfassung(e.ebene4.freigeben(s, 'test'));
  assert.match(text, /Stil des Projekts: Stimmung glanz; Materialwahl wand = stone_bricks; akzent = voll gold_block, treppe quartz_stairs\./);
  assert.match(text, /Stil: Materialwahl licht = sea_lantern\./);
  assert.equal(e.ebene4.zusammenfassung(e.ebene4.freigeben(haus(), 'test')).includes('Materialwahl'), false);
  const prompt = e.ebene4.briefing({ text: 'Ein Haus', messungen: [] });
  assert.match(prompt, /„stil\.palette“ und „projekt\.stil“ \(Materialwahl\) setzt nur Jonah von Hand/);
  assert.equal(JSON.stringify(e.ebene4.beispiel()).includes('palette'), false, 'das Beispiel im Prompt enthält keine Materialwahl');
});

test('Review: Rollennamen mit Punkt oder Klammern aus einer Datei bekommen keine „weglassen“-Option (der Pfad wäre nicht eindeutig); __proto__ bleibt eine gewöhnliche Rückfrage', async () => {
  const e = await engine();
  const s = haus();
  s.projekt.stil = JSON.parse('{"palette": {"wand.voll": "minecraft:stone", "teile[0]": "minecraft:stone", "__proto__": "minecraft:stone", "wand": "minecraft:stone"}}');
  const q = e.ebene4.pruefe(s).rueckfragen;
  assert.equal(q.length, 3, JSON.stringify(q.map((x) => x.pfad)));
  for (const f of q) {
    assert.equal(f.optionen.some((o) => o.id === 'entfernen'), false, `${f.pfad}: keine Option, die ein anderes Feld treffen könnte`);
    assert.ok(f.optionen.some((o) => o.id === 'anders'));
  }
  const gut = haus(); gut.projekt.stil = { palette: { fantasie: 'minecraft:stone' } };
  assert.ok(e.ebene4.pruefe(gut).rueckfragen[0].optionen.some((o) => o.id === 'entfernen'), 'ein einfacher Name darf weggelassen werden');
});

test('Review: Treppen und Türen behalten bei einer Materialwahl ihren vollen Blockzustand (Richtung, Hälfte, Scharnier), nicht nur ihre Kennung', async () => {
  const e = await engine();
  const spec = (pal) => mitStil(haus({ treppe: 1, tuerInWand: 1, fensterTeil: 1 }), { stimmung: 'hell-nordisch', ...(pal ? { palette: pal } : {}) });
  const a = bauen(e, spec(null)), b = bauen(e, spec({ wand: 'minecraft:stone_bricks', licht: 'minecraft:sea_lantern' }));
  const idsA = blockIds(e, a);
  let geprueft = 0;
  for (const [k, id] of idsA) {
    if (!/_stairs$|_door$/.test(id)) continue;
    const [x, y, z] = k.split(',').map(Number);
    assert.deepEqual(b.mat.welt.leseBlock(x, y, z), a.mat.welt.leseBlock(x, y, z), `${id} bei ${k}`);
    geprueft++;
  }
  assert.ok(geprueft >= 6, `Treppen und Türen vorhanden (${geprueft})`);
});
