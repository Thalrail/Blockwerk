import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';

const e1 = ebene1();
const e0 = e1.ebene0;
const LO = e1.lore;
const GOLD = 'minecraft:golden_rail', RAIL = 'minecraft:rail';

// Jonahs Messung 1 (Auslauf nach n Antriebsschienen) und Messung 3.1 (Steighöhe)
const AUSLAUF = { 1: 7.5, 2: 11, 3: 14, 4: 14.75, 5: 16.25, 6: 17, 7: 18, 8: 18.25, 9: 19.25, 10: 19.5, 11: 20, 12: 20.25, 13: 21, 14: 21.25, 15: 21.25, 16: 21.5, 17: 21.75, 18: 21.9, 19: 22, 27: 23, 37: 23 };
const HOEHE = { 1: 2.5, 2: 4, 3: 5, 4: 5.5, 5: 6, 6: 6.5, 7: 7 };

const boden = () => {
  const w = e0.neueWelt();
  for (let x = -5; x <= 70; x++) for (let z = -5; z <= 12; z++) w.setzeBlock(x, 0, z, 'minecraft:stone');
  return w;
};
const schiene = (w, x, y, z, antrieb, richtung = 1) => {
  w.setzeBlock(x, y, z, antrieb ? GOLD : RAIL, { rail_direction: richtung, ...(antrieb ? { rail_data_bit: true } : {}) });
};
/** Ebene Strecke in Ost-West-Richtung ab x = 0, z = 0; antrieb(i) sagt, ob die i-te Schiene eine bestromte Antriebsschiene ist. */
function strecke(n, antrieb, z = 0) {
  const w = boden();
  for (let i = 0; i < n; i++) schiene(w, i, 1, z, antrieb(i));
  return w;
}
/** Strecke mit Rampe: `davor` ebene Schienen, dann `hoehe` ansteigende, dann 3 ebene oben. antrieb(i): Index entlang der Bahn. */
function mitRampe({ davor, hoehe, antrieb }) {
  const w = boden();
  for (let i = 0; i < davor; i++) schiene(w, i, 1, 0, antrieb(i));
  for (let i = 0; i < hoehe; i++) { w.setzeBlock(davor + i, i, 0, 'minecraft:stone'); schiene(w, davor + i, 1 + i, 0, antrieb(davor + i), 2); }
  for (let i = 0; i < 3; i++) { w.setzeBlock(davor + hoehe + i, hoehe, 0, 'minecraft:stone'); schiene(w, davor + hoehe + i, 1 + hoehe, 0, antrieb(davor + hoehe + i)); }
  return w;
}
const START = { pos: { x: 0, y: 1, z: 0 }, richtung: 'east' };
const analyse = (w, start = START) => LO.analysiere(LO.bahn(w, start.pos, start.richtung));

test('Lore: Auslauf nach n Antriebsschienen', () => {
  for (const [n, w] of Object.entries(AUSLAUF)) assert.equal(LO.auslauf(Number(n)), w, `n=${n}`);
  assert.equal(LO.auslauf(0), 0);
  assert.equal(LO.auslauf(100), 23, 'über der letzten Messung gesättigt');
  let vorher = 0;
  for (let n = 0; n <= 45; n++) { const a = LO.auslauf(n); assert.ok(a >= vorher, `monoton bei n=${n}`); assert.ok(a <= 23); vorher = a; }
  assert.ok(LO.auslauf(23) > 22 && LO.auslauf(23) < 23, 'zwischen den Messpunkten 19 und 27 linear');
  assert.throws(() => LO.auslauf(-1));
  assert.throws(() => LO.auslauf(1.5));
  // Die Regeldaten sind die einzige Quelle: Tabelle in den Daten stimmt mit der Messung überein
  assert.deepEqual(e1.regelwerk.parameter('lore.auslauf', 'tabelle'), Object.fromEntries(Object.entries(AUSLAUF)));
});

test('Lore: Steighöhe nach n Antriebsschienen', () => {
  for (const [n, h] of Object.entries(HOEHE)) assert.equal(LO.steighoehe(Number(n)), h, `n=${n}`);
  assert.equal(LO.steighoehe(8), 7, 'ab 8: mindestens 7');
  assert.equal(LO.steighoehe(30), 7);
  assert.equal(LO.steighoehe(0), 0);
  // Je mehr Antrieb, desto höher
  for (let n = 1; n < 8; n++) assert.ok(LO.steighoehe(n + 1) >= LO.steighoehe(n));
});

