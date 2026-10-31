import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { neuerEntwurf, BedarfFehler, GliederungFehler, RechtFehler, entwurfZuJson, berichtAlsText } from '../../src/ebene3/index.js';

const e3 = ebene3();
const T = e3.techniker;
const K = e3.konstrukteur;
const e0 = e3.ebene0;
const e1 = e3.ebene1;
const FUELLER = e1.regelwerk.parameter('lager.filter', 'fueller');
const SORTEN = e0.register.gegenstaende
  .filter((id) => /^minecraft:[a-z_]+$/.test(id) && e0.register.stapel(id) === 64 && !FUELLER.includes(id) && !/light_block|barrier|allow|deny|border|void|command|structure|jigsaw|debug|air|bedrock|spawn_egg|banner_pattern|unknown/.test(id))
  .slice(0, 110);
const huelle = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } });
const aendere = (e, wer, a) => e3.aendere(e, wer, a).entwurf;
const fehler = (klasse, fn) => { try { fn(); } catch (f) { assert.ok(f instanceof klasse, String(f)); return f.message; } return null; };
const zone = (e, z) => aendere(e, 'grobdesigner', { art: 'setze-zone', zone: { id: 'Z1', abschnitt: 'halle', funktion: 'technik', ...z } });

/** Eine Halle (großer Abschnitt) mit optionaler Technikzone. */
function halle(technikzone) {
  const e = K.gliedere(neuerEntwurf({ name: 'Probe' }), [{ id: 'halle', name: 'Halle', huelle: huelle(-10, -5, -40, 160, 20, 40) }]);
  return technikzone ? zone(e, technikzone) : e;
}
const nischen = (id, anzahl, extra = {}) => ({ id, abschnitt: 'halle', art: 'handelsnischen', anzahl, ...extra });
const lager = (id, n) => ({ id, abschnitt: 'halle', art: 'lager', sorten: SORTEN.slice(0, n) });
const parameter = (e) => T.plane(e, 'halle').liste.map((m) => m.parameter);
const innen = (h, z) => h.von.x >= z.von.x && h.bis.x <= z.bis.x && h.von.y >= z.von.y && h.bis.y <= z.bis.y && h.von.z >= z.von.z && h.bis.z <= z.bis.z;
const weltHuelle = (t) => {
  const h = e3.ebene2.baue(t.baustein, t.parameter).platzbedarf.huelle;
  return huelle(h.von.x + t.lage.x, h.von.y + t.lage.y, h.von.z + t.lage.z, h.bis.x + t.lage.x, h.bis.y + t.lage.y, h.bis.z + t.lage.z);
};
const fertig = (e, id) => { const r = K.naechster(e); assert.equal(r.abschnitt.id, id); return K.schliesse(r.entwurf, id); };
const keinEinwand = (e) => assert.deepEqual(e3.einwaende.sammle(e).einwaende.map((x) => `${x.regel}: ${x.text}`), []);

