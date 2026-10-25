import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene3 } from '../hilfe.js';
import { AblaufFehler, RechtFehler, entwurfAusJson, entwurfZuJson, berichtAlsText } from '../../src/ebene3/index.js';

const e3 = ebene3();
const AB = e3.ablauf;
const K = e3.konstrukteur;
const e0 = e3.ebene0;
const FUELLER = e3.ebene1.regelwerk.parameter('lager.filter', 'fueller');
const SORTEN = e0.register.gegenstaende
  .filter((id) => /^minecraft:[a-z_]+$/.test(id) && e0.register.stapel(id) === 64 && !FUELLER.includes(id) && !/light_block|barrier|allow|deny|border|void|command|structure|jigsaw|debug|air|bedrock|spawn_egg|banner_pattern|unknown/.test(id))
  .slice(0, 12);
const huelle = (x0, y0, z0, x1, y1, z1) => ({ von: { x: x0, y: y0, z: z0 }, bis: { x: x1, y: y1, z: z1 } });
const fehler = (klasse, fn) => { try { fn(); } catch (f) { assert.ok(f instanceof klasse, String(f)); return f.message; } return null; };
const keinEinwand = (e) => assert.deepEqual(e3.einwaende.sammle(e).einwaende.map((x) => `${x.regel}: ${x.text}`), []);
const reihe = (e) => [...e.abschnitte].sort((a, b) => a.reihenfolge - b.reihenfolge).map((a) => a.id);
const weltAbdruck = (e) => { const w = e3.materialisiere(e).welt; return JSON.stringify(w.alleBloecke ? w.alleBloecke() : [...w.bloecke()]); };

/** Großes Bauwerk: Keller (Technik), Halle (Kuppel, Gang, Schienen), Turm (Wendeltreppe, Schienen). */
const GROSS = () => ({
  name: 'Probebau', stimmung: 'glanz',
  abschnitte: [
    { id: 'turm', name: 'Turm', huelle: huelle(200, 0, 0, 230, 40, 30), nach: ['halle'],
      zonen: [{ funktion: 'optik', anteil: 100 }],
      formen: [{ baustein: 'form.zylinder', parameter: { breite: 15, tiefe: 15, hoehe: 38, wandstaerke: 1 }, zone: 'optik', anker: 'mitte', soll: { symmetrie: ['x', 'z'] } }],
      verbindungen: [{ von: { x: 160, y: 0, z: 30 }, nach: { x: 199, y: 0, z: 30 }, art: 'schiene' }], stimmung: 'dunkel-industriell' },
    { id: 'halle', name: 'Halle', huelle: huelle(0, 0, 0, 159, 15, 40), nach: ['keller'],
      zonen: [{ funktion: 'optik', anteil: 100 }],
      formen: [
        { baustein: 'form.kuppel', parameter: { breite: 31, tiefe: 31 }, zone: 'optik', anker: 'mitte', soll: { symmetrie: ['x', 'z'], verhaeltnis: { hoehe_zu_breite: 0.25 } } },
        { baustein: 'form.zylinder', parameter: { breite: 5, tiefe: 5, hoehe: 6, wandstaerke: 1 }, zone: 'optik', anker: 'nordost' },
      ],
      verbindungen: [{ von: { x: 100, y: 0, z: 10 }, nach: { x: 120, y: 0, z: 10 }, art: 'gang' }, { von: { x: 100, y: 0, z: 30 }, nach: { x: 140, y: 0, z: 30 }, art: 'schiene' }] },
    { id: 'keller', name: 'Keller', huelle: huelle(0, -12, 0, 159, -1, 40),
      zonen: [{ funktion: 'technik', anteil: 60 }, { funktion: 'optik', anteil: 40 }],
      bedarf: [{ art: 'handelsnischen', anzahl: 24, forderung: { golem: true } }, { art: 'lager', sorten: SORTEN.slice(0, 8) }, { art: 'brueter' }],
      schnittstellen: [{ id: 'treppe', mit: 'halle', an: { x: 10, y: -1, z: 15 }, gegen: { x: 10, y: 0, z: 15 } }] },
  ],
});

