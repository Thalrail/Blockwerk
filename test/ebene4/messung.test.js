import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene4 } from '../hilfe.js';
import { BildFehler, FreigabeFehler } from '../../src/ebene4/index.js';

const L = ebene4();
const M = L.messung;
const fehler = (klasse, fn) => { try { fn(); } catch (f) { assert.ok(f instanceof klasse, String(f)); return f; } return null; };

// ---- synthetische Bilder -------------------------------------------------------------
const WEISS = [255, 255, 255], SCHWARZ = [0, 0, 0];
/** Bild aus einer Funktion (x, y) → Farbe oder null (= Hintergrund). */
function bild(B, H, f, hg = WEISS, rauschen = 0) {
  const d = new Uint8ClampedArray(B * H * 4);
  let z = 12345;
  const zufall = () => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return (z / 0x7fffffff) * 2 - 1; };
  for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) {
    const c = f(x, y) ?? hg, i = (y * B + x) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = c[k] + (rauschen ? Math.round(zufall() * rauschen) : 0);
    d[i + 3] = 255;
  }
  return { breite: B, hoehe: H, daten: d };
}
const FARBE = [200, 50, 50];
const scheibe = (cx, cy, rx, ry = rx, c = FARBE) => (x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? c : null);
const ring = (cx, cy, r, dicke, c = FARBE) => (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= r && d > r - dicke ? c : null; };
const rechteck = (x0, y0, x1, y1, c = FARBE) => (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 ? c : null);
const rahmen = (x0, y0, x1, y1, t, c = FARBE) => (x, y) => (x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x < x0 + t || x > x1 - t || y < y0 + t || y > y1 - t) ? c : null);
const zusammen = (...fs) => (x, y) => { for (const f of fs) { const c = f(x, y); if (c) return c; } return null; };
const gedreht = (b) => { const d = new Uint8ClampedArray(b.daten.length); for (let y = 0; y < b.hoehe; y++) for (let x = 0; x < b.breite; x++) for (let k = 0; k < 4; k++) d[(x * b.hoehe + y) * 4 + k] = b.daten[(y * b.breite + x) * 4 + k]; return { breite: b.hoehe, hoehe: b.breite, daten: d }; };

