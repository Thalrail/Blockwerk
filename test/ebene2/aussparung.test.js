import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { TESTPALETTE } from '../../src/ebene2/index.js';
import { aussparungsZellen, leereZellen, quaderZellen, zellenInWelt } from '../../src/ebene2/zellen.js';

const e2 = ebene2();
const e0 = e2.ebene0;
const B = e2.ebene1.bewegung;
const ARTEN = ['spieler', 'dorfbewohner', 'baby'];
const k = (z) => `${z.x},${z.y},${z.z}`;
const menge = (l) => new Set(l.map(k));
const nf = (n) => 0 - (0 - n);
/** Drehung um 90° im Uhrzeigersinn (x, z) → (-z, x), unabhängig vom Vermesser. */
const lageAn = (z, l) => { let { x, z: zz } = z; for (let i = 0; i < ((l.drehung % 4) + 4) % 4; i++) [x, zz] = [-zz, x]; return { x: nf(x + l.x), y: z.y + l.y, z: nf(zz + l.z) }; };

const boden = (w) => { for (let x = -16; x <= 16; x++) for (let z = -16; z <= 16; z++) w.setzeBlock(x, -1, z, 'minecraft:stone'); };
/** Setzt ein Paket mit Lage (Drehung, Verschiebung über den Vermesser, wie materialisiere). */
function setze(w, p, lage) {
  const t = e0.neueWelt();
  e2.platziere(t, p, TESTPALETTE);
  const h = p.platzbedarf.huelle;
  let bauteil = e0.vermesser.drehe(t.ausschnitt(h.von, h.bis), lage.drehung);
  bauteil = e0.vermesser.verschiebe(bauteil, { x: lage.x, y: lage.y, z: lage.z });
  w.fuegeBauteilEin(bauteil);
}
const blockZellen = (p, lage) => menge(p.bloecke.map((b) => lageAn(b, lage)));
const gehe = (w, von, nach, art, radius = 12) => B.weg(w, von, nach, art, { radius });
/** Wände sind 9 oder 11 lang (Mitte ± 4 bzw. 5): Suchradius 4 reicht nicht, um sie zu umgehen. */
const WANDRADIUS = 4;

test('Aussparungen: Tür und Fenster schneiden genau die Zellen ihrer eigenen Blöcke aus (alle Drehungen)', () => {
  for (const [id, par] of [['bau.tuer', { fluegel: 1 }], ['bau.tuer', { fluegel: 2 }], ['bau.fenster', { breite: 3, hoehe: 2, rahmen: 1 }], ['bau.fenster', { breite: 1, hoehe: 4, rahmen: 0 }], ['bau.fenster', { breite: 6, hoehe: 1, rahmen: 2 }]]) {
    const p = e2.baue(id, par);
    assert.ok(p.aussparungen.every((a) => a.art === 'oeffnung'));
    for (const drehung of [0, 1, 2, 3]) {
      const lage = { x: 3, y: 2, z: -5, drehung };
      assert.deepEqual(menge(aussparungsZellen(e0, p, 'oeffnung', lage)), blockZellen(p, lage), `${id} ${JSON.stringify(par)} Drehung ${drehung}`);
      assert.deepEqual(aussparungsZellen(e0, p, 'freihaltung', lage), []);
    }
  }
});

test('Tür in einer Wand (Ebene 1): ohne Aussparung hält die Wand, mit Aussparung und Tür gehen alle hindurch; in allen vier Drehungen', () => {
  for (const fluegel of [1, 2]) for (const drehung of [0, 1, 2, 3]) {
    const wand = e2.baue('bau.wand', { laenge: 9, hoehe: 4, dicke: 1 });
    const tuer = e2.baue('bau.tuer', { fluegel });
    const wandLage = { x: 0, y: 0, z: 0, drehung };
    const tuerLage = { ...lageAn({ x: 0, y: 0, z: 0 }, wandLage), drehung };
    const w = e0.neueWelt();
    boden(w);
    setze(w, wand, wandLage);
    const von = lageAn({ x: 0, y: 0, z: -2 }, wandLage), nach = lageAn({ x: 0, y: 0, z: 2 }, wandLage);
    for (const art of ARTEN) assert.equal(gehe(w, von, nach, art, WANDRADIUS).ok, false, `${art}: die geschlossene Wand hält`);
    const soll = aussparungsZellen(e0, tuer, 'oeffnung', tuerLage);
    const entfernt = leereZellen(w, soll);
    assert.equal(entfernt.length, 2 * fluegel, 'genau die Wandblöcke an der Stelle der Tür entfallen');
    for (const e of entfernt) assert.equal(e.id, 'minecraft:stone', 'nur Blöcke der Wand, nichts anderes');
    setze(w, tuer, tuerLage);
    for (const art of ARTEN) {
      const r = gehe(w, von, nach, art, WANDRADIUS);
      // der Weg läuft durch die Tür (bei Doppeltür durch eine der beiden Hälften)
      assert.equal(r.ok, true, `${art}, ${fluegel} Flügel, Drehung ${drehung}: ${r.grund}`);
    }
    assert.deepEqual(e2.ebene1.pruefe(w, { schienen: null }).filter((x) => x.schwere === 'verstoss'), []);
  }
});

