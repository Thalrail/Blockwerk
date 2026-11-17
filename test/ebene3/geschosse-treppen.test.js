// D4.2: Geschosse und Treppen im Turm-Rezept über die ganze Pipeline (Spezifikation → Planung → Welt) und mit dem Bewegungsmodell von Ebene 1.
// Geprüft: von der Tür bis auf jede Etage begehbar (Spieler, Dorfbewohner, Baby je nach Treppenform), Ausrichtung der Treppenblöcke, Prüfer Ebene 1, messeAufbau, Eingang und Fenster bleiben, Determinismus.
// Die Begehbarkeit stützt sich auf das Bewegungsmodell von Ebene 1 (Java-Annahme, ungeprüft): hier ein Modellbeweis, kein Bedrock-Beweis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloeckeAusEntwurf, messeAufbau } from '../../src/ebene3/index.js';
import { TESTPALETTE } from '../../src/ebene2/index.js';
import { engine } from '../ebene5/hilfe5.js';

const ETAGE = 5;
const spec = (b, t, h, merkmale, stil = { stimmung: 'hell-nordisch' }) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D4', bauplatz: { breite: 140, hoehe: 140, tiefe: 140 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', ...(merkmale ? { merkmale } : {}), form: { groesse: { breite: b, tiefe: t, hoehe: h } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil }],
});
const plane = async (b, t, h, merkmale, stil) => {
  const e = await engine();
  const r = e.ebene4.baue(e.ebene4.freigeben(spec(b, t, h, merkmale, stil), 'test'));
  return { e, r };
};
const idVon = (c) => c.id ?? c.block?.id ?? '';
const AUSSEN = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const RICHTUNG = (dx, dz) => (dx === 1 ? 'east' : dx === -1 ? 'west' : dz === 1 ? 'south' : 'north');

/** Welt des Entwurfs mit Gelände (Stein unter y0 über die ganze Fläche, auch innen) und der Tür von außen. */
function welt(e, entwurf) {
  const w = e.ebene3.materialisiere(entwurf).welt;
  const bl = w.alleBloecke();
  const mm = (a) => [Math.min(...bl.map((c) => c[a])), Math.max(...bl.map((c) => c[a]))];
  const [x0, x1] = mm('x'), [z0, z1] = mm('z'), [y0, y1] = mm('y');
  for (let x = x0 - 30; x <= x1 + 30; x++) for (let z = z0 - 30; z <= z1 + 30; z++) if (w.istLuft(x, y0 - 1, z)) w.setzeBlock(x, y0 - 1, z, 'minecraft:stone');
  const tuer = bl.filter((c) => /_door$/.test(c.id) && !c.zustand.upper_block_bit).sort((p, q) => p.x - q.x || p.z - q.z)[0];
  const [dx, dz] = AUSSEN[tuer.zustand['minecraft:cardinal_direction']];
  return { w, x0, x1, z0, z1, y0, y1, von: { x: tuer.x + 3 * dx, y: y0, z: tuer.z + 3 * dz } };
}
/** Eine Stehstelle auf der Ebene L (Fußboden = Decke darunter, 2 Blöcke frei darüber), möglichst nahe der Mitte. */
function stehstelle(g, L) {
  const y = g.y0 + L * ETAGE, cx = (g.x0 + g.x1) / 2, cz = (g.z0 + g.z1) / 2;
  let beste = null;
  for (let x = g.x0; x <= g.x1; x++) for (let z = g.z0; z <= g.z1; z++) {
    if (g.w.istLuft(x, y - 1, z) || g.w.leseBlock(x, y - 1, z).id === 'minecraft:ladder' || !g.w.istLuft(x, y, z) || !g.w.istLuft(x, y + 1, z)) continue; // Boden: fester Block, keine Leiter
    const d = Math.hypot(x - cx, z - cz);
    if (!beste || d < beste.d) beste = { x, y, z, d };
  }
  return beste;
}

const GROESSEN = [[11, 11, 24], [12, 12, 30], [13, 13, 34], [13, 12, 34], [12, 13, 34], [17, 17, 40], [21, 16, 45]];
const FORMEN = ['auto', 'wendel', 'gerade', 'leiter'];