test('Lore: Abstand der Antriebsschienen auf ebener Strecke', () => {
  const erwartet = { 1: 'ja', 2: 'ja', 4: 'ja', 6: 'ja', 8: 'ja', 9: 'unklar', 10: 'nein', 12: 'nein' };
  for (const [k, u] of Object.entries(erwartet)) assert.equal(LO.abstandEben(Number(k)), u, `k=${k}`);
  // k = Anzahl normaler Schienen dazwischen + 1: stimmt mit der Auslaufstrecke von 7,5 überein
  for (let k = 1; k <= 14; k++) assert.equal(LO.luecke(k - 1, 1), LO.abstandEben(k), `Lücke bei k=${k}`);
  assert.equal(LO.luecke(10, 2), 'ja', 'nach 2 Antriebsschienen (Auslauf 11) reichen 10 Schienen sicher');
  assert.equal(LO.luecke(11, 2), 'unklar', 'ganzzahliger Auslauf: ob vom Ende der Schiene oder von der Lore gezählt, ist offen');
  assert.equal(LO.luecke(12, 2), 'nein', 'Auslauf 11 ist ganzzahlig: 12 ist sicher zu weit');
  assert.deepEqual([14, 15, 16].map((m) => LO.luecke(m, 4)), ['ja', 'unklar', 'nein'], 'Auslauf 14,75: 15 liegt dazwischen');
  assert.throws(() => LO.abstandEben(0));
});

test('Lore: Abstand der Antriebsschienen auf einer Rampe', () => {
  for (let k = 1; k <= 8; k++) {
    const mit = k <= 2 ? 'ja' : k <= 6 ? 'ja' : 'nein';
    const ohne = k <= 2 ? 'ja' : 'nein';
    assert.equal(LO.abstandSteigung(k, true), mit, `k=${k}, erste Steigschiene angetrieben`);
    assert.equal(LO.abstandSteigung(k, false), ohne, `k=${k}, erste Steigschiene normal`);
  }
  assert.equal(LO.abstandSteigung(3, true, 5), 'ja', 'bis 5 Blöcke Höhe gemessen');
  assert.equal(LO.abstandSteigung(3, true, 6), 'unklar', 'darüber nicht gemessen');
  assert.equal(LO.abstandSteigung(7, true, 12), 'nein', 'sicher nein bleibt nein');
});

test('Lore: Fahrzeit auf bestromter Strecke', () => {
  assert.equal(LO.fahrzeit(20), 3.2);
  assert.ok(Math.abs(LO.fahrzeit(32) - 5.01) / 5.01 < 0.03, 'Ring aus 32 Schienen: 5,01 s gemessen, Richtwert höchstens 3 % daneben');
  assert.equal(LO.fahrzeit(0), 0);
  assert.throws(() => LO.fahrzeit(-1));
});

test('Lore: Kurven und Dorfbewohner kosten kein Tempo', () => {
  assert.equal(e1.regelwerk.parameter('lore.kurven-und-mob', 'kurvenverlust'), 0);
  assert.equal(e1.regelwerk.parameter('lore.kurven-und-mob', 'dorfbewohnerFaktor'), 1);
  // Ring 9×9 (32 Schienen): wird komplett abgelaufen und schließt sich
  const w = boden();
  const zellen = [];
  for (let x = 0; x <= 8; x++) zellen.push([x, 0]);
  for (let z = 1; z <= 8; z++) zellen.push([8, z]);
  for (let x = 7; x >= 0; x--) zellen.push([x, 8]);
  for (let z = 7; z >= 1; z--) zellen.push([0, z]);
  assert.equal(zellen.length, 32);
  zellen.forEach(([x, z], i) => {
    e1.schienen.platziere(w, { x, y: 1, z }, RAIL);
    if (i % 4 === 1) { const b = w.leseBlock(x, 1, z); w.setzeBlock(x, 1, z, GOLD, { rail_direction: b.zustand.rail_direction, rail_data_bit: true }); }
  });
  const b = LO.bahn(w, { x: 1, y: 1, z: 0 }, 'east');
  assert.equal(b.ende, 'ring');
  assert.equal(b.schienen.length, 32);
  assert.equal(b.schienen.filter((s) => s.antrieb).length, 8);
  assert.deepEqual(LO.analysiere(b), [], 'Antrieb alle 4 Schienen: überall ausreichend, Kurven kosten nichts');
});

