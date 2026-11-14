// U6: Verwaistes und Konflikte lösen – Planfassungsformat (zugelassen), Gruppe, Panel-Modell, Operationen, Konfliktansicht, Technik (src/ebene5/loesen.js), mit der echten Engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './hilfe5.js';
import { VARIANTEN, hausSpezifikation, laufe } from '../../tools/haus-sonde.js';
import { bauePlan } from '../../src/ebene5/bauen.js';
import * as PF from '../../src/ebene5/planfassung.js';
import * as B from '../../src/ebene5/bearbeiten.js';
import * as L from '../../src/ebene5/loesen.js';
import { live as LV, fortschritt as F } from '../../src/ebene5/index.js';
import { erzeugeBestaetigung } from '../../src/ebene3/bestaetigung.js';

const haus = () => hausSpezifikation(VARIANTEN.klein, {});
const op = (teil, x, y, z, neu, erwartet = null) => ({ teil, zelle: { x, y, z }, erwartet, neu });
const bauen = (e, pf = null) => { const r = bauePlan(e, e.ebene4.freigeben(haus(), 'test'), [], pf); return { ...r, plan: r.entwurf ? e.e5.bauplan(r.entwurf) : null }; };
const zellen = (plan) => { const m = new Map(); for (const a of plan.abschnitte) for (const s of a.schichten) for (let i = 0; i < s.n; i++) m.set(`${s.x[i]},${s.y},${s.z[i]}`, a.legende[s.b[i]].id); return m; };
const GLAS = { op: 'setze', block: { id: 'minecraft:glass' } };
/** Eine Planfassung mit zwei verwaisten Änderungen: ein Teil, das es nicht gibt, und eine Zelle weit außerhalb des Erdgeschosses. */
const verwaist = () => PF.wende(PF.leer(), [op('gibtsnicht', 1, 1, 1, { op: 'leere' }), op('erdgeschoss', 99, 1, 0, GLAS)], 'Jonah').planfassung;
/** Eine echte Zelle im Erdgeschoss (Wandschicht) als Ziel. */
const zielZelle = (e) => {
  const basis = bauen(e);
  const w = [...zellen(basis.plan)].map(([k]) => k.split(',').map(Number)).find(([, y]) => y === 1);
  return e.ebene3.zellenwahl.waehle(basis.entwurf, { x: w[0], y: 1, z: w[2] }).gewaehlt;
};

test('Format: zugelassen gehört zum Inhalt (wird verglichen, geteilt, streng geprüft), alles andere bleibt wie bisher', () => {
  assert.deepEqual(PF.pruefeInhalt({ op: 'leere', zugelassen: true }), { op: 'leere', zugelassen: true });
  assert.deepEqual(PF.pruefeInhalt({ op: 'setze', block: { id: 'minecraft:stone' }, zugelassen: true }), { op: 'setze', block: { id: 'minecraft:stone' }, zugelassen: true });
  assert.deepEqual(PF.pruefeInhalt({ op: 'leere', zugelassen: false }), { op: 'leere' }, 'falsch = nicht zugelassen');
  for (const schlecht of [1, 'ja', null, {}]) assert.throws(() => PF.pruefeInhalt({ op: 'leere', zugelassen: schlecht }), /zugelassen/);
  assert.equal(PF.gleichInhalt({ op: 'leere', zugelassen: true }, { op: 'leere' }), false, 'mit und ohne Zulassung ist verschieden');
  const a = PF.wende(PF.leer(), [op('t', 1, 2, 3, { op: 'leere' })], 'A').planfassung;
  const b = PF.wende(a, [op('t', 1, 2, 3, { op: 'leere', zugelassen: true }, { op: 'leere' })], 'B');
  assert.equal(b.planfassung.eintraege['t|1,2,3'].zugelassen, true);
  assert.deepEqual(b.zellen[0].aktuell, { op: 'leere', zugelassen: true, von: 'B' });
  assert.deepEqual(PF.pruefeForm(JSON.parse(JSON.stringify(b.planfassung))), b.planfassung, 'Speichern und Laden verlieren die Zulassung nicht');
  // Konflikt: wer die Zulassung nicht kennt, überschreibt sie nicht
  const k = PF.wende(b.planfassung, [op('t', 1, 2, 3, null, { op: 'leere' })], 'C');
  assert.equal(k.konflikte.length, 1);
  assert.equal(k.planfassung, b.planfassung);
});

