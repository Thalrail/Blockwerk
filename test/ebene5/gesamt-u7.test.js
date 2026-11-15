// U7: Gesamttests der Oberfläche zum Bearbeiten – Haus mit Änderungen über beide Wege (Spezifikation und Einzelblockänderungen) bis zu den Umbauhinweisen, und ein Mehrspieler-Szenario,
// in dem alle Spieler mit derselben Fassung denselben Plan haben. Zusammen mit dem Zitadelle-Prüfstein (npm run test:pruefstein) und dem Browser-Durchlauf (docs/referenz/stand-ebene5.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';
import * as B from '../../src/ebene5/bearbeiten.js';
import * as L from '../../src/ebene5/loesen.js';
import * as Stil from '../../src/ebene5/stil.js';
import * as T from '../../src/ebene5/teile.js';
import * as Umbau from '../../src/ebene5/umbau.js';
import * as G from '../../src/ebene5/grenzen.js';
import * as VL from '../../src/ebene5/verlauf.js';
import { live as LV, fortschritt as F } from '../../src/ebene5/index.js';

const fnv = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const haus = () => hausSpezifikation(VARIANTEN.klein, { treppe: 1, tuerInWand: 1, fensterTeil: 1 });
const op = (teil, x, y, z, neu, erwartet = null) => ({ teil, zelle: { x, y, z }, erwartet, neu });
const bauen = (e, spec, pf = null) => { const r = bauePlan(e, spec.freigabe ? spec : e.ebene4.freigeben(spec, 'test'), [], pf && Object.keys(pf.eintraege).length ? pf : null); return { ...r, plan: r.entwurf ? e.e5.bauplan(r.entwurf) : null }; };
const abdruck = (plan) => fnv(JSON.stringify(plan));
const alleHaken = (plan, von = 'Jonah') => F.haken(F.leer(), plan.abschnitte.flatMap((a) => a.schichten.map((s) => F.schluessel(a.id, s))), true, von);