test('Bildmessung: Bilder, Farben und Linien', () => {
  // Kreise und Ellipsen in vielen Größen, gerade und ungerade Durchmesser
  for (const r of [4, 5, 6, 7, 8, 9, 10, 13, 17, 25, 40, 60]) {
    for (const mitte of [0, 0.5]) {
      const B = 2 * r + 12 + mitte * 2, c = (B - 1) / 2;
      const g = M.grundriss(bild(B, B, scheibe(c, c, r + 0.3 - mitte * 0.2)));
      assert.equal(g.form, 'rund', `r=${r} mitte=${mitte}`);
      assert.ok(Math.abs(g.breite - g.tiefe) <= 1 && Math.abs(g.breite - 2 * r) <= 2, `Breite ${g.breite} bei r=${r}`);
      assert.ok(Math.abs(g.seitenverhaeltnis - 1) < 0.15);
      assert.equal(g.kreise, 1);
      assert.deepEqual(g.linien, []);
    }
  }
  const ellipse = M.grundriss(bild(120, 70, scheibe(59.5, 34.5, 50, 25)));
  assert.equal(ellipse.form, 'rund');
  assert.ok(Math.abs(ellipse.seitenverhaeltnis - 2) < 0.1, `Seitenverhältnis ${ellipse.seitenverhaeltnis}`);
  // Rechtecke: genau gemessen, eckig, ohne Kreise
  for (const [w, h] of [[10, 10], [50, 30], [31, 90], [200, 12]]) {
    const g = M.grundriss(bild(w + 20, h + 20, rechteck(10, 10, 9 + w, 9 + h)));
    assert.deepEqual([g.form, g.breite, g.tiefe, g.kreise], ['eckig', w, h, 0], `${w}×${h}`);
    assert.equal(g.seitenverhaeltnis, Math.round((w / h) * 10000) / 10000);
    assert.deepEqual(g.linien, [], 'eine gefüllte Fläche ist keine Linie');
  }
  // Ring und Quadrat mit Loch: nur der äußere Umriss zählt
  assert.equal(M.grundriss(bild(90, 90, ring(44.5, 44.5, 40, 4))).form, 'rund');
  const loch = M.grundriss(bild(80, 80, (x, y) => (rechteck(10, 10, 69, 69)(x, y) && !rechteck(30, 30, 49, 49)(x, y) ? FARBE : null)));
  assert.deepEqual([loch.form, loch.breite, loch.tiefe], ['eckig', 60, 60]);
  assert.notEqual(M.grundriss(bild(80, 80, zusammen(rechteck(10, 32, 69, 47), rechteck(32, 10, 47, 69)))).form, 'rund', 'ein Kreuz ist nicht rund');
  // Hintergrund egal: schwarz, farbig, mit Rauschen unter der Schwelle
  for (const [hg, farbe] of [[SCHWARZ, [250, 250, 250]], [[30, 120, 200], [250, 220, 60]], [[240, 240, 235], [20, 20, 20]]]) {
    const g = M.grundriss(bild(100, 100, scheibe(49.5, 49.5, 30, 30, farbe), hg, 14));
    assert.deepEqual([g.form, g.kreise], ['rund', 1], `Hintergrund ${hg}`);
    assert.ok(Math.abs(g.breite - 60) <= 2);
  }
  // Mehrere Komponenten: vier Kreise und ein Rechteck
  const viele = M.grundriss(bild(200, 200, zusammen(scheibe(30, 30, 20), scheibe(170, 30, 20), scheibe(30, 170, 20), scheibe(170, 170, 20), rechteck(70, 70, 129, 129))));
  assert.equal(viele.kreise, 4);
  assert.deepEqual(viele.komponenten.map((k) => k.form).sort(), ['eckig', 'rund', 'rund', 'rund', 'rund']);
  assert.ok(viele.komponenten.every((k) => k.flaeche > 0));
  // winzige Flecken zählen nicht als Komponente
  const fleck = M.grundriss(bild(200, 200, zusammen(scheibe(60, 100, 40), rechteck(190, 190, 191, 191))));
  assert.equal(fleck.komponenten.length, 1);
  // Symmetrie: das um 90° gedrehte Bild hat vertauschte Maße und das Kehrverhältnis
  const quer = bild(150, 80, rechteck(10, 10, 139, 59));
  const a = M.grundriss(quer), b = M.grundriss(gedreht(quer));
  assert.deepEqual([b.breite, b.tiefe], [a.tiefe, a.breite]);
  assert.ok(Math.abs(a.seitenverhaeltnis * b.seitenverhaeltnis - 1) < 0.001);
  assert.deepEqual(M.umriss(gedreht(quer)), { breite: 50, hoehe: 130, verhaeltnis: 2.6 });

  // Aufriss: Höhe zu Breite
  assert.deepEqual(M.umriss(bild(60, 100, rechteck(10, 10, 29, 89))), { breite: 20, hoehe: 80, verhaeltnis: 4 });
  assert.equal(M.umriss(bild(300, 300, scheibe(149.5, 149.5, 100))).verhaeltnis, 1);

  // Unbrauchbare Bilder
  assert.match(fehler(BildFehler, () => M.grundriss(bild(40, 40, () => null))).message, /kein Vordergrund/);
  assert.match(fehler(BildFehler, () => M.farben({ breite: 4, hoehe: 4, daten: [1, 2, 3] })).message, /braucht 64 Werte/);
  assert.match(fehler(BildFehler, () => M.umriss({ breite: 0, hoehe: 4, daten: [] })).message, /ganze Zahlen ab 1/);
  // durchsichtige Pixel sind Hintergrund
  const durchsichtig = bild(40, 40, rechteck(10, 10, 29, 29));
  for (let p = 0; p < 1600; p++) { const x = p % 40, y = (p - x) / 40; if (!(x >= 10 && x <= 29 && y >= 10 && y <= 29)) durchsichtig.daten[p * 4 + 3] = 0; }
  assert.equal(M.umriss(durchsichtig).breite, 20);

  // Farben: jede Farbklasse (auch dunkler und heller)
  const KLASSEN = [['rot', [200, 30, 30], WEISS], ['orange', [255, 140, 0], WEISS], ['gelb', [255, 215, 0], WEISS], ['grün', [30, 160, 60], WEISS], ['türkis', [0, 180, 180], WEISS], ['blau', [30, 60, 200], WEISS],
    ['lila', [130, 40, 170], WEISS], ['rosa', [255, 130, 200], WEISS], ['braun', [120, 70, 30], WEISS], ['weiß', [250, 250, 250], SCHWARZ], ['grau', [128, 128, 128], WEISS], ['schwarz', [10, 10, 10], WEISS]];
  for (const [name, rgb, hg] of KLASSEN) {
    const f = M.farben(bild(50, 50, rechteck(5, 5, 44, 44, rgb), hg, 6));
    assert.deepEqual(f.map((x) => x.farbe), [name], name);
    assert.equal(f[0].anteil, 1);
  }
  for (const [name, rgb, hg] of KLASSEN.filter(([n]) => ['rot', 'blau', 'grün', 'lila'].includes(n))) {
    const dunkel = rgb.map((c) => Math.round(c * 0.7));
    assert.equal(M.farben(bild(50, 50, rechteck(5, 5, 44, 44, dunkel), hg))[0].farbe, name, `${name} im Schatten`);
  }
  assert.notEqual(M.farben(bild(50, 50, rechteck(5, 5, 44, 44, [255, 140, 0])))[0].farbe, 'braun', 'Orange ist nicht Braun');
  // Mischbild mit bekannten Anteilen, Reihenfolge nach Anteil
  const mischFarbe = (x) => (x < 60 ? [30, 60, 200] : x < 90 ? [250, 250, 250] : [200, 30, 30]);
  const misch = bild(120, 120, (x, y) => (x >= 10 && x < 110 && y >= 10 && y < 110 ? mischFarbe(x - 10) : null), SCHWARZ);
  const f = M.farben(misch);
  assert.deepEqual(f.map((x) => x.farbe), ['blau', 'weiß', 'rot']);
  assert.deepEqual(f.map((x) => x.anteil), [0.6, 0.3, 0.1]);
  assert.deepEqual(f[0].rgb, [30, 60, 200]);
  // ohne freien Rand gälte die häufigste Randfarbe als Hintergrund; „mitHintergrund“ zählt dann das ganze Bild
  const randlos = bild(100, 100, (x) => mischFarbe(x), SCHWARZ);
  assert.deepEqual(M.farben(randlos).map((x) => x.farbe), ['weiß', 'rot']);
  assert.deepEqual(M.farben(randlos, { mitHintergrund: true }).map((x) => [x.farbe, x.anteil]), [['blau', 0.6], ['weiß', 0.3], ['rot', 0.1]]);
  // Klassen unter dem Mindestanteil (1 %) fallen weg
  const klein = M.farben(bild(120, 120, (x, y) => (x >= 10 && x < 110 && y >= 10 && y < 110 ? (x - 10 < 99 ? [30, 60, 200] : y - 10 < 40 ? [200, 30, 30] : [30, 160, 60]) : null), SCHWARZ));
  assert.deepEqual(klein.map((x) => x.farbe), ['blau']);
  assert.deepEqual(M.farben(misch), f, 'deterministisch');

  // Linien: ein Rahmen hat zwei waagerechte und zwei senkrechte Linien an den Rändern
  const r = M.grundriss(bild(100, 70, rahmen(10, 10, 89, 59, 2))).linien;
  assert.deepEqual(r.map((l) => [l.ausrichtung, l.dicke, l.laenge]), [['waagerecht', 2, 80], ['waagerecht', 2, 80], ['senkrecht', 2, 50], ['senkrecht', 2, 50]]);
  assert.ok(r[0].lage < 0.05 && r[1].lage > 0.95 && r[2].lage < 0.05 && r[3].lage > 0.95);
  // eine Mauer ist eine dünne Linie, ein Kreuz aus dünnen Linien hat eine waagerechte und eine senkrechte
  assert.deepEqual(M.grundriss(bild(120, 40, rechteck(10, 18, 109, 19))).linien.map((l) => [l.ausrichtung, l.laenge]), [['waagerecht', 100]]);
  assert.deepEqual(M.grundriss(bild(100, 100, zusammen(rechteck(10, 49, 89, 49), rechteck(49, 10, 49, 89)))).linien.map((l) => l.ausrichtung), ['waagerecht', 'senkrecht']);
  assert.deepEqual(M.grundriss(bild(100, 100, ring(49.5, 49.5, 40, 3))).linien, [], 'ein Ring hat keine geraden Linien');
});

