import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { TESTPALETTE } from '../../src/ebene2/index.js';

const e2 = ebene2();
const e1 = e2.ebene1;
const e0 = e2.ebene0;
const PA = e1.passagiere;
const RZ = e1.redstoneZeit;
const ID = 'tech.handelsnischen-lore';
const LORE = 'minecraft:minecart';
const DORF = 'minecraft:villager_v2';
const FALLTUER = 'minecraft:trapdoor';
const HEBEL = 'minecraft:lever';
const AKT = 'minecraft:activator_rail';
const K = 6;

const baue = (n, werte = {}) => e2.baue(ID, { anzahl: n, ...werte });
/** Reihe aufgestellt, Wasser eingeschwungen. */
function reihe(n, werte = {}) {
  const p = baue(n, werte);
  const w = e0.neueWelt();
  e2.platziere(w, p, TESTPALETTE);
  return { p, w, nass: e1.fluessigkeit.simuliere(w).welt };
}
/** Gleiche Geometrie wie der Baustein: Wasserhöhe und Kanalende. */
const segment = (x) => Math.floor((x + 1) / K);
const wasserHoehe = (x) => -1 - segment(x);
const kanalEnde = (n) => ({ x: -2 + K * Math.max(1, Math.ceil((2 * n + 1) / K)), y: -1 - (Math.max(1, Math.ceil((2 * n + 1) / K)) - 1), z: -1 });
const bloeckeVon = (w, id) => w.alleBloecke().filter((b) => b.id === id);
const offeneFalltueren = (l) => bloeckeVon(l.welt, FALLTUER).filter((b) => b.zustand.open_bit === true).map((b) => `${b.x},${b.y},${b.z}`).sort();
const kopie = (w) => { const k = e0.neueWelt(); k.fuegeBauteilEin(w.ausschnitt({ x: -80, y: -80, z: -80 }, { x: 600, y: 80, z: 80 })); return k; };

/** Lore mit Dorfbewohner auf der letzten Schiene des Stichs von Nische i (Fahrtrichtung Süden). */
function mitLore(w, i) {
  const lore = w.fuegeWesenHinzu({ id: LORE, x: 2 * i + 1.5, y: 3, z: -0.5, yaw: 0 });
  const dorf = w.fuegeWesenHinzu({ id: DORF, x: 2 * i + 1.5, y: 3, z: -0.5, sitztIn: lore });
  return { lore, dorf };
}

/**
 * Die ganze Kette für Nische i: Auswurf (C-Tick) auf die Deckenklappe → Hebel oben öffnet sie → Fall in die Stehzelle (≤ 3, ohne Schaden)
 * → Hebel an der Front öffnet die Bodenfalltür → Fall ins Wasser → Strömung bis zum Kanalende.
 */
function kette(n, i) {
  const { w, nass } = reihe(n);
  const x = 2 * i;
  const { dorf } = mitLore(nass, i);
  const l = RZ.erzeuge(nass);
  const m = PA.mechanik();
  l.taktgeber.registriere(m);
  l.laufe(4);
  const auswurf = m.ereignisse[0];
  const welt = l.welt;
  // 1. Auswurf: rechts der letzten Schiene, auf der geschlossenen Deckenklappe
  assert.equal(auswurf?.ok, true, `Nische ${i}: Auswurf`);
  assert.equal(auswurf.kandidat, 'rechts');
  assert.deepEqual(auswurf.ziel, { x, y: 3, z: -1 });
  assert.equal(welt.leseBlock(x, 3, -1).id, FALLTUER);
  assert.equal(welt.passagier(auswurf.lore), null, 'ausgestiegen');
  assert.equal(auswurf.fall.schaden, 0);
  // 2. Hebel oben: öffnet nur die Deckenklappe dieser Nische
  const oben = welt.leseBlock(x, 3, 1);
  assert.equal(oben.id, HEBEL);
  welt.setzeBlock(x, 3, 1, HEBEL, { ...oben.zustand, open_bit: true });
  l.laufe(6);
  assert.deepEqual(offeneFalltueren(l), [`${x},3,-1`], 'nur die Deckenklappe dieser Nische');
  const fall1 = e1.bewegung.faellt(welt, auswurf.ziel, 'dorfbewohner');
  assert.equal(fall1.ok, true);
  assert.deepEqual([fall1.ziel.x, fall1.ziel.y, fall1.ziel.z], [x, 0, -1], 'landet in der Stehzelle');
  assert.equal(fall1.hoehe, 3, 'Fall genau 3 Blöcke');
  assert.equal(fall1.schaden, 0, 'ohne Schaden');
  // 3. Hebel an der Front: öffnet nur die Bodenfalltür dieser Nische
  const front = welt.leseBlock(x, 0, 1);
  assert.equal(front.id, HEBEL);
  welt.setzeBlock(x, 0, 1, HEBEL, { ...front.zustand, open_bit: true });
  l.laufe(6);
  assert.deepEqual(offeneFalltueren(l), [`${x},0,-1`, `${x},3,-1`].sort());
  const fall2 = e1.bewegung.faellt(welt, fall1.ziel, 'dorfbewohner');
  assert.equal(fall2.ok, true);
  assert.equal(fall2.art, 'wasser', 'fällt ins Wasser');
  assert.equal(fall2.schaden, 0);
  assert.deepEqual([fall2.ziel.x, fall2.ziel.y, fall2.ziel.z], [x, wasserHoehe(x), -1]);
  // 4. Strömung trägt ihn bis zum Kanalende
  const t = e1.stroemung.treibe(welt, fall2.ziel);
  assert.equal(t.grund, 'ende', `Nische ${i}: Strömung endet am Kanalende`);
  const ende = kanalEnde(n);
  assert.deepEqual(t.ende, ende, `Nische ${i}: Ziel`);
  assert.ok(t.sekunden > 0);
  assert.ok(dorf);
  return { auswurf, fall1, fall2, t, w };
}