test('Gruppe: alle Operationen ganz oder gar nicht; ohne Gruppe bleibt es je Operation', () => {
  const start = PF.wende(PF.leer(), [op('t', 1, 0, 0, { op: 'leere' })], 'A').planfassung;
  const gut = [op('t', 1, 0, 0, null, { op: 'leere' }), op('t', 2, 0, 0, { op: 'leere' })];
  const ok = PF.wende(start, gut, 'A', { gruppe: true });
  assert.deepEqual([ok.geaendert, ok.planfassung.version, Object.keys(ok.planfassung.eintraege)], [true, 2, ['t|2,0,0']], 'eine Versionserhöhung für die ganze Gruppe');
  assert.equal(ok.gruppeAbgelehnt, undefined);
  // die zweite Operation hat eine falsche Erwartung: nichts von der Gruppe gilt, auch die erste nicht (der alte Eintrag bleibt)
  const schlecht = [op('t', 1, 0, 0, null, { op: 'leere' }), op('t', 2, 0, 0, { op: 'leere' }, { op: 'leere' })];
  const abg = PF.wende(start, schlecht, 'A', { gruppe: true });
  assert.deepEqual([abg.geaendert, abg.gruppeAbgelehnt, abg.angenommen, abg.planfassung === start, abg.konflikte.length], [false, true, [], true, 1]);
  assert.deepEqual(abg.zellen.map((z) => [z.teil, z.zelle.x, z.aktuell !== null]), [['t', 1, true], ['t', 2, false]], 'die berührten Zellen zeigen den unveränderten Stand');
  // ohne Gruppe wird die erste angenommen (bisheriges Verhalten)
  const einzeln = PF.wende(start, schlecht, 'A');
  assert.deepEqual([einzeln.geaendert, Object.keys(einzeln.planfassung.eintraege)], [true, []]);
  assert.equal(einzeln.konflikte.length, 1);
});

test('Live: eine Gruppe gilt im Raum ganz oder gar nicht; die anderen bekommen sie in einer Nachricht', () => {
  class Dienst {
    constructor() { this.raum = LV.neuerRaum(); this.v = new Map(); this.n = 0; }
    verbinde() { const c = { id: `v${++this.n}`, post: [] }; this.v.set(c.id, c); return c; }
    empfange(c, text) { const r = LV.verarbeite(this.raum, LV.liesNachricht(text), c.id); this.raum = r.raum; for (const z of LV.zustellungen(r.raum, r.senden, c.id)) this.v.get(z.an)?.post.push(JSON.parse(JSON.stringify(z.nachricht))); }
  }
  const d = new Dienst();
  const sp = (name) => {
    const k = LV.erzeugeKlient({ name, fortschritt: F.leer() }), c = d.verbinde();
    const s = { k, c, meld: [], sende(ms) { for (const m of ms) d.empfange(c, JSON.stringify(m)); }, pump() { while (c.post.length) { const r = k.beiNachricht(c.post.shift()); s.meld.push(...r.meldungen); s.sende(r.senden); } } };
    s.sende(k.verbunden());
    return s;
  };
  const anna = sp('Anna'), ben = sp('Ben');
  anna.pump(); ben.pump();
  anna.sende(anna.k.aendereOperation(op('t', 1, 0, 0, { op: 'leere' })));
  anna.pump(); ben.pump();
  // Anna lässt den Eintrag zu; Ben verankert noch mit der alten Erwartung um (löschen + setzen): die Gruppe wird abgelehnt, nichts ändert sich
  anna.sende(anna.k.aendereOperation(op('t', 1, 0, 0, { op: 'leere', zugelassen: true }, { op: 'leere' })));
  anna.pump();
  ben.meld.length = 0;
  ben.sende(ben.k.aendereGruppe([op('t', 1, 0, 0, null, { op: 'leere' }), op('t', 5, 0, 0, { op: 'leere' })]));
  ben.pump(); anna.pump();
  assert.deepEqual(Object.keys(d.raum.aenderungen.eintraege), ['t|1,0,0'], 'der Raum bleibt unverändert');
  assert.equal(d.raum.aenderungen.eintraege['t|1,0,0'].zugelassen, true);
  assert.ok(ben.meld.some((m) => m.art === 'aenderung-konflikt' && m.konflikte.length === 1));
  assert.equal('t|5,0,0' in d.raum.aenderungen.eintraege, false);
  // mit der richtigen Erwartung geht es durch, als eine Version
  ben.pump(); anna.pump();
  const v0 = d.raum.aenderungen.version;
  ben.sende(ben.k.aendereGruppe([op('t', 1, 0, 0, null, { op: 'leere', zugelassen: true }), op('t', 5, 0, 0, { op: 'leere' })]));
  ben.pump(); anna.pump();
  assert.deepEqual([Object.keys(d.raum.aenderungen.eintraege), d.raum.aenderungen.version], [['t|5,0,0'], v0 + 1]);
  assert.deepEqual(anna.k.zustand.aenderungen.eintraege, ben.k.zustand.aenderungen.eintraege);
  assert.deepEqual(ben.k.zustand.aenderungen.eintraege, d.raum.aenderungen.eintraege);
  assert.throws(() => ben.k.aendereGruppe([{ teil: 't' }]));
});

