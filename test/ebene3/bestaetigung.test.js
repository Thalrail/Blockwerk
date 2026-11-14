// Einbau-Architektur Paket P9: Technikanlagen gelten erst nach der Prüfung durch Ebene 1 als bestätigt; eine Änderung im Prüfbereich oder nur in der Umgebung hebt die Bestätigung auf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, holeJson } from '../ebene5/hilfe5.js';
import { laufe, hausSpezifikation, VARIANTEN } from '../../tools/haus-sonde.js';
import { erzeugeBestaetigung } from '../../src/ebene3/bestaetigung.js';

async function umgebung() {
  const e = await engine();
  const { erzeugeEbene5 } = await import('../../src/ebene5/index.js');
  const e5 = erzeugeEbene5({ ebene0: e.ebene0, ebene3: e.ebene3, darstellungsdaten: await holeJson('data/darstellung.json'), texturen: null });
  return { e, e5 };
}
/** Markthalle mit acht Handelsnischen (Technikteil) und, weit entfernt, ein zweites Haus. */
const markt = (mitHaus = false) => {
  const s = { schema: 1, version: 1, projekt: { name: 'Markt', bauplatz: { breite: 200, hoehe: 40, tiefe: 80 }, massstab: 1 }, teile: [
    { id: 'markt', name: 'Markthalle', art: 'halle', wichtigkeit: 'muss', form: { baustein: 'bau.raum', groesse: { breite: 11, tiefe: 9, hoehe: 4, tuer: 1, tuerwand: 3 } }, lage: { bezug: 'projekt', relation: 'ecke-nordwest', abstand: 5 }, stil: { stimmung: 'hell-nordisch' }, funktionen: [{ art: 'handelsnischen', menge: 8 }] },
  ] };
  if (mitHaus) s.teile.push({ id: 'fern', name: 'Fernes Haus', art: 'halle', wichtigkeit: 'soll', form: { baustein: 'bau.raum', groesse: { breite: 7, tiefe: 5, hoehe: 3 } }, lage: { bezug: 'projekt', relation: 'ecke-suedost', abstand: 5 } });
  return s;
};
const status = (plan) => Object.fromEntries(plan.technik.map((t) => [t.ref, t.status]));
const minimum = (p) => p.bloecke.reduce((m, c) => ({ x: Math.min(m.x, c.x), y: Math.min(m.y, c.y), z: Math.min(m.z, c.z) }), { x: Infinity, y: Infinity, z: Infinity });

test('Bestätigung: nach dem Abschluss ist die Anlage bestätigt, Pläne ohne Technik haben keine Technikliste', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(markt(), e, e5);
  assert.equal(r.status, 'fertig');
  assert.deepEqual(r.plan.technik.map((t) => [t.name, t.abschnitt, t.status]), [['tech.handelsnischen', 'markt', 'bestaetigt']]);
  assert.deepEqual(r.plan.abschnitte[0].technik.map((t) => t.status), ['bestaetigt']);
  assert.equal(r.entwurf.bestaetigungen.length, 1);
  assert.match(r.entwurf.bericht.at(-1).satz, /bestätigt die Funktion von 1 Technikteilen nach der Prüfung durch Ebene 1/);
  const haus = await laufe(hausSpezifikation(VARIANTEN.klein), e, e5);
  assert.deepEqual(haus.plan.technik, []);
  assert.ok(haus.plan.abschnitte.every((a) => a.technik.length === 0));
  assert.deepEqual(haus.entwurf.bestaetigungen, []);
});