test('Handelsnischen an der Lorenbahn: Kette Auswurf → Stehzelle → Wasserkanal für Reihen von 1 bis 20 Nischen', () => {
  for (const n of [1, 2, 7, 8, 20]) {
    const nischen = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
    for (const i of nischen) kette(n, i);
  }
});

test('Handelsnischen an der Lorenbahn: jede Nische an jeder Stelle des Gefälles (auch unter dem Loch des Wasserfalls)', () => {
  const n = 9; // Kanalloch bei x = 4, 10, 16 (gerade): Nischen 2 (x = 4) und 5 (x = 10) liegen direkt darüber
  for (let i = 0; i < n; i++) kette(n, i);
  // Wasserstand sinkt je 6 Zellen um einen Block
  const { nass } = reihe(n);
  assert.equal(nass.leseBlock(0, -1, -1).id, 'minecraft:flowing_water');
  assert.equal(nass.leseBlock(4, -1, -1).zustand.liquid_depth >= 6, true);
  assert.equal(nass.leseBlock(6, -2, -1).id, 'minecraft:flowing_water');
  assert.equal(nass.leseBlock(6, -1, -1).id, 'minecraft:air', 'über dem Wasser der zweiten Stufe bleibt der Schacht frei');
});

test('Handelsnischen an der Lorenbahn: jeder Hebel schaltet genau eine Falltür (kein Übersprechen zwischen Nachbarn)', () => {
  const n = 7;
  const { nass } = reihe(n);
  for (let i = 0; i < n; i++) {
    for (const [y, z, falltuer] of [[3, 1, [2 * i, 3, -1]], [0, 1, [2 * i, 0, -1]]]) {
      const w = kopie(nass);
      const h = w.leseBlock(2 * i, y, z);
      assert.equal(h.id, HEBEL, `Hebel ${i}/${y}`);
      w.setzeBlock(2 * i, y, z, HEBEL, { ...h.zustand, open_bit: true });
      const l = RZ.erzeuge(w);
      l.laufe(6);
      assert.deepEqual(offeneFalltueren(l), [falltuer.join(',')], `Nische ${i}, Hebel y=${y}`);
    }
  }
});

test('Handelsnischen an der Lorenbahn: ohne Strom bleibt alles zu, die Aktivierungsschienen sind dauerhaft an', () => {
  const n = 5;
  const { nass } = reihe(n);
  assert.ok(bloeckeVon(nass, FALLTUER).every((t) => t.zustand.open_bit === false), 'alle Falltüren sind beim Aufbau zu');
  assert.ok(bloeckeVon(nass, HEBEL).every((h) => h.zustand.open_bit === false), 'alle Hebel sind aus');
  const l = RZ.erzeuge(nass);
  l.laufe(40);
  assert.deepEqual(offeneFalltueren(l), []);
  const akt = bloeckeVon(nass, AKT);
  assert.equal(akt.length, n);
  assert.ok(akt.every((a) => a.zustand.rail_data_bit === true));
  // Antrieb von Ebene 1 bestätigt es: jede Antriebs- und Aktivierungsschiene ist bestromt
  const pos = (b) => `${b.x},${b.y},${b.z}`;
  const versorgtAkt = e1.aktivierung.aktive(nass, []);
  assert.deepEqual(akt.map(pos).sort(), [...versorgtAkt].sort(), 'jede Aktivierungsschiene hat ihren Redstone-Block');
  const versorgtAntrieb = e1.antrieb.aktive(nass, []);
  assert.deepEqual(bloeckeVon(nass, 'minecraft:golden_rail').map(pos).sort(), [...versorgtAntrieb].sort(), 'jede Antriebsschiene ist versorgt');
  const golden = bloeckeVon(nass, 'minecraft:golden_rail');
  assert.ok(golden.length >= 2 * n);
  assert.ok(golden.every((g) => g.zustand.rail_data_bit === true));
});