test('Panel: jede Änderung steht in genau einer Gruppe mit Satz und passenden Aktionen (verwaist, wirkt)', async () => {
  const e = await engine();
  const w = zielZelle(e);
  const pf = PF.wende(verwaist(), [op(w.teil, w.zelle.x, w.zelle.y, w.zelle.z, GLAS)], 'Jonah').planfassung;
  const r = bauen(e, pf);
  assert.equal(r.status, 'wartet', 'der Plan ist vollständig, wartet aber auf Entscheidungen');
  const p = L.aenderungsPanel(r.plan);
  assert.deepEqual([p.anzahl, p.offen.length, p.wirkt.length, p.zugelassen.length, p.ueberholt.length], [3, 2, 1, 0, 0]);
  assert.ok(p.offen.every((x) => x.aktionen.join() === 'verwerfen,verankern,zulassen'));
  assert.deepEqual(p.wirkt[0].aktionen, ['verwerfen']);
  const teilFehlt = p.offen.find((x) => x.teil === 'gibtsnicht'), ausserhalb = p.offen.find((x) => x.zelle.x === 99);
  assert.match(teilFehlt.grund, /Verwaist: das Teil gibt es nicht mehr\./);
  assert.match(ausserhalb.grund, /Verwaist: die Zelle liegt nicht mehr im Teil/);
  assert.match(teilFehlt.text, /Block entfernt an Zelle 1, 1, 1 von „gibtsnicht“ \(von Jonah\)/);
  assert.match(ausserhalb.text, /Block gesetzt: glass an Zelle 99, 1, 0/);
  assert.equal(p.wirkt[0].grund, '');
  assert.deepEqual(L.aenderungsPanel(null), { offen: [], zugelassen: [], ueberholt: [], wirkt: [], anzahl: 0 });
  // Sätze zu den übrigen Zuständen
  assert.match(L.grundText({ status: 'konflikt', grund: 'fremder-block', mit: 'treppe' }), /Konflikt: dort steht ein Block eines anderen Teils \(treppe\)\./);
  assert.match(L.grundText({ status: 'ungueltig', grund: 'kaputt' }), /nicht möglich: kaputt/);
  assert.match(L.grundText({ status: 'ueberholt' }), /Einbauteil/);
  assert.equal(L.aenderungsPanel({ aenderungen: [{ id: 'C1', teil: 't', zelle: { x: 0, y: 0, z: 0 }, op: 'leere', status: 'ueberholt' }] }).ueberholt[0].aktionen.join(), 'verwerfen,verankern');
});

