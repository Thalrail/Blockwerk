import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene0 } from '../hilfe.js';
import { HOEHE_MAX, HOEHE_MIN } from '../../src/ebene0/richtungen.js';

const neu = () => ebene0().neueWelt();

test('Leere Welt: überall Luft, keine Blöcke, keine Chunks', () => {
  const w = neu();
  assert.deepEqual(w.leseBlock(0, 0, 0), { id: 'minecraft:air', zustand: {} });
  assert.deepEqual(w.leseBlock(-1000, -64, 99999), { id: 'minecraft:air', zustand: {} });
  assert.equal(w.anzahlBloecke(), 0);
  assert.deepEqual(w.chunks(), []);
  assert.ok(w.istLuft(5, 5, 5));
});

test('Setzen, Lesen, Überschreiben, Löschen', () => {
  const w = neu();
  w.setzeBlock(3, 4, 5, 'minecraft:stone');
  assert.equal(w.leseBlock(3, 4, 5).id, 'minecraft:stone');
  w.setzeBlock(3, 4, 5, 'minecraft:dirt');
  assert.equal(w.leseBlock(3, 4, 5).id, 'minecraft:dirt');
  assert.equal(w.anzahlBloecke(), 1);
  w.loescheBlock(3, 4, 5);
  assert.ok(w.istLuft(3, 4, 5));
  assert.equal(w.anzahlBloecke(), 0);
  assert.deepEqual(w.chunks(), [], 'leerer Chunk wird entfernt');
  w.setzeBlock(3, 4, 5, 'minecraft:stone');
  w.setzeBlock(3, 4, 5, 'minecraft:air');
  assert.ok(w.istLuft(3, 4, 5), 'Luft setzen löscht');
});

test('Blöcke verschiedener Orte beeinflussen sich nicht (Chunkgrenzen, negative Koordinaten)', () => {
  const w = neu();
  const orte = [[0, 0, 0], [15, 0, 15], [16, 0, 0], [0, 0, 16], [-1, 0, -1], [-16, 0, -16], [-17, 5, 31], [1000, 319, -1000], [0, -64, 0]];
  orte.forEach(([x, y, z], i) => w.setzeBlock(x, y, z, 'minecraft:hopper', { facing_direction: i % 6 }));
  assert.equal(w.anzahlBloecke(), orte.length);
  orte.forEach(([x, y, z], i) => assert.equal(w.leseBlock(x, y, z).zustand.facing_direction, i % 6, `${x},${y},${z}`));
  assert.ok(w.istLuft(1, 0, 0));
  assert.ok(w.istLuft(-2, 0, -1));
});

test('Jede Position in einem 40×3×40 Bereich um den Nullpunkt wird eindeutig gespeichert', () => {
  const w = neu();
  for (let x = -20; x < 20; x++) for (let y = 0; y < 3; y++) for (let z = -20; z < 20; z++) {
    w.setzeBlock(x, y, z, 'minecraft:hopper', { facing_direction: (x * 7 + y * 3 + z * 5 + 1000) % 6 });
  }
  assert.equal(w.anzahlBloecke(), 40 * 3 * 40);
  for (let x = -20; x < 20; x++) for (let y = 0; y < 3; y++) for (let z = -20; z < 20; z++) {
    assert.equal(w.leseBlock(x, y, z).zustand.facing_direction, (x * 7 + y * 3 + z * 5 + 1000) % 6);
  }
});

test('Höhenbereich -64…319 wird erzwungen', () => {
  const w = neu();
  w.setzeBlock(0, HOEHE_MIN, 0, 'minecraft:bedrock');
  w.setzeBlock(0, HOEHE_MAX, 0, 'minecraft:stone');
  assert.throws(() => w.setzeBlock(0, HOEHE_MIN - 1, 0, 'minecraft:stone'), /Höhe/);
  assert.throws(() => w.setzeBlock(0, HOEHE_MAX + 1, 0, 'minecraft:stone'), /Höhe/);
  assert.throws(() => w.leseBlock(0, 400, 0), /Höhe/);
});

test('Ungültige Eingaben werden abgelehnt und ändern nichts', () => {
  const w = neu();
  assert.throws(() => w.setzeBlock(0.5, 0, 0, 'minecraft:stone'), /ganze Zahlen/);
  assert.throws(() => w.setzeBlock(0, 0, 0, 'minecraft:gibtesnicht'), /Unbekannter Block/);
  assert.throws(() => w.setzeBlock(0, 0, 0, 'minecraft:hopper', { facing_direction: 9 }), /nicht erlaubt/);
  assert.throws(() => w.setzeBlock(0, 0, 0, 'minecraft:stone', { quatsch: 1 }), /keinen Zustand/);
  assert.equal(w.anzahlBloecke(), 0);
});

