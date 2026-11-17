// D3: Merkmale des Turm-Rezepts (Eingang, Fensterschlitze) über die ganze Pipeline: Platzierung, Wanddurchdringung, Begehbarkeit, Baubarkeit (Prüfer Ebene 1, messeAufbau),
// Symmetrie, Determinismus, Rückwärtskompatibilität, Konflikte der Materialwahl und der Spezifikation. Ohne `merkmale` ändert sich nichts (die Goldens der D2-Tests bleiben unberührt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloeckeAusEntwurf, messeAufbau } from '../../src/ebene3/index.js';
import { engine } from '../ebene5/hilfe5.js';

const spec = (b, t, h, merkmale, stil = { stimmung: 'hell-nordisch' }) => ({
  schema: 1, version: 1,
  projekt: { name: 'Turm D3', bauplatz: { breite: 140, hoehe: 140, tiefe: 140 }, massstab: 1 },
  teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', ...(merkmale !== undefined ? { merkmale } : {}), form: { groesse: { breite: b, tiefe: t, hoehe: h } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil }],
});
// auch gemischte Paritäten (Breite ungerade, Tiefe gerade und umgekehrt): die Öffnung folgt der Parität der jeweiligen Wand
const REIHE = [[9, 9, 16], [11, 11, 24], [12, 12, 30], [13, 13, 34], [18, 18, 40], [21, 15, 45], [21, 21, 45], [45, 45, 80], [30, 14, 36], [13, 12, 34], [12, 13, 34], [21, 16, 45], [16, 21, 45]];
const RICHTUNG = { nord: 'north', ost: 'east', sued: 'south', west: 'west' }; // Bedrock-Zustand der Tür: sie blickt nach außen
const SEITEN = ['nord', 'ost', 'sued', 'west'];
const AUSSEN = { nord: [0, -1], sued: [0, 1], west: [-1, 0], ost: [1, 0] }; // Schritt nach außen (dx, dz)

async function plane(b, t, h, merkmale, stil) {
  const e = await engine();
  const r = e.ebene4.baue(e.ebene4.freigeben(spec(b, t, h, merkmale, stil), 'test'));
  return { e, r };
}
const idVon = (c) => c.id ?? c.block?.id ?? '';
const kartiere = (bl) => new Map(bl.map((c) => [`${c.x},${c.y},${c.z}`, c]));

/** Mitte des Turms (kleinere Mittelzelle bei gerader Breite) aus den Blöcken. */
function mitteVon(bl) {
  const mm = (a) => [Math.min(...bl.map((c) => c[a])), Math.max(...bl.map((c) => c[a]))];
  const [x0, x1] = mm('x'), [z0, z1] = mm('z');
  return { x0, x1, z0, z1, cx: x0 + Math.floor((x1 - x0) / 2), cz: z0 + Math.floor((z1 - z0) / 2) };
}

/** Von einer Öffnungszelle nach innen bis zur Mitte: jede Zelle dazwischen muss frei sein; die Zelle davor (außen) auch. */
function durchgang(karte, zelle, seite, m, wo) {
  const [dx, dz] = AUSSEN[seite];
  const aussen = karte.get(`${zelle.x + dx},${zelle.y},${zelle.z + dz}`);
  assert.equal(aussen, undefined, `${wo}: außen vor der Öffnung ist ein Block (${aussen && idVon(aussen)})`);
  const quer = seite === 'nord' || seite === 'sued';
  let x = zelle.x - dx, z = zelle.z - dz;
  for (let schritt = 0; schritt < 100; schritt++) {
    const b = karte.get(`${x},${zelle.y},${z}`);
    assert.equal(b, undefined, `${wo}: im Durchgang bei (${x}, ${zelle.y}, ${z}) steht ${b && idVon(b)}`);
    if (quer ? z === m.cz : x === m.cx) return; // die Mitte des Innenraums ist erreicht
    x -= dx; z -= dz;
  }
  assert.fail(`${wo}: die Mitte wurde nicht erreicht`);
}

