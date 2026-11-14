// U6: Verträglichkeit des Planfassungsformats mit älteren Blockwerk-Versionen (Entscheidung 14.11.2026, Regel 4): Zulassungen gehen nie still verloren, ältere Versionen lehnen sichtbar ab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as PF from '../../src/ebene5/planfassung.js';
import * as teilen from '../../src/ebene5/teilen.js';
import * as L from '../../src/ebene5/loesen.js';
import { live as LV, fortschritt as F } from '../../src/ebene5/index.js';
import { holeJson } from './hilfe5.js';

const op = (teil, x, y, z, neu, erwartet = null) => ({ teil, zelle: { x, y, z }, erwartet, neu });
const ohne = () => PF.wende(PF.leer(), [op('t', 1, 0, 0, { op: 'leere' })], 'Anna').planfassung;
const mit = () => PF.wende(ohne(), [L.opZulassen(ohne(), 't|1,0,0')], 'Anna').planfassung;

test('Speicherform: ohne Zulassung unverändert (auch für ältere Versionen lesbar), mit Zulassung eingewickelt; Lesen prüft streng und kennt nur sein Format', () => {
  const a = ohne(), b = mit();
  assert.equal(PF.enthaeltZulassung(a), false);
  assert.equal(PF.enthaeltZulassung(b), true);
  assert.equal(PF.fuerSpeicher(a), a, 'ohne Zulassung dieselbe Form wie bisher (Format 1)');
  assert.deepEqual(PF.fuerSpeicher(b), { format: 2, planfassung: b });
  for (const pf of [a, b, PF.leer()]) assert.deepEqual(PF.ausSpeicher(JSON.parse(JSON.stringify(PF.fuerSpeicher(pf)))), pf, 'Speichern und Lesen verlieren nichts');
  assert.equal(PF.ausSpeicher(JSON.parse(JSON.stringify(PF.fuerSpeicher(b)))).eintraege['t|1,0,0'].zugelassen, true);
  // Ein Leser, der die Einwicklung nicht kennt (so verhält sich jede ältere Version), findet keine gültige Planfassung und lehnt ab, statt die Zulassung zu entfernen
  assert.throws(() => PF.pruefeForm(PF.fuerSpeicher(b)), (f) => f instanceof PF.PlanfassungFehler && f.grund === 'form');
  // ein Format, das dieses Blockwerk nicht kennt, wird nie gelesen oder überschrieben
  assert.throws(() => PF.ausSpeicher({ format: 3, planfassung: b }), (f) => f instanceof PF.PlanfassungFehler && f.grund === 'format' && /nicht kennt.*aktualisieren.*nichts wurde verändert/.test(f.message));
  assert.throws(() => PF.ausSpeicher({ format: 'x'.repeat(100), planfassung: b }), /Format x{20}, das/);
  assert.throws(() => PF.ausSpeicher({ format: 2 }), PF.PlanfassungFehler);
  assert.throws(() => PF.ausSpeicher({ format: 2, planfassung: { version: -1, eintraege: {} } }), PF.PlanfassungFehler);
  assert.throws(() => PF.ausSpeicher(null), PF.PlanfassungFehler);
  assert.deepEqual(PF.ausSpeicher(PF.leer()), PF.leer());
});