test('Zustände werden gespeichert, Lesen liefert Kopien', () => {
  const w = neu();
  w.setzeBlock(0, 0, 0, 'minecraft:oak_stairs', { weirdo_direction: 2, upside_down_bit: true });
  const a = w.leseBlock(0, 0, 0);
  assert.deepEqual(a.zustand, { upside_down_bit: true, weirdo_direction: 2 });
  a.zustand.weirdo_direction = 0;
  assert.equal(w.leseBlock(0, 0, 0).zustand.weirdo_direction, 2);
});

test('alleBloecke ist deterministisch: Schicht für Schicht (y, dann z, dann x)', () => {
  const w = neu();
  w.setzeBlock(5, 1, 0, 'minecraft:stone');
  w.setzeBlock(-3, 0, 2, 'minecraft:stone');
  w.setzeBlock(7, 0, -1, 'minecraft:stone');
  w.setzeBlock(1, 0, 2, 'minecraft:stone');
  assert.deepEqual(w.alleBloecke().map((b) => [b.x, b.y, b.z]), [[7, 0, -1], [-3, 0, 2], [1, 0, 2], [5, 1, 0]]);
  const w2 = neu();
  for (const b of [...w.alleBloecke()].reverse()) w2.setzeBlock(b.x, b.y, b.z, b.id);
  assert.deepEqual(w2.alleBloecke(), w.alleBloecke(), 'Reihenfolge des Setzens ist egal');
});

// ---------- Blockinhalte ----------
test('Inhalt: Trichter und Truhe speichern Gegenstand + Anzahl je Slot', () => {
  const w = neu();
  w.setzeBlock(0, 0, 0, 'minecraft:hopper', { facing_direction: 0 }, [
    { slot: 2, gegenstand: 'minecraft:diamond', anzahl: 10 },
    { slot: 0, gegenstand: 'minecraft:emerald', anzahl: 64 },
  ]);
  assert.deepEqual(w.leseInhalt(0, 0, 0), [
    { slot: 0, gegenstand: 'minecraft:emerald', anzahl: 64 },
    { slot: 2, gegenstand: 'minecraft:diamond', anzahl: 10 },
  ]);
  w.setzeInhalt(0, 0, 0, [{ slot: 4, gegenstand: 'minecraft:stick', anzahl: 1 }]);
  assert.equal(w.leseInhalt(0, 0, 0).length, 1);
  w.setzeInhalt(0, 0, 0, []);
  assert.deepEqual(w.leseInhalt(0, 0, 0), []);
});

test('Inhalt: Fehler (Slot außerhalb, doppelt, Gegenstand unbekannt, Anzahl, kein Behälter)', () => {
  const w = neu();
  const hopper = (inhalt) => () => w.setzeBlock(0, 0, 0, 'minecraft:hopper', {}, inhalt);
  assert.throws(hopper([{ slot: 5, gegenstand: 'minecraft:stick', anzahl: 1 }]), /Slot 5/);
  assert.throws(hopper([{ slot: -1, gegenstand: 'minecraft:stick', anzahl: 1 }]), /Slot/);
  assert.throws(hopper([{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 1 }, { slot: 0, gegenstand: 'minecraft:stick', anzahl: 1 }]), /doppelt/);
  assert.throws(hopper([{ slot: 0, gegenstand: 'minecraft:quatsch', anzahl: 1 }]), /Unbekannter Gegenstand/);
  assert.throws(hopper([{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 0 }]), /Anzahl/);
  assert.throws(hopper([{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 65 }]), /Anzahl/);
  assert.throws(hopper([{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 1.5 }]), /Anzahl/);
  assert.throws(() => w.setzeBlock(0, 0, 0, 'minecraft:stone', {}, [{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 1 }]), /kein Behälter/);
  assert.throws(() => w.setzeInhalt(9, 9, 9, []), /Kein Block/);
  assert.equal(w.anzahlBloecke(), 0);
});

