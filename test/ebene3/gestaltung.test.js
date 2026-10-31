import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { neuerEntwurf, ZonenFehler, FormFehler, GestaltungsFehler, RechtFehler, entwurfZuJson, berichtAlsText } from '../../src/ebene3/index.js';

const e3 = ebene3();
const K = e3.konstrukteur, T = e3.techniker, G = e3.grobdesigner, A = e3.architekt, D = e3.designer;
const e0 = e3.ebene0, e2 = e3.ebene2;
const FUELLER = e3.ebene1.regelwerk.parameter('lager.filter', 'fueller');
const SORTEN = e0.register.gegenstaende
  .filter((id) => /^minecraft:[a-z_]+$/.test(id) && e0.register.stapel(id) === 64 && !FUELLER.includes(id) && !/light_block|barrier|allow|deny|border|void|command|structure|jigsaw|debug|air|bedrock|spawn_egg|banner_pattern|unknown/.test(id))
  .slice(0, 12);
const huelle = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } });
const aendere = (e, wer, a) => e3.aendere(e, wer, a).entwurf;
const fehler = (klasse, fn) => { try { fn(); } catch (f) { assert.ok(f instanceof klasse, String(f)); return f.message; } return null; };
const keinEinwand = (e) => assert.deepEqual(e3.einwaende.sammle(e).einwaende.map((x) => `${x.regel}: ${x.text}`), []);
const abschnitt = (breite = 100, id = 'halle', tiefe = 81, hoehe = 26) => K.gliedere(neuerEntwurf({ name: 'Probe' }), [{ id, name: id, huelle: huelle(-10, -5, -40, -10 + breite - 1, -5 + hoehe - 1, -40 + tiefe - 1) }]);
const weltHuelle = (e, t) => {
  const h = e2.baue(t.baustein, t.parameter).platzbedarf.huelle;
  return huelle(h.von.x + t.lage.x, h.von.y + t.lage.y, h.von.z + t.lage.z, h.bis.x + t.lage.x, h.bis.y + t.lage.y, h.bis.z + t.lage.z);
};
const VIER = [{ funktion: 'technik', anteil: 25 }, { funktion: 'handel', anteil: 25 }, { funktion: 'verkehr', anteil: 25 }, { funktion: 'optik', anteil: 25 }];
const zone = (e, f) => e.zonen.find((z) => z.funktion === f);