test('Haus mit Änderungen, beide Wege in einem Ablauf: Einzelblockänderung → Stilwechsel → Teilgröße; jede Fassung hat ihre Umbauhinweise, die Änderung bleibt am Teil, der Verlauf stimmt', async () => {
  const e = await engine();
  const info = T.teileInfo(e.ebene4.vokabular), stilInfo = Stil.stilInfo({ paletten: e.ebene3.paletten, vokabular: e.ebene4.vokabular });
  let spec = e.ebene4.freigeben(haus(), 'Anna');
  let pf = PF.leer();
  const p0 = bauen(e, spec);
  assert.equal(p0.status, 'fertig');
  let fortschritt = alleHaken(p0.plan);
  let verlauf = [];
  // Weg A: eine Einzelblockänderung (Glas statt Wand) – wie die Zellenwahl sie erzeugt
  const wand = [...p0.plan.abschnitte[0].schichten[1].x].map((x, i) => ({ x, y: p0.plan.abschnitte[0].schichten[1].y, z: p0.plan.abschnitte[0].schichten[1].z[i] }))[0];
  const wahl = e.ebene3.zellenwahl.waehle(p0.entwurf, wand);
  const auswahl = B.auswahlAus(wahl, pf);
  const r1 = B.anwenden(pf, B.operation(e.ebene0, auswahl, 'aendern', { id: 'minecraft:glass' }), 'Anna');
  assert.equal(r1.konflikt, null);
  const p1 = bauen(e, spec, r1.planfassung);
  const h1 = Umbau.hinweise(p0.plan, p1.plan, fortschritt);
  assert.equal(h1.noetig, true, 'die gebaute Schicht ändert sich');
  assert.equal(h1.summe.ersetzen, 1);
  verlauf = VL.anhaengen(verlauf, { art: 'aenderungen', von: pf.version, nach: r1.planfassung.version, text: VL.aenderungenText(pf, r1.planfassung), wer: 'Anna' });
  pf = r1.planfassung;
  fortschritt = Umbau.offeneSchichten(fortschritt, p1.plan, h1, 'Anna');
  assert.equal(L.aenderungsPanel(p1.plan).wirkt.length, 1);
  // Weg B: Stil (Spezifikation) – die Änderung am Teil bleibt, nur die Wand wird anderes Material
  const stilNeu = Stil.setzeMaterial(Stil.setzeStimmung(spec, 'projekt', 'hell-nordisch', stilInfo.stimmungen), 'projekt', 'wand', 'voll', { id: 'minecraft:stone_bricks' }, stilInfo);
  const specB = e.ebene4.freigeben(e.ebene4.neueVersion(stilNeu), 'Anna');
  assert.equal(specB.version, spec.version + 1);
  assert.equal(e.ebene4.pruefe(specB).rueckfragen.length, 0);
  const p2 = bauen(e, specB, pf);
  assert.equal(p2.status, 'fertig');
  const h2 = Umbau.hinweise(p1.plan, p2.plan, fortschritt);
  assert.equal(h2.noetig, true, 'die gebaute Wand wird anderes Material');
  assert.ok(h2.summe.ersetzen > 0 && h2.summe.entfernen === 0);
  assert.equal(L.aenderungsPanel(p2.plan).wirkt.length, 1, 'die Einzelblockänderung wirkt weiter, an derselben Zelle');
  assert.deepEqual(L.aenderungsPanel(p2.plan).wirkt[0].zelle, L.aenderungsPanel(p1.plan).wirkt[0].zelle);
  verlauf = VL.anhaengen(verlauf, { art: 'spezifikation', von: spec.version, nach: specB.version, text: VL.vergleichText(e.ebene4.vergleiche(spec, specB)), wer: 'Anna' });
  spec = specB;
  // Weg B2: Dachneigung ändern (anderer Teil): die Änderung am Erdgeschoss bleibt gültig → Vorschau meldet keine Folgen
  const spec3 = e.ebene4.freigeben(e.ebene4.neueVersion(T.setzeParameter(spec, 'dach', 'neigung', 0.5, info)), 'Anna');
  const v3 = T.vorschau(e, { spezifikation: spec3, aenderungen: pf, planVorher: p2.plan });
  assert.deepEqual([v3.rueckfragen, v3.folgen], [[], []]);
  const p3 = bauen(e, spec3, pf);
  assert.equal(p3.status, 'fertig');
  assert.notEqual(p3.plan.bloecke, p2.plan.bloecke, 'das flachere Dach braucht andere Blöcke');
  assert.equal(L.aenderungsPanel(p3.plan).wirkt.length, 1);
  verlauf = VL.anhaengen(verlauf, { art: 'spezifikation', von: spec.version, nach: spec3.version, text: VL.vergleichText(e.ebene4.vergleiche(spec, spec3)), wer: 'Anna' });
  // Weg B3: ein Teil mit Einzelblockänderung wird entfernt: die Vorschau nennt vorab, dass die Änderung verwaist; nach dem Zulassen baut der Plan ohne zu warten
  const dachZelle = (() => { const ab = p3.plan.abschnitte.find((x) => x.id === 'dach'); const sch = ab.schichten[0]; return e.ebene3.zellenwahl.waehle(p3.entwurf, { x: sch.x[0], y: sch.y, z: sch.z[0] }).gewaehlt; })();
  assert.equal(dachZelle.teil, 'dach');
  const pfDach = PF.wende(pf, [op('dach', dachZelle.zelle.x, dachZelle.zelle.y, dachZelle.zelle.z, { op: 'leere' })], 'Anna').planfassung;
  const ohneDach = e.ebene4.freigeben(e.ebene4.neueVersion(T.entferneTeil(spec3, 'dach', info.kindrelationen).spec), 'Anna');
  const v4 = T.vorschau(e, { spezifikation: ohneDach, aenderungen: pfDach, planVorher: bauen(e, spec3, pfDach).plan });
  assert.deepEqual(v4.rueckfragen, []);
  assert.equal(v4.folgen.length, 1);
  assert.match(v4.folgen[0].text, /von „dach“\) wird verwaist: das Teil gibt es nicht mehr/);
  const p4 = bauen(e, ohneDach, pfDach);
  assert.equal(p4.status, 'wartet');
  const schl = PF.schluessel('dach', dachZelle.zelle);
  const pf4 = PF.wende(pfDach, [L.opZulassen(pfDach, schl)], 'Anna').planfassung;
  const p5 = bauen(e, ohneDach, pf4);
  assert.equal(p5.status, 'fertig', 'zugelassen: der Plan wartet nicht');
  assert.equal(L.aenderungsPanel(p5.plan).zugelassen.length, 1);
  assert.equal(p5.plan.abschnitte.some((x) => x.id === 'dach'), false);
  // Verlauf: zwei Wege, drei Übergänge, neueste oben
  assert.deepEqual(verlauf.map((x) => [x.art, x.von, x.nach]), [['aenderungen', 0, 1], ['spezifikation', 1, 2], ['spezifikation', 2, 3]]);
  const zeilen = VL.berichtZeilen(verlauf, { spezifikation: spec3.version, aenderungen: pf.version });
  assert.match(zeilen[1], /^Spezifikation: Fassung 2 → Fassung 3 \(Anna\): 1 Teil geändert \(dach\)/);
  assert.match(zeilen[3], /^Änderungen: Fassung 0 → Fassung 1 \(Anna\): Einzelblockänderungen: 1 neu/);
  // Grenzen des Ergebnisses
  assert.equal(G.grenzenAnsicht({ spezifikation: spec3, planfassung: pf, fortschritt, spieler: 1 }).stufe, 'ok');
});