test('Größenreihe × vier Seiten: Eingang und Fenster sitzen mittig, gehen durch die ganze Wand, führen in den Innenraum, Außenmaß exakt', async () => {
  for (const [b, t, h] of REIHE) {
    for (const seite of SEITEN) {
      const { e, r } = await plane(b, t, h, { eingang: seite, fenster: 'schlitze' });
      const name = `${b}×${t}×${h} Eingang ${seite}`;
      assert.equal(r.status, 'fertig', `${name}: ${JSON.stringify(r.rueckfragen ?? '').slice(0, 300)}`);
      const bl = bloeckeAusEntwurf(e.ebene3, r.entwurf), karte = kartiere(bl), m = mitteVon(bl);
      assert.deepEqual([m.x1 - m.x0 + 1, m.z1 - m.z0 + 1], [b, t], `${name}: Außenmaß`);
      // Tür: Blöcke der Tür sind echte Türen (unten und oben), 1 Flügel bei ungerader, 2 bei gerader Breite, auf der gewählten Seite mittig
      const tueren = bl.filter((c) => /_door$/.test(idVon(c)));
      const breite = (seite === 'nord' || seite === 'sued' ? b : t) % 2 === 0 ? 2 : 1;
      assert.equal(tueren.length, 2 * breite, `${name}: Türblöcke`);
      assert.deepEqual([...new Set(tueren.map((c) => c.y))].sort((p, q) => p - q), [0, 1].map((k) => Math.min(...tueren.map((c) => c.y)) + k), `${name}: zwei Blöcke hoch`);
      assert.equal(Math.min(...tueren.map((c) => c.y)), Math.min(...bl.map((c) => c.y)), `${name}: die Tür steht auf Bodenhöhe`);
      const achse = seite === 'nord' || seite === 'sued' ? 'x' : 'z', mitte = achse === 'x' ? m.cx : m.cz;
      assert.deepEqual([...new Set(tueren.map((c) => c[achse]))].sort((p, q) => p - q), breite === 1 ? [mitte] : [mitte, mitte + 1], `${name}: symmetrisch zur Mitte`);
      for (const c of tueren.filter((q) => q.y === Math.min(...tueren.map((p) => p.y)))) durchgang(karte, c, seite, m, `${name} Tür`);
      // Zustände der Tür (Welt): Blickrichtung nach außen, obere Hälfte passt zur unteren, bei zwei Flügeln gegensätzliche Scharniere
      const welt = e.ebene3.materialisiere(r.entwurf).welt;
      const tw = welt.alleBloecke().filter((c) => /_door$/.test(c.id)).map((c) => ({ ...c, st: c.zustand }));
      for (const c of tw) assert.equal(c.st['minecraft:cardinal_direction'], RICHTUNG[seite], `${name}: Tür schaut nach außen`);
      const unten = tw.filter((c) => !c.st.upper_block_bit).sort((p, q) => p.x - q.x || p.z - q.z);
      assert.equal(unten.length, breite);
      if (breite === 2) assert.notEqual(unten[0].st.door_hinge_bit, unten[1].st.door_hinge_bit, `${name}: zwei Flügel mit gegensätzlichen Scharnieren`);
      for (const u of unten) assert.equal(tw.find((o) => o.x === u.x && o.z === u.z && o.st.upper_block_bit).st.door_hinge_bit, u.st.door_hinge_bit, `${name}: obere Hälfte wie untere`);
      // Fenster: jede Scheibe hat einen freien Durchgang nach innen und freien Raum davor
      const scheiben = bl.filter((c) => /_pane$/.test(idVon(c)));
      if (b >= 11 && t >= 11) assert.ok(scheiben.length > 0, `${name}: Fenster fehlen`);
      for (const c of scheiben) {
        // die Scheibe liegt an der äußersten Zellschicht ihrer Seite im Glied (nicht unbedingt der Außenrand des Turms); die Seite folgt aus der Lage zur Mitte
        const seiteC = Math.abs(c.x - m.cx) <= 1 && Math.abs(c.z - m.cz) > 1 ? (c.z < m.cz ? 'nord' : 'sued') : (c.x < m.cx ? 'west' : 'ost');
        durchgang(karte, c, seiteC, m, `${name} Fenster (${c.x}, ${c.y}, ${c.z})`);
      }
      // Baubarkeit: Prüfer Ebene 1 ohne Verstoß, keine unverbundenen Teile, keine Hilfspunkte
      const verstoesse = e.ebene3.pruefeEntwurf(r.entwurf, e.ebene3.materialisiere(r.entwurf)).filter((x) => x.schwere === 'verstoss');
      assert.deepEqual(verstoesse, [], `${name}: Verstöße des Prüfers`);
      const am = messeAufbau(bl);
      assert.equal(am.unverbunden.bloecke, 0, `${name}: unverbundene Blöcke`);
      assert.equal(am.hilfsmassnahmen.punkte, 0, `${name}: Hilfspunkte`);
    }
  }
});

