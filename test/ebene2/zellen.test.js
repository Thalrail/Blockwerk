import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene2 } from '../hilfe.js';
import { TESTPALETTE, definiere, param, pruefePaket } from '../../src/ebene2/index.js';
import { rahmenUrsprung, paketZuRahmen, rahmenZuPaket, quaderZellen, zellenInWelt, leereZellen } from '../../src/ebene2/zellen.js';

const e2 = ebene2();
const e0 = e2.ebene0;
const k = (z) => `${z.x},${z.y},${z.z}`;
const menge = (liste) => new Set(liste.map(k));
const nf = (n) => 0 - (0 - n); // -0 → 0
/** Drehung um 90° im Uhrzeigersinn von oben, unabhängig vom Vermesser: (x, z) → (-z, x). */
const dreheZelle = (z, viertel) => { let { x, z: zz } = z; for (let i = 0; i < ((viertel % 4) + 4) % 4; i++) [x, zz] = [-zz, x]; return { x: nf(x), y: z.y, z: nf(zz) }; };
const lageAn = (z, l) => { const d = dreheZelle(z, l.drehung); return { x: d.x + l.x, y: d.y + l.y, z: d.z + l.z }; };

const RAUM = e2.baue('bau.raum', { breite: 4, tiefe: 7, hoehe: 3, wandstaerke: 2 }); // nichtquadratisch, Nullpunkt nicht in der Ecke
const TREPPE = e2.baue('bau.treppe', { stufen: 5, breite: 3 });

test('Referenzrahmen: Ursprung an der Ecke Nordwest unten der Blöcke, alle Blöcke ≥ 0, Hin- und Rückweg stimmen', () => {
  for (const p of [RAUM, TREPPE, e2.baue('bau.saeule', { durchmesser: 4, hoehe: 9 }), e2.baue('bau.wand', { laenge: 6, hoehe: 4, dicke: 3 })]) {
    const u = rahmenUrsprung(p);
    const r = p.bloecke.map((b) => paketZuRahmen(p, b));
    for (const a of ['x', 'y', 'z']) assert.equal(Math.min(...r.map((z) => z[a])), 0, `${p.id}: Minimum ${a} im Rahmen ist 0`);
    for (const a of ['x', 'y', 'z']) assert.equal(u[a], Math.min(...p.bloecke.map((b) => b[a])), `${p.id}: Ursprung ${a}`);
    for (const b of p.bloecke) assert.deepEqual(rahmenZuPaket(p, paketZuRahmen(p, b)), { x: nf(b.x), y: nf(b.y), z: nf(b.z) });
  }
  assert.throws(() => rahmenUrsprung({ id: 'leer', bloecke: [] }), /Referenzrahmen/);
  assert.throws(() => paketZuRahmen(RAUM, { x: 0.5, y: 0, z: 0 }), /ganze Zahlen/);
});

test('Referenzrahmen: eine Aussparung außerhalb der Blöcke verschiebt den Rahmen nicht', () => {
  const mit = definiere({
    id: 'test.mit', titel: 'T', quelle: 'https://beispiel.invalid/', testszenario: { start: 's', erwartung: 'e' }, parameter: [],
    baue: () => ({ bloecke: [{ x: 0, y: 0, z: 0, rolle: 'wand' }, { x: 1, y: 1, z: 0, rolle: 'wand' }], aussparungen: [{ art: 'freihaltung', von: { x: -3, y: -2, z: -4 }, bis: { x: 5, y: 6, z: 7 } }] }),
  }).erzeuge();
  assert.deepEqual(rahmenUrsprung(mit), { x: 0, y: 0, z: 0 });
  assert.deepEqual(paketZuRahmen(mit, { x: -3, y: -2, z: -4 }), { x: -3, y: -2, z: -4 }, 'die Aussparung hat negative Rahmenkoordinaten');
});