test('Techniker: Bedarf, Module und Anfragen', () => {
  const leer = halle();
  const vorher = entwurfZuJson(leer);
  const e = T.setzeBedarf(leer, [nischen('B1', 24), lager('B2', 12), { id: 'B3', abschnitt: 'halle', art: 'brueter' }]);
  assert.equal(entwurfZuJson(leer), vorher, 'Original unverändert');
  assert.deepEqual(e.bedarf.map((b) => [b.id, b.art]), [['B1', 'handelsnischen'], ['B2', 'lager'], ['B3', 'brueter']]);

  // Bedarf ohne Modul wird zur Schaltungsanfrage, nicht geraten
  assert.deepEqual(e.anfragen, [{ id: 'S1', bedarf: 'B3', abschnitt: 'halle', art: 'brueter', status: 'offen' }]);
  assert.match(berichtAlsText(e), /Schaltungsanfrage S1: für den Bedarf „brueter“ \(B3\) im Abschnitt halle gibt es noch kein Modul/);
  assert.deepEqual(parameter(e).map((p) => Object.keys(p)[0]), ['anzahl', 'sorten'], 'die Anfrage erzeugt kein Modul');

  // Technik skaliert über Anzahl: mehr Bedarf = mehr Module, nie größere
  const teilung = (b) => parameter(T.setzeBedarf(halle(), [b])).map((p) => (p.anzahl ?? p.sorten.length));
  assert.deepEqual(teilung(nischen('N', 1)), [1]);
  assert.deepEqual(teilung(nischen('N', 256)), [256]);
  assert.deepEqual(teilung(nischen('N', 257)), [256, 1]);
  assert.deepEqual(teilung(nischen('N', 300)), [256, 44]);
  assert.deepEqual(teilung(lager('L', 1)), [1]);
  assert.deepEqual(teilung(lager('L', 48)), [48]);
  assert.deepEqual(teilung(lager('L', 49)), [48, 1]);
  assert.deepEqual(teilung(lager('L', 100)), [48, 48, 4]);
  assert.deepEqual(T.plane(T.setzeBedarf(halle(), [nischen('N', 3, { beruf: 4 })]), 'halle').liste[0].parameter, { anzahl: 3, beruf: 4 });

  // Unbrauchbarer Bedarf: klare Fehler
  assert.match(fehler(BedarfFehler, () => T.setzeBedarf(leer, [nischen('N', 0)])), /ganze Zahl ab 1/);
  assert.match(fehler(BedarfFehler, () => T.setzeBedarf(leer, [nischen('N', 2.5)])), /ganze Zahl ab 1/);
  assert.match(fehler(BedarfFehler, () => T.setzeBedarf(leer, [{ id: 'L', abschnitt: 'halle', art: 'lager', sorten: [] }])), /mindestens einem Eintrag/);
  assert.match(fehler(BedarfFehler, () => T.setzeBedarf(leer, [{ id: 'L', abschnitt: 'halle', art: 'lager', sorten: ['minecraft:dirt', 'minecraft:dirt'] }])), /doppelt/);
  assert.match(fehler(RechtFehler, () => T.setzeBedarf(leer, [{ id: 'X', abschnitt: 'keller', art: 'lager', sorten: ['minecraft:dirt'] }])), /existiert nicht/);

  // Rechte: nur der Techniker setzt Bedarf und Anfragen
  for (const wer of ['konstrukteur', 'architekt', 'designer', 'grobdesigner']) {
    assert.equal(fehler(RechtFehler, () => e3.aendere(leer, wer, { art: 'setze-bedarf', bedarf: nischen('B1', 2) })).includes('gehört dem techniker'), true, wer);
    assert.equal(fehler(RechtFehler, () => e3.aendere(leer, wer, { art: 'setze-anfrage', anfrage: { id: 'S9', bedarf: 'B1' } })).includes('gehört dem techniker'), true, wer);
  }
  // deterministisch
  assert.equal(entwurfZuJson(T.setzeBedarf(leer, [nischen('B1', 24), lager('B2', 12), { id: 'B3', abschnitt: 'halle', art: 'brueter' }])), entwurfZuJson(e));
  // ein alter Entwurf ohne bedarf/anfragen lädt weiter
  const alt = JSON.parse(entwurfZuJson(leer));
  delete alt.bedarf; delete alt.anfragen;
  assert.doesNotThrow(() => entwurfZuJson(alt));
  assert.equal(T.setzeBedarf(alt, [nischen('B1', 2)]).bedarf.length, 1);
});