/** Kleines Bauwerk für Rückgriff und Abschluss. */
const KLEIN = (naht = { x: 10, y: -1, z: 15 }, extra = []) => ({
  name: 'Klein',
  abschnitte: [
    { id: 'keller', name: 'Keller', huelle: huelle(0, -12, 0, 59, -1, 30), zonen: [{ funktion: 'technik', anteil: 60 }, { funktion: 'optik', anteil: 40 }],
      bedarf: [{ art: 'handelsnischen', anzahl: 3 }, ...extra],
      verbindungen: [{ von: { x: 40, y: -6, z: 25 }, nach: { x: 54, y: -6, z: 25 }, art: 'gang' }],
      schnittstellen: [{ id: 'tor', mit: 'halle', an: naht, gegen: { x: 10, y: 0, z: 15 } }] },
    { id: 'halle', name: 'Halle', huelle: huelle(0, 0, 0, 59, 12, 30), nach: ['keller'], zonen: [{ funktion: 'optik', anteil: 100 }],
      formen: [{ baustein: 'form.zylinder', parameter: { breite: 5, tiefe: 5, hoehe: 6, wandstaerke: 1 }, zone: 'optik', anker: 'mitte' }] },
    { id: 'kapelle', name: 'Kapelle', huelle: huelle(100, 0, 0, 130, 12, 30), zonen: [{ funktion: 'optik', anteil: 100 }],
      formen: [{ baustein: 'form.kuppel', parameter: { breite: 15, tiefe: 15 }, zone: 'optik', anker: 'mitte' }] },
  ],
});
const GUT = { x: 10, y: -1, z: 15 };
const SCHLECHT = { x: 10, y: -5, z: 15 };
const TOR = (an) => [{ id: 'tor', mit: 'halle', an, gegen: { x: 10, y: 0, z: 15 } }];

test('Ablauf: ganzes Bauwerk Ende zu Ende', () => {
  const r = AB.starte(GROSS());
  assert.deepEqual([r.status, r.rueckfragen.length], ['fertig', 0]);
  const e = r.entwurf;
  // Reihenfolge nach Abhängigkeit, alles fertig
  assert.deepEqual(reihe(e), ['keller', 'halle', 'turm']);
  assert.ok(e.abschnitte.every((a) => a.status === 'fertig' && a.aufgebaut === true));
  // Prüfer aus Ebene 1 und alle Geometrieregeln: nichts mehr offen
  keinEinwand(e);
  assert.ok(e.einwaende.every((x) => x.status === 'erledigt'), 'alle Einwände wurden gelöst');
  // Module, Formen, Verbindungen sind da; Paletten gelten je Abschnitt
  const bausteine = (id) => e.teile.filter((t) => t.abschnitt === id).map((t) => t.baustein);
  assert.deepEqual(bausteine('keller'), ['tech.handelsnischen', 'tech.sortierlager']);
  assert.deepEqual(bausteine('halle').slice(0, 2), ['form.kuppel', 'form.zylinder']);
  assert.ok(bausteine('halle').includes('bau.gang') && bausteine('halle').includes('tech.antriebsstrecke'));
  assert.ok(bausteine('turm').includes('form.zylinder') && bausteine('turm').includes('tech.antriebsstrecke'));
  assert.deepEqual(Object.keys(e.paletten), ['turm']);
  assert.equal(e.palette.wand.id, 'minecraft:quartz_block');
  // Schaltungsanfrage für den Brüter bleibt offen und blockiert nicht
  assert.deepEqual(r.offeneAnfragen.map((a) => [a.id, a.art]), [['S1', 'brueter']]);
  // Bilanz am Ende: 24 Betten, 24 Dorfbewohner, Iron Golem ja; die Forderung des Bedarfs ist erfüllt
  const bilanzen = e.bericht.filter((b) => b.art === 'bilanz');
  assert.equal(bilanzen.length, 4, 'je Abschnitt eine, dazu die Schlussbilanz');
  assert.deepEqual([bilanzen.at(-1).daten.betten, bilanzen.at(-1).daten.dorfbewohner, bilanzen.at(-1).daten.golem, bilanzen.at(-1).daten.abschnitte], [24, 24, 'ja', 3]);
  // Der Baubericht erzählt den Ablauf in der richtigen Reihenfolge; geändert haben nur Fachleute
  const text = berichtAlsText(e);
  const stelle = (muster) => { const i = text.search(muster); assert.ok(i >= 0, String(muster)); return i; };
  assert.ok(stelle(/sagt „Keller“ als Nummer 1 an/) < stelle(/sagt „Halle“ als Nummer 2 an/));
  assert.ok(stelle(/sagt „Halle“ als Nummer 2 an/) < stelle(/sagt „Turm“ als Nummer 3 an/));
  assert.ok(stelle(/Zone Z-keller-technik gesetzt/) < stelle(/Bedarf keller-B1/) && stelle(/Bedarf keller-B1/) < stelle(/tech\.handelsnischen bei/));
  assert.ok(stelle(/tech\.handelsnischen bei/) < stelle(/Formwunsch halle-F1/));
  assert.ok(stelle(/Formwunsch halle-F1/) < stelle(/bau\.gang bei/));
  assert.ok(stelle(/bau\.gang bei/) < stelle(/Abschnittspalette für/));
  assert.ok(e.bericht.filter((b) => b.art === 'aenderung').every((b) => e3.fachleute.istFachmann(b.daten.von)));
  // deterministisch und speicherbar: gleiche Vorgabe = gleicher Entwurf, Rundreise ergibt dieselbe Welt
  const noch = AB.starte(GROSS()).entwurf;
  assert.equal(entwurfZuJson(noch), entwurfZuJson(e));
  assert.equal(weltAbdruck(entwurfAusJson(entwurfZuJson(e))), weltAbdruck(e));
  // fortsetzen auf einem fertigen Entwurf ändert nichts mehr (außer der Schlussbilanz)
  assert.equal(AB.fortsetzen(e).status, 'fertig');
});

