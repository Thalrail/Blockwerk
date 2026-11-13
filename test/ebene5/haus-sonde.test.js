// Haus-Sonde (13.11.2026, `docs/haus-sonde.md`): hält fest, was Blockwerk mit den vorhandenen Bausteinen für ein zweigeschossiges Wohnhaus kann und was nicht.
// Stand nach dem ersten Paket (`bau.raum` mit Tür und Fenstern): Die Geschosse sind geschlossene Räume. Die Befund-Tests für das, was weiter fehlt (`innen`, Bauelemente
// als eigene Teile, Teil-Nummern, Farbwunsch), beschreiben den Ist-Zustand und werden rot, sobald das jeweilige Paket sie überholt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation, laufe, luftZugang, innenpunkt, umfang, feste } from '../../tools/haus-sonde.js';

async function umgebung() {
  const e = await engine();
  const { erzeugeEbene5 } = await import('../../src/ebene5/index.js');
  const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen: null });
  return { e, e5 };
}

test('Haus-Sonde: Hülle aus Geschossen und Satteldach plant für drei Größen ohne Rückfrage und Einwand, Maße folgen der Beschreibung', async () => {
  const { e, e5 } = await umgebung();
  for (const [name, v] of Object.entries(VARIANTEN)) {
    const r = await laufe(hausSpezifikation(v), e, e5);
    assert.equal(r.status, 'fertig', `${name}: ${JSON.stringify(r.rueckfragenBau)}`);
    assert.deepEqual(r.einwaende, [], name);
    const u = umfang(r.plan), eg = u.find((x) => x.id === 'erdgeschoss'), og = u.find((x) => x.id === 'obergeschoss'), dach = u.find((x) => x.id === 'dach');
    assert.deepEqual([eg.bis[0] - eg.von[0] + 1, eg.bis[2] - eg.von[2] + 1], [v.breite, v.tiefe], `${name}: Außenmaß des Erdgeschosses`);
    assert.equal(eg.bis[1] - eg.von[1] + 1, v.geschoss + 2, `${name}: lichte Höhe plus Boden und Decke`);
    assert.equal(og.bis[1] - og.von[1] + 1, v.geschoss + 1, `${name}: Obergeschoss ohne eigenen Boden, es steht auf der Decke des Erdgeschosses`);
    assert.equal(og.von[1], eg.bis[1] + 1, `${name}: Obergeschoss steht unmittelbar auf dem Erdgeschoss`);
    assert.equal(dach.von[1], og.bis[1] + 1, `${name}: Dach steht unmittelbar auf dem Obergeschoss`);
    // Dach nie breiter als das Haus (kein Überstand möglich); bei Neigung 1 deckt es das Haus genau, bei 0,8 (groß) fehlt je Seite die unterste Reihe (Befund)
    const d = [dach.von[0], dach.bis[0], dach.von[2], dach.bis[2]], h = [eg.von[0], eg.bis[0], eg.von[2], eg.bis[2]];
    if (v.neigung === 1) assert.deepEqual(d, h, `${name}: Dach deckt das Haus genau`);
    else assert.deepEqual(d, [h[0] + 1, h[1] - 1, h[2], h[3]], `${name}: Dach schmaler als das Haus (Befund)`);
  }
});

test('Haus-Sonde: ändert sich ein Maß, entsteht über die neue Version derselbe Plan wie in einem frischen Lauf (Abdruck je Schicht)', async () => {
  const { e, e5 } = await umgebung();
  const alt = e.ebene4.baue(e.ebene4.freigeben(hausSpezifikation(VARIANTEN.mittel), 'sonde'));
  const neu = hausSpezifikation(VARIANTEN.gross); neu.version = 2;
  const u = e.ebene4.aktualisiereBau(alt.entwurf, e.ebene4.freigeben(neu, 'sonde'));
  assert.equal(u.status, 'fertig');
  const frisch = await laufe(hausSpezifikation(VARIANTEN.gross), e, e5);
  const abd = (p) => p.abschnitte.map((a) => a.schichten.map((s) => s.abdruck));
  assert.deepEqual(abd(e5.bauplan(u.entwurf)), abd(frisch.plan));
});