test('Techniker: Platz, Zone und Sperrzone', () => {
  const ZONE = huelle(0, 0, -30, 120, 9, 30);
  const bedarf = [nischen('B1', 24), lager('B2', 12)];
  let e = T.setzeBedarf(halle(ZONE), bedarf);
  keinEinwand(e);
  const r = T.setzeModule(e, 'halle');
  assert.deepEqual([r.passt, r.teile], [true, ['T1', 'T2']]);
  e = r.entwurf;
  // alles in der Technikzone, nichts überschneidet sich, Ebene 1 hat nichts auszusetzen
  for (const t of e.teile) { assert.ok(innen(weltHuelle(t), ZONE), `${t.id} liegt in der Zone`); assert.equal(t.art, 'technik'); assert.equal(t.gesetztVon, 'techniker'); }
  keinEinwand(e);
  // erstes Modul steht in der Ecke der Zone, das zweite daneben mit Abstand 2
  const h1 = weltHuelle(e.teile[0]), h2 = weltHuelle(e.teile[1]);
  assert.deepEqual([h1.von.x, h1.von.y, h1.von.z], [0, 0, -30]);
  assert.ok(h2.von.x === h1.bis.x + 1 + 2 || h2.von.x === 0, 'daneben mit Abstand oder in der nächsten Reihe');
  // Ebene 1: jeder der 24 Dorfbewohner hat Bett und erreichbaren Beruf
  const welt = e3.materialisiere(e).welt;
  const zu = e1.dorf.zuordnung(welt);
  assert.equal(zu.length, 24);
  assert.ok(zu.every((z) => z.bett && z.beruf?.erreichbar));
  // Anschlüsse in Weltkoordinaten (Ebene-2-Anschluss + Lage)
  const lagerTeil = e.teile[1];
  const lokal = e3.ebene2.baue('tech.sortierlager', lagerTeil.parameter).anschluesse.find((a) => a.art === 'einwurf');
  const welt1 = lagerTeil.anschluesse.find((a) => a.art === 'einwurf');
  assert.deepEqual([welt1.x, welt1.y, welt1.z], [lokal.x + lagerTeil.lage.x, lokal.y + lagerTeil.lage.y, lokal.z + lagerTeil.lage.z]);
  assert.notEqual(welt.leseBlock(welt1.x, welt1.y, welt1.z).id, 'minecraft:air', 'am Einwurf steht ein Block');
  // gleiches Ergebnis noch einmal, Original unverändert
  assert.equal(entwurfZuJson(T.setzeModule(T.setzeBedarf(halle(ZONE), bedarf), 'halle').entwurf), entwurfZuJson(e));
  // schon gesetzte Module werden nicht doppelt gesetzt
  assert.deepEqual(T.setzeModule(e, 'halle').teile, []);
  assert.match(fehler(BedarfFehler, () => T.setzeModule(e, 'keller')), /gibt es nicht/);

  // Reihen: eine schmale Zone zwingt das zweite Modul in die nächste Reihe
  const breit = e3.ebene2.baue('tech.handelsnischen', { anzahl: 24 }).platzbedarf.huelle;
  const lh = e3.ebene2.baue('tech.sortierlager', { sorten: SORTEN.slice(0, 12) }).platzbedarf.huelle;
  const schmal = huelle(0, 0, -30, Math.max(breit.bis.x - breit.von.x, lh.bis.x - lh.von.x) + 10, 9, 30);
  const reihen = T.setzeModule(T.setzeBedarf(halle(schmal), bedarf), 'halle');
  assert.equal(reihen.passt, true);
  const [a, b] = reihen.entwurf.teile.map(weltHuelle);
  assert.deepEqual([b.von.x, b.von.z > a.bis.z], [0, true], 'zweites Modul in der zweiten Reihe');
  keinEinwand(reihen.entwurf);

  // Sperrzone: um jede Handelsnische keine fremden Arbeitsblöcke im Umkreis 16 / 4 (Lager hat keine)
  assert.deepEqual(e.sperrzonen.map((s) => [s.id, s.verbot, s.gesetztVon]), [['SZ-T1', 'arbeitsblock', 'techniker']]);
  assert.deepEqual(e.sperrzonen[0].von, { x: h1.von.x - 16, y: h1.von.y - 4, z: h1.von.z - 16 });
  assert.deepEqual(e.sperrzonen[0].bis, { x: h1.bis.x + 16, y: h1.bis.y + 4, z: h1.bis.z + 16 });
  // dieselben 16/4 wie im Dorfmodell aus Ebene 1
  assert.equal(e1.dorf.imUmkreis({ x: 0, y: 0, z: 0 }, { x: 16, y: 4, z: -16 }), true);
  assert.equal(e1.dorf.imUmkreis({ x: 0, y: 0, z: 0 }, { x: 17, y: 0, z: 0 }), false);
  assert.equal(e1.dorf.imUmkreis({ x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: 0 }), false);
  // ein fremder Berufsblock genau 16 Blöcke entfernt ist ein Einwand, bei 17 nicht
  const fremd = (abstand) => {
    const probe = { id: 'P', abschnitt: 'halle', baustein: 'tech.handelsnischen', parameter: { anzahl: 1 }, lage: { x: 0, y: 0, z: 0, drehung: 0 }, verbindung: true };
    const mat = e3.materialisiere(aendere(e, 'konstrukteur', { art: 'setze-teil', teil: probe }));
    const ab = [...mat.teile.get('P').arbeitsbloecke].map((k) => k.split(',').map(Number));
    const maxX = Math.max(...ab.map((c) => c[0]));
    const lage = { x: h1.von.x - abstand - maxX, y: h1.von.y + 0, z: h1.von.z, drehung: 0 };
    return aendere(e, 'konstrukteur', { art: 'setze-teil', teil: { ...probe, lage } });
  };
  const drin = e3.einwaende.sammle(fremd(16)).einwaende.filter((x) => x.text.includes('Sperrzone SZ-T1'));
  assert.deepEqual(drin.map((x) => [x.von, x.an]), [['techniker', 'konstrukteur']]);
  assert.deepEqual(e3.einwaende.sammle(fremd(17)).einwaende.filter((x) => x.text.includes('Sperrzone SZ-T1')), []);

  // Bedarfsprüfung: zu kleine Zone → Einwand an den Grobdesigner mit Mindestmaß einer Reihe
  const klein = huelle(0, 0, -30, 40, 9, 30);
  const eklein = T.setzeBedarf(halle(klein), bedarf);
  const h24 = breit, h12 = e3.ebene2.baue('tech.sortierlager', { sorten: SORTEN.slice(0, 12) }).platzbedarf.huelle;
  const b24 = h24.bis.x - h24.von.x + 1, b12 = h12.bis.x - h12.von.x + 1;
  const tiefe = Math.max(h24.bis.z - h24.von.z + 1, h12.bis.z - h12.von.z + 1), hoehe = Math.max(h24.bis.y - h24.von.y + 1, h12.bis.y - h12.von.y + 1);
  const ew = e3.einwaende.sammle(eklein).einwaende.filter((x) => x.regel === 'plan.bedarf');
  assert.equal(ew.length, 1);
  assert.deepEqual([ew[0].von, ew[0].an, ew[0].ziel, ew[0].ort], ['techniker', 'grobdesigner', 'zone:Z1', { x: 0, y: 0, z: -30 }]);
  assert.match(ew[0].text, new RegExp(`in einer Reihe mindestens ${b24 + b12 + 2} × ${tiefe} × ${hoehe} Blöcke`));
  assert.deepEqual(T.setzeModule(eklein, 'halle'), { entwurf: eklein, teile: [], passt: false, mindest: { breite: b24 + b12 + 2, tiefe, hoehe } });
  // Der Grobdesigner vergrößert die Zone auf das Mindestmaß: erledigt, danach passt es
  const gross = e3.laufe(eklein, { grobdesigner: () => ({ art: 'setze-zone', zone: { id: 'Z1', abschnitt: 'halle', funktion: 'technik', von: { x: 0, y: 0, z: -30 }, bis: { x: b24 + b12 + 1, y: hoehe - 1, z: tiefe - 31 } } }) });
  assert.deepEqual([gross.erledigt.length, gross.eskaliert.length], [1, 0]);
  assert.equal(T.setzeModule(gross.entwurf, 'halle').passt, true);
  // zu schwach um 1 Block in der Breite: passt nicht
  const knapp = zone(eklein, { von: { x: 0, y: 0, z: -30 }, bis: { x: b24 + b12 + 0, y: hoehe - 1, z: tiefe - 31 } });
  assert.equal(T.plane(knapp, 'halle').passt, false);
  // Ohne Technikzone: Einwand „keine Technikzone“ an den Grobdesigner
  const ohne = e3.einwaende.sammle(T.setzeBedarf(halle(), bedarf)).einwaende.filter((x) => x.regel === 'plan.bedarf');
  assert.deepEqual(ohne.map((x) => [x.an, x.ziel]), [['grobdesigner', 'abschnitt:halle']]);
  assert.match(ohne[0].text, /keine Technikzone/);
  // Sind die Module gesetzt, gibt es keinen Platz-Einwand mehr
  assert.deepEqual(e3.einwaende.sammle(e).einwaende.filter((x) => x.regel === 'plan.bedarf'), []);
});