test('Fenster: nur in den Schaftgliedern mit Randzeile, nie im Sockel, in der Krone oder im Dach, nie unter oder auf dem Eingang', async () => {
  for (const [b, t, h] of REIHE) {
    const { e, r } = await plane(b, t, h, { eingang: 'sued', fenster: 'schlitze' });
    const glieder = new Map(r.entwurf.teile.filter((p) => /^turm\.(sockel|schaft|krone|dach)/.test(p.ref ?? '')).map((p) => [p.ref, p]));
    const fenster = r.entwurf.teile.filter((p) => /^turm\.fenster-/.test(p.ref));
    if (b >= 11 && t >= 11) assert.ok(fenster.length >= 2, `${b}×${t}×${h}: mindestens ein Geschoss mit Fenstern`);
    for (const f of fenster) {
      assert.match(f.traeger, /^turm\.schaft-(unten|oben)$/, `${f.ref}: Träger`);
      const tr = glieder.get(f.traeger), hoeheTr = tr.parameter.hoehe;
      const y0 = f.einbau.versatz.y, hoehe = f.parameter.hoehe;
      assert.ok(y0 >= 1 && y0 + hoehe <= hoeheTr - 1, `${f.ref}: ganz im Glied mit je einer Randzeile (y ${y0}, Höhe ${hoehe}, Glied ${hoeheTr})`);
    }
    // eindeutige, stabile Kennungen: Glied-Seite-Nummer
    assert.equal(new Set(fenster.map((f) => f.ref)).size, fenster.length);
    assert.ok(fenster.every((f) => /^turm\.fenster-schaft-(unten|oben)-(nord|ost|sued|west)-\d+$/.test(f.ref)));
    // Die Tür sitzt im Sockel, der mindestens drei Schichten hoch ist (zwei Blöcke Tür, ein Block Sturz)
    assert.ok(glieder.get('turm.sockel').parameter.hoehe >= 3, `${b}×${t}×${h}: Sockel mit Sturz`);
    void e;
  }
});

test('Symmetrie: Fenster allein lassen beide Achsen symmetrisch, ein Eingang bricht nur die Achse quer zu seiner Seite', async () => {
  const spiegel = (bl, achse) => {
    const m = mitteVon(bl), s = achse === 'x' ? m.x0 + m.x1 : m.z0 + m.z1;
    const mengeAus = (f) => new Set(bl.map((c) => `${f(c)}`));
    const orig = mengeAus((c) => `${c.x},${c.y},${c.z}`);
    const gespiegelt = mengeAus((c) => (achse === 'x' ? `${s - c.x},${c.y},${c.z}` : `${c.x},${c.y},${s - c.z}`));
    return orig.size === gespiegelt.size && [...orig].every((k) => gespiegelt.has(k));
  };
  for (const [b, t, h] of [[13, 13, 34], [12, 12, 30], [21, 15, 45], [30, 14, 36]]) {
    const nurFenster = await plane(b, t, h, { fenster: 'schlitze' });
    const blF = bloeckeAusEntwurf(nurFenster.e.ebene3, nurFenster.r.entwurf);
    assert.ok(spiegel(blF, 'x') && spiegel(blF, 'z'), `${b}×${t}×${h}: Fenster allein: beide Achsen`);
    for (const seite of SEITEN) {
      const { e, r } = await plane(b, t, h, { eingang: seite, fenster: 'schlitze' });
      const bl = bloeckeAusEntwurf(e.ebene3, r.entwurf);
      const quer = seite === 'nord' || seite === 'sued' ? 'x' : 'z'; // Spiegelung über die Achse entlang der Seite bleibt erhalten
      assert.ok(spiegel(bl, quer), `${b}×${t}×${h} Eingang ${seite}: Symmetrie bleibt entlang der Seite (${quer})`);
    }
  }
});