test('Lore: Bahn ablaufen (Linie, Sackgasse, einseitig, Richtung)', () => {
  const w = strecke(6, (i) => i === 0);
  const b = LO.bahn(w, { x: 0, y: 1, z: 0 }, 'east');
  assert.deepEqual(b.schienen.map((s) => s.pos.x), [0, 1, 2, 3, 4, 5]);
  assert.equal(b.ende, 'leer', 'Ende der Linie');
  assert.deepEqual(b.schienen.map((s) => s.antrieb), [true, false, false, false, false, false]);
  const rueck = LO.bahn(w, { x: 5, y: 1, z: 0 }, 'west');
  assert.deepEqual(rueck.schienen.map((s) => s.pos.x), [5, 4, 3, 2, 1, 0], 'umgekehrte Richtung');
  assert.throws(() => LO.bahn(w, { x: 0, y: 1, z: 0 }, 'north'), /kein Ende nach north/);
  assert.throws(() => LO.bahn(w, { x: 9, y: 1, z: 9 }, 'east'), /keine Schiene/);
  // unbestromte Antriebsschiene zählt nicht als Antrieb
  const w2 = boden(); w2.setzeBlock(0, 1, 0, GOLD, { rail_direction: 1, rail_data_bit: false });
  assert.equal(LO.bahn(w2, { x: 0, y: 1, z: 0 }, 'east').schienen[0].antrieb, false);
  // einseitige Verbindung beendet die Bahn
  const w3 = boden(); schiene(w3, 0, 1, 0, true); w3.setzeBlock(1, 1, 0, RAIL, { rail_direction: 0 });
  assert.equal(LO.bahn(w3, { x: 0, y: 1, z: 0 }, 'east').ende, 'einseitig');
  // Rampe: hoch = +1 beim Aufsteigen
  const r = mitRampe({ davor: 2, hoehe: 3, antrieb: () => false });
  const br = LO.bahn(r, { x: 0, y: 1, z: 0 }, 'east');
  assert.deepEqual(br.schienen.map((s) => s.hoch), [0, 0, 1, 1, 1, 0, 0, 0]);
});

test('Lore: Rampe über 5 Blöcke ist unklar', () => {
  const w = mitRampe({ davor: 2, hoehe: 8, antrieb: (i) => i === 0 || i === 2 || i === 4 || i === 6 || i === 8 });
  const befunde = analyse(w);
  assert.deepEqual(befunde.map((b) => [b.art, b.urteil]), [['rampe', 'unklar']], 'Abstand 2 wäre bis 5 Blöcke ok, darüber nicht gemessen');
  const w5 = mitRampe({ davor: 2, hoehe: 5, antrieb: (i) => i === 0 || i === 2 || i === 4 || i === 6 });
  assert.deepEqual(analyse(w5), [], 'bis 5 Blöcke: ok');
});