test('Zellen in die Welt: stimmt für alle vier Drehungen mit dem direkten Weg über ein fertiges Bauteil überein (nichtquadratische Pakete)', () => {
  for (const p of [RAUM, TREPPE]) {
    for (const drehung of [0, 1, 2, 3, -1, 5]) {
      const lage = { x: 7, y: 70, z: -13, drehung };
      // direkter Weg wie in materialisiere: Paket platzieren, Ausschnitt, drehen, verschieben
      const w = e0.neueWelt();
      e2.platziere(w, p, TESTPALETTE);
      const h = p.platzbedarf.huelle;
      let bauteil = e0.vermesser.drehe(w.ausschnitt(h.von, h.bis), drehung);
      bauteil = e0.vermesser.verschiebe(bauteil, { x: lage.x, y: lage.y, z: lage.z });
      const direkt = menge(bauteil.bloecke);
      const ueberZellen = zellenInWelt(e0, p.bloecke, lage);
      assert.deepEqual(menge(ueberZellen), direkt, `${p.id}, Drehung ${drehung}`);
      // und gegen die geschlossene Formel (unabhängig vom Vermesser)
      assert.deepEqual(menge(p.bloecke.map((b) => lageAn(b, lage))), direkt, `${p.id}, Drehung ${drehung}: Formel`);
    }
  }
});

test('Zellen in die Welt: Zellen außerhalb der Paketbegrenzung (Aussparung) laufen durch dieselbe Kette', () => {
  const zellen = quaderZellen({ x: -5, y: -2, z: -9 }, { x: 3, y: 4, z: 2 });
  for (const drehung of [0, 1, 2, 3]) {
    const lage = { x: -40, y: 12, z: 99, drehung };
    assert.deepEqual(menge(zellenInWelt(e0, zellen, lage)), menge(zellen.map((z) => lageAn(z, lage))), `Drehung ${drehung}`);
  }
});

test('Zellen in die Welt: Träger- und Kinddrehung, alle 16 Kombinationen, nacheinander angewendet = zusammengesetzte Lage', () => {
  const zellen = quaderZellen({ x: -2, y: 0, z: -3 }, { x: 1, y: 1, z: 4 }); // nichtquadratisch, Nullpunkt nicht in der Ecke
  const kindLage = (d) => ({ x: 3, y: 1, z: -2, drehung: d });
  const traegerLage = (d) => ({ x: -10, y: 64, z: 25, drehung: d });
  for (const dk of [0, 1, 2, 3]) for (const dt of [0, 1, 2, 3]) {
    const kette = zellenInWelt(e0, zellenInWelt(e0, zellen, kindLage(dk)), traegerLage(dt));
    // zusammengesetzt: Drehung dk + dt, Verschiebung = Träger-Drehung der Kind-Verschiebung + Träger-Verschiebung
    const v = dreheZelle({ x: 3, y: 1, z: -2 }, dt);
    const gesamt = { x: v.x - 10, y: v.y + 64, z: v.z + 25, drehung: (dk + dt) % 4 };
    assert.deepEqual(zellenInWelt(e0, zellen, gesamt), kette, `Kind ${dk}, Träger ${dt}`);
    assert.deepEqual(menge(kette), menge(zellen.map((z) => lageAn(lageAn(z, kindLage(dk)), traegerLage(dt)))), `Kind ${dk}, Träger ${dt}: Formel`);
  }
});

test('Zellen in die Welt: sortiert, ohne Doppelte, deterministisch; ungültige Eingaben werden abgelehnt', () => {
  const z = [{ x: 2, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }];
  const a = zellenInWelt(e0, z, { x: 0, y: 0, z: 0, drehung: 1 });
  assert.equal(a.length, 3);
  assert.deepEqual(a, zellenInWelt(e0, z.slice().reverse(), { x: 0, y: 0, z: 0, drehung: 1 }));
  assert.deepEqual(a, a.slice().sort((p, q) => p.y - q.y || p.z - q.z || p.x - q.x));
  for (const c of a) for (const v of [c.x, c.z]) assert.ok(!Object.is(v, -0), 'kein -0');
  assert.throws(() => zellenInWelt(e0, [{ x: 0.5, y: 0, z: 0 }], { x: 0, y: 0, z: 0, drehung: 0 }), /ganze Zahlen/);
  assert.throws(() => zellenInWelt(e0, z, { x: 0, y: 0, z: 0 }), /Lage braucht/);
  assert.throws(() => quaderZellen({ x: 0, y: 0, z: 0 }, { x: 1, y: 'a', z: 1 }), /ganze Zahlen/);
  assert.deepEqual(zellenInWelt(e0, [], { x: 0, y: 0, z: 0, drehung: 2 }), []);
});