test('Größenreihe × Treppenformen: entweder eine klare Rückfrage (nie ein stiller Wechsel) oder durchgehend begehbar von der Tür bis zur obersten Ebene', async () => {
  const e = await engine();
  const B = e.ebene1.bewegung;
  let geprueft = 0, rueckfragen = 0;
  for (const [b, t, h] of GROESSEN) for (const form of FORMEN) {
    const name = `${b}×${t}×${h} ${form}`;
    const merkmale = { eingang: 'sued', fenster: 'schlitze', geschosse: 'standard', ...(form === 'auto' ? {} : { treppe: form }) };
    const r = e.ebene4.baue(e.ebene4.freigeben(spec(b, t, h, merkmale), 'test'));
    if (r.status !== 'fertig') { // Platzproblem: muss eine verständliche Rückfrage zur Treppe sein
      assert.match(JSON.stringify(r.rueckfragen), /keine einzige Etage möglich/, `${name}: ${JSON.stringify(r.rueckfragen).slice(0, 300)}`);
      rueckfragen++;
      continue;
    }
    const info = e.ebene3.rezepte.wendeRezeptAn('turm', { breite: b, tiefe: t, hoehe: h }, 'turm', merkmale).geschosse;
    assert.ok(info.etagen >= 1, name);
    if (form !== 'auto') assert.equal(info.treppe, form, `${name}: die gewählte Form bleibt (kein stiller Wechsel)`);
    else assert.ok(['wendel', 'gerade'].includes(info.treppe), `${name}: auto wählt nie die Leiter`);
    const g = welt(e, r.entwurf);
    for (let L = 1; L <= info.etagen; L++) {
      const ziel = stehstelle(g, L);
      assert.ok(ziel, `${name}: Ebene ${L} hat keine nutzbare Austrittsfläche`);
      for (const art of ['spieler', 'dorfbewohner', 'baby']) {
        const erg = B.weg(g.w, g.von, ziel, art, { radius: 70 });
        assert.equal(erg.ok, info.begehbar.includes(art), `${name}, Ebene ${L}, ${art}: ${erg.ok ? 'kam hinauf, obwohl die Form es nicht verspricht' : erg.grund}`);
      }
    }
    geprueft++;
  }
  assert.ok(geprueft >= 15 && rueckfragen >= 3, `geprüft ${geprueft}, Rückfragen ${rueckfragen}`);
});

test('Treppenblöcke: Ausrichtung folgt dem Aufstieg (jede Stufe blickt zur nächsten höheren), alle vier Drehungen und beide Spuren der geraden Treppe', async () => {
  const e = await engine();
  // Referenzzustand je Richtung: ein einzelner Treppenblock über denselben Ebene-2-Weg
  const referenz = {};
  for (const d of ['north', 'east', 'south', 'west']) {
    const w = e.ebene0.neueWelt();
    e.ebene2.platziere(w, { bloecke: [{ x: 0, y: 0, z: 0, rolle: 'boden', form: 'treppe', richtung: d }] }, TESTPALETTE, { x: 0, y: 0, z: 0 }, e.ebene0);
    referenz[d] = JSON.stringify(w.leseBlock(0, 0, 0).zustand);
  }
  for (const [b, t, h, form] of [[13, 13, 34, 'wendel'], [13, 13, 34, 'gerade'], [17, 17, 40, 'wendel'], [21, 16, 45, 'gerade'], [12, 12, 30, 'wendel']]) {
    const { r } = await plane(b, t, h, { eingang: 'sued', geschosse: 'standard', treppe: form });
    assert.equal(r.status, 'fertig', `${b}×${t}×${h} ${form}`);
    const w = e.ebene3.materialisiere(r.entwurf).welt;
    const stufen = w.alleBloecke().filter((c) => /_stairs$/.test(c.id)).sort((p, q) => p.y - q.y);
    assert.ok(stufen.length >= 5, `${b}×${t}×${h} ${form}: Stufen vorhanden`);
    let geprueft = 0;
    for (const s of stufen) {
      const nachste = stufen.filter((q) => q.y === s.y + 1 && Math.abs(q.x - s.x) + Math.abs(q.z - s.z) === 1)[0];
      if (!nachste) continue; // oberste Stufe einer Etage: die nächste Etage beginnt auf Geschosshöhe über der Decke
      assert.equal(JSON.stringify(s.zustand), referenz[RICHTUNG(nachste.x - s.x, nachste.z - s.z)], `${b}×${t}×${h} ${form}: Stufe (${s.x}, ${s.y}, ${s.z}) blickt nicht zur nächsten`);
      geprueft++;
    }
    assert.ok(geprueft >= 3, `${b}×${t}×${h} ${form}: Ausrichtung geprüft (${geprueft})`);
  }
});

