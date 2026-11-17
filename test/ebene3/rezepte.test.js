// D2 Bausteinrezepte: Auswertung (Höhen, Parität, Stufen), Datenprüfung, Größenreihe, Rückfragen des Prüfers (Ebene 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene4 } from '../hilfe.js';
import { erzeugeRezepte, RezeptFehler } from '../../src/ebene3/index.js';

const L = ebene4();
const R = L.ebene3.rezepte;
const huelle = (g) => { const h = L.ebene2.baue(g.baustein, g.parameter).platzbedarf.huelle; return { b: h.bis.x - h.von.x + 1, t: h.bis.z - h.von.z + 1, h: h.bis.y - h.von.y + 1 }; };
const minHoehe = (B, T) => Math.max(16, B, T);

test('Rezept turm: Höhen summieren sich zur Gesamthöhe, Glieder stapeln lückenlos, Hülle trifft das Außenmaß', () => {
  for (const [B, T, H] of [[9, 9, 16], [13, 13, 34], [21, 15, 40], [10, 11, 25], [45, 45, 45], [9, 9, 120]]) {
    const r = R.wendeRezeptAn('turm', { breite: B, tiefe: T, hoehe: H });
    let y = 0;
    for (const g of r.teile) {
      const m = huelle(g);
      assert.equal(g.versatz.y, y, `${B}×${T}×${H}: ${g.glied} steht direkt über dem vorigen`);
      y += m.h;
      assert.equal((B - m.b) % 2, 0, `${B}×${T}×${H}: ${g.glied} Breite behält die Parität (Mittigkeit)`);
      assert.equal((T - m.t) % 2, 0, `${B}×${T}×${H}: ${g.glied} Tiefe behält die Parität (Mittigkeit)`);
      assert.ok(m.b <= B && m.t <= T && m.h >= 1);
    }
    assert.equal(y, H, `${B}×${T}×${H}: Summe der Höhen`);
    assert.deepEqual(huelle(r.teile[0]), { b: B, t: T, h: huelle(r.teile[0]).h }, 'der Sockel füllt die Außenmaße');
  }
});

test('Rezept turm: Stufen schließen (Wand des tragenden oder auskragenden Glieds mindestens Einzugsunterschied plus Auflage)', () => {
  const auflage = R.rezept('turm').auflage ?? 0;
  for (const [B, T, H] of [[13, 13, 34], [45, 45, 60], [21, 9, 40], [32, 32, 32], [9, 9, 16]]) {
    const g = R.wendeRezeptAn('turm', { breite: B, tiefe: T, hoehe: H }).teile;
    for (let i = 1; i < g.length; i++) {
      const a = huelle(g[i - 1]), b = huelle(g[i]);
      const diff = Math.max(Math.abs(a.b - b.b), Math.abs(a.t - b.t)) / 2;
      const traeger = a.b + a.t > b.b + b.t ? g[i - 1] : g[i]; // oben schmaler: unten trägt; oben breiter: oben kragt aus
      assert.ok(traeger.parameter.wandstaerke >= diff + auflage, `${B}×${T}×${H}: Stufe ${g[i].glied} (Wand ${traeger.parameter.wandstaerke} < Einzug ${diff} + Auflage ${auflage})`);
    }
  }
});

test('Rezept turm: Größenreihe 9–45 (gerade/ungerade, Breite ≠ Tiefe, knapp über dem Mindestmaß bis sehr hoch): gültig oder klar abgelehnt', () => {
  let ok = 0;
  for (let B = 9; B <= 45; B++) for (const T of [B, B + 4, Math.max(9, B - 4), B + 1]) for (const H of [minHoehe(B, T), minHoehe(B, T) + 1, 40, 80, 120]) {
    const r = R.wendeRezeptAn('turm', { breite: B, tiefe: T, hoehe: Math.max(H, minHoehe(B, T)) });
    assert.equal(r.teile.reduce((s, g) => s + huelle(g).h, 0), Math.max(H, minHoehe(B, T)));
    ok++;
  }
  assert.ok(ok > 700);
});

test('Rezept turm: unter dem Mindestmaß, nicht ganzzahlig oder unbekannt → RezeptFehler mit Begründung (kein Absturz)', () => {
  const f = (name, g, muster) => assert.throws(() => R.wendeRezeptAn(name, g), (x) => x instanceof RezeptFehler && muster.test(x.message));
  f('turm', { breite: 8, tiefe: 9, hoehe: 30 }, /mindestens 9 × 9 × 16/);
  f('turm', { breite: 9, tiefe: 8, hoehe: 30 }, /mindestens/);
  f('turm', { breite: 9, tiefe: 9, hoehe: 15 }, /mindestens 9 × 9 × 16/);
  f('turm', { breite: 20, tiefe: 12, hoehe: 19 }, /mindestens 9 × 9 × 20.*größere Breite/);
  f('turm', { breite: 9.5, tiefe: 9, hoehe: 30 }, /ganze Außenmaße/);
  f('turm', undefined, /ganze Außenmaße/);
  f('burg', { breite: 9, tiefe: 9, hoehe: 30 }, /kennt Blockwerk nicht.*turm/);
  f(undefined, { breite: 9, tiefe: 9, hoehe: 30 }, /kennt Blockwerk nicht/);
});

