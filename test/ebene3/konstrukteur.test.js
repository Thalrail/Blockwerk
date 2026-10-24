import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { neuerEntwurf, GliederungFehler, entwurfZuJson, berichtAlsText } from '../../src/ebene3/index.js';

const e3 = ebene3();
const K = e3.konstrukteur;
const e1 = e3.ebene1;
const huelle = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } });
const fehler = (fn) => { try { fn(); } catch (f) { assert.ok(f instanceof GliederungFehler, String(f)); return f.message; } return null; };
const reihe = (e) => [...e.abschnitte].sort((a, b) => a.reihenfolge - b.reihenfolge).map((a) => a.id);

const VORLAGE = [
  { id: 'turm', name: 'Turm', huelle: huelle(-5, 10, -5, 5, 40, 5), nach: ['halle'] },
  { id: 'kapelle', name: 'Kapelle', huelle: huelle(60, 0, 0, 80, 12, 20), nach: ['keller'] },
  { id: 'halle', name: 'Halle', huelle: huelle(-20, 0, -20, 20, 9, 20), nach: ['keller'] },
  { id: 'keller', name: 'Keller', huelle: huelle(-20, -9, -20, 20, -1, 20) },
];

/** Ein Abschnitt mit großer Hülle für Verbindungstests. */
function platz() {
  return K.gliedere(neuerEntwurf({ name: 'Probe' }), [{ id: 'A', name: 'Platz', huelle: huelle(-300, -20, -300, 300, 60, 300) }]);
}
const ohneEinwand = (e) => {
  const { einwaende } = e3.einwaende.sammle(e);
  assert.deepEqual(einwaende.map((x) => `${x.regel}: ${x.text}`), []);
};