test('Techniker: Bilanz und Einspruch', () => {
  const ZONE = huelle(0, 0, -30, 120, 9, 30);
  const bilanzVon = (n, extra = []) => {
    let e = T.setzeBedarf(halle(ZONE), [nischen('B1', n), ...extra]);
    e = T.setzeModule(e, 'halle').entwurf;
    return e;
  };
  // Vor dem Fertigmelden zählt nichts
  const e24 = bilanzVon(24);
  assert.deepEqual(T.bilanz(e24).werte, { abschnitte: 0, betten: 0, dorfbewohner: 0, berufsbloecke: 0, golem: 'nein' });
  // 24 Nischen: 24 Betten, 24 Dorfbewohner, 24 Berufsblöcke, Iron Golem ja (ab 10 Dorfbewohnern und 20 Betten)
  const f24 = fertig(e24, 'halle');
  const b24 = T.bilanz(f24);
  assert.deepEqual(b24.werte, { abschnitte: 1, betten: 24, dorfbewohner: 24, berufsbloecke: 24, golem: 'ja' });
  assert.match(b24.entwurf.bericht.at(-1).satz, /Gesamtbilanz nach 1 fertigen Abschnitten: 24 gültige Betten, 24 Dorfbewohner, 24 Berufsblöcke, Iron Golem: ja\./);
  assert.equal(f24.bericht.length, b24.entwurf.bericht.length - 1, 'das Original bleibt unverändert');
  // 19 und 20 Nischen: die Grenze liegt bei 20 Betten
  assert.equal(T.bilanz(fertig(bilanzVon(19), 'halle')).werte.golem, 'nein');
  assert.equal(T.bilanz(fertig(bilanzVon(20), 'halle')).werte.golem, 'ja');
  assert.equal(T.bilanz(fertig(bilanzVon(5), 'halle')).werte.golem, 'nein');

  // Forderungen an die Bilanz: nur für fertige Abschnitte, Widerspruch ist ein Einwand an den Techniker
  const mitForderung = (n, golem) => fertig(bilanzVon(n, []), 'halle') && (() => {
    let e = T.setzeBedarf(halle(ZONE), [nischen('B1', n, { forderung: { golem } })]);
    e = T.setzeModule(e, 'halle').entwurf;
    return e;
  })();
  const einwaendeVon = (e) => e3.einwaende.sammle(e).einwaende.filter((x) => x.regel === 'plan.bilanz');
  assert.deepEqual(einwaendeVon(mitForderung(5, true)), [], 'noch nicht fertig: keine Prüfung');
  assert.equal(einwaendeVon(fertig(mitForderung(5, true), 'halle')).length, 1);
  assert.equal(einwaendeVon(fertig(mitForderung(24, false), 'halle')).length, 1);
  assert.equal(einwaendeVon(fertig(mitForderung(24, true), 'halle')).length, 0);
  assert.equal(einwaendeVon(fertig(mitForderung(5, false), 'halle')).length, 0);
  const widerspruch = einwaendeVon(fertig(mitForderung(5, true), 'halle'))[0];
  assert.deepEqual([widerspruch.von, widerspruch.an, widerspruch.ziel], ['bauleiter', 'techniker', 'bedarf:B1']);
  assert.match(widerspruch.text, /fordert einen Iron Golem, die Gesamtbilanz sagt aber „nein“ \(5 Betten, 5 Dorfbewohner\)/);
  // Der Techniker löst es, indem er die Forderung zurücknimmt (sein eigener Bedarf)
  const geloest = e3.laufe(fertig(mitForderung(5, true), 'halle'), { techniker: () => ({ art: 'setze-bedarf', bedarf: { id: 'B1', abschnitt: 'halle', art: 'handelsnischen', anzahl: 5 } }) });
  assert.deepEqual([geloest.erledigt.length, geloest.eskaliert.length], [1, 0]);

  // Einspruch gegen die Reihenfolge: Bedarf im Abschnitt „halle“ braucht zuerst „lager“, die Gliederung stellt ihn dahinter
  const vorlage = [
    { id: 'halle', name: 'Halle', huelle: huelle(-10, -5, -40, 160, 20, 40) },
    { id: 'lager', name: 'Lagerraum', huelle: huelle(300, -5, -40, 400, 20, 40) },
  ];
  let g = K.gliedere(neuerEntwurf({ name: 'Probe' }), vorlage);
  assert.deepEqual(g.abschnitte.map((a) => [a.id, a.reihenfolge]), [['halle', 1], ['lager', 2]]);
  g = zone(g, ZONE);
  g = T.setzeBedarf(g, [{ id: 'B1', abschnitt: 'halle', art: 'lager', sorten: SORTEN.slice(0, 3), braucht: ['lager'] }]);
  const einspruch = e3.einwaende.sammle(g).einwaende.filter((x) => x.regel === 'plan.einspruch');
  assert.equal(einspruch.length, 1);
  assert.deepEqual([einspruch[0].von, einspruch[0].an, einspruch[0].ziel], ['techniker', 'konstrukteur', 'abschnitt:halle']);
  assert.match(einspruch[0].text, /braucht zuerst den Abschnitt lager, der aber erst als Nummer 2 nach Nummer 1 kommt/);
  // Der Konstrukteur ergänzt die Abhängigkeit; die Reihenfolge dreht sich, der Einwand ist erledigt
  const r = e3.laufe(g, { konstrukteur: (ew, entwurf) => K.abhaengigkeitAenderungen(entwurf, 'halle', ew.braucht) });
  assert.deepEqual([r.erledigt.length, r.eskaliert.length, r.runden], [1, 0, 1]);
  assert.deepEqual(r.entwurf.abschnitte.map((a) => [a.id, a.reihenfolge]).sort(), [['halle', 2], ['lager', 1]]);
  assert.deepEqual(r.entwurf.abschnitte.find((a) => a.id === 'halle').nach, ['lager']);
  // schon richtig herum: kein Einspruch
  const richtig = T.setzeBedarf(K.gliedere(neuerEntwurf({ name: 'Probe' }), [vorlage[0], { ...vorlage[1], nach: [] }]), [{ id: 'B1', abschnitt: 'lager', art: 'lager', sorten: SORTEN.slice(0, 3), braucht: ['halle'] }]);
  assert.deepEqual(e3.einwaende.sammle(richtig).einwaende.filter((x) => x.regel === 'plan.einspruch'), []);
  // Kreise und Rückgriffe lehnt der Konstrukteur ab
  assert.match(fehler(GliederungFehler, () => K.ergaenzeAbhaengigkeit(r.entwurf, 'lager', 'halle')), /Kreis/);
  const laufend = K.naechster(g).entwurf;
  assert.match(fehler(GliederungFehler, () => K.ergaenzeAbhaengigkeit(laufend, 'halle', 'lager')), /Rückgriff/);
  assert.match(fehler(GliederungFehler, () => K.ergaenzeAbhaengigkeit(g, 'halle', 'zz')), /gibt es nicht/);
});