// ---- Abgleich -----------------------------------------------------------------------
const spec = () => {
  const s = structuredClone(L.beispiel());
  delete s.offeneFragen;
  s.teile[0].stil.farben = ['weiß', 'gold'];
  return s;
};
const grundrissVon = (b) => M.grundriss(b);
const RUND = () => grundrissVon(bild(60, 60, scheibe(29.5, 29.5, 25)));
const ECKIG = () => grundrissVon(bild(60, 60, rechteck(5, 5, 54, 54)));
const eine = (messungen, pfad, muster, s = spec()) => {
  const r = L.abgleich(s, messungen);
  assert.equal(r.rueckfragen.length, 1, r.rueckfragen.map((q) => q.frage).join(' | '));
  assert.equal(r.rueckfragen[0].pfad, pfad);
  assert.match(r.rueckfragen[0].frage, muster);
  assert.equal(r.rueckfragen[0].regel, 'leser.messung');
  assert.equal(r.rueckfragen[0].optionen.at(-1).id, 'anders');
  return r.rueckfragen[0];
};
const keine = (messungen, s = spec()) => assert.deepEqual(L.abgleich(s, messungen).rueckfragen, []);

test('Bildmessung: Abgleich mit der Spezifikation', () => {
  // Form: Text rund, Bild eckig (und umgekehrt)
  keine([{ teil: 'nordturm', art: 'grundriss', bild: 'grundriss.png', ergebnis: RUND() }]);
  const q = eine([{ teil: 'nordturm', art: 'grundriss', bild: 'grundriss.png', ergebnis: ECKIG() }], 'teile[0].form.baustein', /Bild „grundriss\.png“: der Grundriss von Nordturm ist eckig, die Spezifikation nennt aber form\.zylinder \(rund\)/);
  assert.ok(q.optionen.some((o) => o.wert === 'form.satteldach') && q.optionen.some((o) => o.id === 'text'));
  assert.ok(q.optionen.filter((o) => 'wert' in o).every((o) => L.vokabular.baustein(o.wert)));
  const umgekehrt = spec();
  umgekehrt.teile[0].form = { baustein: 'form.satteldach', groesse: { breite: 9, tiefe: 9 } };
  const q2 = eine([{ teil: 'nordturm', art: 'grundriss', ergebnis: RUND() }], 'teile[0].form.baustein', /Das Bild: der Grundriss von Nordturm ist rund, die Spezifikation nennt aber form\.satteldach \(eckig\)/, umgekehrt);
  assert.ok(q2.optionen.some((o) => o.wert === 'form.zylinder'));
  // neutrale Bausteine werden nicht beurteilt, unbestimmte Messung auch nicht
  const neutral = spec();
  neutral.teile[0].form = { baustein: 'form.bogen', groesse: { spannweite: 9 } };
  keine([{ teil: 'nordturm', art: 'grundriss', ergebnis: ECKIG() }, { teil: 'nordturm', art: 'grundriss', ergebnis: RUND() }], neutral);
  keine([{ teil: 'nordturm', art: 'grundriss', ergebnis: { ...ECKIG(), form: 'unbestimmt' } }]);

  // Seitenverhältnis Breite : Tiefe, mit Toleranz 15 %
  const verh = (v) => ({ ...RUND(), seitenverhaeltnis: v });
  keine([{ teil: 'nordturm', art: 'grundriss', ergebnis: verh(1) }, { teil: 'nordturm', art: 'grundriss', ergebnis: verh(1.14) }, { teil: 'nordturm', art: 'grundriss', ergebnis: verh(0.87) }]);
  const breit = eine([{ teil: 'nordturm', art: 'grundriss', bild: 'oben.png', ergebnis: verh(1.16) }], 'teile[0].form.groesse', /Bild „oben\.png“: Nordturm ist im Grundriss 1,16 mal so breit wie tief, die Spezifikation hat 9 × 9 \(1\)/);
  assert.deepEqual(breit.optionen[0].wert, { breite: 9, tiefe: 8 });
  const zwei = spec();
  zwei.teile[0].form.groesse = { breite: 10, tiefe: 10, hoehe: 24 };
  assert.deepEqual(eine([{ teil: 'nordturm', art: 'grundriss', ergebnis: verh(2) }], 'teile[0].form.groesse', /2 mal so breit/, zwei).optionen[0].wert, { breite: 10, tiefe: 5 });
  const ohneTiefe = spec();
  ohneTiefe.teile[0].form.groesse = { breite: 9 };
  keine([{ teil: 'nordturm', art: 'grundriss', ergebnis: verh(3) }], ohneTiefe);

  // Proportion Höhe : Breite aus dem Aufriss
  const auf = (v) => ({ breite: 20, hoehe: Math.round(20 * v), verhaeltnis: v });
  keine([{ teil: 'nordturm', art: 'aufriss', ergebnis: auf(2.67) }, { teil: 'nordturm', art: 'aufriss', ergebnis: auf(2.4) }, { teil: 'nordturm', art: 'aufriss', ergebnis: auf(3.06) }]);
  const hoch = eine([{ teil: 'nordturm', art: 'aufriss', bild: 'seite.png', ergebnis: auf(3.5) }], 'teile[0].form.proportionen.hoehe_zu_breite', /Bild „seite\.png“: Nordturm ist im Aufriss 3,5 mal so hoch wie breit, die Spezifikation hat 2,67/);
  assert.equal(hoch.optionen[0].wert, 3.5);
  eine([{ teil: 'nordturm', art: 'aufriss', ergebnis: auf(1.2) }], 'teile[0].form.proportionen.hoehe_zu_breite', /1,2 mal so hoch/);
  const nurMasse = spec();
  delete nurMasse.teile[0].form.proportionen;
  eine([{ teil: 'nordturm', art: 'aufriss', ergebnis: auf(5) }], 'teile[0].form.proportionen.hoehe_zu_breite', /die Spezifikation hat 2,67/, nurMasse);
  const ohneAngabe = spec();
  delete ohneAngabe.teile[0].form.proportionen;
  ohneAngabe.teile[0].form.groesse = {};
  keine([{ teil: 'nordturm', art: 'aufriss', ergebnis: auf(5) }], ohneAngabe);

  // Farben: genannte Farben müssen im Bild vorkommen (Synonyme: gold = gelb oder orange)
  const pal = (...p) => p.map(([farbe, anteil]) => ({ farbe, anteil, rgb: [0, 0, 0] }));
  keine([{ teil: 'nordturm', art: 'farben', ergebnis: pal(['weiß', 0.7], ['gelb', 0.3]) }, { teil: 'nordturm', art: 'farben', ergebnis: pal(['weiß', 0.9], ['orange', 0.1]) }]);
  const fehlt = L.abgleich(spec(), [{ teil: 'nordturm', art: 'farben', bild: 'farbe.png', ergebnis: pal(['grau', 0.9], ['blau', 0.1]) }]);
  assert.deepEqual(fehlt.rueckfragen.map((x) => x.pfad), ['teile[0].stil.farben[0]', 'teile[0].stil.farben[1]']);
  assert.match(fehlt.rueckfragen[0].frage, /Bild „farbe\.png“: für Nordturm nennt die Spezifikation „weiß“, im Bild kommt weiß aber nicht vor \(gemessen: grau 90 %, blau 10 %\)/);
  assert.match(fehlt.rueckfragen[1].frage, /„gold“, im Bild kommt gelb oder orange aber nicht vor/);
  assert.deepEqual(fehlt.rueckfragen[0].optionen.filter((o) => 'wert' in o).map((o) => o.wert), ['grau', 'blau']);
  assert.deepEqual(fehlt.rueckfragen.map((x) => x.id), ['M1', 'M2']);
  // knapp unter 3 %: fehlt; ab 3 %: vorhanden
  assert.equal(L.abgleich(spec(), [{ teil: 'nordturm', art: 'farben', ergebnis: pal(['weiß', 0.97], ['gelb', 0.029]) }]).rueckfragen.length, 1);
  assert.equal(L.abgleich(spec(), [{ teil: 'nordturm', art: 'farben', ergebnis: pal(['weiß', 0.97], ['gelb', 0.03]) }]).rueckfragen.length, 0);
  // Hinweise: unbekanntes Farbwort, dominante Farbe fehlt in der Spezifikation
  const neon = spec();
  neon.teile[0].stil.farben = ['neon', 'weiß'];
  const h = L.abgleich(neon, [{ teil: 'nordturm', art: 'farben', ergebnis: pal(['weiß', 0.6], ['blau', 0.4]) }]);
  assert.deepEqual(h.rueckfragen, []);
  assert.deepEqual(h.hinweise.map((x) => x.pfad), ['teile[0].stil.farben[0]', 'teile[0].stil.farben']);
  assert.match(h.hinweise[1].text, /im Bild ist blau die Farbe mit 40 %, in der Spezifikation fehlt sie/);
  assert.deepEqual(L.abgleich(spec(), [{ teil: 'nordturm', art: 'farben', ergebnis: pal(['weiß', 0.8], ['gelb', 0.2]) }]).hinweise, []);

  // Messungen, die nirgends hinpassen
  assert.match(eine([{ teil: 'unbekannt', art: 'farben', bild: 'x.png', ergebnis: [] }], 'messungen[0].teil', /Bild „x\.png“ soll zum Teil „unbekannt“ gehören/).optionen[0].wert, /nordturm|haupthalle/);
  eine([{ teil: 'nordturm', art: 'schnitt', ergebnis: {} }], 'messungen[0].art', /Messart „schnitt“/);
  assert.deepEqual(L.abgleich(spec(), []), { rueckfragen: [], hinweise: [] });

  // von Anfang bis Ende: Bild messen, Spezifikation prüfen
  const s = spec();
  s.teile[0].form = { baustein: 'form.satteldach', groesse: { breite: 20, tiefe: 20 } };
  const komplett = L.abgleich(s, [{ teil: 'nordturm', art: 'grundriss', bild: 'kreis.png', ergebnis: M.grundriss(bild(80, 80, scheibe(39.5, 39.5, 30))) }]);
  assert.match(komplett.rueckfragen[0].frage, /ist rund, die Spezifikation nennt aber form\.satteldach \(eckig\)/);
});