test('Ablauf: Vorlauf und Einspruch', () => {
  const vorgabe = () => ({
    name: 'Vorlauf',
    abschnitte: [
      { id: 'halle', name: 'Halle', huelle: huelle(-10, 0, -10, 20, 12, 20), zonen: [{ funktion: 'technik', anteil: 100 }], bedarf: [{ art: 'lager', sorten: SORTEN.slice(0, 2), braucht: ['lager'] }] },
      { id: 'lager', name: 'Lagerraum', huelle: huelle(100, 0, 0, 130, 12, 30), zonen: [{ funktion: 'optik', anteil: 100 }] },
    ],
  });
  // von innen nach außen käme die Halle zuerst; der Techniker erhebt Einspruch, der Konstrukteur ergänzt die Abhängigkeit
  const v = AB.vorlauf(vorgabe());
  assert.equal(v.art, 'ok');
  assert.deepEqual(reihe(v.entwurf), ['lager', 'halle']);
  assert.deepEqual(v.entwurf.abschnitte.find((a) => a.id === 'halle').nach, ['lager']);
  assert.match(berichtAlsText(v.entwurf), /Der Techniker erhebt Einwand gegen abschnitt:halle.*braucht zuerst den Abschnitt lager/);
  assert.match(berichtAlsText(v.entwurf), /Der Einwand E1 \(plan\.einspruch\) ist nach Runde 0 erledigt/);
  const r = AB.starte(vorgabe());
  assert.equal(r.status, 'fertig');
  assert.deepEqual(reihe(r.entwurf), ['lager', 'halle']);
  // Gesamtpalette aus der Stimmung im Vorlauf
  assert.equal(AB.vorlauf({ ...vorgabe(), stimmung: 'hell-nordisch' }).entwurf.palette.wand, 'minecraft:birch_planks');
  // Kreis: Abschnitt A kommt nach B, aber B braucht A: der Konstrukteur kann es nicht lösen, der Bauleiter fragt Jonah
  const kreis = vorgabe();
  kreis.abschnitte[1].nach = ['halle'];
  const k = AB.starte(kreis);
  assert.equal(k.status, 'wartet');
  assert.match(k.rueckfragen[0].frage, /braucht zuerst den Abschnitt lager.*Kreis/);
  // Vorgabe unbrauchbar
  assert.match(fehler(AblaufFehler, () => AB.starte({ name: 'x' })), /Liste „abschnitte“/);
});