test('Konstrukteur: Gliederung, Reihenfolge und Ansage', () => {
  const leer = neuerEntwurf({ name: 'Probe' });
  const e = K.gliedere(leer, VORLAGE);
  // Abhängigkeit zuerst; bei Gleichstand der Abschnitt näher am Nullpunkt (von innen nach außen)
  assert.deepEqual(reihe(e), ['keller', 'halle', 'turm', 'kapelle']);
  assert.deepEqual(e.abschnitte.map((a) => a.status), ['offen', 'offen', 'offen', 'offen']);
  assert.deepEqual(e.abschnitte.find((a) => a.id === 'turm').nach, ['halle']);
  // deterministisch, unabhängig von der Eingabereihenfolge; das Original bleibt unverändert
  const vorher = entwurfZuJson(leer);
  assert.equal(entwurfZuJson(K.gliedere(leer, [...VORLAGE].reverse())), entwurfZuJson(e));
  assert.equal(entwurfZuJson(leer), vorher);
  // Rechte: der Eintrag steht im Baubericht mit dem Konstrukteur
  assert.ok(e.bericht.every((b) => b.art === 'aenderung' && b.daten.von === 'konstrukteur'));
  assert.equal(e.bericht.length, 4);
  // verschobener Nullpunkt dreht die Gleichstände um (näher am Nullpunkt zuerst)
  const weit = K.gliedere(neuerEntwurf({ name: 'Probe', nullpunkt: { x: 70, y: 5, z: 10 } }), VORLAGE);
  assert.deepEqual(reihe(weit), ['keller', 'kapelle', 'halle', 'turm']);
  // Gleichstand bei gleichem Abstand: kleinere Id
  const gleich = K.gliedere(neuerEntwurf({ name: 'Probe' }), [
    { id: 'b', name: 'B', huelle: huelle(10, 0, 0, 12, 2, 2) }, { id: 'a', name: 'A', huelle: huelle(-12, 0, 0, -10, 2, 2) }]);
  assert.deepEqual(reihe(gleich), ['a', 'b']);

  // Fehler der Vorlage: nichts wird geraten
  const ok = (v) => () => K.gliedere(leer, v);
  assert.match(fehler(ok([])), /mindestens einen Abschnitt/);
  assert.match(fehler(ok([VORLAGE[0], VORLAGE[0]])), /doppelt/);
  assert.match(fehler(ok([{ id: 'a', name: 'A', huelle: huelle(0, 0, 0, 1, 1, 1), nach: ['x'] }])), /den es nicht gibt/);
  assert.match(fehler(ok([{ id: 'a', name: 'A', huelle: huelle(0, 0, 0, 1, 1, 1), nach: ['a'] }])), /nach sich selbst/);
  assert.match(fehler(ok([{ id: 'a', name: 'A', huelle: huelle(0, 0, 0, 1, 1, 1), nach: ['b'] }, { id: 'b', name: 'B', huelle: huelle(5, 0, 0, 6, 1, 1), nach: ['a'] }])), /Kreis/);
  assert.match(fehler(ok([{ id: 'a', name: 'A', huelle: huelle(0, 0, 0, 5, 5, 5) }, { id: 'b', name: 'B', huelle: huelle(5, 5, 5, 8, 8, 8) }])), /überschneiden sich/);
  assert.match(fehler(ok([{ id: 'a', name: 'A', huelle: huelle(3, 0, 0, 1, 1, 1) }])), /von ≤ bis/);
  assert.match(fehler(ok([{ id: 'a', name: 'A', huelle: huelle(0, 0, 0, 1, 1, 1), schnittstellen: [{ id: 's', mit: 'zz', an: { x: 0, y: 0, z: 0 }, gegen: { x: 1, y: 0, z: 0 } }] }])), /anderen Abschnitt/);
  assert.match(fehler(() => K.gliedere(e, VORLAGE)), /schon gegliedert/);

  // Ansage: nur der nächste mit fertigen Vorgängern, immer nur einer in Arbeit
  let r = K.naechster(e);
  assert.equal(r.abschnitt.id, 'keller');
  assert.equal(r.abschnitt.status, 'in-arbeit');
  assert.equal(r.entwurf.abschnitte.find((a) => a.id === 'halle').status, 'offen');
  assert.match(r.entwurf.bericht.at(-1).satz, /Der Konstrukteur sagt „Keller“ als Nummer 1 an/);
  const zweiter = K.naechster(r.entwurf);
  assert.deepEqual([zweiter.abschnitt, zweiter.grund], [null, 'in-arbeit']);
  assert.match(fehler(() => K.schliesse(e, 'keller')), /nicht in Arbeit/);
  assert.match(fehler(() => K.schliesse(e, 'gibtsnicht')), /gibt es nicht/);
  let x = K.schliesse(r.entwurf, 'keller');
  const gesehen = ['keller'];
  for (let i = 0; i < 3; i++) {
    r = K.naechster(x);
    gesehen.push(r.abschnitt.id);
    x = K.schliesse(r.entwurf, r.abschnitt.id);
  }
  assert.deepEqual(gesehen, ['keller', 'halle', 'turm', 'kapelle']);
  const fertig = K.naechster(x);
  assert.deepEqual([fertig.abschnitt, fertig.grund], [null, 'alles-fertig']);
  assert.match(berichtAlsText(x), /erklärt „Kapelle“ für fertig/);
  // ein Abschnitt, dessen Vorgänger noch nicht fertig ist, wird nicht angesagt (Halle in Arbeit, Turm wartet)
  const mitten = K.naechster(K.schliesse(K.naechster(e).entwurf, 'keller'));
  assert.equal(mitten.abschnitt.id, 'halle');
  assert.equal(K.naechster(mitten.entwurf).grund, 'in-arbeit');
  // auch bei von Hand umgestellter Reihenfolge wird kein Abschnitt vor seinen Vorgängern angesagt
  const kapelle = e.abschnitte.find((a) => a.id === 'kapelle');
  const umgestellt = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { ...kapelle, reihenfolge: 0 } }).entwurf;
  assert.equal(K.naechster(umgestellt).abschnitt.id, 'keller');
});