test('Rückwärtskompatibilität: ohne merkmale (fehlend oder leer) derselbe Entwurf, nichts Neues; zweimal planen ist identisch', async () => {
  const a = await plane(13, 13, 34);
  const b = await plane(13, 13, 34, {});
  const c = await plane(13, 13, 34);
  assert.equal(a.r.status, 'fertig');
  assert.deepEqual(a.r.entwurf, b.r.entwurf, 'leeres merkmale = kein merkmale');
  assert.deepEqual(a.r.entwurf, c.r.entwurf);
  assert.ok(a.r.entwurf.teile.every((p) => p.traeger === undefined && p.parameter?.wandzonen === undefined), 'keine Kinder, keine Zonen-Parameter ohne Merkmale');
  const mit1 = await plane(13, 13, 34, { eingang: 'sued', fenster: 'schlitze' }), mit2 = await plane(13, 13, 34, { eingang: 'sued', fenster: 'schlitze' });
  assert.deepEqual(mit1.r.entwurf, mit2.r.entwurf, 'Determinismus mit Merkmalen');
  // Die Glieder selbst bleiben bei bloßen Fenstern unverändert (Blöcke): Fenster ersetzen nur Wandblöcke
  const nurF = await plane(13, 13, 34, { fenster: 'schlitze' });
  const blA = bloeckeAusEntwurf(a.e.ebene3, a.r.entwurf), blF = bloeckeAusEntwurf(nurF.e.ebene3, nurF.r.entwurf);
  const karteA = kartiere(blA);
  for (const c2 of blF) if (!/_pane$/.test(idVon(c2))) assert.ok(karteA.has(`${c2.x},${c2.y},${c2.z}`), 'jeder Nicht-Fensterblock lag schon vorher dort');
});

test('Eingang: Hinweis statt Ersatzblock bei Eisentür und bei Materialwahl ohne Türblock; Holz- und Kupfertür gehen; Fenster allein brauchen keine Tür', async () => {
  const eisen = await plane(13, 13, 34, { eingang: 'sued' }, { stimmung: 'dunkel-industriell' });
  assert.notEqual(eisen.r.status, 'fertig');
  const text = JSON.stringify(eisen.r.rueckfragen);
  assert.match(text, /iron_door/);
  assert.match(text, /nicht von Hand/);
  assert.match(text, /minecraft\.wiki/, 'Quelle der Regel steht in der Meldung');
  const ohneTuer = await plane(13, 13, 34, { eingang: 'sued' }, { palette: { wand: 'minecraft:stone', akzent: 'minecraft:cobblestone', boden: 'minecraft:stone', licht: 'minecraft:glowstone', glas: { voll: 'minecraft:glass', scheibe: 'minecraft:glass_pane' } } });
  assert.notEqual(ohneTuer.r.status, 'fertig');
  assert.match(JSON.stringify(ohneTuer.r.rueckfragen), /keinen Türblock/);
  // Eisentür per Materialwahl durch eine Kupfertür ersetzt: geht
  const kupfer = await plane(13, 13, 34, { eingang: 'sued' }, { stimmung: 'dunkel-industriell', palette: { akzent: { tuer: 'minecraft:copper_door' } } });
  assert.equal(kupfer.r.status, 'fertig', JSON.stringify(kupfer.r.rueckfragen ?? ''));
  assert.ok(bloeckeAusEntwurf(kupfer.e.ebene3, kupfer.r.entwurf).some((c) => idVon(c) === 'minecraft:copper_door'));
  // Holztür der Stimmung hell-nordisch
  const holz = await plane(13, 13, 34, { eingang: 'ost' });
  assert.ok(bloeckeAusEntwurf(holz.e.ebene3, holz.r.entwurf).some((c) => idVon(c) === 'minecraft:spruce_door'));
  // Fenster allein mit der Eisen-Stimmung: keine Tür nötig
  const nurF = await plane(13, 13, 34, { fenster: 'schlitze' }, { stimmung: 'dunkel-industriell' });
  assert.equal(nurF.r.status, 'fertig');
});

test('Prüfer der Spezifikation: Merkmale nur mit Rezept, nur bekannte Namen, sonst Rückfrage mit den Möglichkeiten', async () => {
  const e = await engine();
  const pfade = (s) => e.ebene4.pruefe(s).rueckfragen.map((q) => q.pfad);
  assert.deepEqual(pfade(spec(13, 13, 34, { eingang: 'sued', fenster: 'schlitze' })), []);
  const ohneRezept = spec(13, 13, 34, { eingang: 'sued' }); delete ohneRezept.teile[0].rezept; ohneRezept.teile[0].form = { baustein: 'form.zylinder', groesse: { breite: 13, tiefe: 13, hoehe: 34 } };
  assert.ok(pfade(ohneRezept).includes('teile[0].merkmale'));
  assert.ok(pfade(spec(13, 13, 34, { eingang: 'oben' })).includes('teile[0].merkmale.eingang'));
  assert.ok(pfade(spec(13, 13, 34, { fenster: 'bogen' })).includes('teile[0].merkmale.fenster'));
  assert.ok(pfade(spec(13, 13, 34, { balkon: 'ja' })).includes('teile[0].merkmale.balkon'));
  assert.ok(pfade(spec(13, 13, 34, 'sued')).includes('teile[0].merkmale'));
  const frage = e.ebene4.pruefe(spec(13, 13, 34, { eingang: 'oben' })).rueckfragen[0];
  assert.match(frage.frage, /nord/); // die möglichen Seiten stehen in der Rückfrage
});

