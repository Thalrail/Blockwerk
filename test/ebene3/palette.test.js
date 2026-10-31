// Befund #7 (Codex-Review 30.10.2026): Ohne Stimmung blieb die Palette leer, und die Planung baute still mit der TESTPALETTE (minecraft:stone) als „fertig“.
// Jetzt fragt der Bauleiter nach der Stimmung, und die Materialisierung ohne vollständige Palette ist ein Fehler (nie halber Bauplan, nie stilles Testmaterial).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { AblaufFehler, PaletteFehler } from '../../src/ebene3/index.js';
import { TESTPALETTE } from '../../src/ebene2/index.js';

const e3 = ebene3();
const AB = e3.ablauf;
const huelle = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } });
const ROLLEN = e3.ebene1.regelwerk.parameter('plan.palette', 'rollen');
const STIMMUNGEN = e3.designer.stimmungen();

/** Nur Formen (keine festen Technikblöcke): jeder Block muss aus der Palette kommen. */
const FORM = (stimmung) => ({
  name: 'Formen', ...(stimmung ? { stimmung } : {}),
  abschnitte: [{ id: 'turm', name: 'Turm', huelle: huelle(0, 0, 0, 30, 20, 30), zonen: [{ funktion: 'optik', anteil: 100 }],
    formen: [{ baustein: 'form.zylinder', parameter: { breite: 9, tiefe: 9, hoehe: 12, wandstaerke: 1 }, zone: 'optik', anker: 'mitte' }] }],
});
const blockIds = (welt) => new Set(welt.alleBloecke().map((b) => b.id));
/** Alle Block-IDs einer Palette (Rolle → id, {id} oder je Form). */
const paletteIds = (palette) => new Set(Object.values(palette).flatMap((w) => (typeof w === 'string' ? [w] : w?.id ? [w.id] : Object.values(w).map((x) => (typeof x === 'string' ? x : x.id)))));

test('Palette 1: keine Stimmung → Rückfrage statt fertigem Steinbauplan', () => {
  const r = AB.starte(FORM(null));
  assert.equal(r.status, 'wartet');
  assert.equal(r.entwurf.teile.length, 0, 'es wurde nichts gebaut');
  assert.equal(r.rueckfragen.length, 1);
  const f = r.rueckfragen[0];
  assert.equal(f.art, 'palette');
  assert.match(f.frage, /keine vollständige Palette/);
  assert.match(f.frage, /rate nicht/);
  // nur unterstützte Stimmungen, nichts „Etwas anderes“ und keine Vorauswahl
  assert.deepEqual(f.optionen.map((o) => o.id), [...STIMMUNGEN].sort().map((n) => `stimmung:${n}`));
  assert.ok(STIMMUNGEN.length >= 3);
  assert.deepEqual(r.entwurf.palette, {}, 'es wird keine Stimmung geraten');
  // gleiche Eingabe = gleiche Rückfrage
  assert.deepEqual(AB.starte(FORM(null)).rueckfragen, r.rueckfragen);
  // kein Weiterlaufen ohne Antwort
  assert.equal(AB.fortsetzen(r.entwurf).status, 'wartet');
  assert.equal(AB.fortsetzen(r.entwurf).rueckfragen.length, 1);
});

test('Palette 1b: nur eine gültige Stimmung beantwortet die Frage; danach läuft die Planung weiter', () => {
  const r = AB.starte(FORM(null));
  const id = r.rueckfragen[0].id;
  for (const falsch of ['stimmung:regenbogen', 'zulassen', 'aendern', 'glanz', undefined, 'stimmung:']) {
    assert.throws(() => AB.antworte(r.entwurf, id, { option: falsch }), AblaufFehler, String(falsch));
  }
  const e = AB.antworte(r.entwurf, id, { option: 'stimmung:glanz' });
  assert.ok(ROLLEN.every((x) => x in e.palette));
  assert.throws(() => AB.antworte(e, id, { option: 'stimmung:glanz' }), /schon beantwortet/);
  const weiter = AB.fortsetzen(e);
  assert.equal(weiter.status, 'fertig');
  assert.equal(weiter.entwurf.teile.length, 1);
  assert.equal(weiter.entwurf.einwaende.filter((w) => w.status === 'offen' || w.status === 'eskaliert').length, 0);
  // die Antwort steht im Baubericht
  assert.ok(weiter.entwurf.bericht.some((b) => /wählt die Stimmung „glanz“/.test(b.satz)));
  // Ergebnis ist dasselbe wie mit der Stimmung von Anfang an
  const direkt = AB.starte(FORM('glanz'));
  assert.deepEqual(blockIds(e3.materialisiere(weiter.entwurf).welt), blockIds(e3.materialisiere(direkt.entwurf).welt));
});

