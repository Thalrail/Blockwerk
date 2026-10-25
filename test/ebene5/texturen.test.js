import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { baueNetz, erzeugeAtlas, erzeugeDarstellung, WEISS, loeseAuf, erzeugeIndex, benoetigteBloecke } from '../../src/ebene5/index.js';
import { TexturFehler } from '../../src/ebene5/texturen.js';
import { beispiel, holeJson, wurzel } from './hilfe5.js';
import { ebene0 } from '../hilfe.js';

const TABELLE = {
  bloecke: {
    'minecraft:stone': 'stone',
    'minecraft:cobblestone': 'cobblestone',
    'minecraft:spruce_planks': 'planks_spruce',
    'minecraft:barrel': { oben: 'barrel_top', unten: 'barrel_bottom', seite: 'barrel_side' },
    'minecraft:deepslate_bricks': 'deepslate/deepslate_bricks',
    'minecraft:lectern': { oben: 'lectern_top', seite: 'lectern_sides', angenaehert: true },
  },
  regeln: [
    { muster: '^minecraft:(.+)_brick_stairs$', wie: 'minecraft:$1_bricks', angenaehert: true },
    { muster: '^minecraft:(.+)_stairs$', wie: 'minecraft:$1_planks', angenaehert: true },
    { muster: '^minecraft:(.+)_stairs$', wie: 'minecraft:$1', angenaehert: true },
    { muster: '^minecraft:(.+)_stained_glass$', textur: 'glass_$1' },
  ],
};

test('Zuordnung: Eintrag, Regeln mit Rückfall auf die nächste Regel, Flächen füllen sich auf', () => {
  assert.deepEqual(loeseAuf('minecraft:stone', TABELLE), { oben: 'stone', unten: 'stone', seite: 'stone', angenaehert: false });
  assert.deepEqual(loeseAuf('minecraft:barrel', TABELLE), { oben: 'barrel_top', unten: 'barrel_bottom', seite: 'barrel_side', angenaehert: false });
  assert.deepEqual(loeseAuf('minecraft:lectern', TABELLE), { oben: 'lectern_top', unten: 'lectern_top', seite: 'lectern_sides', angenaehert: true }); // unten fällt auf oben zurück
  assert.equal(loeseAuf('minecraft:spruce_stairs', TABELLE).seite, 'planks_spruce'); // Holztreppe → Bretter
  assert.equal(loeseAuf('minecraft:cobblestone_stairs', TABELLE).seite, 'cobblestone'); // keine Bretter vorhanden → nächste Regel: der Block selbst
  assert.equal(loeseAuf('minecraft:deepslate_brick_stairs', TABELLE).seite, 'deepslate/deepslate_bricks');
  assert.equal(loeseAuf('minecraft:spruce_stairs', TABELLE).angenaehert, true);
  assert.equal(loeseAuf('minecraft:white_stained_glass', TABELLE).seite, 'glass_white');
  assert.equal(loeseAuf('minecraft:grindstone', TABELLE), null);
  assert.throws(() => loeseAuf('minecraft:x', { bloecke: {}, regeln: [{ muster: '^minecraft:x$', wie: 'minecraft:x' }] }), TexturFehler);
  assert.throws(() => loeseAuf('minecraft:y', { bloecke: { 'minecraft:y': { oben: 5 } }, regeln: [] }), TexturFehler);
});

test('Index: nur vorhandene Dateien, Fehlendes wird mit Grund gemeldet, nichts Unbenötigtes, unabhängig von der Reihenfolge', () => {
  const dateien = new Set(['stone', 'barrel_top', 'barrel_bottom', 'barrel_side', 'planks_spruce', 'unbenutzt', 'cobblestone']);
  const ids = ['minecraft:stone', 'minecraft:barrel', 'minecraft:spruce_stairs', 'minecraft:grindstone', 'minecraft:deepslate_bricks', 'minecraft:stone'];
  const a = erzeugeIndex({ ids, tabelle: TABELLE, vorhanden: (n) => dateien.has(n), pack: { name: 'P' } });
  assert.deepEqual(a.kacheln, ['barrel_bottom', 'barrel_side', 'barrel_top', 'planks_spruce', 'stone']);
  assert.ok(!a.kacheln.includes('unbenutzt'), 'nur Benötigtes');
  assert.deepEqual(Object.keys(a.bloecke), ['minecraft:barrel', 'minecraft:spruce_stairs', 'minecraft:stone']);
  assert.deepEqual(a.fehlend.map((f) => f.id), ['minecraft:deepslate_bricks', 'minecraft:grindstone']);
  assert.match(a.fehlend[0].grund, /Datei fehlt im Pack: deepslate\/deepslate_bricks/);
  assert.match(a.fehlend[1].grund, /keine Zuordnung/);
  const b = erzeugeIndex({ ids: [...ids].reverse(), tabelle: TABELLE, vorhanden: (n) => dateien.has(n), pack: { name: 'P' } });
  assert.deepEqual(JSON.stringify(b), JSON.stringify(a));
});