test('Haus-Sonde: Grenzen kommen aus den Bausteinbereichen und werden als Rückfrage gemeldet (Raum: lichte Breite 1 bis 64, lichte Höhe 2 bis 32)', async () => {
  const { e, e5 } = await umgebung();
  assert.equal((await laufe(hausSpezifikation({ breite: 66, tiefe: 9, geschoss: 3, neigung: 1 }), e, e5)).status, 'fertig');
  const zuBreit = await laufe(hausSpezifikation({ breite: 67, tiefe: 9, geschoss: 3, neigung: 1 }), e, e5);
  assert.equal(zuBreit.status, 'rueckfragen-vor-freigabe');
  assert.match(zuBreit.rueckfragenPruefer[0], /teile\[0\]\.form\.groesse\.breite.*1 bis 64/);
  const zuNiedrig = await laufe(hausSpezifikation({ breite: 9, tiefe: 7, geschoss: 1, neigung: 1 }), e, e5);
  assert.match(zuNiedrig.rueckfragenPruefer[0], /hoehe.*2 bis 32/);
});

test('Haus-Sonde: Tür und Fenster gehören zum Raum und die Planung läuft durch; nur die Treppe im Haus (`innen`) bleibt eine Rückfrage (Befund)', async () => {
  const { e, e5 } = await umgebung();
  for (const [name, v] of Object.entries(VARIANTEN)) {
    const r = await laufe(hausSpezifikation(v, { tuer: true, fenster: true }), e, e5);
    assert.equal(r.status, 'fertig', `${name}: ${JSON.stringify(r.rueckfragenBau)}`);
    assert.deepEqual(r.einwaende, [], name);
    const ids = r.plan.abschnitte.flatMap((a) => a.legende.map((l) => l.id));
    assert.ok(ids.some((i) => /_door$/.test(i)), `${name}: Tür im Plan`);
    assert.ok(ids.some((i) => /pane/.test(i)), `${name}: Fensterscheiben im Plan`);
  }
  const r = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true, treppe: true }), e, e5);
  assert.equal(r.status, 'rueckfragen');
  assert.equal(r.rueckfragenBau.length, 1, JSON.stringify(r.rueckfragenBau));
  assert.match(r.rueckfragenBau[0], /Treppe: „innen“ lässt sich .* nicht übersetzen/, 'Treppe: innen fehlt');
});

test('Haus-Sonde (Befund): ein Bauelement als eigenes Teil steht frühestens 8 Blöcke von der Wand entfernt (Hüllenrand), nie bündig', async () => {
  const { e, e5 } = await umgebung();
  const s = hausSpezifikation(VARIANTEN.klein, { tuerTeil: true });
  s.teile.find((t) => t.id === 'haustuer').lage.abstand = 0;
  const r = await laufe(s, e, e5);
  assert.equal(r.status, 'fertig');
  const u = umfang(r.plan), haus = u.find((x) => x.id === 'erdgeschoss'), tuer = u.find((x) => x.id === 'haustuer');
  assert.equal(tuer.von[2] - haus.bis[2] - 1, 8, 'freie Blöcke zwischen Hauswand und Tür bei Abstand 0');
  const ohne = await laufe(hausSpezifikation(VARIANTEN.klein, { tuerTeil: true }), e, e5);
  assert.equal(ohne.status, 'rueckfragen', 'mit dem Standardabstand passt das Teil nicht auf den Bauplatz');
});

test('Haus-Sonde: Erdgeschoss und Obergeschoss sind ringsum geschlossen (vier Wände, Decke, unten Boden bzw. die Decke darunter), der Innenraum ist von außen nicht erreichbar', async () => {
  const { e, e5 } = await umgebung();
  for (const [name, v] of Object.entries(VARIANTEN)) for (const mit of [{}, { tuer: true, fenster: true }]) {
    const r = await laufe(hausSpezifikation(v, mit), e, e5);
    const fest = feste(r.plan), u = umfang(r.plan);
    for (const geschoss of ['erdgeschoss', 'obergeschoss']) {
      const g = u.find((x) => x.id === geschoss), n = `${name} ${geschoss}`;
      const [x0, y0, z0] = g.von, [x1, y1, z1] = g.bis;
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const rand = x === x0 || x === x1 || z === z0 || z === z1;
        assert.ok(fest.has(`${x},${y1},${z}`), `${n}: Decke bei ${x},${y1},${z}`);
        if (geschoss === 'erdgeschoss') assert.ok(fest.has(`${x},${y0},${z}`), `${n}: Boden bei ${x},${y0},${z}`);
        else assert.ok(fest.has(`${x},${y0 - 1},${z}`), `${n}: darunter die Decke des Erdgeschosses bei ${x},${y0 - 1},${z}`);
        if (rand) for (let y = y0; y <= y1; y++) assert.ok(fest.has(`${x},${y},${z}`), `${n}: Wand bei ${x},${y},${z}`);
      }
      const start = innenpunkt(r.entwurf, geschoss);
      assert.ok(start.every((w, i) => w > g.von[i] - (geschoss === 'obergeschoss' && i === 1 ? 1 : 0) && w < g.bis[i]), `${n}: Startpunkt ${start} liegt nicht im Innenraum`);
      assert.deepEqual(luftZugang(r.plan, start), { startIstLuft: true, vonAussenErreichbar: false }, n);
    }
  }
});