test('Zulassen: der Bau geht ohne die Änderung weiter (kein Warten mehr), sie bleibt gespeichert und sichtbar, die Zulassung lässt sich zurücknehmen; der Plan ist derselbe wie ohne die Änderung', async () => {
  const e = await engine();
  const pf0 = verwaist();
  const schl = 'erdgeschoss|99,1,0';
  const z = PF.wende(pf0, [L.opZulassen(pf0, schl)], 'Jonah');
  assert.equal(z.konflikte.length, 0);
  assert.equal(z.planfassung.eintraege[schl].zugelassen, true);
  const ohne = bauen(e), mit = bauen(e, PF.wende(z.planfassung, [L.opZulassen(z.planfassung, 'gibtsnicht|1,1,1')], 'Jonah').planfassung);
  assert.equal(mit.status, 'fertig', 'nichts wartet mehr');
  assert.deepEqual([...zellen(mit.plan)], [...zellen(ohne.plan)], 'dieselben Blöcke wie ganz ohne die Änderungen');
  const p = L.aenderungsPanel(mit.plan);
  assert.deepEqual([p.offen.length, p.zugelassen.length], [0, 2]);
  assert.ok(p.zugelassen.every((x) => x.zugelassen && x.aktionen.join() === 'zulassung-zurueck,verwerfen,verankern' && x.status === 'verwaist'), JSON.stringify(p.zugelassen.map((x) => x.status)));
  // Zulassung zurücknehmen: es wartet wieder
  const pf2 = PF.wende(z.planfassung, [L.opZulassen(z.planfassung, schl, false)], 'Jonah').planfassung;
  assert.equal('zugelassen' in pf2.eintraege[schl], false);
  assert.equal(bauen(e, pf2).status, 'wartet');
  assert.throws(() => L.opZulassen(PF.leer(), 'x|1,1,1'), /nicht mehr/);
});

test('Verwerfen: der Eintrag ist weg; stimmt die Erwartung nicht mehr (jemand anders hat zugelassen), ist es ein Konflikt und nichts wird überschrieben', async () => {
  const e = await engine();
  const pf = verwaist();
  const v = PF.wende(pf, [L.opVerwerfen(pf, 'gibtsnicht|1,1,1')], 'Jonah');
  assert.deepEqual(Object.keys(v.planfassung.eintraege), ['erdgeschoss|99,1,0']);
  assert.equal(L.aenderungsPanel(bauen(e, v.planfassung).plan).offen.length, 1);
  const op1 = L.opVerwerfen(pf, 'gibtsnicht|1,1,1');
  const andere = PF.wende(pf, [L.opZulassen(pf, 'gibtsnicht|1,1,1')], 'Anna').planfassung;
  const k = L.anwendenOps(andere, [op1], 'Jonah');
  assert.deepEqual([k.geaendert, k.konflikte.length, k.planfassung === andere], [false, 1, true]);
});

test('Neu verankern (Gruppe): die Änderung geht an eine gültige Zelle und wirkt dort; Ziel besetzt, dieselbe Zelle und veraltete Erwartung werden abgelehnt, nichts bleibt halb', async () => {
  const e = await engine();
  const ziel = zielZelle(e);
  assert.ok(ziel);
  const pf = verwaist();
  const ops = L.opsVerankern(pf, 'erdgeschoss|99,1,0', { teil: ziel.teil, zelle: ziel.zelle });
  assert.deepEqual(ops.map((o) => [o.erwartet === null, o.neu === null]), [[false, true], [true, false]]);
  const r = L.anwendenOps(pf, ops, 'Jonah', { gruppe: true });
  assert.equal(r.geaendert, true);
  assert.equal('erdgeschoss|99,1,0' in r.planfassung.eintraege, false);
  const p = L.aenderungsPanel(bauen(e, r.planfassung).plan);
  assert.equal(p.wirkt.length, 1, 'die verankerte Änderung wirkt jetzt');
  assert.deepEqual(p.wirkt[0].zelle, ziel.zelle);
  // Fehlerfälle
  assert.throws(() => L.opsVerankern(pf, 'erdgeschoss|99,1,0', { teil: 'erdgeschoss', zelle: { x: 99, y: 1, z: 0 } }), /dieselbe Zelle/);
  assert.throws(() => L.opsVerankern(pf, 'erdgeschoss|99,1,0', { teil: 'gibtsnicht', zelle: { x: 1, y: 1, z: 1 } }), /schon eine Änderung/);
  assert.throws(() => L.opsVerankern(pf, 'erdgeschoss|99,1,0', {}), /Ziel braucht/);
  assert.throws(() => L.opsVerankern(pf, 'x|0,0,0', { teil: 'erdgeschoss', zelle: { x: 1, y: 1, z: 1 } }), /nicht mehr/);
  // eine Zulassung gilt am neuen Ort nicht mehr (er wird neu bewertet)
  const zug = PF.wende(pf, [L.opZulassen(pf, 'erdgeschoss|99,1,0')], 'Jonah').planfassung;
  const nachZug = L.anwendenOps(zug, L.opsVerankern(zug, 'erdgeschoss|99,1,0', { teil: ziel.teil, zelle: ziel.zelle }), 'Jonah', { gruppe: true }).planfassung;
  assert.equal(Object.values(nachZug.eintraege).some((x) => x.zugelassen === true && x.teil === ziel.teil), false);
  // veraltete Erwartung: jemand hat den alten Eintrag inzwischen verändert, die Gruppe wird ganz abgelehnt
  const veraltet = PF.wende(pf, [op('erdgeschoss', 99, 1, 0, { op: 'leere' }, GLAS)], 'Anna').planfassung;
  const abg = L.anwendenOps(veraltet, ops, 'Jonah', { gruppe: true });
  assert.deepEqual([abg.geaendert, abg.konflikte.length, abg.planfassung === veraltet], [false, 1, true]);
  // ein Eintrag am Ziel verhindert das Verankern (nichts wird verdrängt)
  const belegt = PF.wende(pf, [op(ziel.teil, ziel.zelle.x, ziel.zelle.y, ziel.zelle.z, { op: 'leere' })], 'Jonah').planfassung;
  assert.throws(() => L.opsVerankern(belegt, 'erdgeschoss|99,1,0', { teil: ziel.teil, zelle: ziel.zelle }), /schon eine Änderung/);
});

