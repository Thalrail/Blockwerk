// U7: Grenzen sichtbar machen (src/ebene5/grenzen.js) und Fassungsverlauf (src/ebene5/verlauf.js), mit den echten Grenzen der anderen Module und der echten Engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import * as PF from '../../src/ebene5/planfassung.js';
const PF_GRENZEN_EINTRAEGE = PF.PF_GRENZEN.eintraege;
import * as G from '../../src/ebene5/grenzen.js';
import * as V from '../../src/ebene5/verlauf.js';
import { GRENZEN as RAUM } from '../../src/ebene5/live.js';
import { EMPFOHLEN_MAX, CODE_MAX } from '../../src/ebene5/teilen.js';

const eintraege = (n) => { const e = {}; for (let i = 0; i < n; i++) e[`t|${i},0,0`] = { teil: 't', zelle: { x: i, y: 0, z: 0 }, op: 'leere', von: 'A' }; return { version: 1, eintraege: e }; };
const nach = (ansicht, id) => ansicht.eintraege.find((e) => e.id === id);

test('Grenzen: leer ist alles ok; die Grenzen sind die der anderen Module (keine eigenen Zahlen)', () => {
  const a = G.grenzenAnsicht({ spezifikation: { schema: 1 }, planfassung: PF.leer(), fortschritt: { eintraege: {} }, spieler: 1 });
  assert.equal(a.stufe, 'ok');
  assert.deepEqual(a.eintraege.map((e) => e.id), ['aenderungen', 'aenderungen-groesse', 'spezifikation', 'fortschritt', 'spieler']);
  assert.equal(nach(a, 'aenderungen').grenze, PF.PF_GRENZEN.eintraege);
  assert.equal(nach(a, 'aenderungen-groesse').grenze, PF.PF_GRENZEN.groesse);
  assert.equal(nach(a, 'spezifikation').grenze, RAUM.spezifikation);
  assert.equal(nach(a, 'fortschritt').grenze, RAUM.eintraege);
  assert.equal(nach(a, 'spieler').grenze, RAUM.spieler);
  assert.ok(a.eintraege.every((e) => e.stufe === 'ok' && !/\. /.test(e.text.replace(/\d+\.\d/g, ''))), 'bei ok kein Hinweis');
  // ohne optionale Angaben fehlen die Zeilen, es gibt keine erfundenen Werte
  assert.deepEqual(G.grenzenAnsicht().eintraege.map((e) => e.id), ['aenderungen', 'aenderungen-groesse']);
  assert.equal(nach(G.grenzenAnsicht(), 'aenderungen').wert, 0);
});

test('Grenzen: warnen ab 70 %, voll ab 95 %, mit Hinweis; Anteil und Prozent stimmen', () => {
  const g = PF.PF_GRENZEN.eintraege;
  const stufe = (n) => nach(G.grenzenAnsicht({ planfassung: eintraege(n) }), 'aenderungen');
  assert.equal(stufe(Math.floor(g * G.WARN_AB) - 1).stufe, 'ok');
  assert.equal(stufe(Math.ceil(g * G.WARN_AB)).stufe, 'warn');
  assert.equal(stufe(Math.ceil(g * G.VOLL_AB) - 1).stufe, 'warn');
  const voll = stufe(Math.ceil(g * G.VOLL_AB));
  assert.equal(voll.stufe, 'voll');
  assert.match(voll.text, /Änderungen: \d+ von 1000 Einträge \(\d+ %\)\. Mehr Änderungen nimmt weder ein Raum noch ein Link an/);
  assert.equal(stufe(g).prozent, 100);
  assert.equal(stufe(g * 3).prozent, 300);
  assert.equal(G.grenzenAnsicht({ planfassung: eintraege(g) }).stufe, 'voll', 'die schlimmste Stufe zählt');
});

test('Grenzen: Link (Länge des Codes), Spezifikation, Fortschritt, Spieler; ein langer Link warnt schon unterhalb der harten Grenze', () => {
  const link = (n) => nach(G.grenzenAnsicht({ linkLaenge: n }), 'link');
  assert.equal(link(100).stufe, 'ok');
  assert.equal(link(EMPFOHLEN_MAX + 1).stufe, 'warn');
  assert.match(link(EMPFOHLEN_MAX + 1).text, /kürzen manche Chats Links ab/);
  assert.equal(link(Math.ceil(CODE_MAX * 0.96)).stufe, 'voll');
  assert.match(link(CODE_MAX).text, /als Datei sichern/);
  assert.equal(link(CODE_MAX).grenze, CODE_MAX);
  assert.equal(nach(G.grenzenAnsicht({ linkLaenge: 'x' }), 'link'), undefined, 'ohne Zahl keine Zeile');
  const sp = nach(G.grenzenAnsicht({ spezifikation: { text: 'x'.repeat(RAUM.spezifikation) } }), 'spezifikation');
  assert.equal(sp.stufe, 'voll');
  const haken = (n) => ({ eintraege: Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, {}])) });
  assert.equal(nach(G.grenzenAnsicht({ fortschritt: haken(Math.ceil(RAUM.eintraege * 0.8)) }), 'fortschritt').stufe, 'warn');
  assert.equal(nach(G.grenzenAnsicht({ spieler: RAUM.spieler }), 'spieler').stufe, 'voll');
  const gross = nach(G.grenzenAnsicht({ planfassung: { version: 1, eintraege: { a: { text: 'x'.repeat(PF.PF_GRENZEN.groesse) } } } }), 'aenderungen-groesse');
  assert.equal(gross.stufe, 'voll');
  // ein unzulässiger Wert (zyklisch) bringt die Ansicht nicht zum Absturz
  const zyklisch = {}; zyklisch.sich = zyklisch;
  assert.equal(nach(G.grenzenAnsicht({ spezifikation: zyklisch }), 'spezifikation').wert, 0);
});