test('Handelsnischen an der Lorenbahn: Stich und Zufuhr (Lorenbahn lückenlos, Auswurf nur an der letzten Schiene)', () => {
  const n = 4;
  const { nass } = reihe(n);
  for (let i = 0; i < n; i++) {
    const b = e1.lore.bahn(nass, { x: 2 * i + 1, y: 3, z: -3 }, 'south');
    assert.deepEqual(b.schienen.map((s) => [s.pos.x, s.pos.y, s.pos.z, s.id]), [
      [2 * i + 1, 3, -3, 'minecraft:golden_rail'], [2 * i + 1, 3, -2, 'minecraft:golden_rail'], [2 * i + 1, 3, -1, AKT],
    ]);
    assert.deepEqual(e1.lore.analysiere(b), [], `Stich ${i}`);
  }
  // Zufuhrbahn: Antriebsschiene höchstens alle 8 Schienen, durchgehend von Westen nach Osten
  const zufuhr = e1.lore.bahn(nass, { x: -1, y: 3, z: -4 }, 'east');
  assert.equal(zufuhr.schienen.length, 2 * n + 1);
  let normale = 0;
  for (const s of zufuhr.schienen) { if (s.antrieb) normale = 0; else normale++; assert.ok(normale <= 7, `Abstand ${normale}`); }
  // ein nicht angetriebener Stich würde nichts auswerfen
  const aus = kopie(nass);
  aus.setzeBlock(1, 3, -1, AKT, { rail_direction: 0, rail_data_bit: false });
  const { dorf } = mitLore(aus, 0);
  assert.ok(dorf);
  const l = RZ.erzeuge(aus);
  const m = PA.mechanik();
  l.taktgeber.registriere(m);
  l.laufe(6);
  assert.equal(m.ereignisse.length, 0);
});

test('Handelsnischen an der Lorenbahn: gedreht um 90°, 180°, 270° bleibt die Kette richtig', () => {
  const n = 4;
  for (let k = 1; k <= 3; k++) {
    const { w } = reihe(n);
    const { lore, dorf } = mitLore(w, n - 1);
    assert.ok(lore && dorf);
    const gedreht = e0.vermesser.drehe(w.ausschnitt({ x: -10, y: -20, z: -10 }, { x: 30, y: 10, z: 10 }), k);
    const g = e0.neueWelt();
    g.fuegeBauteilEin(gedreht);
    const nass = e1.fluessigkeit.simuliere(g).welt;
    const l = RZ.erzeuge(nass);
    const m = PA.mechanik();
    l.taktgeber.registriere(m);
    l.laufe(4);
    const ev = m.ereignisse[0];
    assert.equal(ev?.ok, true, `k=${k}: Auswurf`);
    assert.equal(ev.kandidat, 'rechts', `k=${k}`);
    assert.equal(l.welt.leseBlock(ev.ziel.x, ev.ziel.y, ev.ziel.z).id, FALLTUER, `k=${k}: Deckenklappe`);
    // Deckenklappe auf, Bodenfalltür auf (beide Hebel liegen daneben und drehen mit)
    const hebel = bloeckeVon(l.welt, HEBEL).filter((h) => Math.abs(h.x - ev.ziel.x) + Math.abs(h.z - ev.ziel.z) <= 2 && (h.y === 3 || h.y === 0));
    assert.equal(hebel.length >= 2, true);
    for (const h of hebel.filter((q) => q.y === 3)) l.welt.setzeBlock(h.x, h.y, h.z, HEBEL, { ...h.zustand, open_bit: true });
    l.laufe(6);
    const f1 = e1.bewegung.faellt(l.welt, ev.ziel, 'dorfbewohner');
    assert.equal(f1.ok, true);
    assert.equal(f1.ziel.y, 0, `k=${k}: Stehzelle`);
    for (const h of hebel.filter((q) => q.y === 0)) l.welt.setzeBlock(h.x, h.y, h.z, HEBEL, { ...h.zustand, open_bit: true });
    l.laufe(6);
    const f2 = e1.bewegung.faellt(l.welt, f1.ziel, 'dorfbewohner');
    assert.equal(f2.art, 'wasser', `k=${k}`);
    const t = e1.stroemung.treibe(l.welt, f2.ziel);
    assert.equal(t.grund, 'ende', `k=${k}`);
    // Länge des Weges wie in der ungedrehten Reihe
    const ref = kette(n, n - 1);
    assert.equal(t.weg.length, ref.t.weg.length, `k=${k}: gleicher Weg`);
  }
});

