import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eingabe as E } from '../../src/ebene5/index.js';
import { engine, holeJson } from './hilfe5.js';

const frisch = async () => { const s = await holeJson('data/beispiele/zitadelle-klein.json'); delete s.freigabe; return s; };
const fehler = (f) => assert.throws(f, E.EingabeFehler);

test('Pfade: setzen und entfernen auf Kopien, Objekte werden eingemischt', async () => {
  const s = await frisch(), vorher = JSON.stringify(s);
  const a = E.setzeAm(s, 'teile[1].form.groesse', { breite: 40 });
  assert.deepEqual(a.teile[1].form.groesse, { breite: 40, tiefe: 31 }); // Tiefe bleibt
  assert.equal(E.setzeAm(s, 'teile[0].form.baustein', 'form.kegel').teile[0].form.baustein, 'form.kegel');
  assert.equal(E.setzeAm(s, 'teile[2].funktionen[0].sorten[1]', 'minecraft:dirt').teile[2].funktionen[0].sorten[1], 'minecraft:dirt');
  assert.equal(E.setzeAm(s, 'teile[0].form.proportionen.hoehe_zu_breite', 2.5).teile[0].form.proportionen.hoehe_zu_breite, 2.5);
  assert.deepEqual(E.setzeAm(s, 'teile[1].stil.farben', ['rot']).teile[1].stil.farben, ['rot']); // fehlendes Zwischenobjekt wird angelegt
  assert.equal(E.entferneAm(s, 'teile[1]').teile.length, 2);
  assert.deepEqual(E.entferneAm(s, 'teile[2].funktionen[0].sorten[1]').teile[2].funktionen[0].sorten, ['minecraft:acacia_button', 'minecraft:acacia_fence']);
  assert.equal('projekt' in E.entferneAm(s, 'projekt'), false);
  assert.equal(JSON.stringify(s), vorher);
  fehler(() => E.setzeAm(s, 'teile[7].form.baustein', 'x'));
  fehler(() => E.setzeAm(s, '', 1));
  fehler(() => E.entferneAm(s, 'teile[0].gibtesnicht'));
  fehler(() => E.zerlegePfad('teile[a]'));
});

test('Alle Optionsarten gegen echte Rückfragen: Version +1, Freigabe weg, Frage verschwindet', async () => {
  const e = await engine(), s = await frisch();
  const kaputt = structuredClone(s);
  kaputt.teile[0].form.baustein = 'form.zylindr';
  kaputt.teile[1].blub = 1;
  const r0 = E.pruefeAlles(e, kaputt);
  assert.deepEqual(r0.rueckfragen.map((f) => f.pfad), ['teile[0].form.baustein', 'teile[1].blub']);
  assert.equal(r0.freigebbar, false);
  const frage = r0.rueckfragen[0];
  const a = E.antworte(e, kaputt, frage, 'wert:form.zylinder');
  assert.equal(a.art, 'geaendert');
  assert.equal(a.spec.version, kaputt.version + 1);
  assert.equal(a.spec.teile[0].form.baustein, 'form.zylinder');
  assert.equal(kaputt.teile[0].form.baustein, 'form.zylindr');
  const b = E.antworte(e, a.spec, E.pruefeAlles(e, a.spec).rueckfragen[0], 'entfernen');
  assert.equal('blub' in b.spec.teile[1], false);
  assert.equal(b.spec.version, kaputt.version + 2);
  assert.equal(E.pruefeAlles(e, b.spec).freigebbar, true);
  assert.equal(E.antworte(e, kaputt, frage, 'anders').art, 'manuell');
  fehler(() => E.antworte(e, kaputt, frage, 'gibtesnicht'));
  const frei = e.ebene4.freigeben(b.spec);
  assert.ok(e.ebene4.istFreigegeben(frei));
  const c = E.antworte(e, frei, { pfad: 'projekt.name', frage: 'x', optionen: [{ id: 'wert:Neu', wert: 'Neu' }] }, 'wert:Neu');
  assert.equal(c.spec.freigabe, undefined);
  assert.equal(c.spec.version, frei.version + 1);
});