test('U3 und U6 zusammen: eine zugelassene Änderung lässt sich in der Zellenansicht zurücknehmen (die Erwartung enthält die Zulassung); Übertragen in einen Raum behält sie', () => {
  const pf = PF.wende(verwaist(), [L.opZulassen(verwaist(), 'gibtsnicht|1,1,1')], 'Jonah').planfassung;
  const eintrag = pf.eintraege['gibtsnicht|1,1,1'];
  assert.deepEqual(B.inhaltVon(eintrag), { op: 'leere', zugelassen: true });
  const auswahl = { waehlbar: true, teil: 'gibtsnicht', zelle: { x: 1, y: 1, z: 1 }, besitzt: false, block: null, erwartet: B.inhaltVon(eintrag), drehung: 0 };
  const r = B.anwenden(pf, B.operation({}, auswahl, 'zuruecknehmen'), 'Jonah');
  assert.equal(r.konflikt, null);
  assert.equal('gibtsnicht|1,1,1' in r.planfassung.eintraege, false);
  assert.deepEqual(B.operationenAus(pf).find((o) => o.teil === 'gibtsnicht').neu, { op: 'leere', zugelassen: true });
});

test('Konflikt: „Deine Fassung / Fassung von Anna“ als Satz, auch wenn die andere Seite nichts gesetzt hat', () => {
  const k = L.konfliktAnsicht({ teil: 'haus', zelle: { x: 1, y: 2, z: 3 }, vorschlag: { op: 'setze', block: { id: 'minecraft:stone', zustand: { facing: 'north' } } }, aktuell: { op: 'leere', von: 'Anna' } });
  assert.deepEqual([k.deine, k.ihre, k.von], ['Block gesetzt: stone [facing=north]', 'Block entfernt', 'Anna']);
  assert.match(k.satz, /Zelle 1, 2, 3 von „haus“: Du wolltest „Block gesetzt: stone \[facing=north\]“, Anna hat inzwischen „Block entfernt“ gesetzt\./);
  const leer = L.konfliktAnsicht({ teil: 'haus', zelle: { x: 0, y: 0, z: 0 }, vorschlag: null, aktuell: null });
  assert.deepEqual([leer.deine, leer.ihre, leer.von], ['keine Änderung', 'keine Änderung', null]);
});