test('Ablauf: Rückgriff und Antworten von Jonah', () => {
  // Naht im Keller falsch: nach dem Abschnitt „halle“ fällt es auf; der Bauleiter öffnet den Keller höchstens zweimal, dann fragt er Jonah
  const r = AB.starte(KLEIN(SCHLECHT));
  assert.equal(r.status, 'wartet');
  const e = r.entwurf;
  assert.equal(e.abschnitte.find((a) => a.id === 'keller').rueckgriffe, 2);
  assert.equal((berichtAlsText(e).match(/öffnet den Abschnitt keller wieder \(mit halle\)/g) ?? []).length, 2);
  assert.equal(r.rueckfragen.length, 2, 'zwei Befunde an derselben Naht');
  assert.match(r.rueckfragen[0].frage, /Naht tor zwischen keller und halle.*liegt nicht am Rand der Hülle von keller/);
  assert.equal(e.rueckfragen.filter((x) => x.status === 'rueckgriff').length, 4, 'je Durchgang zwei zurückgestellte Rückfragen');
  const nichtBearbeitet = e.abschnitte.find((a) => a.id === 'kapelle');
  assert.ok(nichtBearbeitet.status === 'offen' || nichtBearbeitet.status === 'fertig');
  const id = r.rueckfragen[0].id;

  // Antwort „aendern“: korrigierte Schnittstelle, danach läuft alles durch
  const geaendert = AB.antworte(e, id, { option: 'aendern', aenderung: { schnittstellen: TOR(GUT) } });
  assert.equal(e.rueckfragen.find((x) => x.id === id).status, 'offen', 'das Original bleibt unverändert');
  assert.equal(geaendert.rueckfragen.find((x) => x.id === id).status, 'beantwortet');
  assert.match(berichtAlsText(geaendert), /Jonah entscheidet: ändert den Abschnitt keller wegen E\d+ \(schnittstellen\)/);
  const fertig = AB.fortsetzen(geaendert);
  assert.deepEqual([fertig.status, fertig.rueckfragen.length], ['fertig', 0]);
  keinEinwand(fertig.entwurf);
  assert.ok(fertig.entwurf.abschnitte.every((a) => a.status === 'fertig'));

  // Antwort „zulassen“: der Einwand wird nicht mehr erhoben, der Bau läuft weiter
  let zugelassen = e;
  for (const q of r.rueckfragen) zugelassen = AB.antworte(zugelassen, q.id, { option: 'zulassen' });
  assert.equal(zugelassen.zulassungen.length, 2);
  assert.equal(AB.fortsetzen(AB.antworte(e, id, { option: 'zulassen' })).status, 'wartet', 'die zweite Rückfrage ist noch offen');
  const weiter = AB.fortsetzen(zugelassen);
  assert.equal(weiter.status, 'fertig');
  keinEinwand(weiter.entwurf);
  assert.match(berichtAlsText(weiter.entwurf), /Jonah entscheidet: lässt den Einwand E\d+ zu/);

  // Antwort „abschnitt-neu“ ohne Änderung: gleicher Fehler, eine neue Rückfrage
  const neu = AB.fortsetzen(AB.antworte(e, id, { option: 'abschnitt-neu' }));
  assert.equal(neu.status, 'wartet');

  // Fehler bei der Antwort
  assert.match(fehler(AblaufFehler, () => AB.antworte(e, 'R99', { option: 'zulassen' })), /gibt es nicht/);
  assert.match(fehler(AblaufFehler, () => AB.antworte(e, id, { option: 'vielleicht' })), /Option „vielleicht“ unbekannt/);
  assert.match(fehler(AblaufFehler, () => AB.antworte(e, id, { option: 'aendern' })), /braucht eine Änderung/);
  assert.match(fehler(AblaufFehler, () => AB.antworte(e, id, { option: 'aendern', aenderung: { nach: [] } })), /lässt sich „nach“ nicht ändern/);
  assert.match(fehler(AblaufFehler, () => AB.antworte(geaendert, id, { option: 'zulassen' })), /schon beantwortet/);
  // wartet eine Rückfrage, läuft nichts weiter
  assert.equal(AB.fortsetzen(e).status, 'wartet');

  // Rückgriff direkt: der Abschnitt, seine Abhängigen und nur diese werden zurückgesetzt
  const ganz = AB.starte(KLEIN(GUT));
  assert.equal(ganz.status, 'fertig');
  const vorher = ganz.entwurf;
  const offen = AB.rueckgriff(vorher, 'keller', { grund: 'Probe' });
  const teileVon = (x, a) => x.teile.filter((t) => t.abschnitt === a).length;
  assert.deepEqual(offen.abschnitte.map((a) => [a.id, a.status]).sort(), [['halle', 'offen'], ['kapelle', 'fertig'], ['keller', 'offen']]);
  assert.deepEqual([teileVon(offen, 'keller'), teileVon(offen, 'halle'), teileVon(offen, 'kapelle')], [0, 0, teileVon(vorher, 'kapelle')]);
  assert.ok(teileVon(vorher, 'kapelle') > 0);
  assert.deepEqual(offen.zonen.map((z) => z.abschnitt).filter((a) => a !== 'kapelle'), []);
  assert.deepEqual(offen.sperrzonen, []);
  assert.ok(vorher.pruefungen.some((p) => p.abschnitt === 'keller'), 'der Gang im Keller hat einen Prüfauftrag');
  assert.deepEqual(offen.pruefungen.filter((p) => p.abschnitt === 'keller'), []);
  assert.deepEqual(offen.bedarf, [], 'Bedarf und Wünsche der geöffneten Abschnitte werden neu aufgebaut');
  assert.deepEqual(offen.formwuensche.map((w) => w.abschnitt), ['kapelle']);
  assert.equal(offen.abschnitte.find((a) => a.id === 'keller').rueckgriffe, 1);
  assert.equal(offen.abschnitte.find((a) => a.id === 'halle').rueckgriffe, undefined);
  assert.equal(offen.abschnitte.find((a) => a.id === 'keller').aufgebaut, undefined);
  assert.match(berichtAlsText(offen), /Der Bauleiter entscheidet: öffnet den Abschnitt keller wieder \(mit halle\), sein Ablauf läuft neu: Probe/);
  // der Ablauf läuft neu und baut dasselbe Bauwerk wieder auf
  const wieder = AB.fortsetzen(offen);
  assert.equal(wieder.status, 'fertig');
  assert.equal(weltAbdruck(wieder.entwurf), weltAbdruck(vorher));
  // Änderung beim Öffnen: andere Hülle, Name
  const anders = AB.rueckgriff(vorher, 'kapelle', { aenderung: { name: 'Kleine Kapelle' } });
  assert.equal(anders.abschnitte.find((a) => a.id === 'kapelle').name, 'Kleine Kapelle');
  assert.deepEqual(anders.abschnitte.filter((a) => a.status === 'offen').map((a) => a.id), ['kapelle']);
  // Fixierung durch Jonah wird nicht verletzt
  const fest = e3.fixiere(vorher, `teil:${vorher.teile.find((t) => t.abschnitt === 'halle').id}`, 'bleibt').entwurf;
  assert.match(fehler(RechtFehler, () => AB.rueckgriff(fest, 'halle')), /gesperrt/);
  assert.match(fehler(AblaufFehler, () => AB.rueckgriff(vorher, 'zz')), /gibt es nicht/);
});

