// U2: Zellenwahl – welche Weltzelle gehört zu welchem Teil, und wie heißt sie im Rahmen des Teils (Umkehrung von Rahmen → Paket → Lage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2, ebene3 } from '../hilfe.js';
import { neuerEntwurf, entwurfZuJson, ZellenwahlFehler } from '../../src/ebene3/index.js';
import { rahmenZuPaket, zellenInWelt } from '../../src/ebene2/zellen.js';
import { huelleVon } from '../../src/ebene2/baustein.js';

const e3 = ebene3();
const E2 = ebene2();
const e0 = E2.ebene0;
const A = e3.aenderungen;
const Z = e3.zellenwahl;
const MIT = { testmaterial: true };
const k = (z) => `${z.x},${z.y},${z.z}`;

function entwurfMit(teile) {
  let e = neuerEntwurf({ name: 'Zellenwahl' });
  e = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { id: 'A1', name: 'Haus', reihenfolge: 1 } }).entwurf;
  for (const t of teile) e = e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', ...t } }).entwurf;
  return e;
}
const raumPar = { breite: 7, tiefe: 5, hoehe: 3, wandstaerke: 1 };
const lagen = [0, 1, 2, 3, 1, 2].map((drehung, i) => ({ x: [4, -30, 12, 0, 99, -7][i], y: [10, 64, -3, 0, 5, 20][i], z: [-3, 8, 100, -45, 0, 17][i], drehung }));
/** Weltzelle einer Rahmenzelle des Teils auf dem direkten Weg (Paket → zellenInWelt), unabhängig von der Zellenwahl. */
const weltVon = (paket, rahmen, lage) => zellenInWelt(e0, [rahmenZuPaket(paket, rahmen)], lage)[0];

test('Rahmenzelle ↔ Weltzelle: für alle Zellen der Hülle, alle Drehungen, nichtquadratisches Paket – Hin- und Rückweg stimmen', () => {
  const paket = E2.baue('bau.raum', raumPar);
  const h = huelleVon(paket.bloecke);
  for (const lage of lagen) {
    const e = entwurfMit([{ baustein: 'bau.raum', ref: 'haus', parameter: raumPar, lage }]);
    const mat = e3.materialisiere(e, MIT);
    let blockzellen = 0, luftzellen = 0;
    for (let y = h.von.y; y <= h.bis.y; y++) for (let z = h.von.z; z <= h.bis.z; z++) for (let x = h.von.x; x <= h.bis.x; x++) {
      const rahmen = { x: x - h.von.x, y: y - h.von.y, z: z - h.von.z };
      const welt = weltVon(paket, rahmen, lage);
      const w = Z.waehle(e, welt, { mat });
      assert.equal(w.gewaehlt.teil, 'haus', JSON.stringify(lage));
      assert.deepEqual(w.gewaehlt.zelle, rahmen, `Drehung ${lage.drehung}: Welt ${k(welt)}`);
      assert.equal(w.gewaehlt.drehung, lage.drehung, 'die Drehung des Teils ist Teil der Auskunft (U3: Richtungszustände zurückdrehen)');
      assert.equal(w.kandidaten[0].drehung, lage.drehung);
      const hatBlock = mat.teile.get(w.gewaehlt.id).schluessel.has(k(welt));
      assert.equal(w.gewaehlt.besitzt, hatBlock);
      assert.equal(w.gewaehlt.grund, hatBlock ? 'block' : 'huelle');
      assert.equal(w.block !== null, hatBlock, 'Block dort, wenn das Teil dort einen hat');
      hatBlock ? blockzellen++ : luftzellen++;
    }
    assert.ok(blockzellen > 0 && luftzellen > 0, 'beide Fälle kommen vor (Wand und Innenraum)');
  }
});

test('Außerhalb jedes Teils: keine Wahl, ein Hinweis; jede der sechs Nachbarzellen der Hülle (in Weltrichtungen) ist außerhalb', () => {
  const paket = E2.baue('bau.raum', raumPar), h = huelleVon(paket.bloecke);
  for (const lage of lagen.slice(0, 4)) {
    const e = entwurfMit([{ baustein: 'bau.raum', ref: 'haus', parameter: raumPar, lage }]);
    const mat = e3.materialisiere(e, MIT);
    const welt = [];
    for (let y = h.von.y; y <= h.bis.y; y++) for (let z = h.von.z; z <= h.bis.z; z++) for (let x = h.von.x; x <= h.bis.x; x++) welt.push(weltVon(paket, { x: x - h.von.x, y: y - h.von.y, z: z - h.von.z }, lage));
    const drin = new Set(welt.map(k));
    let geprueft = 0;
    for (const c of welt) for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = { x: c.x + d[0], y: c.y + d[1], z: c.z + d[2] };
      if (drin.has(k(n))) continue;
      const w = Z.waehle(e, n, { mat });
      assert.deepEqual([w.gewaehlt, w.kandidaten, w.block], [null, [], null], k(n));
      assert.match(w.hinweis, /in keinem Teil/);
      geprueft++;
    }
    assert.ok(geprueft > 50);
  }
});

