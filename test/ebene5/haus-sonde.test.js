// Haus-Sonde (13.11.2026, `docs/haus-sonde.md`): hält fest, was Blockwerk heute mit den vorhandenen Bausteinen für ein zweigeschossiges Wohnhaus kann und was nicht.
// Die Befund-Tests beschreiben den Ist-Zustand („Stirnwände fehlen“); sie sind absichtlich so formuliert, dass sie rot werden, sobald das erste Implementierungspaket
// (Raum-Baustein, Öffnungen, `innen`) sie überholt, und dann mit dem Bericht zusammen angepasst werden.
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

test('Haus-Sonde: Grenzen kommen aus den Bausteinbereichen und werden als Rückfrage gemeldet (Gang: lichte Breite 1 bis 32, lichte Höhe 2 bis 32)', async () => {
  const { e, e5 } = await umgebung();
  assert.equal((await laufe(hausSpezifikation({ breite: 34, tiefe: 9, geschoss: 3, neigung: 1 }), e, e5)).status, 'fertig');
  const zuBreit = await laufe(hausSpezifikation({ breite: 35, tiefe: 9, geschoss: 3, neigung: 1 }), e, e5);
  assert.equal(zuBreit.status, 'rueckfragen-vor-freigabe');
  assert.match(zuBreit.rueckfragenPruefer[0], /teile\[0\]\.form\.groesse\.breite.*1 bis 32/);
  const zuNiedrig = await laufe(hausSpezifikation({ breite: 9, tiefe: 7, geschoss: 1, neigung: 1 }), e, e5);
  assert.match(zuNiedrig.rueckfragenPruefer[0], /hoehe.*2 bis 32/);
});

test('Haus-Sonde (Befund): Tür, Fenster und Treppe lassen sich nicht in das Haus setzen; die Planung fragt statt zu raten', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(hausSpezifikation(VARIANTEN.klein, { tuer: true, fenster: true, treppe: true }), e, e5);
  assert.equal(r.status, 'rueckfragen');
  assert.equal(r.rueckfragenBau.length, 3, JSON.stringify(r.rueckfragenBau));
  const nach = (name) => r.rueckfragenBau.filter((q) => q.includes(name));
  assert.equal(nach('Fenster braucht mit Rand und Technik').length, 1, 'Fenster: Rand und Technikstreifen sprengen den Bauplatz');
  assert.equal(nach('Haustür braucht mit Rand und Technik').length, 1, 'Haustür: Rand und Technikstreifen sprengen den Bauplatz');
  assert.equal(nach('Treppe: „innen“ lässt sich').length, 1, 'Treppe: innen fehlt');
});

test('Haus-Sonde (Befund): eine Tür steht frühestens 8 Blöcke von der Wand entfernt (Hüllenrand), nie in einer Wandöffnung', async () => {
  const { e, e5 } = await umgebung();
  const s = hausSpezifikation(VARIANTEN.klein, { tuer: true });
  s.teile.find((t) => t.id === 'haustuer').lage.abstand = 0;
  const r = await laufe(s, e, e5);
  assert.equal(r.status, 'fertig');
  const u = umfang(r.plan), haus = u.find((x) => x.id === 'erdgeschoss'), tuer = u.find((x) => x.id === 'haustuer');
  assert.equal(tuer.von[2] - haus.bis[2] - 1, 8, 'freie Blöcke zwischen Hauswand und Tür bei Abstand 0');
});

test('Haus-Sonde (Befund): der Hohlkasten hat Boden, Decke und zwei Seitenwände, aber keine Stirnwände; der Innenraum ist von außen über Luft erreichbar', async () => {
  const { e, e5 } = await umgebung();
  for (const [name, v] of Object.entries(VARIANTEN)) {
    const r = await laufe(hausSpezifikation(v), e, e5);
    const fest = feste(r.plan), eg = umfang(r.plan).find((x) => x.id === 'erdgeschoss');
    const [x0, y0, z0] = eg.von, [x1, y1, z1] = eg.bis;
    const innenX = Array.from({ length: x1 - x0 - 1 }, (_, i) => x0 + 1 + i), innenY = Array.from({ length: y1 - y0 - 1 }, (_, i) => y0 + 1 + i);
    for (const x of innenX) for (const y of innenY) {
      assert.ok(!fest.has(`${x},${y},${z0}`) && !fest.has(`${x},${y},${z1}`), `${name}: Stirnseite offen bei x=${x}, y=${y}`);
    }
    for (let z = z0; z <= z1; z++) {
      for (const y of innenY) assert.ok(fest.has(`${x0},${y},${z}`) && fest.has(`${x1},${y},${z}`), `${name}: Seitenwand bei z=${z}, y=${y}`);
      for (const x of innenX) assert.ok(fest.has(`${x},${y0},${z}`) && fest.has(`${x},${y1},${z}`), `${name}: Boden und Decke bei x=${x}, z=${z}`);
    }
    const start = innenpunkt(r.entwurf);
    assert.ok(start.every((w, i) => w > eg.von[i] && w < eg.bis[i]), `${name}: Startpunkt ${start} liegt nicht im Innenraum des Erdgeschosses`);
    assert.deepEqual(luftZugang(r.plan, start), { startIstLuft: true, vonAussenErreichbar: true }, name);
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
  const treffer = e.ebene4.pruefe(s).rueckfragen.filter((q) => /^teile[d].id$/.test(q.pfad) && /kommt mehrfach vor; sie muss eindeutig sein/.test(q.frage));
  assert.equal(treffer.length, 2, 'beide Teile mit der doppelten Id werden gemeldet');
});