test('Zellen leeren: nur Blöcke werden entfernt, leere Zellen bleiben unberührt, das Ergebnis nennt die entfernten Blöcke (nur über Ebene 0)', () => {
  const w = e0.neueWelt();
  e2.platziere(w, RAUM, TESTPALETTE, { x: 0, y: 64, z: 0 });
  const zellen = quaderZellen({ x: -3, y: 64, z: -1 }, { x: -1, y: 64, z: 1 }); // teils in der Wand (Block), teils im leeren Innenraum
  const eintraege = zellen.filter((c) => !w.istLuft(c.x, c.y, c.z));
  assert.ok(eintraege.length > 0 && eintraege.length < zellen.length, 'der Quader enthält Blöcke und Luft');
  const entfernt = leereZellen(w, zellen);
  assert.equal(entfernt.length, eintraege.length);
  assert.deepEqual(entfernt.map(k), eintraege.map(k), 'nur echte Blöcke, in der Reihenfolge der Zellen');
  for (const c of zellen) assert.ok(w.istLuft(c.x, c.y, c.z));
  // Nachbarn bleiben stehen
  const nachbar = RAUM.bloecke.find((b) => !zellen.some((c) => c.x === b.x && c.y + 0 === b.y + 64 && c.z === b.z));
  assert.ok(!w.istLuft(nachbar.x, nachbar.y + 64, nachbar.z));
  // zweiter Aufruf: nichts mehr zu entfernen
  assert.deepEqual(leereZellen(w, zellen), []);
  for (const e of entfernt) assert.equal(e.id, 'minecraft:stone');
  assert.throws(() => leereZellen(w, [{ x: 0, y: 'a', z: 0 }]), /ganze Zahlen/);
});

test('Zellen leeren: Blockzustände und Inhalt gehen in die Rückgabe, Wesen und andere Zellen bleiben unberührt', () => {
  const w = e0.neueWelt();
  e2.platziere(w, e2.baue('bau.treppe', { stufen: 2, breite: 1 }), TESTPALETTE, { x: 0, y: 10, z: 0 });
  const entfernt = leereZellen(w, [{ x: 0, y: 10, z: 0 }]);
  assert.equal(entfernt.length, 1);
  assert.equal(entfernt[0].id, 'minecraft:stone_stairs');
  assert.ok(entfernt[0].zustand && typeof entfernt[0].zustand === 'object');
  assert.ok(!w.istLuft(0, 11, -1), 'die zweite Stufe bleibt');
});

test('Quader und Zellen: zu große Quader und nicht sicher darstellbare Zahlen werden abgelehnt, ohne zu rechnen', () => {
  const v = { x: 0, y: 0, z: 0 };
  assert.throws(() => quaderZellen(v, { x: 1000000000, y: 0, z: 0 }), /zu viel/);
  assert.throws(() => quaderZellen({ x: 2 ** 53, y: 0, z: 0 }, { x: 2 ** 53, y: 0, z: 0 }), /ganze Zahlen/);
  assert.throws(() => quaderZellen({ x: 1, y: 0, z: 0 }, v), /hinter/);
  assert.throws(() => zellenInWelt(e0, [{ x: 2 ** 53, y: 0, z: 0 }], { x: 0, y: 0, z: 0, drehung: 0 }), /ganze Zahlen/);
  assert.throws(() => zellenInWelt(e0, [v], { x: 2 ** 53, y: 0, z: 0, drehung: 0 }), /Lage braucht/);
  assert.equal(quaderZellen(v, v).length, 1);
});
