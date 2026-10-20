import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene1 } from '../hilfe.js';
import { STANDARD_REIHENFOLGE, Taktgeber, phaseVon } from '../../src/ebene1/taktgeber.js';

const e1 = ebene1();
const neu = (optionen = {}) => e1.neuerTaktgeber(e1.neuerSandkasten(e1.ebene0.neueWelt()), { aufzeichnen: true, ...optionen });

/** Mechanik, die nur ihre Aufrufe (Tick, Phase) aufschreibt. */
const spion = (id, tickart, extra = {}) => {
  const aufrufe = [];
  return { id, tickart, aufrufe, schritt: (k) => aufrufe.push({ tick: k.tick, phase: k.phase }), ...extra };
};

test('Redstone-Tick = 2 Spielticks; ungerade = P, gerade = C', () => {
  assert.equal(e1.regelwerk.parameter('takt.redstone-tick', 'spielticksProRedstoneTick'), 2);
  const t = neu();
  const s = spion('s', 'spieltick');
  t.registriere(s);
  t.laufe(6);
  assert.deepEqual(s.aufrufe.map((a) => a.phase), ['P', 'C', 'P', 'C', 'P', 'C']);
  assert.deepEqual(s.aufrufe.map((a) => a.tick), [1, 2, 3, 4, 5, 6]);
  assert.equal(phaseVon(1), 'P');
  assert.equal(phaseVon(2), 'C');
  assert.equal(phaseVon(1001), 'P');
  assert.equal(t.tick, 6);
});

/** Übertrager: liest in jedem P-Tick und merkt sich, wann er geschrieben hat. */
const uebertrager = (id, verzoegerung, nurErsterTick = false) => {
  const gelesen = [];
  const geschrieben = [];
  return {
    id, tickart: 'uebertrager', gelesen, geschrieben,
    lesen: (k) => {
      if (nurErsterTick && gelesen.length) return null;
      gelesen.push({ tick: k.tick, phase: k.phase });
      return { wert: k.tick, verzoegerung };
    },
    schreiben: (k, wert) => geschrieben.push({ tick: k.tick, phase: k.phase, wert }),
  };
};

test('Übertrager lesen im P-Tick und schreiben im folgenden C-Tick', () => {
  const t = neu();
  const u = uebertrager('verstaerker', 1);
  t.registriere(u);
  t.laufe(8);
  assert.deepEqual(u.gelesen.map((g) => [g.tick, g.phase]), [[1, 'P'], [3, 'P'], [5, 'P'], [7, 'P']]);
  assert.deepEqual(u.geschrieben.map((g) => [g.tick, g.phase, g.wert]), [[2, 'C', 1], [4, 'C', 3], [6, 'C', 5], [8, 'C', 7]]);
});

test('Übertrager-Verzögerung 1…4 Redstone-Ticks', () => {
  for (const d of [1, 2, 3, 4]) {
    const t = neu();
    const u = uebertrager(`u${d}`, d, true);
    t.registriere(u);
    t.laufe(12);
    assert.equal(u.geschrieben.length, 1, `d=${d}`);
    assert.equal(u.geschrieben[0].tick, 1 + 2 * d - 1, `d=${d}: Schreibtick = Lesetick + 2·d − 1`);
    assert.equal(u.geschrieben[0].phase, 'C');
    assert.equal(u.geschrieben[0].tick, 2 * d, `d=${d}: ${d / 10} s nach dem Lesen`);
  }
  assert.throws(() => { const t = neu(); t.registriere({ ...uebertrager('x', 0) }); t.laufe(1); }, /Verzögerung/);
});

