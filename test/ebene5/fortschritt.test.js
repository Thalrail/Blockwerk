import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fortschritt as F, teilen as T } from '../../src/ebene5/index.js';
import { beispiel, zufall } from './hilfe5.js';

const gleich = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
const SCHLUESSEL = Array.from({ length: 12 }, (_, i) => `abschnitt|${i}|abcd${i}`);

/** Eine Folge zufälliger Haken von einem Spieler; startet von einem gemeinsamen Stand. */
function spiele(start, name, rnd, n) {
  let f = start;
  for (let i = 0; i < n; i++) f = F.haken(f, [SCHLUESSEL[Math.floor(rnd() * SCHLUESSEL.length)]], rnd() < 0.6, name);
  return f;
}

test('Fortschritt: Zusammenführen ist unabhängig von Reihenfolge und Wiederholung', () => {
  for (let lauf = 1; lauf <= 60; lauf++) {
    const rnd = zufall(lauf * 7919);
    const basis = spiele(F.leer(), 'Start', rnd, Math.floor(rnd() * 5));
    const a = spiele(basis, 'Anna', rnd, 1 + Math.floor(rnd() * 8));
    const b = spiele(basis, 'Ben', rnd, 1 + Math.floor(rnd() * 8));
    const c = spiele(basis, 'Cleo', rnd, 1 + Math.floor(rnd() * 8));
    // kommutativ
    gleich(F.zusammenfuehren(a, b), F.zusammenfuehren(b, a));
    // assoziativ
    gleich(F.zusammenfuehren(F.zusammenfuehren(a, b), c), F.zusammenfuehren(a, F.zusammenfuehren(b, c)));
    // idempotent
    gleich(F.zusammenfuehren(a, a), a);
    gleich(F.zusammenfuehren(F.zusammenfuehren(a, b), b), F.zusammenfuehren(a, b));
    // alle Austauschreihenfolgen führen zum selben Stand
    const alle = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]].map(([x, y, z]) => F.zusammenfuehren(F.zusammenfuehren(x, y), z));
    for (const r of alle) gleich(r, alle[0]);
    // die Uhr wird nie kleiner, jeder Eintrag steckt im Ergebnis
    assert.ok(alle[0].uhr >= Math.max(a.uhr, b.uhr, c.uhr));
    for (const k of Object.keys(a.eintraege)) assert.ok(k in alle[0].eintraege);
  }
});