test('Grobdesigner: Zonenplan', () => {
  const ANTEILE = [{ funktion: 'technik', anteil: 50 }, { funktion: 'handel', anteil: 30 }, { funktion: 'optik', anteil: 20 }];
  // Streifen lückenlos, ohne Überschneidung, volle Tiefe und Höhe, für viele Breiten
  for (const W of [4, 5, 6, 7, 10, 11, 33, 64, 100, 129, 200]) {
    const e0_ = abschnitt(W);
    const r = G.zonenplan(e0_, 'halle', ANTEILE);
    assert.equal(r.rueckfrage, null, `Breite ${W}`);
    const zonen = r.entwurf.zonen;
    assert.deepEqual(zonen.map((z) => z.id), ['Z-halle-technik', 'Z-halle-handel', 'Z-halle-optik']);
    assert.equal(zonen[0].von.x, -10);
    for (let i = 0; i + 1 < zonen.length; i++) assert.equal(zonen[i].bis.x + 1, zonen[i + 1].von.x, `lückenlos bei Breite ${W}`);
    assert.equal(zonen.at(-1).bis.x, -10 + W - 1);
    for (const z of zonen) { assert.ok(z.bis.x >= z.von.x); assert.deepEqual([z.von.y, z.bis.y, z.von.z, z.bis.z], [-5, 20, -40, 40]); assert.equal(z.gesetztVon, 'grobdesigner'); }
    assert.deepEqual(zonen.slice(0, 2).map((z) => z.bis.x - z.von.x + 1), [Math.floor(W * 0.5), Math.floor(W * 0.3)], 'der Rest geht an den letzten Streifen');
  }
  // zu schmal: nichts gesetzt, der Bauleiter fragt Jonah
  const schmal = G.zonenplan(abschnitt(3), 'halle', ANTEILE);
  assert.deepEqual(schmal.zonen, []);
  assert.equal(schmal.entwurf.zonen.length, 0);
  assert.match(schmal.rueckfrage.frage, /nur 3 Blöcke breit, das reicht nicht für 3 Zonen/);
  assert.ok(schmal.rueckfrage.optionen.length >= 3);

  // Ein neuer Plan ersetzt den alten (alte Zonen des Abschnitts verschwinden), deterministisch
  const a = G.zonenplan(abschnitt(60), 'halle', ANTEILE).entwurf;
  const b = G.zonenplan(a, 'halle', [{ funktion: 'verkehr', anteil: 40 }, { funktion: 'optik', anteil: 60 }]).entwurf;
  assert.deepEqual(b.zonen.map((z) => z.funktion).sort(), ['optik', 'verkehr']);
  assert.equal(entwurfZuJson(G.zonenplan(abschnitt(60), 'halle', ANTEILE).entwurf), entwurfZuJson(a));
  assert.ok(berichtAlsText(b).includes('Zone Z-halle-technik entfernt'));

  // Fehler der Eingabe
  const f = (anteile) => fehler(ZonenFehler, () => G.zonenplan(abschnitt(), 'halle', anteile));
  assert.match(f([]), /mindestens eine Funktion/);
  assert.match(f([{ funktion: 'technik', anteil: 90 }]), /nicht 100/);
  assert.match(f([{ funktion: 'keller', anteil: 100 }]), /unbekannt/);
  assert.match(f([{ funktion: 'technik', anteil: 50 }, { funktion: 'technik', anteil: 50 }]), /doppelt/);
  assert.match(f([{ funktion: 'technik', anteil: 0 }, { funktion: 'optik', anteil: 100 }]), /ganze Zahl ab 1/);
  assert.match(fehler(ZonenFehler, () => G.zonenplan(abschnitt(), 'zz', ANTEILE)), /gibt es nicht/);

  // Mindestmaß des Technikers: die Technikzone wird mindestens so breit wie die Module in einer Reihe
  const bedarf = [{ id: 'B1', abschnitt: 'halle', art: 'handelsnischen', anzahl: 24 }, { id: 'B2', abschnitt: 'halle', art: 'lager', sorten: SORTEN }];
  const mitBedarf = T.setzeBedarf(abschnitt(200), bedarf);
  const mind = T.plane(mitBedarf, 'halle').mindest;
  const plan = G.zonenplan(mitBedarf, 'halle', [{ funktion: 'technik', anteil: 30 }, { funktion: 'handel', anteil: 50 }, { funktion: 'optik', anteil: 20 }]);
  assert.equal(plan.rueckfrage, null);
  const breiten = plan.entwurf.zonen.map((z) => z.bis.x - z.von.x + 1);
  assert.equal(breiten[0], mind.breite, 'Technikzone genau auf dem Mindestmaß, weil 30 % (60) kleiner wären');
  assert.equal(breiten.reduce((s, x) => s + x, 0), 200);
  assert.deepEqual(breiten.slice(1), [Math.floor((200 - mind.breite) * 5 / 7), 200 - mind.breite - Math.floor((200 - mind.breite) * 5 / 7)]);
  assert.equal(T.setzeModule(plan.entwurf, 'halle').passt, true, 'die Module passen hinein');
  // genügt der Anteil schon, bleibt er wie er ist
  const breit = G.zonenplan(mitBedarf, 'halle', [{ funktion: 'technik', anteil: 80 }, { funktion: 'optik', anteil: 20 }]);
  assert.equal(breit.entwurf.zonen[0].bis.x - breit.entwurf.zonen[0].von.x + 1, 160);
  // zu schmale Hülle für Technik plus Rest, zu flache Hülle, Bedarf ohne Technikzone: Rückfrage statt Raten
  const eng = G.zonenplan(T.setzeBedarf(abschnitt(mind.breite + 1), bedarf), 'halle', [{ funktion: 'technik', anteil: 50 }, { funktion: 'handel', anteil: 30 }, { funktion: 'optik', anteil: 20 }]);
  assert.match(eng.rueckfrage.frage, /kein Platz für die anderen Zonen/);
  const flach = G.zonenplan(T.setzeBedarf(abschnitt(200, 'halle', 3), bedarf), 'halle', ANTEILE);
  assert.match(flach.rueckfrage.frage, /für die Technik zu klein/);
  const ohneTech = G.zonenplan(mitBedarf, 'halle', [{ funktion: 'optik', anteil: 100 }]);
  assert.match(ohneTech.rueckfrage.frage, /keine Technikzone vor/);

  // Löst den Einwand des Technikers (4c): Technikzone zu klein → derselbe Plan mit Mindestmaß
  let e = G.zonenplan(abschnitt(200), 'halle', [{ funktion: 'technik', anteil: 10 }, { funktion: 'optik', anteil: 90 }]).entwurf;
  e = T.setzeBedarf(e, bedarf);
  const ew = e3.einwaende.sammle(e).einwaende.filter((x) => x.regel === 'plan.bedarf');
  assert.deepEqual(ew.map((x) => [x.an, x.ziel]), [['grobdesigner', 'zone:Z-halle-technik']]);
  const gelöst = e3.laufe(e, { grobdesigner: (x, entwurf) => G.neuPlanenAenderungen(entwurf, x.abschnitt) });
  assert.deepEqual([gelöst.erledigt.length, gelöst.eskaliert.length, gelöst.runden], [1, 0, 1]);
  assert.equal(T.setzeModule(gelöst.entwurf, 'halle').passt, true);
  // Sind Module gesetzt, ist ein neuer Plan ein Rückgriff; ein Plan von Hand hat keine Anteile
  assert.match(fehler(ZonenFehler, () => G.zonenplan(T.setzeModule(gelöst.entwurf, 'halle').entwurf, 'halle', ANTEILE)), /Rückgriff/);
  const hand = aendere(abschnitt(), 'grobdesigner', { art: 'setze-zone', zone: { id: 'Z1', abschnitt: 'halle', funktion: 'technik', ...huelle(0, 0, 0, 5, 5, 5) } });
  assert.match(fehler(ZonenFehler, () => G.neuPlanenAenderungen(hand, 'halle')), /keinen Zonenplan des Grobdesigners/);

  // Rechte
  assert.equal(fehler(RechtFehler, () => e3.aendere(abschnitt(), 'grobdesigner', { art: 'setze-teil', teil: { abschnitt: 'halle', baustein: 'form.kuppel' } })).includes('gehört dem architekt'), true);
  assert.equal(fehler(RechtFehler, () => e3.aendere(abschnitt(), 'architekt', { art: 'setze-zone', zone: { id: 'Z', ...huelle(0, 0, 0, 1, 1, 1) } })).includes('gehört dem grobdesigner'), true);
  assert.equal(fehler(RechtFehler, () => e3.aendere(a, 'architekt', { art: 'entferne-zone', id: 'Z-halle-technik' })).includes('gehört dem grobdesigner'), true);
});