test('Grenzen: eine Warnung kommt nur, wenn eine Grenze neu in die Warnung oder ins Volle gerät', () => {
  const a0 = G.grenzenAnsicht({ planfassung: eintraege(10) });
  const a1 = G.grenzenAnsicht({ planfassung: eintraege(Math.ceil(PF.PF_GRENZEN.eintraege * 0.8)) });
  const a2 = G.grenzenAnsicht({ planfassung: eintraege(Math.ceil(PF.PF_GRENZEN.eintraege * 0.99)) });
  assert.deepEqual(G.neueWarnungen(null, a0), []);
  assert.equal(G.neueWarnungen(a0, a1).length, 1, 'ok → warn');
  assert.deepEqual(G.neueWarnungen(a1, a1), [], 'gleiche Stufe: nicht noch einmal');
  assert.equal(G.neueWarnungen(a1, a2).length, 1, 'warn → voll');
  assert.deepEqual(G.neueWarnungen(a2, a0), [], 'zurück ins Grüne: keine Meldung');
});

test('Verlauf: Einträge werden streng gebildet, Wiederholungen und Nicht-Übergänge nicht gebucht, die Liste ist begrenzt', () => {
  const e = V.eintrag({ art: 'spezifikation', von: 2, nach: 3, text: '  zwei\nZeilen  ', wer: 'x'.repeat(40) });
  assert.deepEqual(e, { art: 'spezifikation', von: 2, nach: 3, text: 'zwei Zeilen', wer: 'x'.repeat(24) });
  assert.throws(() => V.eintrag({ art: 'sonst', von: 1, nach: 2 }), /unbekannt/);
  assert.throws(() => V.eintrag({ art: 'aenderungen', von: -1, nach: 2 }), /ganze Zahlen/);
  assert.throws(() => V.eintrag({ art: 'aenderungen', von: 1.5, nach: 2 }), /ganze Zahlen/);
  assert.equal(V.eintrag({ art: 'aenderungen', von: 1, nach: 2, text: 'a'.repeat(999) }).text.length, 240);
  let l = [];
  l = V.anhaengen(l, { art: 'aenderungen', von: 1, nach: 2 });
  assert.equal(V.anhaengen(l, { art: 'aenderungen', von: 1, nach: 2 }), l, 'unmittelbar wiederholt: nicht noch einmal');
  assert.equal(V.anhaengen(l, { art: 'aenderungen', von: 3, nach: 3 }), l, 'keine Änderung der Fassung: kein Übergang');
  assert.equal(V.anhaengen(l, { art: 'spezifikation', von: 1, nach: 2 }).length, 2, 'dieselben Zahlen, andere Art: ein eigener Übergang');
  for (let i = 0; i < 50; i++) l = V.anhaengen(l, { art: 'aenderungen', von: i + 10, nach: i + 11 });
  assert.equal(l.length, V.VERLAUF_MAX);
  assert.equal(l.at(-1).nach, 60);
  assert.equal(V.anhaengen(null, { art: 'aenderungen', von: 0, nach: 1 }).length, 1);
});

test('Verlauf: gespeicherte Listen werden streng gelesen (Unbrauchbares entfällt, nie ein Fehler)', () => {
  assert.deepEqual(V.liesListe(null), []);
  assert.deepEqual(V.liesListe('x'), []);
  assert.deepEqual(V.liesListe({}), []);
  const roh = [{ art: 'spezifikation', von: 1, nach: 2, text: 'ok' }, null, 5, { art: 'böse', von: 1, nach: 2 }, { art: 'aenderungen', von: 'a', nach: 2 }, { art: 'aenderungen', von: 3, nach: 4, text: '<img onerror=x>' }];
  const l = V.liesListe(roh);
  assert.deepEqual(l.map((x) => [x.art, x.von, x.nach]), [['spezifikation', 1, 2], ['aenderungen', 3, 4]]);
  assert.equal(V.liesListe(Array.from({ length: 100 }, (_, i) => ({ art: 'aenderungen', von: i, nach: i + 1 }))).length, V.VERLAUF_MAX);
});

