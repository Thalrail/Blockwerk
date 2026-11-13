import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { indexMenge, symmetrisch } from './formhilfe.js';
import { TESTPALETTE } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const B = e1.bewegung;
const ARTEN = ['spieler', 'dorfbewohner', 'baby'];
const STEIN = 'minecraft:stone';
const RICHTUNG = ['north', 'east', 'south', 'west'];
const AUSWAERTS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // Nord, Ost, Süd, West als (dx, dz)
const verstoesse = (w) => e1.pruefe(w, { schienen: null }).filter((x) => x.schwere === 'verstoss');
const zellen = (p) => new Set(p.bloecke.map((b) => `${b.x},${b.y},${b.z}`));

/** Äußere Maße und Innenraum eines Raums aus seinen Parametern (unabhängig von der Implementierung berechnet). */
function maße({ breite, tiefe, hoehe, wandstaerke: t = 1, boden = 1, decke = 1 }) {
  const Bx = breite + 2 * t, Bz = tiefe + 2 * t, ox = Math.floor(Bx / 2), oz = Math.floor(Bz / 2);
  return { Bx, Bz, jMin: boden ? -t : 0, jMax: decke ? hoehe + t - 1 : hoehe - 1, ox, oz,
    innen: { von: { x: t - ox, y: 0, z: t - oz }, bis: { x: t + breite - 1 - ox, y: hoehe - 1, z: t + tiefe - 1 - oz } } };
}

/** Von außen erreichbare Zellen (6er-Nachbarschaft, Luft) in einem Quader um den Raum; liefert die erste erreichbare Innenzelle oder null. */
function leck(p, m) {
  const fest = zellen(p);
  const von = { x: m.innen.von.x - 6, y: m.jMin - 2, z: m.innen.von.z - 6 }, bis = { x: m.innen.bis.x + 6, y: m.jMax + 2, z: m.innen.bis.z + 6 };
  const gesehen = new Set([`${von.x},${von.y},${von.z}`]);
  const stapel = [[von.x, von.y, von.z]];
  while (stapel.length) {
    const [x, y, z] = stapel.pop();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const q = [x + dx, y + dy, z + dz], k = q.join(',');
      if (q[0] < von.x || q[0] > bis.x || q[1] < von.y || q[1] > bis.y || q[2] < von.z || q[2] > bis.z || gesehen.has(k) || fest.has(k)) continue;
      if (q[0] >= m.innen.von.x && q[0] <= m.innen.bis.x && q[1] >= m.innen.von.y && q[1] <= m.innen.bis.y && q[2] >= m.innen.von.z && q[2] <= m.innen.bis.z) return q;
      gesehen.add(k); stapel.push(q);
    }
  }
  return null;
}