test('Palette 2: gültige Stimmung – der normale Ablauf bleibt funktionsfähig, jede Stimmung', () => {
  for (const s of STIMMUNGEN) {
    const r = AB.starte(FORM(s));
    assert.equal(r.status, 'fertig', s);
    assert.deepEqual(r.rueckfragen, [], s);
    assert.ok(ROLLEN.every((x) => x in r.entwurf.palette), s);
    assert.equal(e3.paletten.vollstaendig(r.entwurf.palette), true, s);
  }
});

test('Palette 3: unvollständige Palette → Materialisierung wird kontrolliert abgelehnt', () => {
  const fertig = AB.starte(FORM('glanz')).entwurf;
  for (const fehlt of ROLLEN) {
    const e = structuredClone(fertig);
    delete e.palette[fehlt];
    assert.throws(() => e3.materialisiere(e), (f) => {
      assert.ok(f instanceof PaletteFehler, String(f));
      assert.deepEqual(f.fehlend, [{ abschnitt: 'turm', rollen: [fehlt] }]);
      assert.match(f.message, new RegExp(`Abschnitt „turm“ ohne Block für die Rollen ${fehlt}`));
      assert.match(f.message, /nicht aus Testmaterial/);
      return true;
    }, fehlt);
  }
  // leere Palette und leere Einträge
  const leer = structuredClone(fertig);
  leer.palette = {};
  assert.throws(() => e3.materialisiere(leer), PaletteFehler);
  const nullWert = structuredClone(fertig);
  nullWert.palette.licht = '';
  assert.throws(() => e3.materialisiere(nullWert), /licht/);
  // eine Abschnittspalette füllt die Lücke der Gesamtpalette: dann ist es vollständig
  const gesamtLeer = structuredClone(fertig);
  const wand = gesamtLeer.palette;
  gesamtLeer.palette = {};
  gesamtLeer.paletten = { turm: wand };
  assert.doesNotThrow(() => e3.materialisiere(gesamtLeer));
  // nur Abschnitte mit Teilen zählen für die Materialisierung
  const ohneTeile = structuredClone(fertig);
  ohneTeile.teile = [];
  ohneTeile.palette = {};
  assert.doesNotThrow(() => e3.materialisiere(ohneTeile));
  // ausdrücklich gekennzeichnetes Testmaterial bleibt für Tests möglich und füllt die Lücke wie früher
  const teilweise = structuredClone(fertig);
  delete teilweise.palette.wand;
  assert.doesNotThrow(() => e3.materialisiere(teilweise, { testmaterial: true }));
  assert.throws(() => e3.materialisiere(teilweise, { testmaterial: false }), PaletteFehler);
  assert.throws(() => e3.materialisiere(teilweise, {}), PaletteFehler);
  assert.throws(() => e3.materialisiere(teilweise), PaletteFehler);
  assert.throws(() => e3.materialisiere(teilweise, { testmaterial: 'ja' }), PaletteFehler, 'nur ausdrücklich true zählt');
});