test('Bestätigung: eine Änderung im Prüfbereich oder nur in der Umgebung macht die Anlage nicht bestätigt, eine ferne Änderung nicht', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(markt(true), e, e5);
  assert.equal(r.status, 'fertig', JSON.stringify(r.rueckfragenBau));
  const A = e.ebene3.aenderungen;
  const ref = r.plan.technik[0].ref;
  assert.equal(status(r.plan)[ref], 'bestaetigt');
  // 1. Änderung am Technikteil selbst: ein Block der Anlage entfällt
  const tech = r.entwurf.teile.find((t) => (t.ref ?? t.id) === ref);
  const pTech = e.ebene2.baue(tech.baustein, tech.parameter), minT = minimum(pTech), b0 = pTech.bloecke[0];
  const selbst = A.setze(r.entwurf, { teil: ref, zelle: { x: b0.x - minT.x, y: b0.y - minT.y, z: b0.z - minT.z }, op: 'leere' }, 'Jonah').entwurf;
  assert.equal(status(e5.bauplan(selbst))[ref], 'nicht-bestaetigt');
  // 2. nur in der Umgebung: ein Block der Halle (anderes Teil), aber innerhalb des Prüfbereichs der Anlage
  const mat = e.ebene3.materialisiere(r.entwurf);
  const huelle = mat.teile.get(tech.id).huelle;
  const halle = r.entwurf.teile.find((t) => t.art !== 'technik' && t.abschnitt === tech.abschnitt);
  const nah = [...mat.teile.get(halle.id).schluessel].map((c) => c.split(',').map(Number)).find(([x, y, z]) => x >= huelle.von.x - 6 && x <= huelle.bis.x + 6 && y >= huelle.von.y - 6 && y <= huelle.bis.y + 6 && z >= huelle.von.z - 6 && z <= huelle.bis.z + 6 && !mat.teile.get(tech.id).schluessel.has(`${x},${y},${z}`));
  assert.ok(nah, 'ein Hallenblock nahe der Anlage');
  assert.equal(halle.lage.drehung, 0);
  const minH = minimum(e.ebene2.baue(halle.baustein, halle.parameter));
  const zelle = { x: nah[0] - halle.lage.x - minH.x, y: nah[1] - halle.lage.y - minH.y, z: nah[2] - halle.lage.z - minH.z };
  const umgebungsAenderung = A.setze(r.entwurf, { teil: halle.ref ?? halle.id, zelle, op: 'leere' }, 'Jonah').entwurf;
  const nachUmgebung = e5.bauplan(umgebungsAenderung);
  assert.equal(status(nachUmgebung)[ref], 'nicht-bestaetigt', 'eine Änderung nur in der Umgebung zählt');
  assert.deepEqual(nachUmgebung.abschnitte.find((a) => a.id === 'markt').technik.map((t) => t.status), ['nicht-bestaetigt']);
  // 3. weit entfernt (anderes Haus): die Bestätigung bleibt
  const fern = r.entwurf.teile.find((t) => t.abschnitt === 'fern');
  const ferne = A.setze(r.entwurf, { teil: fern.ref ?? fern.id, zelle: { x: 3, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  assert.equal(status(e5.bauplan(ferne))[ref], 'bestaetigt', 'eine ferne Änderung stört die Anlage nicht');
});

test('Bestätigung: eine neue Prüfung bestätigt wieder; Verstöße im Prüfbereich verhindern die Bestätigung, ferne Verstöße nicht', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(markt(), e, e5);
  const ref = r.plan.technik[0].ref;
  const tech = r.entwurf.teile.find((t) => (t.ref ?? t.id) === ref);
  const innen = { ...e.ebene3.materialisiere(r.entwurf).teile.get(tech.id).huelle.von };
  // eine Änderung in der Halle, danach neue Prüfung: bestätigt
  const halle = r.entwurf.teile.find((t) => t.art !== 'technik');
  const geaendert = e.ebene3.aenderungen.setze(r.entwurf, { teil: halle.ref ?? halle.id, zelle: { x: 0, y: 0, z: 0 }, op: 'leere' }, 'Jonah').entwurf;
  const neu = e.ebene3.bestaetigung.bestaetige(geaendert);
  assert.deepEqual([neu.bestaetigt, neu.abgelehnt], [[ref], []]);
  assert.equal(status(e5.bauplan(neu.entwurf))[ref], 'bestaetigt');
  // künstliche Prüfer-Meldungen: im Prüfbereich verhindert sie die Bestätigung, weit weg nicht
  const mitMeldung = (ort) => erzeugeBestaetigung({ regelwerk: e.ebene1.regelwerk, ebene0: e.ebene0, materialisierung: { materialisiere: e.ebene3.materialisiere, pruefeEntwurf: () => [{ schwere: 'verstoss', regel: 'pruefer.test', ort, meldung: 'künstlich' }] } });
  const nah = mitMeldung(innen).bestaetige(r.entwurf);
  assert.deepEqual([nah.bestaetigt, nah.abgelehnt.map((a) => [a.ref, a.meldungen.length])], [[], [[ref, 1]]]);
  assert.deepEqual(nah.entwurf.bestaetigungen.map((b) => [b.teil, b.ergebnis, b.abdruck]), [[ref, 'abgelehnt', null]], 'die Ablehnung wird gespeichert');
  assert.equal(status(e5.bauplan(nah.entwurf))[ref], 'nicht-bestaetigt', 'war bestätigt, wurde abgelehnt: nicht bestätigt (nicht „ungeprüft“)');
  assert.match(nah.entwurf.bericht.at(-1).satz, /nicht bestätigt: .* \(1 Verstöße\)/);
  const fern = mitMeldung({ x: innen.x + 500, y: innen.y, z: innen.z + 500 }).bestaetige(r.entwurf);
  assert.deepEqual(fern.bestaetigt, [ref]);
  // Bestätigungen von Teilen, die es nicht mehr gibt, werden entfernt
  const alt = { ...r.entwurf, bestaetigungen: [...r.entwurf.bestaetigungen, { teil: 'T99', baustein: 'tech.x', abdruck: '00000000', umkreis: 8, von: 'ebene1' }] };
  assert.deepEqual(e.ebene3.bestaetigung.bestaetige(alt).entwurf.bestaetigungen.map((b) => b.teil), [ref]);
});

test('Bestätigung: der Abdruck ist deterministisch und hängt nur vom Prüfbereich ab (Blöcke und Leerzellen), nicht von fernen Blöcken oder der Reihenfolge', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(markt(true), e, e5);
  const B = e.ebene3.bestaetigung;
  const abd = (en) => B.abdruecke(en, e.ebene3.materialisiere(en)).map((x) => [x.ref, x.abdruck]);
  const a = abd(r.entwurf);
  assert.deepEqual(abd(r.entwurf), a);
  const umgekehrt = structuredClone(r.entwurf);
  umgekehrt.teile.reverse();
  assert.deepEqual(abd(umgekehrt), a, 'Reihenfolge der Teile egal');
  const fern = r.entwurf.teile.find((t) => t.abschnitt === 'fern');
  const mitFern = e.ebene3.aenderungen.setze(r.entwurf, { teil: fern.ref ?? fern.id, zelle: { x: 3, y: 1, z: 0 }, op: 'setze', block: { id: 'minecraft:glass' } }, 'Jonah').entwurf;
  assert.deepEqual(abd(mitFern), a, 'ferne Blöcke ändern den Abdruck nicht');
  assert.ok(B.abdruecke(r.entwurf, e.ebene3.materialisiere(r.entwurf)).every((x) => /^[0-9a-f]{8}$/.test(x.abdruck)));
  assert.ok(e5);
});

