import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { definiere, pruefePaket } from '../../src/ebene2/index.js';
import { MAX_ZELLEN } from '../../src/ebene2/baustein.js';

const e2 = ebene2();
const k = (z) => `${z.x},${z.y},${z.z}`;
const zellenDes = (q) => { const s = new Set(); for (let y = q.von.y; y <= q.bis.y; y++) for (let z = q.von.z; z <= q.bis.z; z++) for (let x = q.von.x; x <= q.bis.x; x++) s.add(`${x},${y},${z}`); return s; };
const kasten = (...felder) => definiere({
  id: 'test.kasten', titel: 'T', quelle: 'https://beispiel.invalid/', testszenario: { start: 's', erwartung: 'e' }, parameter: [],
  baue: () => ({ bloecke: [{ x: 0, y: 0, z: 0, rolle: 'wand' }, { x: 3, y: 2, z: 1, rolle: 'wand' }], ...Object.assign({}, ...felder) }),
});
const zone = (id, art, von, bis, extra = {}) => ({ id, art, von, bis, ...extra });
const q = (a, b) => ({ von: { x: a[0], y: a[1], z: a[2] }, bis: { x: b[0], y: b[1], z: b[2] } });

test('Einbaufelder: alle bisherigen Bausteine bleiben gültig, ohne Zonen und Aussparungen (außer Raum und Wand)', () => {
  for (const b of e2.bausteine.values()) {
    const p = b.erzeuge();
    pruefePaket(p);
    if (!['bau.raum', 'bau.wand'].includes(b.id)) assert.ok(!('einbauzonen' in p), b.id);
    if (!['bau.tuer', 'bau.fenster', 'bau.treppe', 'bau.leiter'].includes(b.id)) assert.ok(!('aussparungen' in p), b.id); // bau.leiter: interner Baustein (D4), Leiterblöcke ersetzen Deckenblöcke des Trägers
  }
});

test('Einbaufelder: Zonen werden geprüft (Id, Art, Seite, Quader, Lage im Paket)', () => {
  const ok = kasten({ einbauzonen: [zone('a', 'innenraum', { x: 1, y: 0, z: 0 }, { x: 2, y: 1, z: 1 }), zone('w', 'wand', { x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { seite: 'nord' })] });
  assert.equal(ok.erzeuge().einbauzonen.length, 2);
  const fehler = (z, re) => assert.throws(() => kasten({ einbauzonen: z }).erzeuge(), re);
  const v = { x: 0, y: 0, z: 0 }, b = { x: 1, y: 1, z: 1 };
  fehler('nein', /Liste/);
  fehler([zone('', 'innenraum', v, b)], /id/);
  fehler([zone('a', 'innenraum', v, b), zone('a', 'wand', v, b)], /doppelt/);
  fehler([zone('a', 'keller', v, b)], /Art/);
  fehler([zone('a', 'innenraum', v, b, { seite: 'nord' })], /seite nur bei Art wand/);
  fehler([zone('a', 'wand', v, b, { seite: 'oben' })], /seite nur bei Art wand/);
  fehler([zone('a', 'innenraum', { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })], /hinter/);
  fehler([zone('a', 'innenraum', { x: 0.5, y: 0, z: 0 }, b)], /ganze Zahlen/);
  fehler([zone('a', 'innenraum', v, { x: 1, y: 1 })], /ganze Zahlen/);
  fehler([zone('a', 'innenraum', v, { x: 4, y: 1, z: 1 })], /nicht innerhalb/);
  fehler([zone('a', 'innenraum', { x: -1, y: 0, z: 0 }, b)], /nicht innerhalb/);
  fehler([zone('a', 'innenraum', v, { x: 1, y: 3, z: 1 })], /nicht innerhalb/);
  fehler([null], /id/);
});

test('Einbaufelder: Aussparungen werden geprüft, dürfen aber außerhalb der Paketbegrenzung liegen', () => {
  const p = kasten({ aussparungen: [{ art: 'freihaltung', von: { x: -9, y: -9, z: -9 }, bis: { x: 20, y: 20, z: 20 } }, { art: 'oeffnung', von: { x: 0, y: 0, z: 0 }, bis: { x: 0, y: 0, z: 0 } }] }).erzeuge();
  assert.equal(p.aussparungen.length, 2);
  const fehler = (a, re) => assert.throws(() => kasten({ aussparungen: a }).erzeuge(), re);
  const v = { x: 0, y: 0, z: 0 };
  fehler({}, /Liste/);
  fehler([{ art: 'loch', von: v, bis: v }], /Art/);
  fehler([{ art: 'oeffnung', von: v, bis: { x: -1, y: 0, z: 0 } }], /hinter/);
  fehler([{ art: 'oeffnung', von: v, bis: { x: Infinity, y: 0, z: 0 } }], /ganze Zahlen/);
  fehler([{ art: 'oeffnung', von: v, bis: { x: NaN, y: 0, z: 0 } }], /ganze Zahlen/);
  fehler([{ art: 'oeffnung', von: v }], /ganze Zahlen/);
  fehler([{ art: 'freihaltung', von: v, bis: { x: MAX_ZELLEN, y: 0, z: 0 } }], /zu viel/);
  assert.doesNotThrow(() => kasten({ aussparungen: [{ art: 'freihaltung', von: v, bis: { x: MAX_ZELLEN - 1, y: 0, z: 0 } }] }).erzeuge());
  fehler([{ art: 'oeffnung', von: { x: 2 ** 53, y: 0, z: 0 }, bis: { x: 2 ** 53, y: 0, z: 0 } }], /ganze Zahlen/);
  fehler([null], /Art/);
});

test('Einbaufelder: Zonen und Aussparungen eines gültigen Pakets sind wieder prüfbar (pruefePaket auf ein bestehendes Paket)', () => {
  const p = e2.baue('bau.raum', { breite: 5, tiefe: 4, hoehe: 3 });
  pruefePaket(p);
  const kaputt = { ...p, einbauzonen: [...p.einbauzonen, p.einbauzonen[0]] };
  assert.throws(() => pruefePaket(kaputt), /doppelt/);
});

/** Erwartete Zonen eines Raums, aus den Parametern berechnet (unabhängig von der Implementierung). */
function erwartet({ breite: bw, tiefe: bt, hoehe: h, wandstaerke: t = 1, boden = 1, decke = 1 }) {
  const Bx = bw + 2 * t, Bz = bt + 2 * t, ox = Math.floor(Bx / 2), oz = Math.floor(Bz / 2);
  const kasten2 = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0 - ox, y: y0, z: z0 - oz }, bis: { x: x1 - ox, y: y1, z: z1 - oz } });
  const z = {
    innenraum: kasten2(t, 0, t, t + bw - 1, h - 1, t + bt - 1),
    'wand-nord': kasten2(t, 0, 0, t + bw - 1, h - 1, t - 1),
    'wand-sued': kasten2(t, 0, Bz - t, t + bw - 1, h - 1, Bz - 1),
    'wand-west': kasten2(0, 0, t, t - 1, h - 1, t + bt - 1),
    'wand-ost': kasten2(Bx - t, 0, t, Bx - 1, h - 1, t + bt - 1),
  };
  if (decke) z.decke = kasten2(0, h, 0, Bx - 1, h + t - 1, Bz - 1);
  if (boden) z.boden = kasten2(0, -t, 0, Bx - 1, -1, Bz - 1);
  return z;
}