test('Konstrukteur: Verbindungen verlegen', () => {
  const start = { x: 11, y: 5, z: -7 };
  const wohin = (d, n, dy = 0) => ({ x: start.x + [0, 1, 0, -1][d] * n, y: start.y + dy, z: start.z + [-1, 0, 1, 0][d] * n });

  // Gänge: gerade, in allen vier Richtungen, verschiedene Längen; Spieler, Dorfbewohner und Baby gehen hindurch (Ebene 1)
  for (const laenge of [2, 3, 8, 9, 16, 33]) {
    for (let d = 0; d < 4; d++) {
      const r = K.verlege(platz(), { abschnitt: 'A', von: start, nach: wohin(d, laenge - 1), art: 'gang' });
      assert.equal(r.rueckfrage, null, `Gang ${laenge} Richtung ${d}`);
      assert.equal(r.teile.length, 1);
      assert.equal(r.entwurf.pruefungen[0].ziele.length, 3);
      // Menschenmaß bleibt fest: lichte Breite 3, Höhe 3 (nicht von der Länge abhängig)
      assert.deepEqual([r.entwurf.teile[0].parameter.breite, r.entwurf.teile[0].parameter.hoehe], [3, 3]);
      ohneEinwand(r.entwurf);
      // der Gang liegt wirklich zwischen Start und Ziel: Blockdichte an beiden Enden
      const welt = e3.materialisiere(r.entwurf).welt;
      assert.equal(e1.bewegung.weg(welt, start, wohin(d, laenge - 1), 'dorfbewohner').ok, true);
    }
  }

  // Schienenwege: ebenflächig, alle Richtungen, Längen um die Periode 8 herum
  const bahnEnde = (e, von, d) => e1.lore.bahn(e3.materialisiere(e).welt, von, ['north', 'east', 'south', 'west'][d]).schienen.at(-1).pos;
  for (const laenge of [2, 7, 8, 9, 15, 16, 17, 24, 33, 100]) {
    for (let d = 0; d < 4; d++) {
      const ziel = wohin(d, laenge - 1);
      const r = K.verlege(platz(), { abschnitt: 'A', von: start, nach: ziel, art: 'schiene' });
      assert.equal(r.rueckfrage, null);
      ohneEinwand(r.entwurf);
      assert.deepEqual(bahnEnde(r.entwurf, start, d), ziel, `Strecke ${laenge} Richtung ${d} endet am Ziel`);
    }
  }
  // Perioden: 17 Zellen = 2 volle Perioden + Rest von 1 Zelle (nur Antriebsschiene)
  const siebzehn = K.verlege(platz(), { abschnitt: 'A', von: start, nach: wohin(0, 16), art: 'schiene' });
  assert.deepEqual(siebzehn.entwurf.teile.map((t) => t.parameter), [{ abschnitte: 2, abstand: 7 }, { abschnitte: 1, abstand: 0 }]);

  // Rampen 1 … 5 Blöcke, hinauf und hinab (hinab wird als Bahn von unten nach oben geprüft)
  for (let hoehe = 1; hoehe <= 5; hoehe++) {
    for (const [d, laenge] of [[0, hoehe + 1], [1, hoehe + 9], [2, 20], [3, hoehe + 2]]) {
      const hinauf = K.verlege(platz(), { abschnitt: 'A', von: start, nach: wohin(d, laenge - 1, hoehe), art: 'schiene' });
      assert.equal(hinauf.rueckfrage, null, `Rampe ${hoehe} Richtung ${d}`);
      ohneEinwand(hinauf.entwurf);
      assert.deepEqual(bahnEnde(hinauf.entwurf, start, d), wohin(d, laenge - 1, hoehe));
      assert.equal(hinauf.entwurf.teile[0].baustein, 'tech.steigung');
      const hinab = K.verlege(platz(), { abschnitt: 'A', von: wohin(d, laenge - 1, hoehe), nach: start, art: 'schiene' });
      assert.equal(hinab.rueckfrage, null);
      ohneEinwand(hinab.entwurf);
      assert.equal(hinab.entwurf.pruefungen[0].start.y, start.y, 'geprüft wird vom unteren Ende');
    }
  }

  // Kurven: erst die z-, dann die x-Achse; Rechts- und Linkskurve, gleiche und ungleiche Schenkel
  for (const [dz, dx] of [[-6, 6], [-6, -6], [5, 9], [5, -9], [-12, 3], [3, 12], [-20, 18]]) {
    const ziel = { x: start.x + dx, y: start.y, z: start.z + dz };
    const r = K.verlege(platz(), { abschnitt: 'A', von: start, nach: ziel, art: 'schiene' });
    assert.equal(r.rueckfrage, null, `Kurve ${dz}/${dx}`);
    assert.ok(r.entwurf.teile.some((t) => t.baustein === 'tech.kurve'));
    ohneEinwand(r.entwurf);
    assert.deepEqual(bahnEnde(r.entwurf, start, dz < 0 ? 0 : 2), ziel, `Kurve ${dz}/${dx} endet am Ziel`);
  }

  // Alle Teile sind Verbindungen des Konstrukteurs mit gemeinsamer Wegnummer
  const lang = K.verlege(platz(), { abschnitt: 'A', von: start, nach: wohin(1, 40), art: 'schiene' });
  assert.ok(lang.entwurf.teile.every((t) => t.art === 'verbindung' && t.gesetztVon === 'konstrukteur' && t.weg === 'V1'));
  const zwei = K.verlege(lang.entwurf, { abschnitt: 'A', von: wohin(1, 60), nach: wohin(1, 70), art: 'gang' });
  assert.equal(zwei.entwurf.teile.at(-1).weg, 'V2');
  assert.equal(zwei.entwurf.pruefungen.length, 2);

  // Unmögliches wird nicht geraten: nichts verlegt, der Bauleiter fragt Jonah
  const schlecht = [
    ['gang', wohin(0, 5, 1), /nur waagerecht/], ['gang', { x: start.x + 3, y: start.y, z: start.z + 3 }, /nur gerade/],
    ['schiene', wohin(0, 5, 6), /größer als die geprüfte Steigung/], ['schiene', wohin(0, 2, 5), /braucht mindestens 6 Zellen/],
    ['schiene', { x: start.x + 4, y: start.y + 2, z: start.z + 4 }, /Kurve mit gleichzeitigem Höhenunterschied/], ['schiene', start, /derselbe Ort/],
    ['gang', wohin(0, 512), /nicht baubar/], ['treppe', wohin(0, 3), /Unbekannte Art/],
  ];
  for (const [art, nach, muster] of schlecht) {
    const r = K.verlege(platz(), { abschnitt: 'A', von: start, nach, art });
    assert.deepEqual(r.teile, [], art);
    assert.equal(r.entwurf.teile.length, 0);
    assert.equal(r.entwurf.pruefungen.length, 0);
    assert.match(r.rueckfrage.frage, muster);
    assert.ok(r.rueckfrage.optionen.length >= 3);
    assert.equal(r.entwurf.einwaende.at(-1).status, 'eskaliert');
  }
  assert.match(fehler(() => K.verlege(platz(), { abschnitt: 'Z', von: start, nach: wohin(0, 3), art: 'gang' })), /gibt es nicht/);

  // deterministisch
  const a = K.verlege(platz(), { abschnitt: 'A', von: start, nach: wohin(1, 40), art: 'schiene' });
  assert.equal(entwurfZuJson(a.entwurf), entwurfZuJson(lang.entwurf));
});