test('Technik: nur bestätigte Anlagen gelten als funktionsfähig; „neu prüfen“ nennt Verstöße mit Koordinate und bestätigt wieder, wenn es keine mehr gibt', async () => {
  const e = await engine();
  const markt = { schema: 1, version: 1, projekt: { name: 'Markt', bauplatz: { breite: 200, hoehe: 40, tiefe: 80 }, massstab: 1 }, teile: [
    { id: 'markt', name: 'Markthalle', art: 'halle', wichtigkeit: 'muss', form: { baustein: 'bau.raum', groesse: { breite: 11, tiefe: 9, hoehe: 4, tuer: 1, tuerwand: 3 } }, lage: { bezug: 'projekt', relation: 'ecke-nordwest', abstand: 5 }, stil: { stimmung: 'hell-nordisch' }, funktionen: [{ art: 'handelsnischen', menge: 8 }] },
  ] };
  const r = await laufe(markt, e, e.e5);
  const ref = r.plan.technik[0].ref;
  assert.deepEqual(L.technikAnsicht(r.plan).map((t) => [t.status, t.funktioniert, t.verstoesse.length]), [['bestaetigt', true, 0]]);
  assert.equal(L.technikAnsicht({}).length, 0);
  const echt = L.technikPruefen(e.ebene3.bestaetigung, r.entwurf);
  assert.deepEqual([echt.bestaetigt, echt.abgelehnt], [[ref], []]);
  assert.equal(L.technikAnsicht(r.plan, echt)[0].funktioniert, true);
  // künstlicher Verstoß im Prüfbereich: abgelehnt, mit Koordinate; nie „funktioniert“
  const tech = r.entwurf.teile.find((t) => (t.ref ?? t.id) === ref);
  const innen = { ...e.ebene3.materialisiere(r.entwurf).teile.get(tech.id).huelle.von };
  const mitMeldung = erzeugeBestaetigung({ regelwerk: e.ebene1.regelwerk, ebene0: e.ebene0, materialisierung: { materialisiere: e.ebene3.materialisiere, pruefeEntwurf: () => [{ schwere: 'verstoss', regel: 'pruefer.test', ort: innen, meldung: 'künstlich' }] } });
  const nein = L.technikPruefen(mitMeldung, r.entwurf);
  assert.deepEqual([nein.bestaetigt, nein.abgelehnt.map((a) => a.ref)], [[], [ref]]);
  const a = L.technikAnsicht(r.plan, nein)[0];
  assert.deepEqual([a.status, a.funktioniert, a.verstoesse], ['abgelehnt', false, [{ x: innen.x, y: innen.y, z: innen.z, text: 'künstlich' }]]);
  assert.match(a.text, /Verstöße/);
  // eine Änderung im Prüfbereich: nicht bestätigt; neu prüfen bestätigt wieder
  const halle = r.entwurf.teile.find((t) => t.art !== 'technik');
  const geaendert = e.ebene3.aenderungen.setze(r.entwurf, { teil: halle.ref ?? halle.id, zelle: { x: 0, y: 0, z: 0 }, op: 'leere' }, 'Jonah').entwurf;
  const plan2 = e.e5.bauplan(geaendert);
  const vorher = L.technikAnsicht(plan2)[0];
  assert.deepEqual([vorher.status, vorher.funktioniert], ['nicht-bestaetigt', false]);
  assert.equal(vorher.geaendertDurch.length > 0, true);
  const danach = L.technikAnsicht(plan2, L.technikPruefen(e.ebene3.bestaetigung, geaendert))[0];
  assert.deepEqual([danach.status, danach.funktioniert], ['bestaetigt', true]);
});

test('Konflikt lösen: „Meine übernehmen“ überschreibt bewusst, auch wenn der andere eine Zulassung gesetzt hat (die Erwartung enthält sie); „Ihre behalten“ sendet nichts', () => {
  class Dienst {
    constructor() { this.raum = LV.neuerRaum(); this.v = new Map(); this.n = 0; }
    verbinde() { const c = { id: `v${++this.n}`, post: [] }; this.v.set(c.id, c); return c; }
    empfange(c, text) { const r = LV.verarbeite(this.raum, LV.liesNachricht(text), c.id); this.raum = r.raum; for (const z of LV.zustellungen(r.raum, r.senden, c.id)) this.v.get(z.an)?.post.push(JSON.parse(JSON.stringify(z.nachricht))); }
  }
  const d = new Dienst();
  const sp = (name) => {
    const k = LV.erzeugeKlient({ name, fortschritt: F.leer() }), c = d.verbinde();
    const s = { k, c, meld: [], sende(ms) { for (const m of ms) d.empfange(c, JSON.stringify(m)); }, pump() { while (c.post.length) { const r = k.beiNachricht(c.post.shift()); s.meld.push(...r.meldungen); s.sende(r.senden); } } };
    s.sende(k.verbunden());
    return s;
  };
  const anna = sp('Anna'), ben = sp('Ben');
  anna.pump(); ben.pump();
  anna.sende(anna.k.aendereOperation(op('t', 1, 0, 0, { op: 'leere' })));
  anna.sende(anna.k.aendereOperation(op('t', 1, 0, 0, { op: 'leere', zugelassen: true }, { op: 'leere' })));
  anna.pump();
  // Ben kannte die Zelle noch nicht und will sie setzen: Konflikt mit Annas zugelassenem Eintrag
  ben.meld.length = 0;
  ben.sende(ben.k.aendereOperation(op('t', 1, 0, 0, GLAS)));
  ben.pump();
  const konflikt = ben.meld.find((m) => m.art === 'aenderung-konflikt').konflikte[0];
  assert.equal(konflikt.aktuell.zugelassen, true);
  assert.equal(L.konfliktAnsicht(konflikt).von, 'Anna');
  assert.deepEqual(ben.k.konfliktLoesen(konflikt, 'ihre'), [], 'ihre behalten: nichts wird gesendet');
  ben.sende(ben.k.konfliktLoesen(konflikt, 'meine'));
  ben.pump(); anna.pump();
  assert.deepEqual(d.raum.aenderungen.eintraege['t|1,0,0'].block, GLAS.block, 'jetzt gilt Bens Fassung');
  assert.equal('zugelassen' in d.raum.aenderungen.eintraege['t|1,0,0'], false);
  assert.deepEqual(anna.k.zustand.aenderungen.eintraege, d.raum.aenderungen.eintraege);
});