test('Bildmessung: Anbindung an Freigabe und Briefing', () => {
  const s = spec();
  // Freigabe: nur ohne Rückfragen aus Prüfer und Abgleich
  assert.equal(L.freigeben(s).freigabe.version, 1, 'ohne Messungen wie bisher');
  assert.equal(L.freigeben(s, 'jonah', [{ teil: 'nordturm', art: 'grundriss', ergebnis: RUND() }]).freigabe.von, 'jonah');
  const f = fehler(FreigabeFehler, () => L.freigeben(s, 'jonah', [{ teil: 'nordturm', art: 'grundriss', bild: 'g.png', ergebnis: ECKIG() }]));
  assert.match(f.message, /1 Rückfrage sind noch offen/);
  assert.equal(f.rueckfragen[0].id, 'M1');
  const beide = structuredClone(s);
  beide.teile[0].art = 'tum';
  assert.deepEqual(fehler(FreigabeFehler, () => L.freigeben(beide, 'jonah', [{ teil: 'nordturm', art: 'grundriss', ergebnis: ECKIG() }])).rueckfragen.map((q) => q.id), ['Q1', 'M1']);

  // Briefing mit Messwerten: sie stehen im Prompt, ohne Messwerte bleibt alles beim Alten
  const messungen = [
    { bild: 'oben.png', teil: 'Zentralturm', art: 'grundriss', ergebnis: { ...RUND(), seitenverhaeltnis: 1, kreise: 1 } },
    { bild: 'seite.png', art: 'aufriss', ergebnis: { breite: 20, hoehe: 53, verhaeltnis: 2.67 } },
    { bild: 'farben.png', art: 'farben', ergebnis: [{ farbe: 'weiß', anteil: 0.7, rgb: [250, 250, 250] }, { farbe: 'grau', anteil: 0.3, rgb: [128, 128, 128] }] },
  ];
  const p = L.briefing({ projekt: 'Z', messungen });
  assert.match(p, /GEMESSEN \(deterministisch aus den Bildern, nicht geschätzt/);
  assert.match(p, /- oben\.png, Teil „Zentralturm“ \(Grundriss\): Form rund; Breite zu Tiefe 1; 1 Kreise; 0 gerade Linien/);
  assert.match(p, /- seite\.png \(Aufriss\): Höhe zu Breite 2,67/);
  assert.match(p, /- farben\.png \(Farben\): weiß 70 %, grau 30 %\n\nEINGABE/);
  assert.ok(!L.briefing({ projekt: 'Z' }).includes('GEMESSEN'));
  assert.equal(L.briefing({ projekt: 'Z', messungen }), p, 'deterministisch');
});
