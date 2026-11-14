// U2: Die Zellenwahl stimmt mit dem Bauplan überein (Besitzkarte `p`), und eine über sie erzeugte Änderung wirkt genau an der gewählten Weltzelle – im ganzen Wohnhaus mit Treppe, Tür und Fenster als Teilen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';

const spezifikation = () => hausSpezifikation(Object.values(VARIANTEN)[0], { treppe: 1, tuerInWand: 1, fensterTeil: 1 });
const pf = (teil, zelle, neu) => PF.wende(PF.leer(), [{ teil, zelle, erwartet: null, neu }], 'Jonah').planfassung;

test('Alle Blockzellen des Plans: die Zellenwahl nennt dasselbe Teil wie die Besitzkarte des Plans, und die Rahmenzelle führt zurück an dieselbe Weltzelle', async () => {
  const e = await engine();
  const r = bauePlan(e, e.ebene4.freigeben(spezifikation(), 'test'));
  assert.equal(r.status, 'fertig');
  const plan = e.e5.bauplan(r.entwurf);
  const mat = e.ebene3.materialisiere(r.entwurf);
  let geprueft = 0;
  const nachTeil = {};
  for (const a of plan.abschnitte) {
    for (const s of a.schichten) {
      for (let i = 0; i < s.n; i++) {
        const w = e.ebene3.zellenwahl.waehle(r.entwurf, { x: s.x[i], y: s.y, z: s.z[i] }, { mat });
        assert.equal(w.gewaehlt.id, a.teile[s.p[i]].id, `Zelle ${s.x[i]},${s.y},${s.z[i]}`);
        assert.equal(w.gewaehlt.teil, a.teile[s.p[i]].ref);
        assert.equal(w.gewaehlt.grund, 'block');
        assert.equal(w.block.id, a.legende[s.b[i]].id, 'derselbe Block wie im Schichtplan');
        nachTeil[w.gewaehlt.teil] = (nachTeil[w.gewaehlt.teil] ?? 0) + 1;
        geprueft++;
      }
    }
  }
  assert.ok(geprueft > 300);
  for (const ref of ['erdgeschoss', 'obergeschoss', 'dach', 'treppe', 'haustuer', 'fenster']) assert.ok(nachTeil[ref] > 0, `${ref} wurde gewählt`);
});

test('Ring über den ganzen Plan: für eine Zelle jedes Teils führt „Block entfernen“ an (Teil, Rahmenzelle) genau zu dieser Weltzelle; der Plan zeigt die Änderung als angewandt', async () => {
  const e = await engine();
  const frei = e.ebene4.freigeben(spezifikation(), 'test');
  const r = bauePlan(e, frei);
  const plan = e.e5.bauplan(r.entwurf);
  const mat = e.ebene3.materialisiere(r.entwurf);
  const proTeil = new Map();
  for (const a of plan.abschnitte) for (const s of a.schichten) for (let i = 0; i < s.n; i++) {
    const refT = a.teile[s.p[i]].ref;
    if (!proTeil.has(refT)) proTeil.set(refT, []);
    proTeil.get(refT).push({ x: s.x[i], y: s.y, z: s.z[i] });
  }
  assert.ok(proTeil.size >= 6);
  for (const [ref, zellen] of proTeil) {
    for (const welt of [0, Math.floor(zellen.length / 3), Math.floor(2 * zellen.length / 3), zellen.length - 1].map((i) => zellen[i])) { // breit gestreut
      const w = e.ebene3.zellenwahl.waehle(r.entwurf, welt, { mat });
      assert.equal(w.gewaehlt.teil, ref);
      const mit = bauePlan(e, frei, [], pf(w.gewaehlt.teil, w.gewaehlt.zelle, { op: 'leere' }));
      const p2 = e.e5.bauplan(mit.entwurf);
      assert.equal(p2.aenderungen[0].status, 'angewandt', `${ref} ${JSON.stringify(welt)}`);
      assert.deepEqual(p2.aenderungen[0].ort, welt, 'die Änderung wirkt genau an der angeklickten Weltzelle');
      const m2 = e.ebene3.materialisiere(mit.entwurf);
      assert.equal(m2.welt.istLuft(welt.x, welt.y, welt.z), true);
    }
  }
});

test('Leere Zellen im Haus und davor: Innenraum gehört dem Raum, außerhalb des Hauses gibt es keine Wahl; eine Änderung dort ist eine „setze“-Änderung am gewählten Teil', async () => {
  const e = await engine();
  const frei = e.ebene4.freigeben(spezifikation(), 'test');
  const r = bauePlan(e, frei);
  const mat = e.ebene3.materialisiere(r.entwurf);
  const huelle = r.entwurf.abschnitte.find((a) => a.id === 'erdgeschoss').huelle;
  const mitteX = Math.floor((huelle.von.x + huelle.bis.x) / 2), mitteZ = Math.floor((huelle.von.z + huelle.bis.z) / 2);
  let luft = null;
  for (let y = huelle.von.y + 1; y < huelle.bis.y && !luft; y++) if (mat.welt.istLuft(mitteX, y, mitteZ)) luft = { x: mitteX, y, z: mitteZ };
  assert.ok(luft, 'es gibt eine freie Zelle im Erdgeschoss');
  const w = e.ebene3.zellenwahl.waehle(r.entwurf, luft, { mat });
  assert.equal(w.block, null);
  assert.ok(['erdgeschoss', 'treppe'].includes(w.gewaehlt.teil));
  const g = bauePlan(e, frei, [], pf(w.gewaehlt.teil, w.gewaehlt.zelle, { op: 'setze', block: { id: 'minecraft:glass' } }));
  const p = e.e5.bauplan(g.entwurf);
  assert.equal(p.aenderungen[0].status, 'angewandt');
  assert.equal(e.ebene3.materialisiere(g.entwurf).welt.leseBlock(luft.x, luft.y, luft.z).id, 'minecraft:glass');
  assert.equal(e.ebene3.zellenwahl.waehle(r.entwurf, { x: huelle.von.x - 10, y: huelle.von.y, z: huelle.von.z - 10 }, { mat }).gewaehlt, null);
});