test('Inhalt: wird mit dem Block ersetzt/gelöscht', () => {
  const w = neu();
  w.setzeBlock(0, 0, 0, 'minecraft:chest', {}, [{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 3 }]);
  w.setzeBlock(0, 0, 0, 'minecraft:chest');
  assert.deepEqual(w.leseInhalt(0, 0, 0), []);
  w.setzeBlock(0, 0, 0, 'minecraft:barrel', {}, [{ slot: 26, gegenstand: 'minecraft:stick', anzahl: 3 }]);
  w.loescheBlock(0, 0, 0);
  assert.deepEqual(w.leseInhalt(0, 0, 0), []);
});

// ---------- Wesen ----------
test('Wesen: hinzufügen, auflisten (nach Nummer), entfernen', () => {
  const w = neu();
  const a = w.fuegeWesenHinzu({ id: 'minecraft:villager_v2', x: 1.5, y: 64, z: -3.5, yaw: 450 });
  const b = w.fuegeWesenHinzu({ id: 'minecraft:minecart', x: 0.5, y: 10, z: 0.5, name: 'Lore 1' });
  const c = w.fuegeWesenHinzu({ id: 'minecraft:villager_v2', x: 2.5, y: 64, z: 0.5, baby: true });
  assert.deepEqual([a, b, c], [1, 2, 3]);
  assert.deepEqual(w.wesen().map((x) => x.nr), [1, 2, 3]);
  assert.equal(w.wesen()[0].yaw, 90, 'yaw wird auf 0–359 normalisiert');
  assert.equal(w.wesen()[1].name, 'Lore 1');
  assert.equal(w.wesen()[2].baby, true);
  w.entferneWesen(b);
  assert.deepEqual(w.wesen().map((x) => x.nr), [1, 3]);
  assert.equal(w.fuegeWesenHinzu({ id: 'minecraft:player', x: 0, y: 0, z: 0 }), 4, 'Nummern werden nicht wiederverwendet');
  assert.throws(() => w.entferneWesen(99), /Kein Wesen/);
});

test('Wesen: Fehler (unbekannt, Position, Baby ohne Babyform, Höhe)', () => {
  const w = neu();
  assert.throws(() => w.fuegeWesenHinzu({ id: 'minecraft:drache', x: 0, y: 0, z: 0 }), /Unbekanntes Wesen/);
  assert.throws(() => w.fuegeWesenHinzu({ id: 'minecraft:player', x: NaN, y: 0, z: 0 }), /Zahl/);
  assert.throws(() => w.fuegeWesenHinzu({ id: 'minecraft:player', x: 0, y: 0, z: 0, baby: true }), /Babyform/);
  assert.throws(() => w.fuegeWesenHinzu({ id: 'minecraft:player', x: 0, y: -100, z: 0 }), /Höhe/);
  assert.throws(() => w.fuegeWesenHinzu(null));
  assert.deepEqual(w.wesen(), []);
});

// ---------- Bauteile & Kopie ----------
test('Ausschnitt und Einfügen: Bauteil wird um den Versatz verschoben eingesetzt', () => {
  const w = neu();
  w.setzeBlock(0, 0, 0, 'minecraft:stone');
  w.setzeBlock(1, 0, 0, 'minecraft:chest', {}, [{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 2 }]);
  w.setzeBlock(50, 0, 0, 'minecraft:dirt');
  w.fuegeWesenHinzu({ id: 'minecraft:villager_v2', x: 0.5, y: 0, z: 0.5 });
  const t = w.ausschnitt({ x: 1, y: 1, z: 1 }, { x: -1, y: -1, z: -1 });
  assert.equal(t.bloecke.length, 2);
  assert.equal(t.wesen.length, 1);
  w.fuegeBauteilEin(t, { x: 0, y: 10, z: 0 });
  assert.equal(w.leseBlock(1, 10, 0).id, 'minecraft:chest');
  assert.equal(w.leseInhalt(1, 10, 0)[0].anzahl, 2);
  assert.equal(w.wesen().length, 2);
});

test('Einfügen ist alles-oder-nichts', () => {
  const w = neu();
  const kaputt = { bloecke: [{ x: 0, y: 0, z: 0, id: 'minecraft:stone', zustand: {} }, { x: 1, y: 0, z: 0, id: 'minecraft:quatsch', zustand: {} }], wesen: [] };
  assert.throws(() => w.fuegeBauteilEin(kaputt));
  assert.equal(w.anzahlBloecke(), 0);
});