test('Bestätigung: der Prüfbereich ist Hülle plus Umkreis (vereinigt mit der Sperrzone), und auch der Zustand eines Blocks in der Umgebung zählt', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(markt(), e, e5);
  const mat = e.ebene3.materialisiere(r.entwurf);
  const tech = r.entwurf.teile.find((t) => t.art === 'technik');
  const h = mat.teile.get(tech.id).huelle;
  const [x] = e.ebene3.bestaetigung.abdruecke(r.entwurf, mat);
  const umkreis = e.ebene1.regelwerk.parameter('plan.technik', 'umkreis');
  assert.equal(umkreis, 8);
  const sz = (r.entwurf.sperrzonen ?? []).filter((s) => s.id === `SZ-${tech.id}`);
  for (const a of ['x', 'y', 'z']) {
    assert.equal(x.kasten.von[a], Math.min(h.von[a] - umkreis, ...sz.map((s) => s.von[a])), `von.${a}`);
    assert.equal(x.kasten.bis[a], Math.max(h.bis[a] + umkreis, ...sz.map((s) => s.bis[a])), `bis.${a}`);
  }
  // gleicher Block, anderer Zustand in der Umgebung: anderer Abdruck
  const halle = r.entwurf.teile.find((t) => t.art !== 'technik');
  const stufe = (richtung) => ({ id: 'minecraft:stone_stairs', zustand: { weirdo_direction: richtung, upside_down_bit: false, 'minecraft:corner': 'none' } });
  const abdruck = (richtung) => {
    const en = e.ebene3.aenderungen.setze(r.entwurf, { teil: halle.ref ?? halle.id, zelle: { x: 0, y: 1, z: 1 }, op: 'setze', block: stufe(richtung) }, 'Jonah').entwurf;
    return e.ebene3.bestaetigung.abdruecke(en, e.ebene3.materialisiere(en))[0].abdruck;
  };
  assert.notEqual(abdruck(0), abdruck(1), 'nur der Zustand (Richtung) unterscheidet sich');
  assert.equal(abdruck(0), abdruck(0));
});