test('Rezept turm: deterministisch', () => {
  const a = R.wendeRezeptAn('turm', { breite: 21, tiefe: 15, hoehe: 40 });
  assert.deepEqual(R.wendeRezeptAn('turm', { breite: 21, tiefe: 15, hoehe: 40 }), a);
});

// Datenprüfung: ein kaputtes Rezept wirft schon beim Laden
const mitRezept = (aendere) => {
  const reg = L.ebene1.regelwerk;
  const d = structuredClone(reg.regel('rezepte.turm'));
  aendere(d.parameter);
  const falsch = Object.create(reg, { alle: { value: () => [d] }, hat: { value: (id) => id === d.id || reg.hat(id) }, regel: { value: (id) => (id === d.id ? d : reg.regel(id)) } });
  return () => erzeugeRezepte({ regelwerk: falsch, ebene2: L.ebene2 });
};
test('Rezeptdaten: gültige laden, kaputte werfen RezeptFehler beim Laden', () => {
  assert.doesNotThrow(mitRezept(() => {}));
  for (const a of [0, 1]) assert.doesNotThrow(mitRezept((p) => { p.auflage = a; }), `Auflage ${a}`);
  assert.throws(mitRezept((p) => { p.auflage = 2; }), (f) => f instanceof RezeptFehler && /0 oder 1/.test(f.message));
  const kaputt = {
    'mindest fehlt': (p) => { delete p.mindest; },
    'mindest ohne hoehe': (p) => { delete p.mindest.hoehe; },
    'keine Glieder': (p) => { p.glieder = []; },
    'Glied-Id doppelt': (p) => { p.glieder[1].id = p.glieder[0].id; },
    'Baustein unbekannt': (p) => { p.glieder[0].baustein = 'form.gibtesnicht'; },
    'Baustein keine Form': (p) => { p.glieder[0].baustein = 'bau.raum'; },
    'Einzug zu groß': (p) => { p.glieder[1].einzug.anteil = 0.5; },
    'Einzug ohne min': (p) => { delete p.glieder[1].einzug.min; },
    'Auflage negativ': (p) => { p.auflage = -1; },
    'Auflage nicht ganz': (p) => { p.auflage = 0.5; },
    'Auflage 2': (p) => { p.auflage = 2; },
    'Wandstärke negativ': (p) => { p.glieder[1].wandstaerke = -1; },
    'Höhe ohne Art': (p) => { p.glieder[0].hoehe = { min: 1 }; },
    'Höhe mit zwei Arten': (p) => { p.glieder[0].hoehe = { anteil: 0.1, rest: 2 }; },
    'Höhe nicht positiv': (p) => { p.glieder[0].hoehe.anteil = 0; },
    'max unter min': (p) => { p.glieder[0].hoehe = { anteil: 0.1, min: 3, max: 2 }; },
    'kein Rest-Glied': (p) => { p.glieder = p.glieder.filter((g) => g.hoehe.rest === undefined); },
    'Rolle unbekannt': (p) => { p.glieder[0].rollen = { wand: 'gold' }; },
  };
  for (const [name, aendere] of Object.entries(kaputt)) assert.throws(mitRezept(aendere), RezeptFehler, name);
});
test('Rezeptdaten: Restglieder erlauben keine Grenzen (min, max, maxAnteil) und melden das klar', () => {
  for (const grenze of [{ min: 2 }, { max: 5 }, { maxAnteil: 0.5 }]) {
    const lade = mitRezept((p) => { Object.assign(p.glieder.find((g) => g.hoehe.rest !== undefined).hoehe, grenze); });
    assert.throws(lade, (f) => f instanceof RezeptFehler && /nur bei anteil und zuBreite/.test(f.message), JSON.stringify(grenze));
  }
});