test('Palette 3b: eine Palette, die später unvollständig wird, stoppt Abschluss und Fortsetzen mit einer Rückfrage', () => {
  const fertig = AB.starte(FORM('glanz')).entwurf;
  const e = structuredClone(fertig);
  delete e.palette.glas;
  const a = AB.abschliessen(e);
  assert.equal(a.status, 'wartet');
  assert.equal(a.rueckfragen[0].art, 'palette');
  assert.match(a.rueckfragen[0].frage, /turm \(glas\)/);
  // neue Fassung der Vorgabe ohne Stimmung löscht die Gesamtpalette: wieder Rückfrage, kein stilles Steinbauwerk
  const neu = AB.aktualisiere(fertig, FORM(null));
  assert.equal(neu.status, 'wartet');
  assert.equal(neu.rueckfragen[0].art, 'palette');
  assert.equal(neu.entwurf.teile.length, fertig.teile.length, 'die Teile bleiben, es wird nichts mit Teststein ersetzt');
  const beantwortet = AB.fortsetzen(AB.antworte(neu.entwurf, neu.rueckfragen[0].id, { option: 'stimmung:dunkel-industriell' }));
  assert.equal(beantwortet.status, 'fertig');
});

test('Palette 4: vollständige Palette – kein Rückgriff auf die TESTPALETTE', () => {
  const testIds = paletteIds(TESTPALETTE);
  for (const s of STIMMUNGEN) {
    const r = AB.starte(FORM(s));
    const erlaubt = paletteIds({ ...r.entwurf.palette, ...(r.entwurf.paletten?.turm ?? {}) });
    const ids = blockIds(e3.materialisiere(r.entwurf).welt);
    assert.ok(ids.size > 0, s);
    for (const id of ids) assert.ok(erlaubt.has(id), `${s}: ${id} steht nicht in der Palette`);
    // und die Testpalette hätte etwas anderes gebaut (sonst beweist der Test nichts)
    const stein = [...testIds].filter((id) => !erlaubt.has(id));
    assert.ok(stein.length > 0, s);
    for (const id of stein) assert.ok(!ids.has(id), `${s}: Testmaterial ${id} im Bauplan`);
  }
  // Grundlage des Befunds: mit Testmaterial käme bei leerer Palette Stein heraus – der strenge Weg erlaubt das nicht mehr
  const leer = AB.starte(FORM(null)).entwurf;
  assert.throws(() => e3.materialisiere({ ...leer, teile: [{ ...AB.starte(FORM('glanz')).entwurf.teile[0] }] }), PaletteFehler);
});

test('Palette 5: bestehende Lorenbahn-Planung läuft unverändert (Stimmung gesetzt) und ohne Stimmung wird gefragt', () => {
  const lore = (stimmung) => ({
    name: 'Lorenbahn', ...(stimmung ? { stimmung } : {}),
    abschnitte: [{ id: 'viertel', name: 'Viertel', huelle: huelle(0, -40, 0, 79, -1, 40), zonen: [{ funktion: 'technik', anteil: 100 }],
      bedarf: [{ art: 'handelsnischen', anzahl: 6, bauart: 'lorenbahn' }, { art: 'weichensteuerung' }] }],
  });
  const r = AB.starte(lore('glanz'));
  assert.equal(r.status, 'fertig', JSON.stringify(r.rueckfragen.map((x) => x.frage)));
  assert.ok(r.entwurf.teile.some((t) => t.baustein === 'tech.handelsnischen-lore'));
  assert.deepEqual(r.offeneAnfragen.map((a) => a.art), ['weichensteuerung'], 'ausdrückliche Weichensteuerung bleibt, keine zweite automatisch');
  assert.doesNotThrow(() => e3.materialisiere(r.entwurf));
  const ohne = AB.starte(lore(null));
  assert.equal(ohne.status, 'wartet');
  assert.equal(ohne.rueckfragen[0].art, 'palette');
  assert.equal(ohne.entwurf.teile.length, 0);
  // nach der Antwort entsteht dasselbe Bauwerk wie mit der Stimmung von Anfang an
  const spaeter = AB.fortsetzen(AB.antworte(ohne.entwurf, ohne.rueckfragen[0].id, { option: 'stimmung:glanz' }));
  assert.equal(spaeter.status, 'fertig');
  assert.deepEqual([...blockIds(e3.materialisiere(spaeter.entwurf).welt)].sort(), [...blockIds(e3.materialisiere(r.entwurf).welt)].sort());
});