test('Ablauf: Abschluss', () => {
  // noch nicht alles fertig
  const v = AB.vorlauf(KLEIN());
  assert.match(fehler(AblaufFehler, () => AB.abschliessen(v.entwurf)), /noch nicht alle Abschnitte fertig/);

  // fertig mit offener Schaltungsanfrage: Anfrage wird gemeldet, blockiert nicht
  const r = AB.starte(KLEIN(GUT, [{ art: 'bahnhof' }]));
  assert.equal(r.status, 'fertig');
  assert.deepEqual(r.offeneAnfragen.map((a) => a.art), ['bahnhof']);
  const e = r.entwurf;

  // eine Verbindung ohne Prüfauftrag fällt im Abschluss auf
  const mitVerb = AB.starte({ name: 'V', abschnitte: [{ id: 'a', name: 'A', huelle: huelle(0, -3, 0, 40, 10, 20), zonen: [{ funktion: 'optik', anteil: 100 }], verbindungen: [{ von: { x: 5, y: 0, z: 5 }, nach: { x: 20, y: 0, z: 5 }, art: 'gang' }] }] });
  assert.equal(mitVerb.status, 'fertig');
  assert.equal(mitVerb.entwurf.pruefungen.length, 1);
  const ohnePruefung = structuredClone(mitVerb.entwurf);
  ohnePruefung.pruefungen = [];
  const fehlt = AB.abschliessen(ohnePruefung);
  assert.equal(fehlt.status, 'wartet');
  assert.match(fehlt.rueckfragen[0].frage, /Die Verbindung a-V1 hat keinen Prüfauftrag/);

  // eine Naht, die erst nach dem Fertigmelden kaputtgeht, findet die Gesamtprüfung; der Bauleiter öffnet den Abschnitt (zweimal), dann fragt er
  const kaputt = e3.aendere(e, 'konstrukteur', { art: 'setze-abschnitt', abschnitt: { ...e.abschnitte.find((a) => a.id === 'keller'), schnittstellen: TOR(SCHLECHT) } }).entwurf;
  const a = AB.abschliessen(kaputt);
  assert.equal(a.status, 'wartet');
  assert.match(a.rueckfragen[0].frage, /Naht tor zwischen keller und halle/);
  assert.equal(a.entwurf.abschnitte.find((x) => x.id === 'keller').rueckgriffe, 2);

  // ein sauberer Abschluss prüft den ganzen Bau und trägt die Schlussbilanz ein
  const schluss = AB.abschliessen(e);
  assert.equal(schluss.status, 'fertig');
  assert.equal(schluss.entwurf.bericht.filter((b) => b.art === 'bilanz').length, e.bericht.filter((b) => b.art === 'bilanz').length + 1);
  // Der Ablauf kennt die Rückfrage-Stati auch für alte Entwürfe ohne Status
  assert.equal(AB.fortsetzen(structuredClone(e)).status, 'fertig');
});