test('Prüfer: Lore bleibt stehen', () => {
  const pruefe = (w, start = START) => e1.pruefe(w, { schienen: null, loreStart: start }).filter((m) => m.regel === 'pruefer.lore-stillstand');
  // ebene Strecke: Antrieb alle 8 → still
  assert.deepEqual(pruefe(strecke(50, (i) => i % 8 === 0)), [], 'k = 8 (gemessen: kommt durch)');
  // alle 10 → Verstoß mit Koordinate der Stelle, an der sie stehen bleibt (nach 7,5 Blöcken Auslauf, also im 9. Feld nach der Antriebsschiene)
  const zehn = pruefe(strecke(50, (i) => i % 10 === 0));
  assert.ok(zehn.every((m) => m.schwere === 'verstoss'));
  assert.deepEqual(zehn.map((m) => m.ort.x), [8, 18, 28, 38], 'jeweils vor der nächsten Antriebsschiene');
  assert.match(zehn[0].meldung, /bleibt hier stehen/);
  // alle 9 → Hinweis (nicht gemessen)
  const neun = pruefe(strecke(50, (i) => i % 9 === 0));
  assert.ok(neun.length > 0 && neun.every((m) => m.schwere === 'hinweis'));
  // Antriebsschienen am Stück erhöhen den Auslauf: 2 am Stück, dann 11 normale
  assert.deepEqual(pruefe(strecke(40, (i) => i < 2 || i === 12 || i === 13)), [], 'nach 2 Antriebsschienen (Auslauf 11) 10 Schienen ohne Antrieb: sicher innerhalb des Auslaufs');
  assert.equal(pruefe(strecke(40, (i) => i < 2 || i === 13 || i === 14))[0].schwere, 'hinweis', '11 normale Schienen: Zählweise des Auslaufs offen');
  assert.equal(pruefe(strecke(40, (i) => i < 2 || i === 16 || i === 17))[0].schwere, 'verstoss', 'nach 2 Antriebsschienen 14 normale: zu weit');
  // Bahn ohne Antrieb am Start: Hinweis
  const ohne = pruefe(strecke(10, () => false));
  assert.deepEqual(ohne.map((m) => m.schwere), ['hinweis']);
  const spaet = pruefe(strecke(10, (i) => i >= 3));
  assert.deepEqual(spaet.map((m) => m.schwere), ['hinweis']);
  assert.match(spaet[0].meldung, /ersten 3 Schienen/);
  // Rampe: Antrieb alle 3, erste Steigschiene angetrieben → ok; erste normal → Verstoß
  assert.deepEqual(pruefe(mitRampe({ davor: 3, hoehe: 5, antrieb: (i) => i === 0 || i === 3 || i === 6 })), [], 'k = 3, erste Steigschiene angetrieben');
  const ohneErste = pruefe(mitRampe({ davor: 3, hoehe: 5, antrieb: (i) => i === 0 || i === 4 || i === 7 }));
  assert.ok(ohneErste.some((m) => m.schwere === 'verstoss'), 'k = 4, erste Steigschiene normal');
  // Rampe ohne jeden Antrieb darin, mit 3 Antriebsschienen davor: Steighöhe 5 → 5 hoch ok, 7 hoch nein
  assert.deepEqual(pruefe(mitRampe({ davor: 3, hoehe: 5, antrieb: (i) => i < 3 })), []);
  assert.ok(pruefe(mitRampe({ davor: 3, hoehe: 7, antrieb: (i) => i < 3 })).some((m) => m.schwere === 'verstoss'));
  assert.equal(pruefe(mitRampe({ davor: 3, hoehe: 4, antrieb: () => false }))[0].schwere, 'hinweis', 'ganz ohne Antrieb: nur der Hinweis „Start ohne Antrieb“ für die erste Meldung');
});

test('Prüfer: Lore – deterministisch, Welt unverändert, Drehen vertauscht sich mit der Prüfung', () => {
  const w = strecke(30, (i) => i % 10 === 0);
  const vorher = e0.speichereWelt(w);
  const a = e1.pruefe(w, { schienen: null, loreStart: START });
  const b = e1.pruefe(w, { schienen: null, loreStart: START });
  assert.deepEqual(a, b);
  assert.equal(e0.speichereWelt(w), vorher);
  // gedreht um 90°: Strecke läuft nach Süden; Startschiene bei (0,1,0), Richtung south
  const teil = w.ausschnitt({ x: -5, y: 0, z: -5 }, { x: 40, y: 3, z: 12 });
  const g = e0.neueWelt(); g.fuegeBauteilEin(e0.vermesser.drehe(teil, 1));
  const gedreht = e1.pruefe(g, { schienen: null, loreStart: { pos: { x: 0, y: 1, z: 0 }, richtung: 'south' } }).filter((m) => m.regel === 'pruefer.lore-stillstand');
  const original = a.filter((m) => m.regel === 'pruefer.lore-stillstand');
  assert.deepEqual(gedreht.map((m) => [m.schwere, m.ort.z]), original.map((m) => [m.schwere, m.ort.x]), 'gleiche Stellen, aus Ost-West wird Nord-Süd');
});