test('Review: eine abgelehnte Gruppe meldet ihren Konflikt, auch wenn ihr verworfener Zwischenstand die Grenzen sprengen würde', () => {
  // eine Planfassung genau an der Grenze der Einträge
  let pf = PF.leer();
  const alle = Array.from({ length: PF.PF_GRENZEN.eintraege }, (_, i) => op('t', i, 0, 0, { op: 'leere' }));
  for (let i = 0; i < alle.length; i += 200) pf = PF.wende(pf, alle.slice(i, i + 200), 'A').planfassung;
  assert.equal(Object.keys(pf.eintraege).length, PF.PF_GRENZEN.eintraege);
  const gruppe = [op('t', 5000, 0, 0, { op: 'leere' }), op('t', 0, 0, 0, null, { op: 'setze', block: { id: 'minecraft:stone' } })]; // die erste würde über die Grenze führen, die zweite hat eine falsche Erwartung
  const r = PF.wende(pf, gruppe, 'B', { gruppe: true });
  assert.deepEqual([r.gruppeAbgelehnt, r.geaendert, r.planfassung === pf, r.konflikte.length], [true, false, true, 1], 'Konflikt statt Größenfehler');
  // ohne Konflikt gilt die Grenze weiterhin
  assert.throws(() => PF.wende(pf, [op('t', 5000, 0, 0, { op: 'leere' })], 'B', { gruppe: true }), (f) => f.grund === 'zu-gross');
});