test('Benötigte Blöcke: Quelltext-IDs, Berufsblöcke und Betten, nur Blöcke des Registers', () => {
  const e0 = ebene0();
  const ids = benoetigteBloecke({ register: e0.register.bloecke, texte: ['x "minecraft:stone" y minecraft:nicht_vorhanden minecraft:hopper'], zusaetzlich: ['minecraft:dirt'] });
  for (const id of ['minecraft:stone', 'minecraft:hopper', 'minecraft:dirt', 'minecraft:lectern', 'minecraft:bed', 'minecraft:grindstone']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('minecraft:nicht_vorhanden'));
  assert.deepEqual(ids, [...ids].sort());
});

test('Repo-Daten: Index passt zu Regeln und Dateien, jede Datei ist ein 32×32-PNG, die Beispiel-Legende hat Textur oder ist als Ersatz markiert', async () => {
  const e0 = ebene0();
  const index = await holeJson('data/texturen.json');
  const tabelle = await holeJson('data/texturen-regeln.json');
  const zusatz = (await holeJson('data/texturen-zusatz.json')).bloecke;
  const texte = readdirSync(new URL('src/ebene2/', wurzel)).filter((n) => n.endsWith('.js')).map((n) => readFileSync(new URL(`src/ebene2/${n}`, wurzel), 'utf8'));
  texte.push(readFileSync(new URL('data/regeln/planung.json', wurzel), 'utf8'));
  const ids = benoetigteBloecke({ register: e0.register.bloecke, texte, zusaetzlich: zusatz });
  const neu = erzeugeIndex({ ids, tabelle, vorhanden: (n) => index.kacheln.includes(n), pack: index.pack });
  assert.deepEqual(index, neu, 'data/texturen.json ist veraltet: node tools/texturen-extrahieren.js <Pack> neu ausführen');
  for (const n of index.kacheln) {
    const png = readFileSync(new URL(`data/texturen/${n}.png`, wurzel));
    assert.equal(png.subarray(1, 4).toString(), 'PNG', n);
    assert.equal(png.readUInt32BE(16), 32, `${n} Breite`);
    assert.ok(png.readUInt32BE(20) >= 32 && png.readUInt32BE(20) % 32 === 0, `${n} Höhe: ganze Vielfache (animierte Streifen zeigen das erste Bild)`);
  }
  assert.ok(index.fehlend.every((f) => !index.bloecke[f.id]));
  // Beispielprojekt: jede Legende kennt Textur oder ist Ersatz
  const b = await beispiel();
  const d = erzeugeDarstellung(await holeJson('data/darstellung.json'), index);
  const ohne = new Set();
  for (const a of b.plan.abschnitte) for (const l of a.legende) { const x = d.block(l.id); assert.equal(x.ersatz, !x.textur); if (!x.textur) ohne.add(l.id); assert.equal(l.ersatz, x.ersatz, `Legende ${l.id}`); }
  assert.deepEqual([...ohne], [], 'Blöcke des Beispielprojekts ohne Textur');
  // nur Benötigtes: jede Datei wird von einem Block gebraucht
  const gebraucht = new Set(Object.values(index.bloecke).flatMap((x) => [x.oben, x.unten, x.seite]));
  assert.deepEqual([...gebraucht].sort(), index.kacheln);
  assert.match(index.pack.name, /Faithful 32x/);
});