test('Fortschritt: Haken, Entfernen und Konflikte', async () => {
  // zwei Freunde haken parallel verschiedene Schichten ab: beide Haken bleiben
  const start = F.leer();
  const anna = F.haken(start, ['a|1|x', 'a|2|x'], true, 'Anna');
  const ben = F.haken(start, ['a|3|x'], true, 'Ben');
  const beide = F.zusammenfuehren(anna, ben);
  assert.deepEqual(['a|1|x', 'a|2|x', 'a|3|x'].map((k) => F.istAbgehakt(beide, k)), [true, true, true]);
  // später entfernt schlägt früher abgehakt, wenn die Uhr jünger ist (Anna nimmt den Haken zurück, nachdem sie Bens Stand gesehen hat)
  const zurueck = F.haken(beide, ['a|3|x'], false, 'Anna');
  assert.equal(F.istAbgehakt(F.zusammenfuehren(beide, zurueck), 'a|3|x'), false);
  assert.equal(F.istAbgehakt(F.zusammenfuehren(zurueck, beide), 'a|3|x'), false);
  // gleichzeitig (gleiche Uhr): der Name entscheidet, überall gleich
  const x = F.haken(start, ['k'], true, 'Anna'), y = F.haken(start, ['k'], false, 'Ben');
  assert.equal(F.istAbgehakt(F.zusammenfuehren(x, y), 'k'), F.istAbgehakt(F.zusammenfuehren(y, x), 'k'));
  assert.equal(F.istAbgehakt(F.zusammenfuehren(x, y), 'k'), false, 'Ben > Anna');
  // gleiche Uhr, gleicher Name, verschiedene Werte: „abgehakt“ gewinnt, überall gleich
  const p = F.haken(start, ['k'], true, 'Anna'), q = F.haken(start, ['k'], false, 'Anna');
  assert.equal(F.istAbgehakt(F.zusammenfuehren(p, q), 'k'), true);
  assert.equal(F.istAbgehakt(F.zusammenfuehren(q, p), 'k'), true);
  // das Original bleibt unverändert, ohne Namen kein Haken
  assert.deepEqual(start, F.leer());
  assert.throws(() => F.haken(start, ['k'], true, ''), /Spielername fehlt/);
  // Form prüfen (aus Link, Datei oder Speicher)
  gleich(F.pruefe(beide), beide);
  for (const kaputt of [null, {}, { eintraege: {}, uhr: -1 }, { eintraege: { k: { wert: 'ja', uhr: 1, von: 'A' } }, uhr: 1 }, { eintraege: { k: { wert: true, uhr: 0, von: 'A' } }, uhr: 1 }, { eintraege: { k: { wert: true, uhr: 1 } }, uhr: 1 }]) {
    assert.throws(() => F.pruefe(kaputt), F.FortschrittFehler);
  }

  // Prozent, nächste Schicht und der Abdruck: ändert sich die Schicht, verschwindet der Haken von selbst
  const { plan, e, spezifikation } = await beispiel();
  const alle = plan.abschnitte.flatMap((a) => a.schichten.map((s) => F.schluessel(a.id, s)));
  assert.equal(new Set(alle).size, alle.length, 'jede Schicht hat ihren eigenen Schlüssel');
  let f = F.leer();
  assert.deepEqual([F.prozent(f, plan).fertigeSchichten, F.prozent(f, plan).anteil], [0, 0]);
  assert.deepEqual(F.naechsteSchicht(f, plan), { abschnitt: 0, index: 0 });
  const keller = plan.abschnitte[0];
  f = F.haken(f, keller.schichten.map((s) => F.schluessel(keller.id, s)), true, 'Jonah');
  assert.equal(F.prozent(f, plan, 'lagerkeller').anteil, 1);
  assert.equal(F.prozent(f, plan, 'zentralturm').anteil, 0);
  assert.equal(F.prozent(f, plan).fertigeBloecke, keller.bloecke);
  assert.deepEqual(F.naechsteSchicht(f, plan), { abschnitt: 1, index: 0 });
  f = F.haken(f, [F.schluessel('zentralturm', plan.abschnitte[1].schichten[0])], true, 'Jonah');
  assert.deepEqual(F.naechsteSchicht(f, plan), { abschnitt: 1, index: 1 });
  const alles = F.haken(f, alle, true, 'Jonah');
  assert.equal(F.naechsteSchicht(alles, plan), null);
  assert.equal(F.prozent(alles, plan).anteil, 1);
  // neue Fassung: der höhere Turm hat neue oberste Schichten; die unveränderten Schichten bleiben abgehakt, die geänderten nicht
  const hoeher = e.ebene4.freigeben(e.ebene4.neueVersion(spezifikation, (s) => { s.teile[0].form.groesse.hoehe = 44; delete s.teile[0].form.proportionen; }));
  const plan2 = e.e5.bauplan(e.ebene4.baue(hoeher).entwurf);
  assert.equal(F.prozent(alles, plan2, 'lagerkeller').anteil, 1, 'der Keller ist unverändert');
  assert.equal(F.prozent(alles, plan2, 'zentralturm').fertigeSchichten, plan.abschnitte[1].schichten.length, 'die alten Schichten des Turms bleiben abgehakt');
  assert.ok(F.prozent(alles, plan2, 'zentralturm').schichten > plan.abschnitte[1].schichten.length);
  assert.ok(F.prozent(alles, plan2).anteil < 1, 'die neuen Schichten sind offen');
  const naechste = F.naechsteSchicht(alles, plan2);
  assert.equal(plan2.abschnitte[naechste.abschnitt].id, 'zentralturm');
});