// Ebene 4: der Prüfer fragt zurück, statt zu raten
const spec = (aendere = () => {}) => {
  const s = { schema: 1, version: 1, projekt: { name: 'T', bauplatz: { breite: 80, hoehe: 120, tiefe: 80 }, massstab: 1 }, teile: [{ id: 'turm', name: 'Turm', art: 'turm', wichtigkeit: 'muss', rezept: 'turm', form: { groesse: { breite: 13, tiefe: 13, hoehe: 34 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } }] };
  aendere(s.teile[0], s);
  return s;
};
const pfade = (s) => L.pruefe(s).rueckfragen.map((q) => q.pfad);
test('Prüfer: gültiges Rezept ohne Rückfrage', () => assert.deepEqual(L.pruefe(spec()).rueckfragen, []));
test('Prüfer: Rezept zusammen mit Baustein, Proportionen, Funktionen oder unbekannter Name → Rückfrage', () => {
  assert.deepEqual(pfade(spec((t) => { t.form.baustein = 'form.zylinder'; })), ['teile[0].form.baustein']);
  assert.deepEqual(pfade(spec((t) => { t.form.proportionen = { hoehe_zu_breite: 2 }; })), ['teile[0].form.proportionen']);
  assert.ok(pfade(spec((t) => { t.funktionen = [{ art: 'lager', sorten: ['x'] }]; })).includes('teile[0].funktionen'));
  assert.deepEqual(pfade(spec((t) => { t.rezept = 'burg'; })), ['teile[0].rezept']);
  assert.deepEqual(pfade(spec((t) => { t.rezept = 7; })), ['teile[0].rezept']);
});
test('Prüfer: Maße unter dem Mindestmaß oder ohne Größe → Rückfrage mit Mindestmaß, nie ein Absturz', () => {
  const q = L.pruefe(spec((t) => { t.form.groesse = { breite: 8, tiefe: 13, hoehe: 12 }; })).rueckfragen;
  assert.deepEqual(q.map((x) => x.pfad), ['teile[0].form.groesse.breite', 'teile[0].form.groesse.hoehe']);
  assert.match(q[0].frage, /ab 9 Blöcken/);
  assert.match(q[1].frage, /ab 16 Blöcken.*mindestens 1 × die größere Breite/);
  assert.deepEqual(pfade(spec((t) => { t.form.groesse = { breite: 13, tiefe: 13, hoehe: 12 }; })), ['teile[0].form.groesse.hoehe']);
  assert.deepEqual(pfade(spec((t) => { t.form.groesse = { breite: 13, tiefe: 13.5, hoehe: 34 }; })), ['teile[0].form.groesse.tiefe']);
  assert.deepEqual(pfade(spec((t) => { t.form.groesse = { breite: 13, tiefe: 13, hoehe: 34, wandstaerke: 2 }; })), ['teile[0].form.groesse.wandstaerke']);
  for (const form of [undefined, {}, { groesse: null }, { groesse: [] }, { groesse: { breite: '13', tiefe: 13, hoehe: 34 } }]) {
    const s = spec((t) => { if (form === undefined) delete t.form; else t.form = form; });
    assert.doesNotThrow(() => L.pruefe(s));
    assert.ok(pfade(s).length > 0);
  }
});
test('Prüfer: ein Rezept in einem anderen Bauteil → Rückfrage', () => {
  const s = spec((t, sp) => { sp.teile.push({ id: 'tuer', name: 'Tür', art: 'tuer', wichtigkeit: 'soll', rezept: 'turm', form: { groesse: { breite: 13, tiefe: 13, hoehe: 34 } }, lage: { bezug: 'turm', relation: 'wand-nord' }, stil: { stimmung: 'hell-nordisch' } }); });
  assert.ok(pfade(s).includes('teile[1].rezept'));
});
test('Leser sieht nur Name und Mindestmaße des Rezepts, nie die Schritte; Schema bleibt 1', () => {
  assert.deepEqual(Object.keys(L.vokabular.rezepte.turm).sort(), ['merkmale', 'mindest', 'titel']);
  // D3: die wählbaren Merkmale sind nur Namen (Eingang: Himmelsrichtungen, Fenster: Fensterformen), nie Regeln, Maße oder Blöcke
  assert.deepEqual(L.vokabular.rezepte.turm.merkmale, { eingang: ['nord', 'ost', 'sued', 'west'], fenster: ['schlitze'] });
  assert.equal(L.vokabular.schema, 1);
  const prompt = L.briefing();
  assert.match(prompt, /rezept/);
  assert.doesNotMatch(prompt, /schaft-unten|schaft-oben|\bglieder\b/);
  assert.match(prompt, /Höhe mindestens 1 × die größere Breite/); // Bedingung des Prüfers steht im Briefing
});

// Korrekturen nach dem Codex-Review (15.11.2026)
test('Höhenverteilung: ein Restglied mit kleinem Gewicht bekommt trotz Rundung mindestens eine Schicht, wenn der Platz reicht (9 : 1 bei zwei freien Schichten ergibt 1 : 1)', () => {
  const lade = mitRezept((p) => {
    p.mindest = { breite: 9, tiefe: 9, hoehe: 8 };
    p.glieder.find((g) => g.id === 'schaft-unten').hoehe = { rest: 9 };
    p.glieder.find((g) => g.id === 'schaft-oben').hoehe = { rest: 1 };
    p.glieder.find((g) => g.id === 'dach').hoehe = { zuBreite: 0.4, min: 3, maxAnteil: 0.3 }; // niedriges Dach wie früher, damit bei Höhe 8 genau zwei Schichten für den Rest bleiben
  });
  const r = lade().wendeRezeptAn('turm', { breite: 9, tiefe: 9, hoehe: 8 });
  const hoehen = Object.fromEntries(r.teile.map((t) => [t.glied, huelle(t).h]));
  assert.deepEqual([hoehen['schaft-unten'], hoehen['schaft-oben']], [1, 1], JSON.stringify(hoehen)); // keine Schicht geht verloren oder kommt dazu
  assert.equal(r.teile.reduce((s, g) => s + huelle(g).h, 0), 8);
});
test('Prüfer: eine unsinnige Breite (Objekt ohne toString) ergibt eine Rückfrage statt eines Absturzes', () => {
  const s = spec((t) => { t.form.groesse = { breite: { toString: null }, tiefe: 13, hoehe: 34 }; });
  let q;
  assert.doesNotThrow(() => { q = L.pruefe(s).rueckfragen.map((x) => x.pfad); });
  assert.ok(q.some((p) => p.endsWith('form.groesse.breite')), JSON.stringify(q));
});
test('Prüfer: ein Baustein ohne toString neben dem Rezept ergibt eine Rückfrage statt eines Absturzes', () => {
  const s = spec((t) => { t.form.baustein = { toString: null }; });
  let q;
  assert.doesNotThrow(() => { q = L.pruefe(s).rueckfragen.map((x) => x.pfad); });
  assert.ok(q.includes('teile[0].form.baustein'), JSON.stringify(q));
});

test('Auflage: das tragende Glied wird um die Auflage dicker (Mutationsprobe: ohne Auflage genau um diesen Betrag dünner)', () => {
  const wand = (auflage) => Object.fromEntries(mitRezept((p) => { p.auflage = auflage; })().wendeRezeptAn('turm', { breite: 45, tiefe: 45, hoehe: 80 }).teile.map((t) => [t.glied, t.parameter.wandstaerke]));
  const ohne = wand(0), mit = wand(1);
  assert.equal(mit.sockel, ohne.sockel + 1);
  assert.equal(mit.dach, ohne.dach + 1);
  assert.ok(Object.keys(ohne).every((g) => mit[g] >= ohne[g]));
});

test('Rezeptdaten (D3): kaputte Merkmale werfen RezeptFehler beim Laden (nie eine hängende oder falsche Planung)', () => {
  const kaputt = {
    'Fensterform ohne parameter': (p) => { delete p.merkmale.fenster.formen.schlitze.parameter; },
    'parameter ohne hoehe': (p) => { p.merkmale.fenster.formen.schlitze.parameter = { rahmen: 0 }; },
    'hoehe keine Zahl': (p) => { p.merkmale.fenster.formen.schlitze.parameter.hoehe = 'zwei'; },
    'hoehe außerhalb des Bereichs': (p) => { p.merkmale.fenster.formen.schlitze.parameter.hoehe = 9999; },
    'rahmen außerhalb': (p) => { p.merkmale.fenster.formen.schlitze.parameter.rahmen = 99; },
    'Fensterbreite 0': (p) => { p.merkmale.fenster.formen.schlitze.breite.ungerade = 0; },
    'Fensterbreite zu groß': (p) => { p.merkmale.fenster.formen.schlitze.breite.gerade = 999; },
    'Flügel über 2': (p) => { p.merkmale.eingang.fluegel.gerade = 3; },
    'Quelle keine Adresse': (p) => { p.merkmale.eingang.tuer.quelle = 'siehe Wiki'; },
    'Status der Tür fehlt': (p) => { delete p.merkmale.eingang.tuer.status; },
    'Status der Tür unbekannt': (p) => { p.merkmale.eingang.tuer.status = 'ok'; },
    'leerer Eintrag in nichtPerHand': (p) => { p.merkmale.eingang.tuer.nichtPerHand.push(''); },
    'Sockelhöhe unter 3': (p) => { p.merkmale.eingang.sockelMindesthoehe = 2; },
    'Glied kein Zylinder': (p) => { p.merkmale.fenster.formen.schlitze.glieder = ['dach']; },
    'unbekannte Seite': (p) => { p.merkmale.eingang.seiten = ['oben']; },
  };
  for (const [name, aendere] of Object.entries(kaputt)) assert.throws(mitRezept(aendere), (f) => f instanceof RezeptFehler, name);
  assert.doesNotThrow(mitRezept(() => {}));
});