test('„So lassen“ entscheidet eine Frage, ohne die Spezifikation zu ändern', async () => {
  const e = await engine(), s = await frisch();
  const messung = [{ teil: 'zentralturm', art: 'aufriss', bild: 'a.png', ergebnis: { breite: 10, hoehe: 40, verhaeltnis: 4 } }];
  const r = E.pruefeAlles(e, s, messung);
  assert.equal(r.rueckfragen.length, 1);
  assert.ok(r.rueckfragen[0].id.startsWith('M'));
  const a = E.antworte(e, s, r.rueckfragen[0], 'text');
  assert.equal(a.art, 'ignoriert');
  assert.equal(a.spec, s);
  assert.equal(E.pruefeAlles(e, s, messung, a.ignoriert).rueckfragen.length, 0);
  const b = E.antworte(e, s, r.rueckfragen[0], 'bild');
  assert.equal(b.art, 'geaendert');
  const rest = E.pruefeAlles(e, b.spec, messung).rueckfragen; // die Messfrage ist weg; die Übersetzung merkt nun den Widerspruch zur Höhe 40
  assert.deepEqual(rest.map((q) => q.id), ['U1']);
  assert.match(rest[0].frage, /widerspricht der Proportion/);
});

test('Messung widerspricht dem Grundriss: „Form wie im Bild“ ersetzt den Baustein', async () => {
  const e = await engine(), s = await frisch();
  const messung = [{ teil: 'zentralturm', art: 'grundriss', bild: 'g.png', ergebnis: { form: 'eckig', seitenverhaeltnis: 1 } }];
  const r = E.pruefeAlles(e, s, messung);
  const f = r.rueckfragen.find((q) => q.pfad === 'teile[0].form.baustein');
  assert.ok(f);
  const o = f.optionen.find((x) => x.id.startsWith('wert:'));
  const a = E.antworte(e, s, f, o.id);
  assert.equal(a.spec.teile[0].form.baustein, o.wert);
});

test('Ende zu Ende ohne Browser: drei Fehler per Antwort gelöst, freigegeben, gebaut', async () => {
  const e = await engine(), s = await frisch();
  let spec = structuredClone(s);
  spec.teile[0].form.baustein = 'form.zylindr';
  spec.teile[1].blub = 1;
  spec.teile[2].art = 'kelle';
  let runden = 0;
  for (;;) {
    const r = E.pruefeAlles(e, spec);
    if (r.freigebbar) break;
    const f = r.rueckfragen[0];
    const o = f.optionen.find((x) => x.id === 'entfernen' || x.id.startsWith('wert:'));
    assert.ok(o, `Frage ohne lösbare Option: ${f.frage}`);
    spec = E.antworte(e, spec, f, o.id).spec;
    assert.ok(++runden <= 5);
  }
  assert.equal(runden, 3);
  assert.equal(spec.version, 4);
  const frei = e.ebene4.freigeben(spec, 'jonah');
  const bau = e.ebene4.baue(frei);
  assert.ok(bau.entwurf, 'der Bau liefert einen Entwurf');
  assert.ok(e.e5.bauplan(bau.entwurf).bloecke > 0);
  assert.equal(e.ebene4.freigeben(spec, 'jonah').freigabe.abdruck, frei.freigabe.abdruck);
});

test('Das Beispielprojekt ist ohne Fragen freigebbar und hat eine Zusammenfassung', async () => {
  const e = await engine(), r = E.pruefeAlles(e, await frisch());
  assert.equal(r.freigebbar, true);
  assert.match(r.zusammenfassung, /Zentralturm/);
});

// ---------- Bilder ----------
const bildAus = (B, H, f) => { const d = new Uint8ClampedArray(B * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) d.set(f(x, y), (y * B + x) * 4); return { breite: B, hoehe: H, daten: d }; };