test('Raum: Parameter, Bereiche und Fehlermeldungen', () => {
  assert.throws(() => e2.baue('bau.raum', { hoehe: 1 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.raum', { breite: 0 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.raum', { tuerwand: 5 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.raum', { tuer: 3 }), /außerhalb/);
  assert.throws(() => e2.baue('bau.raum', { gibtEsNicht: 1 }), /unbekannter Parameter/);
  assert.throws(() => e2.baue('bau.raum', { breite: 1, tuerwand: 3, tuer: 2 }), /Tür \(2 breit\) passt nicht in die Wand \(1 breit\)/);
  assert.throws(() => e2.baue('bau.raum', { breite: 9, tiefe: 5, fenster: 2, fensterbreite: 2, tuer: 1, tuerwand: 3 }), /ost-Wand|west-Wand/);
  assert.throws(() => e2.baue('bau.raum', { hoehe: 3, fenster: 1, fensterhoehe: 3, bruestung: 1 }), /ragt über die lichte Höhe 3/);
  // Standardwerte: ein geschlossener Raum ohne Tür und Fenster
  const p = e2.baue('bau.raum');
  assert.equal(p.status, 'simuliert');
  assert.equal(p.anschluesse.length, 0);
  assert.deepEqual(p.parameter, { breite: 5, tiefe: 5, hoehe: 3, wandstaerke: 1, boden: 1, decke: 1, tuer: 0, tuerwand: 3, fenster: 0, fensterbreite: 2, fensterhoehe: 2, bruestung: 1 });
});

test('Raum: Maße, Blockzahl, Hülle, leerer Innenraum und Symmetrie über viele Größen', () => {
  let n = 0;
  for (const breite of [1, 2, 3, 4, 5, 8, 9, 16]) for (const tiefe of [1, 2, 3, 6, 7, 12]) for (const hoehe of [2, 3, 5]) for (const wandstaerke of [1, 2, 3]) for (const [boden, decke] of [[1, 1], [1, 0], [0, 1], [0, 0]]) {
    const par = { breite, tiefe, hoehe, wandstaerke, boden, decke };
    const p = e2.baue('bau.raum', par), m = maße(par);
    const name = JSON.stringify(par);
    assert.equal(p.bloecke.length, m.Bx * m.Bz * (m.jMax - m.jMin + 1) - breite * tiefe * hoehe, `${name}: Blockzahl = Außenvolumen − Innenvolumen`);
    assert.deepEqual(p.platzbedarf.huelle, { von: { x: -m.ox, y: m.jMin, z: -m.oz }, bis: { x: m.Bx - 1 - m.ox, y: m.jMax, z: m.Bz - 1 - m.oz } }, `${name}: Hülle`);
    const z = zellen(p);
    for (let x = m.innen.von.x; x <= m.innen.bis.x; x++) for (let y = 0; y < hoehe; y++) for (let zz = m.innen.von.z; zz <= m.innen.bis.z; zz++) assert.ok(!z.has(`${x},${y},${zz}`), `${name}: Innenraum leer`);
    assert.ok(p.bloecke.every((b) => (b.y < 0) === (b.rolle === 'boden')), `${name}: Rolle Boden nur unter der Gehhöhe`);
    assert.equal(p.bloecke.every((b) => ['wand', 'boden'].includes(b.rolle) && !b.form), true, `${name}: ohne Öffnungen nur Voll-Blöcke aus Wand und Boden`);
    assert.equal(symmetrisch(indexMenge(p, m.Bx, m.Bz), m.Bx, m.jMax - m.jMin + 1, m.Bz, { drehen: m.Bx === m.Bz }), null, `${name}: symmetrisch`);
    n++;
  }
  assert.equal(n, 8 * 6 * 3 * 3 * 4);
});

test('Raum: ringsum dicht mit Boden und Decke; ohne Boden von unten, ohne Decke von oben erreichbar; Wandstärke ändert die Dichtheit nicht', () => {
  for (const breite of [1, 2, 5, 8, 15]) for (const tiefe of [1, 3, 6, 11]) for (const hoehe of [2, 4]) for (const wandstaerke of [1, 2, 4]) {
    const par = { breite, tiefe, hoehe, wandstaerke };
    const m = maße(par), name = JSON.stringify(par);
    assert.equal(leck(e2.baue('bau.raum', par), m), null, `${name}: dicht`);
    assert.notEqual(leck(e2.baue('bau.raum', { ...par, boden: 0 }), maße({ ...par, boden: 0 })), null, `${name}: ohne Boden offen`);
    assert.notEqual(leck(e2.baue('bau.raum', { ...par, decke: 0 }), maße({ ...par, decke: 0 })), null, `${name}: ohne Decke offen`);
  }
});

test('Raum: Tür in jeder Wand, einfach und doppelt: Lage, Ausrichtung, Anschluss, dicht (Tür zählt als geschlossen)', () => {
  for (const [breite, tiefe] of [[5, 5], [6, 7], [9, 4], [1, 3]]) for (const tuerwand of [1, 2, 3, 4]) for (const tuer of [1, 2]) for (const wandstaerke of [1, 2, 3]) {
    const L = tuerwand % 2 === 0 ? tiefe : breite;
    if (tuer > L) continue;
    const par = { breite, tiefe, hoehe: 3, wandstaerke, tuer, tuerwand };
    const p = e2.baue('bau.raum', par), m = maße(par), name = JSON.stringify(par);
    const tueren = p.bloecke.filter((b) => b.form === 'tuer');
    assert.equal(tueren.length, 2 * tuer, `${name}: 2 Blöcke hoch je Flügel`);
    assert.ok(tueren.every((b) => b.richtung === RICHTUNG[tuerwand - 1] && b.rolle === 'akzent'), `${name}: Ausrichtung nach außen`);
    const unten = tueren.filter((b) => b.haelfte === 'unten');
    assert.deepEqual(unten.map((b) => b.scharnier).sort(), tuer === 1 ? ['links'] : ['links', 'rechts'], `${name}: Scharniere`);
    if (tuer === 2) {
      // wie bau.tuer (Blick nach Norden: links bei kleinerem x, rechts bei größerem x), je Wand um 90° im Uhrzeigersinn gedreht: (dx, dz) → (−dz, dx)
      let soll = [-1, 0]; for (let k = 0; k < tuerwand - 1; k++) soll = [0 - soll[1], soll[0]];
      const l = unten.find((b) => b.scharnier === 'links'), r = unten.find((b) => b.scharnier === 'rechts');
      assert.deepEqual([l.x - r.x, l.z - r.z], soll, `${name}: Scharniere außen, gedreht wie bau.tuer`);
    }
    assert.deepEqual([...new Set(tueren.map((b) => b.y))].sort(), [0, 1], `${name}: Türhöhe 2 ab Gehhöhe`);
    assert.equal(p.anschluesse.length, 1);
    assert.deepEqual(p.anschluesse[0], { art: 'durchgang', seite: ['nord', 'ost', 'sued', 'west'][tuerwand - 1], breite: tuer, hoehe: 2 });
    // alle Türblöcke liegen in der äußersten Schicht der gewählten Wand, die Öffnung ist über die ganze Wandstärke frei
    const [dx, dz] = AUSWAERTS[tuerwand - 1];
    const aussen = tuerwand === 1 ? m.jMin * 0 - m.oz : tuerwand === 3 ? m.Bz - 1 - m.oz : tuerwand === 2 ? m.Bx - 1 - m.ox : -m.ox;
    for (const b of tueren) assert.equal(dx === 0 ? b.z : b.x, aussen, `${name}: äußerste Schicht`);
    const z = zellen(p);
    for (const b of tueren) for (let d = 1; d < wandstaerke; d++) assert.ok(!z.has(`${b.x - dx * d},${b.y},${b.z - dz * d}`), `${name}: Laibung frei`);
    assert.equal(leck(p, m), null, `${name}: dicht`);
    // Lage: mittig, bei ungerader Restbreite einen Block näher am Anfang der Wand
    const entlang = tueren.map((b) => (dx === 0 ? b.x : b.z)).sort((a, c) => a - c);
    const wandAnfang = dx === 0 ? m.innen.von.x : m.innen.von.z;
    assert.equal(entlang[0] - wandAnfang, Math.floor((L - tuer) / 2), `${name}: Türlage`);
    const vorn = entlang[0] - wandAnfang, hinten = wandAnfang + L - 1 - entlang.at(-1);
    assert.ok(hinten - vorn === (L - tuer) % 2, `${name}: Rand vorn ${vorn}, hinten ${hinten}: mittig, bei ungerader Restbreite um einen Block versetzt`);
  }
});

test('Raum: Spieler, Dorfbewohner und Baby gehen durch die Tür hinein, ohne Tür hält jede Wand, die Eisentür hält Dorfbewohner (Ebene 1)', () => {
  const welt = (p, tuerId) => {
    const w = e0.neueWelt();
    for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) w.setzeBlock(x, -1, z, STEIN);
    e2.platziere(w, p, { ...TESTPALETTE, akzent: { ...TESTPALETTE.akzent, tuer: tuerId } });
    return w;
  };
  const geh = (w, par, art) => {
    const p = e2.baue('bau.raum', par);
    const unten = p.bloecke.find((b) => b.form === 'tuer' && b.haelfte === 'unten');
    const [dx, dz] = AUSWAERTS[par.tuerwand - 1], t = par.wandstaerke ?? 1;
    return B.weg(w, { x: unten.x + dx, y: 0, z: unten.z + dz }, { x: unten.x - dx * t, y: 0, z: unten.z - dz * t }, art, { radius: 40 });
  };
  for (const par of [{ breite: 5, tiefe: 5, hoehe: 3, tuer: 1, tuerwand: 3 }, { breite: 6, tiefe: 7, hoehe: 4, wandstaerke: 2, tuer: 2, tuerwand: 1 }, { breite: 7, tiefe: 4, hoehe: 3, tuer: 1, tuerwand: 2 }, { breite: 4, tiefe: 6, hoehe: 3, wandstaerke: 3, tuer: 1, tuerwand: 4 }]) {
    const p = e2.baue('bau.raum', par);
    for (const art of ARTEN) {
      const w = geh(welt(p, 'minecraft:wooden_door'), par, art);
      assert.equal(w.ok, true, `${JSON.stringify(par)} ${art}: ${w.grund}`);
    }
    assert.deepEqual(verstoesse(welt(p, 'minecraft:wooden_door')), [], `${JSON.stringify(par)}: Prüfer`);
    assert.equal(geh(welt(p, 'minecraft:iron_door'), par, 'dorfbewohner').ok, false, `${JSON.stringify(par)}: Eisentür hält Dorfbewohner`);
    // dieselbe Stelle ohne Tür (Wand bleibt zu): niemand kommt hinein
    const ohne = { ...par, tuer: 0 };
    const po = e2.baue('bau.raum', ohne);
    const w0 = e0.neueWelt();
    for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) w0.setzeBlock(x, -1, z, STEIN);
    e2.platziere(w0, po, TESTPALETTE);
    const unten = p.bloecke.find((b) => b.form === 'tuer' && b.haelfte === 'unten');
    const [dx, dz] = AUSWAERTS[par.tuerwand - 1], t = par.wandstaerke ?? 1;
    for (const art of ARTEN) assert.equal(B.weg(w0, { x: unten.x + dx, y: 0, z: unten.z + dz }, { x: unten.x - dx * t, y: 0, z: unten.z - dz * t }, art, { radius: 40 }).ok, false, `${JSON.stringify(par)}: Wand ohne Tür hält ${art}`);
  }
});

test('Raum: Fenster je Wand (nicht in der Türwand), gleichmäßig verteilt, Scheiben in der äußersten Schicht, dicht', () => {
  for (const [breite, tiefe] of [[9, 7], [12, 12], [20, 9], [5, 5]]) for (const fenster of [1, 2, 3]) for (const fensterbreite of [1, 2, 3]) for (const [hoehe, fensterhoehe, bruestung] of [[3, 1, 1], [4, 2, 1], [5, 2, 2], [4, 3, 1]]) for (const tuerwand of [0, 1, 2, 3, 4]) for (const wandstaerke of [1, 2]) {
    const par = { breite, tiefe, hoehe, wandstaerke, fenster, fensterbreite, fensterhoehe, bruestung, tuer: tuerwand ? 1 : 0, ...(tuerwand ? { tuerwand } : {}) };
    const nord = tuerwand === 1, waende = [0, 1, 2, 3].filter((w) => !(tuerwand && w === tuerwand - 1));
    const brauchtPlatz = waende.every((w) => { const L = w % 2 === 0 ? breite : tiefe; const rest = L - fenster * fensterbreite; return rest >= 2 && (fenster === 1 || Math.floor((rest - 2) / (fenster - 1)) >= 1); });
    void nord;
    if (!brauchtPlatz) { assert.throws(() => e2.baue('bau.raum', par), /passen nicht in die/, JSON.stringify(par)); continue; }
    const p = e2.baue('bau.raum', par), m = maße(par), name = JSON.stringify(par);
    const scheiben = p.bloecke.filter((b) => b.rolle === 'glas');
    assert.ok(scheiben.every((b) => b.form === 'scheibe'), `${name}: Scheiben`);
    assert.equal(scheiben.length, waende.length * fenster * fensterbreite * fensterhoehe, `${name}: Zahl der Scheiben`);
    assert.equal(p.anschluesse.filter((a) => a.art === 'oeffnung').length, waende.length * fenster, `${name}: Anschlüsse`);
    assert.ok(scheiben.every((b) => b.y >= bruestung && b.y < bruestung + fensterhoehe), `${name}: Höhenlage`);
    // je Wand: Fenster liegen in der äußersten Schicht, getrennt durch mindestens 1 Block, Rand links und rechts unterscheidet sich höchstens um 1
    for (const w of waende) {
      const [dx, dz] = AUSWAERTS[w];
      const aussen = w === 0 ? -m.oz : w === 2 ? m.Bz - 1 - m.oz : w === 1 ? m.Bx - 1 - m.ox : -m.ox;
      const der = scheiben.filter((b) => (dx === 0 ? b.z : b.x) === aussen && (dz !== 0 ? true : true) && b.y === bruestung);
      const entlang = [...new Set(der.map((b) => (dx === 0 ? b.x : b.z)))].sort((a, c) => a - c);
      const anfang = dx === 0 ? m.innen.von.x : m.innen.von.z, L = w % 2 === 0 ? breite : tiefe;
      assert.equal(entlang.length, fenster * fensterbreite, `${name}: Wand ${w}`);
      const gruppen = []; for (const e of entlang) { if (gruppen.length && e === gruppen.at(-1).bis + 1) gruppen.at(-1).bis = e; else gruppen.push({ von: e, bis: e }); }
      assert.equal(gruppen.length, fenster, `${name}: Wand ${w}: Fenster getrennt`);
      const abstaende = []; for (let i = 1; i < gruppen.length; i++) abstaende.push(gruppen[i].von - gruppen[i - 1].bis - 1);
      assert.ok(abstaende.every((x) => x >= 1), `${name}: Pfeiler`);
      assert.equal(new Set(abstaende).size <= 1, true, `${name}: Wand ${w}: gleiche Abstände ${abstaende}`);
      const links = gruppen[0].von - anfang, rechts = anfang + L - 1 - gruppen.at(-1).bis;
      assert.ok(links >= 1 && rechts >= 1 && Math.abs(links - rechts) <= 1, `${name}: Rand ${links}/${rechts}`);
      void dz;
    }
    if (tuerwand) {
      const w = tuerwand - 1, aussen = w === 0 ? -m.oz : w === 2 ? m.Bz - 1 - m.oz : w === 1 ? m.Bx - 1 - m.ox : -m.ox;
      assert.ok(!scheiben.some((b) => (w % 2 === 0 ? b.z : b.x) === aussen), `${name}: keine Fenster in der Türwand ${tuerwand}`);
    }
    assert.equal(leck(p, m), null, `${name}: mit Fenstern und Tür dicht`);
  }
});

test('Raum: Drehen um 90°, 180°, 270° über den Vermesser dreht die Tür mit; Blockzahl und Dichtheit bleiben', () => {
  const par = { breite: 7, tiefe: 5, hoehe: 3, tuer: 1, tuerwand: 3, fenster: 1, fensterbreite: 2 };
  const p = e2.baue('bau.raum', par);
  const welt = e0.neueWelt();
  e2.platziere(welt, p, TESTPALETTE);
  const eingang = { ...p.bloecke.find((b) => b.form === 'tuer' && b.haelfte === 'unten') };
  const zuerst = welt.leseBlock(eingang.x, eingang.y, eingang.z);
  assert.equal(zuerst.id, 'minecraft:wooden_door');
  assert.equal(zuerst.zustand['minecraft:cardinal_direction'], 'south', 'Südwand: Tür schaut nach Süden');
  const REIHE = ['north', 'east', 'south', 'west'];
  for (const k of [1, 2, 3]) {
    const g = e0.vermesser.drehe(welt.ausschnitt({ x: -10, y: -3, z: -10 }, { x: 10, y: 8, z: 10 }), k);
    const tueren = g.bloecke.filter((x) => x.id === 'minecraft:wooden_door');
    assert.equal(tueren.length, 2, `k=${k}`);
    for (const t of tueren) assert.equal(t.zustand['minecraft:cardinal_direction'], REIHE[(REIHE.indexOf('south') + k) % 4], `k=${k}: Richtung dreht mit`);
    assert.equal(g.bloecke.length, welt.ausschnitt({ x: -10, y: -3, z: -10 }, { x: 10, y: 8, z: 10 }).bloecke.length, `k=${k}: keine Blöcke verloren`);
  }
});

test('Raum: Prüfer von Ebene 1 melden bei Raum mit Tür und Fenstern keinen Verstoß; Blöcke sind nur Rollen (kein Material im Baustein)', () => {
  const p = e2.baue('bau.raum', { breite: 9, tiefe: 7, hoehe: 4, wandstaerke: 2, tuer: 2, tuerwand: 1, fenster: 2, fensterbreite: 2, fensterhoehe: 2, bruestung: 1 });
  assert.ok(p.bloecke.every((b) => !('id' in b) && ['wand', 'boden', 'akzent', 'glas'].includes(b.rolle)));
  const w = e0.neueWelt();
  for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) w.setzeBlock(x, -1, z, STEIN);
  e2.platziere(w, p, TESTPALETTE);
  assert.deepEqual(verstoesse(w), []);
});