test('Mindestmaß: auch der kleinste Turm 9×9×16 trägt Eingang und Fenster (Sturz über der Tür)', async () => {
  const { e, r } = await plane(9, 9, 16, { eingang: 'nord', fenster: 'schlitze' });
  assert.equal(r.status, 'fertig');
  const sockel = r.entwurf.teile.find((p) => p.ref === 'turm.sockel');
  assert.ok(sockel.parameter.hoehe >= 3);
  const bl = bloeckeAusEntwurf(e.ebene3, r.entwurf);
  assert.equal(bl.filter((c) => /_door$/.test(idVon(c))).length, 2, 'die Tür ist da; Fenster passen hier mit Randzeilen nicht in den kurzen Schaft (gewollt: keine Fenster auf Kosten der Tragfähigkeit)');
  assert.equal(messeAufbau(bl).unverbunden.bloecke, 0);
});

test('Interne Parameter (wandzonen, tiefe bei Tür und Fenster) sehen weder Leser noch Oberfläche; in einer Spezifikation werden sie abgelehnt', async () => {
  const e = await engine();
  const briefing = e.ebene4.briefing();
  assert.doesNotMatch(briefing, /wandzonen/);
  assert.doesNotMatch(briefing, /bau\.(tuer|fenster)[^\n]*tiefe/);
  const namen = (id) => e.ebene4.vokabular.bausteine.find((b) => b.id === id).parameter.map((p) => p.name);
  assert.deepEqual(namen('form.zylinder'), ['breite', 'tiefe', 'hoehe', 'wandstaerke']);
  assert.deepEqual(namen('bau.tuer'), ['fluegel']);
  assert.deepEqual(namen('bau.fenster'), ['breite', 'hoehe', 'rahmen']);
  const s = spec(13, 13, 34); delete s.teile[0].rezept; s.teile[0].form = { baustein: 'form.zylinder', groesse: { breite: 9, tiefe: 9, hoehe: 9, wandzonen: 1 } };
  assert.ok(e.ebene4.pruefe(s).rueckfragen.some((q) => q.pfad === 'teile[0].form.groesse.wandzonen'), 'wandzonen in der Spezifikation → Rückfrage (kein Umweg an der Zonen-Regel vorbei)');
});

test('Tür aus der Materialwahl: ein Block, der keine Tür ist (Stein, Falltür, unbekannt), ergibt eine klare Rückfrage der Spezifikationsprüfung, nie einen gesetzten Nicht-Türblock', async () => {
  const e = await engine();
  const meldung = (id) => e.ebene4.pruefe(spec(13, 13, 34, { eingang: 'sued' }, { stimmung: 'hell-nordisch', palette: { akzent: { tuer: id } } })).rueckfragen.map((q) => q.frage).join(' | ');
  assert.match(meldung('minecraft:stone'), /passt nicht zur Form „tuer“/);
  assert.match(meldung('minecraft:oak_trapdoor'), /nicht im Blockregister/);
  assert.match(meldung('minecraft:nope'), /nicht im Blockregister/);
  assert.equal(meldung('minecraft:spruce_door'), '');
  assert.equal(meldung('minecraft:copper_door'), '');
});

test('merkmale null oder von falschem Typ: Rückfrage statt stiller Annahme „keine Merkmale“', async () => {
  const e = await engine();
  assert.throws(() => e.ebene3.rezepte.wendeRezeptAn('turm', { breite: 13, tiefe: 13, hoehe: 34 }, 'turm', null), (f) => f.pfad === 'merkmale');
  assert.throws(() => e.ebene3.rezepte.wendeRezeptAn('turm', { breite: 13, tiefe: 13, hoehe: 34 }, 'turm', 'sued'), (f) => f.pfad === 'merkmale');
  assert.doesNotThrow(() => e.ebene3.rezepte.wendeRezeptAn('turm', { breite: 13, tiefe: 13, hoehe: 34 }, 'turm', undefined));
  assert.ok(e.ebene4.pruefe(spec(13, 13, 34, null)).rueckfragen.some((q) => q.pfad === 'teile[0].merkmale'), 'schon die Spezifikationsprüfung fragt');
});