test('Haus-Sonde: Stimmung je Teil ändert das Material, ein Farbwunsch darüber hinaus bisher nicht', async () => {
  const { e, e5 } = await umgebung();
  const stil = async (stil) => { const s = hausSpezifikation(VARIANTEN.klein); s.teile[2].stil = stil; return (await laufe(s, e, e5)).material; };
  const dunkel = await stil({ stimmung: 'dunkel-industriell' });
  assert.deepEqual(await stil({ stimmung: 'dunkel-industriell', farben: ['rot'] }), dunkel, 'Farbwunsch ohne Wirkung (Befund)');
  assert.notDeepEqual(await stil({ stimmung: 'glanz' }), dunkel);
});

test('Haus-Sonde (Befund): die Teil-Nummern (T1, T2 …) sind fortlaufende Nummern der Bau-Reihenfolge und nicht stabil; ein neuer Keller verschiebt alle', async () => {
  const { e } = await umgebung();
  const ids = (entwurf) => Object.fromEntries(entwurf.teile.map((t) => [t.abschnitt, t.id]));
  const alt = e.ebene4.baue(e.ebene4.freigeben(hausSpezifikation(VARIANTEN.klein), 'sonde'));
  assert.deepEqual(ids(alt.entwurf), { erdgeschoss: 'T1', obergeschoss: 'T2', dach: 'T3' });
  const neu = hausSpezifikation(VARIANTEN.klein); neu.version = 2;
  neu.teile.push({ id: 'keller', name: 'Keller', art: 'keller', wichtigkeit: 'kann', form: { baustein: 'bau.gang', groesse: { laenge: 7, breite: 7, hoehe: 3 } }, lage: { bezug: 'erdgeschoss', relation: 'unter' } });
  const frisch = e.ebene4.baue(e.ebene4.freigeben(neu, 'sonde'));
  assert.deepEqual(ids(frisch.entwurf), { keller: 'T1', erdgeschoss: 'T2', obergeschoss: 'T3', dach: 'T4' }, 'frischer Lauf: alle verschoben');
  const upd = e.ebene4.aktualisiereBau(alt.entwurf, e.ebene4.freigeben(neu, 'sonde'));
  assert.deepEqual(ids(upd.entwurf), { keller: 'T4', erdgeschoss: 'T5', obergeschoss: 'T6', dach: 'T7' }, 'auch die Aktualisierung behält die alten Nummern nicht (T1 bis T3), alle vier bekommen neue');
  // Bei Entscheidung 1 (Blockänderungen am Bauteil) taugen diese Nummern nicht als Anker. Die Spezifikations-Id ist in allen drei Läufen als `abschnitt` gleich geblieben (hier der Schlüssel der Zuordnung), das ist ein Hinweis, kein Beweis (siehe Bericht).
});

test('Haus-Sonde: doppelte Teil-Ids der Spezifikation werden vom Prüfer abgelehnt', async () => {
  const { e } = await umgebung();
  const s = hausSpezifikation(VARIANTEN.klein); s.teile[1].id = s.teile[0].id;
  const treffer = e.ebene4.pruefe(s).rueckfragen.filter((q) => /^teile\[\d\]\.id$/.test(q.pfad) && /kommt mehrfach vor; sie muss eindeutig sein/.test(q.frage));
  assert.equal(treffer.length, 2, 'beide Teile mit der doppelten Id werden gemeldet');
});