test('Architekt: Formen setzen und messen', () => {
  const ZYL = { breite: 5, tiefe: 5, hoehe: 6, wandstaerke: 1 };
  const plan = (breite = 100) => G.zonenplan(abschnitt(breite), 'halle', VIER).entwurf;
  const wunsch = (id, anker, extra = {}) => ({ id, abschnitt: 'halle', baustein: 'form.zylinder', parameter: ZYL, zone: 'optik', anker, ...extra });

  // Anker: die fünf Positionen in der Zone
  const optik = zone(plan(), 'optik');
  const alle = A.setzeFormwuensche(plan(), ['mitte', 'nordwest', 'nordost', 'suedwest', 'suedost'].map((a) => wunsch(`W-${a}`, a)));
  const gesetzt = A.setzeFormen(alle, 'halle');
  assert.equal(gesetzt.teile.length, 5);
  assert.deepEqual(gesetzt.offen, []);
  const ecke = (id) => { const t = gesetzt.entwurf.teile.find((x) => x.wunsch === id); return weltHuelle(gesetzt.entwurf, t).von; };
  const [zw, zt] = [optik.bis.x - optik.von.x + 1, optik.bis.z - optik.von.z + 1];
  assert.deepEqual(ecke('W-nordwest'), { x: optik.von.x, y: optik.von.y, z: optik.von.z });
  assert.deepEqual(ecke('W-nordost'), { x: optik.bis.x - 4, y: optik.von.y, z: optik.von.z });
  assert.deepEqual(ecke('W-suedwest'), { x: optik.von.x, y: optik.von.y, z: optik.bis.z - 4 });
  assert.deepEqual(ecke('W-suedost'), { x: optik.bis.x - 4, y: optik.von.y, z: optik.bis.z - 4 });
  assert.deepEqual(ecke('W-mitte'), { x: optik.von.x + Math.floor((zw - 5) / 2), y: optik.von.y, z: optik.von.z + Math.floor((zt - 5) / 2) });
  assert.ok(gesetzt.entwurf.teile.every((t) => t.art === 'form' && t.gesetztVon === 'architekt'));
  keinEinwand(gesetzt.entwurf);
  assert.equal(entwurfZuJson(A.setzeFormen(alle, 'halle').entwurf), entwurfZuJson(gesetzt.entwurf), 'deterministisch');
  assert.deepEqual(A.setzeFormen(gesetzt.entwurf, 'halle').teile, [], 'nichts doppelt');

  // Gleicher Anker zweimal: das zweite Teil rückt zur nächsten freien Stelle (erst in +x), nichts überschneidet sich
  const zwei = A.setzeFormen(A.setzeFormwuensche(plan(), [wunsch('A', 'nordwest'), wunsch('B', 'nordwest'), wunsch('C', 'nordost'), wunsch('D', 'nordost')]), 'halle').entwurf;
  const [ha, hb, hc, hd] = zwei.teile.map((t) => weltHuelle(zwei, t));
  assert.deepEqual([hb.von.x - ha.von.x, hb.von.z - ha.von.z], [5, 0]);
  assert.deepEqual([hc.von.x - hd.von.x, hd.von.z - hc.von.z], [5, 0], 'vom Osten her nach innen');
  keinEinwand(zwei);

  // um die Technik herum: Wunsch in der Technikzone, Module stehen schon dort
  let t = G.zonenplan(T.setzeBedarf(abschnitt(100), [{ id: 'B1', abschnitt: 'halle', art: 'handelsnischen', anzahl: 3 }]), 'halle', VIER).entwurf;
  t = T.setzeModule(t, 'halle').entwurf;
  t = A.setzeFormen(A.setzeFormwuensche(t, [wunsch('Z', 'nordwest', { zone: 'technik' })]), 'halle').entwurf;
  const modul = weltHuelle(t, t.teile[0]), form = weltHuelle(t, t.teile[1]);
  assert.ok(form.von.x > modul.bis.x || form.von.z > modul.bis.z || form.von.y > modul.bis.y, 'nicht in der Technik');
  keinEinwand(t);

  // Kein Platz: Einwand an den Grobdesigner mit Platzbedarf; der Grobdesigner vergrößert die Zone; dann passt es
  const groß = A.setzeFormwuensche(plan(40), [wunsch('G', 'mitte', { parameter: { ...ZYL, breite: 30, tiefe: 30 } })]);
  assert.deepEqual(A.setzeFormen(groß, 'halle').offen, ['G']);
  const ew = e3.einwaende.sammle(groß).einwaende.filter((x) => x.regel === 'plan.formen');
  assert.deepEqual(ew.map((x) => [x.von, x.an, x.ziel]), [['architekt', 'grobdesigner', 'zone:Z-halle-optik']]);
  assert.match(ew[0].text, /braucht 30 × 30 × 6 Blöcke, die Zone Z-halle-optik hat keinen freien Platz dafür/);
  const gelöst = e3.laufe(groß, { grobdesigner: (x, entwurf) => G.aenderungen(entwurf, 'halle', [{ funktion: 'optik', anteil: 100 }]).aenderungen });
  assert.deepEqual([gelöst.erledigt.length, gelöst.eskaliert.length], [1, 0]);
  assert.deepEqual(A.setzeFormen(gelöst.entwurf, 'halle').offen, []);
  // keine Zone dieser Funktion
  const keineZone = A.setzeFormwuensche(G.zonenplan(abschnitt(), 'halle', [{ funktion: 'technik', anteil: 100 }]).entwurf, [wunsch('V', 'mitte', { zone: 'verkehr' })]);
  assert.match(e3.einwaende.sammle(keineZone).einwaende.find((x) => x.regel === 'plan.formen').text, /hat aber keine Zone „verkehr“/);

  // Wünsche prüfen
  assert.equal(fehler(RechtFehler, () => A.setzeFormwuensche(plan(), [wunsch('X', 'mitte', { baustein: 'tech.sortierlager' })])).includes('keine Form und kein Bauelement'), true);
  assert.match(fehler(RechtFehler, () => A.setzeFormwuensche(plan(), [wunsch('X', 'mitte', { zone: 'keller' })])), /Zone „keller“ unbekannt/);
  assert.match(fehler(RechtFehler, () => A.setzeFormwuensche(plan(), [wunsch('X', 'oben')])), /Anker „oben“ unbekannt/);
  assert.match(fehler(FormFehler, () => A.setzeFormwuensche(plan(), [wunsch('X', 'mitte', { parameter: { breite: 0 } })])), /außerhalb/);
  assert.match(fehler(RechtFehler, () => e3.aendere(plan(), 'techniker', { art: 'setze-formwunsch', formwunsch: wunsch('X', 'mitte') })), /gehört dem architekt/);
  assert.match(fehler(FormFehler, () => A.setzeFormen(plan(), 'zz')), /gibt es nicht/);

  // Messung gegen die Vorlage: Formen sind symmetrisch und treffen ihre Proportion, für viele Größen
  for (let B = 3; B <= 41; B++) {
    for (const [baustein, p, soll] of [
      ['form.kuppel', { breite: B, tiefe: B }, { symmetrie: ['x', 'z'], verhaeltnis: { hoehe_zu_breite: 0.25 } }],
      ['form.zylinder', { breite: B, tiefe: B, hoehe: 9, wandstaerke: 1 }, { symmetrie: ['x', 'z'], verhaeltnis: { hoehe_zu_breite: 9 / B } }],
      ['form.kegel', { breite: B, tiefe: B, hoehe: 7 }, { symmetrie: ['x', 'z'] }],
    ]) {
      const w = wunsch('M', 'mitte', { baustein, parameter: p, soll });
      const s = A.setzeFormen(A.setzeFormwuensche(G.zonenplan(abschnitt(200), 'halle', VIER).entwurf, [w]), 'halle');
      const r = A.miss(s.entwurf, 'T1');
      assert.deepEqual(r.abweichungen, [], `${baustein} Breite ${B}`);
      assert.deepEqual(r.symmetrie, { x: true, z: true });
    }
  }
  // ein fehlender Block wird erkannt (Symmetrie), eine falsche Proportion auch
  const mess = A.setzeFormen(A.setzeFormwuensche(plan(), [wunsch('M', 'mitte', { soll: { symmetrie: ['x', 'z'], verhaeltnis: { hoehe_zu_breite: 1.2 } } })]), 'halle').entwurf;
  const mat = e3.materialisiere(mess, { testmaterial: true });
  assert.deepEqual(A.miss(mess, 'T1', mat).abweichungen, []);
  const kaputt = e3.materialisiere(mess, { testmaterial: true });
  kaputt.teile.get('T1').schluessel.delete([...kaputt.teile.get('T1').schluessel][0]);
  assert.match(A.miss(mess, 'T1', kaputt).abweichungen.join(), /nicht symmetrisch zur Mittelachse/);
  assert.match(fehler(FormFehler, () => A.miss(mess, 'T9')), /gibt es nicht/);
  // falsche Proportion → Einwand an den Architekten mit Ist und Soll; der Rückruf ändert den Parameter
  const schief = A.setzeFormen(A.setzeFormwuensche(plan(), [wunsch('M', 'mitte', { soll: { verhaeltnis: { hoehe_zu_breite: 2 } } })]), 'halle').entwurf;
  const ew2 = e3.einwaende.sammle(schief).einwaende.filter((x) => x.regel === 'plan.mass');
  assert.deepEqual(ew2.map((x) => [x.von, x.an, x.ziel]), [['bauleiter', 'architekt', 'teil:T1']]);
  assert.match(ew2[0].text, /Höhe 6 bei Breite 5 \(Verhältnis 1\.20\), gefordert 2 × Breite = 10\.0 ± 0\.5 Blöcke/);
  const ok = e3.laufe(schief, { architekt: () => ({ art: 'aendere-teil', id: 'T1', felder: { parameter: { hoehe: 10 } } }) });
  assert.deepEqual([ok.erledigt.length, ok.eskaliert.length], [1, 0]);
  assert.equal(ok.entwurf.teile[0].parameter.hoehe, 10);
  // Toleranz aus dem Wunsch
  const locker = A.setzeFormen(A.setzeFormwuensche(plan(), [wunsch('M', 'mitte', { soll: { verhaeltnis: { hoehe_zu_breite: 2, toleranz: 4 } } })]), 'halle').entwurf;
  assert.deepEqual(A.miss(locker, 'T1').abweichungen, []);
  assert.match(fehler(FormFehler, () => A.miss(A.setzeFormen(A.setzeFormwuensche(plan(), [wunsch('M', 'mitte', { soll: { symmetrie: ['y'] } })]), 'halle').entwurf, 'T1')), /Symmetrieachse „y“ unbekannt/);
});