test('Baubarkeit: Prüfer Ebene 1 ohne Verstoß, keine unverbundenen Blöcke, nichts freischwebend, Hilfspunkte nur an Treppenstufen (höchstens 3 je Etage)', async () => {
  for (const [b, t, h] of [[11, 11, 24], [13, 13, 34], [13, 12, 34], [17, 17, 40], [21, 21, 45]]) for (const form of ['wendel', 'gerade']) {
    const { e, r } = await plane(b, t, h, { eingang: 'sued', fenster: 'schlitze', geschosse: 'standard', treppe: form });
    if (r.status !== 'fertig') continue; // Platzproblem: eigener Test
    const name = `${b}×${t}×${h} ${form}`;
    const verstoesse = e.ebene3.pruefeEntwurf(r.entwurf, e.ebene3.materialisiere(r.entwurf)).filter((x) => x.schwere === 'verstoss');
    assert.deepEqual(verstoesse, [], `${name}: Verstöße`);
    const bl = bloeckeAusEntwurf(e.ebene3, r.entwurf), am = messeAufbau(bl);
    assert.equal(am.unverbunden.bloecke, 0, `${name}: unverbunden`);
    assert.equal(am.hilfsmassnahmen.frei, 0, `${name}: freischwebende Blöcke`);
    const etagen = e.ebene3.rezepte.wendeRezeptAn('turm', { breite: b, tiefe: t, hoehe: h }, 'turm', { eingang: 'sued', fenster: 'schlitze', geschosse: 'standard', treppe: form }).geschosse.etagen;
    assert.ok(am.hilfsmassnahmen.punkte <= 3 * etagen, `${name}: ${am.hilfsmassnahmen.punkte} Hilfspunkte bei ${etagen} Etagen`);
    // ohne Geschosse (nur Eingang und Fenster) gibt es keine Hilfspunkte: alle kommen von den Treppen
    const ohne = await plane(b, t, h, { eingang: 'sued', fenster: 'schlitze' });
    assert.equal(messeAufbau(bloeckeAusEntwurf(ohne.e.ebene3, ohne.r.entwurf)).hilfsmassnahmen.punkte, 0, name);
  }
});

test('Eingang, Fenster und Dach bleiben: Tür und Scheiben wie ohne Geschosse an derselben Stelle, Fenster nie in einer Deckenschicht, Dach unverändert', async () => {
  for (const [b, t, h] of [[13, 13, 34], [17, 17, 40], [21, 21, 45]]) {
    const mit = await plane(b, t, h, { eingang: 'sued', fenster: 'schlitze', geschosse: 'standard', treppe: 'wendel' });
    const ohne = await plane(b, t, h, { eingang: 'sued', fenster: 'schlitze' });
    assert.equal(mit.r.status, 'fertig');
    const blM = bloeckeAusEntwurf(mit.e.ebene3, mit.r.entwurf), blO = bloeckeAusEntwurf(ohne.e.ebene3, ohne.r.entwurf);
    const tuerM = blM.filter((c) => /_door$/.test(idVon(c))).map((c) => `${c.x},${c.y},${c.z}`).sort(), tuerO = blO.filter((c) => /_door$/.test(idVon(c))).map((c) => `${c.x},${c.y},${c.z}`).sort();
    assert.deepEqual(tuerM, tuerO, `${b}×${t}×${h}: dieselbe Tür`);
    const scheiben = blM.filter((c) => /_pane$/.test(idVon(c)));
    assert.ok(scheiben.length > 0, 'Fenster vorhanden');
    const y0 = Math.min(...blM.map((c) => c.y));
    for (const s of scheiben) {
      const rel = s.y - y0, innerhalb = rel % ETAGE;
      assert.ok(innerhalb === 2 || innerhalb === 3, `${b}×${t}×${h}: Fenster in Höhe ${rel} liegt nicht an der Brüstung über dem Fußboden (2 oder 3 über der Decke)`);
    }
    // Das Dach (Kegel) behält seine Außenhülle: jeder Block der Wand ohne Geschosse ist auch mit Geschossen da (nur Öffnungen für Fenster ändern sich)
    const mengeM = new Set(blM.map((c) => `${c.x},${c.y},${c.z}`));
    const dachAb = Math.max(...blO.filter((c) => c.y - y0 >= h - Math.floor(h * 0.3)).map((c) => c.y)) - Math.floor(h * 0.2);
    for (const c of blO) if (c.y > dachAb && !/_pane$/.test(idVon(c))) assert.ok(mengeM.has(`${c.x},${c.y},${c.z}`), `Dachblock (${c.x}, ${c.y}, ${c.z}) fehlt`);
  }
});