test('Bestätigung: auch Inventarinhalt und Wesen im Prüfbereich gehören zum Abdruck (Bewegung innerhalb derselben Zelle, Hinzufügen, Entfernen)', async () => {
  const { e, e5 } = await umgebung();
  const r = await laufe(markt(), e, e5);
  const B = e.ebene3.bestaetigung;
  const mat = e.ebene3.materialisiere(r.entwurf);
  const tech = r.entwurf.teile.find((t) => t.art === 'technik');
  assert.ok(tech);
  const abd = (blocks = [], wesen = []) => B.abdruecke(r.entwurf, { ...mat, welt: { alleBloecke: () => [...mat.welt.alleBloecke(), ...blocks], wesen: () => [...mat.welt.wesen(), ...wesen] } })[0].abdruck;
  const basis = abd();
  // Inhalt: nur die Anzahl ändern
  const kastenHoch = B.abdruecke(r.entwurf, mat)[0].kasten;
  const truheDrin = (anzahl) => ({ x: kastenHoch.von.x + 1, y: kastenHoch.von.y, z: kastenHoch.von.z + 1, id: 'minecraft:chest', zustand: {}, inhalt: [{ slot: 0, gegenstand: 'minecraft:dirt', anzahl }] });
  assert.notEqual(abd([truheDrin(1)]), basis, 'ein Block mit Inhalt im Prüfbereich');
  assert.notEqual(abd([truheDrin(1)]), abd([truheDrin(2)]), 'nur der Inhalt ändert sich');
  assert.equal(abd([truheDrin(2)]), abd([truheDrin(2)]));
  // Wesen: Hinzufügen, Bewegen innerhalb derselben Blockzelle, anderes Merkmal
  const dorfi = (x, extra = {}) => ({ id: 'minecraft:villager_v2', x, y: kastenHoch.von.y + 0.5, z: kastenHoch.von.z + 0.5, yaw: 0, baby: false, nr: 7, ...extra });
  const mitte = kastenHoch.von.x + 3;
  assert.notEqual(abd([], [dorfi(mitte + 0.2)]), basis, 'ein Wesen kommt hinzu');
  assert.notEqual(abd([], [dorfi(mitte + 0.2)]), abd([], [dorfi(mitte + 0.8)]), 'Bewegung innerhalb derselben Blockzelle');
  assert.notEqual(abd([], [dorfi(mitte + 0.2)]), abd([], [dorfi(mitte + 0.2, { baby: true })]), 'anderes Merkmal');
  assert.equal(abd([], [dorfi(mitte + 0.2)]), abd([], [dorfi(mitte + 0.2, { nr: 99 })]), 'die laufende Nummer zählt nicht');
  assert.equal(abd([], [dorfi(kastenHoch.bis.x + 50)]), basis, 'ein Wesen weit weg zählt nicht');
});