test('Fenster in einer Wand (Ebene 1): die Öffnung wird ausgeschnitten und von Rahmen und Scheiben lückenlos gefüllt, die Wand bleibt dicht', () => {
  for (const par of [{ breite: 3, hoehe: 2, rahmen: 1 }, { breite: 2, hoehe: 3, rahmen: 0 }, { breite: 1, hoehe: 1, rahmen: 2 }]) for (const drehung of [0, 1, 2, 3]) {
    const wand = e2.baue('bau.wand', { laenge: 9, hoehe: 8, dicke: 1 });
    const fenster = e2.baue('bau.fenster', par);
    const wandLage = { x: 0, y: 0, z: 0, drehung };
    const fensterLage = { ...lageAn({ x: 0, y: 1, z: 0 }, wandLage), drehung };
    const w = e0.neueWelt();
    boden(w);
    setze(w, wand, wandLage);
    const wandZellen = blockZellen(wand, wandLage);
    const entfernt = leereZellen(w, aussparungsZellen(e0, fenster, 'oeffnung', fensterLage));
    assert.equal(entfernt.length, fenster.bloecke.length, `${JSON.stringify(par)}: so viele Wandblöcke entfallen, wie das Fenster Blöcke hat`);
    const luft = [...wandZellen].filter((c) => { const [x, y, z] = c.split(',').map(Number); return w.istLuft(x, y, z); });
    assert.equal(luft.length, fenster.bloecke.length);
    setze(w, fenster, fensterLage);
    for (const c of wandZellen) { const [x, y, z] = c.split(',').map(Number); assert.ok(!w.istLuft(x, y, z), `${JSON.stringify(par)} Drehung ${drehung}: Lücke bei ${c}`); }
    // nichts außerhalb der Wandzellen wurde verändert
    const alle = new Set(w.alleBloecke().filter((b) => b.y >= 0).map(k));
    assert.deepEqual(alle, wandZellen);
    const von = lageAn({ x: 0, y: 0, z: -2 }, wandLage), nach = lageAn({ x: 0, y: 0, z: 2 }, wandLage);
    for (const art of ARTEN) assert.equal(gehe(w, von, nach, art, WANDRADIUS).ok, false, `${art}: die Wand mit Fenster hält`);
  }
});

test('Treppe unter einer Decke (Ebene 1): ohne Aussparung oder nur mit der Öffnung kommt niemand hinauf, mit Kopffreiheit gehen Spieler, Dorfbewohner und Baby; alle Drehungen', () => {
  for (const [stufen, breite] of [[4, 2], [5, 1], [6, 3]]) for (const drehung of [0, 1, 2, 3]) {
    const treppe = e2.baue('bau.treppe', { stufen, breite });
    const lage = { x: 0, y: 0, z: 0, drehung };
    // Decke (Obergeschossboden) in Höhe der obersten Stufe
    const decke = quaderZellen({ x: -7, y: stufen - 1, z: -stufen - 7 }, { x: 7, y: stufen - 1, z: 4 });
    const bauWelt = (modus) => {
      const w = e0.neueWelt();
      boden(w);
      for (const c of zellenInWelt(e0, decke, lage)) w.setzeBlock(c.x, c.y, c.z, 'minecraft:stone');
      if (modus !== 'nichts') leereZellen(w, aussparungsZellen(e0, treppe, 'oeffnung', lage));
      if (modus === 'alles') leereZellen(w, aussparungsZellen(e0, treppe, 'freihaltung', lage));
      setze(w, treppe, lage);
      return w;
    };
    const von = lageAn({ x: 0, y: 0, z: 2 }, lage), nach = lageAn({ x: 0, y: stufen, z: -stufen - 2 }, lage);
    for (const art of ARTEN) {
      for (const modus of ['nichts', 'oeffnung']) assert.equal(gehe(bauWelt(modus), von, nach, art).ok, false, `${art} ${stufen} Stufen, Drehung ${drehung}: Modus ${modus} blockiert`);
      const r = gehe(bauWelt('alles'), von, nach, art);
      assert.equal(r.ok, true, `${art} ${stufen}×${breite}, Drehung ${drehung}: ${r.grund}`);
    }
  }
});

test('Treppe: Kopffreiheit über jeder Stufe (3 Zellen: 2 zum Stehen, 1 für den Aufstieg), auch über der obersten; die Aussparung liegt außerhalb der Blöcke und verschiebt den Rahmen nicht', () => {
  const p = e2.baue('bau.treppe', { stufen: 5, breite: 3 });
  const frei = menge(aussparungsZellen(e0, p, 'freihaltung', { x: 0, y: 0, z: 0, drehung: 0 }));
  for (let s = 0; s < 5; s++) for (let x = -1; x <= 1; x++) for (const dy of [1, 2, 3]) assert.ok(frei.has(`${x},${s + dy},${-s}`), `über Stufe ${s}, Höhe ${dy}`);
  assert.equal(frei.size, 5 * 3 * 3);
  const hoechste = Math.max(...p.bloecke.map((b) => b.y));
  assert.ok([...frei].some((c) => Number(c.split(',')[1]) === hoechste + 3), 'drei Zellen über der obersten Stufe');
  const eigene = menge(p.bloecke);
  assert.deepEqual(menge(aussparungsZellen(e0, p, 'oeffnung', { x: 0, y: 0, z: 0, drehung: 0 })), eigene, 'die Öffnung deckt genau die eigenen Stufen (dort entfällt die Decke des Trägers)');
  for (const c of frei) assert.ok(!eigene.has(c), 'Freihaltung überlappt keine eigene Stufe');
  assert.equal(Math.max(...p.aussparungen.map((a) => a.bis.y)), hoechste + 3);
});