test('Gewählte Zelle → Änderung → Wirkung: die Änderung an (Teil, Rahmenzelle) landet genau an der angeklickten Weltzelle (Ring über alle Drehungen)', () => {
  const paket = E2.baue('bau.raum', raumPar), h = huelleVon(paket.bloecke);
  for (const lage of lagen) {
    const e0e = entwurfMit([{ baustein: 'bau.raum', ref: 'haus', parameter: raumPar, lage }]);
    const mat = e3.materialisiere(e0e, MIT);
    // eine Wandzelle (ersetzen) und eine Innenraumzelle (setzen) anklicken
    const wandRahmen = { x: 2, y: 1, z: 0 }, innenRahmen = { x: 3, y: 1, z: 2 };
    for (const [rahmen, erwartet] of [[wandRahmen, 'block'], [innenRahmen, 'huelle']]) {
      const welt = weltVon(paket, rahmen, lage);
      const w = Z.waehle(e0e, welt, { mat });
      assert.equal(w.gewaehlt.grund, erwartet);
      const e = A.setze(e0e, { teil: w.gewaehlt.teil, zelle: w.gewaehlt.zelle, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
      const neu = e3.materialisiere(e, MIT);
      assert.equal(neu.aenderungen.get('C1').status, 'angewandt');
      assert.equal(neu.welt.leseBlock(welt.x, welt.y, welt.z).id, 'minecraft:glass', `Drehung ${lage.drehung}`);
      assert.equal(neu.aenderungen.get('C1').ort.x, welt.x);
      // und danach zeigt die Wahl die vorhandene Änderung
      const w2 = Z.waehle(e, welt, { mat: neu });
      assert.deepEqual([w2.gewaehlt.aenderung.id, w2.gewaehlt.aenderung.status, w2.block.id], ['C1', 'angewandt', 'minecraft:glass']);
      assert.equal(Z.waehle(e0e, welt, { mat }).gewaehlt.aenderung, null);
    }
  }
});

test('Kinder und Träger: das Teil mit dem Block gewinnt, sonst das innerste; in jeder Drehung des Trägers und des Kindes', () => {
  for (const [traegerDrehung, kindDrehung] of [[0, 0], [1, 2], [2, 3], [3, 1]]) {
    let e = entwurfMit([{ baustein: 'bau.raum', ref: 'haus', parameter: { breite: 9, tiefe: 7, hoehe: 4, wandstaerke: 1 }, lage: { x: 0, y: 0, z: 0, drehung: traegerDrehung } }]);
    e = e3.aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A1', baustein: 'bau.treppe', ref: 'treppe', parameter: { stufen: 3, breite: 2 }, traeger: 'haus', einbau: { zone: 'innenraum', anker: 'nw', versatz: { x: 0, y: 0, z: 0 }, drehung: kindDrehung } } }).entwurf;
    const mat = e3.materialisiere(e, MIT);
    const treppeZellen = [...mat.teile.get(e.teile.find((t) => t.ref === 'treppe').id).schluessel];
    assert.ok(treppeZellen.length > 3);
    for (const c of treppeZellen) {
      const [x, y, z] = c.split(',').map(Number);
      const w = Z.waehle(e, { x, y, z }, { mat });
      assert.equal(w.gewaehlt.teil, 'treppe', `Treppenblock ${c}`);
      assert.equal(w.gewaehlt.grund, 'block');
      assert.deepEqual(w.kandidaten.map((q) => q.teil), ['treppe', 'haus'], 'der Träger ist auch Kandidat (seine Hülle umschließt das Kind), aber ohne Block');
      assert.equal(w.kandidaten[1].besitzt, false);
      // Ring: Änderung an der gewählten Zelle des Kindes wirkt an der Weltzelle
      const g = A.setze(e, { teil: 'treppe', zelle: w.gewaehlt.zelle, op: 'leere' }, 'Jonah').entwurf;
      const neu = e3.materialisiere(g, MIT);
      assert.equal(neu.aenderungen.get('C1').status, 'angewandt', c);
      assert.equal(neu.welt.istLuft(x, y, z), true);
    }
    // eine freie Innenraumzelle ohne Kind-Block: gewählt wird der Träger (Hülle des Kindes enthält sie nicht) – oder, innerhalb der Treppenhülle, das innerste Teil
    const innen = mat.welt.ausschnitt ? null : null; void innen;
    const hausBloecke = mat.teile.get(e.teile.find((t) => t.ref === 'haus').id).schluessel;
    const waende = [...hausBloecke].slice(0, 5);
    for (const c of waende) {
      const [x, y, z] = c.split(',').map(Number);
      assert.equal(Z.waehle(e, { x, y, z }, { mat }).gewaehlt.teil, 'haus');
    }
  }
});

test('Mehrere Teile mit Block in derselben Zelle: der erste im Entwurf wird gewählt, der Hinweis nennt alle; ohne Bauplan-Mat wird selbst gerechnet; nichts wird verändert', () => {
  const lage = { x: 0, y: 0, z: 0, drehung: 0 };
  const e = entwurfMit([
    { baustein: 'bau.raum', ref: 'a', parameter: raumPar, lage },
    { baustein: 'bau.raum', ref: 'b', parameter: raumPar, lage }, // dasselbe Volumen noch einmal: jede Wandzelle belegen beide
  ]);
  const vorher = entwurfZuJson(e);
  const paket = E2.baue('bau.raum', raumPar);
  const w = Z.waehle(e, weltVon(paket, { x: 2, y: 1, z: 0 }, lage), MIT); // ohne mat
  assert.equal(w.gewaehlt.teil, 'a');
  assert.deepEqual(w.kandidaten.map((q) => [q.teil, q.besitzt]), [['a', true], ['b', true]]);
  assert.match(w.hinweis, /2 Teile gleichzeitig \(a, b\); gewählt ist a/);
  assert.equal(entwurfZuJson(e), vorher, 'der Entwurf bleibt unverändert');
  assert.equal(JSON.stringify(Z.waehle(e, weltVon(paket, { x: 2, y: 1, z: 0 }, lage), MIT)), JSON.stringify(w), 'deterministisch');
});

test('Ungültige Zellen werden abgelehnt', () => {
  const e = entwurfMit([{ baustein: 'bau.raum', ref: 'haus', parameter: raumPar, lage: { x: 0, y: 0, z: 0, drehung: 0 } }]);
  for (const falsch of [null, undefined, {}, { x: 1.5, y: 0, z: 0 }, { x: 0, y: '1', z: 0 }, { x: 2 ** 60, y: 0, z: 0 }, { x: NaN, y: 0, z: 0 }]) assert.throws(() => Z.waehle(e, falsch), (f) => f instanceof ZellenwahlFehler && /ganze Zahlen/.test(f.message), JSON.stringify(falsch));
});

test('Umkehrung der Lage: für beliebige ganze Drehungen (auch negativ und ≥ 4) und Lagen ist sie exakt die Umkehrung von zellenInWelt, ohne -0', () => {
  const zellen = [];
  for (let y = -2; y <= 2; y++) for (let z = -3; z <= 3; z++) for (let x = -4; x <= 4; x++) zellen.push({ x, y, z });
  for (const drehung of [0, 1, 2, 3, 4, 5, 7, -1, -2, -3, -4, -9]) {
    const lage = { x: 11, y: -5, z: 250, drehung };
    const welt = zellenInWelt(e0, zellen, lage);
    assert.equal(welt.length, zellen.length);
    const zurueck = welt.map((w) => Z.weltZuPaket(w, lage)).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
    const soll = [...zellen].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
    assert.deepEqual(zurueck, soll, `Drehung ${drehung}`);
    for (const c of zurueck) for (const a of ['x', 'y', 'z']) assert.equal(Object.is(c[a], -0), false);
  }
});

test('Überlappende Hüllen: der Block gewinnt vor der kleineren Hülle; ohne Block gewinnt die kleinere (innerste) Hülle', () => {
  const lageGross = { x: 0, y: 0, z: 0, drehung: 0 };
  // ein kleiner Raum, dessen Innenraum eine Wand des großen schneidet (Überlappung, nur für den Test; im Plan wäre das ein Einwand der Planung)
  const gross = { baustein: 'bau.raum', ref: 'gross', parameter: { breite: 11, tiefe: 9, hoehe: 5, wandstaerke: 1 }, lage: lageGross };
  const klein = { baustein: 'bau.raum', ref: 'klein', parameter: { breite: 5, tiefe: 5, hoehe: 4, wandstaerke: 1 }, lage: { x: 0, y: 0, z: -5, drehung: 0 } };
  const e = entwurfMit([gross, klein]);
  const mat = e3.materialisiere(e, MIT);
  const hg = huelleVon(E2.baue('bau.raum', gross.parameter).bloecke), hk = huelleVon(E2.baue('bau.raum', klein.parameter).bloecke);
  const fall = { blockGross: 0, blockKlein: 0, nurHuelleKlein: 0 };
  for (let y = -2; y <= 12; y++) for (let z = -12; z <= 12; z++) for (let x = -12; x <= 12; x++) {
    const w = Z.waehle(e, { x, y, z }, { mat });
    const ids = w.kandidaten.map((q) => q.teil);
    if (!ids.includes('gross') || !ids.includes('klein')) continue;
    const g = w.kandidaten.find((q) => q.teil === 'gross'), kl = w.kandidaten.find((q) => q.teil === 'klein');
    if (g.besitzt && !kl.besitzt) { assert.equal(w.gewaehlt.teil, 'gross', `Block des großen Teils bei ${x},${y},${z}`); fall.blockGross++; }
    else if (kl.besitzt && !g.besitzt) { assert.equal(w.gewaehlt.teil, 'klein'); fall.blockKlein++; }
    else if (!g.besitzt && !kl.besitzt) { assert.equal(w.gewaehlt.teil, 'klein', `kleinere Hülle bei ${x},${y},${z}`); fall.nurHuelleKlein++; }
  }
  void hg; void hk;
  assert.ok(fall.blockGross > 0 && fall.blockKlein > 0 && fall.nurHuelleKlein > 0, JSON.stringify(fall));
});