test('Darstellung: mit Texturindex ist Ersatz, wer keine Textur hat; ohne Index gilt die Farbregel wie bisher', () => {
  const daten = { farben: [{ muster: '^minecraft:stone$', farbe: '#888888' }], namen: {} };
  const idx = { bloecke: { 'minecraft:dirt': { oben: 'dirt', unten: 'dirt', seite: 'dirt', angenaehert: false } } };
  const mit = erzeugeDarstellung(daten, idx);
  assert.equal(mit.block('minecraft:dirt').ersatz, false);
  assert.equal(mit.block('minecraft:dirt').textur.oben, 'dirt');
  assert.equal(mit.block('minecraft:stone').ersatz, true, 'Farbregel allein reicht nicht, wenn Texturen da sind');
  assert.equal(mit.block('minecraft:stone').textur, null);
  const ohne = erzeugeDarstellung(daten);
  assert.equal(ohne.block('minecraft:stone').ersatz, false);
  assert.equal(ohne.block('minecraft:sand').ersatz, true);
  assert.equal(ohne.block('minecraft:stone').textur, null);
});

test('Atlas: Zweierpotenz, weiße Kachel zuerst, Kacheln überlappen nicht, UV innerhalb der Kachel, reihenfolgeunabhängig', () => {
  for (const n of [0, 1, 2, 3, 5, 16, 31, 70, 200]) {
    const namen = Array.from({ length: n }, (_, i) => `t${String(i).padStart(3, '0')}`);
    const a = erzeugeAtlas(namen);
    assert.equal(a.namen[0], WEISS);
    assert.equal(a.namen.length, n + 1);
    assert.ok((a.breite & (a.breite - 1)) === 0 && (a.hoehe & (a.hoehe - 1)) === 0, 'Zweierpotenzen');
    assert.ok(a.spalten * a.zeilen >= n + 1);
    const belegt = new Set();
    for (const e of a.eintraege.values()) {
      for (let y = e.y; y < e.y + 32; y += 32) for (let x = e.x; x < e.x + 32; x += 32) { const k = `${x},${y}`; assert.ok(!belegt.has(k), 'doppelt belegt'); belegt.add(k); }
      assert.ok(e.x + 32 <= a.breite && e.y + 32 <= a.hoehe);
      assert.ok(e.u0 > e.x / a.breite && e.u1 < (e.x + 32) / a.breite, 'innerhalb mit halbem Bildpunkt Abstand');
      assert.ok(e.v0 > e.y / a.hoehe && e.v1 < (e.y + 32) / a.hoehe);
      assert.ok(Math.abs((e.u0 - e.x / a.breite) - 0.5 / a.breite) < 1e-12);
    }
    assert.equal(belegt.size, n + 1);
    const b = erzeugeAtlas([...namen].reverse());
    assert.deepEqual([...b.eintraege.keys()], [...a.eintraege.keys()]);
    assert.equal(a.rechteck('gibtesnicht'), a.eintraege.get(WEISS));
  }
});

// ---------- Netz mit UV ----------
const PLAN = (zellen, legende) => ({
  abschnitte: [{ id: 'a', legende, schichten: [...new Set(zellen.map((c) => c.y))].sort((a, b) => a - b).map((y) => {
    const l = zellen.filter((c) => c.y === y);
    return { y, n: l.length, x: Int32Array.from(l.map((c) => c.x)), z: Int32Array.from(l.map((c) => c.z)), b: Uint16Array.from(l.map((c) => c.b ?? 0)), r: new Uint8Array(l.length), t: new Uint8Array(l.length) };
  }) }],
});
const TEX = { oben: 'top', unten: 'bot', seite: 'side', angenaehert: false };
const LEG = [{ farbe: '#c83232', textur: TEX }, { farbe: '#3232c8', textur: null }];