test('Techniker: Bauart Lorenbahn wählt den Baustein der Lorenbahn-Nische (Teilung bei 64, Sperrzone, Fehler)', () => {
  const lore = (id, anzahl, extra = {}) => nischen(id, anzahl, { bauart: 'lorenbahn', ...extra });
  const teilung = (b) => T.plane(T.setzeBedarf(halle(), [b]), 'halle').liste.map((m) => [m.baustein, m.parameter.anzahl]);
  assert.deepEqual(teilung(lore('N', 20)), [['tech.handelsnischen-lore', 20]]);
  assert.deepEqual(teilung(lore('N', 64)), [['tech.handelsnischen-lore', 64]]);
  assert.deepEqual(teilung(lore('N', 65)), [['tech.handelsnischen-lore', 64], ['tech.handelsnischen-lore', 1]]);
  assert.deepEqual(teilung(nischen('N', 20, { bauart: 'zelle' })), [['tech.handelsnischen', 20]], 'Zelle bleibt wie bisher');
  assert.deepEqual(teilung(nischen('N', 20)), [['tech.handelsnischen', 20]], 'ohne Angabe: Zelle');
  assert.deepEqual(T.plane(T.setzeBedarf(halle(), [lore('N', 3, { beruf: 4 })]), 'halle').liste[0].parameter, { anzahl: 3, beruf: 4 });
  const msg = fehler(BedarfFehler, () => T.setzeBedarf(halle(), [lore('N', 3, { bauart: 'schwebend' })]));
  assert.match(msg, /Bauart „schwebend“ gibt es nicht \(zelle, lorenbahn\)/);

  // gesetzt: Modul in der Technikzone, Sperrzone um die Nische, Anschlüsse in Weltkoordinaten
  const e0_ = T.setzeBedarf(zone(halle(), { von: { x: 0, y: -5, z: -30 }, bis: { x: 100, y: 20, z: 30 } }), [lore('B1', 20)]);
  const r = T.setzeModule(e0_, 'halle');
  assert.equal(r.passt, true);
  const t = r.entwurf.teile.find((x) => x.baustein === 'tech.handelsnischen-lore');
  assert.ok(t);
  assert.ok(innen(weltHuelle(t), r.entwurf.zonen[0]), 'Hülle liegt in der Technikzone');
  assert.deepEqual(r.entwurf.sperrzonen.map((s) => [s.id, s.verbot]), [[`SZ-${t.id}`, 'arbeitsblock']]);
  assert.deepEqual(t.anschluesse.map((a) => a.art), ['front', 'zufuhr', 'rueckfuehrung', 'weichen']);
  assert.equal(t.anschluesse[2].x >= t.lage.x, true);
  // zu schmale Zone: Einwand an den Grobdesigner mit dem Mindestmaß der Lorenbahn-Nische
  const eng = T.setzeBedarf(zone(halle(), { von: { x: 0, y: -5, z: -30 }, bis: { x: 20, y: 20, z: 30 } }), [lore('B1', 20)]);
  assert.equal(T.setzeModule(eng, 'halle').passt, false);
  assert.match(T.einwaende(eng)[0].text, /reicht für den Bedarf nicht, nötig sind in einer Reihe mindestens 45 × 6 × 12 Blöcke/);
});