test('bau.raum: Einbauzonen über viele Größen: Innenraum, vier Wandkörper, Decke und Boden liegen genau dort, wo der Raum hohl bzw. massiv ist', () => {
  const faelle = [];
  for (const breite of [1, 2, 5, 8]) for (const tiefe of [1, 3, 6]) for (const wandstaerke of [1, 2, 3]) for (const [boden, decke] of [[1, 1], [0, 1], [1, 0], [0, 0]]) faelle.push({ breite, tiefe, hoehe: 2 + (breite + tiefe) % 3, wandstaerke, boden, decke });
  for (const f of faelle) {
    const p = e2.baue('bau.raum', f);
    const soll = erwartet(f);
    assert.deepEqual(p.einbauzonen.map((z) => z.id).sort(), Object.keys(soll).sort(), JSON.stringify(f));
    const belegt = new Set(p.bloecke.map(k));
    for (const z of p.einbauzonen) {
      assert.deepEqual({ von: z.von, bis: z.bis }, soll[z.id], `${JSON.stringify(f)}: ${z.id}`);
      const zellen = zellenDes(z);
      if (z.art === 'innenraum') for (const c of zellen) assert.ok(!belegt.has(c), `Innenraum ${c} muss leer sein (${JSON.stringify(f)})`);
      else for (const c of zellen) assert.ok(belegt.has(c), `${z.id} ${c} muss ein Block sein (${JSON.stringify(f)})`);
    }
    // die Zonen überlappen sich nicht
    const alle = p.einbauzonen.flatMap((z) => [...zellenDes(z)]);
    assert.equal(new Set(alle).size, alle.length, `Zonen überlappen sich (${JSON.stringify(f)})`);
    // Seiten: Nord hat das kleinste z, West das kleinste x
    const rahmen = (a) => Math.min(...p.bloecke.map((b) => b[a]));
    const rahmenMax = (a) => Math.max(...p.bloecke.map((b) => b[a]));
    const wz = (id) => p.einbauzonen.find((z) => z.id === id);
    assert.equal(wz('wand-nord').von.z, rahmen('z'));
    assert.equal(wz('wand-sued').bis.z, rahmenMax('z'));
    assert.equal(wz('wand-west').von.x, rahmen('x'));
    assert.equal(wz('wand-ost').bis.x, rahmenMax('x'));
    assert.deepEqual(p.einbauzonen.filter((z) => z.art === 'wand').map((z) => z.seite).sort(), ['nord', 'ost', 'sued', 'west']);
  }
});