test('Netz mit Atlas: je Fläche das Rechteck der richtigen Textur, Ecken füllen das Rechteck, Seiten stehen aufrecht, Flächenzahl unverändert', () => {
  const atlas = erzeugeAtlas(['top', 'bot', 'side']);
  const plan = PLAN([{ x: 0, y: 0, z: 0 }], LEG);
  const mit = baueNetz(plan, { atlas }), ohne = baueNetz(plan);
  assert.equal(mit.flaechen, 6);
  assert.equal(ohne.flaechen, 6);
  assert.equal(mit.uvs.length, 6 * 4 * 2);
  for (let f = 0; f < 6; f++) {
    const ecken = [0, 1, 2, 3].map((k) => { const v = f * 4 + k; return { p: [mit.positionen[v * 3], mit.positionen[v * 3 + 1], mit.positionen[v * 3 + 2]], u: mit.uvs[v * 2], v: mit.uvs[v * 2 + 1] }; });
    const normal = [0, 1, 2].find((a) => ecken.every((e) => e.p[a] === ecken[0].p[a])), vorz = ecken[0].p[normal] === 1 ? 1 : -1;
    const art = normal === 1 ? (vorz > 0 ? 'top' : 'bot') : 'side', r = atlas.rechteck(art);
    const us = new Set(ecken.map((e) => e.u)), vs = new Set(ecken.map((e) => e.v));
    assert.deepEqual([...us].sort((a, b) => a - b), [r.u0, r.u1].map((x) => Math.fround(x)).sort((a, b) => a - b), `Fläche ${f} u`);
    assert.deepEqual([...vs].sort((a, b) => a - b), [r.v0, r.v1].map((x) => Math.fround(x)).sort((a, b) => a - b), `Fläche ${f} v`);
    assert.equal(new Set(ecken.map((e) => `${e.u},${e.v}`)).size, 4, 'vier verschiedene Ecken');
    if (normal !== 1) for (const e of ecken) assert.equal(e.v, Math.fround(e.p[1] === 1 ? r.v0 : r.v1), 'oben im Würfel = oben im Bild');
    if (normal === 0) for (const e of ecken) assert.equal(e.u, Math.fround(vorz > 0 ? (e.p[2] === 1 ? r.u0 : r.u1) : (e.p[2] === 1 ? r.u1 : r.u0)), 'Ostseite: Norden links, Westseite: Süden links');
    if (normal === 2) for (const e of ecken) assert.equal(e.u, Math.fround(vorz > 0 ? (e.p[0] === 1 ? r.u1 : r.u0) : (e.p[0] === 1 ? r.u0 : r.u1)), 'Südseite: Osten rechts, Nordseite: Osten links');
  }
});

test('Netz mit Atlas: Block ohne Textur nutzt die weiße Kachel und seine Farbe; Textur wird nicht eingefärbt; Fortschritt bleibt sichtbar', () => {
  const atlas = erzeugeAtlas(['top', 'bot', 'side']);
  const plan = PLAN([{ x: 0, y: 0, z: 0, b: 0 }, { x: 5, y: 0, z: 0, b: 1 }], LEG);
  const n = baueNetz(plan, { atlas });
  const w = atlas.rechteck(WEISS);
  const farbe = (i) => [n.farben[i * 3], n.farben[i * 3 + 1], n.farben[i * 3 + 2]];
  // Flächen: erste 6 = Block 0 (Textur), nächste 6 = Block 1 (keine Textur)
  const obenTex = [...Array(12).keys()].map((f) => f * 4).find((v, i) => i < 6 && n.positionen[v * 3 + 1] === 1 && n.positionen[v * 3 + 4] === 1);
  assert.deepEqual(farbe(obenTex), [255, 255, 255], 'Textur: Tönung nur Schattierung (oben = 1)');
  const ohneT = 6 * 4 + 0;
  assert.equal(n.uvs[ohneT * 2] >= w.u0 && n.uvs[ohneT * 2] <= w.u1, true);
  assert.notDeepEqual(farbe(ohneT), [255, 255, 255], 'Ersatzblock behält seine Farbe');
  const aktuell = baueNetz(plan, { atlas, fortschritt: () => 2 }), fertig = baueNetz(plan, { atlas, fortschritt: () => 1 });
  assert.notDeepEqual([...aktuell.farben.slice(0, 3)], [...n.farben.slice(0, 3)]);
  assert.notDeepEqual([...fertig.farben.slice(0, 3)], [...aktuell.farben.slice(0, 3)]);
  assert.notDeepEqual([...fertig.farben.slice(0, 3)], [...n.farben.slice(0, 3)]);
});

test('Netz: Ergebnis (Positionen, Flächenzahl) ist mit und ohne Atlas gleich, UV sind deterministisch', async () => {
  const b = await beispiel();
  const idx = await holeJson('data/texturen.json');
  const atlas = erzeugeAtlas(idx.kacheln);
  const d = erzeugeDarstellung(await holeJson('data/darstellung.json'), idx);
  assert.ok(b.plan.abschnitte[0].legende.every((l) => l.textur !== undefined));
  const plan = JSON.parse(JSON.stringify(b.plan, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)), (k, v) => v);
  void plan; void d;
  const a = baueNetz(b.plan, { atlas }), o = baueNetz(b.plan), a2 = baueNetz(b.plan, { atlas });
  assert.equal(a.flaechen, o.flaechen);
  assert.deepEqual(a.positionen, o.positionen);
  assert.deepEqual(a.uvs, a2.uvs);
  for (let i = 0; i < a.uvs.length; i++) assert.ok(a.uvs[i] >= 0 && a.uvs[i] <= 1);
});