test('Determinismus und stabile Kennungen: zweimal planen gleich, Kennungen Etage und Glied, Rückwärtskompatibilität ohne geschosse', async () => {
  const m = { eingang: 'sued', fenster: 'schlitze', geschosse: 'standard', treppe: 'wendel' };
  const a = await plane(13, 13, 34, m), b = await plane(13, 13, 34, m);
  assert.deepEqual(a.r.entwurf, b.r.entwurf);
  const refs = a.r.entwurf.teile.map((p) => p.ref).filter((x) => /^turm\.treppe-/.test(x));
  assert.ok(refs.length >= 4 && refs.every((x) => /^turm\.treppe-\d+-[a-z-]+$/.test(x)));
  assert.equal(new Set(refs).size, refs.length);
  // ohne geschosse: byte-identisch zu einem Entwurf ohne jede Spur von Geschossen
  const ohne = await plane(13, 13, 34, { eingang: 'sued', fenster: 'schlitze' });
  assert.ok(ohne.r.entwurf.teile.every((p) => p.parameter?.deckenAnzahl === undefined && p.parameter?.innenzone === undefined && p.parameter?.deckenLoecher === undefined));
  assert.ok(!ohne.r.entwurf.teile.some((p) => /treppe|leiter/.test(p.ref ?? '')));
});

test('Platzproblem: kleine Türme bekommen eine verständliche Rückfrage, nie einen stillen Wechsel; ausdrückliche Leiter geht nur für den Spieler und sagt es', async () => {
  const e = await engine();
  const klein = e.ebene4.baue(e.ebene4.freigeben(spec(9, 9, 16, { eingang: 'sued', geschosse: 'standard' }), 'test'));
  assert.notEqual(klein.status, 'fertig');
  const text = JSON.stringify(klein.rueckfragen);
  assert.match(text, /keine einzige Etage möglich/);
  assert.match(text, /Leiter an der Wand \(nur für Spieler\) \(1 Etage\)/, 'die Rückfrage nennt, was ginge');
  assert.match(text, /Turm größer machen/);
  // gerade Treppe in einem Turm, in dem nur die Wendeltreppe passt: Rückfrage statt Wechsel
  const gerade = e.ebene4.baue(e.ebene4.freigeben(spec(11, 11, 24, { eingang: 'sued', geschosse: 'standard', treppe: 'gerade' }), 'test'));
  assert.notEqual(gerade.status, 'fertig');
  assert.match(JSON.stringify(gerade.rueckfragen), /Wendeltreppe um die Mitte \(3 Etagen\)/);
  // ausdrückliche Leiter: fertig, mit sichtbarem Hinweis
  const leiter = await plane(9, 9, 16, { eingang: 'sued', geschosse: 'standard', treppe: 'leiter' });
  assert.equal(leiter.r.status, 'fertig');
  assert.match(JSON.stringify(leiter.r.hinweise ?? leiter.r), /nur für den Spieler begehbar/);
  // Treppenform ohne Geschosse: Rückfrage
  const ohneGeschosse = e.ebene4.baue(e.ebene4.freigeben(spec(13, 13, 34, { eingang: 'sued', treppe: 'wendel' }), 'test'));
  assert.notEqual(ohneGeschosse.status, 'fertig');
});