test('Kopie ist unabhängig vom Original', () => {
  const w = neu();
  w.setzeBlock(0, 0, 0, 'minecraft:chest', {}, [{ slot: 0, gegenstand: 'minecraft:stick', anzahl: 2 }]);
  w.fuegeWesenHinzu({ id: 'minecraft:player', x: 0, y: 0, z: 0 });
  const k = w.kopie();
  k.setzeBlock(0, 0, 0, 'minecraft:stone');
  k.entferneWesen(1);
  assert.equal(w.leseBlock(0, 0, 0).id, 'minecraft:chest');
  assert.equal(w.wesen().length, 1);
  assert.equal(k.fuegeWesenHinzu({ id: 'minecraft:player', x: 0, y: 0, z: 0 }), 2);
});

test('Welt: alleBloecke wird zwischengespeichert, bleibt bei jeder Änderung richtig und gibt eingefrorene Einträge in frischen Listen', async () => {
  const { ebene0 } = await import('../hilfe.js');
  const w = ebene0().neueWelt();
  assert.deepEqual(w.alleBloecke(), []);
  w.setzeBlock(1, 0, 0, 'minecraft:stone');
  w.setzeBlock(0, 0, 0, 'minecraft:dirt');
  const a = w.alleBloecke();
  assert.deepEqual(a.map((b) => b.id), ['minecraft:dirt', 'minecraft:stone'], 'sortiert nach y, z, x');
  // zweiter Aufruf ohne Änderung: gleiche Einträge (Zwischenspeicher), aber eine neue Liste
  const b = w.alleBloecke();
  assert.notEqual(a, b);
  assert.equal(a[0], b[0]);
  b.pop(); b.sort(() => 1);
  assert.equal(w.alleBloecke().length, 2, 'wer die Liste umbaut, stört niemanden');
  // eingefroren: eine Änderung der Einträge wirft, statt den gemeinsamen Speicher zu verfälschen
  assert.throws(() => { a[0].id = 'minecraft:air'; }, TypeError);
  assert.throws(() => { a[0].zustand.x = 1; }, TypeError);
  // jede Änderung macht die Liste ungültig: setzen, überschreiben, löschen, Inhalt
  w.setzeBlock(2, 0, 0, 'minecraft:stone');
  assert.equal(w.alleBloecke().length, 3);
  w.setzeBlock(2, 0, 0, 'minecraft:gold_block');
  assert.equal(w.alleBloecke().find((x) => x.x === 2).id, 'minecraft:gold_block');
  w.loescheBlock(2, 0, 0);
  assert.equal(w.alleBloecke().length, 2);
  w.setzeBlock(0, 1, 0, 'minecraft:chest');
  assert.deepEqual(w.alleBloecke().find((x) => x.y === 1).inhalt, undefined);
  w.setzeInhalt(0, 1, 0, [{ slot: 0, gegenstand: 'minecraft:dirt', anzahl: 5 }]);
  assert.equal(w.alleBloecke().find((x) => x.y === 1).inhalt[0].anzahl, 5);
  w.setzeInhalt(0, 1, 0, []);
  assert.equal(w.alleBloecke().find((x) => x.y === 1).inhalt, undefined);
  // eine Kopie hat ihren eigenen Speicher und ändert die Quelle nicht
  const k = w.kopie();
  k.setzeBlock(5, 0, 0, 'minecraft:stone');
  assert.equal(k.alleBloecke().length, w.alleBloecke().length + 1);
  assert.equal(w.alleBloecke().some((x) => x.x === 5), false);
  // Ergebnis ist immer gleich dem frischen Aufbau (Zufallsänderungen)
  let s = 12345; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
  const v = ebene0().neueWelt();
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(rnd() * 20) - 10, y = Math.floor(rnd() * 5), z = Math.floor(rnd() * 20) - 10;
    if (rnd() < 0.3) v.loescheBlock(x, y, z); else v.setzeBlock(x, y, z, rnd() < 0.5 ? 'minecraft:stone' : 'minecraft:dirt');
    if (i % 7 === 0) assert.deepEqual(JSON.stringify(v.alleBloecke()), JSON.stringify(v.kopie().alleBloecke()), `Schritt ${i}`);
  }
});