test('Verkleinern: Kante begrenzt, Verhältnis und Farbe bleiben, kleine Bilder unverändert', () => {
  const k = E.verkleinere(bildAus(2000, 1000, () => [120, 60, 30, 255]), 640);
  assert.equal(k.breite, 640);
  assert.equal(k.hoehe, 320);
  assert.ok(k.daten.every((v, i) => v === [120, 60, 30, 255][i % 4]));
  const klein = bildAus(10, 5, () => [1, 2, 3, 255]);
  assert.equal(E.verkleinere(klein, 640), klein);
  const h = E.verkleinere(bildAus(1000, 1000, (x) => (x < 500 ? [0, 0, 0, 255] : [255, 255, 255, 255])), 2);
  assert.equal(h.breite, 2);
  assert.deepEqual([...h.daten.slice(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...h.daten.slice(4, 8)], [255, 255, 255, 255]);
  const u = E.verkleinere(bildAus(999, 7, (x) => [x % 256, 0, 0, 255]), 100);
  assert.equal(u.breite, 100);
  assert.equal(u.hoehe, 1);
  assert.equal(E.verkleinere(bildAus(5000, 1, () => [9, 9, 9, 255]), 100).hoehe, 1);
});

test('Verkleinern: Mittelwert wird gerundet, nicht abgeschnitten', () => {
  const k = E.verkleinere(bildAus(4, 1, (x) => [x < 3 ? 0 : 255, 0, 0, 255]), 2); // zweiter Kasten: (0 + 255) / 2 = 127,5 → 128
  assert.equal(k.daten[4], 128);
});

test('Messen: Kreis auf weißem Grund wird als rund gemessen, gleich mit und ohne Verkleinern', async () => {
  const e = await engine();
  const kreis = (B) => bildAus(B, B, (x, y) => ((x - B / 2) ** 2 + (y - B / 2) ** 2 < (B * 0.4) ** 2 ? [200, 30, 30, 255] : [255, 255, 255, 255]));
  const g = E.messeBild(e, kreis(200), { teil: 'zentralturm', art: 'grundriss', name: 'k.png' });
  assert.equal(g.ergebnis.form, 'rund');
  assert.equal(g.bild, 'k.png');
  assert.deepEqual(g.ergebnis, e.ebene4.messung.grundriss(kreis(200)));
  assert.equal(E.messeBild(e, kreis(1280), { teil: 'zentralturm', art: 'grundriss' }).ergebnis.form, 'rund');
  assert.equal(E.messeBild(e, kreis(200), { teil: 'zentralturm', art: 'farben' }).ergebnis[0].farbe, 'rot');
  const a = E.messeBild(e, bildAus(100, 200, (x, y) => (x > 20 && x < 80 && y > 20 && y < 180 ? [0, 0, 0, 255] : [255, 255, 255, 255])), { teil: 'zentralturm', art: 'aufriss' });
  assert.ok(Math.abs(a.ergebnis.verhaeltnis - 159 / 59) < 0.1);
  fehler(() => E.messeBild(e, kreis(10), { teil: 'x', art: 'schnitt' }));
});

test('Bilddateien: Typ, Größe und Megapixel werden vor dem Dekodieren geprüft', () => {
  E.pruefeBildDatei({ typ: 'image/png', groesse: 1000, breite: 100, hoehe: 100 });
  fehler(() => E.pruefeBildDatei({ typ: 'image/gif', groesse: 10 }));
  fehler(() => E.pruefeBildDatei({ typ: 'image/png', groesse: E.DATEI_MAX + 1 }));
  E.pruefeBildDatei({ typ: 'image/png', groesse: E.DATEI_MAX });
  fehler(() => E.pruefeBildDatei({ typ: 'image/png', groesse: 10, breite: 5000, hoehe: 4000 }));
  E.pruefeBildDatei({ typ: 'image/jpeg', groesse: 10, breite: 4000, hoehe: 4000 });
});