test('Konstrukteur: Nähte prüfen', () => {
  const vorlage = (naht) => [
    { id: 'west', name: 'Westhalle', huelle: huelle(-30, -2, -5, -1, 9, 5), schnittstellen: [naht] },
    { id: 'ost', name: 'Osthalle', huelle: huelle(0, -2, -5, 30, 9, 5), nach: ['west'] },
  ];
  const gut = { id: 'tor', mit: 'ost', an: { x: -1, y: 0, z: 0 }, gegen: { x: 0, y: 0, z: 0 }, art: 'gang' };
  const fertigMachen = (e) => {
    let x = e;
    for (let i = 0; i < 2; i++) { const r = K.naechster(x); x = K.schliesse(r.entwurf, r.abschnitt.id); }
    return x;
  };

  // Noch nicht fertig: keine Naht, kein Einwand
  const roh = K.gliedere(neuerEntwurf({ name: 'Probe' }), vorlage(gut));
  assert.deepEqual(K.naehte(roh), []);
  const halb = K.schliesse(K.naechster(roh).entwurf, 'west');
  assert.deepEqual(K.naehte(halb), [], 'Ost ist noch nicht fertig');

  // Beide fertig, Naht in Ordnung: keine Befunde, Prüfauftrag über die Naht (Gang)
  let e = fertigMachen(roh);
  assert.deepEqual(K.naehte(e).map((n) => [n.abschnitt, n.mit, n.befunde.length]), [['west', 'ost', 0]]);
  e = K.pruefeNaehte(e);
  assert.equal(e.pruefungen.length, 1);
  assert.deepEqual([e.pruefungen[0].art, e.pruefungen[0].start, e.pruefungen[0].ziele.map((z) => z.art)], ['begehbar', gut.an, ['spieler', 'dorfbewohner', 'baby']]);
  // ohne Verbindung ist die Naht nicht begehbar: Verstoß an den Konstrukteur, mit Koordinate
  const luecke = e3.einwaende.sammle(e).einwaende;
  assert.ok(luecke.length >= 1 && luecke.every((x) => x.regel === 'pruefer.begehbar' && x.an === 'konstrukteur'));
  assert.deepEqual(luecke[0].ort, gut.gegen);
  // mit einem Gang über die Naht ist alles in Ordnung (der Konstrukteur verlegt ihn selbst)
  const verbunden = K.verlege(K.pruefeNaehte(fertigMachen(roh)), { abschnitt: 'west', von: gut.an, nach: gut.gegen, art: 'gang' }).entwurf;
  ohneEinwand(verbunden);

  // Schiene über die Naht: Prüfauftrag „lore“ in Richtung der Naht
  const schiene = K.pruefeNaehte(fertigMachen(K.gliedere(neuerEntwurf({ name: 'Probe' }), vorlage({ ...gut, art: 'schiene' }))));
  assert.deepEqual([schiene.pruefungen[0].art, schiene.pruefungen[0].richtung], ['lore', 'east']);

  // Fehlerhafte Nähte werden zu Einwänden an den Konstrukteur, mit Koordinate und Wortlaut
  const kaputt = (naht) => fertigMachen(K.gliedere(neuerEntwurf({ name: 'Probe' }), vorlage(naht)));
  const innen = e3.einwaende.sammle(kaputt({ ...gut, an: { x: -10, y: 0, z: 0 } })).einwaende.filter((x) => x.regel === 'plan.naht');
  assert.deepEqual(innen.map((x) => [x.an, x.von, x.ziel, x.ort]), [['konstrukteur', 'bauleiter', 'abschnitt:west', { x: -10, y: 0, z: 0 }], ['konstrukteur', 'bauleiter', 'abschnitt:west', { x: -10, y: 0, z: 0 }]]);
  assert.match(innen[0].text, /liegt nicht am Rand der Hülle von west/);
  assert.match(innen[1].text, /nicht Seite an Seite/);
  const fremd = e3.einwaende.sammle(kaputt({ ...gut, gegen: { x: 5, y: 0, z: 0 } })).einwaende.filter((x) => x.regel === 'plan.naht');
  assert.deepEqual(fremd.map((x) => x.text.match(/lieg(?:t|en) nicht[^]*$/)[0]).sort(), ['liegen nicht Seite an Seite', 'liegt nicht am Rand der Hülle von ost']);
  assert.deepEqual(K.pruefeNaehte(kaputt({ ...gut, an: { x: -10, y: 0, z: 0 } })).pruefungen, [], 'bei einem Fehler keine Prüfung über die Naht');

  // Der Konstrukteur löst den Einwand, indem er die Schnittstelle richtigstellt (sein eigener Abschnitt)
  const r = e3.laufe(kaputt({ ...gut, an: { x: -10, y: 0, z: 0 } }), {
    konstrukteur: (ew, entwurf) => {
      const a = entwurf.abschnitte.find((x) => x.id === 'west');
      return { art: 'setze-abschnitt', abschnitt: { ...a, schnittstellen: [gut] } };
    },
  });
  assert.deepEqual([r.erledigt.length, r.eskaliert.length], [2, 0]);
  assert.equal(r.entwurf.abschnitte.find((x) => x.id === 'west').schnittstellen[0].an.x, -1);
  assert.match(berichtAlsText(r.entwurf), /Naht tor zwischen west und ost/);
});