test('bau.raum: Tür und Fenster liegen in der Zone ihrer Wand (Grundlage für die Aussparungen von Tür und Fenster)', () => {
  for (const tuerwand of [1, 2, 3, 4]) {
    const f = { breite: 7, tiefe: 6, hoehe: 3, wandstaerke: 2, tuer: 2, tuerwand, fenster: 1, fensterbreite: 2, fensterhoehe: 1, bruestung: 1 };
    const p = e2.baue('bau.raum', f);
    const seite = ['nord', 'ost', 'sued', 'west'][tuerwand - 1];
    const zonen = new Map(p.einbauzonen.filter((z) => z.art === 'wand').map((z) => [z.seite, zellenDes(z)]));
    const tueren = p.bloecke.filter((b) => b.form === 'tuer');
    assert.equal(tueren.length, 4);
    for (const b of tueren) assert.ok(zonen.get(seite).has(k(b)), `Tür ${k(b)} liegt in wand-${seite}`);
    const scheiben = p.bloecke.filter((b) => b.form === 'scheibe');
    assert.ok(scheiben.length > 0);
    for (const b of scheiben) assert.ok([...zonen.values()].some((z) => z.has(k(b))), `Scheibe ${k(b)} liegt in einer Wandzone`);
  }
});

test('bau.wand: Maße, Zone deckt den ganzen Wandkörper, Grenzen, deterministisch', () => {
  for (const [laenge, hoehe, dicke] of [[1, 1, 1], [5, 3, 1], [6, 4, 2], [9, 2, 3], [128, 32, 4]]) {
    const p = e2.baue('bau.wand', { laenge, hoehe, dicke });
    assert.equal(p.bloecke.length, laenge * hoehe * dicke);
    assert.ok(p.bloecke.every((b) => b.rolle === 'wand'));
    assert.equal(p.einbauzonen.length, 1);
    const z = p.einbauzonen[0];
    assert.equal(z.id, 'wand');
    assert.equal(z.art, 'wand');
    assert.deepEqual(zellenDes(z), new Set(p.bloecke.map(k)), `Zone = Wandkörper (${laenge}×${hoehe}×${dicke})`);
    assert.deepEqual(p, e2.baue('bau.wand', { laenge, hoehe, dicke }));
    // der Nullpunkt liegt in der Mitte der Grundfläche (wie bei den anderen Bauelementen)
    assert.equal(Math.min(...p.bloecke.map((b) => b.x)), 0 - Math.floor(laenge / 2));
    assert.equal(Math.min(...p.bloecke.map((b) => b.z)), 0 - Math.floor(dicke / 2));
  }
  assert.throws(() => e2.baue('bau.wand', { laenge: 0 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.wand', { dicke: 5 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.wand', { hoehe: 33 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.wand', { laenge: 2.5 }), /ganzzahlig/);
});

test('bau.wand (Ebene 1): der Prüfer meldet nichts, Spieler, Dorfbewohner und Baby kommen nicht hindurch, am Wandende gehen sie herum', () => {
  const e1 = e2.ebene1, e0 = e2.ebene0;
  const welt = (p) => {
    const w = e0.neueWelt();
    for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) w.setzeBlock(x, -1, z, 'minecraft:stone');
    e2.platziere(w, p, { wand: 'minecraft:stone', akzent: 'minecraft:stone', boden: 'minecraft:stone', licht: 'minecraft:glowstone', glas: 'minecraft:glass' });
    return w;
  };
  for (const par of [{ laenge: 9, hoehe: 3, dicke: 1 }, { laenge: 9, hoehe: 4, dicke: 3 }]) {
    const w = welt(e2.baue('bau.wand', par));
    assert.deepEqual(e1.pruefe(w, { schienen: null }).filter((x) => x.schwere === 'verstoss'), [], 'Prüfer');
    const nord = Math.floor(par.dicke / 2), sued = par.dicke - 1 - nord;
    for (const art of ['spieler', 'dorfbewohner', 'baby']) {
      // genau durch die Mitte: die Wand hält
      assert.equal(e1.bewegung.weg(w, { x: 0, y: 0, z: -nord - 1 }, { x: 0, y: 0, z: sued + 1 }, art, { radius: 3 }).ok, false, `${art}: kein Durchgang (Suchradius zu klein zum Umgehen)`);
      // weit genug entfernt umgehen sie das Ende der Wand
      assert.equal(e1.bewegung.weg(w, { x: 0, y: 0, z: -nord - 1 }, { x: 0, y: 0, z: sued + 1 }, art, { radius: 40 }).ok, true, `${art}: geht um das Wandende herum`);
    }
  }
});