test('Passagiere: ein Wesen sitzt in einer Lore (höchstens eines), fährt mit und überlebt Kopie, Ausschnitt, Drehen, Verschieben und Speichern', async () => {
  const { ebene0 } = await import('../hilfe.js');
  const { weltZuJson, weltAusJson } = await import('../../src/ebene0/speichern.js');
  const e = ebene0(), v = e.vermesser;
  const LORE = 'minecraft:minecart', DORF = 'minecraft:villager_v2';
  const w = e.neueWelt();
  const dorf = w.fuegeWesenHinzu({ id: DORF, x: 5.5, y: 1, z: 5.5 });   // Nummer 1
  const lore = w.fuegeWesenHinzu({ id: LORE, x: 2.5, y: 1, z: 3.5 });   // Nummer 2 (höher als der Passagier)
  const lore2 = w.fuegeWesenHinzu({ id: LORE, x: 9.5, y: 1, z: 9.5 });
  w.setzePassagier(dorf, lore);
  assert.deepEqual([w.passagier(lore).nr, w.passagier(lore).x, w.passagier(lore).z], [dorf, 2.5, 3.5], 'steht auf der Position der Lore');
  assert.equal(w.passagier(lore2), null);
  // Fehler
  const fehler = (f, muster) => assert.throws(f, muster);
  const zweiter = w.fuegeWesenHinzu({ id: DORF, x: 0.5, y: 1, z: 0.5 });
  fehler(() => w.setzePassagier(zweiter, lore), /schon besetzt/);
  fehler(() => w.setzePassagier(zweiter, dorf), /kein Fahrzeug/);
  fehler(() => w.setzePassagier(zweiter, 99), /Kein Fahrzeug/);
  fehler(() => w.setzePassagier(lore2, lore2), /selbst|Loren nehmen keine Loren/);
  fehler(() => w.setzePassagier(lore2, lore), /Loren nehmen keine Loren|schon besetzt/);
  fehler(() => w.fuegeWesenHinzu({ id: DORF, x: 0, y: 1, z: 0, sitztIn: lore }), /schon besetzt/);
  // die Lore fährt, der Passagier fährt mit
  w.setzeWesenPosition(lore, { x: 4.5, y: 2, z: 3.5 });
  assert.deepEqual([w.passagier(lore).x, w.passagier(lore).y], [4.5, 2]);
  assert.throws(() => w.setzeWesenPosition(lore, { x: 0, y: 9999, z: 0 }), /Höhe/);
  // Kopie und Speichern behalten die Beziehung (auch wenn die Lore die höhere Nummer hat)
  assert.equal(w.kopie().passagier(lore).nr, dorf);
  const geladen = weltAusJson(weltZuJson(w), e.register);
  assert.equal(geladen.passagier(lore).nr, dorf);
  assert.deepEqual(geladen.wesen(), w.wesen());
  assert.equal(weltZuJson(geladen), weltZuJson(w), 'kanonisch');
  // Ausschnitt → drehen → verschieben → einfügen: der Passagier sitzt weiter in der Lore
  const bauteil = w.ausschnitt({ x: 0, y: 0, z: 0 }, { x: 20, y: 10, z: 20 });
  assert.equal(bauteil.wesen.filter((x) => x.sitztIn !== undefined).length, 1);
  for (const viertel of [0, 1, 2, 3]) {
    const t = v.verschiebe(v.drehe(bauteil, viertel), { x: 100, y: 5, z: -40 });
    const z = e.neueWelt();
    z.fuegeBauteilEin(t);
    const lz = z.wesen().find((x) => x.id === LORE && z.passagier(x.nr));
    assert.ok(lz, `Drehung ${viertel}: Lore mit Passagier`);
    const p = z.passagier(lz.nr);
    assert.equal(p.id, DORF);
    assert.deepEqual([p.x, p.y, p.z], [lz.x, lz.y, lz.z], 'Passagier steht in der Lore');
  }
  // ein Passagier ohne seine Lore im Ausschnitt sitzt dort nicht mehr
  const nurDorf = w.ausschnitt({ x: 4, y: 0, z: 3 }, { x: 4, y: 5, z: 4 });
  assert.equal(nurDorf.wesen.length, 2);
  const ohneLore = w.ausschnitt({ x: 100, y: 0, z: 100 }, { x: 101, y: 1, z: 101 });
  assert.equal(ohneLore.wesen.length, 0);
  // Aussteigen und Entfernen der Lore
  w.steigeAus(dorf);
  assert.equal(w.passagier(lore), null);
  assert.deepEqual([w.wesen().find((x) => x.nr === dorf).x], [4.5], 'bleibt an der Stelle');
  w.setzePassagier(dorf, lore);
  w.entferneWesen(lore);
  assert.equal(w.wesen().find((x) => x.nr === dorf).sitztIn, undefined, 'Lore weg: der Passagier sitzt nicht mehr');
});