test('Zwei Übertrager hintereinander addieren ihre Verzögerung', () => {
  const t = neu();
  const b = uebertrager('b', 1, true);
  const a = { ...uebertrager('a', 1, true) };
  // b liest, sobald a geschrieben hat: Kette über eine gemeinsame Variable
  let signal = null;
  a.schreiben = (k) => { signal = k.tick; };
  b.lesen = (k) => (signal !== null && !b.gelesen.length ? (b.gelesen.push(k.tick), { wert: 1, verzoegerung: 1 }) : null);
  b.schreiben = (k) => b.geschrieben.push(k.tick);
  t.registriere(a);
  t.registriere(b);
  t.laufe(10);
  assert.equal(signal, 2, 'erster Verstärker schreibt im Tick 2');
  assert.deepEqual(b.gelesen, [3], 'zweiter liest im nächsten P-Tick');
  assert.deepEqual(b.geschrieben, [4], 'insgesamt 4 Spielticks = 2 Redstone-Ticks = 0,2 s');
});

test('Mechanismen arbeiten nur im C-Tick', () => {
  const t = neu();
  const m = spion('kolben', 'mechanismus');
  t.registriere(m);
  t.laufe(6);
  assert.deepEqual(m.aufrufe.map((a) => [a.tick, a.phase]), [[2, 'C'], [4, 'C'], [6, 'C']]);
});

test('Redstone-Staub aktualisiert in jedem Spieltick', () => {
  const t = neu();
  const s = spion('staub', 'staub');
  t.registriere(s);
  t.laufe(5);
  assert.deepEqual(s.aufrufe.map((a) => a.tick), [1, 2, 3, 4, 5], 'auch 1-Tick-Impulse (ein Spieltick) kommen an');
});

test('Wesen-Bauteile arbeiten in P- und C-Tick', () => {
  const t = neu();
  const w = spion('trichterlore', 'wesen');
  t.registriere(w);
  t.laufe(4);
  assert.deepEqual(w.aufrufe.map((a) => a.phase), ['P', 'C', 'P', 'C']);
});

test('Arbeitsreihenfolge ist fest und kommt aus den Daten', () => {
  const daten = e1.regelwerk.parameter('takt.arbeitsreihenfolge', 'reihenfolge');
  assert.deepEqual(daten, STANDARD_REIHENFOLGE);
  const art = (id, tickart) => spion(id, tickart);
  const mechaniken = [
    art('w', 'wesen'), art('m', 'mechanismus'), art('s', 'staub'), art('t', 'spieltick'),
    { id: 'u', tickart: 'uebertrager', lesen: () => null, schreiben: () => {} },
  ];
  const t = neu();
  mechaniken.forEach((m) => t.registriere(m));
  t.laufe(2);
  const imTick2 = t.protokoll.filter((p) => p.tick === 2).map((p) => p.id);
  assert.deepEqual(imTick2, ['t', 's', 'm', 'w'], 'Spieltick, Staub, Mechanismus, Wesen (Übertrager ohne Schreibvorgang schweigt)');
  const anders = neu({ reihenfolge: ['wesen', 'mechanismus', 'staub', 'spieltick', 'uebertrager'] });
  mechaniken.forEach((m) => anders.registriere(m));
  anders.laufe(2);
  assert.deepEqual(anders.protokoll.filter((p) => p.tick === 2).map((p) => p.id), ['w', 'm', 's', 't']);
});

test('Innerhalb einer Stufe gilt die Reihenfolge der Anmeldung', () => {
  const t = neu();
  ['c', 'a', 'b'].forEach((id) => t.registriere(spion(id, 'spieltick')));
  t.schritt();
  assert.deepEqual(t.protokoll.map((p) => p.id), ['c', 'a', 'b']);
});

