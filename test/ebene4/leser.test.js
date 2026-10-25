import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ebene4 } from '../hilfe.js';
import { SpezifikationFehler, FreigabeFehler, liesJson, zuJson, abdruck, erzeugeBriefing } from '../../src/ebene4/index.js';

const L = ebene4();
const e0 = L.ebene0, e2 = L.ebene2;
const FUELLER = L.ebene1.regelwerk.parameter('lager.filter', 'fueller');
const SORTEN = e0.register.gegenstaende
  .filter((id) => /^minecraft:[a-z_]+$/.test(id) && e0.register.stapel(id) === 64 && !FUELLER.includes(id) && !/light_block|barrier|allow|deny|border|void|command|structure|jigsaw|debug|air|bedrock|spawn_egg|banner_pattern|unknown/.test(id))
  .slice(0, 100);
const fehler = (klasse, fn) => { try { fn(); } catch (f) { assert.ok(f instanceof klasse, String(f)); return f; } return null; };

/** Das Beispiel aus dem Prompt ohne die Beispielfrage: gültig. */
const gut = () => { const s = structuredClone(L.beispiel()); delete s.offeneFragen; return s; };
/** Die Zitadelle in klein: Turm, Halle mit 192 Nischen und Lager für 48 Sorten, Mauer, Keller. */
const ZITADELLE = () => ({
  schema: 1,
  version: 1,
  projekt: { name: 'Die Zitadelle (klein)', bauplatz: { breite: 200, hoehe: 120, tiefe: 200 }, nullpunkt: { x: 0, y: 64, z: 0 }, massstab: 1 },
  teile: [
    { id: 'zentralturm', name: 'Zentralturm', art: 'turm', wichtigkeit: 'muss', form: { baustein: 'form.zylinder', groesse: { breite: 21, tiefe: 21, hoehe: 60 }, proportionen: { hoehe_zu_breite: 2.86 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'glanz', farben: ['weiß', 'gold'], bemerkung: 'oben Glanz' }, verbindungen: [{ mit: 'markthalle', art: 'gang' }] },
    { id: 'markthalle', name: 'Markthalle', art: 'halle', wichtigkeit: 'muss', form: { baustein: 'form.kuppel', groesse: { breite: 61, tiefe: 61 } }, lage: { bezug: 'zentralturm', relation: 'neben-osten', abstand: 4 }, funktionen: [{ art: 'handelsnischen', menge: 192 }, { art: 'bruteranlage' }] },
    { id: 'ringmauer', name: 'Ringmauer', art: 'mauer', wichtigkeit: 'soll', form: { baustein: 'form.zylinder', groesse: { breite: 181, tiefe: 181, hoehe: 12, wandstaerke: 3 } }, lage: { bezug: 'projekt', relation: 'mitte' }, stil: { stimmung: 'hell-nordisch' } },
    { id: 'lagerkeller', name: 'Lagerkeller', art: 'keller', wichtigkeit: 'muss', form: { baustein: 'form.satteldach', groesse: {} }, lage: { bezug: 'zentralturm', relation: 'unter' }, funktionen: [{ art: 'lager', sorten: SORTEN.slice(0, 48) }], stil: { stimmung: 'dunkel-industriell' } },
  ],
});

const mit = (aendere, basis = gut) => { const s = basis(); aendere(s); return L.pruefe(s); };
/** Genau eine Rückfrage mit diesem Pfad; liefert sie zurück. */
const eine = (aendere, pfad, muster, basis = gut) => {
  const r = mit(aendere, basis);
  assert.equal(r.rueckfragen.length, 1, r.rueckfragen.map((q) => `${q.pfad}: ${q.frage}`).join(' | '));
  assert.equal(r.rueckfragen[0].pfad, pfad);
  assert.match(r.rueckfragen[0].frage, muster);
  assert.equal(r.rueckfragen[0].optionen.at(-1).id, 'anders', 'immer die Möglichkeit, etwas anderes zu sagen');
  return r.rueckfragen[0];
};
const werte = (q) => q.optionen.filter((o) => 'wert' in o).map((o) => o.wert);

test('Leser: Schema und Prüfer', () => {
  // gültige Spezifikationen: keine Rückfrage
  assert.deepEqual(L.pruefe(gut()), { rueckfragen: [], hinweise: [] });
  const z = L.pruefe(ZITADELLE());
  assert.deepEqual(z.rueckfragen, []);
  assert.deepEqual(z.hinweise.map((h) => h.pfad), ['teile[1].funktionen[1]', 'teile[3].form.groesse'], 'Brüteranlage ohne Modul, Größe ohne Angabe');
  assert.deepEqual(L.pruefe(ZITADELLE()), z, 'deterministisch');

  // Hinweise für große Bedarfe (werden in Module geteilt)
  const gross = ZITADELLE();
  gross.teile[1].funktionen = [{ art: 'handelsnischen', menge: 300 }];
  gross.teile[3].funktionen = [{ art: 'lager', sorten: SORTEN }];
  const gh = L.pruefe(gross).hinweise.map((h) => h.text);
  assert.ok(gh.some((t) => /300 Handelsnischen werden in 2 Module zu höchstens 256 geteilt/.test(t)));
  assert.ok(gh.some((t) => /100 Sorten werden in 3 Lager-Module zu höchstens 48 geteilt/.test(t)));
  assert.match(mit((s) => { s.projekt.massstab = 2; }).hinweise[0].text, /Menschenmaß .* bleibt fest/);

  // Unbekannte Begriffe: Rückfrage mit den ähnlichsten erlaubten Begriffen
  assert.ok(werte(eine((s) => { s.teile[0].art = 'tum'; }, 'teile[0].art', /Die Art von Nordturm „tum“ kennt Blockwerk nicht/)).includes('turm'));
  assert.deepEqual(werte(eine((s) => { s.teile[0].form.baustein = 'form.zylindar'; }, 'teile[0].form.baustein', /Die Form von Nordturm/))[0], 'form.zylinder');
  assert.deepEqual(werte(eine((s) => { s.teile[0].lage.relation = 'ecke-nord'; }, 'teile[0].lage.relation', /Lagebeziehung/)), ['ecke-nordost']);
  assert.deepEqual(werte(eine((s) => { s.teile[0].stil.stimmung = 'glanzx'; }, 'teile[0].stil.stimmung', /Stimmung/)), ['glanz']);
  assert.equal(werte(eine((s) => { s.teile[0].stil.stimmung = 'glanzvoll'; }, 'teile[0].stil.stimmung', /Stimmung/)).length, 3, 'nichts ähnlich genug: wenige Möglichkeiten werden alle angeboten');
  assert.deepEqual(werte(eine((s) => { s.teile[1].funktionen[0].art = 'handelsnische'; }, 'teile[1].funktionen[0].art', /Die Funktion/)), ['handelsnischen']);
  assert.deepEqual(werte(eine((s) => { s.teile[0].verbindungen[0].art = 'gan'; }, 'teile[0].verbindungen[0].art', /Verbindung/)), ['gang']);
  assert.equal(werte(eine((s) => { s.teile[0].wichtigkeit = 'unbedingt'; }, 'teile[0].wichtigkeit', /Wichtigkeit/)).join(), 'muss,soll,kann');
  assert.deepEqual(werte(eine((s) => { s.teile[0].form.groesse = { breit: 9 }; }, 'teile[0].form.groesse.breit', /Der Parameter von form\.zylinder/)), ['breite']);
  assert.deepEqual(werte(eine((s) => { s.teile[0].form.proportionen = { hoehe_zu_breit: 2 }; }, 'teile[0].form.proportionen.hoehe_zu_breit', /Proportion/)), ['hoehe_zu_breite']);
  assert.ok(werte(eine((s) => { s.teile[1].funktionen[1].sorten[1] = 'minecraft:cobblestoen'; }, 'teile[1].funktionen[1].sorten[1]', /Gegenstandssorte/)).includes('minecraft:cobblestone'));
  assert.equal(werte(eine((s) => { s.teile[0].wichtigkeit = undefined; }, 'teile[0].wichtigkeit', /Wie wichtig ist Nordturm\?/)).join(), 'muss,soll,kann');

  // Schaltungen und Koordinaten gehören nicht in die Spezifikation (nur WAS)
  eine((s) => { s.teile[0].form.baustein = 'tech.sortierlager'; }, 'teile[0].form.baustein', /ist eine Schaltung\. .* nenne den Bedarf bei „funktionen“/);
  eine((s) => { s.teile[0].lage.x = 5; }, 'teile[0].lage.x', /beschreibt, wie gebaut wird/);
  eine((s) => { s.teile[0].bloecke = ['minecraft:stone']; }, 'teile[0].bloecke', /Koordinaten, Blöcke, Schaltungen/);
  eine((s) => { s.teile[1].funktionen[0].schaltung = 'sortierer'; }, 'teile[1].funktionen[0].schaltung', /wie gebaut wird/);
  eine((s) => { s.teile[0].farbe = 'rot'; }, 'teile[0].farbe', /kennt das Schema bei einem Teil nicht/);
  eine((s) => { s.extra = 1; }, 'extra', /kennt das Schema nicht/);

  // Unmögliche Werte
  eine((s) => { s.teile[0].form.groesse.breite = 0; }, 'teile[0].form.groesse.breite', /nicht möglich \(ganze Zahl von 1 bis 512\)/);
  eine((s) => { s.teile[0].form.groesse.hoehe = 4.5; }, 'teile[0].form.groesse.hoehe', /nicht möglich/);
  eine((s) => { s.teile[0].form.groesse.breite = '9'; }, 'teile[0].form.groesse.breite', /nicht möglich/);
  eine((s) => { s.teile[0].form.proportionen.hoehe_zu_breite = 0; }, 'teile[0].form.proportionen.hoehe_zu_breite', /nicht möglich/);
  eine((s) => { s.teile[1].funktionen[0].menge = 0; }, 'teile[1].funktionen[0].menge', /Handelsnischen von Haupthalle/);
  eine((s) => { s.teile[1].funktionen[0].menge = 2.5; }, 'teile[1].funktionen[0].menge', /nicht möglich/);
  eine((s) => { s.teile[1].funktionen[0].beruf = 13; }, 'teile[1].funktionen[0].beruf', /Beruf/);
  eine((s) => { s.projekt.bauplatz.breite = 0; }, 'projekt.bauplatz.breite', /Bauplatz-breite/);
  eine((s) => { s.projekt.bauplatz.hoehe = 500; }, 'projekt.bauplatz.hoehe', /von 1 bis 384/);
  eine((s) => { s.projekt.massstab = -1; }, 'projekt.massstab', /Maßstab/);
  eine((s) => { s.teile[0].lage.abstand = -3; }, 'teile[0].lage.abstand', /Abstand/);
  eine((s) => { s.schema = 2; }, 'schema', /Blockwerk versteht Schema 1/);
  eine((s) => { s.version = 0; }, 'version', /Versionsnummer/);
  eine((s) => { s.version = 1.5; }, 'version', /Versionsnummer/);
  assert.deepEqual(mit((s) => { s.version = 7; }).rueckfragen, []);
  eine((s) => { s.projekt.name = ''; }, 'projekt.name', /braucht einen Namen/);

  // Lager: die Sortenliste fehlt oder ist unbrauchbar
  eine((s) => { s.teile[1].funktionen[1] = { art: 'lager', menge: 48 }; }, 'teile[1].funktionen[1].sorten', /Welche Gegenstandssorten .* nur die Zahl 48/);
  eine((s) => { s.teile[1].funktionen[1].sorten.push('minecraft:dirt'); }, 'teile[1].funktionen[1].sorten[3]', /doppelt/);
  eine((s) => { s.teile[1].funktionen[1].sorten = []; }, 'teile[1].funktionen[1].sorten', /hat 0 Sorten/);

  // Widersprüche: Ids und Lagebezüge
  eine((s) => { s.teile[0].lage.bezug = 'haupthalle'; s.teile[1].lage.bezug = 'nordturm'; }, 'teile[1].lage.bezug', /im Kreis aufeinander/);
  const bezug = eine((s) => { s.teile[0].lage.bezug = 'haupthall'; }, 'teile[0].lage.bezug', /ein solches Teil gibt es nicht/);
  assert.deepEqual(werte(bezug), ['haupthalle']);
  eine((s) => { s.teile[1].lage.bezug = 'haupthalle'; }, 'teile[1].lage.bezug', /nicht auf sich selbst beziehen/);
  eine((s) => { s.teile[0].verbindungen[0].mit = 'haupthall'; }, 'teile[0].verbindungen[0].mit', /gibt es nicht/);
  eine((s) => { s.teile[0].verbindungen[0].mit = 'nordturm'; }, 'teile[0].verbindungen[0].mit', /gibt es nicht/);
  assert.ok(mit((s) => { s.teile[1].id = 'nordturm'; }).rueckfragen.some((q) => /Die Id „nordturm“ kommt mehrfach vor/.test(q.frage)));
  eine((s) => { s.teile[0].id = 'Nord Turm'; s.teile[1].verbindungen = undefined; s.teile[0].verbindungen = undefined; }, 'teile[0].id', /Kleinbuchstaben, Ziffern und Bindestrichen/);

  // Fragen des Lesers selbst werden Rückfragen
  const offen = mit((s) => { s.offeneFragen = ['Ist der Turm rund?', { frage: 'Wie hoch ist die Mauer?' }, 5]; }).rueckfragen;
  assert.deepEqual(offen.map((q) => [q.pfad, q.regel]), [['offeneFragen[0]', 'leser.offene-frage'], ['offeneFragen[1]', 'leser.offene-frage'], ['offeneFragen[2]', 'leser.schema']]);
  assert.match(offen[1].frage, /Der Leser war unsicher: Wie hoch ist die Mauer\?/);
  assert.deepEqual(offen.map((q) => q.id), ['Q1', 'Q2', 'Q3']);

  // Struktur
  assert.equal(L.pruefe(null).rueckfragen[0].pfad, '');
  assert.equal(L.pruefe([]).rueckfragen.length, 1);
  assert.match(L.pruefe({ schema: 1, version: 1, projekt: gut().projekt, teile: [] }).rueckfragen[0].frage, /mindestens ein Teil/);
  assert.ok(mit((s) => { delete s.projekt; }).rueckfragen.some((q) => q.pfad === 'projekt'));

  // Alle Bausteine der Ebene 2: Parameter an den Grenzen sind gültig, knapp daneben eine Rückfrage (Bereiche kommen aus Ebene 2, nicht aus einer Kopie)
  let geprueft = 0;
  for (const b of L.vokabular.bausteine) {
    for (const p of b.parameter.filter((x) => !x.liste)) {
      const probe = (w) => mit((s) => { s.teile[0].form = { baustein: b.id, groesse: { [p.name]: w } }; });
      assert.deepEqual(probe(p.min).rueckfragen, [], `${b.id}.${p.name} = min`);
      assert.deepEqual(probe(p.max).rueckfragen, [], `${b.id}.${p.name} = max`);
      assert.equal(probe(p.min - (p.ganzzahl ? 1 : 0.01)).rueckfragen.length, 1, `${b.id}.${p.name} unter min`);
      assert.equal(probe(p.max + (p.ganzzahl ? 1 : 0.01)).rueckfragen.length, 1, `${b.id}.${p.name} über max`);
      geprueft++;
    }
    assert.ok(e2.bausteine.has(b.id) && !b.id.startsWith('tech.'));
  }
  assert.ok(geprueft >= 30);
  assert.ok(L.vokabular.bausteine.length >= 14);
});

test('Leser: Briefing-Prompt', () => {
  const eingabe = { projekt: 'Die Zitadelle', bauplatz: { breite: 200, hoehe: 120, tiefe: 200 }, bilder: ['aussen.png', 'grundriss.png'], text: 'Ein Turm in der Mitte, rundherum eine Mauer.' };
  const p = L.briefing(eingabe);
  assert.equal(L.briefing(eingabe), p, 'deterministisch');
  assert.match(p, /Du bist der „Leser“ von Blockwerk/);
  assert.match(p, /nur, WAS gebaut wird, nie WIE: keine Koordinaten/);
  assert.match(p, /Rate nicht\./);
  // der Prompt nennt das ganze Vokabular (aus den Daten, Ebene 2 und Ebene 3)
  const v = L.vokabular;
  for (const w of [...v.teilarten, ...v.wichtigkeiten, ...v.verbindungsarten, ...v.stimmungen, ...Object.keys(v.relationen), ...v.funktionsarten]) assert.ok(p.includes(w), w);
  for (const b of v.bausteine) {
    assert.ok(p.includes(`- ${b.id} (`), b.id);
    for (const q of b.parameter.filter((x) => !x.liste)) assert.ok(p.includes(`${q.name} = ${q.ganzzahl ? 'ganze Zahl' : 'Zahl'} ${q.min}–${q.max}`), `${b.id}.${q.name}`);
  }
  assert.match(p, /handelsnischen: menge = ganze Zahl 1–4096/);
  assert.match(p, /nenne immer die Sorten, nicht nur die Zahl/);
  assert.match(p, /bruteranlage: nur die Art nennen/);
  assert.ok(!p.includes('tech.'), 'Schaltungen kommen im Prompt nicht vor');
  // Eingabe am Ende
  assert.match(p, /Projekt: Die Zitadelle\nBauplatz: 200 × 120 × 200 Blöcke/);
  assert.match(p, /Bilder: aussen\.png, grundriss\.png/);
  assert.match(p, /Text:\nEin Turm in der Mitte, rundherum eine Mauer\.$/);
  assert.match(L.briefing(), /Bilder: \(keine\)[\s\S]*\(kein Text\)$/);
  // Prompt und Prüfer bleiben synchron: das Beispiel im Prompt ist gültig (bis auf die ausdrückliche Beispielfrage)
  const block = p.match(/```json\n([\s\S]*?)\n```/)[1];
  const bsp = liesJson(`Hier ist die Spezifikation:\n\`\`\`json\n${block}\n\`\`\`\nViel Erfolg!`);
  const r = L.pruefe(bsp);
  assert.deepEqual(r.rueckfragen.map((q) => q.regel), ['leser.offene-frage']);
  assert.deepEqual(L.pruefe(L.beispiel()).hinweise, []);
  // Ändert sich das Vokabular, ändert sich der Prompt: ein anderer Bausteinbereich kommt sofort an
  const andere = { ...L.vokabular, bausteine: L.vokabular.bausteine.map((b) => (b.id === 'form.zylinder' ? { ...b, parameter: b.parameter.map((q) => (q.name === 'breite' ? { ...q, max: 999 } : q)) } : b)) };
  assert.match(erzeugeBriefing({ vokabular: andere }).prompt(eingabe), /- form.zylinder .*breite = ganze Zahl 1–999/);
  assert.match(p, /- form.zylinder .*breite = ganze Zahl 1–512/);

  // Chat-Antwort lesen: mit Zaun, ohne Zaun, mit Text davor und danach
  const json = zuJson(gut());
  assert.deepEqual(liesJson(`\`\`\`json\n${json}\n\`\`\``), gut());
  assert.deepEqual(liesJson(json), gut());
  assert.deepEqual(liesJson(`Gerne!\n${json}\nGruß`), gut());
  assert.match(fehler(SpezifikationFehler, () => liesJson('')).message, /leer/);
  assert.match(fehler(SpezifikationFehler, () => liesJson('Das kann ich leider nicht.')).message, /kein JSON-Objekt/);
  assert.match(fehler(SpezifikationFehler, () => liesJson('{"version": 1,')).message, /kein gültiges JSON/);
  assert.match(fehler(SpezifikationFehler, () => liesJson('```json\n[1,2]\n```')).message, /kein Objekt/);
  assert.match(fehler(SpezifikationFehler, () => liesJson(42)).message, /leer/);
});

test('Leser: Zusammenfassung, Freigabe und Versionen', () => {
  const z = ZITADELLE();
  const text = L.zusammenfassung(z);
  assert.equal(L.zusammenfassung(ZITADELLE()), text, 'deterministisch');
  assert.match(text, /^Bauspezifikation „Die Zitadelle \(klein\)“, Version 1\.\nBauplatz: 200 × 120 × 200 Blöcke/);
  assert.match(text, /4 Teile: 3 muss, 1 soll, 0 kann\./);
  assert.match(text, /1\. Zentralturm \(Turm, muss\): Zylinder, breite 21, tiefe 21, hoehe 60 Blöcke; Proportionen: hoehe zu breite 2,86\. Lage: mittig bei dem Bauplatz\./);
  assert.match(text, /Stil: Stimmung glanz; Farben weiß, gold; oben Glanz\./);
  assert.match(text, /Verbindungen: Gang zu „Markthalle“\./);
  assert.match(text, /2\. Markthalle \(Halle, muss\): Kuppel, breite 61, tiefe 61 Blöcke\. Lage: östlich neben „Zentralturm“, 4 Blöcke Abstand\./);
  assert.match(text, /Bedarf: 192 Handelsnischen\./);
  assert.match(text, /Bedarf: bruteranlage \(noch ohne fertiges Modul\)\./);
  assert.match(text, /Bedarf: Lager für 48 Gegenstandssorten\./);
  assert.match(text, /Lage: unter „Zentralturm“\./);
  assert.match(text, /Zusammen: 192 Handelsnischen\.$/);
  for (const t of z.teile) assert.ok(text.includes(t.name), t.name);

  // Freigabe nur ohne offene Rückfragen
  const offen = structuredClone(z);
  offen.teile[0].art = 'tum';
  const f = fehler(FreigabeFehler, () => L.freigeben(offen));
  assert.match(f.message, /1 Rückfrage sind noch offen/);
  assert.equal(f.rueckfragen[0].pfad, 'teile[0].art');
  assert.match(fehler(FreigabeFehler, () => L.freigeben({ schema: 1, version: 1 })).message, /Rückfragen sind noch offen/);
  const frei = L.freigeben(z);
  assert.deepEqual([frei.freigabe.von, frei.freigabe.version], ['jonah', 1]);
  assert.equal(frei.freigabe.abdruck, abdruck(z));
  assert.equal(z.freigabe, undefined, 'das Original bleibt unverändert');
  assert.equal(L.istFreigegeben(frei), true);
  assert.equal(L.istFreigegeben(z), false);
  assert.match(L.zusammenfassung(frei), /Freigegeben von jonah \(Version 1\)\.$/);
  // jede Änderung seit der Freigabe macht sie ungültig
  const geaendert = structuredClone(frei);
  geaendert.teile[0].form.groesse.hoehe = 61;
  assert.equal(L.istFreigegeben(geaendert), false);
  const umbenannt = structuredClone(frei);
  umbenannt.projekt.name = 'Anders';
  assert.equal(L.istFreigegeben(umbenannt), false);
  // der Abdruck hängt nicht von der Reihenfolge der Schlüssel ab, wohl aber vom Inhalt
  const umgedreht = Object.fromEntries(Object.entries(z).reverse());
  assert.equal(abdruck(umgedreht), abdruck(z));
  assert.equal(zuJson(umgedreht), zuJson(z));
  assert.notEqual(abdruck(geaendert), abdruck(z));
  assert.deepEqual(liesJson(zuJson(z)), z, 'Rundreise');

  // Versionen und Vergleich
  const v2 = L.neueVersion(frei, (s) => {
    s.teile[0].form.groesse.hoehe = 70;
    s.teile.push({ id: 'wachturm', name: 'Wachturm', art: 'turm', wichtigkeit: 'kann', form: { baustein: 'form.kegel', groesse: { breite: 9, tiefe: 9, hoehe: 15 } }, lage: { bezug: 'ringmauer', relation: 'ecke-nordost' } });
    s.teile = s.teile.filter((t) => t.id !== 'lagerkeller');
    s.projekt.bauplatz.breite = 240;
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.freigabe, undefined);
  assert.equal(frei.version, 1, 'die alte Version bleibt unverändert');
  assert.equal(L.istFreigegeben(v2), false);
  const diff = L.vergleiche(frei, v2);
  assert.deepEqual(diff, { projekt: ['projekt.bauplatz.breite'], hinzugefuegt: ['wachturm'], entfernt: ['lagerkeller'], geaendert: [{ id: 'zentralturm', felder: ['form.groesse.hoehe'] }] });
  assert.deepEqual(L.vergleiche(z, structuredClone(z)), { projekt: [], hinzugefuegt: [], entfernt: [], geaendert: [] });
  // Listen: ein geändertes Element wird mit Index genannt
  const w = structuredClone(z);
  w.teile[3].funktionen[0].sorten[7] = 'minecraft:dirt';
  assert.deepEqual(L.vergleiche(z, w).geaendert, [{ id: 'lagerkeller', felder: ['funktionen[0].sorten[7]'] }]);
  // die neue Version wird wieder geprüft und kann freigegeben werden
  assert.equal(L.freigeben(v2).freigabe.version, 2);
});