test('Handelsnischen an der Lorenbahn: Prüfer ohne Verstoß, Berufsblock neben der Stehzelle, Stehzelle sonst dicht', () => {
  for (const n of [1, 3, 8]) {
    const { nass } = reihe(n);
    const m = e1.pruefe(nass, { schienen: null, dorf: e1.dorf, dorfPruefen: true });
    assert.deepEqual(m.filter((x) => x.schwere === 'verstoss'), [], `n=${n}`);
    for (let i = 0; i < n; i++) {
      assert.ok(e0.register.bloecke.block(nass.leseBlock(2 * i, 0, -2).id).eigenschaften.beruf, 'Berufsblock hinter der Stehzelle');
      // aus der Stehzelle (Bodenfalltür zu) kommt der Dorfbewohner nirgends hin
      for (const art of ['dorfbewohner', 'baby']) {
        const erg = e1.bewegung.erreichbar(nass, { x: 2 * i, y: 0, z: -1 }, art);
        const zellen = new Set([...erg.zustaende.values()].map((s) => `${s.x},${s.z}`));
        assert.deepEqual([...zellen], [`${2 * i},-1`], `Nische ${i} ${art}`);
      }
    }
  }
});

test('Handelsnischen an der Lorenbahn: Technik skaliert über Anzahl, Anschlüsse, Parameter, deterministisch', () => {
  const zaehle = (p, id) => p.bloecke.filter((b) => b.id === id).length;
  for (const n of [1, 2, 5, 40]) {
    const p = baue(n);
    assert.equal(zaehle(p, AKT), n);
    assert.equal(zaehle(p, FALLTUER), 2 * n);
    assert.equal(zaehle(p, HEBEL), 2 * n);
    assert.equal(p.anschluesse.map((a) => a.art).join(), 'front,zufuhr,rueckfuehrung,weichen');
    assert.equal(p.anschluesse[3].stellen.length, n, 'eine Weichenstelle je Nische');
    assert.deepEqual(p.anschluesse[2], { art: 'rueckfuehrung', seite: 'ost', x: kanalEnde(n).x, y: kanalEnde(n).y, z: -1, gefaelle: Math.max(1, Math.ceil((2 * n + 1) / K)) - 1 });
  }
  // je Nische gleich viele Blöcke oberhalb des Bodens; nur der Kanal wird mit der Länge tiefer (Gefälle)
  const ueber = (n) => baue(n).bloecke.filter((b) => b.y >= 0).length;
  assert.equal(ueber(3) - ueber(2), ueber(10) - ueber(9));
  const h = (n) => baue(n).platzbedarf.huelle;
  assert.deepEqual([h(5).von.z, h(5).bis.z, h(5).bis.y], [h(1).von.z, h(1).bis.z, h(1).bis.y]);
  assert.ok(h(40).von.y < h(5).von.y, 'längere Reihe = tieferer Kanal');
  assert.deepEqual(baue(4), baue(4), 'deterministisch');
  assert.notDeepEqual(baue(4, { beruf: 3 }), baue(4));
  assert.throws(() => baue(0), /außerhalb/);
  assert.throws(() => baue(257), /außerhalb/);
  assert.throws(() => baue(4, { kanalstufe: 7 }), /außerhalb/);
  assert.throws(() => baue(4, { kanalstufe: 5 }), /gerade/);
  assert.throws(() => baue(4, { beruf: 13 }), /außerhalb/);
  // kürzere Gefällestufen bleiben richtig (Wasser fließt weit genug)
  for (const kanalstufe of [2, 4]) {
    const { nass } = reihe(7, { kanalstufe });
    assert.equal(e1.pruefe(nass, { schienen: null, dorf: e1.dorf, dorfPruefen: true }).filter((x) => x.schwere === 'verstoss').length, 0);
  }
});

test('Handelsnischen an der Lorenbahn: 192 Nischen: Wasser läuft durch das ganze Gefälle bis zum Kanalende', () => {
  const n = 192;
  const p = baue(n);
  assert.equal(p.bloecke.filter((b) => b.id === AKT).length, n);
  assert.equal(p.anschluesse[2].gefaelle, Math.ceil((2 * n + 1) / K) - 1);
  const w = e0.neueWelt();
  e2.platziere(w, p, TESTPALETTE, { x: 0, y: 70, z: 0 }); // 192 Nischen: der Kanal ist 65 Blöcke tief
  const nass = e1.fluessigkeit.simuliere(w, { maxTicks: 6000 }).welt;
  const ende = kanalEnde(n);
  assert.equal(nass.leseBlock(ende.x, ende.y + 70, ende.z).id, 'minecraft:flowing_water', 'Wasser erreicht das Kanalende');
});