test('Gleicher Seed = gleiches Protokoll und gleiche Welt; anderer Seed = andere Welt', () => {
  const lauf = (seed) => {
    const welt = e1.ebene0.neueWelt();
    const sk = e1.neuerSandkasten(welt);
    const t = e1.neuerTaktgeber(sk, { seed, aufzeichnen: true });
    t.registriere({
      id: 'streuer', tickart: 'spieltick',
      schritt: (k) => k.welt.setzeBlock(k.zufall.ganzzahl(20), 0, k.zufall.ganzzahl(20), k.zufall.ereignis(0.5) ? 'minecraft:stone' : 'minecraft:dirt'),
    });
    t.laufe(300);
    return { protokoll: t.protokoll, welt: e1.ebene0.speichereWelt(sk.welt) };
  };
  const a = lauf(5), b = lauf(5), c = lauf(6);
  assert.deepEqual(a.protokoll, b.protokoll);
  assert.equal(a.welt, b.welt);
  assert.notEqual(a.welt, c.welt);
});

test('Geplante Ticks laufen im richtigen Tick, in Chunks außerhalb des Tickbereichs erst später', () => {
  const bereich = new (class { tickt(cx) { return cx === 0 && this.offen !== false; } })();
  const t = neu({ tickbereich: bereich });
  const ausgefuehrt = [];
  t.registriere({ id: 'wasser', tickart: 'spieltick', schritt() {}, geplanterTick: (k, e) => ausgefuehrt.push([k.tick, e.x, e.daten]) });
  t.geplant.plane({ x: 1, z: 1, ab: 3, mechanik: 'wasser', daten: 'nah' });
  t.geplant.plane({ x: 40, z: 0, ab: 2, mechanik: 'wasser', daten: 'fern' });
  t.laufe(5);
  assert.deepEqual(ausgefuehrt, [[3, 1, 'nah']]);
  bereich.offen = true;
  bereich.tickt = () => true;
  t.schritt();
  assert.deepEqual(ausgefuehrt.at(-1), [6, 40, 'fern'], 'wird nachgeholt, sobald der Chunk tickt');
});

test('Mechaniken können beim Ausführen weitere Ticks planen', () => {
  const t = neu();
  const ticks = [];
  t.registriere({
    id: 'kette', tickart: 'spieltick',
    schritt: (k) => { if (k.tick === 1) k.plane({ x: 0, z: 0, ab: 4, mechanik: 'kette' }); },
    geplanterTick: (k) => { ticks.push(k.tick); if (ticks.length < 3) k.plane({ x: 0, z: 0, ab: k.tick + 2, mechanik: 'kette' }); },
  });
  t.laufe(12);
  assert.deepEqual(ticks, [4, 6, 8]);
});

test('Anmeldung und Reihenfolge werden streng geprüft', () => {
  const t = neu();
  t.registriere(spion('a', 'spieltick'));
  assert.throws(() => t.registriere(spion('a', 'spieltick')), /schon angemeldet/);
  assert.throws(() => t.registriere({ id: 'x', tickart: 'quatsch', schritt() {} }), /Tickart/);
  assert.throws(() => t.registriere({ id: 'y', tickart: 'uebertrager', schritt() {} }), /lesen\(\)/);
  assert.throws(() => t.registriere({ id: 'z', tickart: 'staub' }), /schritt/);
  assert.throws(() => t.registriere({ tickart: 'staub', schritt() {} }), /id/);
  assert.throws(() => neu({ reihenfolge: ['staub', 'quatsch'] }), /Unbekannte Stufe/);
  assert.throws(() => neu({ reihenfolge: ['staub', 'staub'] }), /Doppelte/);
  assert.throws(() => t.laufe(-1));
  const ohneHandler = neu();
  ohneHandler.geplant.plane({ x: 0, z: 0, ab: 1, mechanik: 'gibtesnicht' });
  assert.throws(() => ohneHandler.schritt(), /unbekannte Mechanik/);
});

test('Taktgeber ohne Zusatzoptionen arbeitet mit der Standardreihenfolge', () => {
  const t = new Taktgeber(e1.neuerSandkasten(e1.ebene0.neueWelt()));
  assert.deepEqual(t.reihenfolge, [...STANDARD_REIHENFOLGE]);
  assert.equal(t.protokoll, null);
});