test('Review: Neu verankern geht von dem Eintrag aus, den die Benutzerin beim Start sah; ändert jemand ihn oder besetzt das Ziel inzwischen, lehnt die Gruppe ganz ab', async () => {
  const e = await engine();
  const ziel = zielZelle(e);
  const pf = verwaist();
  const quelle = structuredClone(pf.eintraege['erdgeschoss|99,1,0']);
  // 1) jemand ändert den Eintrag nach dem Start: die Operationen (mit der Erwartung des Starts) werden abgelehnt, auch obwohl der jüngste Stand eine eigene Erwartung ergäbe
  const jemand = PF.wende(pf, [op('erdgeschoss', 99, 1, 0, { op: 'leere' }, GLAS)], 'Anna').planfassung;
  const ops = L.opsVerankern(jemand, 'erdgeschoss|99,1,0', { teil: ziel.teil, zelle: ziel.zelle }, quelle);
  const r1 = L.anwendenOps(jemand, ops, 'Jonah', { gruppe: true });
  assert.deepEqual([r1.geaendert, r1.konflikte.length, r1.planfassung === jemand], [false, 1, true], 'ohne Schnappschuss würde die Änderung von Anna verschoben');
  const ohneSchnapp = L.opsVerankern(jemand, 'erdgeschoss|99,1,0', { teil: ziel.teil, zelle: ziel.zelle });
  assert.equal(L.anwendenOps(jemand, ohneSchnapp, 'Jonah', { gruppe: true }).geaendert, true, 'zur Gegenprobe: mit dem jüngsten Stand würde es durchgehen');
  // 2) das Ziel wird nach dem Erzeugen der Operationen besetzt: die Gruppe lehnt ab, der alte Eintrag bleibt
  const ops2 = L.opsVerankern(pf, 'erdgeschoss|99,1,0', { teil: ziel.teil, zelle: ziel.zelle }, quelle);
  const besetzt = PF.wende(pf, [op(ziel.teil, ziel.zelle.x, ziel.zelle.y, ziel.zelle.z, { op: 'leere' })], 'Anna').planfassung;
  const r2 = L.anwendenOps(besetzt, ops2, 'Jonah', { gruppe: true });
  assert.deepEqual([r2.geaendert, r2.konflikte.length, r2.planfassung === besetzt], [false, 1, true]);
  assert.ok('erdgeschoss|99,1,0' in r2.planfassung.eintraege, 'der alte Eintrag bleibt');
  // 3) der Eintrag ist inzwischen ganz weg: ebenfalls ein Konflikt, nichts wird am Ziel gesetzt
  const weg = PF.wende(pf, [L.opVerwerfen(pf, 'erdgeschoss|99,1,0')], 'Anna').planfassung;
  const r3 = L.anwendenOps(weg, ops2, 'Jonah', { gruppe: true });
  assert.deepEqual([r3.geaendert, r3.konflikte.length, Object.keys(r3.planfassung.eintraege)], [false, 1, ['gibtsnicht|1,1,1']]);
  // ohne Schnappschuss und ohne Eintrag: klare Meldung
  assert.throws(() => L.opsVerankern(weg, 'erdgeschoss|99,1,0', { teil: ziel.teil, zelle: ziel.zelle }), /nicht mehr/);
});

test('Review: der Konflikt einer abgelehnten Gruppe wird als Ganzes angezeigt („Verschieben abgelehnt“) und nicht als einzelne Zelle zum Übernehmen angeboten', () => {
  class Dienst {
    constructor() { this.raum = LV.neuerRaum(); this.v = new Map(); this.n = 0; }
    verbinde() { const c = { id: `v${++this.n}`, post: [] }; this.v.set(c.id, c); return c; }
    empfange(c, text) { const r = LV.verarbeite(this.raum, LV.liesNachricht(text), c.id); this.raum = r.raum; for (const z of LV.zustellungen(r.raum, r.senden, c.id)) this.v.get(z.an)?.post.push(JSON.parse(JSON.stringify(z.nachricht))); }
  }
  const d = new Dienst();
  const sp = (name) => {
    const k = LV.erzeugeKlient({ name, fortschritt: F.leer() }), c = d.verbinde();
    const s = { k, c, meld: [], sende(ms) { for (const m of ms) d.empfange(c, JSON.stringify(m)); }, pump() { while (c.post.length) { const r = k.beiNachricht(c.post.shift()); s.meld.push(...r.meldungen); s.sende(r.senden); } } };
    s.sende(k.verbunden());
    return s;
  };
  const anna = sp('Anna'), ben = sp('Ben');
  anna.pump(); ben.pump();
  anna.sende(anna.k.aendereOperation(op('t', 1, 0, 0, { op: 'leere' })));
  anna.pump(); ben.pump();
  ben.meld.length = 0;
  ben.sende(ben.k.aendereGruppe([op('t', 1, 0, 0, null, GLAS), op('t', 5, 0, 0, { op: 'leere' })])); // falsche Erwartung am alten Eintrag
  ben.pump();
  const m = ben.meld.find((x) => x.art === 'aenderung-konflikt');
  assert.equal(m.gruppe, true);
  const a = L.konfliktAnsicht(m.konflikte[0], { gruppe: m.gruppe });
  assert.equal(a.gruppe, true);
  assert.match(a.satz, /^Das Verschieben wurde ganz abgelehnt, nichts wurde geändert\. .*Bitte „Neu verankern“ noch einmal wählen\.$/);
  // ein einzelner Konflikt bleibt unverändert
  ben.sende(ben.k.aendereOperation(op('t', 7, 0, 0, GLAS, { op: 'leere' })));
  ben.pump();
  assert.equal(ben.meld.filter((x) => x.art === 'aenderung-konflikt').at(-1).gruppe, false);
  assert.equal(L.konfliktAnsicht(m.konflikte[0]).gruppe, false);
});