test('Zulassung: bedeutet nur „bewusst akzeptiert“ – sie ändert weder den Status der Änderung noch die Technikbestätigung; jederzeit widerrufbar; alle im Raum sehen dasselbe', () => {
  const plan = { aenderungen: [{ id: 'C1', teil: 't', zelle: { x: 1, y: 0, z: 0 }, op: 'leere', status: 'verwaist', grund: 'ausserhalb', zugelassen: true }], technik: [{ ref: 'a', name: 'tech', abschnitt: 'x', status: 'nicht-bestaetigt' }] };
  const p = L.aenderungsPanel(plan);
  assert.equal(p.zugelassen[0].status, 'verwaist', 'die Zulassung macht aus einer verwaisten Änderung keine angewandte');
  assert.match(p.zugelassen[0].grund, /Verwaist/);
  const t = L.technikAnsicht(plan)[0];
  assert.deepEqual([t.status, t.funktioniert], ['nicht-bestaetigt', false], 'eine Zulassung bestätigt keine Technik');
  // widerrufbar
  const b = mit();
  const zurueck = PF.wende(b, [L.opZulassen(b, 't|1,0,0', false)], 'Ben');
  assert.equal(zurueck.planfassung.eintraege['t|1,0,0'].zugelassen, undefined);
  // dieselbe Sicht für alle: der Endstand, den der Raum zurückmeldet, und die Rundsendung enthalten die Zulassung
  const z = PF.wende(ohne(), [L.opZulassen(ohne(), 't|1,0,0')], 'Anna');
  assert.equal(z.zellen[0].aktuell.zugelassen, true);
  assert.equal(z.angenommen[0].neu.zugelassen, true);
  assert.equal(PF.uebernimm(ohne(), z.angenommen, z.planfassung.version).eintraege['t|1,0,0'].zugelassen, true);
  assert.equal(PF.setzeZellen(ohne(), z.zellen, z.planfassung.version).eintraege['t|1,0,0'].zugelassen, true);
});

test('Link und Datei: mit Zulassungen trägt der Umschlag die Version 2 (ältere Versionen lehnen ihn sichtbar ab), ohne bleibt er Version 1; unbekannte Versionen werden abgelehnt', async () => {
  const spec = await holeJson('data/beispiele/zitadelle-klein.json');
  const datei = (aenderungen) => JSON.parse(teilen.exportDatei({ spezifikation: spec, aenderungen }));
  assert.equal(datei(ohne()).version, 1, 'ohne Zulassung wie bisher (Version 1, byte-kompatibel)');
  assert.equal(datei(undefined).version, 1);
  assert.equal(datei(mit()).version, teilen.VERSION_MIT_ZULASSUNG);
  assert.equal(teilen.VERSION_MIT_ZULASSUNG, 2);
  // Hin und zurück behält die Zulassung (Datei und Link)
  const text = teilen.exportDatei({ spezifikation: spec, aenderungen: mit() });
  assert.equal(teilen.importDatei(text).aenderungen.eintraege['t|1,0,0'].zugelassen, true);
  const { code } = await teilen.kodiere({ spezifikation: spec, aenderungen: mit() });
  assert.equal((await teilen.dekodiere(code)).aenderungen.eintraege['t|1,0,0'].zugelassen, true);
  // Eine ältere Version prüft `version !== 1` und lehnt Version 2 ab; hier die Gegenprobe der Meldung dieser Version für unbekannte Versionen
  const neuer = JSON.parse(text); neuer.version = 3;
  assert.throws(() => teilen.importDatei(JSON.stringify(neuer)), /Version 3 wird nicht verstanden.*aktualisieren/);
  const zwei = JSON.parse(teilen.exportDatei({ spezifikation: spec, aenderungen: ohne() })); zwei.version = 2;
  assert.doesNotThrow(() => teilen.importDatei(JSON.stringify(zwei)), 'Version 2 ohne Zulassung ist ebenfalls gültig');
});

test('Raum: der Dienst nennt sein Planfassungsformat; ein älterer Dienst (ohne Angabe) gilt als Format 1, die Seite sendet ihm dann keine Zulassungen', () => {
  const raum = LV.neuerRaum();
  const r = LV.verarbeite(raum, LV.liesNachricht(JSON.stringify({ typ: 'hallo', name: 'Anna' })), 'v1');
  const zustand = LV.zustellungen(r.raum, r.senden, 'v1').find((x) => x.nachricht.typ === 'zustand').nachricht;
  assert.equal(zustand.format, 2);
  const k = LV.erzeugeKlient({ name: 'Ben', fortschritt: F.leer() });
  assert.equal(k.zustand.raumFormat, 1, 'bis zur Antwort des Dienstes: Format 1');
  const m = k.beiNachricht(JSON.parse(JSON.stringify(zustand)));
  assert.equal(k.zustand.raumFormat, 2);
  assert.equal(m.meldungen.find((x) => x.art === 'zustand').format, 2);
  // älterer Dienst: keine Angabe
  const alt = { ...JSON.parse(JSON.stringify(zustand)) }; delete alt.format;
  const k2 = LV.erzeugeKlient({ name: 'Cem', fortschritt: F.leer() });
  assert.equal(k2.beiNachricht(alt).meldungen.find((x) => x.art === 'zustand').format, 1);
  assert.equal(k2.zustand.raumFormat, 1);
  const kaputt = { ...alt, format: 'zwei' };
  assert.equal(LV.erzeugeKlient({ name: 'Dora', fortschritt: F.leer() }).beiNachricht(kaputt).meldungen.find((x) => x.art === 'zustand').format, 1, 'eine unbrauchbare Angabe gilt nicht als Format 2');
});