test('Mehrspieler: nach Änderung, Konflikt, Zulassung und Neu verankern (Gruppe) haben alle Spieler dieselbe Planfassung und damit denselben Plan und dieselben Grenzen', async () => {
  const e = await engine();
  class Dienst {
    constructor() { this.raum = LV.neuerRaum(); this.v = new Map(); this.n = 0; }
    verbinde() { const c = { id: `v${++this.n}`, post: [] }; this.v.set(c.id, c); return c; }
    empfange(c, text) { const r = LV.verarbeite(this.raum, LV.liesNachricht(text), c.id); this.raum = r.raum; for (const z of LV.zustellungen(r.raum, r.senden, c.id)) this.v.get(z.an)?.post.push(JSON.parse(JSON.stringify(z.nachricht))); }
  }
  const d = new Dienst();
  const sp = (name) => {
    const k = LV.erzeugeKlient({ name, fortschritt: F.leer() }), c = d.verbinde();
    const s = { name, k, meld: [], sende(ms) { for (const m of ms) d.empfange(c, JSON.stringify(m)); }, pump() { while (c.post.length) { const r = k.beiNachricht(c.post.shift()); s.meld.push(...r.meldungen); s.sende(r.senden); } } };
    s.sende(k.verbunden());
    return s;
  };
  const spieler = ['Anna', 'Ben', 'Cem'].map(sp);
  const [anna, ben, cem] = spieler;
  const alle = () => { for (let i = 0; i < 3; i++) for (const s of spieler) s.pump(); };
  alle();
  const spec = e.ebene4.freigeben(haus(), 'Anna');
  const basis = bauen(e, spec);
  const wand = (i) => { const a = basis.plan.abschnitte[0].schichten[1]; return e.ebene3.zellenwahl.waehle(basis.entwurf, { x: a.x[i], y: a.y ?? basis.plan.abschnitte[0].schichten[1].y, z: a.z[i] }).gewaehlt; };
  const w1 = wand(0), w2 = wand(1), w3 = wand(2);
  // Anna ändert eine Zelle; Ben und Cem sehen sie
  anna.sende(anna.k.aendereOperation(op(w1.teil, w1.zelle.x, w1.zelle.y, w1.zelle.z, { op: 'setze', block: { id: 'minecraft:glass' } })));
  // Ben ändert dieselbe Zelle, bevor Annas Änderung bei ihm angekommen ist (er hat sie noch nicht gesehen: erwartet null) → Konflikt, nichts überschrieben
  ben.meld.length = 0;
  ben.sende(ben.k.aendereOperation(op(w1.teil, w1.zelle.x, w1.zelle.y, w1.zelle.z, { op: 'setze', block: { id: 'minecraft:stone' } })));
  alle();
  assert.ok(ben.meld.some((m) => m.art === 'aenderung-konflikt'));
  assert.equal(d.raum.aenderungen.eintraege[PF.schluessel(w1.teil, w1.zelle)].block.id, 'minecraft:glass');
  // Cem fügt eine verwaiste hinzu, Anna lässt sie zu, Ben verankert eine eigene neu (Gruppe)
  cem.sende(cem.k.aendereOperation(op('gibtsnicht', 1, 1, 1, { op: 'leere' })));
  anna.sende(anna.k.aendereOperation(op(w2.teil, w2.zelle.x, w2.zelle.y, w2.zelle.z, { op: 'leere' })));
  alle();
  anna.sende(anna.k.aendereOperation(L.opZulassen(anna.k.zustand.aenderungen, 'gibtsnicht|1,1,1')));
  alle();
  const quelle = anna.k.zustand.aenderungen.eintraege[PF.schluessel(w2.teil, w2.zelle)];
  const ops = L.opsVerankern(ben.k.zustand.aenderungen, PF.schluessel(w2.teil, w2.zelle), { teil: w3.teil, zelle: w3.zelle }, quelle);
  ben.sende(ben.k.aendereGruppe(ops));
  alle();
  // alle haben dasselbe
  const stand = d.raum.aenderungen;
  for (const s of spieler) assert.deepEqual(s.k.zustand.aenderungen, stand, `${s.name} hat den Stand des Raums`);
  assert.deepEqual(Object.keys(stand.eintraege).sort(), [PF.schluessel(w1.teil, w1.zelle), PF.schluessel(w3.teil, w3.zelle), 'gibtsnicht|1,1,1'].sort());
  assert.equal(stand.eintraege['gibtsnicht|1,1,1'].zugelassen, true);
  // jeder baut mit seiner Planfassung: derselbe Plan (Abdruck), dieselbe Änderungsliste, dieselben Grenzen
  const plaene = spieler.map((s) => bauen(e, spec, s.k.zustand.aenderungen));
  assert.ok(plaene.every((p) => p.status === 'fertig'), 'die zugelassene Änderung hält den Bau nicht an');
  assert.equal(new Set(plaene.map((p) => abdruck(p.plan))).size, 1, 'derselbe Plan bei allen Spielern');
  assert.equal(new Set(plaene.map((p) => JSON.stringify(L.aenderungsPanel(p.plan)))).size, 1, 'dieselbe Liste der Änderungen');
  const ohne = bauen(e, spec);
  assert.notEqual(abdruck(plaene[0].plan), abdruck(ohne.plan), 'die Änderungen wirken');
  assert.equal(new Set(spieler.map((s) => JSON.stringify(G.grenzenAnsicht({ spezifikation: spec, planfassung: s.k.zustand.aenderungen, spieler: 3 })))).size, 1);
  // der Verlauf zwischen zwei Ständen ist für alle derselbe Satz
  const satz = VL.aenderungenText(PF.leer(), stand);
  assert.match(satz, /^Einzelblockänderungen: 3 neu \(jetzt 3 Einträge\)$/);
});