test('Designer: Paletten und Stimmungen', () => {
  const grund = () => K.gliedere(neuerEntwurf({ name: 'Probe' }), [
    { id: 'A', name: 'A', huelle: huelle(0, 0, 0, 50, 20, 50) }, { id: 'B', name: 'B', huelle: huelle(100, 0, 0, 150, 20, 50) }]);
  const namen = D.stimmungen();
  assert.deepEqual(namen, ['glanz', 'dunkel-industriell', 'hell-nordisch']);

  // Jede Stimmung ist vollständig, gültig und baut ALLE Bausteine aus Ebene 2; es entstehen nur registrierte Blöcke, nie ein Arbeitsblock (Technik ausgenommen)
  for (const name of namen) {
    const palette = e3.paletten.stimmung(name);
    assert.ok(e3.paletten.vollstaendig(palette), name);
    assert.doesNotThrow(() => e3.paletten.pruefe(palette), name);
    for (const [id] of e2.bausteine) {
      const paket = e2.baue(id, {});
      const welt = e0.neueWelt();
      e2.platziere(welt, paket, { ...palette }, { x: 0, y: 0, z: 0 });
      assert.doesNotThrow(() => e0.vermesser.drehe(welt.ausschnitt({ x: -600, y: -64, z: -600 }, { x: 600, y: 319, z: 600 }), 1), `${name}/${id}: lässt sich drehen`);
      for (const b of paket.bloecke) {
        const gesetzt = welt.leseBlock(b.x, b.y, b.z);
        assert.ok(e0.register.bloecke.hat(gesetzt.id), `${name}/${id}: ${gesetzt.id}`);
        if (b.technik === true) assert.equal(gesetzt.id, b.id, `${name}/${id}: Technikblock bleibt`);
        else assert.notEqual(e0.register.bloecke.block(gesetzt.id).eigenschaften.arbeitsblock, true, `${name}/${id}: kein Arbeitsblock als Material`);
      }
    }
  }

  // Gesamtpalette und Abschnittspalette; der Abschnitt geht vor, andere Abschnitte und Technik bleiben unberührt
  let e = D.setzePalette(grund(), 'glanz');
  e = D.setzeAbschnittspalette(e, 'A', 'dunkel-industriell');
  e = aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'A', baustein: 'form.zylinder', parameter: { breite: 5, tiefe: 5, hoehe: 4, wandstaerke: 1 }, lage: { x: 10, y: 0, z: 10, drehung: 0 } } });
  e = aendere(e, 'architekt', { art: 'setze-teil', teil: { abschnitt: 'B', baustein: 'form.zylinder', parameter: { breite: 5, tiefe: 5, hoehe: 4, wandstaerke: 1 }, lage: { x: 110, y: 0, z: 10, drehung: 0 } } });
  const welt = e3.materialisiere(e).welt;
  const wand = (x, y, z) => welt.leseBlock(x, y, z).id;
  const hA = weltHuelle(e, e.teile[0]), hB = weltHuelle(e, e.teile[1]);
  assert.equal(wand(hA.von.x + 2, hA.von.y, hA.von.z), 'minecraft:polished_blackstone', 'Abschnittspalette A');
  assert.equal(wand(hB.von.x + 2, hB.von.y, hB.von.z), 'minecraft:quartz_block', 'Gesamtpalette in B');
  assert.deepEqual(Object.keys(e.paletten), ['A']);
  assert.deepEqual(Object.keys(e.palette).sort(), ['akzent', 'boden', 'glas', 'licht', 'wand']);
  // Technikblöcke ändert keine Palette
  const nisch = (name) => {
    let x = D.setzePalette(grund(), name);
    x = aendere(x, 'techniker', { art: 'setze-teil', teil: { abschnitt: 'A', baustein: 'tech.antriebsstrecke', parameter: { abschnitte: 2, abstand: 3 }, lage: { x: 10, y: 5, z: 40, drehung: 0 } } });
    const w = e3.materialisiere(x).welt;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => w.leseBlock(10, 5, 40 - i).id);
  };
  assert.deepEqual(nisch('glanz'), nisch('dunkel-industriell'));

  // Verbotenes wird abgelehnt (Prüfung in fachleute.aendere, also für jeden Aufrufer)
  const setze = (palette) => () => e3.aendere(grund(), 'designer', { art: 'setze-palette', palette });
  assert.match(fehler(RechtFehler, setze({ wand: 'minecraft:lectern' })), /Arbeitsblock und als Material verboten/);
  assert.match(fehler(RechtFehler, setze({ akzent: { voll: 'minecraft:smoker' } })), /Arbeitsblock/);
  assert.match(fehler(RechtFehler, setze({ wand: 'minecraft:gibtsnicht' })), /steht nicht im Blockregister/);
  assert.match(fehler(RechtFehler, setze({ akzent: { treppe: 'minecraft:stone' } })), /passt nicht zur Form „treppe“/);
  assert.match(fehler(RechtFehler, setze({ akzent: { tuer: 'minecraft:oak_planks' } })), /passt nicht zur Form „tuer“/);
  assert.match(fehler(RechtFehler, setze({ glas: { scheibe: 'minecraft:glass' } })), /passt nicht zur Form „scheibe“/);
  assert.match(fehler(RechtFehler, setze({ licht: 'minecraft:stone' })), /leuchtet nicht/);
  assert.match(fehler(RechtFehler, setze({ wand: 'minecraft:quartz_block' })), /lässt sich nicht drehen/);
  assert.doesNotThrow(setze({ wand: { id: 'minecraft:quartz_block', zustand: { pillar_axis: 'y' } } }));
  assert.match(fehler(RechtFehler, setze({ dach: 'minecraft:stone' })), /Rolle „dach“ unbekannt/);
  assert.match(fehler(RechtFehler, setze({ wand: { kuppel: 'minecraft:stone' } })), /Form „kuppel“ unbekannt/);
  assert.match(fehler(RechtFehler, () => e3.aendere(grund(), 'designer', { art: 'setze-abschnittspalette', abschnitt: 'A', palette: { wand: 'minecraft:lectern' } })), /Arbeitsblock/);
  assert.match(fehler(RechtFehler, () => e3.aendere(grund(), 'designer', { art: 'setze-abschnittspalette', abschnitt: 'Z', palette: { wand: 'minecraft:stone' } })), /existiert nicht/);
  assert.doesNotThrow(setze({ wand: 'minecraft:stone_bricks', akzent: { treppe: 'minecraft:stone_brick_stairs' } }), 'eine Teilpalette ist erlaubt');
  assert.match(fehler(GestaltungsFehler, () => D.setzePalette(grund(), 'neon')), /Stimmung „neon“ gibt es nicht/);

  // Rechte: nur der Designer
  for (const wer of ['architekt', 'techniker', 'konstrukteur', 'grobdesigner']) {
    assert.match(fehler(RechtFehler, () => e3.aendere(grund(), wer, { art: 'setze-abschnittspalette', abschnitt: 'A', palette: { wand: 'minecraft:stone' } })), /gehört dem designer/, wer);
    assert.match(fehler(RechtFehler, () => e3.aendere(grund(), wer, { art: 'setze-palette', palette: { wand: 'minecraft:stone' } })), /gehört dem designer/, wer);
  }
  // alte Entwürfe ohne paletten laden weiter, deterministisch
  const alt = JSON.parse(entwurfZuJson(grund()));
  delete alt.paletten; delete alt.formwuensche;
  assert.doesNotThrow(() => entwurfZuJson(alt));
  assert.equal(entwurfZuJson(D.setzePalette(grund(), 'glanz')), entwurfZuJson(D.setzePalette(grund(), 'glanz')));
});