test('Teilen: Link und Datei', async () => {
  const { spezifikation, plan } = await beispiel();
  const fort = F.haken(F.leer(), [F.schluessel('lagerkeller', plan.abschnitte[0].schichten[0])], true, 'Jonah');
  // Rundreise
  const { code, zuLang } = await T.kodiere({ spezifikation, fortschritt: fort });
  assert.equal(zuLang, false);
  assert.match(code, /^[A-Za-z0-9_-]+$/, 'nur URL-taugliche Zeichen');
  assert.ok(code.length < 2000, `Link kurz genug (${code.length})`);
  const zurueck = await T.dekodiere(code);
  gleich(zurueck.spezifikation, spezifikation);
  gleich(zurueck.fortschritt, fort);
  // ohne Fortschritt
  assert.equal((await T.dekodiere((await T.kodiere({ spezifikation })).code)).fortschritt, undefined);
  // Link mit Adresse; ein vorhandener Fragmentteil wird ersetzt
  const { link, zuLang: lang2 } = await T.link('https://thalrail.github.io/blockwerk/#alt', { spezifikation, fortschritt: fort });
  assert.match(link, /^https:\/\/thalrail\.github\.io\/blockwerk\/#p=[A-Za-z0-9_-]+$/);
  assert.equal(lang2, false);
  gleich((await T.ausLink(link)).spezifikation, spezifikation);
  assert.equal(await T.ausLink('https://x.de/blockwerk/'), null);
  assert.equal(await T.ausLink('https://x.de/#anderes'), null);
  // deterministisch
  assert.equal((await T.kodiere({ spezifikation, fortschritt: fort })).code, code);
  // Fehler: abgeschnitten, beschädigt, fremd, falsche Version
  await assert.rejects(() => T.dekodiere(code.slice(0, code.length - 12)), T.TeilenFehler);
  await assert.rejects(() => T.dekodiere(`${code.slice(0, 20)}${code.slice(21)}`), /beschädigt|unvollständig|JSON/);
  await assert.rejects(() => T.dekodiere('abc def'), /ungültige Zeichen/);
  await assert.rejects(() => T.dekodiere(''), T.TeilenFehler);
  const fremd = (await T.kodiere({ spezifikation })).code;
  assert.ok(fremd);
  const schlecht = async (d) => { const bytes = new TextEncoder().encode(JSON.stringify(d)); const s = new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))); const b = new Uint8Array(await s.arrayBuffer()); let t = ''; for (const x of b) t += String.fromCharCode(x); return btoa(t).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); };
  await assert.rejects(async () => T.dekodiere(await schlecht({ typ: 'etwas-anderes', version: 1, spezifikation })), /kein Blockwerk-Projekt/);
  await assert.rejects(async () => T.dekodiere(await schlecht({ typ: T.TYP, version: 99, spezifikation })), /Version 99 wird nicht verstanden/);
  await assert.rejects(async () => T.dekodiere(await schlecht({ typ: T.TYP, version: 1 })), /Spezifikation fehlt/);
  await assert.rejects(async () => T.dekodiere(await schlecht({ typ: T.TYP, version: 1, spezifikation, fortschritt: 5 })), /Fortschritt ist ungültig/);
  // zu lang: die Oberfläche schlägt die Datei vor
  const r = zufall(99);
  const gross = structuredClone(spezifikation);
  gross.teile.push(...Array.from({ length: 80 }, (_, i) => ({ id: `t${i}`, name: Array.from({ length: 30 }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join(''), art: 'turm', wichtigkeit: 'kann', form: { baustein: 'form.zylinder', groesse: { breite: 5 + Math.floor(r() * 90), tiefe: 5 + Math.floor(r() * 90), hoehe: 5 + Math.floor(r() * 90) } }, lage: { bezug: 'projekt', relation: 'mitte' } })));
  const langer = await T.kodiere({ spezifikation: gross });
  assert.equal(langer.zuLang, true);
  assert.ok(langer.code.length > T.EMPFOHLEN_MAX);
  assert.equal((await T.dekodiere(langer.code)).spezifikation.teile.length, gross.teile.length, 'lang, aber vollständig lesbar');
  // Datei: Rundreise und Fehler
  const datei = T.exportDatei({ spezifikation, fortschritt: fort });
  gleich(T.importDatei(datei).spezifikation, spezifikation);
  gleich(T.importDatei(datei).fortschritt, fort);
  assert.match(datei, /^\{\n  "typ": "blockwerk-projekt"/, 'lesbar eingerückt');
  assert.throws(() => T.importDatei('{kaputt'), /kein gültiges JSON/);
  assert.throws(() => T.importDatei('{"typ":"x"}'), /kein Blockwerk-Projekt/);
});