test('Verlauf: Sätze zum Vergleich der Spezifikation (echte Engine) und zu den Einzelblockänderungen; Baubericht-Zeilen', async () => {
  const e = await engine();
  const alt = e.ebene4.freigeben(hausSpezifikation(VARIANTEN.klein, {}), 'test');
  const neu = hausSpezifikation(VARIANTEN.klein, {}); neu.teile.find((t) => t.id === 'dach').form.groesse.neigung = 0.5; neu.teile.push({ ...structuredClone(neu.teile[0]), id: 'anbau', name: 'Anbau' }); neu.teile.splice(1, 1);
  const v = e.ebene4.vergleiche(alt, neu);
  const s = V.vergleichText(v);
  assert.match(s, /1 Teil hinzugefügt \(anbau\)/);
  assert.match(s, /1 Teil entfernt \(obergeschoss\)/);
  assert.match(s, /1 Teil geändert \(dach\)/);
  assert.equal(V.vergleichText(null), '');
  assert.equal(V.vergleichText({ hinzugefuegt: [], entfernt: [], geaendert: [], projekt: [] }), '');
  assert.equal(V.vergleichText({ hinzugefuegt: [], entfernt: [], geaendert: [], projekt: [{ pfad: 'name' }] }), 'Projektangaben geändert');
  assert.match(V.vergleichText({ hinzugefuegt: ['a', 'b', 'c', 'd'], entfernt: [], geaendert: [] }), /4 Teile hinzugefügt \(a, b, c …\)/);
  // Planfassungen
  const op = (x, neu, erw = null) => ({ teil: 't', zelle: { x, y: 0, z: 0 }, erwartet: erw, neu });
  const a = PF.wende(PF.wende(PF.leer(), [op(1, { op: 'leere' })], 'A').planfassung, [op(2, { op: 'leere' })], 'A').planfassung;
  const b = PF.wende(PF.wende(a, [op(1, null, { op: 'leere' })], 'B').planfassung, [op(3, { op: 'setze', block: { id: 'minecraft:stone' } }), op(2, { op: 'leere', zugelassen: true }, { op: 'leere' })], 'B').planfassung;
  assert.equal(V.aenderungenText(a, b), 'Einzelblockänderungen: 1 neu, 1 geändert, 1 weg (jetzt 2 Einträge)');
  assert.equal(V.aenderungenText(a, a), '');
  assert.equal(V.aenderungenText(null, PF.leer()), '');
  assert.match(V.aenderungenText(PF.leer(), a), /^Einzelblockänderungen: 2 neu \(jetzt 2 Einträge\)$/);
  // Zeilen
  const liste = V.anhaengen(V.anhaengen([], { art: 'spezifikation', von: 1, nach: 2, text: s, wer: 'Anna' }), { art: 'aenderungen', von: 4, nach: 5, text: V.aenderungenText(a, b) });
  const z = V.berichtZeilen(liste, { spezifikation: 2, aenderungen: 5 });
  assert.equal(z[0], 'Aktuell: Spezifikation Version 2, Einzelblockänderungen Fassung 5.');
  assert.match(z[1], /^Änderungen: Fassung 4 → Fassung 5: Einzelblockänderungen/, 'neueste zuerst');
  assert.match(z[2], /^Spezifikation: Fassung 1 → Fassung 2 \(Anna\): 1 Teil hinzugefügt/);
  assert.equal(V.berichtZeilen([], { spezifikation: 1, aenderungen: 0 })[1], 'Noch keine Übergänge in dieser Sitzung.');
  assert.equal(V.berichtZeilen(Array.from({ length: 30 }, (_, i) => V.eintrag({ art: 'aenderungen', von: i, nach: i + 1 })), { spezifikation: 1, aenderungen: 0 }).length, 11, 'höchstens zehn Übergänge');
});

test('Grenzen: Prozent wird bei 999 gedeckelt; nur eine Zulassung zählt als geänderter Eintrag', () => {
  const a = G.grenzenAnsicht({ planfassung: eintraege(PF_GRENZEN_EINTRAEGE * 20) });
  assert.equal(a.eintraege.find((e) => e.id === 'aenderungen').prozent, 999);
  const op = { teil: 't', zelle: { x: 1, y: 0, z: 0 } };
  const eins = PF.wende(PF.leer(), [{ ...op, erwartet: null, neu: { op: 'leere' } }], 'A').planfassung;
  const zwei = PF.wende(eins, [{ ...op, erwartet: { op: 'leere' }, neu: { op: 'leere', zugelassen: true } }], 'A').planfassung;
  assert.equal(V.aenderungenText(eins, zwei), 'Einzelblockänderungen: 1 geändert (jetzt 1 Eintrag)');
});