test('Review: die Speicherform ist eindeutig (flach mit Zulassung und Mischformen werden abgelehnt), Version 1 trägt keine Zulassungen', async () => {
  const b = mit();
  // flach mit Zulassung: falsch gekennzeichnet, würde von älteren Versionen still verstümmelt
  assert.throws(() => PF.ausSpeicher(JSON.parse(JSON.stringify(b))), (f) => f instanceof PF.PlanfassungFehler && f.grund === 'format' && /falsch gekennzeichnet/.test(f.message));
  // Mischform: Einwicklung und Planfassung zugleich
  for (const misch of [{ format: 2, planfassung: b, version: 7, eintraege: {} }, { format: 2, planfassung: b, eintraege: {} }, { format: 2, planfassung: ohne(), version: 1 }]) assert.throws(() => PF.ausSpeicher(misch), (f) => f.grund === 'format' && /widersprüchlich/.test(f.message));
  assert.deepEqual(PF.ausSpeicher(PF.fuerSpeicher(b)), b, 'die saubere Einwicklung geht weiter');
  // Datei: Version 1 mit Zulassungen ist falsch gekennzeichnet
  const spec = await holeJson('data/beispiele/zitadelle-klein.json');
  const falsch = JSON.parse(teilen.exportDatei({ spezifikation: spec, aenderungen: b })); falsch.version = 1;
  assert.throws(() => teilen.importDatei(JSON.stringify(falsch)), /Zulassungen.*Version 1.*Version 2/);
});

test('Review: einem älteren Dienst (ohne format) werden weder Zulassungen noch Gruppen gesendet; einem Dienst mit Format 2 schon', () => {
  const ohneAngabe = LV.erzeugeKlient({ name: 'Ben', fortschritt: F.leer() });
  ohneAngabe.beiNachricht({ typ: 'zustand', spezifikation: null, fortschritt: F.leer(), aenderungen: PF.leer(), spieler: ['Ben'] }); // kein format: älterer Dienst
  const zulassung = op('t', 1, 0, 0, { op: 'leere', zugelassen: true }, { op: 'leere' });
  assert.throws(() => ohneAngabe.aendereOperation(zulassung), /kennt keine Zulassungen.*nichts gesendet/);
  assert.throws(() => ohneAngabe.aendereOperationen([zulassung]), /kennt keine Zulassungen/);
  assert.throws(() => ohneAngabe.aendereGruppe([op('t', 1, 0, 0, null, { op: 'leere' }), op('t', 2, 0, 0, { op: 'leere' })]), /zusammengehörige.*nichts gesendet/, 'auch eine Gruppe ohne Zulassung: der ältere Dienst würde sie einzeln anwenden');
  // gewöhnliche Änderungen gehen weiter
  assert.equal(ohneAngabe.aendereOperation(op('t', 1, 0, 0, { op: 'leere' }))[0].operationen.length, 1);
  assert.equal(ohneAngabe.aendereOperationen([op('t', 1, 0, 0, { op: 'leere' })]).length, 1);
  // Format 2: alles geht
  const neu = LV.erzeugeKlient({ name: 'Cem', fortschritt: F.leer() });
  neu.beiNachricht({ typ: 'zustand', spezifikation: null, fortschritt: F.leer(), aenderungen: PF.leer(), spieler: ['Cem'], format: 2 });
  assert.equal(neu.aendereOperation(zulassung)[0].operationen[0].neu.zugelassen, true);
  assert.equal(neu.aendereGruppe([op('t', 1, 0, 0, null, { op: 'leere' }), op('t', 2, 0, 0, { op: 'leere' })])[0].gruppe, true);
});
